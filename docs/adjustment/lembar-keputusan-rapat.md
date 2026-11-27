# Lembar keputusan rapat

Kembali ke [catatan penyesuaian](README.md). Satu lembar untuk rapat dengan\
Pemilik dan Oki. Isinya gabungan semua keputusan dari\
`bahan-keputusan.md`,\
`validasi-konsep-saat-ini.md`, dan\
`rencana-perubahan.md` bagian 1. Disusun\
2026-11-26.

**Cara mengisi:**

* Tulis pilihan yang diambil di kolom **Keputusan**, misalnya `(b)`, atau tulis jawaban sendiri.

* Tulis siapa yang memutuskan di kolom **Oleh** (Pemilik / Oki / bersama).

* Butir yang sudah dijawab programmer B ditandai *jawaban sementara*. Pemilik cukup mengonfirmasi atau mengganti.

* Setelah rapat, hasilnya disalin ke tiga file sumber di atas dan ke `catatan-progres.md`, supaya semua catatan sama.

**Rapat**

| Tanggal | Tempat | Hadir                       | Notulis |
| ------- | ------ | --------------------------- | ------- |
|         |        | Pemilik (Aqim), Oki, Dafrin |         |

***

## 1. Paling mendesak (memblokir alur)

| No     | Pertanyaan                                                                                                                                                                           | Pilihan                                                                                                                                                                                 | Rekomendasi                                                                                                                         | Keputusan | Oleh |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| **K1** | Bolehkah Pemilik (Aqim) menyetujui dokumennya sendiri? Sekarang PO, PR, dan retur pembelian buatan Aqim tidak bisa disetujui siapa pun, karena Aqim satu-satunya Manajer Operasional | (a) Tidak boleh, sesuai ADR-0006. (b) **Pemilik saja** boleh, tercatat di audit, untuk semua dokumen. (c) Ada Manajer Operasional kedua. (d) PO dibuat orang lain, Aqim yang menyetujui | **(b)**; *jawaban sementara programmer B: (b)*. Butuh perubahan ADR-0006 oleh Oki. Sumber: A1, R2, 3.8, pertanyaan 1.3 no. 1 dan 10 | B         |      |
| K1a    | Bila K1 = (b), apakah juga berlaku untuk jurnal manual, kasbon, dan pertanggungjawaban di keuangan (sekarang dilarang menyetujui sendiri)?                                           | (a) Ya. (b) Tidak, tetap butuh orang kedua                                                                                                                                              | (b) untuk jurnal (Bella dan Aqim saling memeriksa); (a) untuk kasbon dan pertanggungjawaban                                         | B         |      |
| **K2** | Susunan role per orang (tabel di bawah). Role yang dipakai turun dari 16 menjadi 11 (dengan K2b)                                                                                                  | (a) Setuju. (b) Setuju dengan perubahan. (c) Tetap seperti sekarang                                                                                                                     | **(a)**; *jawaban sementara programmer B: (a)*. Sumber: 3.8, D1, R7                                                                 | A         |      |
| K2a    | Role SDM hanya untuk Aqim; yang lain cukup layanan mandiri (absen, cuti, slip gaji sendiri)?                                                                                         | (a) Ya. (b) Tambah satu orang SDM                                                                                                                                                       | **(a)**; *jawaban sementara programmer B: ya, cukup Aqim*. Sumber: R1                                                               | A         |      |
| **K2b** | Gabungkan role **Manajer Penjualan** dan **Penjualan** menjadi satu role **Penjualan**, dengan hak Manajer Penjualan sekarang (termasuk menyetujui SPH dan retur penjualan orang lain, membatalkan SO, mengarsipkan pelanggan, akun portal, lisensi penuh, katalog). Aturan "tidak boleh menyetujui dokumen sendiri" tetap, jadi SPH Bilal disetujui Agus MD dan sebaliknya | (a) Gabung. (b) Tetap dua role | **(a)**; *permintaan programmer B 2026-11-26*. Di kode: role `sales` tidak ditawarkan lagi, `sales_manager` diberi label "Penjualan" (wilayah Oki, `erp-permissions.ts`) | | |
| K2c | Role **Pembelian** dipakai sekarang? Bila dipakai, PO dibuat orang itu dan Aqim yang menyetujui, jadi persetujuan PO tidak bergantung pada K1 | (a) Tidak dipakai; Aqim membeli sendiri sebagai Pemilik. (b) Diberikan ke satu orang (misal Agus atau Bilal) | **(a)** selama pembelian dikerjakan Aqim; pilih (b) bila ingin pemisahan tugas atau K1 ditolak | | |
| **K6** | Format nomor PO. Sekarang PO ke pemasok berkode otomatis (misal `DEV-ENTRAGATE-SUP-00001`) tidak bisa disetujui karena nomornya lebih dari 32 karakter                               | (a) Kode pemasok otomatis dipersingkat (misal `SUP-00001`). (b) Kolom nomor diperlebar. (c) Kode pemasok singkat wajib diisi manual                                                     | **(a)**, bisa lewat Administrasi → Nomor Kode tanpa ubah kode; ditambah perbaikan pratinjau                                         | A         |      |
| **K12** | **Lapisan organisasi dihapus** (arah baru programmer B 2026-11-26): ERP hanya untuk satu perusahaan, tanpa pilihan organisasi. Role tidak lagi disimpan per organisasi | (a) Hapus sekarang. (b) Hapus bertahap. (c) Biarkan, sembunyikan dari tampilan | **(b)**: perubahannya besar (role di `auth.members`, kolom `organization_id` di 18 file skema, header `x-organization-id`, ganti organisasi di sidebar, ADR-0006 dan ERP-0031 (tautan gudang–organisasi)). Butuh ADR baru, `docs.dbml`, dan migrasi; wilayah Oki (M12). Rincian `lintas-modul/autentikasi-dan-hak-akses.md` | | |
| **K13** | **Login** (arah baru programmer B 2026-11-26): web-admin hanya email/username + kata sandi (**tombol Google dihapus**); portal pelanggan memakai **Google** | (a) Setuju. (b) Ubah | **(a)**. Perlu diputuskan juga: akun Google pelanggan dicocokkan ke kontak lewat email; pelanggan perusahaan tetap diundang dulu; perlu `GOOGLE_*` di server (sekarang belum diisi, dan tombol Google di portal masih "segera hadir") | | |

