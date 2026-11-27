# UAT modul (konsep saat ini)

Kembali ke [catatan penyesuaian](../../README.md). Checklist uji terima (UAT)
per modul, dipisah menurut programmer yang mengerjakannya. Semua checklist
memakai format yang sama: setiap langkah berisi menu, isian, tombol, hasil
yang harus terlihat, uji salah, lalu `[ ] Sesuai` dan tabel kecil
ketidaksesuaian di bawahnya.

| Folder | Programmer | Modul | Langkah |
|---|---|---|---|
| [`modul-dafrin/`](modul-dafrin/README.md) | Programmer B (Dafrin) | M05 Inventaris & Pembelian, M02 CRM & Penjualan, M07 Proyek & Purna Jual, M03 Langganan & Lisensi, M08 Karyawan & Kehadiran (menu: Sumber Daya Manusia), M04 Integrasi | 241 |
| [`modul-oki/`](modul-oki/README.md) | Programmer kedua (Oki) | M01 Dasbor, M06 Aset & Peralatan, M09 Keuangan, M10 Pajak, M11 Bonus & Investor, M12 Laporan & Hak Akses, portal karyawan | 347 |

## Bacaan pendukung

- [diagram-alur-per-role.md](diagram-alur-per-role.md): diagram alur dan
  status per modul programmer B, dengan aktor = role dan orang yang
  memegangnya.
- [catatan-skema-dan-alur.md](catatan-skema-dan-alur.md): catatan lama
  tentang letak skema dan hal yang membingungkan (S1–S6, A1–A11). Versi
  lengkap per schema ada di [`../skema-database/`](../../3-rancangan/skema-database/README.md).

## Urutan menguji

1. **Modul programmer B:** M05 → M02 → (M07, M03, M04). M08 bisa kapan
   saja. Datanya saling menyambung, jadi angka di "Harus terlihat" hanya
   cocok bila urutannya diikuti.
2. **Modul Oki:** M12 → M01 → M09 → M10 → M06 → M11 → portal karyawan.
   Keuangan memakai data penjualan dan pembelian, jadi jalankan setelah M02
   dan M05 bila ingin angkanya cocok.

## Persiapan

- Jalankan `bun run dev` dari root repo (admin http://localhost:5173, portal
  pelanggan :4322, portal karyawan :5174, Mailpit :8025).
- Docker: `ims-erp-postgres-1` (image `postgis/postgis:18-3.6`),
  `ims-erp-redis-1`, `ims-erp-mailpit-1`, `ims-erp-s3-1` (RustFS, untuk foto
  dan lampiran).
- Akun uji: `<role>_seed` dengan password `<role>123456` (khusus dev). Pemilik
  memakai akun `admin`; password-nya di `apps/backend/.env`.
- Sebelum bagian PO (M05 D3), atur format **Kode pemasok** di Administrasi →
  Nomor Kode supaya nomor PO tidak melebihi 32 karakter.

## Test otomatis

Sebagian langkah M05 juga dijalankan otomatis dengan Playwright
(`apps/web-admin/e2e`, perintah `bun run test:e2e` dari `apps/web-admin`).
Komentar di file test masih menyebut jalur lama
`docs/adjustment/uat-modul/m05-inventaris-pembelian.md`. Jalur itu sekarang
ada di `modul-dafrin/`, dan komentarnya dibetulkan saat ada perubahan kode
berikutnya.
