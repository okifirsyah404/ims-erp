# Rancangan menu, dasbor, dan form

Disusun 2026-11-27. Kembali ke [catatan penyesuaian](README.md).

**Status: usulan untuk dibahas.** Isinya rancangan tampilan web-admin supaya
setiap orang tidak bingung memakainya: susunan menu, isi dasbor per role,
aturan baku semua form, dan rincian form yang paling sering dipakai
(isian, aturan validasi, pesan berhasil, pesan salah). Dasar hak dan alurnya
adalah keputusan yang sudah disetujui; daftar menu dan form yang ada di kode
ada di [`menu-dan-form-per-role.md`](menu-dan-form-per-role.md).

Kode **RM** (menu), **RD** (dasbor), **RF** (aturan form), dan **FU** (form
utama) dipakai untuk menandai butir yang perlu diputuskan. Belum ada kode yang
diubah.

**Keputusan programmer B (tanya-jawab 2026-11-27):**

| No | Keputusan |
|---|---|
| RM1 | Menu disusun **per pekerjaan** (susunan 2.2) |
| RM2 | **Nama usulan** dipakai di menu, judul halaman, tombol, dan pesan |
| RM3 | Halaman **Perlu Tindakan** dibuat, dengan lencana jumlah di menu |
| RM4 | Halaman "Segera hadir" **disembunyikan** sampai jadi |
| RD1 | Kartu dasbor per role (3.2) disetujui; disesuaikan bersama pemakainya saat UAT |
| RD2 | Baris **"Hari ini"** di atas semua dasbor |
| RD3 | Penjualan melihat angka **semua orang, dengan saringan "milik saya"** |
| RF-A | Aturan RF-1 sampai RF-26 dan pola pesan 4.5 **disetujui semua** |
| RF-B | Diterapkan **bertahap**: form utama dulu, form lain saat disentuh |
| FU-A/FU-B | **Rincian form dibahas per form dulu** sebelum disetujui (status per form di bagian 5.2) |
| TF-A/TF-B | **TanStack Form + skema zod bersama**; dasar teknis TF-1 sampai TF-3 dikerjakan setelah audit dan K1, sebelum perbaikan form |

Menu, dasbor, dan pembaruan form ini menyentuh wilayah Oki (M01 dasbor,
`nav-config.ts` bersama, M06, M09, M12); dikerjakan lewat PR dan ditinjau Oki
(K11).

---

## 1. Masalah yang ingin diselesaikan

Dari daftar menu dan form (dicek ke kode 2026-11-27):

1. **Menu disusun per modul teknis, bukan per pekerjaan.** Contoh: Faktur,
   Uang Muka, dan Kuitansi ada di bawah Penjualan, padahal yang memakai
   Bella (Keuangan). Surat Jalan ada di Penjualan, padahal yang mengisi
   Gudang. Penerimaan Barang ada di Pengadaan.
2. **Nama campur Inggris dan Indonesia, dan tidak seragam** (temuan A7):
   "Sales order", "Prospek/Lead", "Faktur/Invoice", "Kuitansi/Kwitansi",
   "Webhook (n8n)", "Register Aset".
3. **Tidak ada satu tempat untuk "yang perlu saya kerjakan".** Aqim harus
   membuka SPH, PO, PR, retur, penyesuaian stok, cuti, lembur, gaji, dan
   kasbon satu per satu untuk mencari dokumen yang menunggu persetujuannya.