**Usulan role per orang (untuk K2):**

| Orang       | Role yang diusulkan                                     | Dihapus (sudah tercakup)                        | Setuju? |
| ----------- | ------------------------------------------------------- | ----------------------------------------------- | ------- |
| Aqim        | Pemilik, SDM                                            | Admin, Manajer Operasional, Pembelian, Keuangan | Ya      |
| Agus MD     | Penjualan (gabungan, K2b)                               | —                                               | Ya      |
| Bilal       | Penjualan (gabungan, K2b), Gudang, Layanan Pelanggan, Pemasaran | Anggota                                 | Ya      |
| Agus        | Manajer Proyek, Teknisi, Gudang                         | Anggota                                         | Ya      |
| Jamil       | Manajer Proyek, Teknisi                                 | Anggota                                         | Ya      |
| Hatta       | Manajer Proyek                                          | Pekerja Lepas                                   | Ya      |
| Fahri       | Teknisi                                                 | Anggota                                         | Ya      |
| Alex, Ade   | Teknisi                                                 | Pekerja Lepas                                   | Ya      |
| Bella       | Akuntan                                                 | —                                               | Ya      |
| Dafrin, Oki | Pekerja Lepas, Anggota                                  | —                                               | Ya      |

## 2. Persetujuan lainnya

