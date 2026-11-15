# Panduan Pengguna — Penjualan, Pengadaan, Gudang, Proyek

Versi: 2026-11-06 · berlaku untuk branch `merge/main-sync` (port ADR-0011,
belum digabung ke `main`). English: [en.md](en.md). Diagram alur (UML):
[diagrams.md](diagrams.md).

Panduan ini menjelaskan cara memakai modul M02 (CRM & Penjualan), M05
(Pengadaan & Gudang) dan M07 (Proyek & Purnajual) di web admin. Bagian
**Catatan** di akhir berisi aturan penting dan keterbatasan yang diketahui.

## Daftar isi

1. [Memulai](#1-memulai)
2. [Peran dan hak akses](#2-peran-dan-hak-akses)
3. [Persiapan awal](#3-persiapan-awal)
4. [Penjualan: SPH → revisi → Deal → sales order](#4-penjualan-sph--revisi--deal--sales-order)
5. [Penagihan: invoice, uang muka, kuitansi](#5-penagihan-invoice-uang-muka-kuitansi)
6. [Pengadaan: PO → penerimaan barang → stok](#6-pengadaan-po--penerimaan-barang--stok)
7. [Gudang: stok, stok awal, nilai persediaan, surat jalan](#7-gudang-stok-stok-awal-nilai-persediaan-surat-jalan)
8. [Proyek, BAST, garansi, tiket servis](#8-proyek-bast-garansi-tiket-servis)
9. [Dokumen cetak dan penomoran](#9-dokumen-cetak-dan-penomoran)
10. [Catatan](#10-catatan)
11. [Notifikasi](#11-notifikasi)

Ringkasan alur lengkap: lihat diagram
[Alur menyeluruh](diagrams.md#1-end-to-end-flow-activity).

## 1. Memulai

1. Jalankan aplikasi dari root repo: `bun run dev` (backend di
   `http://localhost:3000`, web admin di `http://localhost:5173`).
2. Buka `http://localhost:5173` dan masuk.
   - Admin/owner: email dan kata sandi dari `apps/backend/.env`
     (`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`).
   - Akun contoh per peran (database dev saja):
     `<peran>.seed@entragate.local` dengan kata sandi `<peran>123456`, mis.
     `sales.seed@entragate.local` / `sales123456`.
3. Bahasa tampilan bisa diganti (Indonesia / English); dokumen cetak selalu
   berbahasa Indonesia.

## 2. Peran dan hak akses

Menu dan tombol menyesuaikan izin peran. Pemeriksaan sesungguhnya ada di
server, jadi tombol yang tampil pun tetap bisa ditolak bila tidak berhak.

| Peran | Pekerjaan utama |
|---|---|
| Owner / admin | Semua; menyetujui SPH, PO, penyesuaian stok; data induk; pengaturan |
| Sales | Pelanggan, prospek, SPH (buat, ajukan, kirim, revisi) |
| Sales manager | Menyetujui SPH, melihat semua SPH dan order |
| Finance | Invoice, uang muka, kuitansi; melihat harga pokok dan biaya proyek |
| Purchasing | Pemasok, PO; melihat harga pokok |
| Gudang (warehouse) | Penerimaan barang, surat jalan, stok; **tidak** melihat harga pokok |
| Project manager | Proyek, tugas, biaya, BAST, garansi, tiket |
| Teknisi | Hanya proyek/tiket yang ditugaskan kepadanya; tanpa biaya |
| Customer service | Tiket servis (buat, tugaskan, tutup) |

Aturan umum: **dokumen yang dibuat sendiri tidak bisa disetujui sendiri**
(SPH, PO, penyesuaian stok).

## 3. Persiapan awal

Dilakukan sekali oleh admin/owner.

1. **Pengaturan → Perusahaan**: nama resmi, nama dagang, kode perusahaan,
   tagline, NPWP, alamat, kode pos, telepon, email, situs web. Kode perusahaan
   adalah isi `{COMPANY}` di setiap nomor dokumen, jadi isi ini dulu - pratinjau
   nomor akan kosong sampai terisi.
2. **Pengaturan → Penomoran Kode**: periksa pola nomor dan kebijakan mulai-ulang
   setiap jenis kode (lihat [bagian 9](#9-dokumen-cetak-dan-penomoran)).
   Perubahan hanya berlaku untuk nomor yang terbit setelahnya; nomor yang sudah
   terbit tidak pernah berubah.
3. **Pengaturan → Dokumen**: unggah logo kop surat. Di bawahnya ada grup
   pengaturan `document` yang menyimpan nilai yang dibaca modul dokumen.
4. **Data induk**:
   - **CRM → Pelanggan** (kode pelanggan dipakai di nomor surat garansi).
   - **Inventaris → Barang**: SKU, nama, jenis, satuan, kategori, harga jual,
     foto untuk SPH, centang *bernomor seri* bila setiap unit punya SN. Kode
     barang dibuat otomatis dari jenisnya dan tidak bisa diubah kemudian.
   - **Pengadaan → Pemasok** (data bank hanya terlihat oleh yang berhak).
   - **Inventaris → Gudang** dan lokasi simpan (hanya admin global).
5. **Stok awal** bila barang sudah ada di gudang: lihat
   [bagian 7.2](#72-stok-awal-dan-penyesuaian).

> Nama & jabatan penandatangan, rekening bank pada invoice, syarat SPH/invoice
> bawaan dan teks garansi **tidak bisa lagi diedit dari antarmuka** (sejak
> 2026-11-13): masing-masing akan punya halaman sendiri. Nilai yang sudah
> tersimpan tetap tercetak di dokumen; instalasi baru mencetak dokumen tanpa
> baris penandatangan sampai halaman tersebut ada.

## 4. Penjualan: SPH → revisi → Deal → sales order

Menu **Penjualan**. Diagram:
[status SPH](diagrams.md#sph-quotation),
[urutan penjualan](diagrams.md#2-sales-quotation-to-cash-sequence).

### 4.1 Membuat SPH

1. **Penjualan → SPH → Penawaran baru**.
2. Pilih pelanggan (kontak/UP opsional), judul (Perihal), judul cetak bila
   perlu (kosong = "QUOTATION").
3. Tambah baris: pilih barang (nama, satuan, harga dan foto terisi
   otomatis) atau baris bebas (nama, satuan, harga diisi manual). Diskon per
   baris boleh.
4. Atur PPN (aktif/tidak), masa berlaku, cara bayar dan rencana termin
   (mis. DP 30% / Siap Kirim 40% / Terpasang 30% — total harus 100%),
   garansi, syarat.
5. **Simpan** → status **Draf**. Selama Draf, SPH bisa diubah.

### 4.2 Persetujuan dan pengiriman

1. Pembuat menekan **Ajukan persetujuan** → **Menunggu persetujuan**.
2. Penyetuju lain menekan **Setujui** (→ **Disetujui**) atau **Tolak**
   (→ **Ditolak**, dengan alasan).
3. **Cetak** SPH (layout sesuai contoh perusahaan), kirim ke pelanggan,
   lalu **Tandai terkirim** → **Terkirim**.

### 4.3 Revisi SPH

Bila pelanggan meminta perubahan harga/barang setelah SPH diajukan,
disetujui, ditolak, terkirim, atau dibatalkan:

1. Buka SPH tersebut → **Buat revisi**.
2. Terbentuk SPH baru dengan nomor yang sama ditambah **-R1** (berikutnya
   -R2, -R3 …) berstatus **Draf**, berisi salinan SPH lama.
3. SPH lama berstatus **Direvisi** dan tidak bisa dipakai lagi; riwayatnya
   tetap tersimpan.
4. Ubah revisi, lalu ulangi **Ajukan → Setujui → Cetak → Tandai terkirim**.

Draf tidak bisa direvisi (cukup diubah langsung). SPH yang batal:
**Tandai batal** dengan alasan → **Batal**.

### 4.4 Deal → sales order

1. Pada SPH berstatus **Disetujui** atau **Terkirim**, tekan
   **Buat sales order** (isi nomor PO pelanggan bila ada, tanggal order,
   rencana kirim).
2. SPH otomatis menjadi **Deal**; order berstatus **Aktif** dengan salinan
   pelanggan, baris, dan nilai SPH.
3. Membatalkan order (hanya bila belum ada invoice, surat jalan, atau
   proyek) mengembalikan SPH ke Terkirim/Disetujui.

## 5. Penagihan: invoice, uang muka, kuitansi

Diagram: [status invoice](diagrams.md#sales-order-and-invoice).

1. Buka **sales order** → kartu **Penagihan** (sudah ditagih, sudah dibayar,
   sisa tagihan, belum ditagih).
2. **Buat invoice** → pilih yang ditagih:
   - termin rencana berikutnya (mis. DP 30%),
   - persentase dari order, atau
   - nominal tertentu.
   Hasilnya **Draf** (belum bernomor). Termin pertama otomatis menjadi
   uang muka (DP); termin yang melunasi menjadi pelunasan.
3. **Terbitkan invoice** → bernomor, **Cetak** (layout contoh invoice).
4. Pembayaran: buka invoice → **Catat pembayaran** (tanggal, metode,
   referensi, nominal) → kuitansi bernomor. Status invoice menjadi
   **Dibayar sebagian** lalu **Lunas**.
5. Koreksi: kuitansi yang salah **Dibatalkan** (bukan dihapus); invoice
   yang belum dibayar bisa **Void** dengan alasan.

Menu **Penjualan → Faktur / Uang Muka / Kuitansi** menampilkan semua
dokumen tersebut.

## 6. Pengadaan: PO → penerimaan barang → stok

Menu **Pengadaan**. Diagram:
[status PO](diagrams.md#purchase-order-and-stock-adjustment),
[urutan pembelian](diagrams.md#3-purchasing-to-stock-sequence).

### 6.1 Purchase order

1. **Pengadaan → Pesanan Pembelian → Purchase order baru**.
2. Pilih pemasok, kategori (Hardware/Software/Jasa/Lainnya — tampil di
   nomor PO), mode PPN (**tanpa**, **harga termasuk PPN**, **PPN
   ditambahkan**), referensi penawaran pemasok, proyek, syarat.
3. Tambah baris barang, jumlah, harga → **Simpan** (Draf).
4. **Ajukan persetujuan** → penyetuju lain **Setujui** (PO mendapat nomor)
   atau **Tolak** (kembali ke Draf dengan alasan).
5. **Cetak** (layout contoh PO) → kirim ke pemasok → **Tandai terkirim**.
6. PO bisa **Dibatalkan** selama belum ada barang diterima.

### 6.2 Penerimaan barang (BPB)

Oleh gudang saat barang datang:

1. Dari PO tekan **Terima barang** (atau **Pengadaan → Penerimaan Barang →
   Terima barang** lalu pilih PO).
2. Pilih gudang (lokasi simpan opsional), tanggal terima, nomor surat jalan
   pemasok.
3. Isi jumlah yang datang per baris (boleh sebagian, tidak boleh melebihi
   sisa PO). Barang bernomor seri: isi **satu nomor seri per unit**
   (dipisah koma atau baris baru).
4. **Posting penerimaan**. Seketika:
   - stok bertambah di gudang tersebut;
   - harga pokok = harga PO **tanpa PPN**; HPP rata-rata dihitung ulang;
   - setiap nomor seri tercatat sebagai unit **in stock**;
   - PO menjadi **Diterima sebagian** atau **Diterima**.
5. BPB tidak bisa diubah; koreksi lewat penyesuaian stok.

## 7. Gudang: stok, stok awal, nilai persediaan, surat jalan

### 7.1 Melihat stok

- **Inventaris → Stok**: jumlah per barang, gudang, lokasi simpan.
- **Inventaris → Barang → Mutasi Barang** (atau tombol **Pergerakan** di
  halaman Stok): riwayat pergerakan (penerimaan, keluar, penyesuaian).
- **Inventaris → Nilai Persediaan**: HPP rata-rata dan nilai per barang/
  gudang, total per gudang dan total keseluruhan (hanya peran yang boleh
  melihat harga pokok).

### 7.2 Stok awal dan penyesuaian

1. **Inventaris → Stok → Sesuaikan stok**.
2. Pilih gudang, jenis (**Penambahan** untuk stok awal, **Pengurangan**,
   atau **Hitung ulang fisik**), alasan (`opening_stock` / "Stok awal" untuk
   stok awal).
3. Per baris: barang, jumlah hasil hitung (total, bukan selisih), dan
   **harga pokok per unit** untuk penambahan (kosong = HPP rata-rata).
4. **Buat penyesuaian** → **Ajukan persetujuan** → disetujui orang lain
   (**Setujui**) → **Catat ke stok** (baru saat ini stok bergerak).

### 7.3 Surat jalan (pengiriman ke pelanggan)

Diagram: [urutan surat jalan](diagrams.md#4-delivery-note-sequence).

1. Dari sales order tekan **Buat surat jalan** (atau **Penjualan → Surat
   Jalan → Buat surat jalan**).
2. Pilih gudang, tanggal, data penerima (terisi dari order: nama, alamat,
   PIC, telepon), supir, nomor kendaraan, catatan (bawaan: teks garansi).
3. Isi jumlah per baris (boleh sebagian). Barang bernomor seri: centang
   nomor seri yang tersedia di gudang tersebut.
4. **Siapkan surat jalan** → bernomor (SJ) → **Cetak** untuk supir.
5. **Kirim**: stok keluar dengan HPP rata-rata, unit bernomor seri menjadi
   **terjual** ke pelanggan, order menjadi **Diproses**. Tidak bisa
   dibatalkan setelah ini.
6. Setelah diterima: **Tandai diterima** (nama penerima).
7. Surat jalan yang masih *disiapkan* bisa **Dibatalkan**; jumlahnya kembali
   ke order.

## 8. Proyek, BAST, garansi, tiket servis

Menu **Proyek**. Diagram:
[status proyek, BAST, tiket](diagrams.md#delivery-note-project-bast-ticket).

### 8.1 Proyek

1. **Proyek → Buat Proyek** → cari dan pilih deal (sales order), PIC,
   lokasi, target mulai/selesai. Satu deal hanya punya satu proyek aktif.
2. Checklist bawaan terbentuk: survei, pengiriman, instalasi, uji fungsi,
   training, BAST.
3. Tugaskan petugas per tugas. Teknisi hanya melihat proyek yang ia
   tangani dan hanya mengubah status tugasnya sendiri.
4. **Bukti pekerjaan**: unggah foto/PDF (maks. 15 MB) berjenis uji fungsi,
   training, BAST bertanda tangan, foto, lainnya.
5. **Biaya Langsung** (PM/finance saja): kategori, tanggal, nominal,
   keterangan, foto nota. Ditampilkan bersama material yang sudah dikirim
   (HPP surat jalan), total biaya, dan margin terhadap nilai kontrak.
6. **Tutup Proyek** hanya bisa bila bukti uji fungsi, training, dan BAST
   bertanda tangan sudah ada → tahap **Garansi**. **Batalkan Proyek**
   (dengan alasan) membebaskan deal untuk proyek baru.

### 8.2 BAST

1. Di halaman proyek, kartu **Dokumen serah terima** → **Buat BAST**.
2. Isian terisi dari deal: nomor kontrak (= PO pelanggan), pihak pertama
   (pelanggan), pihak kedua (perusahaan, PIC sebagai Project Manager),
   barang dengan keterangan "Telah selesai terpasang dan berfungsi dengan
   baik", lingkup pekerjaan. Semua bisa diubah.
3. **Terbitkan BAST** → bernomor → cetak (tanggal ditulis dengan kata).
4. Satu proyek boleh punya **beberapa BAST** (mis. per kontrak). BAST bisa
   diubah atau dibatalkan selama proyek aktif.
5. **Proyek → BAST** menampilkan semua BAST.

### 8.3 Surat garansi

1. Di kartu **Dokumen serah terima** → **Buat surat garansi** (perlu
   minimal satu BAST).
2. Pilih BAST awal masa garansi, tanggal surat, masa garansi (bulan,
   bawaan 12). Perangkat terisi dari surat jalan yang sudah dikirim,
   lengkap dengan nomor seri. Teks ketentuan diambil dari profil
   perusahaan.
3. Format teks ketentuan: satu butir per baris; baris diawali `o ` adalah
   sub-butir; `**teks**` dicetak tebal.
4. **Simpan dan cetak**. Masa garansi: dari tanggal BAST sampai sehari
   sebelum tanggal yang sama setelah N bulan (24-12-2025 + 12 bulan →
   23-12-2026). Satu surat garansi per proyek; bisa diubah juga setelah
   proyek ditutup.

### 8.4 Tiket servis

1. **Proyek → Tiket & Garansi → Buat Tiket**.
2. Ketik **nomor seri** dulu: pelanggan, proyek, perangkat, dan label
   **Bergaransi / Di luar garansi** terisi otomatis dari surat jalan dan
   surat garansi.
3. Isi pelapor, kontak, saluran (WhatsApp, telepon, …), keluhan →
   **Buat Tiket**. Hasil cek garansi disimpan di tiket.
4. Customer service/PM memilih **Teknisi**. Teknisi: **Mulai kerjakan** →
   **Selesaikan** (tindakan perbaikan, biaya servis) — bisa **Buka lagi**.
5. **Tutup Tiket** hanya dengan konfirmasi pelanggan (nama dan saluran).
6. **Pesan** di tiket: tulis **catatan internal** (hanya staf) atau centang
   *Terlihat oleh pelanggan di portal* untuk membalas pelanggan. Pesan yang
   ditulis pelanggan di portal juga muncul di sini. Tiket yang dibuat
   pelanggan di portal bersaluran **Portal pelanggan**, dan pelanggan bisa
   mengonfirmasi tiket yang sudah selesai di sana (tiket tertutup dengan
   saluran konfirmasi *Portal pelanggan*).

### 8.5 Lisensi dan langganan (M03)

1. **Langganan & Lisensi → Aplikasi**: daftarkan setiap aplikasi yang
   dilisensikan — produk **pihak ketiga** (kunci dari vendor) atau
   **aplikasi sendiri** (kunci dibuat sistem).
2. Jual lewat alur biasa (SPH → Deal → sales order → invoice).
3. **Langganan & Lisensi → Kontrak baru**: pelanggan, aplikasi, paket, sales
   order (opsional), tanggal mulai dan berakhir (berakhir kosong =
   selamanya), siklus tagihan, dan nilai → **Simpan draf**.
4. Di kontrak: **Tambah kunci** (ketik kunci dari vendor; untuk aplikasi
   sendiri kosongkan agar dibuat otomatis), lalu **Aktifkan**.
5. **Jatuh tempo perpanjangan (30 hari)** di daftar menampilkan kontrak aktif
   yang segera berakhir atau sudah berakhir; dasbor menampilkan jumlah yang
   sama.
6. Untuk memperpanjang: **Buat SPH** untuk pelanggan dan tagih seperti biasa,
   lalu **Perpanjang** di kontrak (draf periode berikutnya dengan ketentuan
   sama) dan **Aktifkan** — kontrak lama menjadi **Diperpanjang**.
7. **Tangguhkan / Aktifkan kembali**, **Hentikan** (dengan alasan), dan
   **Cabut** kunci (dengan alasan) bila perlu. Finance melihat kunci
   tersamar (4 karakter terakhir).
8. **Aplikasi sendiri (API lisensi)**: di **Kunci API** buat kunci untuk
   aplikasinya (langsung salin — hanya ditampilkan sekali) dan berikan ke
   developer aplikasi bersama catatan integrasi
   (`docs/architecture/modules/licensing-subscription.md`). Aplikasi
   mengaktivasi setiap instalasi (satu kursi), memvalidasi saat dibuka, dan
   tetap berjalan **7 hari setelah tanggal berakhir** dengan peringatan, lalu
   berhenti. Kursi dan setiap panggilan tampil di kontrak dan di **Validasi
   & Aktivasi**; kursi bisa **Dilepas** (misalnya PC diganti).
9. **Perpanjangan dibayar**: tautkan sales order baru ke draf perpanjangan.
   Begitu finance mencatat pelunasan, draf aktif sendiri dan kunci berlanjut
   ke periode baru.

### 8.6 Karyawan, absensi, cuti, dan gaji (M08)

1. **Karyawan & Kehadiran → Karyawan → Karyawan baru** membuat data
   karyawan sekaligus mengirim email undangan untuk akun loginnya. Di
   halaman karyawan tambahkan **rekening bank** gaji dan lihat **sisa cuti**
   tahun ini. Peran tanpa akses data pribadi melihat NIK dan nomor rekening
   sebagian tersembunyi. Yang tampil adalah karyawan organisasi Anda
   ditambah karyawan tingkat perusahaan.
2. **Absensi**: pilih tanggal, isi status tiap karyawan (hadir, izin, sakit,
   cuti, alpa, libur) dan jam masuk / pulang bila perlu, lalu **Simpan hari
   ini** ("Isi baris kosong dengan Hadir" mempercepat). Atau **Impor**: unduh
   template, isi di Excel, unggah. Bila ada baris yang salah, tidak ada yang
   diimpor dan baris yang salah ditampilkan. **Rekap bulanan** menghitung
   status per karyawan.
3. **Cuti**: HR **mencatat cuti** karyawan (jenis, dari, sampai); hari
   Minggu tidak dihitung dan cuti tahunan tidak boleh lebih dari 12 hari
   setahun (pengajuan yang menunggu ikut dihitung). Orang lain selain
   pencatat **Menyetujui** atau **Menolak**; hari yang disetujui otomatis
   masuk absensi. **Batalkan** mengembalikan harinya.
4. **Lembur**: HR mencatat tanggal dan jamnya; orang lain menyetujui. Jam
   yang disetujui tampil di samping karyawan pada ringkasan gaji.
5. **Tugas**: tugas sederhana untuk karyawan dengan tenggat; tandai
   **Selesai** atau **Batal**.
6. **Penggajian** (ringkasan gaji): pilih bulan, **Isi dari bulan lalu** (menyalin
   gaji pokok dan tunjangan bulan lalu; bulan pertama mulai dari 0), lalu
   ubah baris (tunjangan, lembur, bonus, potongan; gaji bersih dihitung)
   atau **Impor** file. Owner klik **Setujui bulan ini**, lalu bulan itu terkunci.
   Belum ada hitung gaji otomatis, slip gaji, atau jurnal (tahap 2 menunggu
   aturan gaji dari finance).

### 8.7 Katalog website, event n8n, dan WhatsApp AI (M04)

1. **Integrasi → Katalog Website**: pilih barang yang tampil di website
   (harga atau "minta penawaran", perilaku saat stok habis) lalu
   **Tampilkan**. Nama, foto, harga, dan stok selalu dari data barang.
2. **Integrasi → Webhook (n8n)**: semua event yang dikirim ERP ke n8n — lead
   baru, invoice terbit, pembayaran diterima, tiket diperbarui, lisensi
   segera berakhir (harian, pada 30 dan 7 hari dan setelah berakhir), dan
   chat WhatsApp yang diteruskan ke admin. n8n mengubahnya menjadi pesan
   WhatsApp atau email. Event yang gagal dicoba ulang otomatis; **Kirim
   sekarang** mengirim ulang secara manual.
3. **Integrasi → WhatsApp AI (otomatisasi)**: chat di nomor perusahaan (WAHA). Asisten
   hanya menjawab dari **FAQ asisten** dan katalog yang tampil. Permintaan
   diskon, harga khusus, pembayaran, atau pesanan, minta bicara dengan
   orang, atau pertanyaan yang tidak bisa dijawab masuk ke **Perlu admin**
   dengan balasan otomatis ke pelanggan. Selama penyedia AI belum diatur,
   semua chat diteruskan ke admin.
4. Buka chat, ketik di **Balas sebagai admin** lalu **Kirim**: chat Anda
   ambil alih dan asisten diam. Klik **Kembalikan ke asisten** bila
   selesai, atau **Tutup chat** (pesan pelanggan berikutnya membukanya
   lagi). Pesan yang gagal terkirim menampilkan **Kirim ulang**. **Buat lead**
   menjadikan chat sebagai lead di CRM (nama, nomor WhatsApp, dan pertanyaan
   pelanggan; sumber WhatsApp, belum ditugaskan agar sales manager bisa
   menugaskannya); satu chat paling banyak satu lead, lalu tampil **Buka lead**.
5. **FAQ asisten** (marketing, admin): isi pertanyaan dan jawaban persis
   yang boleh dibaca pelanggan, beserta kata kunci. Hanya entri **Aktif**
   yang dipakai. Jangan menulis diskon atau janji di sini.

### 8.8 Portal pelanggan (ERP-0022)

1. **CRM → Pelanggan → (pelanggan) → Portal pelanggan**: isi nama orang,
   email yang dipakai untuk masuk, dan **peran** (Pemilik, Penyetuju,
   Keuangan, Pemantau) → **Undang ke portal**. Satu login per orang; satu
   perusahaan bisa punya beberapa. Orang tersebut menerima email untuk
   membuat kata sandi (berlaku 3 hari). Undang minimal satu **Pemilik** per
   perusahaan: pemilik mengundang dan mencabut rekannya sendiri di portal.
2. Kartu menampilkan setiap login dengan perannya: **Menunggu kata sandi**
   sampai kata sandi dibuat, lalu **Aktif** dan waktu terakhir masuk. **Kirim
   ulang tautan** mengirim email kata sandi baru; **Cabut akses** mengakhiri
   semua sesi (bisa diundang lagi nanti).
2a. Pelanggan individu juga bisa **mendaftar sendiri** di portal: mereka
   memasukkan kode 6 digit yang dikirim ke email, lalu ERP membuat pelanggan
   (kode `PRT-…`, tipe Individu) beserta kontaknya. Perusahaan tidak bisa
   mendaftar sendiri; mereka diundang.
3. Di portal pelanggan melihat proyeknya (tahap, checklist, BAST, dan file uji
   fungsi / pelatihan / BAST bertanda tangan / foto — tidak pernah biaya atau
   catatan internal), perangkat dan garansinya, serta tiket servisnya;
   pelanggan bisa membuat tiket, menulis pesan, dan mengonfirmasi perbaikan.
4. Email login staf tidak bisa dipakai untuk portal, dan login pelanggan tidak
   bisa masuk ke web-admin. Setelah 5 kali salah kata sandi, portal mengunci
   email itu selama 15 menit.

## 9. Dokumen cetak dan penomoran

| Dokumen | Contoh nomor | Kapan bernomor | Cetak |
|---|---|---|---|
| SPH | `0001/QT/IMS/XI/26` (revisi `-R1`) | saat dibuat | layout contoh SPH |
| Sales order | `0001/SO/IMS/XI/26` | saat dibuat | — |
| Invoice | `0001/INV/IMS/XI/26` | saat diterbitkan | layout contoh invoice |
| Kuitansi | `0001/KW/IMS/XI/26` | saat dicatat | belum ada contoh |
| PO | `PO/IMS-HIT/HW/1126/001` | saat disetujui | layout contoh PO |
| Penerimaan barang | `0001/BPB/IMS/XI/26` | saat diposting | — |
| Surat jalan | `0001/SJ/IMS/XI/26` | saat disiapkan | layout contoh surat jalan (Letter) |
| Proyek | `0001/PRJ/IMS/XI/26` | saat dibuat | — |
| BAST | `001/BAST/IMS/XII/2025` | saat diterbitkan | layout contoh BAST (Letter) |
| Surat garansi | `001/SG-GARANSI/IMS-APP/2025` | saat disimpan pertama | layout contoh garansi (Letter) |
| Tiket servis | `0001/TKT/IMS/XI/26` | saat dibuat | — |

Cetak memakai tombol **Cetak** di halaman dokumen lalu fitur cetak/simpan
PDF browser. Pola nomor diatur di **Pengaturan → Penomoran Kode**.

## 10. Catatan

### Aturan penting

- **Tidak ada penghapusan.** Dokumen yang salah dibatalkan/di-void dengan
  alasan; riwayat tetap ada.
- **Persetujuan oleh orang lain**: SPH, PO, dan penyesuaian stok tidak bisa
  disetujui pembuatnya.
- **Data seluruh perusahaan**: pelanggan, SPH, order, invoice, PO, proyek
  berlaku untuk satu perusahaan (bukan per departemen).
- **Harga pokok (HPP)** = rata-rata bergerak: penerimaan masuk dengan harga
  PO tanpa PPN, pengiriman dan pengurangan keluar dengan rata-rata. Hanya
  owner, finance, purchasing (izin `product:read_cost`) yang melihatnya.
- **Uang** disimpan sebagai rupiah eksak (tanpa pembulatan pecahan);
  **tanggal bisnis** mengikuti WIB.
- **Dokumen cetak** selalu berbahasa Indonesia, mengikuti contoh
  perusahaan; nomor surat jalan dan BAST ditambahkan di bawah judul
  karena contoh aslinya tidak memiliki nomor.

### Urutan yang harus diikuti

- SO hanya dari SPH **Disetujui/Terkirim**.
- Invoice dari SO; surat jalan dari SO (Aktif/Diproses).
- Penerimaan barang hanya untuk PO **Terkirim/Diterima sebagian**.
- Surat garansi butuh BAST; tiket servis butuh pelanggan aktif.
- SO tidak bisa dibatalkan bila sudah ada invoice, surat jalan, atau
  proyek — batalkan dokumen tersebut dulu.

### Keterbatasan yang diketahui (2026-11-06)

- Semua fitur ini masih di branch `merge/main-sync`, **belum digabung ke
  main** dan belum diterima resmi oleh owner.
- Form **penyesuaian stok** memakai daftar gudang khusus admin global,
  sehingga peran gudang/purchasing belum bisa membuat penyesuaian atau stok
  awal dari layar (dicatat untuk programmer A). Sementara: pakai akun admin.
- Saldo stok contoh (seed) tidak punya harga pokok (bernilai Rp0) sampai
  stok awal dimasukkan.
- Belum ada: cetak kuitansi (tidak ada contoh), jurnal akuntansi (M09),
  hutang pemasok, retur penjualan/pembelian, SLA tiket.
- Diagram topologi jaringan pada contoh garansi tidak dibuat di sistem
  (keputusan owner 2026-11-06).

## 11. Notifikasi

Lonceng di pojok kanan atas header (di sebelah menu akun) menampilkan
notifikasi dalam aplikasi. Angka pada lencana menunjukkan jumlah yang belum
dibaca.

1. **Membaca**: klik lonceng. Notifikasi terbaru tampil paling atas; setiap
   item menampilkan judul, isi, dan tag (misalnya nama organisasi).
2. **Membuka item**: klik item tersebut. Item langsung ditandai sudah dibaca,
   lalu:
   - notifikasi organisasi membuka halaman organisasi tersebut;
   - notifikasi keanggotaan membuka **Organisasi**;
   - notifikasi lain hanya ditandai sudah dibaca.
3. **Tandai semua dibaca**: tautan di bagian atas popover.
4. **Pembaruan langsung**: notifikasi baru muncul tanpa memuat ulang halaman.
   Jika lonceng menampilkan **Live updates unavailable** (titik merah), koneksi
   sedang terputus; aplikasi menyambung ulang sendiri. Muat ulang halaman bila
   titik merah tetap ada cukup lama.
5. **Retensi**: notifikasi yang sudah dibaca dihapus setelah masa retensi yang
   diatur administrator sistem (bawaan 90 hari). Notifikasi yang belum dibaca
   tetap disimpan.

Notifikasi hanya dikirim kepada orang yang bersangkutan. Yang Anda lihat
bergantung pada akun Anda, bukan pada organisasi yang sedang dibuka. Pop-up
browser atau ponsel belum tersedia.

> Keterbatasan yang diketahui (2026-11-14): sejauh ini hanya kejadian
> organisasi (anggota ditambahkan, organisasi dibuat) yang mengirim notifikasi.
> Templat invoice diterbitkan dan permintaan tanda tangan sudah ada, tetapi
> belum ada modul yang mengirimnya.
