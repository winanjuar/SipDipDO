---
name: Sip & Dip Ownership Dashboard
description: Dashboard kepemilikan internal cafe Sip & Dip (Phase 1 — pembelian saham); web responsif mobile-browser-first di atas shadcn/ui + Tailwind. DESIGN.md ini hanya menulis lapisan delta brand di atas default shadcn.
status: final
sources:
  - "{planning_artifacts}/prds/prd-snd-dash-2026-08-14/prd.md"
updated: 2026-09-15
colors:
  # Semua token shadcn lain (background, foreground, secondary, muted,
  # muted-foreground, accent, popover, card, card-foreground, border, input, ring,
  # destructive, destructive-foreground) diwarisi apa adanya — LIGHT-ONLY, tanpa
  # pasangan dark. Ditolak memakai shadcn `destructive`; Kedaluwarsa memakai `muted`.
  # Primary dioverride ke navy brand Sip & Dip (diekstrak dari logo, kontras vs putih 11,4:1).
  primary: '#2D3959'
  primary-foreground: '#FFFFFF'
  # [ASSUMPTION] hue success/warn netral-gelap, kontras teks putih ~5.0:1 (AA).
  success: '#15803D'
  success-foreground: '#FFFFFF'
  warn: '#B45309'
  warn-foreground: '#FFFFFF'
  # Palet kategoris chart — identitas warna owner konsisten antar chart.
  # [ASSUMPTION] 10 hue bersebelahan tetap terbedakan, seluruhnya >=3:1 di latar terang; belum ada arah brand dari user.
  chart-1: '#2563EB'
  chart-2: '#EA580C'
  chart-3: '#0D9488'
  chart-4: '#7C3AED'
  chart-5: '#65A30D'
  chart-6: '#DB2777'
  chart-7: '#0E7490'
  chart-8: '#475569'
  chart-9: '#9333EA'
  chart-10: '#A16207'
  # Cincin dalam donut "Distribusi Pemodalan" — monokrom, terpisah dari palet owner.
  # [ASSUMPTION] monokrom agar jenis modal tidak tertukar dengan identitas warna owner.
  # Ketiga langkah >=3:1 di latar terang (slate-800/600/500).
  modal-tetap: '#1E293B'
  modal-bergerak: '#475569'
  modal-operasional: '#64748B'
  # Stacked bar "Big Cap" — Ceil = wadah (terang), Shares = isi (chart-1).
  chart-bigcap-ceil: '#93C5FD'
# Semua role tipografi mewarisi font default shadcn (sans) — tanpa display font, tanpa swap font.
# [ASSUMPTION] tidak ada arah tipografi brand dari user; netral sans teraman untuk alat keuangan internal.
typography:
  data-numeric:
    note: 'Font default shadcn (sans); font-variant-numeric: tabular-nums wajib untuk seluruh angka metrik, harga, dan rupiah'
  data-calculation:
    note: 'Tailwind font-mono (stack default) untuk formula & rincian hitungan — Panel Pratinjau Perhitungan dan Alert Penolakan Terhitung'
