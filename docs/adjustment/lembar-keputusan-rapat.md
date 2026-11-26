# Lembar keputusan rapat

Kembali ke [catatan penyesuaian](README.md). Satu lembar untuk rapat dengan
Pemilik dan Oki. Isinya gabungan semua keputusan dari
[`bahan-keputusan.md`](bahan-keputusan.md),
[`validasi-konsep-saat-ini.md`](validasi-konsep-saat-ini.md), dan
[`rencana-perubahan.md`](rencana-perubahan.md) bagian 1. Disusun
2026-11-26.

**Cara mengisi:**
- Tulis pilihan yang diambil di kolom **Keputusan**, misalnya `(b)`, atau
  tulis jawaban sendiri.
- Tulis siapa yang memutuskan di kolom **Oleh** (Pemilik / Oki / bersama).
- Butir yang sudah dijawab programmer B ditandai *jawaban sementara*.
  Pemilik cukup mengonfirmasi atau mengganti.
- Setelah rapat, hasilnya disalin ke tiga file sumber di atas dan ke
  `catatan-progres.md`, supaya semua catatan sama.

**Rapat**

| Tanggal | Tempat | Hadir | Notulis |
|---|---|---|---|
| | | Pemilik (Aqim), Oki, Dafrin | |

---

## 1. Paling mendesak (memblokir alur)

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| **K1** | Bolehkah Pemilik (Aqim) menyetujui dokumennya sendiri? Sekarang PO, PR, dan retur pembelian buatan Aqim tidak bisa disetujui siapa pun, karena Aqim satu-satunya Manajer Operasional | (a) Tidak boleh, sesuai ADR-0006. (b) **Pemilik saja** boleh, tercatat di audit, untuk semua dokumen. (c) Ada Manajer Operasional kedua. (d) PO dibuat orang lain, Aqim yang menyetujui | **(b)**; *jawaban sementara programmer B: (b)*. Butuh perubahan ADR-0006 oleh Oki. Sumber: A1, R2, 3.8, pertanyaan 1.3 no. 1 dan 10 | | |
| K1a | Bila K1 = (b), apakah juga berlaku untuk jurnal manual, kasbon, dan pertanggungjawaban di keuangan (sekarang dilarang menyetujui sendiri)? | (a) Ya. (b) Tidak, tetap butuh orang kedua | (b) untuk jurnal (Bella dan Aqim saling memeriksa); (a) untuk kasbon dan pertanggungjawaban | | |
| **K2** | Susunan role per orang (tabel di bawah). Role yang dipakai turun dari 16 menjadi 12 | (a) Setuju. (b) Setuju dengan perubahan. (c) Tetap seperti sekarang | **(a)**; *jawaban sementara programmer B: (a)*. Sumber: 3.8, D1, R7 | | |
| K2a | Role SDM hanya untuk Aqim; yang lain cukup layanan mandiri (absen, cuti, slip gaji sendiri)? | (a) Ya. (b) Tambah satu orang SDM | **(a)**; *jawaban sementara programmer B: ya, cukup Aqim*. Sumber: R1 | | |
| **K6** | Format nomor PO. Sekarang PO ke pemasok berkode otomatis (misal `DEV-ENTRAGATE-SUP-00001`) tidak bisa disetujui karena nomornya lebih dari 32 karakter | (a) Kode pemasok otomatis dipersingkat (misal `SUP-00001`). (b) Kolom nomor diperlebar. (c) Kode pemasok singkat wajib diisi manual | **(a)**, bisa lewat Administrasi → Nomor Kode tanpa ubah kode; ditambah perbaikan pratinjau | | |

**Usulan role per orang (untuk K2):**

| Orang | Role yang diusulkan | Dihapus (sudah tercakup) | Setuju? |
|---|---|---|---|
| Aqim | Pemilik, SDM | Admin, Manajer Operasional, Pembelian, Keuangan | |
| Agus MD | Manajer Penjualan | — | |
| Bilal | Manajer Penjualan, Gudang, Layanan Pelanggan, Pemasaran | Penjualan, Anggota | |
| Agus | Manajer Proyek, Teknisi, Gudang | Anggota | |
| Jamil | Manajer Proyek, Teknisi | Anggota | |
| Hatta | Manajer Proyek | Pekerja Lepas | |
| Fahri | Teknisi | Anggota | |
| Alex, Ade | Teknisi | Pekerja Lepas | |
| Bella | Akuntan | — | |
| Dafrin, Oki | Pekerja Lepas, Anggota | — | |

