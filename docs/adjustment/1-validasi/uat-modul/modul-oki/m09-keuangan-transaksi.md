# UAT M09 - Keuangan: Transaksi (programmer kedua: Oki)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** hak akses menu → daftar akun, pusat biaya, aturan posting → akun kas/bank dan transaksinya (setoran, beban, setor pajak, settlement gateway) → piutang dari faktur dan kuitansi (nota kredit, penghapusan) → utang dari tagihan pemasok (manual dan dari PO) → anggaran proyek → klaim biaya, uang muka karyawan, pertanggungjawaban → aset tetap dan penyusutan → jurnal manual, pembalik, saldo awal → rekonsiliasi bank dari rekening koran CSV → tutup, kunci, buka kembali periode.

Versi lengkap per form, disusun 2026-11-26 dari form aslinya di kode (`apps/web-admin/src/components/finance/*`, `routes/_authed/finance/*`, `routes/_authed/sales/invoices/$invoiceId`), kontrak backend (`apps/backend/src/app/finance/contracts`, `apps/backend/src/app/payment/contracts`), hak akses (`packages/common/src/authorization/erp-permissions.ts`, `docs/role-permission.md`), rencana `docs/plan/erp-module-plans/m09-finance.md` dan ADR-0030. Belum diuji di aplikasi. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, file impor, dan baris tambahan. Setiap langkah berisi:

- **Menu**: menu yang dibuka, dengan label persis seperti di sidebar.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar (pesan, status, jurnal yang terbentuk).
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun uji** (password dev `<role>123456`; password `admin` ada di `apps/backend/.env`, `INITIAL_ADMIN_PASSWORD`, jangan ditulis di sini):

| Akun | Orang di tim | Dipakai untuk |
|---|---|---|
| `admin` (Pemilik) | Aqim | Menyetujui jurnal, aset tetap, anggaran, uang muka, buka kembali periode |
| `finance_seed` (Keuangan) | Aqim | Kas & bank, faktur, kuitansi, tagihan pemasok, klaim, pembayaran, rekonsiliasi |
| `accountant_seed` (Akuntan) | Bella | Daftar akun, pusat biaya, aturan posting, jurnal, menyetujui klaim dan penghapusan piutang, tutup periode |
| `auditor_seed` (Auditor) | (belum ada orangnya) | Cek akses baca |
| `operations_manager_seed` | Aqim | Menyetujui uang muka, memverifikasi pertanggungjawaban |
| `technician_seed` | Fahri, Alex, Ade | Mengajukan uang muka dan pertanggungjawaban |
| `sales_seed` | Bilal | Cek bahwa menu Keuangan tidak tampil |

**Status dokumen:**

| Dokumen | Status |
|---|---|
| Jurnal manual | Draf → Menunggu persetujuan → Diposting (atau kembali ke Draf / Dibuang); Diposting → Dibalik |
| Faktur | Draf → Terbit → Dibayar sebagian → Lunas (atau Void / Dihapuskan) |
| Nota kredit | Draf → Diterapkan (atau Batal) |
| Tagihan pemasok | Draf → Disetujui (setelah Rekam) → Sebagian dibayar → Lunas; Terlambat; Batal |
| Pembayaran | Draf → Diajukan → Disetujui → Tereksekusi (atau Batal) |
| Klaim biaya | Draf → Diajukan → Disetujui (atau Ditolak / Dibatalkan) → Lunas |
| Uang muka karyawan | Draf → Diajukan → Disetujui → Dicairkan → Selesai (atau Dibatalkan) |
| Pertanggungjawaban | Draf → Diajukan → Diverifikasi → Disetujui → Dibayar (atau Ditolak / Dibatalkan) |
| Anggaran proyek | draf → aktif → digantikan |
| Rekonsiliasi | Draf → Berlangsung → Terekonsiliasi → Ditutup |
| Periode akuntansi | Terbuka → Ditutup → Terkunci → (Buka kembali) Terbuka |

**Data contoh yang dibuat selama UAT** (semua nominal rupiah bulat; ketik tanpa titik, layar menampilkan dengan titik):

| Data | Nilai |
|---|---|
| Akun baru (aset) | `1-1140` Kas di Bank UAT, Aset, Debit, induk `1-1100`, Operasional, bisa diposting |
| Akun baru (beban) | `6-2450` Beban Rapat UAT, Beban, Debit, induk `6-2000`, Operasional, bisa diposting |
| Akun header | `6-9000` Beban Header UAT, Beban, tidak bisa diposting (untuk diarsipkan) |
| Pusat biaya | `CC-UAT` Pusat Biaya UAT; `CC-UAT2` Pusat Biaya UAT 2 (dinonaktifkan) |
| Akun kas/bank | `BANK-UAT` Bank UAT, Akun GL `1-1140`, Bank UAT Indonesia, rek. `5550001111` a.n. PT Entragate; `KAS-UAT` tanpa akun GL (uji salah) |
| Pelanggan dan SO | Budi Hartono UAT (M02); **SO kedua khusus keuangan** dibuat dengan alur M02 bagian B–C: barang jasa (tanpa surat jalan), PPN 11%, total minimal Rp 12.210.000 |
| Faktur 1 | dari SO itu, Nominal tetap Rp 11.100.000 = DPP 10.000.000 + PPN 1.100.000; terbit 06/11/2026, jatuh tempo 20/11/2026 |
| Faktur 2 | dari SO yang sama, Nominal tetap Rp 1.110.000 = DPP 1.000.000 + PPN 110.000; terbit 08/11/2026 |
| Pemasok dan PO | PT Sumber Kabel UAT; PO dari M05 D1 (Kamera IP UAT 2 × Rp 1.800.000, PPN ditambahkan 11%, sudah diterima di M05 D7) |
| Karyawan | karyawan milik `finance_seed` (dibuat seeder HR); teknisi tidak punya data karyawan |
| Proyek | **Proyek M07** (dari SO M02 C1, status aktif, dibuat di UAT M07) |
| Barang aset | **Laptop UAT**: daftarkan dulu di **Inventaris → Aset & Peralatan → Register Aset** (form seperti M06 B1): tipe Perangkat TI, biaya perolehan Rp 12.000.000, tanggal 18/11/2026, garis lurus, umur 48 bulan, nilai sisa 0, belum pernah disusutkan |
| Periode uji tutup | Oktober 2026 (dibuka kembali di akhir) |
| File rekening koran | `koran-uat.csv` dan `koran-salah.csv` (isinya di langkah J3) |

**Jurnal yang harus terbentuk** (dipakai lagi di [m09-keuangan-laporan.md](m09-keuangan-laporan.md)). Akun bawaan dari aturan posting seeder; bila aturan diubah, akunnya ikut berubah.

| No | Langkah | Tanggal | Debit | Kredit | Nilai (Rp) |
|---|---|---|---|---|---|
| J1 | C3 | 02/11 | 1-1140 Kas di Bank UAT | 3-1000 Modal Disetor | 50.000.000 |
| J2 | C4 | 03/11 | 6-2100 Beban Sewa | 1-1140 | 1.500.000 |
| J3 | C4 | 04/11 | 1-1140 | 7-1000 Pendapatan Bunga Bank | 250.000 |
| J4 | I3 | 05/11 | 6-2300 Beban Perlengkapan Kantor (pusat biaya CC-UAT) | 2-1800 Biaya Masih Harus Dibayar | 750.000 |
| J5 | I4 | 05/11 | 6-2900 Beban Umum Lainnya, lalu pembaliknya 2-1800 | 2-1800, lalu pembaliknya 6-2900 | 100.000 + 100.000 |
| J6 | D1 | 06/11 | 1-1310 Piutang Usaha 11.100.000 | 4-1100 Penjualan Perangkat 10.000.000; 2-1410 PPN Keluaran 1.100.000 | 11.100.000 |
| J7 | D2 | 09/11 | 1-1120 Kas di Bank BCA, lalu pembaliknya 1-1310 | 1-1310, lalu pembaliknya 1-1120 | 1.000.000 + 1.000.000 |
| J8 | D3 | 10/11 | 1-1120 | 1-1310 | 6.000.000 |
| J9 | D4 | 08/11 | 1-1310 1.110.000 | 4-1100 1.000.000; 2-1410 110.000 | 1.110.000 |
| J10 | D4 | 09/11 | 4-1900 Retur dan Potongan Penjualan 100.000; 2-1410 11.000 | 1-1310 111.000 | 111.000 |
| J11 | D6 | hari persetujuan | 1-1390 Cadangan Kerugian Piutang | 1-1310 | 999.000 |
| J12 | E1 | 07/11 | 6-2900 2.000.000; 1-1810 PPN Masukan 220.000 | 2-1100 Utang Usaha 2.220.000 | 2.220.000 |
| J13 | E2 | 19/11 | 2-1150 GR/IR 3.600.000; 1-1810 396.000 | 2-1100 3.996.000 | 3.996.000 |
| J14 | G3 | 11/11 | 6-2400 Beban Transportasi 300.000; 6-2450 Beban Rapat UAT 200.000 (proyek Proyek M07) | 2-1200 Utang Klaim Biaya 500.000 | 500.000 |
| J15 | G4 | 12/11 | 2-1200 | 1-1140 | 500.000 |
| J16 | G8 | 13/11 | 1-1340 Uang Muka Karyawan | 1-1140 | 1.000.000 |
| J17 | G10 | 14/11 | 6-2400 | 1-1340 | 800.000 |
| J18 | G11 | 15/11 | 1-1140 | 1-1340 | 200.000 |
| J19 | C7 | 16/11 | 1-1140 995.000; 6-3200 Beban Biaya Payment Gateway 5.000 | 1-1250 Kliring Payment Gateway 1.000.000 | 1.000.000 |
| J20 | C5 | 17/11 | 2-1420 Utang PPh 21 | 1-1140 | 150.000 |
| J21 | H1 | 18/11 | 1-2130 Peralatan Kantor dan Komputer | 3-1000 | 12.000.000 |
| J22 | H3 | 30/11 | 6-2500 Beban Penyusutan | 1-2230 Akumulasi Penyusutan Peralatan Kantor | 250.000 |
| J23 | J5 | 30/11 | 8-1000 Beban Administrasi Bank | 1-1140 | 15.000 |
| J24 | K3, K5 | 31/10 dan 01/11 | 6-2900 (31/10), lalu pembaliknya 2-1800 (01/11) | 2-1800 (31/10), lalu pembaliknya 6-2900 (01/11) | 50.000 + 50.000 |

**Saldo yang harus terlihat setelah semua langkah:** Saldo saat ini `BANK-UAT` = **Rp 48.280.000** (50.000.000 − 1.500.000 + 250.000 − 500.000 − 1.000.000 + 200.000 + 995.000 − 150.000 − 15.000). Total mutasi debit = total mutasi kredit semua jurnal di atas = **Rp 96.751.000**.

Kerjakan langkah **A1 di file laporan** (catat angka awal) **sebelum** langkah C3 file ini. Jalankan file ini di bulan November 2026; bila dikerjakan sesudahnya, ganti semua tanggal 11/2026 dengan bulan berjalan.

***

## A. Hak akses menu

### A1. Menu untuk Keuangan (login `finance_seed`)

Buka sidebar bagian **Keuangan → Keuangan**, lalu **CRM & Penjualan → Penjualan**.

**Harus terlihat:**

| Menu | Tampil? |
|---|---|
| Kas & Bank, Aturan Posting, Pusat Biaya, Anggaran proyek, Rekonsiliasi, Piutang, Utang, Beban, Laporan Keuangan | tampil |
| Saldo Awal, Daftar Akun, Jurnal, Aset tetap, Tutup Periode | **tidak** tampil |
| Penjualan → Faktur, Uang Muka, Kuitansi | tampil |

❓ Keuangan tidak bisa membuka Daftar Akun dan Jurnal, padahal beberapa form Keuangan memakai daftar akun (lihat C1, C3, G1, J5). Buka langsung alamat `/finance/journal` → halaman kosong (bukan error teknis).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Menu untuk Akuntan (login `accountant_seed`)

Buka sidebar bagian **Keuangan → Keuangan**.

**Harus terlihat:**

| Menu | Tampil? |
|---|---|
| Kas & Bank, Saldo Awal, Daftar Akun, Jurnal, Aturan Posting, Pusat Biaya, Rekonsiliasi, Piutang, Utang, Beban, Laporan Keuangan, Tutup Periode | tampil |
| Anggaran proyek, Aset tetap | **tidak** tampil ⚠️ (Akuntan punya hak menyimpan anggaran dan menjalankan penyusutan, tetapi menu dan daftarnya butuh hak baca proyek/aset) |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Menu untuk Auditor (login `auditor_seed`)