| No  | Pertanyaan                                                                                                                           | Pilihan                                                             | Rekomendasi                                                 | Keputusan                 | Oleh |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------- | ---- |
| A2  | SPH dan PO tetap wajib disetujui?                                                                                                    | (a) Tetap wajib. (b) Tidak wajib                                    | (a), bila K1 = (b)                                          | Ya                        |      |
| A3  | Cuti yang dicatat SDM disetujui orang lain?                                                                                          | (a) Tetap. (b) SDM boleh menyetujui sendiri                         | (a)                                                         | (B): SDM hanya Aqim (juga Pemilik), jadi persetujuan cuti oleh SDM mengikuti K1                       |      |
| A3a | Cuti Aqim sendiri: siapa yang menyetujui?                                                                                            | (a) Aqim sendiri, tercatat di audit (ikut K1). (b) Orang lain       | (a)                                                         | Tidak ada cuti untuk Aqim (SDM dan Pemilik), jadi tidak perlu penyetuju |      |
| K7  | Bilal boleh membuat SO lalu mengirim barangnya sendiri? (Bilal memegang Penjualan dan Gudang)                                        | (a) Boleh. (b) SO Bilal dikirim Agus                                | (a) untuk tim kecil, diawasi lewat laporan                  | A                         |      |
| K7a | Persetujuan yang **tanpa pemeriksa kedua**: gaji, pembayaran, klaim garansi (Bilal sendiri), peminjaman aset (PM menyetujui sendiri) | (a) Diterima, diawasi lewat laporan dan audit. (b) Tambah pemeriksa | (a) gaji/pembayaran/garansi; perbaiki peminjaman aset (bug) | A                         |      |

## 3. Pembelian dan gudang (M05)

| No | Pertanyaan                                                       | Pilihan                                                                  | Rekomendasi                                                | Keputusan | Oleh |
| -- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- | --------- | ---- |
| B1 | Perlu langkah "Tandai terkirim" pada PO sebelum gudang menerima? | (a) Tetap. (b) PO disetujui langsung bisa diterima                       | (b), karena Aqim yang membuat, mengirim, dan menyetujui PO | B         |      |
| B2 | Siapa boleh membatalkan PO?                                      | (a) Hanya Pemilik. (b) Pembelian (draf miliknya) dan Manajer Operasional | (b)                                                        | B         |      |
| B3 | Siapa mengelola data barang dan gudang?                          | (a) Admin aplikasi saja. (b) Ikut hak role (Pembelian, Gudang)           | (b)                                                        | B         |      |
| B4 | Gudang boleh melihat PO dan SO?                                  | (a) Tidak. (b) Beri hak baca                                             | (b)                                                        | B         |      |

## 4. Penjualan (M02)

| No | Pertanyaan                                  | Pilihan                                                 | Rekomendasi                                           | Keputusan | Oleh |
| -- | ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | --------- | ---- |
| C1 | SO berubah status menjadi Terkirim/Selesai? | (a) Otomatis. (b) Tombol manual                         | (a)                                                   | A         |      |
| C2 | Menu Uang Muka                              | (a) Dibuka untuk pemegang hak baca invoice. (b) Dihapus | (a)                                                   | A         |      |
| C3 | Admin boleh menambah pelanggan?             | (a) Tidak. (b) Ya                                       | Tidak relevan bila K2 disetujui (Admin tidak dipakai) | B → tidak berlaku: role Admin dihapus         |      |

## 5. Role dan menu

| No | Pertanyaan                                                            | Pilihan                                        | Rekomendasi                     | Keputusan           | Oleh |
| -- | --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- | ------------------- | ---- |
| D2 | Satu orang boleh memegang beberapa role? (sudah didukung aplikasi)    | (a) Ya. (b) Satu role saja                     | (a)                             | A                   |      |
| D3 | Admin perlu akses Proyek?                                             | (a) Tidak. (b) Hak baca                        | Tidak relevan bila K2 disetujui | Admin sudah dihapus |      |
| D4 | Menu Tugas: teknisi dan pekerja lepas hanya melihat tugasnya sendiri? | (a) Tetap semua tugas. (b) Hanya tugas sendiri | (b)                             | B                   |      |
| D5 | Halaman konten website untuk Pemasaran                                | (a) Dibuat. (b) Ditunda                        | (b)                             | B                   |      |

