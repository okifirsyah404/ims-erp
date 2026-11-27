# Validasi konsep saat ini: role dan alur PO, SPH, Surat Jalan

Dokumen ini untuk Pemilik dan programmer kedua. Fokusnya modul yang\
\
dikerjakan programmer B (M02, M03, M04, M05, M07, M08). Tujuannya memutuskan apakah\
\
**konsep dan skema yang berjalan sekarang** (17 role, alur di bawah) tetap\
\
dipakai. Isinya dua bagian:

1. **Matriks role**: siapa boleh apa. Diisi kolom keputusan: tetap, ubah, atau hapus.

2. **Checklist UAT**: langkah mencoba aplikasi per alur, dengan hasil yang diharapkan dan kolom lulus/gagal.

Sumber matriks: `packages/common/src/authorization/erp-permissions.ts` dan\
\
guard backend, dibaca 2026-11-24. Ini menggambarkan kode, bukan rancangan\
\
4 role tanggal 23/11.

Status: **draf**. Bagian 3.8 (susunan role dan aturan persetujuan Pemilik)\
diterima programmer B 2026-11-26; sisanya menunggu validasi Pemilik dan Oki.\
\
Ringkasan keputusan yang perlu diambil: `bahan-keputusan.md`.

***

## Bagian 1 - Matriks role

### 1.1 Daftar role (17)

Setiap role punya akun uji: username `<role>_seed`, password `<role>123456`\
\
(khusus dev). Pemilik memakai akun `admin`; password-nya ada di\
\
`apps/backend/.env`.

| Role                 | Nama                | Ringkasan tugas                                                               | Dipegang oleh (data 2026-11-26)        | Keputusan (tetap/ubah/hapus) | Catatan                                                                                       |
| -------------------- | ------------------- | ----------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `owner`              | Pemilik             | Semua hak                                                                     | Aqim                                   |  (jawaban programmer B 27/11) |                                                                                               |
| `admin`              | Admin               | Pengguna, undangan, data master, profil perusahaan, akun portal               | Aqim                                   |  (jawaban programmer B 27/11) | Tidak menambah hak bagi Aqim (Pemilik sudah semua). Beda Pemilik dan Admin: lihat 3.8         |
| `member`             | Anggota             | Dashboard, profil, absensi, slip gaji, dan pengajuan cuti milik sendiri       | Agus, Jamil, Fahri, Bilal, Dafrin, Oki |  (jawaban programmer B 27/11) | Layanan mandiri sudah ikut di role lain; yang benar-benar perlu hanya Dafrin dan Oki (R1, R7) |
| `operations_manager` | Manajer Operasional | Menyetujui PO, permintaan/retur pembelian, penyesuaian stok; proyek, anggaran | Aqim                                   |  (jawaban programmer B 27/11) | Satu-satunya penyetuju pembelian (lihat R2)                                                   |
| `sales_manager`      | Manajer Penjualan   | Menyetujui SPH, sales order, pelanggan, akun portal                           | Agus MD, Bilal                         |  (jawaban programmer B 27/11) |                                                                                               |
| `sales`              | Penjualan           | Pelanggan, lead, SPH, sales order (tanpa menyetujui)                          | Bilal                                  |  (jawaban programmer B 27/11) | Sudah tercakup Manajer Penjualan                                                              |
| `project_manager`    | Manajer Proyek      | Proyek, tugas, laporan harian, tiket servis                                   | Agus, Jamil, Hatta                     |  (jawaban programmer B 27/11) |                                                                                               |
| `technician`         | Teknisi             | Tugas, laporan harian, tiket servis, kasbon                                   | Fahri, Jamil, Agus, Alex, Ade          |  (jawaban programmer B 27/11) |                                                                                               |
| `freelancer`         | Pekerja Lepas       | Tugas, laporan harian, pertanggungjawaban biaya                               | Dafrin, Oki, Alex, Ade, Hatta          |  (jawaban programmer B 27/11) | Untuk Alex, Ade, Hatta sudah tercakup role lain                                               |
| `purchasing`         | Pembelian           | Pemasok, PO (tanpa menyetujui), data barang                                   | Aqim                                   |  (jawaban programmer B 27/11) |                                                                                               |
| `warehouse`          | Gudang              | Terima barang, surat jalan, transfer stok                                     | Agus, Bilal                            |  (jawaban programmer B 27/11) |                                                                                               |
| `finance`            | Keuangan            | Invoice, kuitansi, pembayaran, kas/bank, gaji                                 | Aqim                                   |  (jawaban programmer B 27/11) |                                                                                               |
| `accountant`         | Akuntan             | Bagan akun, jurnal, periode, pajak, laporan                                   | Bella                                  |  (jawaban programmer B 27/11) |                                                                                               |
| `hr`                 | Sumber Daya Manusia | Karyawan, absensi, cuti, penggajian                                           | belum ditentukan (usulan Aqim)         |  (jawaban programmer B 27/11) | Semua orang hanya memakai layanan mandiri, bukan role ini (R1)                                |
| `customer_service`   | Layanan Pelanggan   | Tiket servis, garansi, akun portal, WhatsApp                                  | Bilal                                  |  (jawaban programmer B 27/11) |                                                                                               |
| `marketing`          | Pemasaran           | Konten website, katalog, promo, pesanan online                                | Bilal                                  |  (jawaban programmer B 27/11) |                                                                                               |
| `auditor`            | Auditor             | Hanya baca dan ekspor                                                         | —                                      |  (jawaban programmer B 27/11) | Tidak dipakai                                                                                 |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: kolom Keputusan diisi dari lembar rapat bagian 0 dan bagian 5 (menunggu konfirmasi Pemilik dan Oki).

Satu orang **bisa memegang beberapa role** sekaligus (dicek di kode\
\
2026-11-26): halaman ubah anggota memakai centang per role, dan impor\
\
undangan menerima beberapa role. Hak dari semua role-nya digabung.\
\
Validasi lengkap terhadap tim ada di **Bagian 3**.

### 1.2 Hak per dokumen (alur yang divalidasi)

Keterangan: ✓ = boleh, kosong = tidak boleh. Pemilik (`owner`) boleh semua,\
\
jadi tidak dimasukkan ke tabel.

**Aturan umum:** pembuat dokumen **tidak bisa menyetujui dokumennya**\
\
**sendiri**, termasuk Pemilik. Tombol Setujui disembunyikan untuk pembuat dan\
\
server juga menolaknya.

#### Pelanggan dan pemasok