Buka sidebar bagian **Keuangan → Keuangan**.

**Harus terlihat:**

| Menu | Tampil? |
|---|---|
| Kas & Bank, Saldo Awal, Daftar Akun, Jurnal, Aturan Posting, Pusat Biaya, Anggaran proyek, Aset tetap, Piutang, Laporan Keuangan | tampil, tanpa tombol buat/ubah |
| Rekonsiliasi, Utang, Beban, Tutup Periode | **tidak** tampil ❓ (auditor tidak bisa memeriksa tagihan pemasok, klaim biaya, dan rekonsiliasi) |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4 ❓. Pemilik dan role tanpa akses

1. Login `admin`: semua 14 menu di **Keuangan → Keuangan** tampil. Klik judul grup **Keuangan** itu sendiri.
2. Login `sales_seed`: bagian **Keuangan** tidak tampil; buka langsung `/finance/cash-bank` → halaman kosong "Kas & Bank" tanpa data.

**Harus terlihat:** langkah 1 membuka halaman "Segera hadir" (halaman induk Keuangan belum dibuat, perlu keputusan apakah diganti ringkasan); langkah 2 tidak menampilkan angka apa pun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## B. Data induk: akun, pusat biaya, aturan posting (login `accountant_seed`)

### B1. Buat akun aset (semua kolom)

Menu **Keuangan → Keuangan → Daftar Akun** → tombol **Akun baru**. Judul halaman tertulis "Bagan Akun" (sama dengan Daftar Akun). Form terbagi 2 bagian: Identitas dan Klasifikasi.

| Isian | Isi dengan |
|---|---|
| Kode | `1-1140` (petunjuk "Unik dalam organisasi, mis. 1-1100.") |
| Nama | `Kas di Bank UAT` |
| Deskripsi (opsional) | `Rekening bank khusus UAT` |
| Tipe *(cek pilihan)* | Aset / Liabilitas / Ekuitas / Pendapatan / Beban; pilih **Aset** |
| Saldo normal *(cek pilihan)* | Debit / Kredit; pilih **Debit** |
| Akun induk (opsional) *(cek pilihan)* | "Tanpa induk" lalu daftar akun; pilih **1-1100 — Kas dan Setara Kas** |
| Kategori arus kas (opsional) *(cek pilihan)* | — / Operasional / Investasi / Pendanaan; pilih **Operasional** |
| Bisa diposting | dicentang (bawaan); petunjuk "Hanya akun yang bisa diposting dapat menerima baris jurnal." |

**Uji salah** (sebelum isian di atas disimpan):

- Kode atau Nama dikosongkan → tombol Simpan tidak bisa diklik.
- Kode `1-1120` (sudah ada) → ditolak "Kode akun sudah digunakan".
- Kode diketik huruf kecil `abc-1` → otomatis menjadi huruf besar.

**Klik:** Simpan.

**Harus terlihat:** pesan "Akun dibuat"; baris `1-1140` Kas di Bank UAT dengan Tipe Aset, Saldo normal Debit, Kategori arus kas Operasional, Bisa diposting, Keadaan Aktif. Jumlah di atas tabel ("… akun") bertambah satu.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Buat akun beban dan akun header

Menu yang sama → **Akun baru** dua kali.

| Isian | Akun 1 | Akun 2 |
|---|---|---|
| Kode | `6-2450` | `6-9000` |
| Nama | `Beban Rapat UAT` | `Beban Header UAT` |
| Deskripsi (opsional) | kosong | `Header untuk uji arsip` |
| Tipe | Beban | Beban |
| Saldo normal | Debit | Debit |
| Akun induk (opsional) | 6-2000 — Beban Umum dan Administrasi | Tanpa induk |
| Kategori arus kas (opsional) | Operasional | — |
| Bisa diposting | dicentang | **tidak** dicentang |

**Klik:** Simpan (untuk masing-masing).

**Harus terlihat:** "Akun dibuat" dua kali; `6-9000` berlabel **Akun header**. Di **Jurnal → Entri manual baru**, pilihan Akun berisi `6-2450` tetapi **tidak** berisi `6-9000`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Cari, filter, dan ubah akun

1. Kotak **Cari** (petunjuk "Kode atau nama"): ketik `UAT` → hanya 3 akun UAT.
2. Tombol **Filter** → panel "Filter akun": Tipe *(cek pilihan: Semua tipe, Aset, Liabilitas, Ekuitas, Pendapatan, Beban)* pilih Beban; Keadaan *(cek pilihan: Semua status, Aktif, Diarsipkan)*; Bisa diposting *(cek pilihan: Semua, Bisa diposting, Akun header)* pilih Akun header → **Terapkan** → hanya akun header beban, termasuk `6-9000`. **Atur ulang** mengembalikan semua.
3. Baris `1-1140` → Aksi → **Ubah akun**: ubah Nama menjadi `Kas di Bank UAT (rekening)`, Deskripsi `Diubah saat UAT`.

**Harus terlihat:** di form ubah, Kode, Tipe, dan Saldo normal tidak bisa diubah, dengan petunjuk "Kode, tipe, dan saldo normal tidak dapat diubah setelah dibuat."; setelah **Simpan** muncul "Akun diperbarui"; tekan F5, nama baru tetap. Kembalikan nama ke `Kas di Bank UAT`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Nonaktifkan, aktifkan, dan arsipkan akun

1. Baris `6-2450` → **Nonaktifkan** → lalu **Aktifkan**.
2. Baris `6-9000` → **Arsipkan** → konfirmasi "Arsipkan akun ini?" → ya.
3. Baris `1-1120` (akun sistem) → **Arsipkan**.

**Harus terlihat:** langkah 1 "Akun dinonaktifkan" lalu "Akun diaktifkan" (Keadaan berganti Diarsipkan lalu Aktif ⚠️: akun nonaktif berlabel "Diarsipkan", sama dengan akun yang diarsipkan); langkah 2 "Akun diarsipkan" dan `6-9000` hilang dari daftar Aktif; langkah 3 ditolak (akun sistem tidak dapat diarsipkan, sesuai keterangan halaman).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Buat pusat biaya (semua kolom)

Menu **Keuangan → Keuangan → Pusat Biaya** → tombol **Pusat biaya baru**. Daftar sudah berisi 3 pusat biaya bawaan: UMUM, OPS, SALES.

| Isian | Pusat biaya 1 | Pusat biaya 2 |
|---|---|---|
| Kode | `CC-UAT` | `CC-UAT2` |
| Nama | `Pusat Biaya UAT` | `Pusat Biaya UAT 2` |
| Induk pusat biaya (opsional) *(cek pilihan)* | "—" lalu UMUM, OPS, SALES; pilih **OPS** | pilih **CC-UAT** |
| Deskripsi (opsional) | `Untuk uji laporan pusat biaya` | kosong |

**Uji salah:** Kode atau Nama kosong → tombol Simpan tidak bisa diklik. Buat lagi kode `CC-UAT` → ditolak "Kode pusat biaya sudah dipakai".

**Klik:** Simpan.

**Harus terlihat:** "Pusat biaya disimpan" dua kali; kedua baris berkeadaan **Aktif**. Kotak "Cari kode atau nama" dengan `UAT` hanya menampilkan dua baris ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Ubah dan nonaktifkan pusat biaya

1. Baris `CC-UAT` → **Ubah**: Nama `Pusat Biaya UAT (ubah)`, Deskripsi dihapus → Simpan. Kembalikan nama ke `Pusat Biaya UAT`.
2. Baris `CC-UAT2` → **Nonaktifkan** → konfirmasi "Nonaktifkan pusat biaya ini? Baris jurnal yang sudah ada tetap menyimpannya." → ya.

**Harus terlihat:** di form Ubah, Kode tidak bisa diubah ("Kode tidak bisa diubah setelah dibuat."); "Pusat biaya disimpan"; lalu "Pusat biaya dinonaktifkan" dan `CC-UAT2` berkeadaan **Nonaktif**. Di **Jurnal → Entri manual baru**, pilihan Pusat biaya tidak berisi `CC-UAT2` (bila masih ada, catat ⚠️).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7 ⚠️. Daftar aturan posting dan pilihannya

Menu **Keuangan → Keuangan → Aturan Posting**. Kolom: Peran, Transaksi bisnis, Pembeda, Akun. Centang **Tampilkan yang nonaktif** lalu hilangkan lagi. Klik **Aturan baru** dan buka setiap pilihan (jangan disimpan dulu).

**Harus terlihat:**

- Daftar berisi aturan bawaan seeder, misalnya Piutang usaha → 1-1310, Pendapatan → 4-1100, Kas diterima (per metode) dengan Pembeda Metode pembayaran `cash` → 1-1110, Aset tetap dengan Pembeda Jenis barang `it` → 1-2130.
- Pilihan **Transaksi bisnis** (21): Semua transaksi (bawaan), Faktur penjualan terbit, Pembayaran dilunasi, Tagihan pemasok dicatat, Klaim biaya disetujui, Pendapatan diterima dimuka diakui, Nota kredit diterapkan, Piutang dihapuskan, Barang diterima, Retur pembelian dikirim, Surat jalan dikirim, Retur penjualan diterima, Penyesuaian stok diposting, Kuitansi dicatat, Settlement payment gateway, Biaya proyek dicatat, PPh dipotong saat pembayaran, PPN masa ditutup, Pajak disetor, Penggajian disetujui, Gaji atau BPJS dibayar.
- Pilihan **Pembeda** (9): Tanpa pembeda, Kategori produk, Jenis pajak, Rekening kas/bank, Kategori biaya, Kategori aset, Kategori ongkos, Metode pembayaran, Jenis barang.
- Pilihan **Peran** (36), dari Piutang usaha sampai Beban pajak penghasilan, semua dalam bahasa Indonesia.
- ⚠️ Dugaan: peran uang muka karyawan, piutang pelepasan aset, laba/rugi pelepasan aset, dan transaksi "pertanggungjawaban uang muka", "kapitalisasi/penyusutan/pelepasan aset" tidak ada di pilihan; bila ada aturan dengan peran itu di daftar, kolomnya tampil sebagai kode mentah seperti `postingRules.role.employee_advance`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8. Buat, ubah, dan arsipkan aturan posting

Tombol **Aturan baru**. Aturan ini sengaja memakai nilai pembeda yang tidak dipakai transaksi apa pun, sehingga tidak mengubah jurnal lain.

| Isian | Isi dengan |
|---|---|
| Peran | Biaya payment gateway |
| Transaksi bisnis | Settlement payment gateway |
| Pembeda | Rekening kas/bank |
| Nilai pembeda | `UAT-TIDAK-ADA` (kolom ini terkunci bila Pembeda = Tanpa pembeda) |
| Akun *(cek pilihan)* | akun aktif yang bisa diposting; pilih **8-1000 — Beban Administrasi Bank** |
| Aktif | dicentang |

**Klik:** Simpan.

**Harus terlihat:** "Aturan posting disimpan"; baris baru tampil. Lalu:

1. Buat aturan yang sama sekali lagi → ditolak "Aturan posting untuk transaksi, peran, dan pembeda ini sudah ada".
2. Baris baru → **Ubah akun**: Peran, Transaksi bisnis, Pembeda, Nilai pembeda terkunci; ganti Akun ke `6-3200` → Simpan → "Aturan posting disimpan".
3. **Arsipkan** → konfirmasi "Arsipkan aturan ini? Posting yang bergantung padanya akan gagal sampai ada aturan lain untuk peran tersebut." → "Aturan posting diarsipkan"; baris hanya tampil bila **Tampilkan yang nonaktif** dicentang, berlabel Nonaktif.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9. Keuangan dan auditor hanya melihat data induk

1. Login `finance_seed`: buka **Aturan Posting** dan **Pusat Biaya**.
2. Login `auditor_seed`: buka **Daftar Akun**, **Aturan Posting**, **Pusat Biaya**.

**Harus terlihat:** daftar tampil; tombol Akun baru, Aturan baru, Pusat biaya baru, serta aksi Ubah/Nonaktifkan/Arsipkan **tidak** tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## C. Kas & Bank (login `finance_seed`)

### C1 ⚠️. Buat akun kas/bank (semua kolom)

