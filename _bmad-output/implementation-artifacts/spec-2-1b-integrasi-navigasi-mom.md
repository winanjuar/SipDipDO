---
title: 'Story 2.1b — Integrasi Navigasi MoM ke Registry Keterbukaan 1.7'
type: 'feature'
created: '2026-09-22'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1 (MoM MRO/RUPS) dikerjakan paralel dengan Story 1.7 dan melewati sistem navigasi registry-driven 1.7: halaman `/mom` ditambal manual ke `HALAMAN_TERPROTEKSI` (bukan `PERMUKAAN_PERAN`) sehingga gerbang role tidak jalan di middleware; `/mom/<uuid>` tidak digerbangi sama sekali; redirect memakai query param `?akses=mom` yang sudah dihapus kontraknya (flash-cookie, keputusan owner 2026-09-21) sehingga pesan pembuka akses tidak pernah tampil; dan halaman MoM tanpa layout `app` tanpa item nav — MoM hanya terjangkau via URL langsung (kontrak UX IA #14: "Nav owner pemegang saham; CMS COO" belum dipenuhi).

**Approach:** Daftarkan MoM ke registry 1.7 di `shared/domain/identity.ts` — `/mom` & prefix `/mom/` = `PRASYARAT_AKSES_PENUH`, `/mom/baru` = `PRASYARAT_COO` (exact-match didahulukan prefix) — dengan dukungan aturan prefix baru di lookup murni; derive `HALAMAN_TERPROTEKSI` middleware dari registry (anti-drift); item nav `mom` label 'MoM' masuk `itemNavigasi()` urutan setelah Personal sebelum Order untuk `coo` (Dashboard, Personal, MoM, Order, Audit — 5 item, Sheet "Lainnya" aktif pertama kali berisi Audit) dan `pemegang_saham` (Dashboard, Personal, MoM) dan `tanpa_saham`+`aksesPenuh` (Personal, Dashboard, MoM — keputusan owner 2026-09-22: konsisten matriks §4.8, keluar-pernah-beli); halaman MoM memakai `layout: 'app'` + resolver defensif pola 1.7 tanpa query param; API list/detail MoM diperlonggar konsisten matriks — `tanpa_saham` dengan `aksesPenuh` boleh baca (supersedesi baris I/O beku spec 2.1 via Spec Change Log, keputusan owner 2026-09-22).

</frozen-after-approval>

## Review Triage Log

| # | Klaim | Verdict | Route | Bukti/Keputusan |
|---|-------|---------|-------|-----------------|
| 1 | `heldAt` form concat `T12:00:00+07:00` + `split('T')[0]` melanggar AD-9 / magic string (mom/[id].vue) | `low` | defer | Kode pra-eksisting Story 2.1 — pola tsb adalah hasil patch review 2.1 ("Timezone lossy — fixed"); bukan sebab perubahan 2.1b. Tercatat deferred-work |
| 2 | Alert sukses finalize tidak auto-clear (mom/[id].vue) | `low` | defer | Pra-eksisting 2.1; kosmetik. Paket polish MoM di deferred-work |
| 3 | `confirm()` native untuk finalize/hapus — inkonsisten pola modal & tak ter-test | `low` | defer | Pra-eksisting 2.1; konsistensi UX lintas app, bukan lingkup 2.1b. deferred-work |
| 4 | `KODE_HTTP_TERLARANG = 403` terduplikasi dua halaman MoM | `low` | patch | Real (sebab perubahan ini). Diperbaiki: konstanta `HTTP_FORBIDDEN` di `app/lib/mom.ts` — pola eksisting `HTTP_*` (`app/lib/landing.ts`); kedua halaman mengimpor |
| 5 | `?page=999` kosong → empty state menyesatkan, paginasi hilang | `low` | defer | Perilaku pra-eksisting 2.1 (paginasi tak disentuh); deferred-work |
| 6 | 403 → `navigateTo` namun tetap return null sehingga UI error menyambar; retry `<a href>` full reload | `false` + `low` | defer (parsial) | Klaim UI menyambar gugur: saat SSR `await navigateTo()` memenangkan redirect (respons 30x, render tidak selesai); di client nav komponen tak pernah ter-mount. Klaim `<a href>` real tapi pra-eksisting 2.1 → deferred-work |
| 7 | `prasyaratPermukaan` first-match prefix, bukan longest — prefix bersarang masa depan terbayang diam-diam | `low` | patch | Real, namun tak terjangkau kini (satu kunci prefix). Komentar asumsi ditambah + unit test pin perilaku; revisi strategi tercatat deferred-work |
| 8 | Flash-cookie tanpa `secure: true` (auth-guard) | `low` | defer | Kode pra-eksisting 1.7 (blok `setCookie` tak disentuh 2.1b); deferred-work |
| 9 | File "belum terverifikasi": relaksasi API 403, barrel export, layout baru.vue, update test terpin | `false` | — | Semua terverifikasi: API `GET /api/mom`+`/[id].get` memakai `!aksesPenuh` (e2e "keluar PERNAH-beli × /mom → 200" membuktikan API membuka akses — bila 403, resolver defensif akan me-redirect dan asersi URL gagal); barrel `prasyaratPermukaan` diekspor (build Nitro hijau pasca-fix); `baru.vue` ber-layout `app`; guard unit "≤4 item" diganti kontrak baru (coo=5), hitungan e2e per-role diperbarui 75/75 |
| 10 | File terlewat: daftar route PWA/offline perlu update | `false` | — | PWA hanya mencache shell `/offline` (`nuxt.config.ts:75,100`) — tidak ada daftar route permukaan |

## Implementation Notes

- Ekspor `prasyaratPermukaan` WAJIB lewat barrel `server/domain/identity/index.ts` (AD-5) — import langsung `shared` di middleware membuat build Nitro gagal ("not exported"); tertangkap saat e2e pertama.
- Kontrak terpin yang berubah bersama kontrak baru: `identity.test.ts` guard "registry ≤ 4 item" (premisnya gugur — coo kini 5 item, Sheet aktif); `navigasi.spec.ts` hitungan per-role (coo 4 tetap + Lainnya, pemegang 3, keluar-pernah-beli 3, tanpa-saham 1); test e2e Sheet butuh tunggu hidrasi Vue (`isHydrating === false`) sebelum klik pemicu — race yang sama dengan test Keluar (pola eksisting).
- Halaman MoM: resolver defensif hanya mengalihkan `calon_owner` → landing calon; `tanpa_saham` dibiarkan lewat karena aksesPenuh berhak baca — 403 defensif dari API ditangkap → `/personal` polos (pesan tetap urusan flash-cookie middleware).
- API `GET /api/mom` + `GET /api/mom/:id`: calon_owner → 403; tanpa_saham hanya 403 bila `!aksesPenuh(principal.owner)`. Mutasi tetap COO-only. Supersedesi baris I/O beku spec 2.1 dicatat di Spec Change Log spec-2-1 (keputusan owner 2026-09-22).
- `HALAMAN_TERPROTEKSI` middleware diganti `HALAMAN_GERBANG_SESI` (LANDING_PATH + profile-completeness) ∪ registry (`prasyaratPermukaan(path) !== undefined`) — tambalan manual `/mom`, `/mom/baru` dihapus; `/mom/<uuid>` kini tergerbangi via prefix.
- Verifikasi: unit 67/67; e2e navigasi+matriks 75/75; regresi penuh 370 lulus (4 flaky pra-eksisting di suite audit — race seed antar-worker, lulus 27/27 saat isolasi); lint exit 0; typecheck bersih.
- Test yang lolos flake saat regresi: audit.api/audit-trail (pra-eksisting, tidak tersentuh story ini).
