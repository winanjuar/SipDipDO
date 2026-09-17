/**
 * Seeder dev tabel `owners` — baris owner SINTETIS beralamat @gmail.com saja.
 * Spec PRD (Lampiran A, field 3): Gmail = akun Google untuk login — owner
 * diautentikasi OAuth Google (AD-8), sehingga data uji dev dibuat sewajar
 * kenyataan: domain @gmail.com. Kebijakan repo tetap berlaku: data owner
 * NYATA tidak pernah masuk repo/DB dev — semua email di sini sintetis dengan
 * awalan bagian-lokal yang jelas (`uji.snddash.`).
 *
 * - Idempoten: upsert by email unik (AD-11 — re-daftar = baris sama), aman
 *   dijalankan berulang.
 * - Persona meng-cermin `KONFIGURASI_UJI` server/api/test/login.post.ts
 *   (satu per role landing) + batch faker deterministik (benih tetap agar
 *   re-seed menulis email yang sama).
 * - Kontrak email sintetis milik tabel owners: HANYA @gmail.com (spec: akun
 *   owner = akun Google). Dua awalan yang disjoint — seed dev `uji.snddash.*`
 *   (file ini) dan mint uji E2E `uji.snddash.e2e.*` (login.post.ts) — mint
 *   tidak pernah menimpa baris seed dev maupun baris nyata.
 * - Menulis HANYA lewat pintu publik modul identity (AD-5).
 * - Guard: menolak NODE_ENV=production; host DB non-lokal butuh `--paksa`.
 *
 * Jalankan:
 *   npm run db:seed               # 7 persona + 10 owner extra (DB lokal)
 *   npm run db:seed -- 25         # atur jumlah owner extra (0 = persona saja)
 *   npm run db:seed -- 10 --paksa # izinkan host non-lokal
 */
import process from 'node:process'
import { faker } from '@faker-js/faker/locale/id_ID'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { closeActiveCooTenures, openCooTenure, upsertOwnerByEmail } from '../server/domain/identity'
import type { Db } from '../server/utils/db'
import type { OwnerStatus } from '../shared/domain/identity'
import * as schema from './schema'

/** Domain akun Google — satu-satunya domain yang boleh ditulis seeder ini. */
const DOMAIN_EMAIL_GOOGLE = '@gmail.com'

/** Awalan bagian-lokal sintetis — penanda baris hasil seed di tabel owners. */
const PREFIX_EMAIL_UJI = 'uji.snddash.'

/** Benih faker tetap — batch extra deterministik (email sama tiap re-seed). */
const BENIH_FAKER = 20260917

/** Jumlah owner extra (faker) bila argumen jumlah tidak diberikan. */
const JUMLAH_EXTRA_DEFAULT = 10

/**
 * Status yang dirotasi batch extra — hanya yang invariant-aman tanpa konteks
 * tambahan ('terverifikasi' diasumsikan punya Pembelian Pertama efektif).
 */
const STATUS_EXTRA: readonly OwnerStatus[] = ['terverifikasi', 'diajukan']

/** Alasan penolakan sintetis — identik dengan login.post.ts (persona ditolak). */
const ALASAN_PENOLAKAN_UJI = 'Alasan penolakan sintetis untuk uji.'

/** URL DB default — Supabase CLI lokal (sinkron dengan drizzle.config.ts). */
const URL_DB_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Flag CLI: izinkan seeding ke host non-lokal (disengaja, mis. staging). */
const FLAG_PAKSA = '--paksa'

/** Batas bagian-lokal Gmail — jaga hasil sanitasi tetap sahih. */
const PANJANG_MAKS_LOKAL = 64

/** Host yang dianggap lokal (tanpa konfirmasi --paksa). */
const HOST_LOKAL: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/** Konfigurasi persona uji — cermin KONFIGURASI_UJI login.post.ts. */
interface PersonaUji {
  identifier: string
  status: OwnerStatus
  cooAktif: boolean
  punyaSaham: boolean
  alasanPenolakan: string | null
}

const PERSONA_UJI: readonly PersonaUji[] = [
  { identifier: 'coo', status: 'terverifikasi', cooAktif: true, punyaSaham: true, alasanPenolakan: null },
  { identifier: 'pemegang-saham', status: 'terverifikasi', cooAktif: false, punyaSaham: true, alasanPenolakan: null },
  { identifier: 'tanpa-saham', status: 'terverifikasi', cooAktif: false, punyaSaham: false, alasanPenolakan: null },
  { identifier: 'keluar', status: 'keluar', cooAktif: false, punyaSaham: true, alasanPenolakan: null },
  { identifier: 'calon-diajukan', status: 'diajukan', cooAktif: false, punyaSaham: false, alasanPenolakan: null },
  { identifier: 'calon-ditolak', status: 'ditolak', cooAktif: false, punyaSaham: false, alasanPenolakan: ALASAN_PENOLAKAN_UJI },
  { identifier: 'calon-kedaluwarsa', status: 'kedaluwarsa', cooAktif: false, punyaSaham: false, alasanPenolakan: null },
]

