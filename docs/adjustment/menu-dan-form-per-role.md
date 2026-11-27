# Menu dan form per role

Disusun 2026-11-27. Kembali ke [catatan penyesuaian](README.md).

Dokumen ini menjawab dua pertanyaan:
1. **Menu apa yang tampil untuk setiap role** (dan setiap orang).
2. **Form apa saja yang ada**, isiannya apa, dan siapa yang mengisinya.

**Sumber dan status:**
- Menu dihitung langsung dari kode: daftar menu
  `apps/web-admin/src/components/sidebar/nav-config.ts`, aturan tampil
  `filter-nav.ts`, dan hak role `packages/common/src/authorization/erp-permissions.ts`.
- Kolom "sesudah" menerapkan keputusan yang **disetujui Pemilik pada rapat
  27/11** (K2, K2b, K2d, K10, K12 tahap 1, B4, OB5). **Belum dikodekan**: ini
  gambaran target.
- Daftar form diambil dari kode web-admin, portal karyawan (`apps/web-employee`),
  dan portal pelanggan (`apps/web-customer-portal`).
- Usulan baru di bagian 3 dan 6 (kode **MN** dan **FR**) **belum diputuskan**.

---

## 1. Role yang dipakai (sesudah keputusan)

| Role (label di aplikasi) | Nama di kode | Dipegang oleh |
|---|---|---|
| Pemilik | `owner` | Aqim (juga **admin aplikasi**) |
| SDM | `hr` | Aqim |
| Penjualan (gabungan, K2b) | `sales_manager` | Agus MD, Bilal |
| Gudang | `warehouse` | Bilal, Agus |
| Layanan Pelanggan | `customer_service` | Bilal |
| Pemasaran | `marketing` | Bilal |
| Manajer Proyek | `project_manager` | Agus, Jamil, Hatta |
| Teknisi | `technician` | Agus, Jamil, Fahri, Alex, Ade |
| Keuangan (gabungan Keuangan + Akuntan, K2d) | `finance` | Bella |
| Pekerja Lepas | `freelancer` | Dafrin, Oki |

Role yang ada di kode tetapi **tidak diberikan**: Manajer Operasional,
Pembelian, dan Penjualan biasa (`sales`). Role Admin, Anggota, dan Auditor
**dihapus**.

Satu orang boleh memegang beberapa role (D2). Menu yang ia lihat adalah
**gabungan** menu semua rolenya.

---

## 2. Menu per role (web-admin, sesudah keputusan)

Keterangan:
- ✓ = menu tampil.
- **A** = hanya untuk admin aplikasi, yaitu Aqim. Tidak bergantung pada role.
- **PIC** = hanya untuk admin aplikasi atau orang yang ditunjuk sebagai
  penanggung jawab gudang. Bilal dan Agus **harus ditunjuk dulu** di
  Gudang → Penanggung jawab, kalau tidak menu Gudang tidak muncul untuk mereka.
- Menu **Organisasi** sudah tidak ada di tabel karena disembunyikan (K12 tahap 1).