| Aksi                               | admin | sales_manager | sales | purchasing | Lainnya                                               |
| ---------------------------------- | ----- | ------------- | ----- | ---------- | ----------------------------------------------------- |
| Lihat pelanggan                    |       | ✓             | ✓     |            | project_manager, customer_service, marketing, auditor |
| Tambah/ubah pelanggan              |       | ✓             | ✓     |            |                                                       |
| Arsipkan pelanggan                 |       | ✓             |       |            |                                                       |
| Lihat pemasok                      |       |               |       | ✓          | finance, auditor                                      |
| Tambah/ubah/arsipkan pemasok       |       |               |       | ✓          |                                                       |
| Undang/cabut akun portal pelanggan | ✓     | ✓             |       |            | customer_service                                      |

Keputusan: ______________________

#### SPH dan Sales Order

| Aksi                      | sales | sales_manager | Lainnya (baca)   |
| ------------------------- | ----- | ------------- | ---------------- |
| Buat dan ubah SPH (draf)  | ✓     | ✓             |                  |
| Ajukan persetujuan SPH    | ✓     | ✓             |                  |
| **Setujui / tolak SPH**   |       | ✓             |                  |
| Tandai SPH terkirim       | ✓     | ✓             |                  |
| Buat Sales Order dari SPH | ✓     | ✓             |                  |
| Batalkan Sales Order      |       | ✓             |                  |
| Lihat SPH dan SO          | ✓     | ✓             | finance, auditor |

Keputusan: ______________________

#### Purchase Order dan Penerimaan Barang

| Aksi                           | purchasing | operations_manager | warehouse | Lainnya (baca) |
| ------------------------------ | ---------- | ------------------ | --------- | -------------- |
| Buat dan ubah PO (draf)        | ✓          |                    |           |                |
| Ajukan persetujuan PO          | ✓          |                    |           |                |
| **Setujui / tolak PO**         |            | ✓                  |           |                |
| Tandai PO terkirim             | ✓          |                    |           |                |
| Batalkan PO                    |            |                    |           | hanya Pemilik  |
| **Terima barang** (stok masuk) |            |                    | ✓         |                |
| Lihat PO                       | ✓          | ✓                  |           | auditor        |

Keputusan: ______________________

#### Surat Jalan

| Aksi                                       | warehouse | sales / sales_manager | Lainnya                  |
| ------------------------------------------ | --------- | --------------------- | ------------------------ |
| Siapkan surat jalan                        | ✓         |                       |                          |
| Kirim (stok keluar, tidak bisa dibatalkan) | ✓         |                       |                          |
| Tandai diterima                            | ✓         |                       |                          |
| Batalkan (sebelum dikirim)                 | ✓         |                       |                          |
| Lihat surat jalan                          | ✓         | ✓ (lewat hak baca SO) | yang punya hak baca stok |

Keputusan: ______________________

### 1.3 Hal yang perlu diputuskan

Temuan dari matriks. Mohon dijawab satu per satu.

1. **Persetujuan saat pengguna sedikit.** Perusahaan punya 1–10 pengguna (10 karyawan + 2 pengembang, lihat Bagian 3). Kalau Pemilik membuat PO atau SPH sendiri, harus ada orang lain dengan hak menyetujui. Apakah aturan "pembuat tidak boleh menyetujui" tetap? Atau Pemilik boleh menyetujui dokumennya sendiri?boleh pemilik boleh setujui dokumenya

2. **Persetujuan SPH dan PO.** Rancangan 23/11 hanya mewajibkan persetujuan untuk penyesuaian stok dan gaji. Sekarang SPH dan PO juga wajib disetujui. Tetap atau dihapus?tetap tapi khusu pemilik yang uat tidak perlu di setujui , langsung setuju

3. **Langkah "Tandai terkirim" pada PO.** Gudang baru bisa menerima barang setelah PO ditandai terkirim. Perlu langkah ini, atau PO yang disetujui langsung bisa diterima?tandai terkirim

4. **Admin tidak bisa menambah pelanggan**, padahal bisa mengundang akun portal pelanggan. Apakah Admin perlu hak tambah pelanggan?boleh bisa admin tanbah pelanggan

5. **Membatalkan PO hanya bisa oleh Pemilik.** Pembelian dan Manajer Operasional tidak bisa. Sesuai?ok sesuai

6. **Gudang tidak bisa melihat daftar PO atau SO**, hanya halaman Penerimaan Barang dan Surat Jalan. Sesuai?sesuai

7. **Jumlah role.** Dari 17 role, mana yang benar-benar dipakai untuk 1–10 orang? Bandingkan dengan rancangan 4 role (Pemilik, Admin Kantor, Finance, Teknisi).4 role

8. **Halaman Barang/Produk dan Gudang hanya untuk admin aplikasi.** Akun Pembelian punya hak buat/ubah barang, tapi tidak bisa membuka halamannya. Siapa yang mengelola data barang?admin dan gudang