Menu **Keuangan → Keuangan → Kas & Bank** → tombol **Akun kas/bank baru**. Daftar sudah berisi BANK-BCA, BANK-MANDIRI, CASH dari seeder. Form terbagi 2 bagian: Identitas dan Detail rekening.

| Isian | Isi dengan |
|---|---|
| Kode | `BANK-UAT` |
| Nama | `Bank UAT` |
| Tipe akun *(cek pilihan)* | Bank / Kas / Dompet digital / Kliring; pilih **Bank** |
| Akun GL *(cek pilihan)* | "—" lalu akun aktif yang bisa diposting; pilih **1-1140 — Kas di Bank UAT** |
| Saldo awal (informasional) (opsional) | `0` |
| Nama bank (opsional) | `Bank UAT Indonesia` |
| Nomor rekening (opsional) | `5550001111` |
| Atas nama (opsional) | `PT Entragate` |
| Pemakaian invoice (opsional) *(cek pilihan)* | — / Invoice dengan PPN / Invoice tanpa PPN; biarkan **—** |
| Utama untuk pemakaian ini | tidak dicentang (petunjuk "Satu akun utama per pemakaian invoice; cetakan memilih akun ini.") |

**Klik:** Simpan.

**Harus terlihat:** "Akun kas/bank dibuat"; baris BANK-UAT dengan Tipe akun Bank, Saldo saat ini Rp 0, Akun GL 1-1140. ⚠️ Dugaan untuk `finance_seed`: pilihan Akun GL hanya berisi "—" karena daftar akun butuh hak baca Daftar Akun yang tidak dimiliki Keuangan. Bila begitu, catat, lalu buat BANK-UAT dengan login `admin` dan lanjutkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Uji salah dan ubah akun kas/bank

1. **Akun kas/bank baru** dengan Kode `BANK-UAT` lagi → ditolak "Kode akun kas/bank sudah digunakan".
2. **Akun kas/bank baru**: Kode `KAS-UAT`, Nama `Kas UAT tanpa GL`, Tipe akun Kas, Akun GL **—** → Simpan (boleh).
3. Di baris transaksi bawah tabel, pilih akun `KAS-UAT`, Masuk, Nilai `10000`, Akun lawan `7-9000` → **Transaksi baru**.
4. Baris BANK-UAT → **Ubah akun kas/bank**: Atas nama `PT Entragate Indonesia` → Simpan.

**Harus terlihat:** 1 ditolak; 2 "Akun kas/bank dibuat"; 3 ditolak "Akun kas/bank belum ditautkan ke akun buku besar; tambahkan tautan sebelum mencatat pergerakan" dan tidak ada transaksi tersimpan; 4 "Akun kas/bank diperbarui", Kode terkunci ("Kode tidak dapat diubah setelah dibuat."), setelah F5 Atas nama baru tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3 ⚠️. Setoran modal ke Bank UAT (J1)

Baris transaksi di bawah tabel akun (di atasnya tertulis "Tautan GL wajib sebelum transaksi pertama.").

| Isian | Isi dengan |
|---|---|
| Akun kas/bank *(cek pilihan)* | "Akun kas/bank" lalu semua akun; pilih **BANK-UAT — Bank UAT** |
| Tanggal | `02/11/2026` |
| Arah *(cek pilihan)* | Masuk / Keluar; pilih **Masuk** |
| Nilai | `50000000` |
| Akun lawan *(cek pilihan)* | "Akun lawan" lalu akun aktif yang bisa diposting, **tanpa** akun berawalan 1-1; pilih **3-1000 — Modal Disetor** |
| Deskripsi | `Setoran modal UAT` |

**Uji salah:** Nilai kosong atau Akun lawan belum dipilih → tombol Transaksi baru tidak bisa diklik.

**Klik:** Transaksi baru.

**Harus terlihat:** "Transaksi diposting"; tabel **Transaksi**: Tanggal transaksi 02/11/2026, Kode, Masuk, Nilai Rp 50.000.000, Saldo setelah Rp 50.000.000, Deskripsi; Saldo saat ini BANK-UAT Rp 50.000.000. Jurnal J1 (Dr 1-1140 / Cr 3-1000) dicek di I6. ⚠️ Dugaan untuk `finance_seed`: pilihan Akun lawan kosong (sebab yang sama dengan C1); bila begitu catat dan kerjakan C3–C4 dengan `admin`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Bayar sewa dan terima bunga (J2, J3)

Baris transaksi yang sama, dua kali:

| Isian | Transaksi 1 | Transaksi 2 |
|---|---|---|
| Akun kas/bank | BANK-UAT | BANK-UAT |
| Tanggal | `03/11/2026` | `04/11/2026` |
| Arah | Keluar | Masuk |
| Nilai | `1500000` | `250000` |
| Akun lawan | 6-2100 — Beban Sewa | 7-1000 — Pendapatan Bunga Bank |
| Deskripsi | `Sewa gudang UAT` | `Bunga bank UAT` |

**Uji salah:** BANK-UAT, Keluar, Nilai `999999999`, Akun lawan 6-2100 → ditolak "Saldo akun kas/bank tidak mencukupi"; saldo tidak berubah.

**Klik:** Transaksi baru (untuk masing-masing).

**Harus terlihat:** "Transaksi diposting" dua kali; Saldo setelah Rp 48.500.000 lalu Rp 48.750.000; Saldo saat ini BANK-UAT **Rp 48.750.000**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Setor pajak (J20)

Tombol **Setor pajak** di kanan atas. Dialog dengan keterangan "Menyetor utang pajak ke negara; kas/bank keluar dengan lawan akun utang pajaknya."

| Isian | Isi dengan |
|---|---|
| Utang pajak *(cek pilihan)* | Utang PPN / Utang PPh potong (PPh 23 / 4(2)) / Utang PPh 21 / Utang PPh 25/29; pilih dulu **Utang PPh potong** → muncul kolom **Kode pajak (mis. PPH23)**; lalu ganti ke **Utang PPh 21** → kolom Kode pajak hilang |
| Kas & Bank *(cek pilihan)* | "—" lalu akun kas/bank; pilih **BANK-UAT** |
| Tanggal | `17/11/2026` |
| Nilai | `150000` |
| Kode billing / NTPN | `NTPN-UAT-001` |

**Uji salah:** Nilai `0` → ditolak "Setoran pajak butuh jumlah yang lebih dari nol" (atau tombol tidak bisa diklik).

**Klik:** Simpan.

**Harus terlihat:** "Setoran pajak dicatat"; transaksi Keluar Rp 150.000 di BANK-UAT. Detail pajak dan tutup PPN masa diuji di [m10-pajak.md](m10-pajak.md).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6. Form bayar gaji / BPJS (tanpa disimpan)

Tombol **Bayar gaji / BPJS**. Dialog dengan keterangan "Membayar gaji neto yang disetujui atau iuran BPJS; kas/bank keluar dengan lawan Utang Gaji atau Utang BPJS."

| Isian | Isi dengan |
|---|---|
| Utang pajak *(cek pilihan)* | Utang gaji / Utang BPJS (label kolom masih "Utang pajak" ⚠️) |
| Kas & Bank | BANK-UAT |
| Tanggal | hari ini |
| Nilai | `0` |
| Referensi (batch transfer / tagihan BPJS) | `BATCH-UAT` |

**Klik:** Simpan, lalu **Batal**.

**Harus terlihat:** Nilai 0 ditolak dengan pesan yang dimengerti; setelah Batal tidak ada transaksi baru. Pembayaran gaji sebenarnya diuji di alur penggajian M08.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7. Settlement payment gateway (J19)

Tombol **Catat settlement payment gateway**. Dialog dengan keterangan "Dana neto masuk ke rekening ini dengan lawan akun kliring gateway; biayanya dibukukan sebagai beban payment gateway."

| Isian | Isi dengan |
|---|---|
| Kas & Bank *(cek pilihan)* | "—" lalu akun kas/bank; pilih **BANK-UAT** |
| Tanggal | `16/11/2026` |
| Total bruto | `1000000` |
| Biaya gateway | `5000` |
| Referensi settlement | `STL-UAT-001` |

**Uji salah:** Total bruto `5000`, Biaya gateway `5000` → ditolak "Settlement butuh nilai bruto positif yang lebih besar dari biayanya".

**Klik:** Simpan.

**Harus terlihat:** "Settlement payment gateway dicatat"; transaksi Masuk Rp 995.000 (neto) di BANK-UAT. ❓ Bila belum ada pembayaran gateway sebelumnya, akun 1-1250 Kliring Payment Gateway menjadi bersaldo kredit Rp 1.000.000; perlu keputusan apakah settlement boleh melebihi saldo kliring.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8. Akuntan dan auditor di Kas & Bank

Login `accountant_seed`, lalu `auditor_seed`: buka **Kas & Bank**.

**Harus terlihat:** daftar akun dan tabel Transaksi tampil (BANK-UAT, saldo sama dengan yang dilihat Keuangan); tombol Setor pajak, Bayar gaji / BPJS, Catat settlement payment gateway, Akun kas/bank baru, aksi Ubah, dan baris Transaksi baru **tidak** tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## D. Piutang: faktur dan kuitansi (login `finance_seed`)

Form faktur dan kuitansi sudah diuji lengkap di M02 bagian D. Di sini fokusnya jurnal, nota kredit, penghapusan piutang, dan umur piutang.

### D1. Faktur 1: buat dan terbitkan (J6)

Menu **CRM & Penjualan → Penjualan → Sales order** → buka SO kedua khusus keuangan → kartu **Penagihan** → **Buat invoice**.

| Isian | Isi dengan |
|---|---|
| Yang ditagih *(cek pilihan)* | Termin rencana berikutnya: … / Persentase dari order / Nominal tetap (termasuk PPN) / Seluruh sisa; pilih **Nominal tetap (termasuk PPN)** |
| Nominal termasuk PPN (Rp) | `11100000` (petunjuk "Nominal dipecah menjadi DPP dan PPN.") |
| Termin tagihan (opsional) | `Termin 1 UAT keuangan` |
| Jatuh tempo (opsional) | `20/11/2026` |

**Klik:** Buat draf. Di halaman faktur → **Terbitkan invoice** → Tanggal terbit `06/11/2026`, Jatuh tempo `20/11/2026` → Simpan.

**Harus terlihat:** "Draf invoice dibuat", lalu "Invoice diterbitkan"; status **Terbit**; kartu Nilai: DPP Rp 10.000.000, PPN 11% Rp 1.100.000, Total invoice Rp 11.100.000, Sisa tagihan Rp 11.100.000. Kartu **Nota kredit dan penghapusan piutang** muncul. Jurnal J6 (Dr 1-1310 11.100.000 / Cr 4-1100 10.000.000, Cr 2-1410 1.100.000) dicek di I6.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Kuitansi salah lalu dibatalkan (J7)

Di Faktur 1 → **Catat pembayaran**.

| Isian | Isi dengan |
|---|---|
| Nominal (Rp) | `1000000` |
| Tanggal terima | `09/11/2026` |
| Metode *(cek pilihan)* | Transfer / Tunai / Kartu / Dompet digital / Cek/Giro; pilih **Transfer** |
| Referensi (opsional) | `TRF-SALAH-UAT` |

**Klik:** Simpan. Lalu di tabel **Pembayaran diterima** baris itu → **Batalkan** → Alasan `Salah nominal` → Simpan.

**Harus terlihat:** "Pembayaran dicatat" (status Dibayar sebagian, Sisa tagihan Rp 10.100.000); lalu "Kwitansi dibatalkan", baris berlencana **Dibatalkan**, status kembali **Terbit**, Sisa tagihan Rp 11.100.000. Ada dua jurnal: J7 dan pembaliknya (net nol).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Kuitansi sebagian (J8)

**Catat pembayaran** lagi: Nominal (Rp) `6000000`, Tanggal terima `10/11/2026`, Metode Transfer, Referensi `TRF-UAT-FIN-01`.

**Uji salah:** Nominal `12000000` (melebihi sisa) → ditolak dengan pesan yang dimengerti.

**Klik:** Simpan.

**Harus terlihat:** "Pembayaran dicatat"; status **Dibayar sebagian**; Sisa tagihan **Rp 5.100.000**. Uang masuk ke akun 1-1120 Kas di Bank BCA (aturan Kas diterima bawaan untuk metode selain Tunai).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Faktur 2 dan nota kredit (J9, J10)