# Radius mewarisi shadcn --radius beserta seluruh turunannya; tanpa delta brand.
rounded: {}
# Skala spacing mewarisi Tailwind (4-based); tanpa delta brand.
spacing: {}
components:
  brand-logo:
    base: 'imports/logo.png — emblem monokrom ink navy {colors.primary}, latar transparan (varian JPG untuk media latar putih)'
    usage: 'ink navy asli — tidak di-recolor, tidak distretch, hanya di atas latar putih/near-white; tinggi 32px (header/sidebar app), 80px (Login & Pendaftaran Owner, terpusat)'
    tagline: '"Sip the taste, dip the soul" — italic, shadcn muted-foreground, di bawah lockup logo+nama pada halaman publik (Login & Pendaftaran Owner) dan materi email; tidak tampil di header/sidebar app (postur alat kerja)'
  status-badge:
    note: 'shadcn Badge; hanya pemetaan varian status'
    menunggu-konfirmasi:
      background: '{colors.warn}'
      foreground: '{colors.warn-foreground}'
    terkonfirmasi:
      background: '{colors.success}'
      foreground: '{colors.success-foreground}'
    ditolak: 'shadcn destructive — tanpa override'
    kedaluwarsa: 'shadcn muted + muted-foreground — tanpa override'
  tabel-kepemilikan:
    base: 'shadcn Table di dalam Card; teks sm; kolom angka rata kanan tabular-nums'
    baris-owner-sendiri: 'latar shadcn muted + penanda "Anda"'
    baris-grand-total: 'border-top 2px shadcn border; font medium'
    kolom-sticky: 'kolom Owner menempel di kiri saat scroll horizontal (mobile)'
  tabel-rkap:
    base: 'shadcn Table di dalam Card; kolom verbatim per FR-23'
    agregat-jenis-modal: 'baris ringkas shadcn muted-foreground di bawah tiap kelompok jenis modal'
    ringkasan-batas: 'Card terpisah; angka tabular-nums'
  chart-portion-kepemilikan:
    base: 'Pie; label shadcn foreground di luar wedge; pemisah wedge 1px shadcn background'
    palette: '{colors.chart-1} … {colors.chart-10}, diperluas via langkah lightness'
  chart-distribusi-pemodalan:
    base: 'Donut dua cincin; cincin dalam 3 segmen jenis modal, cincin luar per owner'
    cincin-dalam: '{colors.modal-tetap}, {colors.modal-bergerak}, {colors.modal-operasional}'
    cincin-luar: '{colors.chart-1} … {colors.chart-10} — identitas warna owner sama dengan pie Portion Kepemilikan'
  chart-big-cap:
    base: 'Stacked bar per kelompok kap; pemisah segmen 1px shadcn background'
    series-shares: '{colors.chart-1}'
    series-ceil: '{colors.chart-bigcap-ceil}'
  panel-pratinjau-hitungan:
    base: 'shadcn Card di dalam form Pesanan Pembelian'
    hitungan: 'font-mono ({typography.data-calculation.note}); angka tabular-nums'
    nilai-melewati-batas: 'shadcn destructive-foreground untuk angka Strength > 100%'
  alert-penolakan-terhitung:
    base: 'shadcn Alert varian destructive'
    hitungan: 'blok rincian hitungan font-mono ({typography.data-calculation.note})'
  dialog-mfa-otp:
    base: 'shadcn Dialog + Input OTP (input-otp)'
    kode: '6 digit'
  baris-antrian-beli:
    base: 'shadcn Card list-row; nama owner + {components.status-badge}'
    umur-pesanan: 'caption shadcn muted-foreground ("hari ke-N dari 7")'
---

## Brand & Style

Sip & Dip Ownership Dashboard adalah alat kerja internal untuk hal yang sensitif: uang dan kepercayaan antar 22–40 owner. Postur visualnya adalah **"buku besar yang bisa dipercaya"** — netral, tenang, padat data, tanpa dekorasi. Identitas produk ini adalah kejelasan angka: kolom rata kanan yang rapi, hitungan yang bisa diperiksa sendiri, status yang disebut apa adanya. Produk menggantikan Google Sheets yang familiar; desain menghormati kebiasaan membaca tabel dan chart para owner tanpa meniru estetika spreadsheet, dan tanpa mengadopsi tema cafe whimsical — ini alat keuangan, bukan materi pemasaran. Tagline cafe — *"Sip the taste, dip the soul"* — membawa nuansa brand hanya di halaman publik (Login, Pendaftaran Owner) dan materi email; di dalam aplikasi postur tetap alat kerja.