4. **Dasbor hanya berisi angka keuangan dan operasional.** Kartu yang ada:
   ringkasan kas, laba, grafik penjualan, penjualan, stok, proyek, langganan,
   aktivitas invoice, dan tautan cepat. Akibatnya:
   - **SDM, Pekerja Lepas: dasbor kosong** ("Tidak ada yang bisa ditampilkan
     untuk peran Anda").
   - Teknisi hanya melihat kartu Proyek; Gudang dan Pemasaran hanya kartu
     Stok.
   - Tidak ada kartu tugas, tiket, persetujuan, atau barang yang harus
     dikirim/diterima.
5. **Form tidak seragam** dalam menandai isian wajib, menampilkan pesan
   salah, dan meminta konfirmasi (rincian di bagian 4 dan 5).

---

## 2. Susunan menu (usulan)

### 2.1 Prinsip

| No | Prinsip |
|---|---|
| RM-P1 | Menu dikelompokkan menurut **pekerjaan** (jual, beli, gudang, proyek, keuangan), bukan menurut modul di kode |
| RM-P2 | **Satu nama untuk satu hal**, dalam bahasa Indonesia, sama di menu, judul halaman, tombol, dan pesan. Singkatan resmi boleh dalam kurung: "Pesanan Penjualan (SO)" |
| RM-P3 | Menu pertama setelah Dasbor adalah **Perlu Tindakan**: semua dokumen yang menunggu orang itu (setujui, kirim, terima, kerjakan) |
| RM-P4 | Orang hanya melihat menu yang boleh ia buka (sudah berlaku), dan grup yang isinya satu menu ditampilkan langsung tanpa sub-menu |
| RM-P5 | Halaman yang belum jadi ("Segera hadir") **tidak tampil** di menu |

### 2.2 Susunan usulan

| Grup | Menu (nama usulan) | Nama sekarang bila beda | Dipakai terutama oleh |
|---|---|---|---|
| — | **Dasbor** | | Semua |
| — | **Perlu Tindakan [baru]** | | Semua (isinya per orang) |
| **Penjualan** | Prospek | | Penjualan |
| | Pelanggan | | Penjualan, Layanan Pelanggan |
| | Penawaran (SPH) | SPH | Penjualan |
| | Pesanan Penjualan (SO) | Sales order | Penjualan |
| | Retur Penjualan | | Penjualan, Gudang |
| **Penagihan** | Faktur | (di bawah Penjualan) | Keuangan |
| | Uang Muka | (di bawah Penjualan) | Keuangan |
| | Kuitansi | (di bawah Penjualan) | Keuangan |
| | Piutang | (di bawah Keuangan) | Keuangan |
| **Pembelian** | Pemasok | (di Pengadaan) | Pemilik |
| | Permintaan Pembelian (PR) | | Manajer Proyek, Teknisi |
| | Pesanan Pembelian (PO) | | Pemilik |
| | Retur Pembelian | | Pemilik, Gudang |
| **Gudang** | Penerimaan Barang (BPB) | (di Pengadaan) | Gudang |
| | Surat Jalan | (di Penjualan) | Gudang |
| | Stok | (di Barang) | Gudang |
| | Mutasi Stok | Mutasi Barang | Gudang |
| | Penyesuaian Stok | | Gudang |
| | Gudang & Rak | Gudang | Pemilik, PIC gudang |
| **Barang** | Produk | | Pemilik |
| | Komponen | | Pemilik |
| | Material | | Pemilik |
| | Kategori Barang | | Pemilik |
| | Nilai Persediaan | | Pemilik, Keuangan |
| **Proyek & Layanan** | Proyek | | Manajer Proyek, Teknisi |
| | Tiket Servis | Tiket | Layanan Pelanggan, Teknisi |
| | Garansi | | Layanan Pelanggan |
| | Lisensi (Kontrak, Aplikasi, Kunci API, Riwayat Aktivasi) | Langganan & Lisensi; Validasi & Aktivasi | Penjualan |
| **Aset & Peralatan** | Daftar Aset | Register Aset | Pemilik, Manajer Proyek |
| | Peminjaman | | Semua yang meminjam, Gudang |
| | Servis & Kondisi | Catatan Servis | Pemilik, Manajer Proyek |
| | Kategori Aset | | Pemilik |
| | Penghapusan Aset | | Pemilik |
| **Keuangan** | Kas & Bank | | Keuangan |
| | Utang & Tagihan Pemasok | Utang | Keuangan |
| | Pembayaran Pemasok **[baru]** | | Keuangan |
| | Klaim Biaya & Kasbon | Beban | Keuangan, Pemilik |
| | Rekonsiliasi Bank | Rekonsiliasi | Keuangan |
| | **Pembukuan** (sub): Jurnal, Daftar Akun, Saldo Awal, Aturan Posting, Pusat Biaya, Aset Tetap & Penyusutan, Anggaran Proyek, Tutup Periode | | Keuangan |
| | **Laporan**: Laporan Keuangan, Arsip Bulanan | (Laporan grup sendiri) | Keuangan, Pemilik |
| **Pajak** | Tarif Pajak, Catatan Pajak, Pemotongan Pajak, Rekap Pajak, Koreksi & Bukti, Tabel PPh 21 | Jenis & Tarif Pajak | Keuangan |
| **SDM** | Karyawan, Absensi, Jadwal Kerja, Cuti, Lembur, Tugas, Penggajian | Sumber Daya Manusia | SDM (Aqim) |
| **Dokumen** | Berkas, Tanda Tangan (Minta, Milik Saya, Daftar) | | Semua |
| **Website & WhatsApp** | Katalog Website, Percakapan WhatsApp, Jawaban FAQ, Log Otomasi | Integrasi; WhatsApp AI (otomatisasi); Basis Pengetahuan FAQ; Webhook (n8n) | Pemasaran, Penjualan, Layanan Pelanggan |
| **Pengaturan** | Profil Perusahaan, Nomor Dokumen, Gateway Pembayaran, Pengaturan Dokumen, Pengaturan Gaji, Pengguna, Log Audit | Nomor Kode; Administrasi (Pengguna, Log Audit) | Pemilik |

Dengan susunan ini, menu yang dilihat orang dengan satu role menjadi pendek.
Contoh:

| Orang | Menu yang tampil (usulan) |
|---|---|
| Teknisi (Fahri, Alex, Ade) | Dasbor, Perlu Tindakan, Proyek & Layanan (Proyek, Tiket Servis, Garansi), Peminjaman, Permintaan Pembelian, Tugas, Dokumen |
| Gudang (bagian dari Bilal, Agus) | Dasbor, Perlu Tindakan, Gudang (BPB, Surat Jalan, Stok, Mutasi, Penyesuaian, Gudang & Rak), Barang (lihat), Retur, Peminjaman |
| Keuangan (Bella) | Dasbor, Perlu Tindakan, Penagihan, Keuangan, Pajak, Laporan, Karyawan & Penggajian (lihat) |
| Pekerja Lepas (Dafrin, Oki) | Dasbor, Perlu Tindakan, Tugas, Tanda Tangan Saya |

### 2.3 Halaman Perlu Tindakan (usulan)

Satu halaman berisi daftar dokumen yang menunggu orang yang sedang masuk,
dikelompokkan per jenis, dengan jumlah di menu (lencana angka).

| Untuk | Isi |
|---|---|
| Aqim (Pemilik, SDM) | SPH, PO, PR, retur pembelian/penjualan, penyesuaian stok, peminjaman (bila diajukan Manajer Proyek sendiri), cuti, lembur, gaji bulanan, kasbon (setujui dan cairkan), pertanggungjawaban, jurnal buatan Bella, penghapusan piutang |
| Penjualan (Agus MD, Bilal) | SPH rekan yang menunggu persetujuan; retur penjualan rekan; prospek yang jadwal follow-up-nya hari ini |
| Gudang | PO yang siap diterima, SO yang siap dikirim (belum ada surat jalan), retur penjualan yang harus diterima, retur pembelian yang harus dikirim, peminjaman yang disetujui dan siap diserahkan |
| Manajer Proyek | Peminjaman yang menunggu persetujuan, tugas tim yang terlambat, tiket belum ditugaskan |
| Layanan Pelanggan | Tiket belum ditugaskan, chat WhatsApp yang diserahkan ke manusia |
| Teknisi | Tugas saya, tiket saya |
| Keuangan (Bella) | SO yang belum ditagih, faktur draf belum diterbitkan, faktur jatuh tempo, tagihan pemasok jatuh tempo, jurnal buatan Aqim yang menunggu |
| Pekerja Lepas | Tugas saya, permintaan tanda tangan |

Setiap baris punya tombol yang langsung membuka dokumennya. Perlu endpoint
ringkas per modul (wilayah masing-masing pemilik modul).

**Yang perlu diputuskan:**

| No | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| RM1 | Susunan menu per pekerjaan (2.2) | (a) Pakai susunan usulan. (b) Tetap susunan sekarang, hanya ganti nama. (c) Ubah sebagian | (a) |
| RM2 | Nama menu | (a) Nama usulan di 2.2 (Penawaran (SPH), Pesanan Penjualan (SO), Tiket Servis, Daftar Aset, …). (b) Tetap | (a) |
| RM3 | Halaman **Perlu Tindakan** dengan lencana jumlah | (a) Buat. (b) Cukup kartu di dasbor | (a) |
| RM4 | Halaman "Segera hadir" (Templat, Bonus & Investor) | (a) Disembunyikan sampai jadi. (b) Tetap tampil | (a) |

---

## 3. Isi dasbor per role (usulan)

### 3.1 Prinsip

| No | Prinsip |
|---|---|
| RD-P1 | Baris pertama selalu **"Hari ini"**: hal yang harus dikerjakan orang itu hari ini (diambil dari Perlu Tindakan) |
| RD-P2 | Setiap kartu menjawab satu pertanyaan, menampilkan angka + tautan ke daftar yang sudah tersaring |
| RD-P3 | Orang dengan beberapa role melihat gabungan kartu, tanpa kartu ganda |
| RD-P4 | Tidak ada dasbor kosong: minimal kartu "Hari ini" dan "Tugas saya" |
| RD-P5 | Kartu tanpa hak disembunyikan (OF1); angka laba tanpa lencana "Sementara" (OF2) |

### 3.2 Kartu per role

| Role | Kartu (urut dari atas) |
|---|---|
| **Pemilik** (Aqim) | 1. Menunggu persetujuan saya (jumlah per jenis). 2. Kas & bank hari ini. 3. Penjualan bulan ini vs bulan lalu. 4. Laba bulan ini. 5. Piutang jatuh tempo / lewat jatuh tempo. 6. Utang pemasok jatuh tempo. 7. Stok di bawah minimum. 8. Proyek berjalan (terlambat ditandai). 9. Lisensi habis dalam 30 hari |
| **SDM** (Aqim) | 1. Absensi hari ini (hadir / belum absen / cuti). 2. Cuti dan lembur menunggu. 3. Gaji bulan ini (status draf / disetujui / dibayar). 4. Kontrak kerja habis dalam 30 hari |
| **Penjualan** (Agus MD, Bilal) | 1. Follow-up prospek hari ini. 2. SPH rekan menunggu persetujuan saya. 3. SPH saya: draf / diajukan / dikirim / akan kedaluwarsa. 4. SO belum dikirim. 5. Penjualan saya bulan ini. 6. Lisensi pelanggan habis dalam 30 hari |
| **Gudang** (Bilal, Agus) | 1. PO siap diterima. 2. SO siap dikirim. 3. Retur yang harus diterima/dikirim. 4. Peminjaman siap diserahkan / harus kembali hari ini. 5. Stok di bawah minimum |
| **Layanan Pelanggan** (Bilal) | 1. Tiket belum ditugaskan. 2. Tiket terbuka per status. 3. Chat WhatsApp menunggu dibalas. 4. Klaim garansi menunggu |
| **Pemasaran** (Bilal) | 1. Listing katalog draf / terbit. 2. Event otomasi gagal (perlu dikirim ulang). 3. Jumlah pertanyaan WhatsApp minggu ini |
| **Manajer Proyek** (Agus, Jamil, Hatta) | 1. Proyek saya: tahap dan tenggat (terlambat merah). 2. Tugas tim terlambat. 3. Tiket proyek saya. 4. Peminjaman menunggu persetujuan. 5. PR saya dan statusnya. 6. Biaya proyek vs anggaran |
| **Teknisi** | 1. Tugas saya hari ini. 2. Tiket saya. 3. Peminjaman saya (harus kembali). 4. PR saya |
| **Keuangan** (Bella) | 1. Kas & bank. 2. SO belum ditagih. 3. Faktur jatuh tempo / lewat. 4. Tagihan pemasok jatuh tempo. 5. Kuitansi belum diverifikasi. 6. Pajak masa ini (PPN keluaran/masukan). 7. Periode belum ditutup |
| **Pekerja Lepas** (Dafrin, Oki) | 1. Tugas saya. 2. Permintaan tanda tangan |

Kartu baru butuh endpoint ringkas di modul pemiliknya. Dasbor (M01) wilayah
Oki; kartu modul programmer B disiapkan programmer B.

**Yang perlu diputuskan:**

| No | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| RD1 | Kartu per role (3.2) | (a) Setuju. (b) Ubah per role | (a), lalu dicek bersama pemakainya saat UAT |
| RD2 | Baris "Hari ini" di atas semua dasbor | (a) Ya. (b) Tidak | (a) |
| RD3 | Penjualan melihat angka **penjualan semua orang** atau **miliknya saja** | (a) Semua. (b) Miliknya saja. (c) Semua, dengan saring per orang | (c) |

---

## 4. Aturan baku semua form (usulan)

Berlaku untuk web-admin dan portal karyawan. Portal pelanggan memakai aturan
yang sama dengan gaya tampilannya sendiri.

### 4.1 Tata letak

| No | Aturan |
|---|---|
| RF-1 | Judul form menyebut tindakannya: "Buat Penawaran", "Ubah Pesanan Pembelian PO/2611/001" |
| RF-2 | Isian dikelompokkan dalam bagian berjudul (misalnya **Pelanggan**, **Barang**, **Pembayaran**, **Catatan**); urutan mengikuti dokumen kertasnya |
| RF-3 | Satu kolom di layar kecil; dua kolom hanya untuk isian pendek yang berpasangan (tanggal mulai/selesai) |
| RF-4 | Tombol di bawah kanan: **Simpan** (utama) dan **Batal**. Form panjang: tombol tetap terlihat saat digulir |
| RF-5 | Tabel baris (barang, biaya): tombol **+ Tambah baris** di bawah tabel, hapus baris dengan ikon tempat sampah, total tampil di bawah dan diperbarui langsung |

### 4.2 Isian

| No | Aturan |
|---|---|
| RF-6 | Setiap isian punya **label** (tidak hanya placeholder). Isian wajib bertanda **\*** merah; di atas form tertulis "\* wajib diisi" |
| RF-7 | Placeholder berisi **contoh**, bukan label: "contoh: 0812 3456 7890" |
| RF-8 | Teks bantuan abu-abu di bawah isian untuk aturan yang tidak jelas: "Nomor dibuat otomatis saat disimpan" |
| RF-9 | Jenis isian benar: telepon `tel`, email `email`, jumlah angka, tanggal dengan pemilih tanggal, uang dengan pemisah ribuan |
| RF-10 | **Uang** tampil "Rp 1.250.000" saat diketik; disimpan sebagai sen (ADR-0002) |
| RF-11 | **Tanggal** tampil "27 Nov 2026" (zona Asia/Jakarta); isian tanggal yang punya urutan (mulai–selesai, tanggal–jatuh tempo) saling memeriksa |
| RF-12 | Pilihan panjang (pelanggan, barang, akun, karyawan) memakai **pencarian** (OB2, OD4), menampilkan nama dan kode, tidak pernah ID |
| RF-13 | Nilai bawaan yang masuk akal: tanggal hari ini, gudang utama, PPN dari master (OC4), jatuh tempo dari syarat bayar |

### 4.3 Validasi dan pesan salah

| No | Aturan |
|---|---|
| RF-14 | Diperiksa **saat isian ditinggalkan** dan **saat Simpan**. Tombol Simpan tidak dimatikan diam-diam: ditekan → semua kesalahan tampil |
| RF-15 | Pesan salah tampil **di bawah isiannya**, merah, dengan ikon; isian diberi garis merah |
| RF-16 | Bila ada lebih dari satu kesalahan, **ringkasan di atas form**: "Ada 3 isian yang perlu diperbaiki", setiap baris bisa diklik menuju isiannya; kursor pindah ke isian salah pertama |
| RF-17 | Kesalahan dari server (misalnya kode sudah dipakai) **dipetakan ke isiannya** bila server menyebut isian; bila tidak, tampil di ringkasan atas form, bukan hanya toast yang hilang |
| RF-18 | Pesan menyebut **apa yang salah dan cara memperbaikinya**, dalam bahasa Indonesia, tanpa kode teknis (pola di 4.5) |
| RF-19 | Kesalahan jaringan/server: "Gagal menyimpan. Periksa koneksi lalu coba lagi." Isian yang sudah diketik **tidak hilang** |

### 4.4 Menyimpan, berhasil, dan konfirmasi

| No | Aturan |
|---|---|
| RF-20 | Saat menyimpan: tombol berubah "Menyimpan…" dan tidak bisa ditekan dua kali |
| RF-21 | Berhasil: **toast hijau** dengan nama dan nomor dokumen ("Penawaran SPH/2611/014 disimpan sebagai draf"), lalu pindah ke halaman detail dokumen. Dialog kecil menutup sendiri dan daftar di belakangnya diperbarui |
| RF-22 | Halaman detail menampilkan **status dan langkah berikutnya** di atas: "Draf · Langkah berikutnya: Ajukan untuk disetujui" |
| RF-23 | Tindakan yang **tidak bisa dibatalkan** (Ajukan, Setujui, Tolak, Batalkan, Terbitkan, Posting, Kirim, Hapus) memakai **dialog konfirmasi** yang menyebut akibatnya: "Setelah disetujui, PO tidak bisa diubah dan langsung muncul di Penerimaan Barang." |
| RF-24 | **Tolak dan Batalkan wajib alasan** (menutup FR3); alasan tampil di riwayat dokumen |
| RF-25 | Menutup form yang sudah diubah tanpa menyimpan: "Perubahan belum disimpan. Tinggalkan halaman?" |
| RF-26 | Setiap dokumen menampilkan **riwayat**: dibuat, diajukan, disetujui (termasuk "disetujui oleh pembuat" untuk K1), dengan nama dan waktu |

### 4.5 Pola kalimat pesan

| Keadaan | Pola | Contoh |
|---|---|---|
| Wajib kosong | "{Label} wajib diisi." | "Pelanggan wajib diisi." |
| Format salah | "{Label} tidak valid. Contoh: {contoh}." | "Email tidak valid. Contoh: nama@perusahaan.com." |
| Batas angka | "{Label} minimal {n}." / "maksimal {n}." | "Jumlah minimal 1." |
| Urutan tanggal | "{Label B} tidak boleh sebelum {Label A}." | "Berlaku sampai tidak boleh sebelum Tanggal SPH." |
| Sudah dipakai | "{Label} {nilai} sudah dipakai. Gunakan yang lain." | "Kode SUP-00012 sudah dipakai. Gunakan yang lain." |
| Melebihi sisa | "{Label} melebihi sisa ({sisa} {satuan})." | "Jumlah diterima melebihi sisa PO (4 unit)." |
| Tabel kosong | "Tambahkan minimal satu {baris}." | "Tambahkan minimal satu barang." |
| Tidak berhak | "Anda tidak punya akses untuk {tindakan}." | "Anda tidak punya akses untuk menyetujui PO." |
| Status tidak cocok | "{Dokumen} sudah {status}, jadi tidak bisa {tindakan}." | "PO sudah disetujui, jadi tidak bisa diubah." |
| Berhasil simpan | "{Dokumen} {nomor} disimpan." | "Surat jalan SJ/2611/007 disimpan." |
| Berhasil tindakan | "{Dokumen} {nomor} {tindakan}." | "PO PO/2611/003 disetujui." |
| Gagal umum | "Gagal {tindakan}. {Sebab bila diketahui}. Coba lagi." | "Gagal menyimpan. Koneksi terputus. Coba lagi." |

**Yang perlu diputuskan:**

| No | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| RF-A | Aturan RF-1 sampai RF-26 dan pola pesan 4.5 dipakai untuk semua form | (a) Setuju semua. (b) Setuju dengan perubahan | (a) |
| RF-B | Cara menerapkan | (a) Bertahap: form utama (bagian 5) dulu, lalu form lain saat disentuh. (b) Sekaligus semua form | (a) |

---

## 5. Form yang paling sering dipakai

### 5.1 Kondisi sekarang (dicek ke kode 2026-11-27)

Semua form dibuat tangan (`useState` per isian). Tidak ada pustaka form atau
skema validasi di sisi layar. Pemeriksaan hanya datang dari tiga sumber:
atribut HTML (`required`, `min`, `max`, yang memunculkan pesan bawaan browser),
tombol Simpan yang dimatikan diam-diam, dan server.

| No | Masalah | Contoh |
|---|---|---|
| K-1 | **Isian wajib tidak pernah ditandai.** Yang ditandai hanya "(Opsional)", itu pun tidak di semua form | Isian opsional di header PO, penerima surat jalan, proyek di tiket, jatuh tempo faktur, dan semua isian portal karyawan tidak bertanda |
| K-2 | **Tombol Simpan mati tanpa penjelasan** | Penyesuaian stok, peminjaman aset, pelanggan di tiket, jenis cuti |
| K-3 | **Pesan salah dari server berbahasa Inggris, hanya satu, dan muncul di toast 5 detik.** Nama isiannya dibuang (`errors[].field` tidak dibaca di mana pun) | Lead tanpa kontak: "At least one of phone, WhatsApp, or email is required" |
| K-4 | Letak pesan salah berbeda-beda | Toast (kebanyakan), teks merah di atas tombol (penyesuaian stok), petunjuk tetap (kontak lead) |
| K-5 | Tulisan tombol saat menyimpan berbeda-beda | "Menyimpan…" (CRM), "Membuat…", "Mengajukan." (titik satu), atau tidak berubah (SPH, PO, SO, surat jalan, BPB, faktur, tiket, SDM) |
| K-6 | Pesan berhasil tidak seragam | Penyesuaian stok tanpa toast; lembur memakai pesan cuti; peminjaman tetap di halaman yang sama; dialog faktur memakai tombol "Simpan" untuk terbit, bayar, void, dan batal kuitansi |
| K-7 | **Tidak ada konfirmasi** sebelum tindakan yang tidak bisa dibatalkan, padahal komponen konfirmasinya sudah ada (`confirm-dialog.tsx`) | Ajukan/setujui/kirim SPH dan PO, posting BPB, posting penyesuaian, terbitkan faktur, setujui/tolak cuti |
| K-8 | **Tidak ada peringatan perubahan belum disimpan** | Ganti tanggal di lembar absensi membuang isian tanpa peringatan |
| K-9 | Tanggal tampil mengikuti bahasa browser, bukan bahasa aplikasi; PO dan portal karyawan memakai isian tanggal bawaan browser | — |
| K-10 | Batas angka tipis | Jumlah bayar tidak dibatasi sisa tagihan; uang tidak punya batas minimal |
| K-11 | Isian ID mentah | Peminjam di peminjaman aset diketik sebagai ID (sudah diputuskan diganti, OD4) |

### 5.2 Rincian per form (usulan)

Setiap form ditulis dengan: siapa yang memakai, isian (wajib, aturan, pesan
salah), apa yang terjadi saat berhasil, kesalahan dari server, dan
konfirmasi. Pesan memakai pola bagian 4.5. Tanda **\*** = wajib.
Nomor dokumen di contoh (SPH/2611/014, SJ/2611/007, dan lain-lain) hanya
ilustrasi; format sebenarnya mengikuti Pengaturan → Nomor Dokumen.

#### FU1. Prospek baru / ubah prospek

**Siapa:** Penjualan. **Dari:** Penjualan → Prospek → **+ Prospek baru**.

| Isian | Aturan | Pesan salah |
|---|---|---|
| Nama \* | 2–120 huruf | "Nama wajib diisi." |
| Perusahaan | maks. 120 | — |
| Telepon / WhatsApp / Email | **minimal satu** diisi; telepon dan WA format Indonesia; email valid | Di atas ketiga isian: "Isi minimal satu kontak: telepon, WhatsApp, atau email." · "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890." · "Email tidak valid. Contoh: nama@perusahaan.com." |
| Sumber \* | pilihan (WhatsApp, website, rujukan, …) | "Sumber wajib dipilih." |
| Perkiraan nilai | uang, ≥ 0 | "Perkiraan nilai tidak boleh negatif." |
| Follow-up berikutnya | tanggal-jam, tidak boleh lewat | "Follow-up berikutnya tidak boleh di waktu yang sudah lewat." |
| Kebutuhan | teks panjang | — |

- **Berhasil:** toast "Prospek {nama} disimpan." → halaman detail prospek;
  follow-up masuk ke Perlu Tindakan pada tanggalnya.
- **Kesalahan server:** nomor telepon sudah dipakai prospek lain → di bawah
  isian telepon: "Nomor ini sudah dipakai prospek {nama}. Buka prospek itu?"
  (dengan tautan).

#### FU2. Pelanggan baru (perorangan / perusahaan)

**Siapa:** Penjualan. **Dari:** Penjualan → Pelanggan → **+ Pelanggan**.

| Isian | Aturan | Pesan salah |
|---|---|---|
| Jenis \* | Perorangan / Perusahaan (OA4: pelanggan biasa / bisnis) | — |
| Nama \* | 2–120 | "Nama wajib diisi." |
| Kode | otomatis bila kosong; huruf besar, angka, tanda hubung | "Kode hanya boleh huruf besar, angka, dan tanda hubung." · server: "Kode CUS-00012 sudah dipakai. Gunakan yang lain." |
| Email | valid; wajib bila akan diundang ke portal | "Email tidak valid. Contoh: nama@perusahaan.com." |
| Telepon | format Indonesia | "Nomor telepon tidak valid. Contoh: 0812 3456 7890." |
| NPWP (perusahaan) | 15 atau 16 digit | "NPWP harus 15 atau 16 digit." |
| Perusahaan (untuk perorangan) | pilih yang ada atau buat baru | "Pilih perusahaan atau isi nama perusahaan baru." |
| Foto | gambar, maks. 2 MB | "Pilih berkas gambar maksimal 2 MB." |

- **Berhasil:** "Pelanggan {nama} disimpan." → detail pelanggan.
- **Server:** email sudah dipakai → di bawah isian email dengan tautan ke
  pelanggan itu.

#### FU3. Penawaran (SPH): buat, ubah, ajukan, setujui, kirim

**Siapa:** Penjualan membuat; rekan Penjualan atau Aqim menyetujui (K1, K2b).
**Dari:** Penjualan → Penawaran (SPH) → **+ Penawaran baru**.

| Bagian | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Pelanggan | Pelanggan \* | pencarian nama/kode | "Pelanggan wajib dipilih." |
| | Kepada (attention) | — | — |
| Dokumen | Judul \* | 3–200 | "Judul wajib diisi." |
| | Tanggal SPH \* | bawaan hari ini | "Tanggal SPH wajib diisi." |
| | Berlaku sampai | ≥ Tanggal SPH; bawaan +14 hari | "Berlaku sampai tidak boleh sebelum Tanggal SPH." |
| Barang | Tabel baris \* | minimal satu baris | Ringkasan atas: "Tambahkan minimal satu barang." |
| | Nama barang \* | dari katalog atau baris bebas | "Baris {n}: nama barang wajib diisi." |
| | Jumlah \* | > 0 | "Baris {n}: jumlah minimal 1." |
| | Satuan \* | pilihan | "Baris {n}: satuan wajib dipilih." |
| | Harga \* | uang ≥ 0 | "Baris {n}: harga tidak boleh negatif." |
| | Diskon | 0 ≤ diskon ≤ harga × jumlah | "Baris {n}: diskon melebihi nilai baris." |
| Pajak | PPN | tarif dari master pada Tanggal SPH (OC4); mengubah tarif membuka isian **Alasan \*** | "Alasan perubahan tarif wajib diisi." |
| Pembayaran | Jadwal termin | total persen tepat 100 | "Total termin {x}%; harus tepat 100%." |
| | Syarat bayar, garansi, catatan | — | — |

Total (subtotal, diskon, PPN, total) tampil di bawah tabel dan diperbarui
saat mengetik.

- **Simpan draf:** "Penawaran SPH/2611/014 disimpan sebagai draf." → detail;
  baris status: "Draf · Langkah berikutnya: Ajukan untuk disetujui".
- **Ajukan:** konfirmasi "Ajukan SPH/2611/014 untuk disetujui? Setelah
  diajukan, penawaran tidak bisa diubah sampai disetujui atau dikembalikan."
  → "Penawaran SPH/2611/014 diajukan. Menunggu persetujuan." Masuk Perlu
  Tindakan penyetuju.
- **Setujui:** konfirmasi menyebut total dan pelanggan. Bila pembuatnya Aqim:
  "Anda menyetujui penawaran buatan Anda sendiri. Tindakan ini dicatat di log
  audit." (K1) → "Penawaran SPH/2611/014 disetujui."
- **Tolak:** wajib alasan → "Penawaran dikembalikan ke draf. Alasan dikirim ke
  {pembuat}."
- **Server:** penjual mencoba menyetujui SPH sendiri → "Penawaran buatan Anda
  sendiri harus disetujui rekan Penjualan atau Pemilik."

#### FU4. Pesanan Penjualan (SO) dari SPH

**Siapa:** Penjualan. **Dari:** detail SPH yang disetujui → **Buat SO**.

| Isian | Aturan | Pesan salah |
|---|---|---|
| No. PO pelanggan | maks. 60 | — |
| Tanggal order \* | bawaan hari ini | "Tanggal order wajib diisi." |
| Tanggal kirim | ≥ Tanggal order | "Tanggal kirim tidak boleh sebelum Tanggal order." |
| Catatan | — | — |

- **Berhasil:** "Pesanan SO/2611/009 dibuat dari SPH/2611/014." → detail SO.
  Status SO selanjutnya berubah sendiri: Diproses → Terkirim → Selesai (C1);
  SO masuk Perlu Tindakan Gudang ("siap dikirim") dan Keuangan ("belum ditagih").
- **Server:** SPH sudah punya SO → "SPH ini sudah dibuatkan SO/2611/009." dengan
  tautan.

#### FU5. Surat Jalan

**Siapa:** Gudang. **Dari:** Gudang → Surat Jalan → **+ Surat jalan**, atau
dari Perlu Tindakan (SO siap dikirim).

| Bagian | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Sumber | SO \* | hanya SO yang masih punya sisa kirim | "Pesanan penjualan wajib dipilih." |
| | Gudang \* | bawaan gudang utama | "Gudang wajib dipilih." |
| | Rak/bin | pilihan rak gudang itu | — |
| | Tanggal \* | bawaan hari ini | "Tanggal wajib diisi." |
| Penerima | Nama penerima \* | — | "Nama penerima wajib diisi." |
| | Proyek, lokasi, PIC, kontak, alamat | opsional (ditandai) | "Nomor kontak tidak valid." |
| Barang | Jumlah kirim per baris | 0 ≤ jumlah ≤ sisa SO; ≤ stok gudang; minimal satu baris > 0 | "Baris {n}: jumlah melebihi sisa pesanan ({sisa} {satuan})." · "Baris {n}: stok di gudang ini hanya {stok} {satuan}." · "Isi jumlah kirim minimal pada satu barang." |
| | Nomor seri (barang berseri) | jumlah dicentang = jumlah kirim | "Baris {n}: pilih {jumlah} nomor seri (baru {x})." |
| Pengiriman | Sopir, no. kendaraan, catatan | opsional | — |

- **Simpan:** "Surat jalan SJ/2611/007 disiapkan." → detail.
- **Kirim:** konfirmasi "Kirim SJ/2611/007? Stok berkurang saat ini dan surat
  jalan tidak bisa diubah." → "Surat jalan SJ/2611/007 dikirim. Stok
  diperbarui."
- **Tandai diterima:** wajib nama penerima → "Barang diterima oleh {nama}."

#### FU6. Pesanan Pembelian (PO)

**Siapa:** Aqim membuat, menyetujui, membatalkan (K2c, K1).
**Dari:** Pembelian → Pesanan Pembelian (PO) → **+ PO baru**.

| Bagian | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Pemasok | Pemasok \* | pencarian | "Pemasok wajib dipilih." |
| | Kontak pemasok | pilihan kontak pemasok itu | — |
| Dokumen | Kategori \* | menentukan nomor PO | "Kategori wajib dipilih." |
| | Tanggal order \* | bawaan hari ini | "Tanggal order wajib diisi." |
| | Perkiraan kirim | ≥ Tanggal order | "Perkiraan kirim tidak boleh sebelum Tanggal order." |
| | Ref./tanggal penawaran pemasok, proyek, proyek anggaran, kontak pembeli | opsional (ditandai) | — |
| Barang | Tabel baris \* | minimal satu; setiap baris terhubung ke barang | "Baris {n}: hubungkan ke barang di katalog." |
| | Jumlah \* | > 0 | "Baris {n}: jumlah minimal 1." |
| | Harga \* | uang ≥ 0 | "Baris {n}: harga wajib diisi." |
| | Ambil dari PR | hanya PR disetujui | — |
| Pembayaran | Mode PPN, syarat bayar, ketentuan, catatan | PPN dari master (OC4) | — |

- **Simpan:** "PO {nomor} disimpan sebagai draf."
- **Ajukan / setujui:** konfirmasi; untuk Aqim sendiri: "Anda menyetujui PO
  buatan Anda sendiri. Dicatat di log audit." Setelah disetujui: "PO
  PO/2611/003 disetujui dan siap diterima di gudang." (B1: tidak ada lagi
  "Tandai terkirim").