1. Dari SO yang sama buat **Faktur 2**: Nominal tetap (termasuk PPN) `1110000`, Termin tagihan `Termin 2 UAT keuangan` → Buat draf → Terbitkan invoice dengan Tanggal terbit `08/11/2026`, Jatuh tempo `22/11/2026`.
2. Kartu **Nota kredit dan penghapusan piutang** → **Nota kredit baru**:

| Isian | Isi dengan |
|---|---|
| Sisa tagihan | tampil Rp 1.110.000 (hanya dibaca) |
| Tanggal | `09/11/2026` |
| Nilai | `111000` |
| Alasan | `Potongan harga UAT` |

3. **Simpan** → baris nota kredit Draf → **Terapkan**.
4. Buat nota kredit kedua Nilai `50000`, Alasan `Batal UAT` → Simpan → **Batalkan nota kredit**.

**Uji salah:** Nota kredit Nilai `2000000` (melebihi sisa) → ditolak "Nota kredit butuh faktur yang sudah terbit dan tidak boleh melebihi sisa tagihannya".

**Harus terlihat:** "Invoice diterbitkan"; "Draf nota kredit dibuat"; "Nota kredit diterapkan", status nota **Diterapkan**, Sisa tagihan Faktur 2 **Rp 999.000**; nota kedua berstatus **Batal** tanpa jurnal. Jurnal J10: Dr 4-1900 100.000, Dr 2-1410 11.000 / Cr 1-1310 111.000 (PPN dipecah sebanding).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. Ajukan dan tarik penghapusan piutang

Di Faktur 2 → **Ajukan penghapusan piutang**. Dialog dengan keterangan "Seluruh sisa tagihan dihapuskan setelah disetujui oleh orang lain."

| Isian | Isi dengan |
|---|---|
| Alasan | `Pelanggan tidak dapat ditagih (UAT)` |

**Klik:** Ajukan penghapusan piutang. Lalu **Tarik kembali**, lalu ajukan lagi dengan alasan yang sama.

**Harus terlihat:** "Penghapusan piutang diajukan"; kotak "Penghapusan piutang menunggu persetujuan" berisi Rp 999.000 · alasan; tombol **Setujui penghapusan** tidak tampil untuk `finance_seed`. Setelah Tarik kembali kotak hilang; setelah diajukan lagi kotak muncul lagi. Menu **Keuangan → Keuangan → Piutang** menampilkan kartu "Penghapusan piutang yang menunggu persetujuan" dengan tautan **Buka faktur**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6. Pengaju tidak boleh menyetujui; Akuntan menyetujui (J11)

1. Login `admin`: buka Faktur 2 → **Tarik kembali** → **Ajukan penghapusan piutang** lagi (sekarang pengajunya `admin`).
2. Masih `admin`: cari tombol **Setujui penghapusan**.
3. Login `accountant_seed`: buka Faktur 2 → **Setujui penghapusan** → konfirmasi "Hapuskan seluruh sisa tagihan faktur ini? Tindakan ini memposting jurnal." → ya.

**Harus terlihat:** 2 tombol tidak tampil (bila dipaksa lewat server: "Pengaju penghapusan piutang tidak boleh menyetujuinya sendiri"); 3 "Piutang dihapuskan", status faktur **Dihapuskan**, Sisa tagihan Rp 0. ❓ Jurnal J11 mendebit 1-1390 Cadangan Kerugian Piutang walau cadangan belum pernah dibentuk, sehingga akun itu bersaldo debit dan tidak ada beban kerugian piutang di laba rugi; perlu keputusan apakah seharusnya Dr 6-2600 Beban Kerugian Piutang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7 ❓. Link pembayaran online

Di Faktur 1 (masih Dibayar sebagian) → kartu **Pembayaran online** → **Buat link pembayaran** → **Salin link** → **Buka** (jangan dibayar).

**Harus terlihat:** "Link pembayaran dibuat"; baris dengan Dibuat, Penyedia, Nominal Rp 5.100.000, Status **Menunggu pembayaran**, Kedaluwarsa; "Link pembayaran disalin"; halaman penyedia terbuka di tab baru. Bila belum ada gateway yang diatur Pemilik, catat pesan yang muncul (gateway diatur di Administrasi, lihat M04/M12).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D8. Umur piutang dan pembayaran pelanggan

Menu **Keuangan → Keuangan → Piutang**. Isi **Tanggal per** `30/11/2026` → **Terapkan**.

**Harus terlihat:** tabel "Piutang" (keterangan "Aging piutang dihitung on-demand dari sub-buku AR.") dengan kolom Pelanggan, Belum jatuh tempo, 1–30 hari, 31–60 hari, 61–90 hari, 90+ hari, Jumlah; baris Budi Hartono UAT: Faktur 1 Rp 5.100.000 di kolom **1–30 hari**; Faktur 2 tidak muncul (dihapuskan); baris "Total keseluruhan". Ganti Tanggal per ke `15/11/2026` → Rp 5.100.000 pindah ke **Belum jatuh tempo**. Tabel **Pembayaran pelanggan** di bawahnya tampil (boleh kosong bila kuitansi tidak membuat pembayaran).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D9. Akuntan dan auditor di faktur

Login `accountant_seed`, lalu `auditor_seed`: buka Faktur 1 dan Faktur 2 dari **CRM & Penjualan → Penjualan → Faktur**.

**Harus terlihat:** keduanya bisa membuka faktur; tombol Terbitkan invoice, Catat pembayaran, Void invoice, Nota kredit baru, Ajukan penghapusan piutang **tidak** tampil. Akuntan masih melihat tombol Terapkan/Batalkan nota kredit untuk nota berstatus Draf; auditor tidak melihat tombol apa pun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## E. Utang: tagihan pemasok (login `finance_seed`)

### E1. Tagihan pemasok manual (J12)

Menu **Keuangan → Keuangan → Utang** → tombol **Tagihan baru**. Baris form muncul di atas tabel "Tagihan Pemasok".

| Isian | Isi dengan |
|---|---|
| Pemasok *(cek pilihan)* | "Pemasok" lalu daftar `kode - nama`; pilih **PT Sumber Kabel UAT** |
| Tanggal tagihan | `07/11/2026` |
| Jatuh tempo (kolom tanggal kedua, tanpa label) | `07/12/2026` |
| Nilai tagihan | `2000000` |
| Pajak | `220000` |

**Uji salah:** Pemasok belum dipilih atau Nilai tagihan kosong → tombol Buat tidak bisa diklik. ⚠️ Jatuh tempo `01/11/2026` (sebelum tanggal tagihan) kemungkinan diterima; catat bila tersimpan, lalu batalkan drafnya (E3).

**Klik:** Buat. Lalu baris tagihan → Aksi → **Rekam (posting AP)**.

