// server/domain/proofs/proofs.service.ts
//
// Logika domain proofs (FR-11, AD-5). Empat tanggung jawab (design.md A.4/B.8):
//
//   - enqueueProof(tx, ledgerTxId) : baris outbox 'proof' DI DALAM transaksi
//                                    aksi (AD-5). Ini pintu kanonik yang
//                                    menggantikan hook sementara ledger/proof.hook.ts.
//   - enqueueEmail(tx, email)      : email notifikasi generik in-tx (mis. COO
//                                    new-order FR-19 §8). OTP TIDAK lewat sini.
//   - renderProofPdf(ledgerTxId)   : FUNGSI MURNI state ledger pada titik potong
//                                    transaksinya (regenerate-on-demand). Data-
//                                    fetch (repo) dipisah dari render murni
//                                    (`renderTemplateV3`) agar byte-identik untuk
//                                    state yang sama (Property 11, §11.3).
//   - drainOutbox()                : async + retry post-commit. Kirim via
//                                    transport (Resend/SMTP) yang di-abstraksi;
//                                    kegagalan terus-menerus WAJIB terlihat
//                                    (log + alert, §20.10 / Error Handling).
//                                    Kegagalan satu baris TIDAK menggagalkan
//                                    seluruh drain.
//
// CATATAN RENDER (§11.4): dependency terpin `@react-pdf/renderer@4.9.0` memakai
// JSX + runtime React yang TIDAK ter-type-check pada tsconfig server terisolasi
// (Nuxt/Vue, tanpa @types/react / jsx). Untuk task ini renderer memakai
// SERIALIZER DETERMINISTIK yang ditandai jelas (`renderTemplateV3`): membangun
// model dokumen "Template Konfirmasi Pembelian Saham v3" lalu meng-encode-nya ke
// bytes secara stabil. Ini menjamin idempotensi (state sama → byte-identik).
// Saat pipeline PDF React tersedia, ganti isi `renderTemplateV3` dengan
// `@react-pdf/renderer.renderToBuffer(<TemplateV3 .../>)` TANPA mengubah
// `renderProofPdf`/`buildProofData` (data-fetch tetap terpisah dari render).

import { db } from '../../utils/db'
import type { Tx } from '../../utils/db'
import { displayRatio } from '../../../shared/domain/decimal'
import { portion, strength } from '../../../shared/domain/weighting'
import type { Uuid } from '../../../shared/domain/types'
import { identity } from '../identity'
import * as repo from './proofs.repo'
import { ProofsError } from './events'
import type { OutboundEmail, OutboxRow, ProofData } from './events'

// ---------------------------------------------------------------------------
// Transport email — abstraksi kecil (Resend/SMTP) dengan default no-op/log
// ---------------------------------------------------------------------------

/**
 * Kontrak transport pengirim email. Implementasi nyata (Resend/SMTP) disuntik
 * lewat `setTransport`; default `logTransport` hanya mencatat (bekerja tanpa
 * kredensial email hidup, mis. saat dev/test/CI).
 */
export interface EmailTransport {
  send(message: {
    to: string
    subject: string
    body: string
    /** Lampiran Bukti Transaksi (PDF/bytes) bila baris outbox bertipe 'proof'. */
    attachment?: { filename: string; content: Uint8Array }
  }): Promise<void>
}

/** Hook alert untuk kegagalan terus-menerus (§20.10). Default: log peringatan. */
export type AlertHook = (info: {
  outboxId: Uuid
  attempts: number
  lastError: string
}) => void

/** Transport default: mencatat, tidak mengirim (aman tanpa kredensial). */
const logTransport: EmailTransport = {
  async send(message) {
    console.info(
      `[proofs.transport:noop] to=${message.to} subject=${JSON.stringify(message.subject)}`,
    )
  },
}

/** Alert default: catat sebagai error agar terlihat pada log/monitoring. */
const logAlert: AlertHook = ({ outboxId, attempts, lastError }) => {
  console.error(
    `[proofs.alert] outbox ${outboxId} gagal terkirim setelah ${attempts} percobaan: ${lastError}`,
  )
}

let transport: EmailTransport = logTransport
let alertHook: AlertHook = logAlert

/** Menyuntik transport nyata (Resend/SMTP). Dipanggil saat bootstrap runtime. */
export function setTransport(next: EmailTransport): void {
  transport = next
}

/** Menyuntik alert hook nyata (mis. kirim ke channel ops). */
export function setAlertHook(next: AlertHook): void {
  alertHook = next
}

/** Ambang percobaan sebelum kegagalan dianggap persisten & memicu alert. */
export const MAX_ATTEMPTS = 5

/** Batas jumlah baris yang diproses per pemanggilan `drainOutbox`. */
const DRAIN_BATCH = 50

// ---------------------------------------------------------------------------
// enqueueProof / enqueueEmail — penulisan outbox in-tx (AD-5)
// ---------------------------------------------------------------------------