- **Batalkan:** wajib alasan; ditolak bila sudah ada penerimaan barang: "PO
  sudah diterima sebagian, jadi tidak bisa dibatalkan."
- **Server:** nomor terlalu panjang (temuan D3) → "Nomor PO melebihi 32
  karakter. Persingkat kode pemasok di Pengaturan → Nomor Dokumen." (K6).

#### FU7. Penerimaan Barang (BPB)

**Siapa:** Gudang. **Dari:** Gudang → Penerimaan Barang, atau Perlu Tindakan
(PO siap diterima).

| Isian | Aturan | Pesan salah |
|---|---|---|
| PO \* | hanya PO disetujui dengan sisa | "PO wajib dipilih." |
| Gudang \*, rak | rak milik gudang itu | "Gudang wajib dipilih." · "Rak tidak ada di gudang ini." |
| Tanggal terima \* | ≤ hari ini | "Tanggal terima tidak boleh di masa depan." |
| No. surat jalan pemasok | disarankan | — |
| Jumlah per baris | 0 ≤ jumlah ≤ sisa PO; minimal satu > 0 | "Baris {n}: jumlah melebihi sisa PO ({sisa} {satuan})." |
| Nomor seri (barang berseri) | **tepat satu per unit**, tidak ganda, belum ada di stok | "Baris {n}: isi {jumlah} nomor seri (baru {x})." · "Nomor seri {sn} ganda." · server: "Nomor seri {sn} sudah ada di stok." |
| Catatan | — | — |

