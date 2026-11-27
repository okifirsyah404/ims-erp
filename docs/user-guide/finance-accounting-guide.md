# Panduan Keuangan & Akuntansi — Pengguna Non-Teknis

Versi: 2026-11-27 · berlaku untuk UI web admin setelah pembaruan Finance & Tax
(ERP-0169…ERP-0176). Nama layar dan tombol memakai bahasa Indonesia. Jika
tampilan diubah ke English, nama field mengikuti terjemahan bahasa Inggris.

Panduan ini menjelaskan **apa yang harus dilakukan akuntan / staf keuangan**
di menu **Keuangan** dan **Pajak**, bukan cara memprogram sistem. Untuk alur
penjualan, pengadaan, gudang, dan proyek, lihat [id.md](id.md).

## Daftar isi

1. [Siapa mengerjakan apa](#1-siapa-mengerjakan-apa)
2. [Konsep yang perlu dipahami](#2-konsep-yang-perlu-dipahami)
3. [Persiapan awal (sekali)](#3-persiapan-awal-sekali)
4. [Aktivitas harian](#4-aktivitas-harian)
5. [Kas & bank](#5-kas--bank)
6. [Rekonsiliasi bank](#6-rekonsiliasi-bank)
7. [Jurnal manual dan koreksi](#7-jurnal-manual-dan-koreksi)
8. [Saldo awal](#8-saldo-awal)
9. [Aset tetap, biaya proyek, dan pusat biaya](#9-aset-tetap-biaya-proyek-dan-pusat-biaya)
10. [Menutup dan mengunci bulan](#10-menutup-dan-mengunci-bulan)
11. [Laporan keuangan](#11-laporan-keuangan)
12. [Pajak](#12-pajak)
13. [Batasan dan kebiasaan yang baik](#13-batasan-dan-kebiasaan-yang-baik)

---

## 1. Siapa mengerjakan apa

Menu dan tombol mengikuti hak akses peran. Pemeriksaan utama ada di server,
jadi tombol yang terlihat tetap bisa ditolak bila akun tidak berhak.

| Peran | Yang biasa dikerjakan |
|---|---|
| **Pemilik / Admin** | Semua: membuka bulan, menutup/mengunci, membuka kembali, persetujuan akhir, pengaturan |
| **Akuntan** | Bagan akun, jurnal manual (draft → setuju → posting), aturan posting, penutupan periode, verifikasi pajak, semua laporan. **Tidak** membuat transaksi kas/bank |
| **Keuangan** | Invoice, kuitansi, pembayaran, tagihan pemasok, kas & bank, klaim biaya, ekspor laporan. **Tidak** membuka/menutup periode dan **tidak** memposting jurnal manual |
| **Auditor** | Hanya melihat data dan laporan |

Aturan penting: **pembuat tidak menyetujui dokumennya sendiri**. Jurnal manual
yang dibuat satu orang harus disetujui orang lain. Pemilik/Admin bisa menjadi
pemberi persetujuan bila organisasi hanya punya satu akuntan.

---

## 2. Konsep yang perlu dipahami

- **Buku besar** adalah satu-satunya sumber angka keuangan. Setiap kejadian
  keuangan—invoice, pembayaran, penerimaan barang, gaji, pajak—akhirnya
  menjadi jurnal yang seimbang.
- **Jurnal** selalu memakai **Debit = Kredit**. Sistem menolak jurnal yang tidak
  seimbang.
- **Jurnal sistem** dibuat otomatis oleh modul lain setelah dokumennya disetujui
  (misalnya invoice diterbitkan). Jurnal ini langsung berstatus **Diposting**.
- **Jurnal manual** dibuat dari menu **Jurnal**. Statusnya:
  `Draf → Diajukan → Disetujui/Diposting`. Draf dan yang sudah diajukan **belum**
  bernomor dan **masuk laporan hanya setelah diposting**.
- **Reversal** adalah pembalikan jurnal. Jurnal yang sudah diposting **tidak
  diubah atau dihapus**; kesalahan diperbaiki dengan reversal yang alasannya
  wajib diisi. Laporan menjumlahkan jurnal asli dan reversal sehingga efek
  bersihnya nol.
- **Periode**bulanan bisa berstatus:
  - **Terbuka**: semua transaksi boleh masuk.
  - **Ditutup**: hanya jurnal penyesuaian manual yang boleh dipost.
  - **Terkunci**: tidak ada transaksi lagi yang boleh masuk.
- **Uang** ditampilkan dalam rupiah. Perhitungan pajak dibulatkan ke rupiah
  penuh (pembulatan setengah ke atas).
- **GR/IR** adalah akun sementara "barang diterima, tagihan belum ada". Saat
  tagihan pemasok dicatat, akun ini dikurangi dan diganti ke utang usaha.
- **Maker-checker** berarti pembuat dokumen dan pemberi persetujuan harus
  berbeda orang.

---

## 3. Persiapan awal (sekali)

Dilakukan oleh Pemilik/Admin atau Akuntan sebelum bulan berjalan.

1. **Pengaturan → Perusahaan**: isi nama dan identitas perusahaan. Ini dipakai
   di dokumen cetak dan ekspor.
2. **Keuangan → Bagan Akun**: periksa daftar akun. Kode akun berbentuk
   `X-XXXX`, misalnya `1-1310` Piutang Usaha, `2-1100` Utang Usaha, `4-1100`
   Pendapatan. Akun **Bisa diposting** adalah akun leaf; akun header tidak
   menerima baris jurnal.
   - Kode, tipe, dan saldo normal **tidak bisa diubah** setelah akun dibuat.
   - Akun yang sudah punya jurnal tidak bisa diarsipkan; cukup dinonaktifkan
     bila saldonya nol dan tidak dipakai aturan posting aktif.
3. **Keuangan → Aturan Posting**: di sini ditentukan akun buku besar untuk
   setiap kejadian bisnis. Modul operasional hanya menyebut "peran", misalnya
   `receivable` atau `expense`; sistem memilih aturan **paling spesifik** yang
   cocok. Bila aturan belum ada, transaksi bisnisnya **gagal**—jangan mengubah
   aturan ini tanpa keputusan keuangan.
4. **Keuangan → Pusat Biaya** (opsional): dipakai bila ingin melihat laba rugi
   per pusat biaya. Kode tidak bisa diubah setelah dibuat.
5. **Keuangan → Kas & Bank**: buat akun kas/bank dan **tautkan ke akun GL**.
   Tautan GL wajib sebelum transaksi pertama. Isi juga nomor rekening, atas
   nama, dan pemakaian invoice bila rekening itu dipakai di cetakan invoice.
6. **Keuangan → Penutupan Periode → Buat periode**: buka bulan berjalan.
   Penerimaan barang akan gagal dengan pesan "Accounting period not found"
   bila bulan belum dibuka.

---

## 4. Aktivitas harian

### 4.1 Penjualan → piutang → uang masuk

- Saat invoice diterbitkan oleh Sales, sistem membuat jurnal: **Debit Piutang**,
  **Kredit Pendapatan**, **Kredit PPN Keluaran**. Invoice uang muka (DP)
  memakai akun **Uang muka pelanggan**; saat termin berikutnya ditagih, DP
  dilepaskan.
- Kuitansi yang dicatat Sales memposting **Debit Kas/Bank / Kredit Piutang**
  dan mengurangi sisa tagihan di buku pembantu AR.
- Nota kredit dan penghapusan piutang ada di halaman **Piutang**. Penghapusan
  piutang wajib disetujui orang lain; seluruh sisa tagihan akan dihapuskan.

### 4.2 Pembelian → utang → uang keluar

- Penerimaan barang memposting **Debit Persediaan / Kredit GR/IR**. Barang
  non-stok (lisensi, jasa) tidak membuat jurnal persediaan.
- Tagihan pemasok dibuat di **Hutang** lewat tombol **Tagihan baru** (di header
  card) atau **Buat dari PO**. Saat tagihan **Dicatat**, sistem memposting
  **Debit GR/IR atau Beban/Aset + PPN Masukan / Kredit Utang Usaha**.
- Pembayaran pemasok dicatat di modul Pembayaran dan memposting **Debit Utang
  Usaha / Kredit Kas/Bank**.

### 4.3 Klaim biaya dan uang muka karyawan

- Klaim biaya masuk **Klaim biaya**. Menyetujui klaim memposting **Debit Beban
  per kategori + PPN Masukan / Kredit Utang Klaim**. Pembuat klaim tidak boleh
  menyetujui klaimnya sendiri.
- Uang muka karyawan dicatat sebagai **Uang Muka Karyawan**; penyelesaiannya
  mengurangi uang muka dan memposting beban atau utang klaim sesuai hasil
  verifikasi.

---

## 5. Kas & bank

Halaman **Keuangan → Kas & Bank** berisi dua card.

**Card Kas & Bank**

- Tombol **Akun kas/bank baru** ada di kanan atas card. Kode akun tidak bisa
  diubah setelah dibuat.
- **Tautan GL wajib** sebelum akun bisa dipakai. Saldo awal di sini hanya
  informasi; angka laporan tetap berasal dari buku besar.

**Card Transaksi**

- Tombol **Transaksi baru** membuka dialog. Isi: akun kas/bank, tanggal, arah
  (**Masuk** / **Keluar**), jumlah, **Akun lawan**, dan keterangan.
- Setiap transaksi memposting jurnal sendiri. Contoh: uang masuk dari
  penyertaan modal → **Debit Bank / Kredit Modal**.
- Tiga tombol di bawah card—**Bayar pajak**, **Bayar gaji / BPJS**, dan **Catat
  settlement payment gateway**—adalah jalan pintas untuk transaksi yang
  sudah punya aturan posting tersendiri.

> **Batasan yang diketahui:** akun **Keuangan** boleh membuat transaksi kas,
> tetapi daftar **Akun lawan** bisa kosong karena peran itu tidak diberi akses
> membaca Bagan Akun. Untuk sementara, transaksi kas manual sebaiknya dicatat
> oleh **Akuntan** atau **Pemilik/Admin**.

---

## 6. Rekonsiliasi bank

Halaman **Keuangan → Rekonsiliasi Bank**.

1. Klik **Rekonsiliasi baru** di header card. Pilih akun kas/bank, tanggal, dan
   **Saldo rekening koran**. Status awal: **Draf**.
2. Buka **Item rekening koran** pada baris yang ingin dikerjakan.
3. Tambah item koran satu per satu, atau impor CSV rekening koran (mapping
   kolom diatur dulu bila format bank berbeda).
4. Cocokkan setiap item ke transaksi kas dengan **Cocokkan ke transaksi kas**.
   Bila tidak ada transaksi kasnya, buat transaksi kas/bank dari item tersebut
   agar buku ikut berubah.
5. Klik **Tandai terekonsiliasi** hanya bila **semua item cocok** dan saldo
   rekening koran **sama persis** dengan saldo buku pada tanggal tersebut.
6. Klik **Tutup (permanen)** setelah selesai. Status berubah menjadi **Ditutup**.

Status yang mungkin: **Draf**, **Berlangsung**, **Terekonsiliasi**, **Ditutup**.

---

## 7. Jurnal manual dan koreksi

Halaman **Keuangan → Jurnal**.

1. Klik **Entri manual baru** di header card. Dialog berisi tanggal entri,
   keterangan, pilihan **Jurnal penyesuaian**, dan minimal dua baris.
2. Setiap baris pilih **Akun**, opsional **Pusat biaya**, lalu isi **debit**
   **atau** **kredit**—tidak keduanya.
3. Tombol **Tambah baris** menambah baris; **Hapus baris** menghapus baris
   (minimal dua baris tetap ada).
4. Tombol **Simpan draf** aktif hanya bila **Total debit = Total kredit** dan
   total lebih dari nol. Draf belum bernomor.
5. Draf diajukan, lalu disetujui oleh orang lain. Persetujuan sekaligus
   memposting jurnal dan memberikan nomor **JE**.
6. Untuk membetulkan jurnal yang sudah diposting, pilih **Reversal** dari menu
   aksi baris. Isi alasan. Bila bulan aslinya masih terbuka, tanggal reversal
   bisa dipilih di bulan itu; bila sudah ditutup/dikunci, sistem menempatkan
   reversal di hari pertama bulan berikutnya yang masih terbuka.

Jurnal sistem dari modul lain tidak perlu disetujui manual; dokumen asalnya
sudah melalui persetujuan di modul tersebut.

---

## 8. Saldo awal

Halaman **Keuangan → Saldo Awal** dipakai saat organisasi mulai pakai sistem
dan sudah punya saldo dari buku lama.

1. Klik **Tambah baris** di header card. Pilih akun, tanggal **per**, lalu isi
   **Saldo debit** atau **Saldo kredit**.
2. Ulangi sampai semua akun terisi. Baris masih berstatus **Draf** dan bisa
   dihapus.
3. Klik **Posting batch sebagai entri jurnal**. Sistem menolak bila total debit
   tidak sama dengan total kredit.
4. Seluruh baris diposting sebagai **satu jurnal**. Setelah itu batch tidak
   bisa diubah.

**Rincian piutang dan utang (AR/AP)** ada di card **Rincian piutang dan utang**.
Impor satu CSV per buku pembantu; total rincian harus sama dengan baris akun
kontrol sebelum batch boleh diposting. Rincian persediaan dan aset tetap belum
tersedia—saldo keduanya tetap di modul masing-masing.

---

## 9. Aset tetap, biaya proyek, dan pusat biaya

**Aset tetap** (`Keuangan → Aset Tetap`)

- Baris aset berasal dari barang inventori yang dikapitalisasi. Tombol
  **Kapitalisasi** ada di header card; pilih barang, akun lawan, tanggal, dan
  grup fiskal.
- Jalankan penyusutan untuk bulan/tahun tertentu lewat tombol **Jalankan**.
  Sistem membuat jurnal penyusutan.
- Card **Perbandingan fiskal** menampilkan penyusutan komersial versus fiskal;
  selisihnya bukan koreksi otomatis, hanya informasi.

**Anggaran proyek** (`Keuangan → Anggaran Proyek`)

- Versi anggaran dibuat per proyek, akun, dan bulan. Mode **Peringatkan** atau
  **Blokir** dipilih saat membuat versi.
- Sistem membandingkan anggaran dengan biaya aktual dan komitmen PO yang belum
  ditagihkan.

**Pusat biaya** bisa ditempelkan pada baris jurnal manual. Gunakan ini bila
laporan **Pusat biaya** dipakai; mengubah/nonaktifkan pusat biaya tidak
menghapus referensi di jurnal lama.

---

## 10. Menutup dan mengunci bulan

Halaman **Keuangan → Penutupan Periode**.

1. Pilih **Tahun** dan **Bulan**, klik **Terapkan**. Checklist akan menampilkan
   item yang masih terbuka, misalnya jurnal masih draf, rekonsiliasi belum
   selesai, atau item lain yang belum beres.
2. Gunakan tombol **Buat periode** di header card bila bulan belum ada.
3. Bila checklist aman, ubah status dari **Terbuka** menjadi **Ditutup**. Bulan
   tertutup hanya menerima jurnal penyesuaian manual.
4. Setelah yakin, kunci menjadi **Terkunci**—tidak ada transaksi lagi yang
   diterima. Penguncian menolak bila masih ada draf/submitted jurnal.
5. Membuka kembali periode terkunci dicatat di audit dan sebaiknya hanya
   Pemilik/Admin.

Laporan bulanan dapat diarsipkan dari halaman **Arsip Laporan Bulanan**.
Angka arsip tidak berubah walaupun ada posting berikutnya.

---

## 11. Laporan keuangan

Halaman **Keuangan → Laporan** sekarang memakai **card per bagian**, bukan tab.

**Card Periode laporan** di atas:

- **Dari** dan **Sampai** dipakai semua laporan yang mengukur rentang.
- **Per tanggal** hanya dipakai **Neraca**.
- Klik **Terapkan** setelah mengubah tanggal.

Tiga bagian di bawahnya:

1. **Laporan keuangan** — **Laba Rugi**, **Neraca**, **Arus Kas**. Tiap card
   punya tombol ekspor CSV sendiri: **Ekspor Laba Rugi (CSV)**,
   **Ekspor Neraca (CSV)**, **Ekspor Arus Kas (CSV)**.
2. **Buku besar** — **Neraca Saldo** (saldo awal + mutasi + saldo akhir,
   debit harus sama dengan kredit) dan **Buku Besar** (pilih satu akun untuk
   melihat saldo berjalan).
3. **Laporan manajemen** — **Paket manajemen** (pilih bulan, Ekspor Excel,
   Cetak/PDF lewat browser), **Proyeksi kas** 13 minggu, **Arus kas & ekuitas**,
   **Rasio**, **Profitabilitas**, **Biaya proyek**, dan **Pusat biaya**.

Catatan: filter dan halaman tidak tersimpan di alamat browser. Setelah
memuat ulang halaman, atur kembali tanggal/filter yang diinginkan.

---

## 12. Pajak

Menu **Pajak** menyediakan kertas kerja, **bukan** pengajuan otomatis ke DJP.

### 12.1 Jenis & Tarif Pajak

- Tarif bersifat **berlaku mulai pada tanggal tertentu**. Perubahan tarif
  dibuat sebagai baris baru, bukan mengubah baris lama.
- Sistem menolak dua baris aktif dengan kode sama yang masa berlakunya
  tumpang tindih.
- Tarif contoh yang disiapkan sistem: PPN 11%, PPh 23 2%, PPh 4(2) 10%.
  **Tarif contoh belum dikonfirmasi**—sesuaikan dengan keputusan perusahaan.

### 12.2 Catatan Pajak

- Satu kertas kerja per jenis pajak per periode. Klik **Catatan baru** di header
  card; dialog berisi jenis pajak, tahun, bulan, dan dasar pengenaan. Tombol
  **Pratinjau** menunjukkan pajak yang dihitung dari tarif aktif pada tanggal
  tersebut sebelum disimpan. Status kertas kerja:
  `Draf → Terverifikasi → Dilaporkan`.
- Jumlah dasar dan jumlah pajak bisa diubah **hanya saat masih Draf**.

### 12.3 Koreksi & Bukti

- Koreksi ditambahkan ke catatan yang sudah ada. Setiap koreksi mencantumkan
  jumlah, alasan, dan ID dokumen bukti.
- Jumlah pajak asli **tidak pernah ditulis ulang**. Status catatan menjadi
  **Dikoreksi**, dan **Rekap Periode** menampilkan neto terutang = pajak
  tercatat + koreksi aktif.

### 12.4 Pemotongan (PPh)

- Catatan pemotongan mencatat pajak yang dipotong atas pembayaran ke pihak
  lain. Status: `Tercatat → Terverifikasi → Terbayar`, atau `Dibatalkan`.
- Data **Tabel PPh 21** (PTKP, TER, Pasal 17) dipakai penggajian. Tabel TER
  **harus diimpor** dari CSV resmi; sistem tidak mengisinya sendiri. Bila belum
  ada, penggajian belum bisa memotong PPh 21.

### 12.5 Rekap Periode dan Coretax

- **Rekap Periode** menampilkan neto terutang per jenis pajak termasuk
  koreksi. Tahun dan bulan langsung mengubah data; tersedia **Ekspor CSV**
  dan **Ekspor XLSX**.
- Menu **Coretax** menyiapkan XML e-Faktur dan bukti potong untuk **diunggah
  manual** di Coretax. Format mengikuti template impor DJP sejauh yang
  diketahui sistem, tetapi **belum diverifikasi sampai uji impor berhasil**.

---

## 13. Batasan dan kebiasaan yang baik

1. **Jangan menutup bulan** sebelum klaim biaya, rekonsiliasi, dan kertas kerja
   pajak selesai. Checklist hanya pembantu; keputusan tetap akuntan/owner.
2. **Reversal, bukan hapus**: jurnal yang sudah diposting tidak dihapus. Bedakan
   jurnal sistem dan jurnal manual saat mencari sumber angka.
3. **Aturan posting sensitif**: mengubah aturan bisa mengubah akun di transaksi
   berikutnya. Uji dulu dengan satu transaksi kecil.
4. **Kode bersifat permanen** di Bagan Akun, Kas & Bank, dan Pusat Biaya.
5. **Simpan bukti** untuk koreksi pajak dan penghapusan piutang; sistem hanya
   menyimpan ID dokumen bukti.
6. **Ekspor bukan arsip resmi**: CSV/XLSX bisa diunduh ulang kapan saja.
   Arsipkan laporan bulanan bila angka harus dibekukan.
7. **Peran Keuangan tidak bisa membuka/menutup periode** dan tidak bisa
   memposting jurnal manual. Koordinasikan dengan Akuntan atau Pemilik.
8. **Filter tidak awet** setelah refresh—catat tanggal yang dipakai bila
   laporan akan dibandingkan kemudian.
9. **Tidak ada PDF server-side**: tombol **Cetak / PDF** memakai dialog cetak
   browser. Simpan sebagai PDF dari sana.

---

> Dokumen ini mengikuti tampilan aplikasi. Bila nama tombol berubah, perbarui
> panduan ini bersamaan dengan perubahan UI.