**Daftar role (validasi 1.1):** isi tetap / tidak dipakai / hapus. Dengan K2b, Manajer Penjualan dan Penjualan menjadi satu baris.

| Role                | Dipakai (usulan K2)    | Keputusan                |
| ------------------- | ---------------------- | ------------------------ |
| Pemilik             | ya                     | Tetap                    |
| Admin               | tidak dipakai sekarang | tidak dipakai            |
| Anggota             | ya (Dafrin, Oki)       | Hapus                    |
| Manajer Operasional | tidak dipakai sekarang | Tetap                    |
| Penjualan (gabungan Manajer Penjualan + Penjualan, K2b) | ya (Agus MD, Bilal) | Merging dengan penjualan; Tetap (satu role "Penjualan") |
| Manajer Proyek      | ya                     | Tetap                    |
| Teknisi             | ya                     | Tetap                    |
| Pekerja Lepas       | ya (Dafrin, Oki)       | Tetap                    |
| Pembelian           | tidak dipakai sekarang |                          |
| Gudang              | ya                     | Tetap                    |
| Keuangan            | tidak dipakai sekarang | Tetap                    |
| Akuntan             | ya                     | Merging ke keuangan      |
| SDM                 | ya (Aqim)              | Tetap                    |
| Layanan Pelanggan   | ya                     | Tetap                    |
| Pemasaran           | ya                     | Tetap                    |
| Auditor             | tidak dipakai          | Hapus                    |

"Tidak dipakai sekarang" artinya role tetap ada di aplikasi dan bisa\
diberikan lagi bila ada orang baru.

**Dampak isian di tabel ini** (dicatat 2026-11-26, perlu dikonfirmasi saat rapat):
- **Anggota: Hapus.** Anggota memberi absen, cuti, dan slip gaji milik
  sendiri. Semua role lain sudah punya hak itu, **kecuali Pekerja Lepas**.
  Bila Anggota dihapus, Dafrin dan Oki (hanya Pekerja Lepas) tidak punya
  absensi dan slip gaji. Itu wajar bila mereka memang tidak absen dan tidak
  digaji lewat aplikasi.
- **Akuntan: Merging ke Keuangan.** Ini usulan baru (K2d di bawah). Bella
  akan memegang hak Keuangan **dan** Akuntansi: invoice, kuitansi,
  pembayaran, kas/bank, gaji, sekaligus jurnal dan laporan. Pemeriksa
  jurnalnya tinggal Aqim.
- **Auditor: Hapus**, **Admin: tidak dipakai**: tidak ada pemegangnya, jadi
  tidak berdampak.

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| K2d | Gabungkan role **Akuntan** ke **Keuangan** (satu role untuk Bella)? | (a) Gabung. (b) Tetap terpisah; Bella cukup diberi dua role | **(b)**: satu orang memang boleh memegang dua role, jadi tidak perlu mengubah kode. Hasilnya sama, dan bila nanti ada staf keuangan terpisah, rolenya masih bisa dipisah | | |

**Tugas role Pemasaran** (dari hak di kode, dicek 2026-11-26):

| | Rincian |
|---|---|
| **Bisa dikerjakan sekarang** | **Katalog Website** (Integrasi → Katalog Website): memilih barang yang tampil di website, cara harga ditampilkan, keterangan harga, label stok habis, kegunaan, slug, lalu terbitkan atau arsipkan. **WhatsApp AI → Basis Pengetahuan FAQ**: menambah, mengubah, dan menghapus jawaban asisten AI. **WhatsApp AI → Percakapan**: melihat chat (tanpa membalas). **Webhook (n8n)**: melihat log event. Melihat data barang dan pelanggan, dasbor, dokumen |
| **Haknya ada, halamannya belum** | Konten website (testimoni, gambar), promo, pesanan online (T21). Lihat D5 |
| **Tidak bisa** | Membuat pelanggan, lead, atau SPH; membalas WhatsApp; mengubah harga atau data barang |
| **Siapa** | Bilal, yang juga memegang Penjualan dan Layanan Pelanggan, jadi tetap bisa membalas WhatsApp dan mengelola pelanggan lewat role itu |

