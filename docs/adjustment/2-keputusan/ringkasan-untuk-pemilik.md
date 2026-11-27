# Ringkasan keputusan untuk Pemilik

Kembali ke [catatan penyesuaian](../README.md). Rincian setiap butir ada di
[lembar keputusan rapat](lembar-keputusan-rapat.md). Disusun 2026-11-27.

**Status: disetujui Pak Aqim pada rapat 2026-11-27, semua butir sesuai usulan** (dilaporkan programmer B).

Isinya hanya hal yang perlu persetujuan **Pak Aqim** sebagai pemilik usaha.
Kolom **Usulan** adalah jawaban programmer B (Dafrin); cukup centang Ya atau
Tidak, dan tulis catatan bila ingin diubah.

## A. Yang perlu disetujui Pemilik

| No | Yang diputuskan | Usulan | Setuju? |
|---|---|---|---|
| 1 | Bolehkah Pak Aqim menyetujui dokumen buatannya sendiri (PO, SPH, kasbon, gaji, dan lain-lain)? | Boleh, dan setiap kejadian tercatat di riwayat aktivitas | ☑ Ya |
| 2 | Kapan aturan no. 1 mulai berlaku? | Setelah riwayat aktivitas dibuat lengkap dan tidak bisa terlewat (perubahan role, hapus anggota, persetujuan sendiri wajib tercatat) | ☑ Ya |
| 3 | Susunan role per orang (tabel di bawah) | Disetujui; Penjualan jadi satu role; Akuntan dan Keuangan jadi satu role untuk Bella; SDM hanya Pak Aqim | ☑ Ya |
| 4 | Role Admin dan Anggota | Dihapus. Akun Pak Aqim tetap pengelola aplikasi. Dafrin dan Oki hanya Pekerja Lepas, tanpa absen dan slip gaji di aplikasi | ☑ Ya |
| 5 | Aturan kasbon teknisi | Pak Aqim tidak mengajukan kasbon. Teknisi mengajukan dan melihat kasbonnya lewat portal karyawan. Pak Aqim menyetujui dan mencairkan. Laporan pemakaian kasbon cukup satu kali diperiksa Pak Aqim | ☑ Ya |
| 6 | Jurnal manual (koreksi pembukuan) | Tetap dua orang: Bella membuat, Pak Aqim menyetujui, atau sebaliknya | ☑ Ya |
| 7 | Langkah "Tandai terkirim" pada PO | Dihapus. PO yang sudah disetujui langsung bisa diterima gudang | ☑ Ya |
| 8 | Status pesanan penjualan (SO) | Berubah sendiri menjadi Terkirim/Selesai mengikuti surat jalan, tanpa tombol manual | ☑ Ya |
| 9 | Persetujuan tanpa pemeriksa kedua: gaji, pembayaran, klaim biaya, klaim garansi | Diterima. Diawasi Pak Aqim lewat laporan bulanan dan riwayat aktivitas | ☑ Ya |
| 10 | Bella memegang satu role keuangan gabungan | Diterima, dengan akibat: Bella **melihat semua gaji dan rekening karyawan**, aset tetap, dan anggaran proyek | ☑ Ya |
| 11 | Absen di lokasi proyek di luar radius | Ditolak, baik saat datang maupun saat pulang | ☑ Ya |
| 12 | Pilihan "organisasi" di aplikasi | Dihapus bertahap, karena aplikasi hanya untuk satu perusahaan. Tampilan disembunyikan dulu; data lamanya dibersihkan paling akhir supaya aman | ☑ Ya |
| 13 | Cara masuk aplikasi | Karyawan diundang, lalu masuk dengan nama pengguna/email dan kata sandi (tanpa Google). Pelanggan masuk dengan Google, satu jenis akun; data perusahaan diisi belakangan di profil | ☑ Ya |
| 14 | Layar pembayaran ke pemasok | Dibuat, termasuk potongan PPh, supaya utang ke pemasok bisa dilunasi di aplikasi | ☑ Ya |
| 15 | Tarif PPN | Diambil dari daftar tarif pajak yang punya tanggal mulai berlaku. Setiap dokumen menyimpan tarifnya; tarif berbeda per dokumen boleh dengan alasan | ☑ Ya |
| 16 | PPh 21 karyawan | Untuk sekarang dihitung di luar aplikasi; hitung otomatis dimatikan | ☑ Ya |
| 17 | Tanda "Sementara" pada angka laba di dasbor | Dihapus, karena pembukuan tidak ditutup setiap bulan | ☑ Ya |
| 18 | Bonus & Investor | Ditunda. Halaman investor ditutup, hanya Pak Aqim yang bisa membuka | ☑ Ya |
| 19 | Data aset dan peralatan | Tetap seperti sekarang, tidak dibangun ulang; dipisah hanya bila nanti asetnya banyak atau rumit | ☑ Ya |

**Susunan role per orang (butir 3):**

| Orang | Role |
|---|---|
| Aqim | Pemilik, SDM (tetap pengelola aplikasi) |
| Bella | Keuangan (gabungan Akuntan + Keuangan) |
| Agus MD | Penjualan |
| Bilal | Penjualan, Gudang, Layanan Pelanggan, Pemasaran |
| Agus | Manajer Proyek, Teknisi, Gudang |
| Jamil | Manajer Proyek, Teknisi |
| Hatta | Manajer Proyek |
| Fahri, Alex, Ade | Teknisi |
| Dafrin, Oki | Pekerja Lepas |

Agus MD dan Bilal saling menyetujui penawaran (SPH); penawaran sendiri tidak
bisa disetujui sendiri.

## B. Dibahas di rapat (hasil rapat 27/11)

- **K8:** pembagian pekerjaan di kontrak (kolom A/B) belum sama dengan pembagian modul sekarang. **Hasil:** kontrak disesuaikan dengan pembagian modul; pertukaran task dicatat resmi beserta dampak pembayarannya.
- **K9:** fitur yang sudah ada tetapi di luar kontrak (portal karyawan, absen GPS, dua gateway pembayaran, PPh 21/Coretax, keuangan lanjutan): diterima sebagai tambahan atau dibekukan. **Hasil:** semua diterima sebagai tambahan, ikut UAT dan serah terima.
- **K11:** siapa yang memegang bagian bersama (dokumen, notifikasi, profil perusahaan, penomoran, server dan pemasangan). **Hasil:** dipegang bersama; setiap perubahan wajib diberitahukan ke programmer lain lewat PR.
- **OB11:** rincian laporan arus kas (transaksi tanpa uang tunai, misalnya aset yang dimasukkan sebagai modal). **Hasil:** jurnal yang tidak menyentuh kas diabaikan dalam laporan arus kas.

## Tanda tangan

| Pemilik | Tanggal | Tanda tangan |
|---|---|---|
| Aqim | 2026-11-27 | disetujui di rapat (dilaporkan programmer B) |