| Menu | Pemilik | SDM | Penjualan | Gudang | Lay. Pelanggan | Pemasaran | Man. Proyek | Teknisi | Keuangan | Pek. Lepas |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Dasbor** | | | | | | | | | | |
| Dasbor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **CRM & Penjualan** | | | | | | | | | | |
| CRM → Prospek | ✓ |  | ✓ |  |  |  |  |  |  |  |
| CRM → Pelanggan | ✓ |  | ✓ |  | ✓ | ✓ | ✓ |  |  |  |
| Penjualan → SPH | ✓ |  | ✓ |  |  |  |  |  | ✓ |  |
| Penjualan → Sales order | ✓ |  | ✓ | ✓ |  |  |  |  | ✓ |  |
| Penjualan → Surat Jalan | ✓ |  | ✓ | ✓ |  |  |  |  | ✓ |  |
| Penjualan → Retur Penjualan | ✓ |  | ✓ | ✓ |  |  |  |  | ✓ |  |
| Penjualan → Faktur | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Penjualan → Uang Muka | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Penjualan → Kuitansi | ✓ |  |  |  |  |  |  |  | ✓ |  |
| **Keuangan** | | | | | | | | | | |
| Keuangan → Kas & Bank | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Saldo Awal | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Daftar Akun | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Jurnal | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Aturan Posting | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Pusat Biaya | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Anggaran proyek | ✓ |  |  |  | ✓ |  | ✓ | ✓ | ✓ |  |
| Keuangan → Aset tetap | ✓ |  |  |  |  |  | ✓ |  | ✓ |  |
| Keuangan → Rekonsiliasi | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Piutang | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Utang | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Beban | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Laporan Keuangan | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Keuangan → Tutup Periode | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Jenis & Tarif Pajak | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Catatan Pajak | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Rekap Pajak | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Pemotongan Pajak | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Tabel PPh 21 | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pajak → Koreksi & Bukti | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Bonus & Investor → Data Investor | ✓ |  |  |  |  |  |  |  |  |  |
| Bonus & Investor → Bagi Hasil | ✓ |  |  |  |  |  |  |  |  |  |
| **Proyek** | | | | | | | | | | |
| Proyek | ✓ |  |  |  | ✓ |  | ✓ | ✓ | ✓ |  |
| Tiket | ✓ |  |  |  | ✓ |  | ✓ | ✓ |  |  |
| Garansi | ✓ |  |  |  | ✓ |  | ✓ | ✓ | ✓ |  |
| Langganan & Lisensi → Kontrak lisensi | ✓ |  | ✓ |  | ✓ |  |  |  | ✓ |  |
| Langganan & Lisensi → Aplikasi | ✓ |  | ✓ |  | ✓ |  |  |  | ✓ |  |
| Langganan & Lisensi → Kunci API | ✓ |  | ✓ |  |  |  |  |  |  |  |
| Langganan & Lisensi → Validasi & Aktivasi | ✓ |  | ✓ |  | ✓ |  |  |  | ✓ |  |
| **Inventaris** | | | | | | | | | | |
| Gudang | PIC | PIC | PIC | PIC | PIC | PIC | PIC | PIC | PIC | PIC |
| Nilai Persediaan | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Produk | ✓ |  | ✓ | ✓ |  | ✓ |  |  | ✓ |  |
| Barang → Komponen | ✓ |  | ✓ | ✓ |  | ✓ |  |  | ✓ |  |
| Barang → Material | ✓ |  | ✓ | ✓ |  | ✓ |  |  | ✓ |  |
| Barang → Stok | ✓ |  |  | ✓ |  |  |  |  | ✓ |  |
| Barang → Penyesuaian Stok | ✓ |  |  | ✓ |  |  |  |  |  |  |
| Barang → Kategori barang | ✓ |  | ✓ | ✓ |  | ✓ |  |  | ✓ |  |
| Barang → Mutasi Barang | ✓ |  |  | ✓ |  |  |  |  | ✓ |  |
| Aset & Peralatan → Register Aset | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Peminjaman | ✓ |  | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |  |
| Aset & Peralatan → Catatan Servis | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Kategori Aset | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Set Peralatan | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Penghapusan Aset | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Penyusutan | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Pengadaan → Pemasok | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pengadaan → Permintaan Pembelian | ✓ |  |  |  |  |  | ✓ | ✓ |  |  |
| Pengadaan → Pesanan Pembelian | ✓ |  |  | ✓ |  |  |  |  |  |  |
| Pengadaan → Penerimaan Barang | ✓ |  |  | ✓ |  |  |  |  | ✓ |  |
| Pengadaan → Retur Pembelian | ✓ |  |  | ✓ |  |  |  |  |  |  |
| **Sumber Daya Manusia** | | | | | | | | | | |
| Karyawan | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |
| Tugas | ✓ | ✓ |  |  |  |  | ✓ | ✓ |  | ✓ |
| Jadwal Kerja | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Absensi | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Cuti | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Lembur | ✓ | ✓ |  |  |  |  |  |  |  |  |
| Penggajian | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |
| **Dokumen** | | | | | | | | | | |
| Berkas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tanda tangan → Tanda tangan dokumen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tanda tangan → Minta tanda tangan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tanda tangan → Tanda tangan saya | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Templat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Laporan** | | | | | | | | | | |
| Laporan → Arsip Bulanan | ✓ |  |  |  |  |  |  |  | ✓ |  |
| **Integrasi** | | | | | | | | | | |
| Katalog Website | ✓ |  | ✓ |  |  | ✓ |  |  |  |  |
| WhatsApp AI (otomatisasi) → Percakapan | ✓ |  | ✓ |  | ✓ | ✓ |  |  |  |  |
| WhatsApp AI (otomatisasi) → Basis Pengetahuan FAQ | ✓ |  | ✓ |  | ✓ | ✓ |  |  |  |  |
| Webhook (n8n) | ✓ |  |  |  |  | ✓ |  |  |  |  |
| **Administrasi** | | | | | | | | | | |
| Pengguna | A | A | A | A | A | A | A | A | A | A |
| Log Audit | A | A | A | A | A | A | A | A | A | A |
| **Pengaturan** | | | | | | | | | | |
| Perusahaan | ✓ |  |  |  |  |  |  |  |  |  |
| Nomor Kode | ✓ |  |  |  |  |  |  |  |  |  |
| Gateway pembayaran | ✓ |  |  |  |  |  |  |  |  |  |
| Dokumen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Penggajian | A | A | A | A | A | A | A | A | A | A |

**Perubahan dibanding sekarang:**

| Menu | Sekarang | Sesudah | Sebab |
|---|---|---|---|
| Administrasi → Organisasi | Pemilik | Disembunyikan | K12 tahap 1 |
| Bonus & Investor → Data Investor | Pemilik, Keuangan | Pemilik saja | K10 |
| Pengadaan → Pesanan Pembelian | Pemilik | Pemilik, Gudang | B4 |
| Penjualan → Sales order | Pemilik, Penjualan, Keuangan | + Gudang | B4 |
| Keuangan → Saldo Awal, Daftar Akun, Jurnal, Tutup Periode | Pemilik, Akuntan | Pemilik, Keuangan | K2d (Akuntan digabung) |
| Penjualan → SPH, Sales order, Retur penjualan; Proyek; Garansi; Lisensi; Karyawan; Penggajian | Keuangan (bukan Akuntan) | Bella melihat semuanya | K2d: Bella sebelumnya Akuntan |
| CRM & Penjualan untuk Agus MD dan Bilal | Penjualan dan Manajer Penjualan berbeda | Sama: Kunci API dan Katalog Website ikut terlihat | K2b |

### 2.1 Menu per orang (sesudah keputusan)