/** Predikat murni: akun Google owner = alamat @gmail.com (case-insensitive). */
function emailGoogle(email: string): boolean {
  return email.toLowerCase().endsWith(DOMAIN_EMAIL_GOOGLE)
}

/** Post-condition: email manapun yang menuju DB lewat seeder HARUS @gmail.com. */
function pastikanGoogle(email: string): void {
  if (!emailGoogle(email)) {
    throw new Error(`Seeder hanya menulis email berakhiran '${DOMAIN_EMAIL_GOOGLE}' — mendapat '${email}'.`)
  }
}

/**
 * Normalisasi bagian-lokal ke bentuk yang diterbitkan Gmail: huruf kecil
 * a-z, digit, titik; tanpa titik berurutan/awalan/akhiran; maks 64 karakter.
 */
function normalisasiLokal(lokal: string): string {
  const dibersihkan = lokal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, PANJANG_MAKS_LOKAL)
    .replace(/\.+$/, '')
  return dibersihkan.length > 0 ? dibersihkan : 'owner'
}

/** Email persona — identifier dijerikan ke bagian-lokal Gmail-sahih. */
function emailPersona(identifier: string): string {
  return `${PREFIX_EMAIL_UJI}${normalisasiLokal(identifier)}${DOMAIN_EMAIL_GOOGLE}`
}

/** Argumen posisi pertama = jumlah owner extra; default bila kosong/tak sahih. */
function bacaJumlahExtra(argv: string[]): number {
  const nilai = argv[2]
  if (nilai === undefined || !/^\d{1,3}$/.test(nilai)) return JUMLAH_EXTRA_DEFAULT
  return Number.parseInt(nilai)
}

/** Host DB lokal? (tanpa ini, seeding jauh butuh --paksa). */
function hostLokal(urlDb: string): boolean {
  return HOST_LOKAL.includes(new URL(urlDb).hostname)
}

interface HasilSeed {
  email: string
  status: OwnerStatus
  coo: boolean
}

async function seedPersona(db: Db, now: Date): Promise<HasilSeed[]> {
  const hasil: HasilSeed[] = []
  for (const persona of PERSONA_UJI) {
    const email = emailPersona(persona.identifier)
    pastikanGoogle(email)
    const owner = await upsertOwnerByEmail(db, {
      email,
      status: persona.status,
      rejectionReason: persona.alasanPenolakan,
      firstEffectiveAt: persona.punyaSaham ? now.toISOString() : null,
    })
    if (persona.cooAktif) await openCooTenure(db, owner.id, now)
    else await closeActiveCooTenures(db, owner.id, now)
    hasil.push({ email, status: owner.status, coo: persona.cooAktif })
  }
  return hasil
}

async function seedExtra(db: Db, jumlah: number, now: Date): Promise<HasilSeed[]> {
  faker.seed(BENIH_FAKER)
  const hasil: HasilSeed[] = []
  for (let i = 0; i < jumlah; i++) {
    // Urutan bernomor menjamin keunikan email antar-extra (upsert idempoten).
    const email = `${PREFIX_EMAIL_UJI}${normalisasiLokal(faker.internet.username())}.${i + 1}${DOMAIN_EMAIL_GOOGLE}`
    pastikanGoogle(email)
    const status = STATUS_EXTRA[i % STATUS_EXTRA.length]
    if (!status) throw new Error('seedExtra: rotasi status extra kosong — konstanta STATUS_EXTRA tidak boleh kosong.')
    const owner = await upsertOwnerByEmail(db, {
      email,
      status,
      rejectionReason: null,
      firstEffectiveAt: status === 'terverifikasi' ? now.toISOString() : null,
    })
    hasil.push({ email, status: owner.status, coo: false })
  }
  return hasil
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeder menolak jalan di NODE_ENV=production — baris sintetis tidak boleh mencemari DB produksi.')
  }
  const urlDb = process.env.DATABASE_URL ?? URL_DB_DEFAULT
  if (!hostLokal(urlDb) && !process.argv.includes(FLAG_PAKSA)) {
    throw new Error(`Host DB '${new URL(urlDb).hostname}' non-lokal — seeder sintetis butuh flag ${FLAG_PAKSA} bila memang disengaja.`)
  }
  const jumlahExtra = bacaJumlahExtra(process.argv)

  const sql = postgres(urlDb, { max: 1, prepare: false })
  try {
    const db = drizzle(sql, { schema })
    const now = new Date()
    const persona = await seedPersona(db, now)
    const extra = await seedExtra(db, jumlahExtra, now)

    for (const baris of [...persona, ...extra]) {
      console.log(`${baris.email}  ->  ${baris.status}${baris.coo ? ' (COO aktif)' : ''}`)
    }
    console.log(`Selesai: ${persona.length} persona + ${extra.length} extra = ${persona.length + extra.length} baris owner (upsert idempoten, semua ${DOMAIN_EMAIL_GOOGLE}).`)
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