- **Posting:** konfirmasi "Posting penerimaan? Stok bertambah dan BPB tidak
  bisa diubah. Kesalahan diperbaiki lewat retur atau penyesuaian stok." →
  "Penerimaan BPB/2611/005 diposting. Stok bertambah {n} barang."

#### FU8. Penyesuaian Stok

**Siapa:** Gudang membuat; Aqim menyetujui dan memposting (K1).
**Dari:** Gudang → Penyesuaian Stok → **+ Penyesuaian**.

| Isian | Aturan | Pesan salah |
|---|---|---|
| Gudang \* | — | "Gudang wajib dipilih." |
| Jenis \* | stok opname / rusak / hilang / koreksi | "Jenis wajib dipilih." |
| Alasan \* | kode alasan + catatan | "Alasan wajib diisi." |
| Baris \*: barang, rak, stok hitung | minimal satu; stok hitung ≥ 0; barang tidak ganda di rak yang sama | "Tambahkan minimal satu barang." · "Baris {n}: stok hitung tidak boleh negatif." · "Barang {nama} di rak {rak} sudah ada di baris {m}." |
| Harga pokok | wajib untuk stok bertambah (hanya bila berhak melihat harga pokok) | "Baris {n}: harga pokok wajib diisi untuk penambahan stok." |