## 6. Hak per dokumen (validasi 1.2)

Matriks lengkapnya ada di `validasi-konsep-saat-ini.md` bagian 1.2. Cukup\
nyatakan setuju atau tidak per matriks.

| Matriks                  | Ringkasan sekarang                                                                                                                             | Keputusan (setuju / ubah: …)         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Pelanggan dan pemasok    | Penjualan dan Manajer Penjualan mengelola pelanggan; Pembelian mengelola pemasok; akun portal oleh Admin, Manajer Penjualan, Layanan Pelanggan | Ubah sesuai rekomendasi kamu gimana? → **Rekomendasi (dengan K2b):** Penjualan (Agus MD, Bilal) melihat, menambah, mengubah, dan mengarsipkan pelanggan. Layanan Pelanggan, Pemasaran, dan Manajer Proyek hanya melihat. Akun portal diundang/dicabut oleh Penjualan dan Layanan Pelanggan. Pemasok dikelola Aqim (Pemilik) |
| SPH dan Sales Order      | Penjualan membuat dan mengajukan; Manajer Penjualan menyetujui dan membatalkan SO                                                              | Ubah rekomendasinya gimana? → **Rekomendasi (dengan K2b):** Penjualan membuat, mengajukan, dan mengirim SPH, membuat dan membatalkan SO, serta **menyetujui SPH rekan** (bukan miliknya sendiri). Pemilik juga boleh menyetujui, termasuk SPH buatannya sendiri (K1). Pemilik melihat semua; Akuntan hanya melihat invoice dan kuitansi turunannya |
| PO dan Penerimaan Barang | Pembelian membuat, Manajer Operasional menyetujui, Gudang menerima, batal hanya Pemilik                                                        |                                      |
| Surat Jalan              | Gudang menyiapkan, mengirim, dan menandai diterima                                                                                             |                                      |

## 7. Kontrak dan lingkup

| No  | Pertanyaan                                                                                                                                | Pilihan                                                                                   | Rekomendasi                                             | Keputusan | Oleh |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- | ---- |
| K8  | Kolom A/B kontrak tidak sama dengan pembagian modul (T19/T20/T23/T24/T27/T28 dikerjakan programmer B; T02/T12/T13/T29/T30 dikerjakan Oki) | (a) Kontrak disesuaikan dengan pembagian modul. (b) Pekerjaan dikembalikan sesuai kontrak | Dibicarakan; rincian di `lintas-modul/di-luar-scope.md` |           |      |
| K9  | Fitur di kode yang di luar kontrak (portal karyawan, absen GPS, dua gateway pembayaran, PPh 21/Coretax, keuangan lanjutan)                | (a) Diterima sebagai tambahan. (b) Dibekukan                                              | Dibicarakan per fitur                                   |           |      |
| K10 | M11 Bonus & Investor belum dibangun (schema `investor` sudah dihapus)                                                                     | (a) Dibangun dengan ADR baru. (b) Ditunda                                                 | Diputuskan Pemilik dan Oki                              |           |      |
| K11 | Pemilik bagian yang belum jelas: modul dokumen, notifikasi, webhook, profil perusahaan, lokasi, penomoran/audit bersama, deploy/CI        | Dibagi ke Dafrin / Oki / bersama                                                          | Dibagi per bagian                                       |           |      |

## 8. Untuk Oki

| No       | Hal                                                                                                                    | Keputusan Oki                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| E1–E5    | Dokumen arsitektur yang tidak cocok dengan kode (ADR-0024 status, jumlah schema/role, batas nominal, ADR-0006 ikut K1) | boleh diperbaiki Dafrin / Oki sendiri / biarkan |
| O-1..O-9 | Temuan UAT modul Oki (M06, M09, M10, M11, M12, M01, portal karyawan), lihat `rencana-perubahan.md` bagian 3            | diterima untuk diperiksa / ditolak              |