| Orang | Menu yang tampil |
|---|---|
| **Aqim** (Pemilik, SDM, admin aplikasi) | Semua menu. Organisasi disembunyikan. Termasuk Gudang, Pengguna, Log Audit, dan Pengaturan → Penggajian (khusus admin aplikasi) |
| **Agus MD** (Penjualan) | Dasbor; CRM (Prospek, Pelanggan); Penjualan (SPH, Sales order, Surat Jalan, Retur Penjualan); Langganan & Lisensi (semua, termasuk Kunci API); Produk, Komponen, Material, Kategori barang; Peminjaman aset; Dokumen; Katalog Website; WhatsApp AI (Percakapan, FAQ) |
| **Bilal** (Penjualan, Gudang, Layanan Pelanggan, Pemasaran) | Menu Agus MD, **ditambah**: Proyek, Tiket, Garansi; Anggaran proyek (lihat MN1); Gudang (bila ditunjuk PIC); Stok, Penyesuaian Stok, Mutasi Barang; Pesanan Pembelian (baca), Penerimaan Barang, Retur Pembelian; Webhook (n8n) |
| **Agus** (Manajer Proyek, Teknisi, Gudang) | Dasbor; Pelanggan (baca); Sales order (baca), Surat Jalan, Retur Penjualan; Anggaran proyek, Aset tetap (lihat MN1, MN2); Proyek, Tiket, Garansi; Gudang (bila ditunjuk PIC); Produk dan Barang (termasuk Stok, Penyesuaian, Mutasi); semua menu Aset & Peralatan; Permintaan Pembelian, Pesanan Pembelian (baca), Penerimaan Barang, Retur Pembelian; Tugas; Dokumen |
| **Jamil** (Manajer Proyek, Teknisi), **Hatta** (Manajer Proyek) | Dasbor; Pelanggan (baca); Anggaran proyek, Aset tetap; Proyek, Tiket, Garansi; semua menu Aset & Peralatan; Permintaan Pembelian; Tugas; Dokumen |
| **Fahri, Alex, Ade** (Teknisi) | Dasbor; Anggaran proyek (lihat MN1); Proyek, Tiket, Garansi; Peminjaman aset; Permintaan Pembelian; Tugas; Dokumen |
| **Bella** (Keuangan gabungan) | Dasbor; Penjualan (semua, termasuk Faktur, Uang Muka, Kuitansi); semua menu Keuangan (Aset tetap ditambahkan, OB5); semua Pajak; Proyek, Garansi, Lisensi (baca); Nilai Persediaan, Produk, Barang (baca), Pemasok, Penerimaan Barang (baca); Karyawan, Penggajian; Dokumen; Laporan → Arsip Bulanan |
| **Dafrin, Oki** (Pekerja Lepas) | Dasbor; Tugas; Dokumen (Berkas, Tanda tangan, Templat) |

Semua orang juga melihat **Pengaturan → Dokumen** dan **Dokumen → Templat**
(lihat MN3, MN4).

Menu akun pribadi ada di menu pengguna (pojok kanan atas): **Profil** dan
**Akun** (nama pengguna, email, kata sandi, sesi). Menu ini terbuka untuk
semua orang.

### 2.2 Portal karyawan (`apps/web-employee`)

Dibuka oleh semua orang yang punya **data karyawan**. Dafrin dan Oki tidak
punya (X4), jadi mereka tidak memakai portal ini.

| Bagian | Menu |
|---|---|
| Dasbor | Dasbor |
| SDM | Absensi, Jadwal Kerja, Cuti, Lembur, Tugas |
| Proyek | Proyek |
| Dokumen | Berkas, Tanda tangan |
| Akun | Penggajian (slip gaji) |

Profil dan notifikasi dibuka dari menu pengguna dan ikon lonceng. Di ponsel,
bilah bawah berisi Dasbor, Absensi, Cuti, dan Tugas. **Menu tidak dibedakan
per role**: semua karyawan melihat menu yang sama, dan isinya dibatasi di
server (data milik sendiri).

### 2.3 Portal pelanggan (`apps/web-customer-portal`)

Untuk akun pelanggan. Menunya sama untuk semua pelanggan:
- Bilah bawah (ponsel): Beranda, Pesanan, Lacak, Bantuan, Profil.
- Menu atas (desktop): sama, ditambah pencarian dan notifikasi. Menu tarik
  berisi Dasbor, Pesanan Saya, Lacak Pesanan, Penawaran (SPH), Tiket Bantuan,
  Notifikasi, Wishlist, Pengaturan Akun, dan Keluar.

Tidak ada keranjang belanja. Pesanan hanya dilihat dan dilacak.

### 2.4 Portal investor (`apps/web-investor`)

Masih templat kosong bawaan Vite: tidak ada menu dan form. Sesuai OE3,
dibiarkan di repo dan ditandai "belum dimulai".

---

## 3. Usulan perapian menu (belum diputuskan)

Temuan dari perhitungan di atas. Semua hanya mengubah **menu**, bukan hak di
server, kecuali yang disebut lain.

| No | Temuan | Usulan | Wilayah |
|---|---|---|---|
| MN1 | **Anggaran proyek** (di bawah Keuangan) tampil untuk Teknisi dan Layanan Pelanggan, karena menu ini hanya meminta hak baca proyek. Isinya anggaran per akun, jadi data keuangan | Menu meminta hak lihat biaya proyek (`project.read_cost`): tinggal Pemilik, Manajer Proyek, Keuangan | Oki (M09) |
| MN2 | **Aset tetap** (di bawah Keuangan) tampil untuk Manajer Proyek. Di kode sekarang **tidak tampil untuk Keuangan**; itu sudah diputuskan diperbaiki lewat OB5 (Bella membuka Aset tetap dan Anggaran proyek; sudah tercermin di tabel). Sisa pertanyaannya: apakah Manajer Proyek tetap melihatnya. Catatan: form di halaman itu (kapitalisasi, jalankan penyusutan) butuh hak posting jurnal, yang hanya dimiliki Keuangan dan Pemilik. Hal yang sama berlaku untuk Aset & Peralatan → Penyusutan dan Penghapusan Aset | Aset tetap, Penyusutan, Penghapusan: Pemilik dan Keuangan saja. Manajer Proyek tetap melihat Register Aset, Peminjaman, Catatan Servis, Set Peralatan | Oki (M06, M09) |
| MN3 | **Pengaturan → Dokumen** tampil untuk semua orang, termasuk Pekerja Lepas. Isinya pengaturan perusahaan (kop dokumen, dsb.) dan hanya bisa diubah Pemilik | Hanya Pemilik dan admin aplikasi | Bersama (K11) |
| MN4 | **Dokumen → Templat** tampil untuk semua orang, padahal halamannya masih "segera hadir" (ERP-0050) | Sembunyikan sampai halamannya dibuat | Bersama (K11) |
| MN5 | **Bonus & Investor** hanya tampil untuk Pemilik (K10), tetapi ketiga halamannya masih "segera hadir" | Sembunyikan seluruh grup sampai M11 dibangun | Oki (M11) |
| MN6 | **Pekerja Lepas** melihat Berkas, Minta tanda tangan, dan Templat | Cukup Tugas dan Tanda tangan saya | Bersama (K11) |
| MN7 | Teknisi, Manajer Proyek, dan Pekerja Lepas punya hak **mengajukan kasbon dan pertanggungjawaban**, tetapi formnya ada di Keuangan → Beban. Menu itu meminta hak baca klaim biaya, yang tidak mereka punya, jadi mereka **tidak bisa membuka form tersebut**. Portal karyawan juga tidak punya form kasbon | (a) Tambah menu "Kasbon saya" di portal karyawan. (b) Buka Keuangan → Beban dengan isi terbatas milik sendiri | Oki (M09) |

