---
id: SPEC-story-1-5-kelengkapan-profile-11-field
companions:
  - profile-fields.md
  - ../../../planning-artifacts/epics/epic-1.md
  - ../../../planning-artifacts/architecture/architecture-snd-dash-2026-09-15/ARCHITECTURE-SPINE.md
  - ../../../planning-artifacts/ux-designs/ux-snd-dash-2026-09-15/EXPERIENCE.md
sources: []
---

> **Canonical contract.** SPEC ini dan file di `companions:` adalah kontrak lengkap untuk membangun, menguji, dan memvalidasi Story 1.5. Dokumen sumber di frontmatter hanya untuk traceability.

# Story 1.5 — Kelengkapan Profile (Lampiran A) Pendaftar Mandiri

## Why

Pendaftaran owner sudah mandiri (Story 1.4 menggantikan Google Form), tetapi pendaftar macet di status `diajukan`: belum ada tempat mengisi Profile yang menjadi **prasyarat verifikasi COO** (FR-22: registrasi → Profile lengkap → verifikasi). Tanpa story ini UJ-6 tidak pernah tuntas, dan pendaftar yang tidak kunjung melengkapi menumpuk selamanya di antrian — karena itu gerbang waktu (pengingat H-3, kedaluwarsa hari ke-7, re-daftar) menyertai form. Kombinasi pain-to-solve + mandate FR-22.

## Capabilities