### 8a. Keputusan modul Oki (paling penting)

Daftar lengkap ada di [`bahan-keputusan-modul-oki.md`](bahan-keputusan-modul-oki.md)
(OA1–OH6); validasinya di
[`validasi-konsep-modul-oki.md`](validasi-konsep-modul-oki.md) (RO1–RO20).
Di sini hanya yang memblokir alur atau perlu diputuskan bersama.

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|---|
| **RO1 / OB4** | Siapa boleh **membuat periode akuntansi**? | Tidak ada role yang bisa, termasuk Pemilik: hak `accounting_period:create` diminta route tetapi tidak ada di daftar hak (dicek 2026-11-27). Tanpa periode, posting jurnal gagal | (a) Tambah hak `create` untuk Pemilik dan Akuntan. (b) Periode dibuat otomatis | (a) | | |
| **RO5** | **Pertanggungjawaban kasbon** wajib diverifikasi dan disetujui dua orang berbeda, padahal keduanya hanya Aqim | Macet (`employee-advance.service.ts:217`, `:235`, dicek) | (a) Bella (Akuntan/Keuangan) diberi hak verifikasi. (b) Pemilik boleh dua-duanya (ikut K1a). (c) Manajer Operasional kedua | (a) | | |
| **OA1 / OA2** | **K12** hapus organisasi: caranya | Role per organisasi; `organization_id` di 18 file skema | (a) Sekaligus. (b) Bertahap: sembunyikan pemilih organisasi dulu, lalu pindahkan role ke pengguna dan hapus kolom (ADR baru) | (b) | | |
| **OA3 / OA4** | **K13** login: web-admin tanpa Google; portal pelanggan dengan Google. Portal **karyawan** juga punya tombol Google: ikut dihapus? | Google aktif bila kunci diisi | (a) Web-admin dan portal karyawan tanpa Google; portal pelanggan dengan Google (akun dicocokkan lewat email). (b) Ubah | (a) | | |
| **OA5–OA7** | **Audit log** ditulis dalam transaksi yang sama; perubahan role, hapus anggota, dan persetujuan sendiri wajib tercatat | Audit "fire-and-forget" (bisa hilang); perubahan role tidak diaudit | (a) Wajib, sebelum K1 dikerjakan. (b) Cukup seperti sekarang | (a): syarat K1 | | |
| **OA10 / K2d** | Akuntan digabung ke Keuangan, atau Bella diberi dua role? Bila Bella memegang Keuangan, ia melihat gaji dan rekening semua karyawan | Isian lembar: "merging ke Keuangan" | (a) Gabung di kode. (b) Bella dua role | (b) | | |
| **OB7 / OB8** | Pembayaran dan klaim biaya tanpa pemeriksa kedua | Tidak ada cek pembuat ≠ penyetuju | (a) Tambah maker-checker. (b) Diterima, diawasi lewat laporan | (b) untuk tim kecil | | |
| **OD1 / OD2** | Peminjaman aset: teknisi belum bisa mengajukan; persetujuan sendiri selalu lolos | Bug di hak dan pengecekan | (a) Perbaiki keduanya | (a) | | |
| **OE1 / K10** | M11 Bonus & Investor | Belum dibangun; `/finance/investors` terbuka untuk semua pengguna internal | (a) Bangun dengan ADR baru. (b) Tunda, tutup halamannya | (b) sampai Pemilik memberi skema bagi hasil | | |
| **OG1** | Absen lokasi di luar radius | Tetap tersimpan, hanya ditandai | (a) Tolak. (b) Simpan dan tandai, SDM memeriksa | (b) | | |
| RO4 | Siapa boleh **membuka kembali periode** yang sudah ditutup/dikunci? | Route pembuka periode hanya meminta hak `close`, jadi siapa pun yang boleh menutup juga bisa membuka kembali, termasuk periode terkunci (ditemukan saat menyusun diagram, 2026-11-27) | (a) Hanya Pemilik. (b) Pemilik dan Akuntan | (a), sesuai rencana M09 | | |