## 2. Persetujuan lainnya

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| A2 | SPH dan PO tetap wajib disetujui? | (a) Tetap wajib. (b) Tidak wajib | (a), bila K1 = (b) | | |
| A3 | Cuti yang dicatat SDM disetujui orang lain? | (a) Tetap. (b) SDM boleh menyetujui sendiri | (a) | | |
| A3a | Cuti Aqim sendiri: siapa yang menyetujui? | (a) Aqim sendiri, tercatat di audit (ikut K1). (b) Orang lain | (a) | | |
| K7 | Bilal boleh membuat SO lalu mengirim barangnya sendiri? (Bilal memegang Penjualan dan Gudang) | (a) Boleh. (b) SO Bilal dikirim Agus | (a) untuk tim kecil, diawasi lewat laporan | | |
| K7a | Persetujuan yang **tanpa pemeriksa kedua**: gaji, pembayaran, klaim garansi (Bilal sendiri), peminjaman aset (PM menyetujui sendiri) | (a) Diterima, diawasi lewat laporan dan audit. (b) Tambah pemeriksa | (a) gaji/pembayaran/garansi; perbaiki peminjaman aset (bug) | | |

## 3. Pembelian dan gudang (M05)

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| B1 | Perlu langkah "Tandai terkirim" pada PO sebelum gudang menerima? | (a) Tetap. (b) PO disetujui langsung bisa diterima | (b), karena Aqim yang membuat, mengirim, dan menyetujui PO | | |
| B2 | Siapa boleh membatalkan PO? | (a) Hanya Pemilik. (b) Pembelian (draf miliknya) dan Manajer Operasional | (b) | | |
| B3 | Siapa mengelola data barang dan gudang? | (a) Admin aplikasi saja. (b) Ikut hak role (Pembelian, Gudang) | (b) | | |
| B4 | Gudang boleh melihat PO dan SO? | (a) Tidak. (b) Beri hak baca | (b) | | |

## 4. Penjualan (M02)

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| C1 | SO berubah status menjadi Terkirim/Selesai? | (a) Otomatis. (b) Tombol manual | (a) | | |
| C2 | Menu Uang Muka | (a) Dibuka untuk pemegang hak baca invoice. (b) Dihapus | (a) | | |
| C3 | Admin boleh menambah pelanggan? | (a) Tidak. (b) Ya | Tidak relevan bila K2 disetujui (Admin tidak dipakai) | | |

## 5. Role dan menu

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| D2 | Satu orang boleh memegang beberapa role? (sudah didukung aplikasi) | (a) Ya. (b) Satu role saja | (a) | | |
| D3 | Admin perlu akses Proyek? | (a) Tidak. (b) Hak baca | Tidak relevan bila K2 disetujui | | |
| D4 | Menu Tugas: teknisi dan pekerja lepas hanya melihat tugasnya sendiri? | (a) Tetap semua tugas. (b) Hanya tugas sendiri | (b) | | |
| D5 | Halaman konten website untuk Pemasaran | (a) Dibuat. (b) Ditunda | (b) | | |

**Daftar 17 role (validasi 1.1):** isi tetap / tidak dipakai / hapus.

| Role | Dipakai (usulan K2) | Keputusan |
|---|---|---|
| Pemilik | ya | |
| Admin | tidak dipakai sekarang | |
| Anggota | ya (Dafrin, Oki) | |
| Manajer Operasional | tidak dipakai sekarang | |
| Manajer Penjualan | ya | |
| Penjualan | tidak dipakai sekarang | |
| Manajer Proyek | ya | |
| Teknisi | ya | |
| Pekerja Lepas | ya (Dafrin, Oki) | |
| Pembelian | tidak dipakai sekarang | |
| Gudang | ya | |
| Keuangan | tidak dipakai sekarang | |
| Akuntan | ya | |
| SDM | ya (Aqim) | |
| Layanan Pelanggan | ya | |
| Pemasaran | ya | |
| Auditor | tidak dipakai | |

