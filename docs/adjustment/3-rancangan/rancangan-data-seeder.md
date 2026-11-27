# Rancangan data seeder (data uji)

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: rancangan, permintaan programmer B 2026-11-28.** Tujuannya: setiap
form, tabel, menu, dan alur punya **data uji yang masuk akal** sehingga UAT
pengerjaan dan UAT resmi bisa langsung dijalankan tanpa mengetik data dari
nol. Belum ada kode.

## 1. Kondisi sekarang

Seeder ada di `apps/backend/database/seeders/` (`index.ts` → `seed/*.ts`),
urutannya: perusahaan → akun admin → lokasi → organisasi + anggota per role
(akun `*_seed`) → role → barang → gudang → inventaris → PIC gudang → daftar
akun → keuangan → pajak → karyawan, jadwal, gaji, dokumen → proyek demo →
portal demo → jenis cuti → templat syarat PO → templat notifikasi.

**Belum ada data uji untuk:** prospek, pelanggan, SPH, SO, surat jalan,
faktur, pembayaran; pemasok, PR, PO, BPB, retur; aset dan peminjaman;
lisensi; tiket; investor; karyawan kantor/lapangan/freelance; laporan
harian; biaya perjalanan. Akun uji masih per **role lama** (17 role), belum
mengikuti susunan role per orang (K2).

**Peringatan:** seeder menjalankan `flushall` ke Redis, sehingga sesi login
dev ikut terhapus. Jalankan seeder uji dengan Redis terpisah.

## 2. Prinsip

| No | Prinsip |
|---|---|
| SD-1 | **Deterministik**: `faker.seed(...)` tetap, sehingga hasil sama setiap dijalankan (skill `faker`) |
| SD-2 | **Idempoten**: dijalankan dua kali tidak menambah baris (cek "anchor" per data); diuji setiap PR yang mengubah seeder |
| SD-3 | **Hanya dev/uji.** Produksi hanya data referensi (lokasi, daftar akun, jenis cuti, templat) |
| SD-4 | **Tanpa data pribadi sungguhan:** email `@example.com`, nomor telepon fiktif, NIK/NPWP fiktif berformat benar; investor memakai nama samaran **"Bapak Budi Santoso"** (IV-7) |
| SD-5 | Uang dalam **sen** (Rp 2.500.000 = `250_000_000`), waktu unix milidetik, tanggal Asia/Jakarta |
| SD-6 | Data mencakup **semua status** dokumen (draf, diajukan, disetujui, terkirim, dibatalkan, lunas, lewat jatuh tempo) agar setiap tab, saringan, dan kartu dasbor terisi |
| SD-7 | **Setiap tugas kode yang menambah fitur ikut menambah data seedernya** di PR yang sama (aturan A-10) |

## 3. Akun uji (mengikuti susunan role K2)

Kata sandi uji diatur lewat konfigurasi lokal, tidak ditulis di repo.

| Akun (nama tampilan) | Role | Penempatan / jenis | Untuk menguji |
|---|---|---|---|
| Aqim (uji) | Pemilik, SDM, admin aplikasi | Kantor | Persetujuan K1, menu harian, investor, pengaturan |
| Bella (uji) | Keuangan (gabungan) | Kantor | Faktur, kas/bank, pajak, gaji, upah freelance |
| Agus MD (uji) | Penjualan | Kantor | Prospek, SPH, menyetujui SPH Bilal |
| Bilal (uji) | Penjualan, Gudang, Layanan Pelanggan, Pemasaran | Kantor (sering ditugaskan ke lapangan) | Pesanan online, surat jalan, tiket, WA, katalog, KL-7 |
| Agus (uji) | Manajer Proyek, Teknisi, Gudang | Lapangan | Proyek, menyetujui peminjaman, BPB |
| Jamil (uji) | Manajer Proyek, Teknisi | Lapangan | Proyek, tiket |
| Hatta (uji) | Manajer Proyek | Lapangan | Proyek tanpa role Teknisi |
| Fahri, Alex, Ade (uji) | Teknisi | Lapangan | Tugas, check-in lokasi, laporan harian, kasbon |
| Teknisi freelance (uji, 2 orang) | Pekerja Lepas, jenis Freelance | Lapangan | Upah harian dan borongan (KL-4) |
| Pekerja Lepas non-karyawan (uji) | Pekerja Lepas, tanpa data karyawan | — | Memastikan tidak bisa masuk portal karyawan (X4) |
| Pelanggan portal (uji, 3 akun) | customer | — | Pesanan, SPH, faktur, tiket di portal |
| Bapak Budi Santoso (samaran) + 2 investor lain | investor | — | Dasbor investor, bagi hasil |

