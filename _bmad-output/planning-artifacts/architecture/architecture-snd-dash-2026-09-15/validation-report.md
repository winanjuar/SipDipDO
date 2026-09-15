# Validation Report v2 — Architecture Spine snd-dash

- **Spine:** `_bmad-output/planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md` (status final, updated 2026-09-15)
- **Run at:** 2026-09-15 (post-update: AD-12 PWA, invariant platform, konvensi bentuk modul, Do/Don't, sinkron UX)
- **Gate:** lint 0 temuan → rubric walker + tech-currency + adversarial (3 subagent paralel, konteks independen)

## Gate verdict

**HOLES-FOUND — spine perlu satu putaran Update sebelum build.** Paradigma inti bertahan di bawah serangan (ledger append-only, single-writer, rumus bersama, CAS), lint bersih, versi hampir semua CURRENT — tetapi adversarial mengonstruksi 14 pasangan divergen yang masing-masing patuh pada seluruh AD namun saling tidak kompatibel: 1 critical (kontradiksi internal AD-2 soal penarikan), 7 high (OTP binding, semantik migrasi, titik potong Bukti, topologi lock, format kawat uang, derivasi status owner, akuntansi poin lintas cut-off), ditambah 1 high rubric (substrate komponen UI shadcn/Vue belum direkonsiliasi).

## Category verdicts

| Lensa | Verdict | C | H | M | L | I |
|---|---|---|---|---|---|---|
| Lint (deterministik) | CLEAN | 0 | 0 | 0 | 0 | — |
| Rubric walker | PASS-with-fixes | 0 | 1 | 1 | 4 | — |
| Tech-currency | MINOR-DISCREPANCIES | 0 | 0 | 1 | 3 | 2 |
| Adversarial | HOLES-FOUND | 1 | 7 | 5 | 1 | — |
| **Total** | | **1** | **8** | **7** | **8** | **2** |

## Critical (1)

### [Adversarial] F1 — AD-2 kontradiksi diri: penarikan dijaga CAS-on-status, padahal "bukan status"
Unit A (penarikan) hanya set `withdrawn_at` + audit — compliant dengan "penarikan bukan status". Unit B (konfirmasi) CAS `WHERE status='menunggu_konfirmasi'` — compliant verbatim AD-2. Tabrakan: COO bisa finalisasi pesanan yang baru ditarik; assembly kanonik "seluruh pesanan menunggu_konfirmasi" menghitung pesanan ditarik → penolakan Strength yang salah & yakin pada pesanan valid; cron expiry menyala pada pesanan ditarik.
Fix (usulan teks AD ada di review): penarikan = transisi tersimpan sendiri (`withdrawn_at`), SETIAP guard wajib `AND withdrawn_at IS NULL`, definisi kanonik pesanan-pending tunggal untuk pratinjau/submit/re-validasi/cron; hapus kalimat kontradiktif.

## High (8)

### [Rubric] H-1 — Substrate komponen UI: shadcn/ui (React) vs stack Nuxt/Vue belum direkonsiliasi
DESIGN.md/EXPERIENCE.md berkontrak dengan shadcn/ui + Tailwind (ekosistem React — `input-otp`, `sonner`) verbatim; stack adalah Nuxt 4/Vue 3. Spine tidak menyebut substrate komponen di Stack maupun Deferred → tiap story UI bisa menarik primitif Vue berbeda; kontrak visual UX tanpa titik penegakan.
Fix: baris Stack seed — shadcn-vue (reka-ui) + Tailwind sebagai implementasi Vue dari kontrak shadcn, smoke-test paritas Dialog/Sheet/Input-OTP/Toast saat scaffold + sinkron catatan dua arah ke UX docs; atau minimal Deferred eksplisit.

### [Adversarial] F2 — OTP MFA tidak terikat satu instance aksi / satu transaksi
Verify-outside-tx vs consume-inside-tx dua-duanya compliant → token lintas aksi/lintas target; OTP terbakar tanpa transaksi saat re-validasi gagal (retry = email baru, melanggar SM-4); dialog dan endpoint bisa beda protokol → konfirmasi gagal permanen.
Fix: `otp_codes` menyimpan `{action_type, target_ref}`; verifikasi DAN konsumsi di DALAM transaksi finalisasi; rollback mengembalikan konsumsi.

### [Adversarial] F3 — Semantik event/outbox migrasi tak terdefinisi
Import via pintu finalisasi lengkap (compliant) vs outbox in-tx per append (compliant) → badai email Bukti historis, ATAU kalau event disupres: keterbukaan §4.8 & status Pembelian Pertama tak pernah terbentuk untuk 22 owner — go-live terblokir.
Fix: migrasi memakai pintu finalisasi lengkap TANPA baris outbox email untuk transaksi berlabel migrasi; daftar event diteruskan-vs-disupres dieksplisitkan & diuji di acceptance migrasi.

### [Adversarial] F4 — Bukti Transaksi: "deterministik dari ledger" tanpa titik potong waktu
Regenerasi dari posisi mutakhir vs replay hingga timestamp efektif — dua-duanya compliant → unduh ulang Bukti Maret di September menunjukkan Portion berbeda dari email asli → dugaan manipulasi (SM-1/SM-3).
Fix: Bukti = fungsi murni state ledger PADA titik potong transaksi; regenerasi selalu di titik potong yang sama.

### [Adversarial] F5 — Tangga lock AD-2 tidak mencakup keluarga tx rekap DISTRIBUSI/IDENTITAS
Finalisasi lock buy_order→rkap→position vs rekap lock owner dulu (AD-11) → deadlock AB-BA; atau snapshot posisi inkonsisten → ΣPortion ≠ 100% dibekukan ke rekap RUPS imutabel (AD-10).
Fix: urutan lock GLOBAL satu keluarga penulis: `buy_orders → rkap_phases → positions → owners → contribution_periods → distribution`; rekap baca snapshot konsisten.

### [Adversarial] F6 — Format kawat uang: string vs number tak dipinkan
API kembalikan string desimal Drizzle; island koersi `Number()` "untuk display" → `shared/domain` menerima tipe campur; numeric(18,2) lintas 2^53 terdegradasi diam-diam → pratinjau ≠ validasi server tepat di input batas.
Fix: kontrak kawat — uang & ratio sebagai string desimal berskala tetap; SATU pasangan parse/serialize di shared/domain; larang `Number()`/`parseFloat()` atas nilai uang/ratio di semua lapisan + baris Don't.

### [Adversarial] F7 — Derivasi role/keterbukaan/referral owner & enum status owner tak dipinkan
Akses via `positions.shares > 0` live vs via status tersimpan (AD-11) → entry kompensasi AD-1 yang meng-nol-kan shares salah mengunci owner berhak; himpunan referral beda antara submit dan konfirmasi untuk owner Keluar/reaktivasi; enum status owner tak dipinkan di mana pun.
Fix: enum siklus hidup owner dipinkan + `first_effective_at` hanya di-set event Pembelian Pertama; predikat `aksesPenuh`/`perluReferral`/`pilihanReferral` = fungsi kanonik tunggal IDENTITAS, tidak pernah dari shares live.

### [Adversarial] F8 — "Ditandai selesai" vs "ditunaikan": poin lintas ≥2 cut-off ambigu
Rekap menjumlahkan SEMUA periode final-belum-tunaikan vs hanya periode terakhir — dua-duanya compliant → penyebut total poin beda → pembagian Insentif salah, dibekukan ke snapshot rekap imutabel.
Fix: definisi tegas dua istilah (Glossary konvensi); rekap = Σ semua periode ter-finalisasi-belum-tertunaikan; penandaan tertunaikan atomik dengan simpan rekap.

## Medium (7)

- **[Rubric] M-1** FR-22 pendaftaran lifecycle tanpa single-writer/enum/CAS — kelas race yang sama dengan yang AD-2 hapus untuk pesanan (verifikasi COO vs cron expiry vs kelengkapan Profile). Fix: perluas AD-11/konvensi Data.
- **[Adversarial] F9** Portion absen dari enumerasi rumus AD-6 → island chart improvisasi `toFixed` → label chart ≠ tabel satu layar. Fix: seluruh persentase termasuk rumus domain.
- **[Adversarial] F10** Himpunan aksi ber-MFA tak terenumerasi → endpoint/UI saling tidak cocok (penyesuaian RKAP tak terpakai / cakupan drift per story). Fix: himpunan tertutup Phase 1 (FR-20, FR-21 saja) + eksplisit BUKAN.
- **[Adversarial] F11** Assembly input kanonik hanya untuk Strength → Quantity maksimal pratinjau ≠ limit re-validasi (861 vs 800) untuk pesanan yang sistem sendiri usulkan. Fix: fungsi assembly kanonik per gerbang.
- **[Adversarial] F12** "Selalu sinkron" tanpa kontrak runtime → tab PWA dua hari menyajikan angka basi tanpa sinyal (AD-12 hanya bicara cache). Fix: refetch on visibility ATAU penanda "per …"; satu payload bersama tabel+island.
- **[Adversarial] F13** Kewenangan COO dicek di sesi vs di commit → konfirmasi pejabat terguling tercatat atas nama lama. Fix: otoritaskan `coo_tenures` di dalam tx finalisasi.
- **[Tech] M1** Klaim "@vite-pwa/nuxt kompatibel Nuxt 4 — terverifikasi Sep 2026" tanpa sumber; vendor masih Nuxt 3-only (`@nuxt/kit ^3.9.0`), belum ada rilis sejak Feb 2026, dan Nuxt 4.5 kini Vite 8/Rolldown. Fix: reword klaim + smoke-test build sebagai gerbang go/no-go + fallback dinamai.

## Low (8) + Info (2)

- **[Rubric] L-1** AD-10 "decimal lib ATAU integer sen" fork hidup → pilih satu saat scaffold, campuran dilarang.
- **[Rubric] L-2** sources frontmatter kurang DESIGN.md (kontrak visual justru ke sana dirujuk).
- **[Rubric] L-3** Ops diam soal error tracking/alerting (retry outbox gagal = kegagalan senyap) & SPF/DKIM/From-domain Resend (OTP = kanal MFA).
- **[Rubric] L-4** Attempt-limit & resend-cooldown OTP hanya state dialog UX — belum diikat server-side.
- **[Tech] L1** Node floor: Nuxt 4.5.2 engines `>=22.19.0`; Node 22 security-only → pin dev/CI Node 24 LTS (24.21.x).
- **[Tech] L2** NuxtAuth 1.3.1 current tapi menunggangi next-auth v4 legacy → namai fallback (nuxt-auth-utils / OAuth manual).
- **[Tech] L3** Drizzle v1.0 di rc.5 (bukan GA) → pin eksak `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10`, cek dist-tag hari scaffold.
- **[Adversarial] F14** Dua periode harga satu tanggal efektif tanpa tiebreak → pratinjau dan snapshot beda harga untuk satu pesanan. Fix: unique constraint per (jenis, tanggal) + koreksi = ubah baris + audit.
- **[Tech] I1** PG 18 memang belum ada di Supabase hosted (klaim spine sudah benar).
- **[Tech] I2** react-pdf di server Vue-Nuxt sudah dicakup catatan spine (React tidak sampai browser) — tetap pilihan tepat.

## Reviewer files

- `reviews/review-rubric-v2.md`
- `reviews/review-tech-currency-v2.md`
- `reviews/review-adversarial-v2.md` (berisi 14 pasangan divergen + usulan teks AD lengkap)