Kolom stok sistem dan selisih dihitung otomatis.

- **Simpan:** "Penyesuaian ADJ/2611/002 disimpan sebagai draf." → detail
  (sekarang tidak ada toast).
- **Ajukan / setujui / posting:** konfirmasi; posting: "Stok akan berubah
  sesuai selisih dan tidak bisa dibatalkan, kecuali dengan penyesuaian baru."
- **Tolak:** wajib alasan (FR3).

#### FU9. Faktur dan Catat Pembayaran

**Siapa:** Keuangan (Bella). **Dari:** detail SO → Penagihan → **Buat
faktur**; detail faktur → **Terbitkan** / **Catat pembayaran**.

| Form | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Buat faktur | Termin \*, persen / jumlah \* | 0 < persen ≤ sisa; jumlah ≤ sisa tagihan SO | "Jumlah melebihi sisa yang belum ditagih (Rp {sisa})." |
| | Jatuh tempo | ≥ hari ini; bawaan dari syarat bayar | "Jatuh tempo tidak boleh sebelum tanggal faktur." |
| Terbitkan | Tanggal terbit \*, jatuh tempo | jatuh tempo ≥ tanggal terbit; periode belum ditutup | "Periode {bulan} sudah ditutup. Pilih tanggal di periode yang masih buka." |
| Catat pembayaran | Jumlah \* | 0 < jumlah ≤ sisa tagihan (bawaan = sisa) | "Jumlah melebihi sisa tagihan (Rp {sisa})." |
| | Tanggal \*, metode \*, rekening tujuan \*, referensi | — | "Metode bayar wajib dipilih." |
| Void / batal kuitansi | Alasan \* | — | "Alasan wajib diisi." |