---

## 4. Form web-admin

Kolom **Siapa** memakai role sesudah keputusan. "Pemilik" selalu termasuk
karena Pemilik memegang semua hak, jadi hanya ditulis bila ia satu-satunya.

Jenis isian: teks, angka, uang (rupiah), tanggal, pilihan, pilihan dengan
pencarian, teks panjang, unggah berkas, centang, **tabel baris** (baris bisa
ditambah).

### 4.1 CRM (9 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Lead baru / ubah lead | Prospek | Nama, perusahaan, telepon, WhatsApp, email (minimal satu kontak), sumber (pilihan), perkiraan nilai (uang), follow-up berikutnya (tanggal-jam), kebutuhan (teks panjang) | Penjualan |
| Ubah status lead | Detail lead | Status; alasan kalah (bila kalah) | Penjualan |
| Tugaskan lead | Detail lead | Petugas (pilihan pengguna) | Penjualan |
| Catat follow-up | Detail lead | Jenis, follow-up berikutnya, catatan | Penjualan |
| Jadikan pelanggan | Detail lead | Mode baru/sudah ada; kode, nama, email; atau cari dan pilih pelanggan | Penjualan |
| Orang baru / ubah pelanggan (perorangan) | Pelanggan | Foto, kode, nama, jabatan, perusahaan (pilih atau buat baru + jenis), pemilik perusahaan (centang), email, telepon, status, catatan | Penjualan |
| Perusahaan baru / ubah | Pelanggan | Kode, jenis pelanggan, nama, nama resmi, NPWP, email, telepon, situs web, pemilik, status, catatan | Penjualan |
| Tambah alamat | Detail pelanggan | Jenis, label, alamat, kode pos, utama (centang) | Penjualan |
| Undang ke portal | Detail pelanggan → Portal pelanggan | Nama, email, peran | Penjualan, Layanan Pelanggan |

### 4.2 Penjualan (18 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| SPH baru / ubah | SPH | Pelanggan (cari), kepada (attention), judul, pembuka, tanggal, berlaku sampai, garansi, syarat bayar; **tabel baris**: barang (cari) atau baris bebas, nama, spesifikasi, jumlah, satuan, harga, diskon; PPN (centang + tarif); **jadwal bayar**: label, persen; syarat, catatan | Penjualan |
| Tolak SPH | Detail SPH | Alasan | Penjualan (SPH rekan, bukan miliknya), Pemilik (K1) |
| Tandai batal (kalah) | Detail SPH | Alasan (pilihan), catatan | Penjualan |
| Buat sales order | Detail SPH | No. PO pelanggan, tanggal order, tanggal kirim, catatan | Penjualan |
| Batalkan SO | Detail SO | Alasan | Penjualan |
| Buat invoice (kartu Penagihan) | Detail SO | Termin, persen, jumlah (uang), keterangan, jatuh tempo | Keuangan |
| Buat surat jalan | Surat Jalan | SO, gudang, bin, tanggal; penerima (proyek, lokasi, nama, PIC, kontak, alamat); **tabel baris**: jumlah, keterangan, nomor seri (centang); sopir, no. kendaraan, catatan | Gudang |
| Kirim / tandai diterima / batalkan surat jalan | Detail surat jalan | Diterima: nama penerima. Batal: alasan | Gudang |
| Retur penjualan baru / ubah | Retur Penjualan | Surat jalan, tanggal retur, alasan; **per baris**: nomor seri (centang), jumlah, catatan | Penjualan |
| Terima barang retur | Detail retur | Tanggal terima; **per baris**: kondisi (baik/rusak), bin | Gudang |
| Tolak / batalkan retur | Detail retur | Alasan | Penjualan |
| Terbitkan invoice | Detail invoice | Tanggal terbit, jatuh tempo | Keuangan |
| Batalkan (void) invoice | Detail invoice | Alasan | Keuangan |
| Catat pembayaran (kuitansi) | Detail invoice | Jumlah, tanggal, metode, referensi | Keuangan |
| Batalkan kuitansi | Detail invoice | Alasan | Keuangan |
| Nota kredit baru | Detail invoice → Penyesuaian | Tanggal, jumlah, alasan | Keuangan |
| Ajukan penghapusan piutang | Detail invoice → Penyesuaian | Alasan | Keuangan (lihat FR6) |
| Batalkan nota kredit | Detail invoice → Penyesuaian | Alasan | Keuangan |

Uang Muka, daftar Faktur, Kuitansi, dan daftar SO hanya berupa daftar.