**Harus terlihat:** "Tagihan dibuat (draf)"; status **Draf**, Total Rp 2.220.000, Dibayar Rp 0, Belum dibayar Rp 2.220.000. Setelah rekam: "Tagihan direkam — jurnal AP diposting", status **Disetujui**. ❓ Tidak ada kolom akun beban, sehingga tagihan manual selalu dibukukan ke 6-2900 Beban Umum Lainnya (peran Beban bawaan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Tagihan dari PO (J13)

Tombol **Tagihan dari PO**.

| Isian | Isi dengan |
|---|---|
| Purchase order (PO) *(cek pilihan)* | "Pilih PO yang barangnya sudah diterima" lalu PO yang punya barang diterima dan belum ditagih; pilih **PO M05 D1** (bila kosong: "Tidak ada PO dengan barang diterima yang belum ditagih.") |
| Nomor faktur pemasok | `FP-SK-UAT-001` |
| Tanggal tagihan | `19/11/2026` |
| Jatuh tempo (opsional) | `20/11/2026` |
| Keterangan PPN | tampil "PPN ditambahkan di atas harga PO." |
| Kamera IP UAT: Jumlah ditagih | `2` (tertulis "bisa ditagih 2 dari 2 diterima" dan "barang stok (masuk Persediaan)") |
| Kabel UTP Cat6 UAT: Jumlah ditagih | `0` |
| Konektor RJ45 UAT: Jumlah ditagih | `0` |

**Uji salah:** Nomor faktur pemasok kosong → tidak bisa disimpan; Jumlah ditagih Kamera `3` → ditolak "Baris …: melebihi jumlah yang sudah diterima dan belum ditagih".

**Klik:** Buat draf tagihan. Lalu **Rekam (posting AP)**.

**Harus terlihat:** "Tagihan dibuat (draf)"; Total **Rp 3.996.000** (3.600.000 + PPN 396.000); setelah rekam "Tagihan direkam — jurnal AP diposting". Buka **Tagihan dari PO** lagi: Kamera sekarang "bisa ditagih 0 dari 2 diterima".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Batalkan draf tagihan

**Tagihan baru**: Pemasok PT Sumber Kabel UAT, Tanggal tagihan hari ini, Nilai tagihan `100000`, Pajak kosong → **Buat**. Baris itu → **Batalkan draf** → konfirmasi "Batalkan tagihan draf ini? Tanpa dampak jurnal." → ya. Lalu coba **Batalkan draf** pada tagihan E1 yang sudah direkam.

**Harus terlihat:** "Tagihan draf dibatalkan", status **Batal**; untuk tagihan E1 aksi Batalkan draf tidak tersedia (atau ditolak "Hanya tagihan pemasok berstatus draf yang dapat diubah atau dicatat").

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4 ⚠️. Bayar tagihan pemasok

Di halaman **Utang**, cari tombol untuk membayar tagihan E1 atau E2 (di baris tagihan atau di tabel **Pembayaran pemasok**).

**Harus terlihat (seharusnya):** ada cara membuat pembayaran pemasok (pilih tagihan, akun kas/bank, potongan PPh bila ada), lalu Ajukan → Setujui → Eksekusi. **Dugaan:** tidak ada tombol sama sekali; tabel Pembayaran pemasok kosong. Backend sudah mendukung (pembayaran dengan alokasi ke tagihan pemasok dan potongan PPh), tetapi layar pembuatnya tidak ada. Tagihan E1 dan E2 tetap Belum dibayar.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Umur utang

Halaman **Utang** bagian atas: **Tanggal per** `30/11/2026` → **Terapkan**.

**Harus terlihat:** tabel "Utang" (keterangan "Aging utang dihitung on-demand dari sub-buku AP.") baris PT Sumber Kabel UAT: Rp 2.220.000 di **Belum jatuh tempo** (jatuh tempo 07/12) dan Rp 3.996.000 di **1–30 hari** (jatuh tempo 20/11); Jumlah Rp 6.216.000; tagihan yang dibatalkan tidak ikut.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E6. Akuntan di Utang

Login `accountant_seed`: buka **Utang**.

**Harus terlihat:** tabel umur utang dan tagihan tampil; tombol **Tagihan dari PO**, **Tagihan baru**, dan aksi **Rekam (posting AP)** juga tampil (Akuntan boleh membuat dan merekam tagihan) ❓ (perlu keputusan apakah Akuntan memang ikut menginput tagihan); tidak ada tombol Ajukan/Setujui/Eksekusi pembayaran.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## F. Anggaran proyek (login `admin`)

### F1 ⚠️. Versi baru dan baris anggaran (semua kolom)

Menu **Keuangan → Keuangan → Anggaran proyek**. Pilih proyek *(cek pilihan: "Tanpa proyek" lalu proyek aktif `kode — judul`)* **Proyek M07** → tombol **Versi baru** → muncul "Draf versi 1".

| Isian | Baris 1 | Baris 2 |
|---|---|---|
| Akun biaya *(cek pilihan)* | "Akun biaya" lalu akun beban aktif; pilih **6-2400 — Beban Transportasi dan Perjalanan** | **6-2450 — Beban Rapat UAT** |
| Bulan | `2026-11` (November 2026) | `2026-11` |
| Nilai | `1000000` | `500000` |

(Baris ditambah dengan **Tambah baris**; ikon tempat sampah = Hapus baris.)

**Uji salah:** Baris 3 Akun 6-2400, Bulan 2026-11, Nilai `1` → **Simpan** → ditolak "Satu akun muncul dua kali di bulan yang sama". Hapus baris 3.

**Klik:** Simpan.

**Harus terlihat:** "Baris anggaran disimpan"; lencana **v1 · draf**. ⚠️ Dugaan: pilihan Akun biaya kosong karena halaman meminta 300 akun sekaligus sedangkan server membatasi 100; bila begitu Simpan tidak bisa diklik dan F2–F3 serta G5 dilewati (catat).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Aktifkan, buat versi 2, aktifkan lagi

1. **Aktifkan** (tombol tidak bisa diklik selama ada perubahan yang belum disimpan).
2. **Versi baru** → "Draf versi 2" berisi baris yang sama → tanpa perubahan → **Simpan** → **Aktifkan**.

**Harus terlihat:** "Versi anggaran diaktifkan" dua kali; lencana **v1 · digantikan** dan **v2 · aktif**; tombol Versi baru hilang selama ada draf (membuat draf kedua ditolak "Proyek ini sudah punya draf versi anggaran"). Kartu ringkasan: Anggaran Rp 1.500.000, Aktual Rp 0, Komitmen (PO) Rp 0, Tersisa Rp 1.500.000; tabel Bulan / Akun biaya / Anggaran / Aktual / Selisih berisi 2 baris.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Mode kontrol anggaran

Pilihan mode di samping lencana *(cek pilihan: Peringatkan bila melampaui / Tolak bila melampaui)* → pilih **Tolak bila melampaui** → tekan F5.

**Harus terlihat:** pilihan tetap **Tolak bila melampaui** setelah F5 (⚠️ tidak ada pesan berhasil). Dipakai di G5.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F4 ⚠️. Anggaran per role

| Akun | Harus terlihat |
|---|---|
| `finance_seed` | menu tampil; ringkasan dan tabel Proyek M07 tampil tanpa tombol Versi baru/mode/editor; ⚠️ kolom Akun biaya mungkin berisi kode acak (id) karena Keuangan tidak bisa membaca daftar akun |
| `accountant_seed` | ⚠️ menu tidak tampil, padahal server mengizinkan Akuntan menyimpan dan mengaktifkan anggaran |
| `auditor_seed` | menu tampil, hanya baca |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## G. Klaim biaya, uang muka, dan pertanggungjawaban

### G1. Buat klaim biaya (semua kolom, login `finance_seed`)

Menu **Keuangan → Keuangan → Beban**. Halaman berisi 3 bagian: Klaim biaya, Uang muka karyawan (hanya untuk role tertentu), Pembayaran karyawan. Tombol **Klaim baru**.

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "Pilih karyawan" lalu karyawan aktif; pilih **karyawan milik `finance_seed`** |
| Tanggal klaim | `11/11/2026` |
| Proyek *(cek pilihan)* | "Tanpa proyek" lalu proyek aktif; pilih **Proyek M07** |
| Catatan | `Klaim perjalanan dan rapat UAT` |

**Baris biaya** (tombol **Tambah baris** untuk baris kedua):

| Isian | Baris 1 | Baris 2 |
|---|---|---|
| Tanggal biaya | `10/11/2026` | `10/11/2026` |
| Akun beban *(cek pilihan)* | "Pilih akun beban" lalu akun beban aktif; pilih **6-2400** | **6-2450** |
| Keterangan | `Bensin ke lokasi` | `Konsumsi rapat` |
| Jumlah | `300000` | `200000` |
| PPN | `0` | `0` |

**Uji salah:**

- Tanpa karyawan atau tanpa baris → tidak bisa disimpan / diajukan ("Klaim biaya perlu minimal satu baris untuk diajukan").
- ⚠️ Dugaan untuk `finance_seed`: pilihan Akun beban kosong dan muncul "Belum ada akun beban aktif. Tambahkan di Akun sebelum membuat klaim." (Keuangan tidak bisa membaca daftar akun). Bila begitu, catat dan buat klaim dengan `admin`.

**Klik:** Simpan draf.

**Harus terlihat:** "Total dihitung dari baris." dan **Jumlah: Rp 500.000** sebelum simpan; setelah simpan "Klaim disimpan sebagai draf"; baris di daftar dengan Kode, Karyawan, Tanggal klaim, Jumlah Rp 500.000, status **Draf**. Buka detail (klik kode): semua isian tampil, Entri jurnal "Diposting saat klaim disetujui.".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Ubah, ajukan, tolak, ajukan lagi

1. `finance_seed`: detail klaim → **Ubah** → Catatan `Klaim perjalanan dan rapat UAT (revisi)` → Simpan draf → **Ajukan**.
2. `accountant_seed`: **Beban** → baris klaim → **Tolak** → konfirmasi "Tolak klaim ini?".
3. `finance_seed`: **Ubah** (boleh lagi karena Ditolak) → simpan → **Ajukan**.

**Harus terlihat:** "Klaim diperbarui", "Klaim diajukan" (status **Diajukan**, tombol Ubah hilang), "Klaim ditolak" (status **Ditolak**), lalu Diajukan lagi. Filter **Saring status** *(cek pilihan: Semua, Draf, Diajukan, Disetujui, Ditolak, Lunas, Dibatalkan)* dan kotak **Kode klaim** bekerja.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G3. Akuntan menyetujui dan memposting (J14)

Login `accountant_seed` → **Beban** → klaim → **Setujui & posting**.

**Harus terlihat:** "Klaim disetujui dan diposting"; status **Disetujui**; di detail, Entri jurnal berisi nomor jurnal. Di **Anggaran proyek** (login `admin`, Proyek M07): Aktual Rp 500.000 (6-2400 Rp 300.000, 6-2450 Rp 200.000), Tersisa Rp 1.000.000. ❓ Klaim tidak punya pemeriksaan pembuat ≠ penyetuju: `finance_seed` yang membuat klaim juga melihat tombol **Setujui & posting** (lihat G5).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G4. Bayar klaim lewat pembayaran karyawan (J15)

Login `finance_seed` → detail klaim → **Bayar klaim**. Dialog dengan keterangan "Membuat draf pembayaran; ajukan, setujui, dan eksekusi di tabel Pembayaran karyawan di bawah."

| Isian | Isi dengan |
|---|---|
| Kas & Bank *(cek pilihan)* | "—" lalu akun kas/bank; pilih **BANK-UAT** |
| Tanggal | `12/11/2026` |
| Nilai | Rp 500.000 (terisi otomatis, sebesar klaim) |
| Referensi | `TRF-KLAIM-UAT` |

**Klik:** Buat draf pembayaran. Lalu di tabel **Pembayaran karyawan** baris itu: **Ajukan** → **Setujui** → **Eksekusi**.

**Harus terlihat:** "Draf pembayaran dibuat"; baris dengan Kode, Tanggal 12/11/2026, Nilai Rp 500.000, Metode Transfer bank, status **Draf**; lalu "Pembayaran diajukan" (Diajukan), "Pembayaran disetujui" (Disetujui), "Pembayaran tereksekusi — jurnal diposting" (Tereksekusi). Klaim berstatus **Lunas**; Saldo saat ini BANK-UAT berkurang Rp 500.000. ❓ Orang yang sama bisa membuat, menyetujui, dan mengeksekusi pembayaran (tidak ada pembuat ≠ penyetuju).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G5. Klaim melampaui anggaran ditolak, lalu dibatalkan (login `finance_seed`)

**Klaim baru**: Karyawan sama, Tanggal klaim hari ini, Proyek **Proyek M07**, Catatan `Klaim melampaui anggaran`, satu baris Akun 6-2400, Keterangan `Sewa mobil`, Jumlah `1200000`, PPN `0` → Simpan draf → **Ajukan**. Lalu **Batalkan klaim** → konfirmasi "Batalkan klaim ini? Belum ada yang diposting.".

**Harus terlihat:** Ajukan ditolak "Ini akan melampaui anggaran proyek (tersisa Rp 1.000.000)" (⚠️ angka mungkin tampil tanpa titik ribuan, "Rp 1000000"); status tetap **Draf**; setelah batal "Klaim dibatalkan", status **Dibatalkan**. Sebelum membatalkan, catat apakah tombol **Setujui & posting** muncul untuk pembuatnya sendiri (❓ lihat G3). Bila F1 tidak berhasil (tanpa anggaran), Ajukan berhasil; catat lalu batalkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G6 ⚠️. Ajukan uang muka (login `technician_seed`, lalu `admin`)

Menu **Keuangan → Keuangan → Beban** → bagian **Uang muka karyawan** ("Uang yang diberikan di muka untuk pekerjaan, lalu dipertanggungjawabkan.") → **Ajukan uang muka**.

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "—" lalu karyawan; pilih **karyawan milik `finance_seed`** |
| Tanggal | `13/11/2026` |
| Nilai | `1000000` |
| Keperluan | `Uang jalan instalasi UAT` |

**Klik:** Simpan, lalu **Ajukan** di baris itu.

**Harus terlihat:** "Uang muka diajukan" (❓ pesan ini muncul saat menyimpan padahal status masih **Draf**), lalu "Diperbarui" dan status **Diajukan**; kolom Kode, Karyawan, Keperluan, Nilai Rp 1.000.000, Sudah dipertanggungjawabkan Rp 0. ⚠️ Dugaan untuk `technician_seed`: menu **Beban** tidak tampil di sidebar (perlu hak klaim biaya) dan, bila halaman dibuka langsung `/finance/expenses`, pilihan Karyawan kosong (teknisi tidak punya hak baca karyawan dan tidak punya data karyawan). Bila begitu, catat dan buat uang muka dengan `admin`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G7. Setujui uang muka; pengaju tidak boleh menyetujui

1. Login sebagai pengaju (`admin` bila G6 dibuat `admin`): baris uang muka → **Setujui**.
2. Login `operations_manager_seed`: **Beban** → **Setujui**.

**Harus terlihat:** 1 ditolak "Langkah ini harus dilakukan pengguna lain"; 2 "Diperbarui", status **Disetujui**; tombol **Batalkan** tersedia untuk Manajer Operasional selama belum dicairkan. ❓ Di tim, Manajer Operasional dan Pemilik adalah orang yang sama (Aqim), sehingga uang muka yang diajukan Aqim tidak bisa disetujui siapa pun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G8. Cairkan uang muka (J16)

1. Login `admin`: baris uang muka → **Cairkan** → dialog Kas & Bank **BANK-UAT**, Tanggal `13/11/2026`, Nilai Rp 1.000.000 (terkunci), Referensi `TRF-UM-UAT` → **Buat draf pembayaran**.
2. Login `finance_seed`: tabel **Pembayaran karyawan** → baris draf → **Batalkan** → Alasan pembatalan `Uji batal` → simpan.
3. Ulangi langkah 1, lalu `finance_seed`: **Ajukan** → **Setujui** → **Eksekusi**.

**Harus terlihat:** "Draf pembayaran dibuat"; 2 "Pembayaran dibatalkan", status **Batal**, uang muka tetap Disetujui; 3 "Pembayaran tereksekusi — jurnal diposting", uang muka **Dicairkan**, Saldo saat ini BANK-UAT berkurang Rp 1.000.000. Pada pembayaran yang sudah tereksekusi, tombol **Batalkan tereksekusi (reversal)** bila diklik harus ditolak "Pembayaran klaim, uang muka, dan pertanggungjawaban belum bisa dibatalkan; koreksi dengan pembayaran baru" (⚠️ tombolnya tetap tampil walau pasti ditolak).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G9 ⚠️. Pertanggungjawaban uang muka (login `technician_seed`, lalu `admin`)

Baris uang muka (Dicairkan) → **Pertanggungjawabkan**. Dialog "Pertanggungjawabkan — kode" berisi "Sisa uang muka: Rp 1.000.000".

| Isian | Isi dengan |
|---|---|
| Tanggal | `14/11/2026` |
| Baris 1: Tanggal biaya | `13/11/2026` |
| Baris 1: Akun biaya *(cek pilihan)* | "Akun biaya" lalu akun beban; pilih **6-2400** |
| Baris 1: Keterangan | `Bensin dan tol` |
| Baris 1: Nilai | `800000` |
| Baris 1: PPN | `0` |

(Coba **Tambah baris** lalu **Hapus baris**.) Sebelum simpan, ubah Nilai sementara ke `1200000` → muncul "Total Rp 1.200.000 · Rp 200.000 kurang bayar ke karyawan"; kembalikan ke `800000`.

**Klik:** Simpan. Lalu **Ajukan** di tabel **Pertanggungjawaban uang muka**.

**Harus terlihat:** "Pertanggungjawaban dibuat"; baris dengan Nilai Rp 800.000, Dari uang muka Rp 800.000, Kurang bayar ke karyawan Rp 0, status **Draf** lalu **Diajukan**. ⚠️ Dugaan: pilihan Akun biaya kosong untuk semua role karena dialog meminta 200 akun sedangkan server membatasi 100 (dan teknisi tidak punya hak baca akun). Bila begitu G9–G11 tidak bisa diselesaikan; catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G10. Verifikasi dan setujui pertanggungjawaban (J17)

1. Login pengaju G9: **Verifikasi**.
2. Login `operations_manager_seed`: **Verifikasi**, lalu **Setujui**.
3. Login `admin`: **Setujui**.

**Harus terlihat:** 1 ditolak "Langkah ini harus dilakukan pengguna lain"; 2 verifikasi berhasil (status **Diverifikasi**), Setujui oleh orang yang sama ditolak "Langkah ini harus dilakukan pengguna lain"; 3 "Diperbarui", status **Disetujui**; uang muka Sudah dipertanggungjawabkan Rp 800.000. ❓ Di tim, verifikator (Manajer Operasional) dan penyetuju (Pemilik) sama-sama Aqim, jadi alur ini tidak bisa selesai tanpa orang kedua.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G11. Terima pengembalian sisa uang muka (J18)

Login `admin`: baris uang muka → **Terima pengembalian** → dialog Kas & Bank **BANK-UAT**, Tanggal `15/11/2026`, Nilai `100000` (boleh diubah, maksimal sisa), Referensi `KEMBALI-UAT` → **Buat draf pembayaran**. `finance_seed`: draf itu → **Batalkan** (alasan `Nominal salah`). Ulangi dengan Nilai `200000` → `finance_seed`: Ajukan → Setujui → Eksekusi.

**Uji salah:** Nilai `300000` (melebihi sisa Rp 200.000) → tombol Buat draf pembayaran tidak bisa diklik.

**Harus terlihat:** pembayaran Rp 200.000 Tereksekusi; uang muka **Selesai**; Saldo saat ini BANK-UAT bertambah Rp 200.000.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G12 ❓. Keuangan dan Akuntan di panel uang muka

Login `finance_seed`, lalu `accountant_seed`: buka **Beban**.

**Harus terlihat:** bagian Uang muka karyawan dan Pertanggungjawaban uang muka **tidak** tampil untuk keduanya (keduanya tidak punya hak uang muka); Keuangan hanya melihat tabel **Pembayaran karyawan** yang dibuat Pemilik. Perlu keputusan: Keuangan seharusnya ikut melihat dan mencairkan uang muka. Akuntan melihat klaim (Setujui & posting, Tolak) tetapi tidak melihat tombol Klaim baru.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## H. Aset tetap dan penyusutan (login `admin`)

Form aset tetap juga dicek di [m06-aset-peralatan.md](m06-aset-peralatan.md) bagian H dengan barang lain. Di sini fokusnya jurnal dan angka.

### H1 ⚠️. Kapitalisasi Laptop UAT (J21)

Menu **Keuangan → Keuangan → Aset tetap** → tombol **Kapitalisasi barang**. Dialog dengan keterangan "Memposting Dr aset tetap (sesuai jenis barang) / Cr akun tempat harga perolehan berada saat ini: GR/IR, persediaan, utang, kas, atau ekuitas saldo awal."

| Isian | Isi dengan |
|---|---|
| Barang *(cek pilihan)* | "—" lalu aset dengan biaya lebih dari 0, format `kode — nama (Rp nilai)`; pilih **Laptop UAT (Rp 12.000.000)** |
| Akun kredit *(cek pilihan)* | "—" lalu akun aktif yang bisa diposting; pilih **3-1000 — Modal Disetor** (laptop setoran pemilik) |
| Tanggal kapitalisasi | `18/11/2026` |
| Kelompok fiskal *(cek pilihan)* | Belum diisi, Kelompok 1 (4 tahun), Kelompok 2 (8 tahun), Kelompok 3 (16 tahun), Kelompok 4 (20 tahun), Bangunan permanen (20 tahun), Bangunan tidak permanen (10 tahun); pilih **Kelompok 1 (4 tahun)** |

**Uji salah:** Barang atau Akun kredit "—" → tombol Kapitalisasi barang tidak bisa diklik. Setelah berhasil, kapitalisasi Laptop UAT lagi → ditolak "Barang ini sudah dikapitalisasi".

**Klik:** Kapitalisasi barang.

**Harus terlihat:** "Barang dikapitalisasi"; baris Laptop UAT dengan Tanggal kapitalisasi 18/11/2026, Harga perolehan (Rp) 12.000.000, Akumulasi (Rp) 0, Nilai buku (Rp) 12.000.000, Kelompok fiskal Kelompok 1, Keadaan **Aktif**. Jurnal J21 masuk ke 1-2130 (aturan Jenis barang `it`). ⚠️ Dugaan: pilihan Akun kredit kosong karena dialog meminta 200 akun sedangkan server membatasi 100; bila begitu H1–H3 tidak bisa dikerjakan, catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2. Ubah kelompok fiskal di tabel

Baris Laptop UAT → pilihan Kelompok fiskal → **Kelompok 2 (8 tahun)** → F5 → kembalikan ke **Kelompok 1 (4 tahun)** → F5.

**Harus terlihat:** setiap pilihan tetap setelah F5 (⚠️ tidak ada pesan berhasil). Pilihan terkunci untuk aset berstatus Dilepas.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H3. Jalankan penyusutan November 2026 (J22)

Kotak Tahun `2026`, Bulan `11` → **Jalankan penyusutan**. Ulangi sekali lagi. Lalu bagian **Penyusutan fiskal (UU PPh Pasal 11)**: Tahun `2026`.

**Uji salah:** Bulan `13` atau huruf → harus ditolak dengan pesan yang dimengerti, tanpa jurnal.

**Harus terlihat:** "1 aset disusutkan, Rp 250.000" (12.000.000 ÷ 48; bila ada aset lain yang sudah dikapitalisasi, jumlahnya lebih, catat); Laptop UAT: Akumulasi (Rp) 250.000, Nilai buku (Rp) 11.750.000. Pengulangan: "0 aset disusutkan, Rp 0". Jurnal tanggal 30/11/2026 Dr 6-2500 / Cr 1-2230. Tabel fiskal Laptop UAT: Kelompok 1, Fiskal (Rp) **500.000** (25% × 12.000.000 × 2/12, November–Desember), Komersial (Rp) **250.000**, Selisih (Rp) 250.000 (tanda sesuai layar).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H4 ⚠️. Aset tetap per role

| Akun | Harus terlihat |
|---|---|
| `accountant_seed` | ⚠️ menu tidak tampil dan halaman `/finance/fixed-assets` gagal memuat daftar, padahal server mengizinkan Akuntan kapitalisasi dan menjalankan penyusutan |
| `finance_seed` | menu tidak tampil |
| `auditor_seed` | daftar dan tabel fiskal tampil; Tahun/Bulan, Jalankan penyusutan, Kapitalisasi barang tidak tampil; pilihan Kelompok fiskal terkunci |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## I. Jurnal manual dan saldo awal

### I1. Buat jurnal manual (semua kolom, login `accountant_seed`)

Menu **Keuangan → Keuangan → Jurnal** → tombol **Entri manual baru**. Tertulis "Jurnal manual baru diposting setelah disetujui oleh orang selain pembuatnya."

| Isian | Isi dengan |
|---|---|
| Tanggal entri | `05/11/2026` |
| Deskripsi | `Akrual perlengkapan kantor UAT` |
| Jurnal penyesuaian | tidak dicentang (bila dicentang muncul "Hanya jurnal penyesuaian yang bisa masuk ke periode yang ditutup sementara.") |
| Baris 1: Akun *(cek pilihan)* | "Akun" lalu akun aktif yang bisa diposting; pilih **6-2300 — Beban Perlengkapan Kantor** |
| Baris 1: Pusat biaya *(cek pilihan)* | "Pusat biaya" lalu pusat biaya; pilih **CC-UAT — Pusat Biaya UAT** |
| Baris 1: Debit | `750000` |
| Baris 2: Akun | **2-1800 — Biaya Masih Harus Dibayar** |
| Baris 2: Pusat biaya | kosong |
| Baris 2: Kredit | `750000` |

**Uji salah** (sebelum simpan):

- Baris 2 Kredit `700000` → lencana merah "Debit harus sama dengan kredit." dan **Simpan draf** tidak bisa diklik; kembalikan ke `750000`.
- Ketik Debit lalu Kredit di baris yang sama → yang pertama terhapus (petunjuk "Setiap baris hanya salah satu: debit atau kredit.").
- Ikon hapus tidak bisa diklik bila hanya ada 2 baris; **Tambah baris** menambah baris ketiga, lalu hapus lagi.

**Klik:** Simpan draf.

**Harus terlihat:** Total debit 750.000, Total kredit 750.000, lencana **Seimbang**; setelah simpan "Draf tersimpan. Ajukan untuk persetujuan."; baris baru Kode "Belum diposting", Tanggal entri 05/11/2026, Deskripsi, Nilai Rp 750.000, status **Draf**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I2. Ajukan; pembuat tidak boleh menyetujui

Baris jurnal I1 → Aksi → **Ajukan persetujuan**. Lalu (masih `accountant_seed`) → **Setujui dan posting** → konfirmasi.

**Harus terlihat:** "Jurnal diajukan untuk persetujuan", status **Menunggu persetujuan**; persetujuan oleh pembuat ditolak "Pembuat jurnal tidak boleh menyetujui jurnalnya sendiri"; status tetap Menunggu persetujuan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I3. Pemilik menolak, lalu menyetujui (J4)

1. Login `admin`: baris jurnal → **Tolak** → dialog "Kembalikan jurnal ke draf", Alasan kosong → tidak bisa dikirim ("Alasan wajib diisi."); isi `Lampirkan nota` → Tolak.
2. Login `accountant_seed`: **Ajukan persetujuan** lagi.
3. Login `admin`: **Setujui dan posting** → konfirmasi "Setujui dan posting jurnal ini? Jurnal yang sudah diposting hanya bisa dikoreksi dengan jurnal pembalik." → ya.

**Harus terlihat:** "Jurnal dikembalikan ke draf" (status Draf); "Jurnal diajukan untuk persetujuan"; "Jurnal disetujui dan diposting", status **Diposting**, Kode sekarang bernomor. Aksi Ubah/Buang tidak tersedia lagi; yang tersisa hanya **Reversal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I4. Jurnal salah dan reversal (J5)

1. `accountant_seed`: **Entri manual baru** Tanggal `05/11/2026`, Deskripsi `Jurnal salah UAT`, Dr 6-2900 `100000` / Cr 2-1800 `100000` → Simpan draf → Ajukan persetujuan.
2. `admin`: Setujui dan posting.
3. `accountant_seed`: baris itu → **Reversal** → dialog "Balik jurnal yang sudah diposting" dengan keterangan "Jurnal cermin akan diposting. Jika periode jurnal asal sudah ditutup, jurnal pembalik masuk ke periode terbuka berikutnya." → Alasan `Salah akun` → Reversal.
4. Coba **Reversal** lagi pada jurnal yang sama.

**Harus terlihat:** "Reversal diposting"; jurnal asal berstatus **Dibalik**; jurnal baru (cermin, Dr 2-1800 / Cr 6-2900 Rp 100.000) berstatus Diposting dengan tanggal 05/11/2026; langkah 4 tidak ada aksi Reversal (atau ditolak "Entri jurnal sudah pernah dibalik").

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I5. Buang draf jurnal

`accountant_seed`: **Entri manual baru** Dr 6-2900 `10000` / Cr 2-1800 `10000`, Deskripsi `Draf dibuang UAT` → Simpan draf → **Buang** → konfirmasi "Buang jurnal ini? Jurnal tidak akan masuk ke buku besar." → ya.

**Harus terlihat:** "Jurnal dibuang"; status **Dibuang**; tidak ada nomor jurnal; filter status *(cek pilihan: Semua status, Draf, Menunggu persetujuan, Disetujui, Diposting, Dibalik, Dibuang)* → Dibuang menampilkan baris ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I6 ⚠️. Jurnal otomatis dari transaksi

`accountant_seed`: **Jurnal** → filter **Diposting**. Cari jurnal J1–J23 dari tabel di atas (Sumber, Tanggal entri, Nilai).

**Harus terlihat:** setiap transaksi C–H punya satu jurnal Diposting dengan Nilai sama dengan tabel (misalnya J1 Rp 50.000.000, J6 Rp 11.100.000, J13 Rp 3.996.000, J19 Rp 1.000.000); tagihan draf yang dibatalkan, nota kredit yang dibatalkan, dan pembayaran yang dibatalkan tidak punya jurnal. ⚠️ Halaman Jurnal tidak punya detail baris (akun debit/kredit tidak bisa dilihat dari sini); baris jurnal diperiksa lewat **Laporan Keuangan → Buku Besar** (file laporan B3–B4). Rencana M09 meminta laporan bisa ditelusuri sampai baris jurnal.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I7. Akun yang sudah dipakai terkunci (login `accountant_seed`)

**Daftar Akun** → baris `1-1140`:

1. **Ubah akun** → hilangkan centang **Bisa diposting** → Simpan.
2. **Nonaktifkan**.
3. **Arsipkan**.

**Harus terlihat:** 1 ditolak "Akun sudah memiliki posting: tipe, saldo normal, dan status dapat-diposting tidak bisa diubah"; 2 ditolak "Hanya akun bersaldo nol yang dapat dinonaktifkan"; 3 ditolak (akun dengan riwayat jurnal tidak dapat diarsipkan). Akun tetap Aktif.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I8 ❓. Saldo awal (tanpa posting, login `accountant_seed`)

Menu **Keuangan → Keuangan → Saldo Awal**. Keterangan "Isi baris draf bebas, lalu posting seluruh batch sebagai SATU entri jurnal. Batch yang sudah diposting tidak dapat diubah."

Cek dulu: bila tabel sudah berisi baris berkeadaan **Diposting**, saldo awal organisasi sudah diposting; kerjakan hanya poin 4. Bila belum:

| Isian | Isi dengan |
|---|---|
| Akun *(cek pilihan)* | akun aktif yang bisa diposting; pilih **1-1110 — Kas Kecil** |
| Tanggal per | `31/10/2026` |
| Saldo debit | `100000` |
| Saldo kredit | kosong |

1. **Tambah baris** → "Baris saldo awal ditambahkan".
2. Total debit 100.000, Total kredit 0, lencana merah "Total debit harus sama dengan total kredit sebelum posting." → tombol **Posting batch sebagai entri jurnal** tidak bisa diklik.
3. Baris itu → **Hapus** → konfirmasi "Hapus baris draf ini?" → "Baris dihapus". **Jangan memposting batch** (memposting mengubah angka laporan dan tidak bisa dibatalkan).
4. Bila sudah ada batch Diposting: tambah baris baru → ditolak "Saldo awal sudah pernah diposting dan tidak dapat diubah; lakukan koreksi melalui pembalikan jurnal".

**Harus terlihat:** seperti poin 1–4; ❓ catat apakah dev database sudah punya saldo awal yang diposting.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I9. Rincian piutang dan utang saldo awal (impor salah)

Masih di **Saldo Awal**, kartu **Rincian piutang dan utang** (tabel Buku pembantu: Piutang usaha / Utang usaha, Item, Total rincian (Rp), Baris akun kontrol (Rp), Kecocokan). Klik **Template** (file CSV terunduh). Buat file `rincian-salah.csv` dari template berisi 3 baris: kode pelanggan `TIDAK-ADA`; tanggal `2026/13/40`; nomor dokumen yang sama dua kali. Klik **Impor CSV** → pilih file itu.

**Harus terlihat:** "Tidak ada yang diimpor. Perbaiki baris berikut lalu unggah ulang:" lalu daftar "Baris n:" dengan alasan "kode pelanggan atau pemasok tidak dikenal", "tanggal dokumen tidak valid (pakai YYYY-MM-DD)", "nomor dokumen muncul dua kali"; tidak ada item baru. Catatan "Rincian saldo awal persediaan dan aset tetap belum dicakup…" tampil. ❓ Catatan itu masih menyebut "register aset hadir di Fase C" padahal aset tetap sudah ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I10. Jurnal per role

| Akun | Harus terlihat |
|---|---|
| `auditor_seed` | **Jurnal** dan **Saldo Awal** tampil; tidak ada Entri manual baru, Tambah baris, Posting batch, atau aksi apa pun |
| `admin` | bisa membuat, menyetujui, menolak, membalik |
| `finance_seed` | menu Jurnal dan Saldo Awal tidak tampil (A1) |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## J. Rekonsiliasi bank (login `finance_seed`)

Kerjakan setelah semua transaksi BANK-UAT di C, G selesai. Saldo saat ini BANK-UAT saat mulai bagian ini harus **Rp 48.295.000**.

### J1. Buka rekonsiliasi baru

Menu **Keuangan → Keuangan → Rekonsiliasi**. Keterangan "Baris rekening koran dicocokkan dengan buku kas; rekonsiliasi menuntut semua item cocok dan rekening koran = buku secara persis."

| Isian | Isi dengan |
|---|---|
| Akun kas/bank *(cek pilihan)* | "Akun kas/bank" lalu akun kas/bank; pilih **BANK-UAT — Bank UAT** |
| Tanggal | `30/11/2026` |
| Saldo rekening koran | `48280000` |

**Uji salah:** Akun kas/bank atau Saldo rekening koran kosong → tombol Rekonsiliasi baru tidak bisa diklik.

**Klik:** Rekonsiliasi baru.

**Harus terlihat:** "Rekonsiliasi dibuka (draf)"; baris dengan Kode, Tanggal, Saldo rekening koran Rp 48.280.000, Saldo buku Rp 48.295.000, Selisih Rp −15.000 (atau 15.000), status **Draf**. Klik **Item rekening koran** di baris itu → bagian "Item rekening koran — kode" terbuka, kosong, dengan tulisan "Atur pemetaan CSV sebelum mengimpor." dan tombol Impor rekening koran tidak bisa diklik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J2. Pemetaan CSV rekening koran (semua kolom)

Tombol **Pemetaan CSV rekening koran**. Dialog dengan keterangan "Jelaskan format ekspor CSV bank sekali per rekening. Kolom dihitung mulai 1."

| Isian | Isi dengan |
|---|---|
| Pemisah *(cek pilihan)* | `,` / `;` / Tab; pilih **;** |
| Baris dilewati | `1` |
| Kolom tanggal | `1` |
| Format tanggal *(cek pilihan)* | YYYY-MM-DD / DD/MM/YYYY / DD-MM-YYYY / DD/MM/YY / DD/MM; pilih **DD/MM/YYYY** |
| Kolom keterangan | `2` |
| Kolom referensi | `3` (kosong = "tidak ada") |
| Bentuk nominal *(cek pilihan)* | Satu kolom, negatif = keluar / Kolom debet dan kredit / Nominal + kolom DB/CR; coba pilih **Kolom debet dan kredit** → muncul Kolom debet (keluar) dan Kolom kredit (masuk); pilih **Nominal + kolom DB/CR** → muncul Kolom DB/CR dan Teks penanda kredit (masuk); akhirnya pilih **Satu kolom, negatif = keluar** |
| Pemisah desimal *(cek pilihan)* | `,` / `.`; pilih **,** |
| Kolom nominal | `4` |

**Klik:** Simpan.

**Harus terlihat:** "Pemetaan rekening koran disimpan"; tombol Impor rekening koran sekarang bisa diklik. Buka dialog lagi → semua isian tersimpan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J3. Impor rekening koran

Siapkan file `koran-uat.csv` (teks biasa, pemisah titik koma):

```text
Tanggal;Keterangan;Referensi;Nominal
02/11/2026;Setoran modal UAT;UAT-01;50000000
03/11/2026;Sewa gudang UAT;UAT-02;-1500000
04/11/2026;Bunga bank UAT;UAT-03;250000
12/11/2026;Bayar klaim UAT;UAT-04;-500000
13/11/2026;Uang muka UAT;UAT-05;-1000000
15/11/2026;Pengembalian uang muka;UAT-06;200000
16/11/2026;Settlement gateway;UAT-07;995000
17/11/2026;Setor PPh 21;UAT-08;-150000
30/11/2026;Biaya administrasi bank;UAT-09;-15000
```

dan `koran-salah.csv` yang sama tetapi baris ketiga nominalnya `dua ratus`.

1. **Impor rekening koran** → pilih `koran-salah.csv`.
2. **Impor rekening koran** → pilih `koran-uat.csv`.
3. Impor `koran-uat.csv` sekali lagi.

**Harus terlihat:** 1 "Tidak ada yang diimpor: nominal tak terbaca di baris 3" (nomor baris sesuai file); 2 "9 baris diimpor, 0 sudah ada" dan 9 item dengan tanggal, referensi, keterangan, tanda + / −, nominal, lencana **Belum cocok**; status rekonsiliasi **Berlangsung**; 3 "0 baris diimpor, 9 sudah ada".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J4. Cocokkan otomatis dan manual

1. **Cocokkan otomatis**.
2. Untuk item yang masih Belum cocok selain UAT-09: pilihan **Cocokkan ke transaksi kas** → pilih transaksi BANK-UAT dengan tanggal dan nominal yang sama.

**Harus terlihat:** 1 "… baris cocok, … tersisa" (harapan: 8 cocok, 1 tersisa, yaitu UAT-09 karena belum ada di buku); item cocok berlencana **Cocok** dengan keterangan "otomatis"; 2 "Item dicocokkan" dengan keterangan "manual". Pilihan Cocokkan ke transaksi kas hanya berisi transaksi BANK-UAT.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J5 ⚠️. Catat biaya administrasi dari rekening koran (J23)

Item UAT-09 (−15.000) → pilihan **Catat sebagai transaksi dengan akun…** → pilih **8-1000 — Beban Administrasi Bank**.

**Harus terlihat:** "Baris rekening koran dicatat dan dicocokkan"; item **Cocok** dengan keterangan "dicatat"; Saldo buku menjadi Rp 48.280.000, Selisih Rp 0; di **Kas & Bank** ada transaksi Keluar Rp 15.000 tanggal 30/11/2026 dan Saldo saat ini BANK-UAT **Rp 48.280.000**. ⚠️ Dugaan: pilihan akun kosong untuk semua role karena halaman meminta 200 akun sedangkan server membatasi 100 (dan Keuangan tidak bisa membaca daftar akun). Bila begitu, catat, lalu buat transaksi Keluar Rp 15.000 ke 8-1000 di **Kas & Bank** (login `admin`) dan cocokkan manual.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J6. Tandai terekonsiliasi dan tutup

1. Sebelum J5 selesai (masih ada item Belum cocok), klik **Tandai terekonsiliasi** (boleh dicoba lebih awal, setelah J3).
2. Setelah semua cocok dan Selisih 0: **Tandai terekonsiliasi**.
3. **Tutup (permanen)**.

**Harus terlihat:** 1 ditolak "Tindakan rekonsiliasi tersebut tidak diizinkan untuk dokumen ini" (atau pesan setara bahwa masih ada selisih); 2 "Rekonsiliasi ditandai terekonsiliasi", status **Terekonsiliasi**; 3 "Rekonsiliasi ditutup", status **Ditutup**, tombol impor/cocokkan/tambah item hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J7. Item manual di rekonsiliasi lain

**Rekonsiliasi baru**: Akun kas/bank **BANK-BCA**, Tanggal `30/11/2026`, Saldo rekening koran `6000000` → buka itemnya → isi **Referensi koran** `TRF-UAT-FIN-01`, **Jumlah koran** `6000000` → **Tambah item koran** → pilihan **Cocokkan ke transaksi kas** → pilih transaksi Rp 6.000.000 tanggal 10/11/2026 (dari kuitansi D3) bila ada.

**Harus terlihat:** "Item rekening koran ditambahkan"; item tanpa tanda +/−; ❓ pilihan **Catat sebagai transaksi dengan akun…** tidak muncul untuk item manual (tidak ada arah). Bila kuitansi D3 tidak membuat transaksi kas di BANK-BCA, catat (kuitansi hanya memposting jurnal). Biarkan rekonsiliasi ini tetap Berlangsung (akan muncul di checklist tutup periode November, bukan Oktober).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J8. Rekonsiliasi per role

| Akun | Harus terlihat |
|---|---|
| `accountant_seed` | menu Rekonsiliasi tampil; bisa membuka, mengimpor, mencocokkan, menandai, menutup |
| `auditor_seed` | menu tidak tampil (A3); buka langsung `/finance/reconciliation` → daftar tampil tanpa form Rekonsiliasi baru dan tanpa tombol apa pun |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## K. Penutupan periode Oktober 2026 (login `accountant_seed`, lalu `admin`)

Bagian ini mengunci Oktober 2026 sementara. Beri tahu penguji lain sebelum mulai, dan buka kembali di K7.

### K1 ⚠️. Checklist pra-penutupan dan siapkan periode

Menu **Keuangan → Keuangan → Tutup Periode**. Keterangan "Checklist pra-penutupan bersifat advisory, lalu tutup dan kunci periode. Membuka kembali periode terkunci khusus owner dan terekam audit." Kartu **Checklist pra-penutupan**: Tahun `2026`, Bulan `10` → **Terapkan**. Lalu **Siapkan periode**.

**Harus terlihat:** lencana "Semua beres — aman untuk ditutup" atau "Masih ada item terbuka sebelum tutup", dengan daftar item bertanda centang/silang dan angka di kanan. ⚠️ Label item tampil dalam bahasa Inggris (misalnya "Draft invoices in range must be issued or voided"). ⚠️ **Siapkan periode** kemungkinan ditolak (tidak berhak) untuk semua role karena server meminta hak "buat periode" yang tidak dimiliki role mana pun; catat pesannya. Tabel periode di bawah berisi baris Oktober 2026 (kode, Rentang 2026-10-01 → 2026-10-31, Keadaan **Terbuka**) bila periode sudah dibuat otomatis oleh posting.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K2 ❓. Amortisasi pendapatan diterima dimuka dan tutup PPN masa (Oktober)

Masih Tahun `2026` Bulan `10`: klik **Amortisasi pendapatan diterima dimuka**, lalu **Tutup PPN masa**.

**Harus terlihat:** "{jumlah} jurnal diposting, {nilai} diakui" (boleh 0 jurnal, Rp 0); "PPN ditutup: keluaran …, masukan …, neto …". **Catat angka keduanya di kolom Catatan**: bila tidak nol, jurnalnya ikut mengubah angka laporan (lihat file laporan bagian A). Detail PPN masa ada di [m10-pajak.md](m10-pajak.md).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K3. Tutup Oktober; hanya jurnal penyesuaian yang boleh masuk (J24 bagian 1)

1. Baris Oktober 2026 → Aksi → **Tutup**.
2. **Jurnal → Entri manual baru**: Tanggal entri `31/10/2026`, Deskripsi `Jurnal biasa ke periode ditutup`, Jurnal penyesuaian **tidak** dicentang, Dr 6-2900 `50000` / Cr 2-1800 `50000` → Simpan draf → Ajukan persetujuan → `admin`: Setujui dan posting.
3. Ulangi dengan Deskripsi `Penyesuaian Oktober UAT` dan **Jurnal penyesuaian dicentang** → Simpan draf → Ajukan → `admin`: Setujui dan posting.

**Harus terlihat:** 1 "Status periode diperbarui", Keadaan **Ditutup**; 2 ditolak (paling lambat saat disetujui) "Periode akuntansi untuk tanggal ini sudah ditutup"; jurnal itu kemudian **Buang**; 3 berhasil, status **Diposting** dengan lencana "Jurnal penyesuaian".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K4. Kunci Oktober

1. `accountant_seed`: buat draf jurnal penyesuaian tanggal `31/10/2026` (Dr 6-2900 `1000` / Cr 2-1800 `1000`), jangan diajukan.
2. Baris Oktober → **Kunci**.
3. Buang draf langkah 1 → **Kunci** lagi.
4. Buat jurnal penyesuaian baru tanggal `31/10/2026` → Ajukan → `admin`: Setujui dan posting.

**Harus terlihat:** 2 ditolak "Periode masih memiliki jurnal yang belum diposting; posting atau batalkan sebelum dikunci"; 3 "Status periode diperbarui", Keadaan **Terkunci**; 4 ditolak "Periode akuntansi untuk tanggal ini sudah ditutup" (buang jurnal itu).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K5. Reversal jurnal dari periode terkunci (J24 bagian 2)

`accountant_seed`: **Jurnal** → jurnal "Penyesuaian Oktober UAT" (K3) → **Reversal** → Alasan `Uji pembalik periode terkunci`.

**Harus terlihat:** "Reversal diposting"; jurnal pembalik bertanggal **01/11/2026** (hari pertama periode terbuka berikutnya), bukan 31/10/2026; jurnal asal berstatus **Dibalik**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K6. Arsipkan laporan Oktober

Menu **Laporan → Laporan → Arsip Bulanan**. Isi Tahun `2026`, Bulan `10` → **Arsipkan bulan**. Klik lagi.

**Uji salah:** Tahun `2026`, Bulan `11` (masih terbuka) → **Arsipkan bulan** → ditolak "Periode masih terbuka; tutup dulu sebelum mengarsipkan".

**Harus terlihat:** "… laporan diarsipkan untuk 2026-10" (laba rugi, neraca, arus kas, dan paket manajemen); klik kedua "Bulan itu sudah diarsipkan". Baris arsip menampilkan Diarsipkan pada, Laba bersih, Total aset, Perubahan bersih kas. Angkanya dicek di file laporan K1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K7 ⚠️. Buka kembali periode

1. `accountant_seed`: baris Oktober (Terkunci) → cari aksi **Buka kembali** → klik.
2. `admin`: **Buka kembali**.

**Harus terlihat:** 1 seharusnya aksi tidak tampil atau ditolak, karena membuka kembali khusus Pemilik; ⚠️ dugaan: aksinya tampil untuk Akuntan (hak "buka kembali" diberikan ke Akuntan di daftar hak, padahal komentar di server menyatakan sebaliknya) dan ditolak server. 2 "Status periode diperbarui", Keadaan **Terbuka**. Bila tersedia, cek di **Administrasi → Log audit** ada catatan perubahan status periode oleh `admin`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K8. Tutup Periode per role

| Akun | Harus terlihat |
|---|---|
| `finance_seed` | menu tidak tampil; `/finance/closing` kosong |
| `auditor_seed` | menu tidak tampil ❓ (auditor punya hak baca periode tetapi menu butuh hak tutup) |
| `admin` | menu tampil, semua aksi tersedia |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 82 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M09 transaksi:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

Disusun dari kode pada 2026-11-26; semua ⚠️ adalah dugaan dari pembacaan kode, belum dilihat di layar.

**Hal yang kemungkinan menghalangi uji (perlu dicek dulu):**

1. **Daftar akun dibatasi 100 baris di server, tetapi 4 layar meminta lebih.** `apps/backend/src/app/finance/contracts/ledger.contract.ts:50` (`limit ... max(100)`), sedangkan `apps/web-admin/src/components/finance/reconciliation-page.tsx:85` (200), `fixed-assets-page.tsx:180` (200), `advances-panel.tsx:341` (200), `project-budgets-page.tsx:41` (300). Akibatnya pilihan akun di J5, H1, G9, F1 diduga kosong untuk semua role. Daftar akun seeder sudah sekitar 98 baris, jadi layar yang memakai batas 100 (`cash-bank-page.tsx:104`, `account-form-dialog`) juga bisa terpotong setelah UAT menambah akun.
2. **Keuangan tidak punya hak baca Daftar Akun dan Jurnal** (`packages/common/src/authorization/erp-permissions.ts:746-784`), padahal form Keuangan memuat daftar akun dari `/finance/ledger/accounts` (`chart_of_account:read`, `docs/role-permission.md:847`): Akun GL di `cash-bank-form-dialog.tsx:108`, Akun lawan di `cash-bank-page.tsx:104`, Akun beban di `expense-form-dialog.tsx:106`. Langkah C1, C3, G1 diduga gagal untuk `finance_seed`.
3. **Tidak ada layar untuk membuat pembayaran pemasok** (E4). `createPayment` hanya dipanggil di `apps/web-admin/src/components/finance/employee-payment-dialog.tsx:54`; halaman Utang (`payables-page.tsx:33-36`) hanya menampilkan tabel. Backend sudah mendukung alokasi ke tagihan dan potongan PPh (`apps/backend/src/app/payment/contracts/payment.contract.ts:24-47`).
4. **Siapkan periode memakai hak yang tidak ada.** `apps/backend/src/app/finance/controllers/ledger.controller.ts:191` meminta `accounting_period:create`, sedangkan kosakata hak hanya `read`, `close`, `reopen` (`erp-permissions.ts:120`); `docs/role-permission.md:873` mencatat "no org role".
5. **Akuntan tidak punya hak baca aset dan proyek** (`erp-permissions.ts:786-813`), padahal server mengizinkan Akuntan kapitalisasi/penyusutan (`journal:post`, `docs/role-permission.md:842-844`) dan menyimpan anggaran (`journal:approve`, `:879-884`). Menu Aset tetap dan Anggaran proyek memakai `asset.read`/`project.read` (`apps/web-admin/src/components/sidebar/nav-config.ts:192-199`), dan daftar aset tetap `GET /finance/fixed-assets` butuh `asset:read` (`docs/role-permission.md:841`). Hanya Pemilik yang bisa memakai kedua halaman itu.
6. **Uang muka hanya bisa dicairkan Pemilik.** Panel uang muka butuh `advance.read` (`advances-panel.tsx:58-69`); Keuangan dan Akuntan tidak punya hak `advance`/`settlement`. Teknisi bisa mengajukan, tetapi tidak punya `employee:read` untuk pemilih karyawan (`docs/role-permission.md:971`) dan seeder HR tidak membuat data karyawan untuk teknisi (`apps/backend/database/seeders/seed/hr.seeder.ts:21-28`).

**Perbedaan rencana dan kode:**

- Rencana M09 (Controls) meminta laporan bisa ditelusuri sampai baris jurnal; halaman Jurnal tidak punya detail baris (`journal-page.tsx`), hanya lewat Buku Besar per akun.
- Pembayaran tidak punya pembuat ≠ penyetuju: `apps/backend/src/app/payment/services/payment.service.ts:150-155` hanya mencatat `approvedBy`. Komentar di `employee-payment-dialog.tsx` menyebut "maker-checker on payments is unchanged".
- Klaim biaya tidak memeriksa penyetuju ≠ pengaju: `apps/backend/src/app/finance/services/expense-claim.service.ts:291` (bandingkan jurnal manual `manual-journal.service.ts:133` dan penghapusan piutang `receivable-adjustment.service.ts:205`).
- Penghapusan piutang mendebit cadangan kerugian piutang walau cadangan belum dibentuk (`receivable-adjustment.service.ts:220`), sehingga tidak ada beban di laba rugi dan akun 1-1390 bersaldo debit.
- Tagihan pemasok manual tidak punya pilihan akun beban (`bills-table.tsx`, form Tagihan baru), selalu ke peran Beban bawaan 6-2900.
- Daftar peran dan transaksi aturan posting di web (`apps/web-admin/src/lib/finance-api.ts:370-433`) tertinggal dari backend (`apps/backend/src/app/finance/constants/posting-roles.ts`): `employee_advance`, `disposal_receivable`, `asset_disposal_gain`, `asset_disposal_loss`, `finance.advance_settled`, `finance.asset_capitalized`, `finance.asset_depreciated`, `finance.asset_disposed` tidak ada, dan label Indonesianya juga tidak ada di `packages/locales/src/id/finance.ts`.
- Label checklist tutup periode ditulis langsung dalam bahasa Inggris di `apps/backend/src/app/finance/services/month-end-close.service.ts:130-156` (melanggar aturan teks wajib en + id).
- Hak buka kembali: `erp-permissions.ts:792` memberi Akuntan `accounting_period: ['read', 'close', 'reopen']`, sedangkan komentar di `ledger.controller.ts:210-213` menyatakan `reopen` tidak diberikan ke Akuntan; tombol tampil karena `closing-page.tsx:50`.
- Pesan anggaran terlampaui membagi angka dengan 100 tanpa format ribuan (`apps/backend/src/app/finance/services/project-budget.service.ts:164`).
- Tim nyata: Aqim memegang Pemilik, Keuangan, dan Manajer Operasional, sehingga persetujuan uang muka dan verifikasi + persetujuan pertanggungjawaban (`employee-advance.service.ts:126, 217, 235`) tidak bisa diselesaikan tanpa orang kedua.
- Halaman induk Keuangan masih "Segera hadir" (`apps/web-admin/src/routes/_authed/finance/index.tsx`).
- Judul halaman "Bagan Akun" berbeda dengan menu "Daftar Akun"; akun nonaktif berlabel "Diarsipkan" (`account-list.tsx:196-197`); pesan simpan uang muka "Uang muka diajukan" padahal status Draf (`advances-panel.tsx:273`); label kolom form bayar gaji masih "Utang pajak" (`tax-payment-dialog.tsx`).
- Folder ini belum punya hasil uji; semua angka di tabel jurnal adalah harapan dari aturan posting seeder (`apps/backend/database/seeders/seed/chart-of-accounts.seeder.ts:79-183` untuk akun, `apps/backend/src/app/finance/constants/posting-roles.ts` untuk akun bawaan per peran).