/**
 * Meng-enqueue Bukti Transaksi untuk `ledgerTxId` DI DALAM transaksi aksi
 * (AD-5). Menulis baris outbox bertanda 'proof' yang mereferensikan transaksi
 * ledger; `recipient` diresolve saat drain (regenerate-on-demand). Ini pintu
 * kanonik yang menggantikan `ledger/proof.hook.ts`.
 *
 * TIDAK best-effort menelan error di sini: pemanggil (finalisasi) memutuskan;
 * namun insert outbox sederhana jarang gagal, dan bila gagal transaksi aksi
 * ikut rollback (konsisten). Recipient sengaja dikosongkan → diresolve di drain.
 */
export async function enqueueProof(tx: Tx, ledgerTxId: Uuid): Promise<void> {
  await repo.insertOutbox(tx, {
    recipient: '',
    subject: 'Bukti Transaksi',
    body: null,
    ledgerTxId,
    payload: repo.proofPayload(ledgerTxId),
  })
}

/**
 * Meng-enqueue email notifikasi generik DI DALAM transaksi aksi (AD-5).
 * Dipakai untuk notifikasi (mis. COO diberi tahu Pesanan Pembelian baru,
 * FR-19 §8). OTP TIDAK melewati jalur ini.
 */
export async function enqueueEmail(tx: Tx, email: OutboundEmail): Promise<void> {
  await repo.insertOutbox(tx, {
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    ledgerTxId: null,
    payload: repo.notificationPayload(email),
  })
}

// ---------------------------------------------------------------------------
// renderProofPdf — fungsi MURNI state ledger pada titik potong (Property 11)
// ---------------------------------------------------------------------------

/**
 * Merakit `ProofData` dari state ledger pada TITIK POTONG transaksi `ledgerTxId`
 * (data-fetch — TERPISAH dari render murni). Membaca baris ledger + agregat
 * titik potong (Σ Shares/Ceil owner, grand total Shares) lalu menghitung
 * Strength/Portion via rumus shared/domain. Deterministik: bergantung hanya pada
 * state ledger s.d. titik potong, bukan posisi mutakhir.
 *
 * @throws ProofsError('LEDGER_TX_NOT_FOUND') bila transaksi tak dikenal.
 * @throws ProofsError('OWNER_NOT_FOUND') bila owner transaksi tak ditemukan.
 */
export async function buildProofData(ledgerTxId: Uuid): Promise<ProofData> {
  const tx = await repo.getLedgerTx(db, ledgerTxId)
  if (!tx) {
    throw new ProofsError(
      'LEDGER_TX_NOT_FOUND',
      `Transaksi ledger ${ledgerTxId} tidak ditemukan untuk Bukti Transaksi.`,
      { ledgerTxId },
    )
  }

  const agg = await repo.cutPointAggregates(db, tx)

  let owner
  try {
    owner = await identity.getLifecycle(db, tx.ownerId)
  } catch {
    owner = null
  }
  if (!owner) {
    throw new ProofsError(
      'OWNER_NOT_FOUND',
      `Owner ${tx.ownerId} untuk transaksi ${ledgerTxId} tidak ditemukan.`,
      { ledgerTxId, ownerId: tx.ownerId },
    )
  }

  return {
    templateVersion: 'Template Konfirmasi Pembelian Saham v3',
    ledgerTxId: tx.id,
    ownerId: tx.ownerId,
    ownerName: owner.name ?? '',
    ownerEmail: owner.email,
    transactionDate: tx.paymentDate,
    capitalType: tx.capitalType,
    quantity: tx.quantity,
    price: tx.finalPrice,
    transactionShares: tx.shares,
    transactionCeil: tx.ceil,
    ownerTotalShares: agg.ownerTotalShares,
    ownerTotalCeil: agg.ownerTotalCeil,
    strength: strength(agg.ownerTotalShares, agg.ownerTotalCeil),
    portion: portion(agg.ownerTotalShares, agg.grandTotalShares),
  }
}

/**
 * Render MURNI "Template Konfirmasi Pembelian Saham v3" (§11.4) dari `ProofData`
 * menjadi bytes. Fungsi murni: keluaran hanya bergantung pada `data` → state
 * ledger yang sama menghasilkan byte-identik (Property 11).
 *
 * PLACEHOLDER DETERMINISTIK (ditandai jelas): membangun dokumen teks berlabel
 * "SND-PROOF-V3" dengan field terurut tetap lalu meng-encode UTF-8. Persentase
 * Strength/Portion ditampilkan half-up 2 desimal (displayRatio → persen) sesuai
 * konvensi tampilan. Ganti isi fungsi ini dengan
 * `@react-pdf/renderer.renderToBuffer(<TemplateV3 data={data} />)` saat pipeline
 * React-PDF tersedia; tanda tangan & pemanggil tidak berubah.
 */