### 8b. Isian yang saling bertentangan (perlu satu jawaban)

Ditemukan saat menyusun diagram sekarang vs sesudah (2026-11-27). Diagram
"Sesudah" memakai rekomendasi sampai butir ini dijawab.

| No | Bertentangan | Pilihan | Rekomendasi | Jawaban |
|---|---|---|---|---|
| X1 | **K1a = (b)** (Pemilik tidak boleh menyetujui sendiri jurnal, kasbon, pertanggungjawaban), padahal kasbon Aqim sendiri lalu butuh penyetuju lain yang belum punya hak | (a) Kasbon/pertanggungjawaban ikut K1 (Pemilik boleh). (b) Tetap (b), dan Bella diberi hak menyetujui kasbon | (a) untuk kasbon; jurnal tetap butuh orang kedua (Bella ↔ Aqim) | |
| X2 | **RO5**: verifikator pertanggungjawaban. Lembar 8a merekomendasikan Bella; dokumen validasi modul Oki juga menawarkan "satu langkah oleh Aqim" | (a) Bella memverifikasi, Aqim menyetujui. (b) Aqim cukup satu langkah | (a) | |
| X3 | **K2d**: tabel role berisi "Akuntan: merging ke Keuangan", kolom keputusan K2d masih kosong | (a) Gabung di kode. (b) Bella dua role | (b) | |
| X4 | **Anggota**: ditandai "Hapus", tetapi tabel usulan K2 masih memberi Dafrin dan Oki role Anggota | (a) Hapus; Dafrin dan Oki hanya Pekerja Lepas, tanpa absensi. (b) Tetap untuk Dafrin dan Oki | Ikuti apakah Dafrin dan Oki perlu absen dan slip gaji di aplikasi | |
| X5 | **K2b** (gabung Penjualan) dan **B1** (hapus "Tandai terkirim"): sudah dipakai di dokumen lain, tetapi kolom keputusannya belum diisi | Konfirmasi | (a) untuk K2b, (b) untuk B1 | |
| X6 | **B2** (Pembelian dan Manajer Operasional boleh membatalkan PO): kedua role itu tidak dipakai, jadi pembatal tetap Aqim | (a) Biarkan, berlaku bila nanti ada staf pembelian. (b) Hapus butir ini | (a) | |
| X7 | **OD1**: cara agar teknisi bisa mengajukan peminjaman. Lembar: "perbaiki"; bahan modul Oki: daftar unit pinjam khusus | (a) Daftar unit khusus untuk peminjaman. (b) Beri teknisi hak lihat aset | (a): teknisi tidak perlu melihat seluruh register aset | |

## 9. Kesimpulan

| Bagian                                     | Kesimpulan                         |
| ------------------------------------------ | ---------------------------------- |
| Konsep saat ini (17 role, alur di kode)    | dipakai / diubah / diganti (coret) |
| Matriks role dan hak per dokumen           | setuju / perlu perubahan           |
| Urutan pengerjaan (`rencana-perubahan.md`) | setuju / ubah: …                   |

**Tindak lanjut**

| No | Tindakan                                                                                       | Penanggung jawab | Tenggat |
| -- | ---------------------------------------------------------------------------------------------- | ---------------- | ------- |
| 1  | Salin keputusan ke `bahan-keputusan.md`, `validasi-konsep-saat-ini.md`, `rencana-perubahan.md` | Dafrin           |         |
| 2  | Ubah ADR-0006 bila K1 = (b)                                                                    | Oki              |         |
| 3  | Atur ulang role anggota sesuai K2                                                              | Aqim             |         |
| 4  | Atur format kode pemasok sesuai K6                                                             | Aqim             |         |
|    |                                                                                                |                  |         |

**Tanda tangan**

| Pemilik | Oki | Dafrin |
| ------- | --- | ------ |
|         |     |        |