### 4.3 Proyek, Tiket, Garansi (13 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Buat proyek | Proyek | Deal (cari SPH), PIC, lokasi, target mulai, target selesai, catatan | Manajer Proyek |
| Ubah proyek | Detail proyek | PIC, tahap, lokasi, target mulai/selesai, catatan | Manajer Proyek |
| Batalkan proyek | Detail proyek | Alasan | Manajer Proyek |
| Tambah tugas proyek | Detail proyek → Tugas | Judul, tahap, petugas; tiap baris punya pilihan petugas dan status | Manajer Proyek (Teknisi mengubah status tugasnya) |
| Unggah bukti | Detail proyek → Bukti | Jenis, berkas (jpg/png/webp/pdf), catatan | Manajer Proyek, Teknisi |
| Catat biaya proyek | Detail proyek → Biaya | Kategori, tanggal, jumlah, keterangan, nota (unggah), sumber dana, referensi | Manajer Proyek |
| BAST baru / ubah | Detail proyek → BAST | Pihak pertama dan kedua (perusahaan, nama, jabatan), tanggal, no. kontrak, judul pekerjaan, nama proyek; **tabel baris**: uraian, volume, keterangan; lingkup | Manajer Proyek |
| Surat keterangan garansi | Detail proyek → Garansi | BAST, tanggal terbit, lama (bulan), ringkasan produk, nama/lokasi/pemilik proyek; **tabel baris** seperti BAST; syarat | Manajer Proyek |
| Buat tiket | Tiket | Nomor seri (untuk mencari), pelanggan, proyek, perangkat, pelapor, kontak (telepon), saluran, keluhan | Manajer Proyek, Layanan Pelanggan |
| Tugaskan tiket | Detail tiket | Petugas | Manajer Proyek, Layanan Pelanggan |
| Selesaikan tiket | Detail tiket | Penyelesaian, biaya servis (opsional) | Teknisi (tiket miliknya), Manajer Proyek, Layanan Pelanggan |
| Tutup tiket | Detail tiket | Dikonfirmasi oleh, saluran | Manajer Proyek, Layanan Pelanggan |
| Pesan tiket | Detail tiket | Pesan, tampil ke pelanggan (centang) | Manajer Proyek, Layanan Pelanggan, Teknisi |

Menu Garansi hanya berupa daftar; formnya ada di detail proyek.

### 4.4 Langganan & Lisensi (5 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Kontrak baru / ubah | Kontrak lisensi | Pelanggan, aplikasi, paket, SO, tanggal mulai/akhir, siklus tagihan, nilai (uang), catatan | Penjualan |
| Tambah kunci lisensi | Detail kontrak | Kunci, maks. aktivasi, kedaluwarsa, catatan | Penjualan |
| Tangguhkan / hentikan kontrak / cabut kunci | Detail kontrak | Alasan | Penjualan |
| Aplikasi baru / ubah | Aplikasi | Kode, nama, vendor, sumber, deskripsi | Penjualan |
| Kunci API baru | Kunci API | Nama (kunci tampil sekali) | Penjualan |

### 4.5 Integrasi (3 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Tampilkan barang / ubah listing | Katalog Website | Barang (cari), slug, spesifikasi, cara tampil harga, keterangan harga, label stok habis, waktu tunggu, kegunaan (dipisah koma), popularitas | Penjualan, Pemasaran |
| Tambah / ubah FAQ | WhatsApp AI → FAQ | Pertanyaan, jawaban, kata kunci, urutan, aktif | Pemasaran (Penjualan dan Layanan Pelanggan hanya melihat) |
| Balas sebagai admin | WhatsApp AI → Percakapan | Balasan | Penjualan, Layanan Pelanggan |

Webhook (n8n) hanya daftar dengan tombol kirim ulang.

### 4.6 SDM (14 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Karyawan baru | Karyawan | Nama lengkap, email, telepon, NIK, jenis kepegawaian, jenis kerja, tanggal masuk, role | SDM |
| Ubah karyawan | Detail karyawan | Kode, nama, panggilan, NIK, telepon; status, jenis, jenis kerja, role, tanggal masuk/keluar; NPWP, PTKP, no. BPJS Kesehatan dan Ketenagakerjaan | SDM |
| Tambah dokumen karyawan | Detail karyawan | Jenis dokumen, judul; lalu unggah berkas per baris | SDM |
| Periode gaji baru | Detail karyawan | Berlaku mulai, gaji pokok, tunjangan | SDM, Keuangan |
| Tambah rekening | Detail karyawan | Jenis rekening, bank, nomor, pemilik, utama, aktif | SDM, Keuangan |
| Tugas baru / ubah | Tugas | Karyawan, judul, rincian, tenggat | SDM, Manajer Proyek |
| Tambah / ubah jadwal | Jadwal Kerja | Libur (sakelar), jam mulai, jam selesai, label | SDM |
| Isi dari pola | Jadwal Kerja | Dari, sampai, karyawan (atau semua), pola shift | SDM |
| Lembar absensi harian | Absensi | Tanggal; **per karyawan**: status, jam masuk, jam pulang, catatan | SDM |
| Impor absensi | Absensi | Berkas .xlsx/.csv (ada templat) | SDM |
| Catat cuti | Cuti | Karyawan, jenis cuti, mulai, selesai, alasan | SDM |
| Catat lembur | Lembur | Karyawan, tanggal, jam, alasan | SDM |
| Tambah / ubah baris gaji | Penggajian | Karyawan, gaji pokok, tunjangan, lembur, bonus, potongan (uang), bersih (dihitung), catatan | SDM, Keuangan |
| Impor gaji | Penggajian | Berkas .xlsx/.csv | SDM, Keuangan |

"Setujui bulan ini" (gaji) hanya konfirmasi; hanya Pemilik.