- Tombol dialog menyebut tindakannya: **Terbitkan faktur**, **Catat
  pembayaran**, **Void faktur** (bukan "Simpan").
- **Berhasil:** "Faktur INV/2611/021 diterbitkan." · "Pembayaran Rp
  5.000.000 dicatat. Sisa tagihan Rp 2.500.000." · "Faktur lunas." bila sisa 0.
- **Terbitkan** memakai konfirmasi: "Setelah diterbitkan, nomor faktur tetap
  dan faktur hanya bisa dibatalkan dengan void."

#### FU10. Tiket Servis

**Siapa:** Layanan Pelanggan, Manajer Proyek membuat; Teknisi menyelesaikan.

| Form | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Buat tiket | Nomor seri | dicari saat diketik; mengisi pelanggan, proyek, perangkat, dan status garansi | "Nomor seri {sn} tidak ditemukan. Isi data perangkat manual." (peringatan kuning, bukan kesalahan) |
| | Pelanggan \* | pencarian | "Pelanggan wajib dipilih." |
| | Proyek | opsional (ditandai) | — |
| | Pelapor \*, kontak | kontak format telepon | "Pelapor wajib diisi." |
| | Saluran \*, keluhan \* | keluhan min. 10 huruf | "Keluhan wajib diisi (minimal 10 huruf)." |
| Selesaikan | Penyelesaian \*, biaya servis | biaya ≥ 0 | "Penyelesaian wajib diisi." |
| Tutup | Dikonfirmasi oleh \*, saluran \* | — | "Nama yang mengonfirmasi wajib diisi." |

