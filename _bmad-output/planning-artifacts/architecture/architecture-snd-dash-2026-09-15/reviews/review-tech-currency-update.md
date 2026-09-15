---
name: Review Technology Currency — Architecture Spine (pembaruan AD-12)
type: review
target: ../ARCHITECTURE-SPINE.md
scope: Verifikasi web klaim versi stack + klaim baru AD-12 (@vite-pwa/nuxt)
status: final
created: 2026-09-15
reviewer-glass: technology-currency
---

# Review Technology Currency — Architecture Spine (pembaruan AD-12)

**Tanggal:** 2026-09-15 · **Metode:** cek dist-tags npm registry langsung, manifest paket, release notes GitHub, issue tracker vendor, dokumentasi resmi, changelog Supabase.

## Verdict

**LULUS DENGAN PERBAIKAN.** Fondasi stack terkonfirmasi mutakhir: Nuxt 4.5.2 adalah `latest`, Drizzle 0.45.2 stabil dengan v1.0 memang masih rc (bukan GA), drizzle-kit 0.31.10, NuxtAuth sidebase 1.3.1, @react-pdf/renderer 4.9.0, Supabase PostgreSQL 17 — semua akurat. Namun **satu klaim baru perlu diperbaiki**: baris "@vite-pwa/nuxt 1.1.1 — kompatibel Nuxt 4 (terverifikasi Sep 2026)" **melebih-lebihkan status vendor**. Versi 1.1.1 memang `latest`, tetapi kompatibilitas Nuxt 4 **tidak pernah dinyatakan vendor** (README, dokumentasi, dan seluruh release notes 1.x hanya menyebut Nuxt 3; dependensi runtime dipin `@nuxt/kit ^3.9.0`), dan ada issue build-failure di Nuxt 4 yang masih terbuka tanpa jawaban (#212). Perbaikan kata + gerbang smoke-test di scaffold (sama seperti perlakuan NuxtAuth) membuat spine jujur kembali.

---

## Temuan

### T-1 [Sedang] Klaim "@vite-pwa/nuxt 1.1.1 — kompatibel Nuxt 4 (terverifikasi Sep 2026)" overstate — vendor belum mendeklarasikan Nuxt 4

**Klaim spine (baris Stack, AD-12):** `@vite-pwa/nuxt` 1.1.1, "kompatibel Nuxt 4 (terverifikasi Sep 2026)".

**Temuan web (Sep 2026):**

- Versi **1.1.1 benar** dan adalah `latest` di npm ([dist-tags](https://registry.npmjs.org/-/package/@vite-pwa%2Fnuxt/dist-tags), [npm page](https://www.npmjs.com/package/@vite-pwa/nuxt)); dirilis ± 6 Feb 2026 ([releases](https://github.com/vite-pwa/nuxt/releases)).
- **Vendor menyebut Nuxt 3 saja, di semua kanal resmi:** README repo = "Zero-config PWA Plugin for Nuxt 3 … requires Vite 5 and Nuxt 3.9.0+" ([github.com/vite-pwa/nuxt](https://github.com/vite-pwa/nuxt)); dokumentasi resmi hanya merujuk Nuxt 3 ([vite-pwa-org.netlify.app/frameworks/nuxt](https://vite-pwa-org.netlify.app/frameworks/nuxt)); halaman modul Nuxt menyatakan "requires Vite 5 and Nuxt 3.9.0+" ([nuxt.com/modules/vite-pwa-nuxt](https://nuxt.com/modules/vite-pwa-nuxt)). **Tidak ada satu pun release note 1.x (1.0.0 → 1.1.1) yang menyebut Nuxt 4.**
- **Manifest 1.1.1 (dan `main` saat ini)** tidak punya peer dependency pada `nuxt`, tapi dependensi runtime `@nuxt/kit: ^3.9.0` — caret 3.x tidak menjangkau kit 4.x, sehingga di bawah Nuxt 4 terpasang salinan kit 3.x bersarang di samping kit 4.x milik Nuxt (skew versi; sering tak masalah, tapi bukan desain yang dites vendor) ([manifest 1.1.1](https://registry.npmjs.org/@vite-pwa/nuxt/1.1.1), [package.json main](https://raw.githubusercontent.com/vite-pwa/nuxt/main/package.json)).
- **Issue Nuxt 4 terbuka:** [#212 — "Unable to write the service worker file / Cannot find module '@babel/parser'" pada fresh Nuxt 4.1.2](https://github.com/vite-pwa/nuxt/issues/212) — build gagal di tahap generateSW (workbox-build), **masih terbuka tanpa tanggapan maintainer**; juga [#176 glob error](https://github.com/vite-pwa/nuxt/issues/176), [#137 aset gagal saat srcDir non-default](https://github.com/vite-pwa/nuxt/issues/137) (relevan karena struktur direktori `app/` Nuxt 4 persis kasus srcDir baru), dan [#229 regresi plugin klien 1.x (`$pwa.showInstallPrompt`)](https://github.com/vite-pwa/nuxt/issues/229).
- Kesimpulan: modul **dipakai komunitas dengan Nuxt 4 dan umumnya jalan**, tetapi "terverifikasi" dalam arti vendor-declared tidak benar. Ini klaim tertulis di dokumen ber-status *final* — harus akurat.

**Fix konkret:**

1. Ubah baris Stack menjadi pola yang sama dengan baris NuxtAuth, mis.: `@vite-pwa/nuxt (PWA installable — AD-12) | 1.1.1 (latest, Feb 2026) — target modul Nuxt 3; Nuxt 4 belum dinyatakan vendor, dipakai komunitas dengan Nuxt 4 — wajib smoke-test build + generateSW + prompt install saat scaffold (AD-12)`.
2. Tambahkan fallback eksplisit: kebutuhan AD-12 cuma *installability* + cache aset statis — kalau smoke-test gagal (mis. kena #212), fallback = web app manifest manual + service worker minimal yang diinjeksi ke `public/` **tanpa modul** (permukaan kecil, murah di-hand-roll).
3. Mitigasi #212 dari hari pertama: jalankan `nuxt build` di CI sejak scaffold pertama (kegagalan generateSW baru muncul saat build, bukan dev).

### T-2 [Sedang] AD-12 perlu guardrail konfigurasi SSR/Nitro — tanpa itu mudah tak sengaja melanggar aturan "data domain selalu daring" sendiri

**Klaim spine (AD-12):** service worker "hanya cache aset statis dan cangkang aplikasi"; data domain tidak pernah dari cache; offline menampilkan status "Tidak dapat terhubung".

**Temuan web:** dokumentasi resmi menunjukkan beberapa fitur yang bisa membocorkan data/domain ke cache bila dinyalakan tanpa sadar ([panduan framework Nuxt vite-pwa](https://vite-pwa-org.netlify.app/frameworks/nuxt)):

- `payloadExtraction` menambahkan `**/_payload.json` ke `globPatterns` workbox — payload SSR berisi data halaman; untuk app ini **jangan** masuk precache.
- `appManifest` (experimental, offline via manifest) menambahkan `builds/**/*.json` ke precache — sama, jangan aktif.
- `registerWebManifestInRouteRules` via Nitro `routeRules` didokumentasikan "untuk Netlify" — tidak diperlukan di Vercel.
- `pwa.client.registerPlugin: false` tersedia bila hanya butuh SW tanpa fitur `$pwa` — relevan karena postur minimal AD-12 (dan menghindari permukaan regresi #229).
- Desain "offline tetap menyajikan status 'Tidak dapat terhubung'" mengimplikasikan **shell precache + `navigateFallback` aktif** agar aplikasi bisa boot lalu mendeteksi kegagalan fetch — ini konsisten dengan AD-12, tetapi harus eksplisit, plus larangan eksplisit `runtimeCaching` untuk `/api/**`.

**Fix konkret:** tambahkan 4–5 butir guardrail di AD-12 (atau baris Platform di Consistency Conventions): (a) strategi `generateSW`; (b) `navigateFallback` = shell saja, SWS tidak boleh punya `runtimeCaching` untuk `/api/**` maupun `_payload.json`; (c) `payloadExtraction` dan `appManifest` (experimental) tidak diaktifkan; (d) `registerWebManifestInRouteRules` tidak dipakai (Vercel); (e) header `Cache-Control: no-cache` untuk `/sw.js` di Vercel (best practice workbox). Semua ini konfigurasi, bukan keputusan arsitektur baru.

### T-3 [Rendah] NuxtAuth sidebase 1.3.1 — klaim spine akurat, tetapi risikonya lebih tinggi dari nada tulisannya; perlu rencana fallback bernama

**Klaim spine:** "1.3.1 — wajib smoke-test OAuth Google + session di Nuxt 4 saat scaffold (modul dibangun di atas Nuxt 3; kompatibilitas 4 belum dinyatakan vendor)".

**Temuan web (Sep 2026):**

- **1.3.1 adalah `latest`** (rilis ± 30 Jun 2026) ([dist-tags](https://registry.npmjs.org/-/package/@sidebase%2Fnuxt-auth/dist-tags), [releases](https://github.com/sidebase/nuxt-auth/releases)) — pin versi akurat.
- "Belum dinyatakan vendor" **masih benar**: [issue #1043 "Add support for Nuxt 4"](https://github.com/sidebase/nuxt-auth/issues/1043) masih **terbuka tanpa tanggapan maintainer, tanpa PR tertaut**, berlabel `breaking-change` + `enhancement`. Penyesuaian docs Des 2025 ([PR #1072](https://github.com/sidebase/nuxt-auth/pull/1072)) hanya mengubah kalimat jadi "lebih abstrak" soal versi Nuxt — bukan deklarasi kompatibilitas. Manifest 1.3.1 memin `@nuxt/kit ^3.20.2` ([manifest](https://registry.npmjs.org/@sidebase/nuxt-auth/1.3.1)); halaman modul tetap berkata "Nuxt 3+" ([nuxt.com/modules/sidebase-auth](https://nuxt.com/modules/sidebase-auth)).
- Sinyal komunitas soal stagnasi维护 dan pencarian alternatif ([thread Reddit](https://www.reddit.com/r/Nuxt/comments/1hzonho/any_alternative_to_sidebasenuxtauth/)); provider `authjs` juga memin `next-auth ~4.21.1` (jalur v4 yang tua).
- Catatan konteks: [Nuxt 3 EOL 31 Jul 2026](https://github.com/nuxt/nuxt/discussions/33918) — modul-modul yang tertinggal di ekosistem Nuxt 3 tidak akan mendapat tekanan kompatibilitas lebih lanjut.

**Fix konkret:** pertahankan smoke-test wajib, tapi tambahkan satu kalimat fallback bernama di baris Stack: bila smoke-test gagal, pakai `nuxt-auth-utils` (OAuth Google manual, ringan, cocok postur SSR + middleware server AD-8) — mencegah scaffold macet tanpa keputusan.

### T-4 [Rendah] Ritme rilis @vite-pwa/nuxt melambat — risiko dapat diterima untuk kebutuhan kecil AD-12, tapi dicatat

**Temuan web:** rilis terakhir modul v1.1.1 ± 6 Feb 2026 (7 bulan lalu, [releases](https://github.com/vite-pwa/nuxt/releases)); mesin di bawahnya `vite-plugin-pwa` lebih aktif (1.3.0 ± Mei 2026; `main` modul memin `^1.2.0`). Untuk kebutuhan AD-12 (manifest + precache aset statis) permukaan API yang dipakai kecil dan stabil; risiko dapat diterima.

**Fix konkret:** tidak ada perubahan dokumen; cukup kesadaran bahwa issue seperti #212 mungkin lambat dapat balasan — fallback T-1 poin 2 sudah menutup risiko ini.

### T-5 [Info — sudah akurat, tanpa perubahan] Hasil verifikasi versi lain

| Klaim spine | Hasil verifikasi (Sep 2026) | Sumber |
| --- | --- | --- |
| Nuxt 4.x (4.5.2 terverifikasi) | **Benar** — `latest` npm = 4.5.2; Nuxt 4 stable sejak 16 Jul 2025; Nuxt 3 EOL 31 Jul 2026 (memperkuat pilihan Nuxt 4) | [dist-tags](https://registry.npmjs.org/-/package/nuxt/dist-tags), [roadmap](https://nuxt.com/docs/4.x/community/roadmap), [diskusi EOL](https://github.com/nuxt/nuxt/discussions/33918) |
| Drizzle ORM 0.45.x stabil, v1.0 sudah rc | **Benar** — `latest` = 0.45.2; tag `beta` = 1.0.0-beta.22, `rc` = 1.0.0-rc.4 (rc.5 di branch preview) — v1.0 **belum GA**; gerbang "pakai v1.0 bila sudah GA" tetap valid | [dist-tags drizzle-orm](https://registry.npmjs.org/-/package/drizzle-orm/dist-tags), [releases](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2), [v0→v1 changes](https://orm.drizzle.team/docs/v0-v1-changes) |
| drizzle-kit 0.31.x | **Benar** — `latest` = 0.31.10 (rc 1.0.0-rc.4) | [dist-tags drizzle-kit](https://registry.npmjs.org/-/package/drizzle-kit/dist-tags) |
| PostgreSQL 17 via Supabase | **Benar/bahkan konservatif-benar** — PG 17 masih major yang ditawarkan (self-hosted default pindah ke PG 17 Jun 2026; PG 14 berakhir 1 Jul 2026; PG 18 belum tersedia); catatan "konfirmasi major saat pembuatan project" tetap praktik yang baik | [changelog Supabase](https://supabase.com/changelog) |
| @react-pdf/renderer 4.9.0 | **Benar** — `latest` = 4.9.0 | [dist-tags](https://registry.npmjs.org/-/package/@react-pdf%2Frenderer/dist-tags) |
| NuxtAuth 1.3.1 (versi) | **Benar** — `latest` = 1.3.1 (status kompatibilitas Nuxt 4 dibahas di T-3) | [dist-tags](https://registry.npmjs.org/-/package/@sidebase%2Fnuxt-auth/dist-tags) |
| @vite-pwa/nuxt 1.1.1 (versi) | **Benar** — `latest` = 1.1.1 (status klaim kompatibilitas dibahas di T-1) | [dist-tags](https://registry.npmjs.org/-/package/@vite-pwa%2Fnuxt/dist-tags) |

### T-6 [Info] Butir yang tidak diverifikasi ulang

- **Resend/SMTP, Vercel + Vercel Cron** — item layanan tanpa pin versi; tidak ada sinyal perubahan perilaku yang dicek ulang (cron UTC + hitung zona Asia/Jakarta di endpoint — AD-9 — tetap pola yang benar).
- **postgres.js (driver)** — sengaja "pin saat scaffold" oleh spine; konsisten.
- **Library chart** — memang *deferred* oleh spine; tidak ada yang perlu diverifikasi.

---

## Rekomendasi ringkas (urut)

1. Perbaiki baris Stack `@vite-pwa/nuxt` (T-1): hapus "(terverifikasi Sep 2026)" untuk klaim kompatibilitas, ganti dengan smoke-test wajib + fallback manual manifest/SW.
2. Tambahkan guardrail konfigurasi PWA ke AD-12/Platform (T-2).
3. Tambahkan kalimat fallback `nuxt-auth-utils` di baris NuxtAuth (T-3).
4. Tidak ada perubahan untuk Drizzle/Nuxt/PG 17/react-pdf — semua klaim terkonfirmasi (T-5).

## Sumber

- npm dist-tags & manifest (dicek langsung 2026-09-15): [@vite-pwa/nuxt](https://registry.npmjs.org/-/package/@vite-pwa%2Fnuxt/dist-tags) · [manifest 1.1.1](https://registry.npmjs.org/@vite-pwa/nuxt/1.1.1) · [nuxt](https://registry.npmjs.org/-/package/nuxt/dist-tags) · [@sidebase/nuxt-auth](https://registry.npmjs.org/-/package/@sidebase%2Fnuxt-auth/dist-tags) · [manifest 1.3.1](https://registry.npmjs.org/@sidebase/nuxt-auth/1.3.1) · [drizzle-orm](https://registry.npmjs.org/-/package/drizzle-orm/dist-tags) · [drizzle-kit](https://registry.npmjs.org/-/package/drizzle-kit/dist-tags) · [@react-pdf/renderer](https://registry.npmjs.org/-/package/@react-pdf%2Frenderer/dist-tags)
- @vite-pwa/nuxt: [repo/README](https://github.com/vite-pwa/nuxt) · [releases](https://github.com/vite-pwa/nuxt/releases) · [issue #212](https://github.com/vite-pwa/nuxt/issues/212) · [issue #176](https://github.com/vite-pwa/nuxt/issues/176) · [issue #137](https://github.com/vite-pwa/nuxt/issues/137) · [issue #229](https://github.com/vite-pwa/nuxt/issues/229) · [dokumentasi vite-pwa Nuxt](https://vite-pwa-org.netlify.app/frameworks/nuxt) · [halaman modul Nuxt](https://nuxt.com/modules/vite-pwa-nuxt) · [npm page](https://www.npmjs.com/package/@vite-pwa/nuxt)
- Nuxt: [roadmap 4.x](https://nuxt.com/docs/4.x/community/roadmap) · [diskusi EOL Nuxt 3](https://github.com/nuxt/nuxt/discussions/33918)
- sidebase/nuxt-auth: [issue #1043](https://github.com/sidebase/nuxt-auth/issues/1043) · [PR #1072](https://github.com/sidebase/nuxt-auth/pull/1072) · [releases](https://github.com/sidebase/nuxt-auth/releases) · [halaman modul Nuxt](https://nuxt.com/modules/sidebase-auth) · [thread Reddit alternatif](https://www.reddit.com/r/Nuxt/comments/1hzonho/any_alternative_to_sidebasenuxtauth/)
- Drizzle: [rilis v1 beta](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2) · [v0→v1 changes](https://orm.drizzle.team/docs/v0-v1-changes)
- Supabase: [changelog](https://supabase.com/changelog)