### 4.7 Keuangan (27 form + 3 di detail SO/invoice)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Akun kas/bank baru / ubah | Kas & Bank | Kode, nama, jenis akun, akun buku besar, saldo awal, bank, no. rekening, pemilik, pemakaian invoice (PPN/non-PPN), utama | Keuangan |
| Transaksi kas baru | Kas & Bank | Akun kas, tanggal, arah (masuk/keluar), jumlah, akun lawan, keterangan | Keuangan |
| Setor pajak | Kas & Bank | Utang pajak, kode billing, kas/bank, tanggal, jumlah, referensi | Keuangan |
| Bayar gaji / BPJS | Kas & Bank | Sama dengan setor pajak | Keuangan |
| Catat settlement gateway | Kas & Bank | Kas/bank, tanggal, bruto, biaya, referensi | Keuangan |
| Saldo awal (baris + posting) | Saldo Awal | Akun, per tanggal, debit, kredit | Keuangan |
| Rincian piutang/utang awal | Saldo Awal | Unggah CSV | Keuangan |
| Akun baru / ubah | Daftar Akun | Kode, nama, deskripsi, jenis, saldo normal, induk, kategori arus kas, bisa diposting | Keuangan |
| Jurnal manual | Jurnal | Tanggal, keterangan, penyesuaian (centang); **tabel baris**: akun, pusat biaya, debit, kredit | Keuangan (disetujui Aqim, K1a) |
| Tolak / balik jurnal | Jurnal | Alasan | Keuangan, Pemilik |
| Aturan posting baru / ubah | Aturan Posting | Peran, jenis event, pembeda, nilai pembeda, akun, aktif | Keuangan |
| Pusat biaya baru / ubah | Pusat Biaya | Kode, nama, induk, deskripsi | Keuangan |
| Anggaran proyek | Anggaran proyek | Proyek; **tabel baris**: akun, bulan, jumlah; mode kontrol (peringatan/blokir) | Keuangan |
| Kapitalisasi barang | Aset tetap | Barang, akun lawan, tanggal kapitalisasi, golongan fiskal | Keuangan (lihat MN2) |
| Jalankan penyusutan | Aset tetap | Tahun, bulan | Keuangan (lihat MN2) |
| Rekonsiliasi baru | Rekonsiliasi | Akun kas, tanggal, saldo rekening koran | Keuangan |
| Tambah item koran + cocokkan | Detail rekonsiliasi | Tanggal, referensi, jumlah; per item: cocokkan ke buku, catat sebagai akun | Keuangan |
| Impor rekening koran | Rekonsiliasi | Unggah CSV, pemetaan kolom | Keuangan |
| Tagihan manual | Utang | Pemasok, tanggal, jatuh tempo, subtotal, pajak | Keuangan |
| Tagihan dari PO | Utang | PO, no. faktur pemasok, tanggal, jatuh tempo; jumlah per baris | Keuangan |
| Batalkan pembayaran | Utang / Piutang / Beban | Alasan (kotak prompt browser, lihat FR2) | Keuangan |
| Klaim biaya baru / ubah | Beban | Karyawan, tanggal, proyek, catatan; **tabel baris**: tanggal, kategori, keterangan, jumlah, pajak | Keuangan |
| Bayar klaim | Detail klaim | Kas/bank, tanggal, jumlah, referensi | Keuangan |
| Ajukan kasbon | Beban → Kasbon | Karyawan, tanggal, jumlah, keperluan | Teknisi (tidak bisa membuka menunya, MN7) |
| Pertanggungjawaban | Beban → Kasbon | Tanggal; **tabel baris**: kategori, keterangan, jumlah, pajak | Manajer Proyek, Teknisi, Pekerja Lepas (MN7) |
| Bayar kasbon | Beban → Kasbon | Sama dengan bayar klaim | Keuangan |
| Siapkan / tutup periode | Tutup Periode | Tahun, bulan; tombol amortisasi dan tutup PPN | Keuangan |

Piutang dan Laporan Keuangan tidak punya form (daftar, filter, ekspor).

### 4.8 Pajak (8 form)

Semua diisi **Keuangan**.

| Form | Dibuka dari | Isian |
|---|---|---|
| Tambah tarif | Jenis & Tarif Pajak | Kode, nama, tarif, berlaku mulai (jenis selalu PPN) |
| Catatan pajak baru | Catatan Pajak | Jenis pajak, tahun, bulan, DPP |
| Ubah catatan pajak | Catatan Pajak | DPP |
| Pemotongan baru | Pemotongan Pajak | Kode, jenis pajak, lawan transaksi, dasar, jumlah pajak |
| Ubah pemotongan | Pemotongan Pajak | Jumlah pajak |
| Data Coretax | Pemotongan Pajak | Kode objek pajak, NPWP lawan, no. bukti potong, status |
| Tambah koreksi | Koreksi & Bukti | Catatan pajak, jumlah, alasan, ID dokumen bukti (teks, lihat FR1) |
| Tarif TER PPh 21 | Tabel PPh 21 | Unggah CSV |

### 4.9 Inventaris dan Gudang (9 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Gudang baru | Gudang | Foto, kode, nama, utama, aktif; alamat (label, jalan, RT, RW, kode pos, provinsi → kelurahan) | Admin aplikasi (Aqim) |
| Ubah gudang | Detail gudang | Sama dengan gudang baru | Aqim, PIC gudang |
| Tambah / ubah penyimpanan (bin) | Detail gudang → Penyimpanan | Kode, nama, jenis bin, kapasitas, aktif | Aqim, PIC gudang |
| Penanggung jawab | Detail gudang → Penanggung jawab | Pengguna (cari) | Aqim, PIC gudang |
| Organisasi tertaut | Detail gudang → Organisasi | Organisasi | Aqim (hilang di K12 tahap 3) |
| Barang baru / ubah | Produk, Komponen, Material | Kode, jenis, nama, SKU, nomor seri, kategori, merek, deskripsi, foto, harga jual, harga beli, satuan, stok minimum, barcode, berseri / dilacak jumlah / aktif, spesifikasi | Pemilik (lihat FR7) |
| Susunan komponen/material | Detail barang | Barang (cari), jumlah | Pemilik |
| Kategori barang baru / ubah | Kategori barang | Slug, nama, urutan, nama pendek, deskripsi, aktif | Pemilik |
| Penyesuaian stok | Penyesuaian Stok | Gudang, jenis, kode alasan, catatan; **tabel baris**: barang, bin, stok sistem, stok hitung, harga pokok, selisih, catatan | Gudang (disetujui dan diposting Pemilik) |