"Tidak dipakai sekarang" artinya role tetap ada di aplikasi dan bisa
diberikan lagi bila ada orang baru.

## 6. Hak per dokumen (validasi 1.2)

Matriks lengkapnya ada di `validasi-konsep-saat-ini.md` bagian 1.2. Cukup
nyatakan setuju atau tidak per matriks.

| Matriks | Ringkasan sekarang | Keputusan (setuju / ubah: …) |
|---|---|---|
| Pelanggan dan pemasok | Penjualan dan Manajer Penjualan mengelola pelanggan; Pembelian mengelola pemasok; akun portal oleh Admin, Manajer Penjualan, Layanan Pelanggan | |
| SPH dan Sales Order | Penjualan membuat dan mengajukan; Manajer Penjualan menyetujui dan membatalkan SO | |
| PO dan Penerimaan Barang | Pembelian membuat, Manajer Operasional menyetujui, Gudang menerima, batal hanya Pemilik | |
| Surat Jalan | Gudang menyiapkan, mengirim, dan menandai diterima | |

## 7. Kontrak dan lingkup

| No | Pertanyaan | Pilihan | Rekomendasi | Keputusan | Oleh |
|---|---|---|---|---|---|
| K8 | Kolom A/B kontrak tidak sama dengan pembagian modul (T19/T20/T23/T24/T27/T28 dikerjakan programmer B; T02/T12/T13/T29/T30 dikerjakan Oki) | (a) Kontrak disesuaikan dengan pembagian modul. (b) Pekerjaan dikembalikan sesuai kontrak | Dibicarakan; rincian di `lintas-modul/di-luar-scope.md` | | |
| K9 | Fitur di kode yang di luar kontrak (portal karyawan, absen GPS, dua gateway pembayaran, PPh 21/Coretax, keuangan lanjutan) | (a) Diterima sebagai tambahan. (b) Dibekukan | Dibicarakan per fitur | | |
| K10 | M11 Bonus & Investor belum dibangun (schema `investor` sudah dihapus) | (a) Dibangun dengan ADR baru. (b) Ditunda | Diputuskan Pemilik dan Oki | | |
| K11 | Pemilik bagian yang belum jelas: modul dokumen, notifikasi, webhook, profil perusahaan, lokasi, penomoran/audit bersama, deploy/CI | Dibagi ke Dafrin / Oki / bersama | Dibagi per bagian | | |

## 8. Untuk Oki

| No | Hal | Keputusan Oki |
|---|---|---|
| E1–E5 | Dokumen arsitektur yang tidak cocok dengan kode (ADR-0024 status, jumlah schema/role, batas nominal, ADR-0006 ikut K1) | boleh diperbaiki Dafrin / Oki sendiri / biarkan |
| O-1..O-9 | Temuan UAT modul Oki (M06, M09, M10, M11, M12, M01, portal karyawan), lihat `rencana-perubahan.md` bagian 3 | diterima untuk diperiksa / ditolak |

## 9. Kesimpulan

| Bagian | Kesimpulan |
|---|---|
| Konsep saat ini (17 role, alur di kode) | dipakai / diubah / diganti (coret) |
| Matriks role dan hak per dokumen | setuju / perlu perubahan |
| Urutan pengerjaan (`rencana-perubahan.md`) | setuju / ubah: … |

**Tindak lanjut**

| No | Tindakan | Penanggung jawab | Tenggat |
|---|---|---|---|
| 1 | Salin keputusan ke `bahan-keputusan.md`, `validasi-konsep-saat-ini.md`, `rencana-perubahan.md` | Dafrin | |
| 2 | Ubah ADR-0006 bila K1 = (b) | Oki | |
| 3 | Atur ulang role anggota sesuai K2 | Aqim | |
| 4 | Atur format kode pemasok sesuai K6 | Aqim | |
| | | | |

**Tanda tangan**

| Pemilik | Oki | Dafrin |
|---|---|---|
| | | |