export function renderTemplateV3(data: ProofData): Uint8Array {
  const pct = (ratio: string): string => {
    // displayRatio → fraksi half-up 2 desimal; ×100 untuk persen (2 desimal).
    const frac = displayRatio(ratio)
    // Format persen deterministik tanpa Number() atas nilai uang/rasio mentah.
    const [intPart, decPart = ''] = frac.split('.')
    const digits = (intPart + decPart.padEnd(2, '0')).replace(/^0+(?=\d)/, '')
    const asPercent = `${digits.slice(0, -2) || '0'}.${digits.slice(-2)}`
    return `${asPercent}%`
  }

  // Field terurut tetap — urutan & isi adalah bagian kontrak byte-identik.
  const lines: string[] = [
    'SND-PROOF-V3',
    `template=${data.templateVersion}`,
    `ledgerTxId=${data.ledgerTxId}`,
    `ownerId=${data.ownerId}`,
    `ownerName=${data.ownerName}`,
    `ownerEmail=${data.ownerEmail}`,
    `transactionDate=${data.transactionDate}`,
    `capitalType=${data.capitalType}`,
    `quantity=${data.quantity}`,
    `price=${data.price}`,
    `shares=${data.transactionShares}`,
    `ceil=${data.transactionCeil}`,
    `ownerTotalShares=${data.ownerTotalShares}`,
    `ownerTotalCeil=${data.ownerTotalCeil}`,
    `strength=${pct(data.strength)}`,
    `portion=${pct(data.portion)}`,
    '',
  ]
  return new TextEncoder().encode(lines.join('\n'))
}

/**
 * Menghasilkan Bukti Transaksi sebagai bytes untuk `ledgerTxId` — fungsi murni
 * state ledger pada titik potong (regenerate-on-demand, §11.3). Owner dapat
 * mengunduh ulang kapan pun; hasil selalu byte-identik untuk state yang sama.
 */
export async function renderProofPdf(ledgerTxId: Uuid): Promise<Uint8Array> {
  const data = await buildProofData(ledgerTxId)
  return renderTemplateV3(data)
}

// ---------------------------------------------------------------------------
// drainOutbox — async + retry post-commit; kegagalan persisten wajib terlihat
// ---------------------------------------------------------------------------

/** Meresolusi recipient sebuah baris Bukti bila kosong (dari email owner). */
async function resolveProofRecipient(row: OutboxRow): Promise<string> {
  if (row.recipient) return row.recipient
  if (!row.ledgerTxId) return ''
  const tx = await repo.getLedgerTx(db, row.ledgerTxId)
  if (!tx) return ''
  try {
    const owner = await identity.getLifecycle(db, tx.ownerId)
    return owner?.email ?? ''
  } catch {
    return ''
  }
}

/** Mengirim satu baris outbox lewat transport; melempar bila gagal. */
async function sendRow(row: OutboxRow): Promise<void> {
  const isProof =
    (row.payload as { kind?: string }).kind === 'proof' || row.ledgerTxId != null

  const to = await resolveProofRecipient(row)
  if (!to) {
    throw new Error('recipient belum teresolusi (email owner tidak tersedia)')
  }
  if (!row.recipient) {
    await repo.setRecipient(row.id, to)
  }

  if (isProof && row.ledgerTxId) {
    // Bukti = regenerate-on-demand pada titik potong (Property 11).
    const pdf = await renderProofPdf(row.ledgerTxId)
    await transport.send({
      to,
      subject: row.subject,
      body: row.body ?? 'Terlampir Bukti Transaksi Anda.',
      attachment: { filename: `bukti-${row.ledgerTxId}.pdf`, content: pdf },
    })
    return
  }

  await transport.send({ to, subject: row.subject, body: row.body ?? '' })
}

/**
 * Memproses baris outbox yang belum terkirim (`sentAt IS NULL`) dengan retry:
 * per baris, coba kirim; sukses → `markSent`; gagal → `markFailed` (naikkan
 * attempts + simpan lastError). Kegagalan satu baris DITELAN agar TIDAK
 * menggagalkan seluruh drain. Bila attempts (setelah kenaikan) mencapai/melewati
 * `MAX_ATTEMPTS`, picu `alertHook` (log + alert, §20.10) agar kegagalan
 * terus-menerus terlihat.
 *
 * Dipanggil async post-commit (mis. cron/queue), DI LUAR transaksi aksi.
 */
export async function drainOutbox(): Promise<void> {
  const rows = await repo.listUnsent(DRAIN_BATCH)

  for (const row of rows) {
    try {
      await sendRow(row)
      await repo.markSent(row.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await repo.markFailed(row.id, message)

      // attempts baru = attempts baris + 1 (markFailed menaikkan di DB).
      const attempts = row.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        alertHook({ outboxId: row.id, attempts, lastError: message })
      }
      // Jangan hard-fail seluruh drain — lanjut ke baris berikutnya.
    }
  }
}
