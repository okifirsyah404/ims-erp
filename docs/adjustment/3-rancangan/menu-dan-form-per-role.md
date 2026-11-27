# Menu dan form per role

Disusun 2026-11-27. Kembali ke [catatan penyesuaian](../README.md).

Dokumen ini menjawab dua pertanyaan:
1. **Menu apa yang tampil untuk setiap role** (dan setiap orang).
2. **Form apa saja yang ada**, isiannya apa, dan siapa yang mengisinya.

**Sumber dan status:**
- Menu dihitung langsung dari kode: daftar menu
  `apps/web-admin/src/components/sidebar/nav-config.ts`, aturan tampil
  `filter-nav.ts`, dan hak role `packages/common/src/authorization/erp-permissions.ts`.
- Kolom "sesudah" dan semua tabel form sudah memuat **semua keputusan yang
  disetujui Pemilik pada rapat 27/11** yang mengubah menu atau form (daftar
  lengkap di bagian 1a). **Belum dikodekan**: ini gambaran target.
- Daftar form diambil dari kode web-admin, portal karyawan (`apps/web-employee`),
  dan portal pelanggan (`apps/web-customer-portal`).
- Usulan baru di bagian 3 dan 6 (kode **MN** dan **FR**) **belum diputuskan**,
  kecuali yang ditandai "sudah tercakup keputusan".
- Tanda **[baru]** = layar/form yang belum ada di kode dan harus dibuat;
  **[ubah]** = layar/form yang ada tetapi berubah karena keputusan.

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

## 1a. Keputusan disetujui yang mengubah menu dan form

Semua butir di bawah disetujui Pemilik pada rapat 27/11 (sumber: bagian 0
[lembar rapat](../2-keputusan/lembar-keputusan-rapat.md)). Kolom **Layar** menunjuk ke
bagian dokumen ini yang memuat perubahannya.