Seluruh sistem visual mewarisi shadcn/ui + Tailwind apa adanya (light-only). DESIGN.md ini hanya menulis delta lapisan brand: **identitas navy Sip & Dip** (logo `imports/logo.png` — emblem monokrom `#2D3959` di atas putih; dua-warna, tanpa palet sekunder), warna semantik status Pesanan Pembelian, palet kategoris chart, dan disiplin tipografi angka. Brand dua-warna ini justru memperkuat postur "buku besar yang bisa dipercaya" — navy sebagai satu-satunya warna identitas, selebihnya netral; tanpa mengadopsi tema cafe whimsical.

## Colors

- **Primary dioverride: navy brand `{colors.primary}` (`#2D3959` / foreground putih).** Diekstrak dari logo (ink dominan 99,6% piksel). Tombol utama, link aktif, dan identitas aksi memakai navy; kontras vs putih ≈11,4:1 (AAA teks normal). Bukan aksen dekoratif — satu-satunya warna identitas.
- **Warisan shadcn (tanpa override).** `background`, `foreground`, `secondary`, `muted`, `muted-foreground`, `accent`, `popover`, `card`, `border`, `input`, `ring`, `destructive`. `destructive` dipakai untuk status **Ditolak**; `muted` untuk status **Kedaluwarsa**.
- **Success (`#15803D` / foreground putih) — Terkonfirmasi.** Hanya untuk status badge dan umpan balik transaksi efektif. Kontras teks ≈5.0:1 (AA teks normal). `[ASSUMPTION]` hue.
- **Warn (`#B45309` / foreground putih) — Menunggu Konfirmasi (juga Diajukan).** Hanya untuk status menunggu. Kontras teks ≈5.0:1. Bukan aksen dekoratif. `[ASSUMPTION]` hue.
- **Palet chart kategoris `chart-1` … `chart-10`** — dipakai pie "Portion Kepemilikan" dan cincin luar donut "Distribusi Pemodalan". Aturan: (1) identitas warna owner **konsisten antar chart** — owner yang sama selalu mendapat warna yang sama; (2) assignment deterministik mengikuti urutan owner pada tabel; (3) di atas 10 owner, keluarga diperluas dengan **langkah lightness tetap** dari hue yang sama (cukup hingga 40+ owner), bukan hue baru; (4) seluruh wedge ≥3:1 di atas latar terang, dan makna tidak pernah disandikan warna semata — label/legenda/tooltip selalu tersedia. `[ASSUMPTION]` hue.
- **Cincin dalam donut (jenis modal): monokrom slate.** `{colors.modal-tetap}`, `{colors.modal-bergerak}`, `{colors.modal-operasional}` — terpisah dari palet owner agar "jenis modal" (struktur) tidak tertukar dengan "owner" (identitas). Ketiga langkah ≥3:1 di latar terang; legenda + urutan tetap tetap wajib (WCAG 1.4.1 — warna bukan satu-satunya pembawa informasi). `[ASSUMPTION]` monokrom.
- **"Big Cap": dua seri satu keluarga hue.** Shares = `{colors.chart-1}` (isi, gelap), Ceil = `{colors.chart-bigcap-ceil}` (wadah, terang) — hubungan subset terbaca dari satu keluarga; nilai dibawa juga oleh label sumbu.
- **Larangan:** gradien, fill merah penuh untuk hal non-penolakan, pasangan warna dark (produk light-only), warna dekoratif bertema cafe (kopi, krem hangat, ilustrasi) — netral adalah postur kepercayaan.

## Typography

- Semua role mewarisi **font default shadcn (sans)** — tanpa display font, tanpa swap font, tanpa momen serif. `[ASSUMPTION]` tidak ada arah tipografi brand dari user.
- **{typography.data-numeric.note}** — tabular-nums wajib untuk setiap angka di tabel, pratinjau hitungan, harga, rupiah, dan persentase. Angka yang goyah saat scroll merusak kepercayaan.
- **{typography.data-calculation.note}** — hitungan (formula, rincian penolakan, proyeksi) tampil dalam font-mono: sinyal visual "ini dihitung mesin, bisa diperiksa".
- Hierarki lewat ukuran & ketebalan bawaan shadcn; tidak menambah label all-caps baru; angka penting (Strength, Portion owner sendiri) boleh `font-medium`, tidak lebih.