- **Berhasil:** "Tiket TKT/2611/011 dibuat." · "Tiket ditugaskan ke {nama}."
  (masuk Perlu Tindakan teknisi) · "Tiket diselesaikan. Menunggu konfirmasi
  pelanggan." · "Tiket ditutup."

#### FU11. SDM: lembar absensi harian dan catat cuti

**Siapa:** SDM (Aqim).

| Form | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Lembar absensi | Tanggal \* | ≤ hari ini | — |
| | Per karyawan: status \*, jam masuk, jam pulang | jam pulang > jam masuk; status Hadir wajib jam masuk | "Baris {nama}: jam pulang harus setelah jam masuk." |
| Catat cuti | Karyawan \*, jenis \*, mulai \*, selesai \* | selesai ≥ mulai; tidak melebihi sisa kuota (12 hari); tidak bertabrakan dengan cuti lain | "Sisa cuti {nama} {x} hari; pengajuan {y} hari." · "Tanggal bertabrakan dengan cuti {tanggal}." |

- Lembar absensi: ganti tanggal saat ada isian belum disimpan →
  "Perubahan absensi {tanggal} belum disimpan. Simpan dulu?" (RF-25).
- **Berhasil:** "Absensi 27 Nov disimpan: {n} karyawan; {m} hari cuti tidak
  diubah." · "Cuti {nama} {tanggal} dicatat. Menunggu persetujuan."
- **Setujui / tolak cuti:** konfirmasi; tolak wajib alasan (FR3).

#### FU12. Portal karyawan: cuti, lembur, absen, kasbon