| Keputusan | Akibat pada menu / form | Layar |
|---|---|---|
| K1, K1a, RO16 | Aqim boleh menyetujui dokumennya sendiri (SPH, PO, PR, retur, penyesuaian stok, kasbon, gaji), tercatat di audit. Jurnal manual tetap dua orang (Bella ↔ Aqim). Tombol Setujui tetap tampil untuk Aqim di dokumen buatannya | 4.2, 4.7, 4.9, 4.11 |
| K2, K2b, K2d, X4, Admin | Susunan role bagian 1; menu dihitung ulang (bagian 2). Pilihan role di form anggota dan undangan hanya menawarkan role yang dipakai | 2, 4.13 |
| K12 tahap 1, OA2 | Menu Organisasi dan pemilih organisasi disembunyikan; isian Organisasi di form Undang pengguna dihapus | 2, 4.13 |
| K13, OA14 | Login web-admin dan portal karyawan: nama pengguna/email + kata sandi, **tanpa tombol Google**; pesan akun nonaktif dibedakan dari akun yang belum klaim undangan | 4.13, 5.1 |
| K13, OA4 | Portal pelanggan: **masuk dengan Google, satu jenis akun**; data perusahaan diisi belakangan di profil. Di web-admin, daftar pelanggan diberi **filter pelanggan biasa / pelanggan bisnis** | 4.1, 5.2 |
| OA8, OA12, OA13 | Log Audit hanya Pemilik; **mengundang hanya Pemilik** (hak dicabut dari SDM); hapus undangan dan nonaktifkan pengguna memakai dialog konfirmasi | 4.13 |
| B1 | Tombol **"Tandai terkirim" di PO dihapus**; PO yang disetujui langsung muncul di Penerimaan Barang | 4.11 |
| B3, B4 | Halaman ubah barang ikut hak role (bukan khusus admin aplikasi); Gudang melihat PO dan SO | 2, 4.9 |
| C1, C2 | Status SO berubah sendiri (Terkirim/Selesai), tanpa tombol; menu Uang Muka terbuka untuk pemegang hak invoice | 4.2 |
| D4 | Menu Tugas: Teknisi dan Pekerja Lepas hanya melihat tugasnya sendiri | 2, 4.6 |
| D5, K10, OE3 | Halaman konten website ditunda; Bonus & Investor hanya Pemilik; portal investor belum dimulai | 2, 2.4 **[Diubah 28/11, IV-1: M11 dibangun lengkap sekarang, `rancangan-investor-m11.md`]** |
| RO1, RO4 | Tutup Periode: **Siapkan periode** oleh Pemilik dan Keuangan; **Buka kembali** hanya Pemilik | 4.7 |
| RO5, OB13, RO6 | Kasbon: teknisi **mengajukan dan melihat kasbonnya di portal karyawan**; Aqim menyetujui dan mencairkan; pertanggungjawaban cukup satu langkah oleh Aqim | 4.7, 5.1 |
| OB2 | Semua pilihan akun (buku besar) memakai **pencarian ke server** | 4.7 |
| OB3 | **[baru]** Layar pembayaran pemasok, termasuk potongan PPh | 2, 4.7 |
| OB5 | Keuangan membuka Aset tetap dan Anggaran proyek | 2 |
| OB10, OB11, OB12 | Penghapusan piutang langsung jadi beban; arus kas mengabaikan jurnal nonkas; ekspor CSV laporan diperbaiki (tanpa form baru) | 4.2, 4.7 |
| OB14 | Tagihan pemasok manual punya isian **akun beban** | 4.7 |
| OB15 | Teks Inggris di Keuangan diterjemahkan nanti (prioritas rendah) | 4.7 |
| OC1–OC7 | Pajak: DPP × tarif dihitung otomatis; masa bupot otomatis dari tanggal; tarif PPN dari master bertanggal berlaku, dokumen menyimpan salinan, beda tarif wajib alasan; pemotongan terbayar dibatalkan dengan alasan; kode ganda diberi pesan jelas; masa tertutup hanya bisa dibaca | 4.2, 4.8 |
| OC8 | PPh 21 otomatis **dimatikan** (dihitung di luar aplikasi); Tabel PPh 21 belum perlu diisi | 4.8, 4.13 |
| OD1, OD2, C13 | Peminjaman teknisi dari **daftar unit khusus**; persetujuan wajib sebelum Gudang menyerahkan; persetujuan sendiri yang selalu lolos diperbaiki | 4.10 |
| OD3, OD4 | Nilai uang aset konsisten (rupiah di layar); layar aset memakai **nama dan pilihan, bukan ID** | 4.10 |
| OD5 | **Set Peralatan disembunyikan**; catatan servis/kondisi dilengkapi **[baru]** | 2, 4.10 |
| OD6, OD7 | Hapus aset ditolak bila sedang dipinjam; pengembalian punya **pilihan kondisi** (Baik/Rusak/Tidak lengkap) dan unit hilang bisa menutup peminjaman | 4.10 |
| OF1, OF2, OF3 | Dasbor: kartu/tautan disembunyikan bila role tidak berhak; lencana "Sementara" dihapus | 2 |
| OG1, PK-1 | Check-in **dan** check-out lokasi proyek di luar radius **ditolak** | 5.1 |
| OG2, OG3, OG6 | Portal karyawan: **[baru]** riwayat absen lokasi sendiri; **[baru]** lupa kata sandi; tanda tangan dengan pratinjau dan konfirmasi | 2.2, 5.1 |
| OG4, OG5 | Semua karyawan (kecuali Pekerja Lepas) punya data karyawan, jadi bisa memakai portal karyawan; Aqim tidak memakai portal karyawan | 2.2 |
| Lembar 6 | Pelanggan dikelola Penjualan; Layanan Pelanggan, Pemasaran, Manajer Proyek hanya melihat; akun portal diundang Penjualan dan Layanan Pelanggan; pemasok dan PO oleh Aqim; Gudang menerima barang dan mengurus surat jalan | 4.1, 4.11 |

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
| Dasbor (kartu sesuai hak role, OF1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
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
| Keuangan → Pembayaran pemasok **[baru]** (OB3) | ✓ |  |  |  |  |  |  |  | ✓ |  |
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
| ~~Aset & Peralatan → Set Peralatan~~ (disembunyikan, OD5) |  |  |  |  |  |  |  |  |  |  |
| Aset & Peralatan → Penghapusan Aset | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Aset & Peralatan → Penyusutan | ✓ |  |  |  |  |  | ✓ |  |  |  |
| Pengadaan → Pemasok | ✓ |  |  |  |  |  |  |  | ✓ |  |
| Pengadaan → Permintaan Pembelian | ✓ |  |  |  |  |  | ✓ | ✓ |  |  |
| Pengadaan → Pesanan Pembelian | ✓ |  |  | ✓ |  |  |  |  |  |  |
| Pengadaan → Penerimaan Barang | ✓ |  |  | ✓ |  |  |  |  | ✓ |  |
| Pengadaan → Retur Pembelian | ✓ |  |  | ✓ |  |  |  |  |  |  |
| **Sumber Daya Manusia** | | | | | | | | | | |
| Karyawan | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |
| Tugas (Teknisi dan Pek. Lepas: milik sendiri, D4) | ✓ | ✓ |  |  |  |  | ✓ | ✓ |  | ✓ |
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
| Log Audit (hanya Pemilik, OA8) | A | A | A | A | A | A | A | A | A | A |
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
| Keuangan → Aset tetap | Manajer Proyek | + Keuangan | OB5 |
| Keuangan → Pembayaran pemasok | tidak ada | Pemilik, Keuangan **[baru]** | OB3 |
| Aset & Peralatan → Set Peralatan | Pemilik, Manajer Proyek | Disembunyikan | OD5 |

### 2.1 Menu per orang (sesudah keputusan)

| Orang | Menu yang tampil |
|---|---|
| **Aqim** (Pemilik, SDM, admin aplikasi) | Semua menu. Organisasi disembunyikan. Termasuk Gudang, Pengguna, Log Audit, dan Pengaturan → Penggajian (khusus admin aplikasi) |
| **Agus MD** (Penjualan) | Dasbor; CRM (Prospek, Pelanggan); Penjualan (SPH, Sales order, Surat Jalan, Retur Penjualan); Langganan & Lisensi (semua, termasuk Kunci API); Produk, Komponen, Material, Kategori barang; Peminjaman aset; Dokumen; Katalog Website; WhatsApp AI (Percakapan, FAQ) |
| **Bilal** (Penjualan, Gudang, Layanan Pelanggan, Pemasaran) | Menu Agus MD, **ditambah**: Proyek, Tiket, Garansi; Anggaran proyek (lihat MN1); Gudang (bila ditunjuk PIC); Stok, Penyesuaian Stok, Mutasi Barang; Pesanan Pembelian (baca), Penerimaan Barang, Retur Pembelian; Webhook (n8n) |
| **Agus** (Manajer Proyek, Teknisi, Gudang) | Dasbor; Pelanggan (baca); Sales order (baca), Surat Jalan, Retur Penjualan; Anggaran proyek, Aset tetap (lihat MN1, MN2); Proyek, Tiket, Garansi; Gudang (bila ditunjuk PIC); Produk dan Barang (termasuk Stok, Penyesuaian, Mutasi); menu Aset & Peralatan (tanpa Set Peralatan); Permintaan Pembelian, Pesanan Pembelian (baca), Penerimaan Barang, Retur Pembelian; Tugas; Dokumen |
| **Jamil** (Manajer Proyek, Teknisi), **Hatta** (Manajer Proyek) | Dasbor; Pelanggan (baca); Anggaran proyek, Aset tetap; Proyek, Tiket, Garansi; menu Aset & Peralatan (tanpa Set Peralatan); Permintaan Pembelian; Tugas; Dokumen |
| **Fahri, Alex, Ade** (Teknisi) | Dasbor; Anggaran proyek (lihat MN1); Proyek, Tiket, Garansi; Peminjaman aset (dari daftar unit khusus, OD1); Permintaan Pembelian; Tugas (milik sendiri); Dokumen. Kasbon lewat **portal karyawan** (OB13) |
| **Bella** (Keuangan gabungan) | Dasbor; Penjualan (semua, termasuk Faktur, Uang Muka, Kuitansi); semua menu Keuangan (Aset tetap ditambahkan, OB5; Pembayaran pemasok baru, OB3); semua Pajak; Proyek, Garansi, Lisensi (baca); Nilai Persediaan, Produk, Barang (baca), Pemasok, Penerimaan Barang (baca); Karyawan, Penggajian; Dokumen; Laporan → Arsip Bulanan |
| **Dafrin, Oki** (Pekerja Lepas) | Dasbor; Tugas (milik sendiri); Dokumen (Berkas, Tanda tangan, Templat) |

Semua orang juga melihat **Pengaturan → Dokumen** dan **Dokumen → Templat**
(lihat MN3, MN4).

Menu akun pribadi ada di menu pengguna (pojok kanan atas): **Profil** dan
**Akun** (nama pengguna, email, kata sandi, sesi). Menu ini terbuka untuk
semua orang.

### 2.2 Portal karyawan (`apps/web-employee`)

Dibuka oleh semua orang yang punya **data karyawan**: semua karyawan kecuali
Pekerja Lepas (OG4). Dafrin dan Oki tidak punya (X4), dan Aqim tidak memakai
portal ini (OG5).

| Bagian | Menu |
|---|---|
| Dasbor | Dasbor |
| SDM | Absensi, Jadwal Kerja, Cuti, Lembur, Tugas |
| Keuangan | **Kasbon [baru]** (ajukan, lihat status, pertanggungjawaban; OB13, RO6) |
| Laporan | **Laporan Kerja [baru]** (harian; ringkasan mingguan dan bulanan; LK-1–LK-7, B-44) |

Menu dan kartu "Hari ini" portal karyawan mengikuti penempatan, jenis Freelance, dan ada/tidaknya tugas lapangan hari itu; rincian tampilan di `3-rancangan/rancangan-karyawan-kantor-lapangan-freelance.md` bagian 6.
| Proyek | Proyek, **Riwayat absen lokasi [baru]** (OG2) |
| Dokumen | Berkas, Tanda tangan |
| Akun | Penggajian (slip gaji) |

Profil dan notifikasi dibuka dari menu pengguna dan ikon lonceng. Di ponsel,
bilah bawah berisi Dasbor, Absensi, Cuti, dan Tugas. **Menu tidak dibedakan
per role**: semua karyawan melihat menu yang sama, dan isinya dibatasi di
server (data milik sendiri).

Halaman masuk portal karyawan mendapat tautan **Lupa kata sandi [baru]**
(OG3), tanpa tombol Google (K13).

### 2.3 Portal pelanggan (`apps/web-customer-portal`)

Untuk akun pelanggan. Menunya sama untuk semua pelanggan:
- Bilah bawah (ponsel): Beranda, Pesanan, Lacak, Bantuan, Profil.
- Menu atas (desktop): sama, ditambah pencarian dan notifikasi. Menu tarik
  berisi Dasbor, Pesanan Saya, Lacak Pesanan, Penawaran (SPH), Tiket Bantuan,
  Notifikasi, Wishlist, Pengaturan Akun, dan Keluar.

Tidak ada keranjang belanja. Pesanan hanya dilihat dan dilacak.

**[ubah]** Masuk dan daftar memakai **Google** dengan **satu jenis akun**
(K13, OA4). Pilihan perorangan/perusahaan di halaman masuk dan daftar hilang;
data perusahaan diisi belakangan di Profil.

### 2.4 Portal investor (`apps/web-investor`)

Masih templat kosong bawaan Vite: tidak ada menu dan form. Sesuai OE3,
dibiarkan di repo dan ditandai "belum dimulai".

---

## 3. Usulan perapian menu (belum diputuskan, kecuali yang ditandai)

Temuan dari perhitungan di atas. Semua hanya mengubah **menu**, bukan hak di
server, kecuali yang disebut lain.

| No | Temuan | Usulan | Wilayah |
|---|---|---|---|
| MN1 | **Anggaran proyek** (di bawah Keuangan) tampil untuk Teknisi dan Layanan Pelanggan, karena menu ini hanya meminta hak baca proyek. Isinya anggaran per akun, jadi data keuangan | Menu meminta hak lihat biaya proyek (`project.read_cost`): tinggal Pemilik, Manajer Proyek, Keuangan | Oki (M09) |
| MN2 | *Sebagian sudah tercakup keputusan (OB5).* **Aset tetap** (di bawah Keuangan) tampil untuk Manajer Proyek. Di kode sekarang **tidak tampil untuk Keuangan**; itu sudah diputuskan diperbaiki lewat OB5 (Bella membuka Aset tetap dan Anggaran proyek; sudah tercermin di tabel). Sisa pertanyaannya: apakah Manajer Proyek tetap melihatnya. Catatan: form di halaman itu (kapitalisasi, jalankan penyusutan) butuh hak posting jurnal, yang hanya dimiliki Keuangan dan Pemilik. Hal yang sama berlaku untuk Aset & Peralatan → Penyusutan dan Penghapusan Aset | Aset tetap, Penyusutan, Penghapusan: Pemilik dan Keuangan saja. Manajer Proyek tetap melihat Register Aset, Peminjaman, Catatan Servis, Set Peralatan | Oki (M06, M09) |
| MN3 | **Pengaturan → Dokumen** tampil untuk semua orang, termasuk Pekerja Lepas. Isinya pengaturan perusahaan (kop dokumen, dsb.) dan hanya bisa diubah Pemilik | Hanya Pemilik dan admin aplikasi | Bersama (K11) |
| MN4 | **Dokumen → Templat** tampil untuk semua orang, padahal halamannya masih "segera hadir" (ERP-0050) | Sembunyikan sampai halamannya dibuat | Bersama (K11) |
| MN5 | *Sebagian tercakup K10 (hanya Pemilik).* **Bonus & Investor** hanya tampil untuk Pemilik (K10), tetapi ketiga halamannya masih "segera hadir" | Sembunyikan seluruh grup sampai M11 dibangun | Oki (M11) **[Diubah 28/11, IV-1: M11 dibangun lengkap sekarang, `rancangan-investor-m11.md`]** |
| MN6 | **Pekerja Lepas** melihat Berkas, Minta tanda tangan, dan Templat | Cukup Tugas dan Tanda tangan saya | Bersama (K11) |
| MN7 | ***Sudah tercakup keputusan OB13/RO6:** kasbon diajukan dan dilihat di portal karyawan, jadi pilihan (a).* Teknisi, Manajer Proyek, dan Pekerja Lepas punya hak **mengajukan kasbon dan pertanggungjawaban**, tetapi formnya ada di Keuangan → Beban. Menu itu meminta hak baca klaim biaya, yang tidak mereka punya, jadi mereka **tidak bisa membuka form tersebut**. Portal karyawan juga tidak punya form kasbon | (a) Tambah menu "Kasbon saya" di portal karyawan. (b) Buka Keuangan → Beban dengan isi terbatas milik sendiri | Oki (M09) |

---

## 4. Form web-admin

Kolom **Siapa** memakai role sesudah keputusan. "Pemilik" selalu termasuk
karena Pemilik memegang semua hak, jadi hanya ditulis bila ia satu-satunya.

Jenis isian: teks, angka, uang (rupiah), tanggal, pilihan, pilihan dengan
pencarian, teks panjang, unggah berkas, centang, **tabel baris** (baris bisa
ditambah).

### 4.1 CRM (9 form)

**[ubah] (OA4):** daftar pelanggan diberi filter **pelanggan biasa / pelanggan bisnis**.

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Lead baru / ubah lead | Prospek | Nama, perusahaan, telepon, WhatsApp, email (minimal satu kontak), sumber (pilihan), perkiraan nilai (uang), follow-up berikutnya (tanggal-jam), kebutuhan (teks panjang) | Penjualan |
| Ubah status lead | Detail lead | Status; alasan kalah (bila kalah) | Penjualan |
| Tugaskan lead | Detail lead | Petugas (pilihan pengguna) | Penjualan |
| Catat follow-up | Detail lead | Jenis, follow-up berikutnya, catatan | Penjualan |
| Jadikan pelanggan | Detail lead | Mode baru/sudah ada; kode, nama, email; atau cari dan pilih pelanggan | Penjualan |
| Orang baru / ubah pelanggan (perorangan) | Pelanggan | Foto, kode, nama, jabatan, perusahaan (pilih atau buat baru + jenis), pemilik perusahaan (centang), email, telepon, status, catatan | Penjualan |
| Perusahaan baru / ubah | Pelanggan | Kode, jenis pelanggan, nama, nama resmi, NPWP, email, telepon, situs web, pemilik, status, catatan | Penjualan (Layanan Pelanggan, Pemasaran, Manajer Proyek hanya melihat; Lembar 6) |
| Tambah alamat | Detail pelanggan | Jenis, label, alamat, kode pos, utama (centang) | Penjualan |
| Undang ke portal | Detail pelanggan → Portal pelanggan | Nama, email, peran | Penjualan, Layanan Pelanggan |

### 4.2 Penjualan (18 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| SPH baru / ubah | SPH | Pelanggan (cari), kepada (attention), judul, pembuka, tanggal, berlaku sampai, garansi, syarat bayar; **tabel baris**: barang (cari) atau baris bebas, nama, spesifikasi, jumlah, satuan, harga, diskon; PPN (centang + tarif); **jadwal bayar**: label, persen; syarat, catatan | Penjualan. **[ubah] (OC4):** tarif PPN terisi dari master pajak yang berlaku pada tanggal SPH; mengubah tarif wajib mengisi alasan |
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

Uang Muka, daftar Faktur, Kuitansi, dan daftar SO hanya berupa daftar. Menu Uang Muka terbuka untuk pemegang hak invoice (C2). **[ubah] (C1):** status SO berubah sendiri menjadi Terkirim saat semua barang terkirim dan Selesai saat lunas; tidak ada tombol status. SPH buatan Aqim boleh disetujui Aqim sendiri (K1); SPH Agus MD disetujui Bilal dan sebaliknya (K2b). Penghapusan piutang yang disetujui **langsung menjadi beban** (OB10).

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
| Karyawan baru | Karyawan | Nama lengkap, email, telepon, NIK, jenis kepegawaian (**+ Freelance**, KL-3), jenis kerja, **penempatan Kantor/Lapangan** (KL-1), **tarif freelance harian/borongan** (KL-4), tanggal masuk, role | SDM |
| Ubah karyawan | Detail karyawan | Kode, nama, panggilan, NIK, telepon; status, jenis, jenis kerja, role, tanggal masuk/keluar; NPWP, PTKP, no. BPJS Kesehatan dan Ketenagakerjaan | SDM |
| Tambah dokumen karyawan | Detail karyawan | Jenis dokumen, judul; lalu unggah berkas per baris | SDM |
| Periode gaji baru | Detail karyawan | Berlaku mulai, gaji pokok, tunjangan | SDM, Keuangan |
| Tambah rekening | Detail karyawan | Jenis rekening, bank, nomor, pemilik, utama, aktif | SDM, Keuangan |
| Tugas baru / ubah | Tugas | Karyawan, judul, rincian, tenggat | SDM, Manajer Proyek. Teknisi dan Pekerja Lepas hanya melihat dan mengubah status tugasnya sendiri (D4) |
| Tambah / ubah jadwal | Jadwal Kerja | Libur (sakelar), jam mulai, jam selesai, label | SDM |
| Isi dari pola | Jadwal Kerja | Dari, sampai, karyawan (atau semua), pola shift | SDM |
| Lembar absensi harian | Absensi | Tanggal; **per karyawan**: status, jam masuk, jam pulang, catatan | SDM |
| Impor absensi | Absensi | Berkas .xlsx/.csv (ada templat) | SDM |
| Catat cuti | Cuti | Karyawan, jenis cuti, mulai, selesai, alasan | SDM |
| Catat lembur | Lembur | Karyawan, tanggal, jam, alasan | SDM |
| Tambah / ubah baris gaji | Penggajian | Karyawan, gaji pokok, tunjangan, lembur, bonus, potongan (uang), bersih (dihitung), catatan | SDM, Keuangan |
| Impor gaji | Penggajian | Berkas .xlsx/.csv | SDM, Keuangan |

"Setujui bulan ini" (gaji) hanya konfirmasi; hanya Pemilik (boleh untuk gaji yang ia siapkan sendiri, K1). Cuti Aqim tidak dicatat lewat aplikasi (A3a). Karyawan baru otomatis punya akses portal karyawan (OG4); undangan akun tetap dikirim Pemilik (OA12).

### 4.7 Keuangan (27 form + 3 di detail SO/invoice; +1 baru, 2 pindah ke portal karyawan)

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
| Kapitalisasi barang | Aset tetap | Barang, akun lawan, tanggal kapitalisasi, golongan fiskal | Keuangan (menu dibuka, OB5) |
| Jalankan penyusutan | Aset tetap | Tahun, bulan | Keuangan (menu dibuka, OB5) |
| Rekonsiliasi baru | Rekonsiliasi | Akun kas, tanggal, saldo rekening koran | Keuangan |
| Tambah item koran + cocokkan | Detail rekonsiliasi | Tanggal, referensi, jumlah; per item: cocokkan ke buku, catat sebagai akun | Keuangan |
| Impor rekening koran | Rekonsiliasi | Unggah CSV, pemetaan kolom | Keuangan |
| Tagihan manual | Utang | Pemasok, tanggal, jatuh tempo, subtotal, pajak, **akun beban [ubah] (OB14)** | Keuangan |
| **Pembayaran pemasok [baru] (OB3)** | Keuangan → Pembayaran pemasok | Pemasok, tagihan yang dibayar (bisa beberapa), kas/bank, tanggal, jumlah, **potongan PPh** (jenis dan jumlah), referensi. Rincian isian dibahas saat desain | Keuangan, Pemilik |
| Tagihan dari PO | Utang | PO, no. faktur pemasok, tanggal, jatuh tempo; jumlah per baris | Keuangan |
| Batalkan pembayaran | Utang / Piutang / Beban | Alasan (kotak prompt browser, lihat FR2) | Keuangan |
| Klaim biaya baru / ubah | Beban | Karyawan, tanggal, proyek, catatan; **tabel baris**: tanggal, kategori, keterangan, jumlah, pajak | Keuangan |
| Bayar klaim | Detail klaim | Kas/bank, tanggal, jumlah, referensi | Keuangan |
| Ajukan kasbon | **Pindah ke portal karyawan (OB13)**; di web-admin tinggal daftar dan persetujuan | Karyawan, tanggal, jumlah, keperluan | Teknisi lewat portal karyawan (bagian 5.1). Disetujui Aqim |
| Pertanggungjawaban | **Pindah ke portal karyawan (OB13)** | Tanggal; **tabel baris**: kategori, keterangan, jumlah, pajak | Teknisi, Manajer Proyek, Pekerja Lepas lewat portal karyawan. **Disetujui satu langkah oleh Aqim** (RO5) |
| Bayar (cairkan) kasbon | Beban → Kasbon | Sama dengan bayar klaim | Pemilik (Aqim mencairkan, OB13) |
| Siapkan / tutup periode | Tutup Periode | Tahun, bulan; tombol amortisasi dan tutup PPN | **Siapkan dan tutup:** Pemilik, Keuangan (RO1). **Buka kembali:** hanya Pemilik (RO4) |

Piutang dan Laporan Keuangan tidak punya form (daftar, filter, ekspor). Ekspor CSV laporan diperbaiki (OB12); arus kas mengabaikan jurnal nonkas (OB11).

**Berlaku untuk semua form Keuangan:**
- Setiap pilihan **akun** memakai pencarian ke server (OB2).
- Jurnal manual tetap dua orang: Bella membuat, Aqim menyetujui, atau sebaliknya (K1a).
- Teks bahasa Inggris di layar Keuangan diterjemahkan belakangan (OB15).

### 4.8 Pajak (8 form + 1 baru)

**[ubah] (OC1, OC4, OC7):** bug jenis pajak `vat` diperbaiki; tarif PPN diambil dari master bertanggal berlaku; masa pajak yang sudah ditutup hanya bisa dibaca.

Semua diisi **Keuangan**.

| Form | Dibuka dari | Isian |
|---|---|---|
| Tambah tarif | Jenis & Tarif Pajak | Kode, nama, tarif, berlaku mulai (jenis selalu PPN) |
| Catatan pajak baru | Catatan Pajak | Jenis pajak, tahun, bulan, DPP. **[ubah] (OC2):** jumlah pajak dihitung otomatis DPP × tarif |
| Ubah catatan pajak | Catatan Pajak | DPP |
| Pemotongan baru | Pemotongan Pajak | Kode, jenis pajak, lawan transaksi, dasar, jumlah pajak. **[ubah]:** masa bupot terisi otomatis dari tanggal transaksi (OC3); kode ganda ditolak dengan pesan jelas (OC6) |
| **Batalkan pemotongan [baru] (OC5)** | Pemotongan Pajak | Alasan (untuk pemotongan yang sudah terbayar) |
| Ubah pemotongan | Pemotongan Pajak | Jumlah pajak |
| Data Coretax | Pemotongan Pajak | Kode objek pajak, NPWP lawan, no. bukti potong, status |
| Tambah koreksi | Koreksi & Bukti | Catatan pajak, jumlah, alasan, ID dokumen bukti (teks, lihat FR1) |
| Tarif TER PPh 21 | Tabel PPh 21 | Unggah CSV. **Belum perlu diisi** karena PPh 21 dihitung di luar aplikasi (OC8) |

### 4.9 Inventaris dan Gudang (9 form)

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Gudang baru | Gudang | Foto, kode, nama, utama, aktif; alamat (label, jalan, RT, RW, kode pos, provinsi → kelurahan) | Admin aplikasi (Aqim) |
| Ubah gudang | Detail gudang | Sama dengan gudang baru | Aqim, PIC gudang |
| Tambah / ubah penyimpanan (bin) | Detail gudang → Penyimpanan | Kode, nama, jenis bin, kapasitas, aktif | Aqim, PIC gudang |
| Penanggung jawab | Detail gudang → Penanggung jawab | Pengguna (cari) | Aqim, PIC gudang |
| Organisasi tertaut | Detail gudang → Organisasi | Organisasi | Aqim (hilang di K12 tahap 3) |
| Barang baru / ubah | Produk, Komponen, Material | Kode, jenis, nama, SKU, nomor seri, kategori, merek, deskripsi, foto, harga jual, harga beli, satuan, stok minimum, barcode, berseri / dilacak jumlah / aktif, spesifikasi | Pemilik. **[ubah] (B3):** halaman ubah barang mengikuti hak `product.update`, tidak lagi khusus admin aplikasi |
| Susunan komponen/material | Detail barang | Barang (cari), jumlah | Pemilik |
| Kategori barang baru / ubah | Kategori barang | Slug, nama, urutan, nama pendek, deskripsi, aktif | Pemilik |
| Penyesuaian stok | Penyesuaian Stok | Gudang, jenis, kode alasan, catatan; **tabel baris**: barang, bin, stok sistem, stok hitung, harga pokok, selisih, catatan | Gudang membuat; Pemilik menyetujui dan memposting, termasuk penyesuaian buatannya sendiri (K1) |

### 4.10 Aset dan Peralatan (11 form, wilayah Oki; +1 baru, 2 disembunyikan)

**[ubah] (OD3, OD4):** semua nilai uang tampil dalam rupiah; semua isian ID diganti pilihan dengan nama.

| Form | Dibuka dari | Isian | Siapa |
|---|---|---|---|
| Daftarkan / ubah aset | Register Aset | Nama, jenis barang, nomor seri, harga perolehan, tanggal perolehan, lokasi, foto | Pemilik |
| Nonaktifkan aset | Detail aset | Alasan | Pemilik |
| Tempatkan / pindahkan | Detail aset | Gudang, penyimpanan | Pemilik |
| Kategori aset baru / ubah | Kategori Aset | Kode, nama, jenis barang, metode penyusutan, umur (bulan) | Pemilik |
| Peminjaman baru | Peminjaman | Jenis peminjam (pengguna / pelanggan / tamu: nama, telepon, jenis dan no. identitas, alamat, ref. dokumen), keperluan, tanggal kembali, catatan; **baris**: nomor seri | Penjualan, Layanan Pelanggan, Manajer Proyek, Teknisi. **[ubah]:** peminjam dipilih dengan nama, bukan ID (OD4); teknisi memilih dari **daftar unit khusus** (OD1) |
| Perpanjang peminjaman | Detail peminjaman | Tanggal kembali baru (prompt browser, FR2) | Gudang |
| ~~Set peralatan baru~~ | Set Peralatan | Nama | **Disembunyikan (OD5)** |
| ~~Tambah / hapus item set~~ | Set Peralatan | ID aset / ID item (teks) | **Disembunyikan (OD5)** |
| **Catat servis / kondisi [baru] (OD5)** | Detail aset → Catatan Servis | Tanggal, jenis (servis / cek kondisi), kondisi, keterangan, biaya. Rincian isian dibahas saat desain | Pemilik, Manajer Proyek |
| **Kembalikan peminjaman [ubah] (OD7)** | Detail peminjaman | **Kondisi per unit:** Baik / Rusak / Tidak lengkap; catatan. Unit hilang bisa menutup peminjaman | Gudang |
| Ajukan penghapusan aset | Penghapusan Aset | Aset, cara penghapusan, hasil penjualan. **[ubah] (OD6):** ditolak bila aset sedang dipinjam | Pemilik |
| Catat penyusutan manual | Penyusutan | Tahun, bulan, jumlah | Pemilik |

Setujui, serahkan, dan tandai hilang pada peminjaman berupa tombol.
Persetujuan peminjaman: Manajer Proyek, bukan miliknya sendiri (OD2, K7a).
**[ubah] (C13):** tombol Serahkan di Gudang baru aktif **setelah peminjaman
disetujui**.

### 4.11 Pengadaan (10 form)

Role Pembelian tidak dipakai (K2c), jadi pembelian dikerjakan Aqim.
**[ubah] (B1):** tombol **"Tandai terkirim" dihapus**. Alur PO: buat → ajukan →
setujui (Aqim boleh menyetujui PO-nya sendiri, K1) → langsung bisa diterima
Gudang di Penerimaan Barang. Kode pemasok otomatis dipersingkat supaya nomor
PO muat (K6).

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
| Gambar tanda tangan saya | Tanda tangan saya | Unggah gambar. **[ubah] (OG6):** menandatangani memakai pratinjau dokumen dan konfirmasi; pesan diterjemahkan | Semua role |
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
| PPh 21 dan BPJS | Pengaturan → Penggajian | PPh 21, BPJS Kesehatan/Ketenagakerjaan (sakelar), tarif JKK, batas upah . **PPh 21 dimatikan** (OC8) | Admin aplikasi |
| ~~Organisasi baru / ubah~~ | Organisasi | Gambar, nama, deskripsi, slug | **Disembunyikan (K12 tahap 1)** |
| Ubah role anggota | Pengguna → detail (pindah dari Organisasi → Anggota, K12) | Role (centang, bisa beberapa, D2); hanya role yang dipakai | Pemilik |
| Undang pengguna | Pengguna | Tunggal: email, nama, role, karyawan tetap (**isian organisasi dihapus**, K12). Massal: baris teks + role. Berkas: unggah. Pilihan role hanya role yang dipakai (K2) | **Pemilik saja** (OA12) |
| **Masuk (web-admin) [ubah]** | Halaman masuk | Nama pengguna/email, kata sandi; **tombol Google dihapus** (K13); pesan akun nonaktif dibedakan dari akun yang belum klaim undangan (OA14) | Semua staf |
| Profil | Menu pengguna → Profil | Foto, nama, bio | Semua |
| Nama pengguna | Menu pengguna → Akun | Nama pengguna | Semua |
| Email | Menu pengguna → Akun | Email baru | Semua |
| Kata sandi | Menu pengguna → Akun | Lama, baru, ulangi; keluar dari sesi lain | Semua |

Hapus undangan dan nonaktifkan pengguna di Pengguna memakai **dialog konfirmasi** (OA13). Log Audit hanya dibaca Pemilik (OA8).

**Jumlah form web-admin: 148** di kode sekarang; sesudah keputusan **+5 baru** (pembayaran pemasok, batalkan pemotongan, catat servis/kondisi, dan dua form kasbon yang pindah ke portal karyawan dihitung di 5.1) dan **−4 disembunyikan** (dua form set peralatan, organisasi baru/ubah) (CRM 9, Penjualan 18, Proyek/Tiket 13,
Lisensi 5, Integrasi 3, SDM 14, Keuangan 27, Pajak 8, Inventaris 9, Aset 11,
Pengadaan 10, Dokumen 6, Pengaturan/Administrasi/Akun 15).

---

## 5. Form portal

### 5.1 Portal karyawan (10 form + 3 baru)

Diisi oleh karyawan untuk dirinya sendiri.

| Form | Isian |
|---|---|
| Masuk | Email/nama pengguna, kata sandi (tanpa Google, K13); pesan akun nonaktif dibedakan (OA14) |
| **Lupa kata sandi [baru] (OG3)** | Email |
| **Ajukan kasbon [baru] (OB13)** | Tanggal, jumlah, keperluan, proyek (opsional); daftar kasbon sendiri dengan status |
| **Pertanggungjawaban kasbon [baru] (RO6)** | Tanggal; **tabel baris**: kategori, keterangan, jumlah, pajak, foto nota |
| Ajukan cuti | Jenis cuti, alasan, mulai, selesai |
| Catat lembur | Tanggal, jam, alasan |
| Data pribadi | Nama panggilan, telepon, alamat, kode pos |
| Keamanan akun | Kata sandi lama, baru, ulangi; keluar |
| Tanda tangan saya | Unggah gambar. **[ubah] (OG6):** menandatangani memakai pratinjau dokumen dan konfirmasi; pesan diterjemahkan |
| Tolak permintaan tanda tangan | Alasan |
| Tambah / ubah tugas proyek | Judul, tahap, tenggat, petugas |
| Unggah bukti proyek | Foto, jenis bukti, tugas, catatan |
| Check-in / check-out di lokasi proyek | Swafoto (kamera), catatan. **[ubah] (OG1, PK-1):** di luar radius **ditolak**, baik saat datang maupun pulang. **[baru] (OG2):** riwayat absen lokasi sendiri |

Absen masuk dan pulang berupa **tombol satu klik** tanpa isian.

### 5.2 Portal pelanggan (24 form)

| Kelompok | Form dan isian |
|---|---|
| Masuk dan daftar **[ubah]** | **Masuk dengan Google**, satu jenis akun (K13, OA4). Pilihan perorangan/perusahaan dan daftar dengan kata sandi hilang; verifikasi email dan lupa/atur ulang kata sandi tidak dipakai lagi untuk akun Google. Data perusahaan (nama, NPWP, industri) diisi belakangan di Profil |
| Akun dan perusahaan | Penyiapan awal (alamat lokasi utama, undang anggota + peran approver/finance/viewer); Profil pribadi (nama, telepon, jabatan); Ubah perusahaan (nama resmi, NPWP, industri); Undang anggota (email, peran, batas persetujuan min. Rp1.000.000); Lokasi baru / ubah (nama, alamat, kontak, telepon, utama) |
| Pengaturan | Ganti kata sandi; Hapus akun (kata sandi, centang); Bahasa; Perangkat (cabut sesi) |
| Bantuan | Tiket baru (kategori, prioritas, produk, judul, deskripsi, foto/video maks. 5 × 25 MB); Chat tiket (teks, lampiran); Pesan servis (jenis servis, produk, tanggal, jam); Daftarkan perangkat (nomor seri) |
| Penawaran dan bayar | Terima SPH (no. PO, approver, setuju); Minta revisi SPH (topik, pesan, lampiran); Klaim RFQ (referensi + OTP); Bayar invoice (metode bayar) |
| Lacak | Nomor pelacakan |

---

## 6. Temuan pada form (belum diputuskan, kecuali yang ditandai)

| No | Temuan | Contoh | Usulan |
|---|---|---|---|
| FR1 | *Untuk layar aset sudah tercakup OD4; sisa: koreksi pajak.* Isian **ID mentah** yang harus diketik manual | Peminjaman (ID pengguna/pelanggan), Set peralatan (ID aset/item), Koreksi pajak (ID dokumen bukti) | Ganti dengan pilihan yang bisa dicari |
| FR2 | **Kotak prompt browser**, bukan dialog | Batalkan pembayaran, perpanjang peminjaman | Ganti dengan dialog biasa (alasan / tanggal) |
| FR3 | **Tolak tanpa alasan** | Cuti, lembur, klaim biaya, penyesuaian stok (OC5 sudah menambah alasan untuk batal pemotongan pajak) | Tambah isian alasan, seperti SPH, PO, dan PR |
| FR4 | **Form sebaris tanpa label** (hanya placeholder) | Transaksi kas, saldo awal, tagihan manual, baris pajak, rekonsiliasi | Tambah label isian |
| FR5 | **Unggah berkas** dan **tautan berbagi** di Dokumen hanya bisa dilakukan Pemilik, karena tidak ada role lain yang punya hak ubah dokumen | — | Tentukan siapa saja yang boleh mengunggah (bagian dari K11) |
| FR6 | Dengan K2d, Bella memegang hak **mengajukan dan menyetujui penghapusan piutang** sekaligus (dulu dipisah Keuangan dan Akuntan) | Server sudah menolak menyetujui pengajuan sendiri (`receivable-adjustment.service.ts:205`), jadi penghapusan piutang yang diajukan Bella **harus disetujui Aqim** | Tidak perlu ubah kode; cukup dicatat (sama dengan jurnal, K1a) |
| FR7 | ***Sudah tercakup keputusan B3.*** Halaman **ubah barang** dikunci untuk admin aplikasi saja, padahal B3 = ikut hak role | — | Ikut hak `product.update` (sesuai B3) |
| FR8 | ***Sudah tercakup keputusan K13 dan OA4*** (sisa: teks portal ke bahasa Indonesia). **Portal pelanggan** masih punya jenis akun perorangan/perusahaan dan login email + kata sandi, padahal keputusannya **satu jenis akun dengan Google** (OA4, K13). Teks portal masih bahasa Inggris dan ditulis langsung di kode | Masuk, Daftar langkah 1–2 | Sesuaikan saat K13 dikerjakan; teks ke bahasa Indonesia |
| FR9 | Beberapa form portal pelanggan (wishlist, pesan servis, daftarkan perangkat, bayar invoice, klaim RFQ) **belum dicek** apakah sudah tersambung ke ERP | — | Cek saat UAT portal (M07) |
| FR10 | ***Sudah tercakup keputusan K12 tahap 1.*** Form **Undang pengguna** masih punya pilihan organisasi | — | Hilang di K12 tahap 1 |