## Layout & Spacing

- Skala spacing Tailwind (4-based) diwarisi; margin halaman mobile 16px (`px-4`); tanpa token spacing baru.
- **Mobile (dominan):** satu kolom. Tabel dan chart hidup di dalam Card; tabel digulir horizontal dengan kolom pertama menempel (strategi perilaku di EXPERIENCE.md).
- **Desktop (≥lg, alur berat COO):** konten tabel/chart sampai `max-w-7xl`; dashboard menyusun chart berjajar; Antrian Beli, RKAP, dan Distribusi Laba memakai lebar penuh untuk kepadatan kerja.
- Kepadatan tabel: `text-sm`, baris cukup rapat untuk memuat 40 owner; kolom angka rata kanan.

## Elevation & Depth

Diwarisi penuh dari shadcn. Bayangan hanya pada permukaan mengambang bawaan (Dialog, Sheet, Popover, DropdownMenu). Elevation **bukan** alat hierarki — hierarki datang dari layout, tipografi, dan border; Card datar dengan border 1px `shadcn border`.

## Shapes

Radius diwarisi dari shadcn `--radius`; tanpa delta. Status Badge pill (bawaan Badge). Wedge pie/donut dan bar chart tajam — sudut tajam untuk data, bukan dekorasi. Tidak ada bentuk organik/blob dekoratif.

## Components

**Dipakai apa adanya dari shadcn (kontrak: jangan disunting):** `Button`, `Card`, `Dialog`, `Sheet`, `Drawer`, `Table`, `Alert`, `Badge`, `Input`, `Select`, `Label`/`Form`, `Tabs`, `Skeleton`, `Separator`, `Popover`, `Tooltip`, `Input OTP (input-otp)`, `Toast (sonner)`, `DropdownMenu`. *Implementasi: **shadcn-vue (primitif reka-ui)** + Tailwind — implementasi Vue dari kontrak shadcn ini (spine arsitektur AD/Stack); nama komponen, token, dan perilaku kontrak tetap.*

**Komponen ber-delta / custom (spesifikasi visual; perilaku di EXPERIENCE.md):**

Referensi visual (mobile): `mockups/key-pendaftaran-profile.html` (1), `mockups/key-dashboard-kepemilikan.html` (3–7), `mockups/key-pesanan-pembelian.html` (8–9), `mockups/key-antrian-beli-coo.html` (10–11). Varian desktop (≥lg): `mockups/key-pendaftaran-profile-desktop.html`, `mockups/key-dashboard-kepemilikan-desktop.html`, `mockups/key-pesanan-pembelian-desktop.html`. Aset brand: `imports/logo.png` (transparan), `imports/logo.jpg` (latar putih). Spine menang atas mockup bila berkonflik.