### 4.10 Aset dan Peralatan (11 form, wilayah Oki)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Daftarkan / ubah aset | Register Aset | Nama, jenis barang, nomor seri, harga perolehan, tanggal perolehan, lokasi, foto | Pemilik |
| Nonaktifkan aset | Detail aset | Alasan | Pemilik |
| Tempatkan / pindahkan | Detail aset | Gudang, penyimpanan | Pemilik |
| Kategori aset baru / ubah | Kategori Aset | Kode, nama, jenis barang, metode penyusutan, umur (bulan) | Pemilik |
| Peminjaman baru | Peminjaman | Jenis peminjam (pengguna / pelanggan / tamu: nama, telepon, jenis dan no. identitas, alamat, ref. dokumen), keperluan, tanggal kembali, catatan; **baris**: nomor seri | Penjualan, Layanan Pelanggan, Manajer Proyek, Teknisi |
| Perpanjang peminjaman | Detail peminjaman | Tanggal kembali baru (prompt browser, FR2) | Gudang |
| Set peralatan baru | Set Peralatan | Nama | Pemilik |
| Tambah / hapus item set | Set Peralatan | ID aset / ID item (teks, FR1) | Pemilik |
| Ajukan penghapusan aset | Penghapusan Aset | Aset, cara penghapusan, hasil penjualan | Pemilik |
| Catat penyusutan manual | Penyusutan | Tahun, bulan, jumlah | Pemilik |

Setujui, serahkan, kembalikan, tandai hilang pada peminjaman berupa tombol.
Persetujuan peminjaman: Manajer Proyek (bukan miliknya sendiri, perbaikan
bug di K7a).

### 4.11 Pengadaan (10 form)

Role Pembelian tidak dipakai (K2c), jadi pembelian dikerjakan Aqim.

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Pemasok baru / ubah | Pemasok | Perusahaan (cari), kode, nama, nama resmi, NPWP, email, telepon, situs, bank (nama, no., pemilik), jenis pemasok, catatan; alamat pertama | Pemilik |
| Tambah alamat pemasok | Detail pemasok | Jenis, label, kontak, telepon, alamat, wilayah, kode pos, utama | Pemilik |
| Tambah kontak pemasok | Detail pemasok | Nama, jabatan, telepon, email, utama | Pemilik |
| Permintaan pembelian (PR) baru / ubah | Permintaan Pembelian | Perihal, alasan, nama proyek, tanggal, dibutuhkan tanggal; **tabel baris**: nama barang, satuan, spesifikasi, jumlah, perkiraan harga, catatan | Manajer Proyek, Teknisi |
| Tolak / batalkan PR | Detail PR | Alasan | Pemilik |
| PO baru / ubah | Pesanan Pembelian | Pemasok, kontak pemasok, kategori, tanggal order, perkiraan kirim, ref. dan tanggal penawaran pemasok, nama proyek, proyek anggaran, kontak pembeli; **tabel baris**: barang, spesifikasi, jumlah, harga; ambil baris dari PR; mode PPN, syarat bayar, ketentuan, catatan | Pemilik |
| Tolak / batalkan PO | Detail PO | Alasan | Pemilik |
| Terima barang (BPB) | Penerimaan Barang / detail PO | PO, gudang, bin, tanggal, no. surat jalan pemasok; **per baris**: jumlah, nomor seri, catatan | Gudang |
| Retur pembelian baru / ubah | Retur Pembelian / detail BPB | BPB sumber, tanggal, alasan; **per baris**: nomor seri, jumlah, catatan | Pemilik |
| Kirim ke pemasok / batalkan retur | Detail retur | Tanggal kirim, atau alasan batal | Gudang (kirim), Pemilik (batal) |

### 4.12 Dokumen (6 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Unggah berkas | Detail berkas | Berkas pdf/png/jpg/webp | Pemilik saja (lihat FR5) |
| Buat tautan berbagi | Detail berkas | Berkas yang dibagikan | Pemilik saja (FR5) |
| Minta tanda tangan | Minta tanda tangan | Dokumen (cari), penanda tangan (banyak), catatan, kedaluwarsa | Semua role |
| Gambar tanda tangan saya | Tanda tangan saya | Unggah gambar | Semua role |
| Tanda tangani / tolak | Tanda tangan saya | Cara tanda tangan, atau alasan menolak | Semua role |
| Tempatkan tanda tangan di PDF | Tanda tangan saya | Berkas PDF, halaman, klik posisi | Semua role |

### 4.13 Pengaturan, Administrasi, Akun (15 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Profil perusahaan | Pengaturan → Perusahaan | Nama resmi, nama dagang, kode dokumen, NPWP, tagline, alamat, kode pos, telepon, email, situs | Pemilik |
| Gambar perusahaan | Pengaturan → Perusahaan | Logo, gambar onboarding | Pemilik |
| Pengaturan (kunci/nilai) | Pengaturan → Perusahaan, Dokumen | Jenis nilai, nilai | Pemilik |
| Penomoran | Pengaturan → Nomor Kode | Pola, aturan reset | Pemilik, admin aplikasi |
| Gateway pembayaran | Pengaturan → Gateway pembayaran | Penyedia, kode, nama, mode, aktif, secret, token webhook | Pemilik |
| Tanggal gajian | Pengaturan → Penggajian | Aktif, tanggal gajian | Admin aplikasi |
| PPh 21 dan BPJS | Pengaturan → Penggajian | PPh 21, BPJS Kesehatan/Ketenagakerjaan (sakelar), tarif JKK, batas upah | Admin aplikasi |
| Organisasi baru / ubah | Organisasi | Gambar, nama, deskripsi, slug | Admin aplikasi (hilang di K12) |
| Ubah role anggota | Organisasi → Anggota | Role (centang, bisa beberapa) | Pemilik |
| Undang pengguna | Pengguna | Tunggal: email, nama, organisasi, role, karyawan tetap. Massal: baris teks + role. Berkas: unggah | Pemilik, SDM |
| Profil | Menu pengguna → Profil | Foto, nama, bio | Semua |
| Nama pengguna | Menu pengguna → Akun | Nama pengguna | Semua |
| Email | Menu pengguna → Akun | Email baru | Semua |
| Kata sandi | Menu pengguna → Akun | Lama, baru, ulangi; keluar dari sesi lain | Semua |