## 4. Data per alur

| Alur | Data | Mengisi |
|---|---|---|
| Penjualan | 15 prospek (semua status, beberapa follow-up hari ini/terlambat); 10 pelanggan (perorangan dan perusahaan, 1 perusahaan dengan 2 alamat cabang); 8 SPH (draf, diajukan, disetujui, terkirim, kedaluwarsa, revisi, kalah); 5 SO (dikonfirmasi, diproses, terkirim, selesai, dibatal); 4 surat jalan; 6 faktur (DP, termin, pelunasan, lewat jatuh tempo, lunas, void); kuitansi | Daftar, tab, saringan, kartu dasbor Penjualan dan Keuangan, Perlu Tindakan |
| Pembelian dan gudang | 5 pemasok (1 perorangan); 4 PR; 6 PO (draf, diajukan, disetujui, diterima sebagian, diterima, dibatal); BPB dengan nomor seri; 1 retur pembelian; penyesuaian stok (draf, diajukan, diposting); barang di bawah stok minimum | Gudang, stok, kartu "PO siap diterima", stok minimum |
| Proyek | 3 proyek (persiapan, instalasi, tutup dengan BAST dan garansi); tugas per tahap ditugaskan ke teknisi dan Bilal (KL-7); bukti; check-in lokasi (diterima dan ditolak di luar radius); biaya proyek per kategori termasuk hotel, makan, tiket (BP-5) | Proyek saya, kunjungan lokasi (PK-9), biaya proyek |
| Purna jual | 6 tiket (baru, ditugaskan, dikerjakan, selesai menunggu konfirmasi, ditutup, berbayar di luar garansi); barang terjual tanpa proyek dengan garansi (B-30) | Tiket, cek garansi |
| Lisensi | 3 aplikasi, 5 kontrak (aktif, H-30, H-7, berakhir dalam masa tenggang, dihentikan), kunci, log aktivasi | Lisensi, kartu "lisensi habis" |
| Aset | 10 aset (siap, dipinjam, servis, dihapus), daftar unit pinjaman khusus, 4 peminjaman (diajukan, disetujui, dipinjam, terlambat, kembali rusak) | Aset, peminjaman, kartu Gudang |
| SDM | Karyawan kantor, lapangan, freelance; jadwal; absensi sebulan (hadir, alpa, terlambat, cuti, izin tanpa gaji, hari lapangan); cuti dan lembur (menunggu, disetujui, ditolak); laporan harian (lengkap, ada yang kosong) + ringkasan mingguan/bulanan dengan nilai; gaji bulan lalu disetujui dan bulan ini draf dengan potongan | Absensi, potongan gaji (PG), laporan kerja (LK), slip |
| Keuangan | Kas & bank, kasbon (menunggu, dicairkan, sudah dipertanggungjawabkan), klaim, tagihan pemasok (jatuh tempo dan lewat), pengaturan uang makan dan batas | Keuangan, Perlu Tindakan Aqim |
| Investor | 3 investor: modal, pinjaman dengan jadwal angsuran (lunas dan jatuh tempo), dana per proyek; pengaturan porsi dan cadangan; bagi hasil tahun lalu | Dasbor investor, bagi hasil |
| Notifikasi | Event contoh di log otomasi (terkirim, gagal) | Log Otomasi, uji kirim ulang |

## 5. Tugas

| No | Tugas | Pemegang | Kapan |
|---|---|---|---|
| L-16 | **Rombak seeder uji** mengikuti susunan role K2 dan akun per orang (bagian 3), setelah P7-4 (hak role baru) | Bersama (auth/role: Oki; data modul: pemilik modul) | Akhir langkah 7 |
| A-10 | Setiap tugas langkah 8 menambah data seeder untuk fiturnya (bagian 4) di PR yang sama, diuji idempoten | Penulis kode | Setiap PR |
| — | UAT resmi (langkah 9) memakai data ini, setelah `bun run drizzle:seed` di database uji yang bisa dibuang | Dafrin, Oki | Langkah 9 |