1. **Logo Sip & Dip (`brand-logo`)** — emblem monokrom `{colors.primary}` dari `imports/logo.png` (latar transparan); varian `logo.jpg` untuk media latar putih (email). Hanya di atas latar putih/near-white; tidak di-recolor, tidak distretch, tanpa bayangan. Tinggi 32px di header/sidebar app; 80px terpusat di Login & Pendaftaran Owner. Tagline *"Sip the taste, dip the soul"* (italic, `shadcn muted-foreground`) tampil di bawah lockup logo+nama pada halaman publik dan materi email saja.
2. **Status Badge** — shadcn Badge ukuran sm, pill, selalu berteks (warna bukan satu-satunya pembawa makna). Varian: Menunggu Konfirmasi `{colors.warn}`/`{colors.warn-foreground}`; Terkonfirmasi `{colors.success}`/`{colors.success-foreground}`; Ditolak shadcn `destructive`; Kedaluwarsa shadcn `muted`. Dipakai juga untuk status pendaftaran (Diajukan → warn, Terverifikasi → success, Ditolak → destructive).
3. **Tabel Kepemilikan** — shadcn Table dalam Card; kolom verbatim: Quantity, Shares, Portion, Ceil, Strength, Actual, RTL (+ kolom Owner); Grand Total baris terakhir (`baris-grand-total`); baris owner sendiri disorot (`baris-owner-sendiri`); semua angka rata kanan tabular-nums; Portion 2 desimal.
4. **Tabel RKAP** — shadcn Table dalam Card; kolom verbatim per FR-23 (nama, jenis modal, Initial Requirement, Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held); baris agregat per jenis modal; Card ringkasan terpisah untuk batas penyesuaian (1% + 1 saham) dan Quantity Left.
5. **Chart Pie "Portion Kepemilikan"** — pie dengan label nama owner + persentase di luar wedge (`shadcn foreground`); wedge dipisah garis 1px `shadcn background`; palet `{colors.chart-1} … {colors.chart-10}` + langkah lightness.
6. **Chart Donut "Distribusi Pemodalan"** — dua cincin; cincin dalam 3 segmen monokrom (`{colors.modal-tetap}`, `{colors.modal-bergerak}`, `{colors.modal-operasional}`); cincin luar per owner dengan identitas warna sama seperti pie; legenda jenis modal selalu tampil.
7. **Chart Stacked Bar "Big Cap"** — bar bertumpuk per kelompok kap (Big Cap > 5%, `[Medium Cap]` > 2%, `[Small Cap]` ≤ 2%); Shares `{colors.chart-1}`, Ceil `{colors.chart-bigcap-ceil}`; pemisah segmen 1px `shadcn background`.
8. **Panel Pratinjau Perhitungan** — shadcn Card di dalam form; menampilkan Harga Terkunci + proyeksi Ceil, Shares, Strength, RTL; blok hitungan font-mono tabular-nums; angka yang melanggar batas (Strength > 100%) memakai `shadcn destructive-foreground`.
9. **Alert Penolakan Terhitung** — shadcn Alert varian destructive; isi wajib: alasan + rincian hitungan (font-mono) + langkah lanjut; tidak pernah generik.
10. **Dialog MFA OTP** — shadcn Dialog + Input OTP; kode 6 digit; state salah/kedaluwarsa memakai teks `shadcn destructive-foreground` (tanpa fill merah penuh).
11. **Baris Antrian Beli** — shadcn Card list-row; nama owner + Status Badge; caption umur pesanan `shadcn muted-foreground`; ringkasan hitungan pesanan (jenis modal, Quantity, Harga Terkunci) tabular-nums.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Warisi shadcn untuk semua yang tidak ada di lapisan brand | Meng-override token shadcn di luar `colors` delta di atas |
| tabular-nums untuk setiap angka | Font proporsional pada kolom angka |
| Status lewat token semantik (success/warn/destructive/muted) + teks | Warna sebagai satu-satunya pembawa status |
| Identitas warna owner konsisten antar chart | Palet acak per render / warna owner berubah-ubah |
| Light-only; kontras teks ≥4.5:1, grafis ≥3:1 + redundansi teks | Pasangan warna dark, gradien, tema cafe dekoratif |
| Hitungan tampil font-mono, lengkap dan bisa diperiksa | Pesan error generik tanpa angka |
| Portion total ditampilkan apa adanya (99,99% / 100,01%) | Memaksa "100%" agar terlihat rapi |
| Angka & tabel netral-tenang | Merah untuk hal non-penolakan; badge tanpa teks |
| Logo navy asli di atas latar putih (`{components.brand-logo.usage}`) | Recolor, stretch, bayangan pada logo, atau menaruhnya di latar ramai |