**Jumlah form web-admin: 148** (CRM 9, Penjualan 18, Proyek/Tiket 13,
Lisensi 5, Integrasi 3, SDM 14, Keuangan 27, Pajak 8, Inventaris 9, Aset 11,
Pengadaan 10, Dokumen 6, Pengaturan/Administrasi/Akun 15).

---

## 5. Form portal

### 5.1 Portal karyawan (10 form)

Diisi oleh karyawan untuk dirinya sendiri.

| Form | Isian |
|---|---|
| Masuk | Email/nama pengguna, kata sandi (tanpa Google, K13) |
| Ajukan cuti | Jenis cuti, alasan, mulai, selesai |
| Catat lembur | Tanggal, jam, alasan |
| Data pribadi | Nama panggilan, telepon, alamat, kode pos |
| Keamanan akun | Kata sandi lama, baru, ulangi; keluar |
| Tanda tangan saya | Unggah gambar |
| Tolak permintaan tanda tangan | Alasan |
| Tambah / ubah tugas proyek | Judul, tahap, tenggat, petugas |
| Unggah bukti proyek | Foto, jenis bukti, tugas, catatan |
| Check-in di lokasi proyek | Swafoto (kamera), catatan |

Absen masuk dan pulang berupa **tombol satu klik** tanpa isian.

### 5.2 Portal pelanggan (24 form)

| Kelompok | Form dan isian |
|---|---|
| Masuk dan daftar | Masuk (jenis akun, email, kata sandi, ingat saya); Daftar langkah 1 (jenis akun perorangan/perusahaan); Daftar langkah 2 (nama perusahaan, NPWP, industri, nama, email, telepon, kata sandi, setuju syarat); Verifikasi email (OTP 6 digit); Lupa kata sandi (email atau telepon); Atur ulang kata sandi |
| Akun dan perusahaan | Penyiapan awal (alamat lokasi utama, undang anggota + peran approver/finance/viewer); Profil pribadi (nama, telepon, jabatan); Ubah perusahaan (nama resmi, NPWP, industri); Undang anggota (email, peran, batas persetujuan min. Rp1.000.000); Lokasi baru / ubah (nama, alamat, kontak, telepon, utama) |
| Pengaturan | Ganti kata sandi; Hapus akun (kata sandi, centang); Bahasa; Perangkat (cabut sesi) |
| Bantuan | Tiket baru (kategori, prioritas, produk, judul, deskripsi, foto/video maks. 5 × 25 MB); Chat tiket (teks, lampiran); Pesan servis (jenis servis, produk, tanggal, jam); Daftarkan perangkat (nomor seri) |
| Penawaran dan bayar | Terima SPH (no. PO, approver, setuju); Minta revisi SPH (topik, pesan, lampiran); Klaim RFQ (referensi + OTP); Bayar invoice (metode bayar) |
| Lacak | Nomor pelacakan |

---

## 6. Temuan pada form (belum diputuskan)

| No | Temuan | Contoh | Usulan |
|---|---|---|---|
| FR1 | Isian **ID mentah** yang harus diketik manual | Peminjaman (ID pengguna/pelanggan), Set peralatan (ID aset/item), Koreksi pajak (ID dokumen bukti) | Ganti dengan pilihan yang bisa dicari |
| FR2 | **Kotak prompt browser**, bukan dialog | Batalkan pembayaran, perpanjang peminjaman | Ganti dengan dialog biasa (alasan / tanggal) |
| FR3 | **Tolak tanpa alasan** | Cuti, lembur, klaim biaya, penyesuaian stok | Tambah isian alasan, seperti SPH, PO, dan PR |
| FR4 | **Form sebaris tanpa label** (hanya placeholder) | Transaksi kas, saldo awal, tagihan manual, baris pajak, rekonsiliasi | Tambah label isian |
| FR5 | **Unggah berkas** dan **tautan berbagi** di Dokumen hanya bisa dilakukan Pemilik, karena tidak ada role lain yang punya hak ubah dokumen | — | Tentukan siapa saja yang boleh mengunggah (bagian dari K11) |
| FR6 | Dengan K2d, Bella memegang hak **mengajukan dan menyetujui penghapusan piutang** sekaligus (dulu dipisah Keuangan dan Akuntan) | Server sudah menolak menyetujui pengajuan sendiri (`receivable-adjustment.service.ts:205`), jadi penghapusan piutang yang diajukan Bella **harus disetujui Aqim** | Tidak perlu ubah kode; cukup dicatat (sama dengan jurnal, K1a) |
| FR7 | Halaman **ubah barang** dikunci untuk admin aplikasi saja, padahal B3 = ikut hak role | — | Ikut hak `product.update` (sesuai B3) |
| FR8 | **Portal pelanggan** masih punya jenis akun perorangan/perusahaan dan login email + kata sandi, padahal keputusannya **satu jenis akun dengan Google** (OA4, K13). Teks portal masih bahasa Inggris dan ditulis langsung di kode | Masuk, Daftar langkah 1–2 | Sesuaikan saat K13 dikerjakan; teks ke bahasa Indonesia |
| FR9 | Beberapa form portal pelanggan (wishlist, pesan servis, daftarkan perangkat, bayar invoice, klaim RFQ) **belum dicek** apakah sudah tersambung ke ERP | — | Cek saat UAT portal (M07) |
| FR10 | Form **Undang pengguna** masih punya pilihan organisasi | — | Hilang di K12 tahap 1 |