- **CAP-1 — Simpan Profil**
  - **intent:** Pendaftar berstatus `diajukan` dapat mengisi dan menyimpan 10 field Profil (Lampiran A #1–10, lihat `profile-fields.md`) dari halaman Kelengkapan Profile, sehingga pendaftarannya dapat diverifikasi.
  - **success:** Submit dengan seluruh field terisi → nilai tersimpan dan tampil kembali (persisten) saat halaman dibuka ulang; Gmail selalu email sesi Google dan tidak dapat diubah melalui form.
- **CAP-2 — Indikator langkah yang persis**
  - **intent:** Pendaftar dapat melihat persis field mana yang belum lengkap (UX-DR16), sehingga tahu apa yang masih harus diisi.
  - **success:** Dengan N field kosong, indikator menyebut tepat N field tersebut (per nama field, bukan sekadar hitungan); ketika 10 field lengkap, Profil dinyatakan lengkap — prasyarat verifikasi COO terpenuhi.
- **CAP-3 — Gerbang navigasi calon owner belum lengkap**
  - **intent:** Calon owner dengan Profile belum lengkap hanya dapat mengakses Kelengkapan Profile dan statusnya (UX-DR14), menjaga alur pendaftaran tetap tunggal.
  - **success:** Item navigasi lain tidak tampil; akses URL langsung ke permukaan lain ditolak **di batas server** dan dialihkan (AD-8) — bukan sekadar disembunyikan di UI.
- **CAP-4 — Cron pengingat H-3 & kedaluwarsa hari ke-7**
  - **intent:** Sistem secara otomatis mengingatkan pendaftar yang belum lengkap dan mengkedaluwarsakannya pada hari ke-7, sehingga antrian pendaftaran tetap bersih (FR-22, AD-9).
  - **success:** Job harian terproteksi CRON_SECRET: pada H-3 (3 hari kalender Jakarta sebelum kedaluwarsa) email pengingat masuk **outbox** untuk pendaftar `diajukan` belum lengkap; pada hari ke-7 status menjadi `kedaluwarsa` via compare-and-set + entry audit; sebelum H-3, atau bila Profil sudah lengkap → tanpa aksi (idempoten, tidak dobel).
- **CAP-5 — Re-daftar pendaftar kedaluwarsa**
  - **intent:** Pendaftar berstatus `kedaluwarsa` dapat mendaftar ulang dengan email yang sama sehingga ia mendapat kesempatan kedua tanpa duplikasi identitas (AD-11).
  - **success:** Transisi `kedaluwarsa → diajukan` terjadi pada **baris owner yang sama** (id tidak berubah) via CAS, tercatat audit, tanpa baris baru (unique email); percobaan ganda tidak menghasilkan baris kedua.
- **CAP-6 — Submit gagal non-validasi**
  - **intent:** Pendaftar tidak kehilangan isian ketika penyimpanan gagal karena gangguan (UX-DR19).
  - **success:** Saat submit gagal non-validasi, seluruh isian form tetap terisi dan toast tampil verbatim: "Tidak dapat menyimpan — coba lagi." — tidak ada pengisian ulang dari nol.

## Constraints

- **Satu penulis status (AD-11):** hanya modul IDENTITAS menulis status owner; setiap transisi = compare-and-set atas status sebelumnya dalam satu transaksi DB. Race tiga penulis — simpan kelengkapan vs cron kedaluwarsa vs verifikasi COO (Story 1.6) — dijaga CAS yang sama.
- **Audit atomik append-only (AD-3, AD-5):** kedaluwarsa, re-daftar, dan perubahan Profil tercatat `{actor, action, target, details}` in-tx; action dari registry enum terpusat; modul lain menulis audit hanya via API publik modul audit.
- **Kalender Asia/Jakarta (AD-9):** batas hari (H-3, hari ke-7) dihitung di dalam endpoint/service memakai helper `shared/domain` (`jakartaDayKey`, `addCalendarDays`) — bukan jam trigger UTC cron; parameter `today` injectable pada service untuk uji boundary fixed-clock.
- **Outbox (AR-6):** email pengingat ditulis sebagai baris outbox in-tx (modul proofs), kirim async + retry terpisah; kegagalan kirim tidak menggagalkan job.
- **Batas server (AD-8):** evaluasi akses halaman/API dilakukan middleware/handler server; cron endpoint terproteksi CRON_SECRET — `/api/jobs/daily` sudah ada, job pendaftar mendelegasikan ke service identity.
- **Kontrak data:** field Profil disimpan/ditransmisikan sebagai string apa adanya — tanpa parsing numerik (AD-10); `owners` unik per email; Gmail = email sesi Google; UI Bahasa Indonesia.
- **Accessibility floor (UX-DR17):** perubahan indikator kelengkapan/status diumumkan `aria-live="polite"`; warna bukan satu-satunya pembawa informasi; target sentuh ≥44×44px.

## Non-goals

- Field **Referal** tidak ada di form ini — diajukan saat Pembelian Pertama (FR-22, keputusan MRO).
- Verifikasi/penolakan pendaftar oleh COO, termasuk gerbang kelengkapan di sisi COO → Story 1.6.
- Pengiriman/retry email manual oleh COO; verifikasi kirim nyata Resend ( SPF/DKIM) → spec 1.1.
- Pengubahan Gmail/identitas Google oleh pendaftar.
- Cron kedaluwarsa Pesanan Pembelian hari ke-7 (FR-19) → Epic 3.
- Dark mode; perubahan kontrak PWA.

## Success signal

Pendaftar sintetis menyelesaikan 10 field di halaman Kelengkapan Profile dengan indikator yang selalu menunjuk sisa field yang belum diisi; bila ia berhenti mengisi melewati H-3 lalu hari ke-7 (jam disuntikkan pada cron), ia menerima email pengingat di outbox lalu statusnya menjadi `kedaluwarsa` — dan mendaftar ulang tetap pada baris yang sama; ketiganya terbaca di audit trail oleh COO.

## Assumptions

- Route halaman belum ditetapkan sumber mana pun — diasumsikan `/kelengkapan-profil`; kontrak wire API Profil diasumsikan endpoint terproteksi sesi (kandidat `PUT/PATCH /api/profile` atau `/api/pendaftaran/profil`) yang mengembalikan profil + daftar field belum lengkap. Final saat green-phase (pola asumsi kontrak `register.api.spec.ts`).
- "11 field" pada judul mengikuti Lampiran A; form = **10 field** karena Referal non-goal. Inkonsistensi wording tersisa di `EXPERIENCE.md` (IA #3 dan Flow 6 masih menyebut Referal dalam daftar) — epics/FR-22 yang berlaku.
- Profil "lengkap" = seluruh 10 field terisi non-kosong (trim); pengingat hanya untuk `diajukan` yang belum lengkap pada hari reminderOn; evaluasi kedaluwarsa idempoten.
- Validasi simpan = seluruh 10 field wajib terisi; kebijakan mengosongkan ulang field yang sudah terisi tidak dipin di sini — mengikuti green-phase.