**Siapa:** semua karyawan kecuali Pekerja Lepas (OG4).

| Form | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Ajukan cuti | Jenis \*, mulai \*, selesai \*, alasan | selesai ≥ mulai; sisa kuota tampil di atas form | "Tanggal selesai tidak boleh sebelum tanggal mulai." · "Sisa cuti Anda {x} hari." |
| Catat lembur | Tanggal \*, jam \*, alasan \* | 0,25–12 jam; tanggal ≤ hari ini | "Jam lembur antara 0,25 dan 12." |
| Absen masuk / pulang | — (tombol) | lokasi proyek: di luar radius ditolak (OG1, PK-1) | "Anda berada {jarak} m dari lokasi proyek (batas {radius} m). Absen tidak bisa dicatat." · "Izinkan akses lokasi di browser untuk absen." |
| **Ajukan kasbon [baru]** | Tanggal \*, jumlah \*, keperluan \*, proyek | jumlah > 0 | "Jumlah kasbon wajib diisi." |
| **Pertanggungjawaban [baru]** | Baris \*: kategori, keterangan, jumlah, foto nota | minimal satu baris; total tampil dibanding kasbon | "Tambahkan minimal satu pengeluaran." · info: "Sisa kasbon Rp {x} dikembalikan ke kantor." / "Kekurangan Rp {x} akan dibayar kantor." |

- **Berhasil:** "Pengajuan cuti terkirim. Menunggu persetujuan." · "Lembur
  dicatat. Menunggu persetujuan." (pesan sendiri, bukan pesan cuti) · "Absen
  masuk tercatat pukul 08.02." · "Kasbon Rp 500.000 diajukan."
- Portal karyawan memakai tanda wajib dan pesan yang sama dengan web-admin.

#### FU13. Peminjaman aset

**Siapa:** Penjualan, Layanan Pelanggan, Manajer Proyek, Teknisi mengajukan;
Manajer Proyek menyetujui; Gudang menyerahkan dan menerima kembali.

| Form | Isian | Aturan | Pesan salah |
|---|---|---|---|
| Ajukan | Jenis peminjam \* | karyawan / pelanggan / tamu | — |
| | Peminjam \* | **pencarian nama** (OD4), bukan ID | "Peminjam wajib dipilih." |
| | Tamu: nama \*, telepon \*, jenis dan no. identitas \* | — | "Nomor identitas wajib diisi untuk tamu." |
| | Unit \* | dari **daftar unit khusus** (OD1), hanya yang tersedia | "Pilih minimal satu unit." · server: "Unit {nama} sedang dipinjam." |
| | Keperluan \*, tanggal kembali \* | tanggal kembali ≥ hari ini | "Tanggal kembali tidak boleh sebelum hari ini." |
| Kembalikan | Kondisi per unit \* | Baik / Rusak / Tidak lengkap (OD7) | "Kondisi unit {nama} wajib dipilih." |

- **Berhasil:** "Peminjaman PJM/2611/004 diajukan. Menunggu persetujuan." →
  detail (sekarang tetap di form). Setelah disetujui masuk Perlu Tindakan
  Gudang; tombol Serahkan baru aktif setelah disetujui (C13).

---

## 6. Dasar teknis yang dibutuhkan (untuk programmer)

Supaya aturan bagian 4 dan 5 bisa dipakai seragam, perlu dasar bersama
(bagian bersama, K11: lewat PR dan diberitahukan):

| No | Pekerjaan | Lokasi | Wilayah |
|---|---|---|---|
| TF-1 | Server mengirim **semua** kesalahan validasi (bukan hanya yang pertama), masing-masing dengan nama isian dan **kunci terjemahan**, bukan teks Zod Inggris | `apps/backend/src/http/plugin.ts`, kontrak zod per modul | Bersama |
| TF-2 | Satu fungsi pembaca kesalahan API di web-admin (menggantikan salinan di ±40 file `lib/*-api.ts`) yang mengembalikan pesan per isian | `apps/web-admin/src/lib/` | Bersama |
| TF-3 | Komponen form bersama: label dengan tanda **\***, pesan salah di bawah isian (`FieldError` yang sudah ada), ringkasan kesalahan di atas form, fokus ke isian salah pertama | `packages/ui`, `components/form/` | Bersama |
| TF-4 | Pilih satu cara validasi di layar (misalnya TanStack Form + skema zod yang sama dengan server lewat `packages/common`), supaya aturan tidak ditulis dua kali | web-admin, web-employee | Bersama, perlu keputusan |
| TF-5 | Pengaman perubahan belum disimpan (pemblokir navigasi TanStack Router + `beforeunload`) | `components/form/` | Bersama |
| TF-6 | Konfirmasi baku memakai `confirm-dialog.tsx` yang sudah ada, dengan teks akibat per tindakan | semua halaman detail | Pemilik modul masing-masing |
| TF-7 | Toast: tambah tombol tutup, waktu tampil lebih lama untuk kesalahan, satu komponen untuk web-admin dan portal karyawan | `components/toast.tsx` (dua salinan) | Bersama |
| TF-8 | Tanggal tampil memakai bahasa aplikasi dan zona Asia/Jakarta; semua isian tanggal memakai `DatePicker` | `packages/ui/src/components/date-picker.tsx` | Bersama |
| TF-9 | `MoneyInput` mendukung batas minimal/maksimal; penyesuaian stok memakai `rupiahToMinor` | `components/money-input.tsx`, `adjustment-form.tsx` | Bersama / programmer B |
| TF-10 | Endpoint ringkas untuk Perlu Tindakan dan kartu dasbor per modul | modul masing-masing + M01 (Oki) | Pemilik modul |

**Yang perlu diputuskan:**

| No | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| FU-A | Rincian form FU1–FU13 (isian, aturan, pesan) | (a) Setuju sebagai acuan. (b) Ubah per form | (a), lalu diuji di UAT |
| FU-B | Form mana yang dikerjakan lebih dulu | (a) Urutan alur uang: SPH → SO → Surat Jalan → Faktur → Pembayaran, lalu PO → BPB, lalu sisanya. (b) Urutan lain | (a) |
| TF-A | Cara validasi di layar (TF-4) | (a) TanStack Form + skema zod bersama. (b) Tetap tulis tangan, tapi pakai komponen bersama TF-3 | (a): aturan satu tempat, pesan per isian otomatis |
| TF-B | Kapan dikerjakan | (a) Dasar teknis TF-1–TF-3 setelah audit dan K1, sebelum perbaikan form. (b) Bersamaan | (a) |