9. **Menu yang tidak cocok dengan hak di server.** Contohnya: Uang Muka tidak bisa dibuka siapa pun; Webhook n8n hanya tampil untuk Pemilik; WhatsApp AI tidak tampil untuk Layanan Pelanggan; Nilai Persediaan tampil untuk Gudang tapi datanya ditolak. Rinciannya ada di baris ⚠️ tiap modul. Perbaiki semua? *(2026-11-24: yang hanya menyamakan menu dengan hak server sudah diperbaiki; lihat&#x20;*`uat-modul/README.md`*&#x20;temuan 3.)ok*

10. **Penyesuaian stok boleh disetujui pembuatnya sendiri** bila ia punya hak setuju. Ini disengaja di kode (2026-11-03), tapi bertentangan dengan ADR-0006 butir 6. Pilih: ikuti ADR (larang untuk semua), atau ubah ADR (izinkan Pemilik menyetujui dokumennya sendiri dengan catatan audit, sesuai arahan 23/11) dan terapkan sama untuk SPH dan PO. ok

***

## Bagian 2 - Checklist UAT

Checklist UAT dipindah ke folder `uat-modul/` dan\
\
dibagi per modul programmer B: M05, M02, M07, M03, M08, M04. Setiap baris\
\
langkahnya diambil dari kode pada 2026-11-24. Baris bertanda ⚠️ adalah\
\
temuan yang perlu dipastikan saat UAT.

Uji ganti akun dan hak akses (dulu UAT-E) tersebar di tiap modul, misalnya\
\
M02 A14 dan B5, serta M05 D2 dan D10.

***

## Bagian 3 - Validasi dengan tim saat ini (2026-11-26)

Data dari programmer B: siapa memegang role apa. Dicocokkan dengan hak di\
\
`erp-permissions.ts` dan aturan persetujuan di service backend.

**Dikonfirmasi programmer B (2026-11-26):**

* Ada **dua orang bernama Agus**: **Agus MD** (Manajer Penjualan) dan **Agus** (Manajer Proyek, Teknisi, Gudang). "Aqus MD" adalah salah ketik.

* "Okik" = **Oki**.

* "SDM: Semua" artinya **semua orang memakai layanan mandiri** (absen, cuti, slip gaji milik sendiri), bukan semua orang memegang role SDM. Pengelola SDM belum ditentukan; usulannya Aqim (R1).

### 3.1 Tim dan role gabungannya

10 karyawan (Aqim, Agus MD, Bilal, Agus, Jamil, Hatta, Fahri, Alex, Ade, Bella) ditambah 2 pengembang (Dafrin, Oki), jadi 12 akun. Jumlah pengguna 1–10 orang; asumsi lama "1–5 pengguna" sudah diganti.

| Orang               | Role                                                                        | Hak efektif (gabungan)                                                                                                            |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Aqim**            | Pemilik, Admin, Manajer Operasional, Pembelian, Keuangan                    | Semua hak (Pemilik). Role lain tidak menambah apa pun                                                                             |
| **Agus MD**         | Manajer Penjualan                                                           | Pelanggan, lead, SPH (buat + setujui), sales order, retur penjualan, lisensi penuh, katalog, akun portal, balas WhatsApp          |
| **Bilal**           | Manajer Penjualan, Penjualan, Gudang, Layanan Pelanggan, Pemasaran, Anggota | Semua hak Manajer Penjualan, ditambah terima/kirim barang, tiket servis dan garansi, konten website, katalog, promo, FAQ WhatsApp |
| **Agus**            | Manajer Proyek, Teknisi, Gudang, Anggota                                    | Proyek penuh (termasuk biaya), tugas, laporan harian, tiket servis, kasbon, terima/kirim barang, penyesuaian stok (buat)          |
| **Jamil**           | Manajer Proyek, Teknisi, Anggota                                            | Proyek penuh, tugas, laporan harian, tiket servis, kasbon, permintaan pembelian                                                   |
| **Hatta**           | Manajer Proyek, Pekerja Lepas                                               | Proyek penuh, tugas, laporan harian, tiket servis, permintaan pembelian (tanpa kasbon)                                            |
| **Fahri**           | Teknisi, Anggota                                                            | Tugas yang ditugaskan, laporan harian, tiket servis yang ditugaskan, kasbon, permintaan pembelian                                 |
| **Alex**, **Ade**   | Teknisi, Pekerja Lepas                                                      | Sama dengan Fahri                                                                                                                 |
| **Dafrin**, **Oki** | Pekerja Lepas, Anggota                                                      | Tugas dan laporan harian sendiri, pertanggungjawaban biaya, profil/absen/slip sendiri                                             |
| **Bella**           | Akuntan                                                                     | Bagan akun, jurnal (buat sampai posting), periode, pajak, laporan keuangan, catat tagihan pemasok, rekonsiliasi kas/bank          |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab (jawaban programmer B, menunggu Pemilik dan Oki): tabel di atas adalah susunan **sekarang**. Susunan sesudahnya: Penjualan digabung (Agus MD, Bilal memegang satu role "Penjualan", K2b); Keuangan digabung dengan Akuntan (Bella, K2d); role Anggota dihapus (Dafrin dan Oki hanya Pekerja Lepas, tanpa absensi/slip gaji di aplikasi); role organisasi Admin dihapus (tanda admin aplikasi di akun Aqim tetap). Rincian per orang di 3.8.

### 3.2 Temuan dari susunan ini

| No     | Temuan                                                                                                                                                                                                                 | Dampak                                                                                                                                   | Usulan                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Role **SDM** memberi hak lihat **data pribadi semua karyawan** (NIK, rekening), **membuat dan menghitung penggajian**, serta menyetujui cuti dan lembur. **Dikonfirmasi:** yang dimaksud "semua" hanya layanan mandiri | Bila role SDM tetap diberikan ke semua orang, semua orang bisa melihat gaji orang lain                                                   | Role SDM hanya untuk **Aqim** (usulan, perlu persetujuan Pemilik). Layanan mandiri sudah ikut di hampir semua role; hanya **Dafrin dan Oki** (Pekerja Lepas saja) yang perlu role **Anggota** |
| **R2** | Pembelian dan satu-satunya Manajer Operasional sama-sama **Aqim**. Pembuat tidak boleh menyetujui dokumennya sendiri, termasuk Pemilik (dicek di service PR, PO, retur pembelian)                                      | **PO dan retur pembelian buatan Aqim tidak bisa disetujui siapa pun.** PR buatan Aqim juga macet. PR dari teknisi aman (Aqim menyetujui) | Pilih satu: (a) Pemilik boleh menyetujui dokumennya sendiri, tercatat di audit (keputusan A1); (b) beri Manajer Operasional ke orang kedua; (c) PO dibuat orang lain, Aqim yang menyetujui    |
| **R3** | Penyesuaian stok dibuat Agus/Bilal (Gudang), disetujui dan dicatat Aqim                                                                                                                                                | Berjalan                                                                                                                                 | —                                                                                                                                                                                             |
| **R4** | SPH: Bilal dan Agus MD sama-sama Manajer Penjualan                                                                                                                                                                     | Berjalan: SPH Bilal disetujui Agus MD dan sebaliknya; Pemilik juga bisa                                                                  | —                                                                                                                                                                                             |
| **R5** | Bilal memegang Penjualan **dan** Gudang                                                                                                                                                                                | Bilal bisa membuat SO lalu mengirim barangnya sendiri tanpa orang kedua                                                                  | Diterima (tim kecil) atau minta pengiriman SO Bilal dilakukan Agus                                                                                                                            |
| **R6** | Keuangan seluruhnya di Aqim: invoice, kuitansi, pembayaran, gaji. Tidak ada aturan "tidak boleh menyetujui sendiri" untuk pembayaran dan gaji                                                                          | Satu orang mengatur uang keluar-masuk tanpa pemeriksa                                                                                    | Bella (Akuntan) memeriksa lewat jurnal dan rekonsiliasi kas/bank                                                                                                                              |
| **R7** | Role yang berlebihan: Admin untuk Aqim (sudah Pemilik); Penjualan untuk Bilal (sudah Manajer Penjualan); Pekerja Lepas untuk Alex, Ade, Hatta (sudah Teknisi/Manajer Proyek); Anggota untuk yang sudah punya role lain | Tidak merusak, hanya membingungkan saat membaca daftar anggota                                                                           | Hapus agar rapi. Status "pekerja lepas" lebih tepat dicatat di data karyawan (Tipe kepegawaian), bukan sebagai role                                                                           |
| **R8** | Agus dan Jamil: Manajer Proyek **dan** Teknisi                                                                                                                                                                         | Perlu, karena Manajer Proyek tidak punya kasbon; Teknisi punya                                                                           | Tetap                                                                                                                                                                                         |
| **R9** | Dafrin dan Oki adalah pengembang aplikasi                                                                                                                                                                              | Pekerja Lepas + Anggota cukup untuk tugas, laporan harian, dan absen                                                                     | Pastikan mereka memang perlu akun ERP produksi                                                                                                                                                |

### 3.3 Jawaban sementara untuk 1.3 berdasarkan tim

| No 1.3 | Pertanyaan                            | Jawaban sementara                                                                                                                                                | Masih perlu keputusan           |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1      | Persetujuan saat pengguna sedikit     | Tim 10 karyawan + 2 pengembang. Penjualan, stok, dan cuti punya penyetuju kedua. **Pembelian tidak** (R2)                                                        | Ya: A1 di `bahan-keputusan.md`  |
| 2      | SPH dan PO wajib disetujui            | SPH: tetap, sudah ada dua Manajer Penjualan. PO: tetap hanya jika R2 diselesaikan                                                                                | Ya, untuk PO                    |
| 3      | Langkah "Tandai terkirim"             | Aqim yang membuat, mengirim, dan menyetujui PO, jadi langkah ini menambah klik tanpa pemeriksa baru. Usulan: PO yang disetujui langsung bisa diterima Agus/Bilal | Ya: B1                          |
| 4      | Admin menambah pelanggan              | Tidak relevan: Admin = Aqim = Pemilik, sudah bisa                                                                                                                | Tidak                           |
| 5      | Batalkan PO hanya Pemilik             | Pembuat PO = Pemilik, jadi berjalan                                                                                                                              | Tidak, selama Aqim yang membeli |
| 6      | Gudang melihat PO/SO                  | Agus perlu melihat isi PO saat menerima barang; Bilal sudah bisa lewat hak Penjualan                                                                             | Ya: B4, usulan diberi hak baca  |
| 7      | Jumlah role                           | Dipakai 16 dari 17; hanya Auditor yang tidak. Beberapa rangkapan berlebihan (R7)                                                                                 | Rapikan saja                    |
| 8      | Siapa mengelola data barang           | Aqim (akun `admin` adalah admin aplikasi). Agus dan Bilal tidak bisa menambah barang                                                                             | Ya: B3, bila Gudang perlu       |
| 9      | Menu tidak cocok dengan hak           | Sudah diperbaiki 2026-11-24                                                                                                                                      | Tidak                           |
| 10     | Penyesuaian stok disetujui pembuatnya | Hanya terjadi bila Aqim sendiri yang membuat penyesuaian; samakan dengan keputusan A1                                                                            | Ya: A1                          |

### 3.4 Alur kerja per role

Menu ditulis seperti di aplikasi. "→" berarti dokumen pindah ke orang lain.

**Pemilik (Aqim).** Melihat semua dasbor dan menyetujui apa pun yang butuh\
\
persetujuan, kecuali dokumen buatannya sendiri (R2). Mengatur pengguna dan\
\
role (Administrasi → Pengguna), profil perusahaan, dan format nomor\
\
(Administrasi → Nomor Kode).

**Admin (Aqim).** Mengundang dan menonaktifkan pengguna, mengatur role\
\
anggota, data master, akun portal pelanggan, dan log Webhook n8n.

**Manajer Operasional (Aqim).**

1. Permintaan Pembelian dari teknisi masuk → Setujui/Tolak.

2. PO dari Pembelian → Setujui/Tolak. Macet bila pembuatnya Aqim sendiri (R2).

3. Retur pembelian → Setujui. Penyesuaian stok dari Gudang → Setujui → Catat ke stok.

4. Proyek, anggaran, dan peminjaman aset.

**Pembelian (Aqim).** Pemasok → Permintaan Pembelian (yang sudah disetujui)\
\
→ buat PO → Ajukan → (Manajer Operasional menyetujui) → Tandai terkirim →\
\
Gudang menerima barang. Bila ada barang rusak: Retur pembelian → Ajukan →\
\
(disetujui) → Gudang mengirim balik.

**Gudang (Agus, Bilal).**

1. Penerimaan Barang: terima barang dari PO yang sudah terkirim, isi nomor seri.

2. Surat Jalan: siapkan dari SO → Kirim (stok keluar) → Tandai diterima.

3. Retur: kirim retur pembelian ke pemasok; terima barang retur penjualan.

4. Penyesuaian stok: hitung fisik → Ajukan → (Aqim menyetujui).

**Penjualan (Agus MD, Bilal), gabungan Manajer Penjualan + Penjualan (K2b, usulan 2026-11-26).**
Lead → Jadikan pelanggan → SPH → Ajukan → (rekan Penjualan menyetujui;
tidak boleh SPH sendiri) → Tandai terkirim (PDF ke pelanggan) → Buat sales
order → Gudang mengirim → Pemilik menagih. Juga: menyetujui/menolak SPH dan
retur penjualan buatan rekan, membatalkan SO, mengarsipkan pelanggan,
kontrak lisensi dan kunci API, katalog, serta mengundang akun portal
pelanggan.

**Keuangan (Aqim).** Dari SO: Terbitkan invoice (DP/termin) → Catat\
\
kuitansi pembayaran → status Lunas. Dari PO: catat tagihan pemasok →\
\
pembayaran. Kas/bank dan gaji (bersama SDM).

**Akuntan (Bella).** Memeriksa jurnal otomatis dari invoice, kuitansi, dan\
\
tagihan → membuat jurnal penyesuaian → Posting → rekonsiliasi kas/bank →\
\
tutup periode → laporan keuangan dan pajak.

**Manajer Proyek (Agus, Jamil, Hatta).** Dari SO: Buat proyek → susun tugas\
\
dan tugaskan teknisi → pantau laporan harian dan bukti foto → catat biaya\
\
langsung → Terbitkan BAST → surat garansi → tutup proyek. Juga membuat dan\
\
menugaskan tiket servis.

**Teknisi (Fahri, Jamil, Agus, Alex, Ade).** Membuka tugas dan tiket servis\
\
yang ditugaskan → Mulai kerjakan → laporan harian dan bukti → Selesaikan.\
\
Membuat permintaan pembelian untuk material proyek, kasbon dan\
\
pertanggungjawabannya, serta meminjam aset.

**Pekerja Lepas (Dafrin, Oki; juga Alex, Ade, Hatta).** Tugas yang\
\
ditugaskan, laporan harian, dan pertanggungjawaban biaya. Tidak punya\
\
absensi atau slip gaji; itu datang dari Anggota.

**Layanan Pelanggan (Bilal).** Tiket servis dari pelanggan atau portal →\
\
tugaskan teknisi → pantau → tutup setelah dikonfirmasi pelanggan. Klaim\
\
garansi (setujui/tolak). Akun portal pelanggan (undang/cabut). Membalas\
\
WhatsApp yang diteruskan asisten AI.

**Pemasaran (Bilal).** Yang bisa dikerjakan sekarang: Katalog Website
(barang yang tampil di website, cara harga ditampilkan, keterangan, label
stok habis, terbitkan/arsipkan), Basis Pengetahuan FAQ untuk asisten WhatsApp
AI (tambah/ubah/hapus), melihat percakapan WhatsApp tanpa membalas, dan
melihat log Webhook n8n. Haknya ada tetapi halamannya belum: konten website
(testimoni, gambar), promo, dan pesanan online (T21). Tidak bisa membuat
pelanggan/SPH atau membalas WhatsApp; Bilal melakukannya lewat role Penjualan
dan Layanan Pelanggan.

**SDM (usulan: Aqim saja, lihat R1).** Data karyawan → absensi (manual atau\
\
impor) → cuti dan lembur (setujui) → siapkan gaji bulanan → (Pemilik\
\
menyetujui) → Keuangan membayar.

**Anggota (semua yang perlu layanan mandiri).** Profil, absensi sendiri,\
\
slip gaji sendiri, mengajukan cuti.

### 3.5 Alur lintas orang (contoh nyata)

| Alur                   | Urutan orang                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Penjualan barang       | Bilal buat lead, pelanggan, dan SPH → Agus MD setujui → Bilal kirim SPH dan buat SO → Agus/Bilal kirim surat jalan → Aqim terbitkan invoice dan catat kuitansi → Bella periksa jurnal                              |
| Pembelian untuk proyek | Fahri buat PR → Aqim setujui → Aqim buat PO → **macet di persetujuan (R2)** → Agus terima barang → Aqim catat tagihan dan bayar → Bella periksa                                                                    |
| Proyek dan purna jual  | Agus MD/Bilal punya SO → Jamil buat proyek dan tugaskan Fahri/Alex → Fahri laporan harian dan bukti → Jamil terbitkan BAST dan garansi → pelanggan lapor lewat portal → Bilal (Layanan Pelanggan) tugaskan teknisi |
| Lisensi                | Bilal buat kontrak lisensi dari SO → aktifkan → kunci dipakai aplikasi pelanggan → perpanjangan lewat SO baru                                                                                                      |
| Cuti                   | Fahri ajukan cuti → Aqim (SDM) setujui                                                                                                                                                                             |
| Stok opname            | Agus hitung dan buat penyesuaian → Aqim setujui dan catat                                                                                                                                                          |

### 3.6 Yang perlu dijawab Pemilik

1. **R1:** SDM hanya untuk Aqim? Yang lain cukup layanan mandiri? ya cukup Aqim saja

2. **R2:** Untuk PO dan retur buatan Aqim: Pemilik boleh menyetujui sendiri dengan audit, ada Manajer Operasional kedua, atau PO dibuat orang lain? *(Arah programmer B 2026-11-26: Pemilik boleh menyetujui sendiri dengan audit; lihat 3.8.)*

3. **R5:** Bilal boleh membuat SO dan mengirim barangnya sendiri?

4. Hapus rangkapan yang tidak menambah hak (R7)?

5. Cuti Aqim sendiri: siapa yang menyetujui? *(Dijawab 2026-11-26: Aqim tidak cuti lewat aplikasi.)*

### 3.7 Peta bentrok persetujuan

Setiap titik persetujuan: siapa yang bisa membuat, siapa yang bisa\
\
menyetujui, dan apakah keduanya bentrok. Aturan "pembuat tidak boleh\
\
menyetujui" berlaku untuk dokumen bertanda ✋, termasuk bagi Pemilik.

| Dokumen                         | Pembuat                                                                            | Penyetuju                                 | Status                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permintaan pembelian ✋          | Teknisi (Fahri, Jamil, Agus, Alex, Ade), Manajer Proyek (Agus, Jamil, Hatta), Aqim | Aqim                                      | 🟢 Aman bila dibuat teknisi atau PM. 🔴 **Macet** bila dibuat Aqim                                                                                                                                                                                        |
| PO ✋                            | Aqim                                                                               | Aqim                                      | 🔴 **Selalu macet** (R2)                                                                                                                                                                                                                                  |
| Retur pembelian ✋               | Aqim                                                                               | Aqim                                      | 🔴 **Selalu macet** (R2)                                                                                                                                                                                                                                  |
| Penyesuaian stok ✋              | Agus, Bilal, Aqim                                                                  | Aqim                                      | 🟢 Aman bila dibuat Agus atau Bilal. 🟡 Buatan Aqim lolos lewat pengecualian (A1)                                                                                                                                                                         |
| SPH ✋                           | Bilal, Agus MD                                                                     | Agus MD, Bilal, Aqim                      | 🟢 Aman: Bilal dan Agus MD saling menyetujui                                                                                                                                                                                                              |
| Retur penjualan ✋               | Bilal, Agus MD                                                                     | Agus MD, Bilal, Aqim                      | 🟢 Aman                                                                                                                                                                                                                                                   |
| Cuti / lembur ✋                 | Setiap karyawan (layanan mandiri) atau SDM                                         | SDM (usulan: Aqim)                        | 🟢 Aman untuk semua orang. Aqim (SDM dan Pemilik) tidak cuti lewat aplikasi (jawaban A3a, 2026-11-26), jadi tidak ada titik macet                                                                                                                                                                             |
| Peminjaman aset                 | Teknisi, Manajer Proyek, Penjualan, Layanan Pelanggan                              | Manajer Proyek (Agus, Jamil, Hatta), Aqim | 🟡 Tanpa pemeriksa: aturan "tidak boleh menyetujui sendiri" di kode selalu lolos bagi pemegang hak setuju (`borrowing.controller.ts:38`), jadi PM bisa menyetujui pinjamannya sendiri (dicek 2026-11-26). Teknisi juga belum bisa mengajukan (temuan M06) |
| Kasbon dan pertanggungjawaban ✋ | Teknisi, Manajer Proyek, Pekerja Lepas (Aqim tidak mengajukan kasbon, 27/11) | Aqim (Pemilik; Manajer Operasional tidak dipakai) | 🟢 **Sesudah RO5 (27/11): pertanggungjawaban cukup satu langkah oleh Aqim**, aturan verifikator ≠ penyetuju dihapus; karena Aqim tidak mengajukan kasbon, pembuat dan penyetuju selalu berbeda. Kondisi kode sekarang (sampai diubah Oki): pertanggungjawaban macet: kode mewajibkan verifikator ≠ penyetuju (`employee-advance.service.ts:217`, `:235`), padahal yang punya hak verifikasi dan setuju hanya Aqim. Kasbon sendiri aman. Dibetulkan 2026-11-27 dari temuan RO5 (`validasi-konsep-modul-oki.md`) |
| Klaim garansi                   | Bilal                                                                              | Bilal                                     | 🟡 Tanpa pemeriksa: Bilal membuat dan menyetujui sendiri                                                                                                                                                                                                  |
| SO → surat jalan                | Bilal (SO)                                                                         | Bilal atau Agus (kirim)                   | 🟡 Tanpa pemeriksa bila Bilal mengirim SO-nya sendiri (R5)                                                                                                                                                                                                |
| Gaji                            | Aqim (SDM/Keuangan)                                                                | Aqim (Pemilik)                            | 🟡 Tanpa pemeriksa: satu orang menyiapkan, menyetujui, dan membayar (R6)                                                                                                                                                                                  |
| Pembayaran                      | Aqim                                                                               | Aqim                                      | 🟡 Tanpa pemeriksa (R6)                                                                                                                                                                                                                                   |
| Jurnal manual ✋                 | Bella, Aqim                                                                        | Bella, Aqim                               | 🟢 Aman: kode menolak penyetuju = pembuat (`JournalSelfApprovalError`), jadi jurnal Bella disetujui Aqim dan sebaliknya (dibetulkan 2026-11-26)                                                                                                           |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: baris kasbon tidak lagi 🔴 setelah RO5; peminjaman aset diperbaiki (OD1/OD2, teknisi mengajukan dari daftar unit khusus); klaim garansi, SO Bilal, gaji, dan pembayaran tetap 🟡 dan diterima (K7/K7a, OB7/OB8).

Keterangan:

* 🔴 **macet**: aplikasi menolak, pekerjaan berhenti.

* 🟡 **tanpa pemeriksa**: berjalan, tapi tidak ada orang kedua yang memeriksa.

* 🟢 **aman**: ada orang kedua.

**Yang harus diselesaikan sebelum dipakai:** semua 🔴, yaitu PO, retur\
\
pembelian, PR buatan Aqim, dan cuti Aqim. Semuanya selesai dengan satu\
\
keputusan: A1 (Pemilik boleh menyetujui miliknya sendiri dengan audit)\
\
**atau** orang kedua sebagai Manajer Operasional/SDM.

**Yang cukup diterima atau diawasi:** semua 🟡. Pemeriksaan bisa lewat\
\
laporan, audit log, dan rekonsiliasi Bella.

### 3.8 Rekomendasi susunan role dan alur (2026-11-26)

Arah dari programmer B: **Aqim boleh menyetujui dokumennya sendiri tanpa**\
**persetujuan orang lain.** Ini pilihan A1 (b) di `bahan-keputusan.md`.\
Statusnya: **diterima programmer B (2026-11-26)** sebagai arah susunan role\
dan aturan persetujuan. Masih menunggu persetujuan Pemilik, dan ADR-0006\
butir 6 harus diubah Oki sebelum kodenya diganti.

#### Beda Pemilik dan Admin

Fungsinya **tidak sama**. Aqim tidak merasakan bedanya karena ia memegang\
keduanya.

|                                                                        | Pemilik (`owner`)                                   | Admin (`admin`)                                |
| ---------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Hak                                                                    | **Semua** hak bisnis dan administrasi               | Hanya administrasi                             |
| Pengguna dan role                                                      | Ya, termasuk memberi role Pemilik                   | Ya, tetapi **tidak bisa** memberi role Pemilik |
| Profil perusahaan, nomor kode, data master, akun portal                | Ya                                                  | Ya                                             |
| Penjualan (pelanggan, SPH, SO), pembelian (PO), keuangan, gaji, proyek | Ya                                                  | **Tidak**                                      |
| Menyetujui dokumen (SPH, PO, PR, retur, penyesuaian stok)              | Ya                                                  | **Tidak**                                      |
| Melihat harga pokok, data pribadi karyawan                             | Ya                                                  | **Tidak**                                      |
| Perlindungan                                                           | Pemilik terakhir tidak bisa dihapus atau diturunkan | —                                              |

Role Admin berguna bila nanti ada **staf kantor** yang mengurus akun dan\
data master tanpa boleh melihat uang atau menyetujui dokumen.

**Admin aplikasi** adalah hal lain lagi. Itu tanda di akun (`auth.users.role = admin`), bukan role organisasi. Akun `admin` milik Aqim punya tanda ini,\
dan karena itu hanya Aqim yang bisa membuka halaman Produk dan Gudang (B3).

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: **role organisasi Admin dihapus**; tanda admin aplikasi di akun Aqim tetap.

#### Rekomendasi role per orang

Prinsipnya: setiap orang cukup memegang role yang **menambah hak**. Role yang\
sudah tercakup role lain dihapus supaya daftar anggota mudah dibaca.

| Orang       | Sekarang                                                                    | Rekomendasi                                             | Alasan                                                                                  |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Aqim        | Pemilik, Admin, Manajer Operasional, Pembelian, Keuangan                    | **Pemilik**, ditambah **SDM**                           | Pemilik sudah mencakup semuanya. SDM ditulis supaya jelas siapa pengelola gaji dan cuti |
| Agus MD     | Manajer Penjualan                                                           | Penjualan (gabungan, K2b)                               | —                                                                                       |
| Bilal       | Manajer Penjualan, Penjualan, Gudang, Layanan Pelanggan, Pemasaran, Anggota | Penjualan (gabungan, K2b), Gudang, Layanan Pelanggan, Pemasaran | Penjualan dan Anggota sudah tercakup                                                    |
| Agus        | Manajer Proyek, Teknisi, Gudang, Anggota                                    | Manajer Proyek, Teknisi, Gudang                         | Teknisi tetap untuk kasbon; Anggota tercakup                                            |
| Jamil       | Manajer Proyek, Teknisi, Anggota                                            | Manajer Proyek, Teknisi                                 | Anggota tercakup                                                                        |
| Hatta       | Manajer Proyek, Pekerja Lepas                                               | Manajer Proyek                                          | Pekerja Lepas tercakup. Status lepas dicatat di data karyawan                           |
| Fahri       | Teknisi, Anggota                                                            | Teknisi                                                 | Anggota tercakup                                                                        |
| Alex, Ade   | Teknisi, Pekerja Lepas                                                      | Teknisi                                                 | Pekerja Lepas tercakup; status lepas di data karyawan                                   |
| Bella       | Akuntan                                                                     | **Keuangan** (gabungan Akuntan + Keuangan, K2d, 27/11) | Bella juga melihat gaji dan rekening karyawan                                                                                    |
| Dafrin, Oki | Pekerja Lepas, Anggota                                                      | **Pekerja Lepas** (Anggota dihapus, X4, 27/11) | Tanpa absensi dan slip gaji di aplikasi (sebelumnya: Anggota memberi absen, cuti, dan slip gaji sendiri)                                  |

Role yang dipakai turun dari 16 menjadi 11, setelah Manajer Penjualan dan
Penjualan digabung menjadi satu role **Penjualan** (K2b, permintaan
programmer B 2026-11-26; di kode: `sales_manager` diberi label "Penjualan",
`sales` tidak ditawarkan lagi). Tidak terpakai: Admin, Manajer Operasional,
Pembelian, Keuangan (bisa diberikan lagi bila ada orang baru), dan Auditor.

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: dengan K2d (Akuntan digabung ke Keuangan) dan Anggota dihapus, role yang dipakai menjadi **10**: Pemilik, SDM, Penjualan, Gudang, Layanan Pelanggan, Pemasaran, Manajer Proyek, Teknisi, Pekerja Lepas, Keuangan (Bella). Admin (role organisasi) dihapus; Manajer Operasional dan Pembelian tidak dipakai (K2c).

#### Aturan persetujuan yang direkomendasikan

1. **Pemilik boleh menyetujui dokumennya sendiri**: SPH, PR, PO, retur pembelian, retur penjualan, penyesuaian stok, cuti/lembur.

2. Setiap persetujuan sendiri **dicatat di audit log** dengan tanda "disetujui oleh pembuat (Pemilik)", dan bisa dilihat di Laporan → Audit.

3. **Orang lain tetap tidak boleh** menyetujui dokumennya sendiri. SPH Bilal tetap disetujui Agus MD atau Aqim.

4. Pengecualian lama di penyesuaian stok (setiap pemegang hak setuju boleh menyetujui miliknya sendiri) **diganti** aturan nomor 1, jadi hanya Pemilik yang boleh.

5. Untuk mengurangi klik Aqim (B1, diputuskan programmer B 27/11): PO yang disetujui langsung bisa diterima gudang; langkah "Tandai terkirim" dihapus.

6. Kasbon dan pertanggungjawaban ikut aturan nomor 1 (K1a/X1, 27/11); pertanggungjawaban cukup satu langkah oleh Aqim (RO5). Jurnal manual tetap butuh orang kedua (Bella ↔ Aqim).

#### Alur setelah rekomendasi

| Alur            | Urutan                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pembelian       | Fahri/Jamil buat PR → Aqim setujui → Aqim buat PO → **Aqim setujui sendiri (tercatat audit)** → Agus/Bilal terima barang → Aqim catat tagihan dan bayar → Bella periksa jurnal |
| Retur pembelian | Aqim buat retur → **Aqim setujui sendiri** → Agus/Bilal kirim ke pemasok → terima barang pengganti                                                                                                                |
| Penjualan       | Bilal buat SPH → Agus MD setujui (atau sebaliknya; Aqim juga boleh) → Bilal buat SO → Agus/Bilal kirim → Aqim tagih → Bella periksa                                                                               |
| Stok opname     | Agus/Bilal hitung → Aqim setujui dan catat. Penyesuaian buatan Aqim disetujui sendiri                                                                                                                             |
| Cuti            | Karyawan ajukan → Aqim setujui. Aqim tidak cuti lewat aplikasi (A3a)                                                                                                                                                   |
| Gaji            | Aqim siapkan → Aqim setujui → Aqim bayar → Bella periksa jurnal (tetap 🟡)                                                                                                                                        |
| Kasbon          | Teknisi ajukan kasbon → Aqim setujui → teknisi ajukan pertanggungjawaban → **Aqim setujui satu langkah** (RO5, 27/11) |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: langkah "Tandai terkirim" dihapus (B1) dan baris Kasbon ditambahkan (RO5).

Dengan aturan ini, semua 🔴 di 3.7 menjadi 🟢 (disetujui Pemilik, dengan\
audit). Yang 🟡 tetap 🟡.

#### Yang perlu dikerjakan bila disetujui

| Pekerjaan                                                                                                                                                                | Siapa            | Perkiraan kasar  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------- |
| Ubah ADR-0006 butir 6 dan `security-and-access.md`                                                                                                                       | Oki (wilayahnya) | —                |
| Satu aturan bersama "pembuat boleh menyetujui bila Pemilik" di service PR, PO, retur pembelian, SPH, retur penjualan, cuti/lembur, penyesuaian stok; catatan audit; test | programmer B     | ±1 hari          |
| Tampilkan tombol Setujui untuk Pemilik pada dokumennya sendiri, beserta keterangan "tercatat di audit"                                                                   | programmer B     | termasuk di atas |
| Atur ulang role anggota sesuai tabel di atas (Administrasi → Pengguna → ubah anggota)                                                                                    | Aqim             | 10 menit         |

### 3.9 Penjelasan: arti "admin", role Pembelian, serta investor dan pelanggan (2026-11-26)

Jawaban programmer B atas lembar keputusan: role SDM hanya Aqim dan Aqim
tidak cuti; **role Admin dihapus** dari susunan role.

#### Tiga hal yang sama-sama disebut "admin"

| Nama | Apa itu | Disimpan di | Fungsi | Setelah role Admin dihapus |
|---|---|---|---|---|
| **Role organisasi Admin** (`admin`) | Salah satu dari 17 role di perusahaan | `auth.members.role` | Administrasi: undang dan atur pengguna/role, profil perusahaan, nomor kode, data master, akun portal pelanggan, log n8n, FAQ dan balas WhatsApp, catat absensi, tiket servis. **Tanpa** penjualan, pembelian, keuangan, atau persetujuan | Tidak diberikan ke siapa pun. Tugasnya dikerjakan Aqim sebagai Pemilik |
| **Admin aplikasi** | Tanda khusus di akun (Better Auth `admin()`), di atas semua organisasi | `auth.users.role` | Halaman yang hanya untuk admin aplikasi: Produk, Material, Kategori barang, Gudang, Administrasi → Pengguna dan Log Audit, Pengaturan Penggajian | **Tetap ada dan tetap wajib** di akun Aqim. Bila dicabut, tidak ada yang bisa membuka halaman Produk, Gudang, dan Pengguna |
| **Akun bernama `admin`** | Akun login milik Aqim (username `admin`) | `auth.users.username` | Memegang role Pemilik **dan** tanda admin aplikasi sekaligus | Tetap dipakai Aqim |

Jadi "Admin sudah dihapus" berarti **role organisasi Admin** tidak dipakai.
Tanda admin aplikasi di akun Aqim **tidak boleh ikut dihapus**. Keputusan
B3 (Pembelian/Gudang boleh membuka halaman barang dan gudang) akan
mengurangi ketergantungan pada tanda ini.

#### Role Pembelian (`purchasing`)

| | Rincian |
|---|---|
| **Bisa** | Pemasok: lihat (termasuk rekening bank), tambah, ubah, arsipkan. Permintaan Pembelian: buat dan ajukan. PO: buat, ubah, ajukan, tandai terkirim, cetak/ekspor. Retur pembelian: buat, ajukan, batalkan. Data barang: buat, ubah, dan melihat harga pokok (tetapi halamannya sekarang hanya untuk admin aplikasi, lihat B3). Melihat stok. Membuat dan mengajukan penyesuaian stok |
| **Tidak bisa** | Menyetujui PR, PO, atau retur (itu Manajer Operasional atau Pemilik). Menerima barang (itu Gudang). Membatalkan PO (sekarang hanya Pemilik; lihat B2) |
| **Status di tim** | **Tidak dipakai** (K2): Aqim mengerjakan pembelian sebagai Pemilik. Role tetap ada di aplikasi dan bisa diberikan bila nanti ada staf pembelian; saat itu PO-nya disetujui Aqim, jadi tidak ada bentrok |

#### Pengguna di luar web-admin: investor dan pelanggan

Investor dan pelanggan **bukan** role organisasi, jadi tidak masuk daftar 17
role dan tidak bisa membuka web-admin. Keduanya adalah **role aplikasi**
(`appRoleNames = ['investor', 'customer']`, ADR-0018), disimpan di
`auth.users.role`. Web-admin menolak login akun yang hanya punya role
aplikasi ini.

| | Pelanggan (`customer`) | Investor (`investor`) |
|---|---|---|
| **Aplikasi** | Portal pelanggan `apps/web-customer-portal` (http://localhost:4322) | Portal investor `apps/web-investor` |
| **Cara dapat akun** | Pelanggan perusahaan diundang (Penjualan atau Layanan Pelanggan → akun portal); pelanggan perorangan bisa mendaftar sendiri; akun otomatis saat lead dijadikan pelanggan | Belum ada alurnya; tidak ada akun contoh `investor_seed` |
| **Yang sudah bisa** | Login per kontak, melihat proyek, membuat dan membalas tiket servis, mendaftarkan perangkat/booking servis | **Belum ada**: aplikasinya masih template kosong, dan M11 belum dibangun |
| **Yang belum** | SPH, invoice, pembayaran, dan dokumen masih "segera hadir" (T25); foto dan prioritas tiket belum tersimpan | Semua fitur investor (modal, bagi hasil, laporan). Schema `investor` sudah dihapus (ADR-0024), jadi butuh ADR baru (K10) |
| **Pemilik modul** | Programmer B (M07) | Oki (M11) |

Karyawan memakai aplikasi ketiga di luar web-admin, yaitu **portal karyawan**
(`apps/web-employee`, http://localhost:5174). Portal ini tidak memakai role
aplikasi; ia memakai keanggotaan organisasi dan data karyawan. Absensi
lokasi proyek, cuti, dokumen, dan slip gaji ada di sana; rinciannya di
`uat-modul/modul-oki/portal-karyawan.md`.

#### Cara absensi karyawan sekarang

Ada **tiga jalan** absensi. Semuanya masuk ke satu catatan per karyawan per
hari di `human_resource` (status: Hadir, Izin, Sakit, Cuti, Alpa, Libur).

| Jalan | Siapa | Di mana | Cara | Catatan |
|---|---|---|---|---|
| **1. Absen mandiri di kantor** | Karyawan sendiri | Portal karyawan → **Absensi** | Tekan **Check-in** saat datang, **Check-out** saat pulang. Hanya sekali per hari; tidak bisa check-out sebelum check-in; terkunci pada hari cuti yang disetujui | Tanpa lokasi dan tanpa foto. Tercatat sebagai "Check-in mandiri" |
| **2. Absen di lokasi proyek** | Karyawan yang ditugaskan di proyek | Portal karyawan → proyek → **Kunjungan lokasi saya** | Izinkan lokasi (GPS) → ambil **selfie** → **Check-in**; saat selesai **Check-out** (lokasi dibaca ulang) | Jarak dihitung dari titik proyek (PostGIS), radius contoh 100 m. Di luar radius **tetap tersimpan** tetapi ditandai "di luar radius" (temuan O-8). Pekerja yang bukan PIC belum bisa melihat kunjungannya sendiri |
| **3. Dicatat SDM** | SDM (Aqim) | Web-admin → **Sumber Daya Manusia → Absensi** | Isi **lembar harian** per tanggal (status, jam masuk, jam pulang, catatan), atau **impor file** dengan kolom kode_karyawan, tanggal, status, jam_masuk, jam_pulang, catatan | Untuk yang tidak absen lewat portal, atau untuk koreksi. Ada **rekap bulanan** |

**Cuti dan lembur:**
- Karyawan **mengajukan cuti** dari portal (atau SDM mencatatnya).
- **SDM menyetujui atau menolak.**
- Kuota cuti tahunan 12 hari; hari Minggu tidak dihitung.
- Hari cuti yang disetujui otomatis tercatat "Cuti" di absensi.
- Lembur dicatat dalam jam (kelipatan 0,25) lalu disetujui SDM. Jumlah jam
  yang disetujui tampil saat menyiapkan gaji; uang lembur diisi manual.

**Siapa saja yang absen:** karyawan yang punya **data karyawan** (dibuat
SDM). Akun tanpa data karyawan tidak bisa memakai portal; ini terjadi pada
akun uji `technician_seed`.

Bila lapisan organisasi dihapus (K12), portal karyawan tetap dipakai, tetapi
cara ia mengenali karyawan (sekarang lewat keanggotaan organisasi) ikut
diubah.

***

## Hasil validasi

| Bagian                                               | Lulus | Gagal | Disetujui oleh | Tanggal |
| ---------------------------------------------------- | ----- | ----- | -------------- | ------- |
| Matriks role (1.1–1.2)                               |       |       |                |         |
| Keputusan 1.3                                        |       |       |                |         |
| UAT per modul (lihat rekap di `uat-modul/README.md`) |       |       |                |         |

Kesimpulan: konsep saat ini **dipakai / diubah / diganti rancangan 4 role**\
\
(coret yang tidak perlu).
