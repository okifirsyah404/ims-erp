# UAT modul programmer B (Dafrin)

Kembali ke [UAT modul](../README.md).

Checklist uji terima untuk modul yang dikerjakan programmer B, sesuai
pembagian modul (bukan kolom A/B di perjanjian):

| Urutan | Modul | File | Tugas perjanjian |
|---|---|---|---|
| 1 | M05 Inventaris & Pembelian | [m05-inventaris-pembelian.md](m05-inventaris-pembelian.md) | T07 |
| 2 | M02 CRM & Penjualan | [m02-crm-penjualan.md](m02-crm-penjualan.md) | T05 |
| 3 | M07 Proyek & Purna Jual | [m07-proyek-purna-jual.md](m07-proyek-purna-jual.md) | T08 |
| 4 | M03 Langganan & Lisensi | [m03-langganan-lisensi.md](m03-langganan-lisensi.md) | T09 |
| 5 | M08 Karyawan & Kehadiran (menu: Sumber Daya Manusia) | [m08-karyawan-kehadiran.md](m08-karyawan-kehadiran.md) | T10 |
| 6 | M04 Integrasi | [m04-integrasi.md](m04-integrasi.md) | sebagian T14, T15 |

Bacaan pendukung:
- [diagram-alur-per-role.md](../diagram-alur-per-role.md): diagram alur dan
  status per modul, dengan aktor = role yang berlaku sekarang.
- [catatan-skema-dan-alur.md](../catatan-skema-dan-alur.md): letak skema,
  peta tabel, dan daftar hal yang membingungkan.

**Urutan ini penting.** M02 butuh barang dan stok dari M05. M07 butuh Sales
Order dari M02. M03 butuh pelanggan dan Sales Order.

Wilayah programmer kedua (login, role, dashboard, aset, keuangan, pajak,
investor) diuji di folder terpisah **[`modul-oki/`](../modul-oki/README.md)**.
Temuan di wilayah itu dicatat sebagai pertanyaan untuk Oki, tidak diperbaiki
sendiri.

Langkah dan tombol di checklist diambil dari kode pada 2026-11-24. Status:
**draf, belum ada yang diuji**.

---

## Persiapan

**Layanan** (`bun run dev` dari root repo):

| Layanan | Alamat |
|---|---|
| Admin ERP | http://localhost:5173 |
| Portal pelanggan | http://localhost:4322 |
| Mailpit (email dev) | http://localhost:8025 |

Database, Redis, Mailpit, dan penyimpanan file jalan di Docker:
`ims-erp-postgres-1` (image `postgis/postgis:18-3.6`, wajib sejak main memakai PostGIS), `ims-erp-redis-1`, `ims-erp-mailpit-1`, dan
`ims-erp-s3-1` (RustFS, port 9000, untuk foto dan lampiran). Tanpa
`ims-erp-s3-1`, unggah foto gagal dengan pesan "an unexpected error has occurred".

**Akun uji.** Username `<role>_seed`, password `<role>123456` (khusus dev).
Pemilik memakai akun `admin`; password-nya ada di `apps/backend/.env`
(`INITIAL_ADMIN_PASSWORD`). Akun `admin` juga **admin aplikasi**, satu-satunya
yang bisa membuka halaman Barang/Produk dan Gudang.

| Akun | Dipakai untuk |
|---|---|
| `admin` (Pemilik) | Barang, gudang, membatalkan PO, menyetujui gaji |
| `purchasing_seed` | Pemasok, permintaan pembelian, PO, retur pembelian |
| `operations_manager_seed` | Menyetujui PR, PO, retur pembelian, penyesuaian stok |
| `warehouse_seed` | Terima barang, surat jalan, terima retur penjualan |
| `sales_seed` | Lead, pelanggan, SPH, sales order, kontrak lisensi |
| `sales_manager_seed` | Menyetujui SPH dan retur penjualan, akun portal, lisensi penuh |
| `finance_seed` | Invoice dan pembayaran |
| `project_manager_seed` | Proyek, BAST, garansi, tiket |
| `technician_seed` | Mengerjakan tiket yang ditugaskan |
| `customer_service_seed` | Tiket, akun portal, balas WhatsApp |
| `marketing_seed` | Katalog website, FAQ WhatsApp |
| `hr_seed` | Karyawan, absensi, cuti, lembur, gaji |

**Aturan pakai:**
- **Satu akun per jendela browser** (Chrome biasa, Incognito, browser lain),
  atau logout dulu sebelum ganti akun.
- **Pembuat dokumen tidak bisa menyetujui dokumennya sendiri.** Ini berlaku
  untuk SPH, PO, PR, retur, cuti, dan lembur.
- Setiap langkah: centang **Sesuai** hanya bila semua hasilnya cocok. Bila
  ada yang tidak cocok, isi tabel kecil tepat di bawah langkah itu. Catat dulu, perbaiki kemudian.
- Tanda di nomor langkah:
  - **⚠️** temuan dari pembacaan kode yang **diperkirakan gagal atau
    membingungkan**. UAT memastikan, lalu Pemilik memutuskan: perbaiki atau
    terima.
  - **🔧** temuan yang **sudah diperbaiki** (2026-11-24). Hasil yang
    diharapkan sudah perilaku baru; UAT memastikan perbaikannya.
  - **❓** perilaku yang disengaja di kode tapi perlu keputusan.

---

## Rekap hasil

| Modul | Sesuai | Tidak sesuai | Kesimpulan | Penguji | Tanggal |
|---|---|---|---|---|---|
| M05 | | | | | |
| M02 | | | | | |
| M07 | | | | | |
| M03 | | | | | |
| M08 | | | | | |
| M04 | | | | | |

## Temuan yang sudah diketahui sebelum UAT

| No | Modul / langkah | Temuan | Status |
|---|---|---|---|
| 1 | M05 D3–D4 | PO yang disetujui tidak muncul di Penerimaan Barang sebelum ditandai terkirim; petunjuk ditambahkan | diperbaiki 2026-11-24, belum diuji |
| 2 | Semua | Ganti akun tanpa reload menampilkan tombol akun lain | diperbaiki 2026-11-24, belum diuji |
| 3 | M05 D6, F6, F7, F9; M02 E1; M03 B1, C5; M04 A4, B10 | Label, tombol tanpa cek hak, ID mentah, menu tidak cocok dengan hak server | diperbaiki 2026-11-24, belum diuji |
| 4 | M05 F4 | Penyesuaian stok boleh disetujui pembuatnya bila punya hak setuju (disengaja di kode, bertentangan dengan ADR-0006) | perlu keputusan (A1 di `../../bahan-keputusan.md`) |
| 5 | M05 F1 | Form penyesuaian stok: kolom Penyimpanan teks bebas padahal server minta kode internal; barang di rak terbaca Sistem 0; daftar Barang hanya 20 pertama; nomor tidak ditampilkan setelah dibuat | diperbaiki 2026-11-25, belum diuji |

Ketidaksesuaian baru dari UAT ditulis di tabel kecil di bawah langkah yang
bersangkutan, di file modulnya.
