# Peta halaman yang perlu diperbaiki

Disusun 2026-11-27. Kembali ke [catatan penyesuaian](../README.md).

Daftar halaman yang berubah karena keputusan yang sudah disetujui (lembar
rapat, keputusan teknis T-1 sampai T-7, rancangan menu/dasbor/form), dan
kekurangan fitur yang diusulkan di
[`kekurangan-fitur.md`](../3-rancangan/kekurangan-fitur.md).
Rincian per tugas ada di [`rencana-perubahan.md`](rencana-perubahan.md)
(programmer B) dan [`rencana-perubahan-modul-oki.md`](rencana-perubahan-modul-oki.md)
(Oki).

**Oleh:** D = Dafrin (programmer B), O = Oki, B = bersama (lewat PR, K11).
**Prioritas:** Tinggi = dikerjakan di langkah 7 (perbaikan prioritas tinggi);
Sedang/Rendah = langkah 9 dan sesudahnya (lihat README).

## Penjualan dan Penagihan

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Penawaran (SPH) | Aturan persetujuan K1; berlaku sampai wajib +14 hari dan status Kedaluwarsa; diskon Rp/%; revisi versi baru; PPN dari master; konfirmasi | K1, FU3, OC4 | Tinggi | D |
| Pesanan Penjualan (SO) | Status otomatis Terkirim/Selesai; satu SPH satu SO | C1, FU4 | Sedang | D |
| Surat Jalan | Stok kurang: Kirim ditolak; cek nomor seri; konfirmasi Kirim | FU5 | Sedang | D |
| Retur Penjualan | Barang "Rusak" tidak menambah stok jual | B-13 | Tinggi | D |
| Faktur / Kuitansi | Jatuh tempo wajib; lebih bayar ditolak; tombol menyebut tindakannya | FU9 | Sedang | D/O |
| Prospek / Pelanggan | Nomor, email, NPWP ganda ditolak; filter pelanggan biasa/bisnis | FU1, FU2, OA4 | Sedang | D |

## Pembelian dan Gudang

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Pesanan Pembelian (PO) | "Tandai terkirim" dihapus; K1; nomor > 32 karakter; harga beli terakhir | B1, K1, K6, FU6 | Tinggi | D |
| Penerimaan Barang (BPB) | Konfirmasi posting; kelebihan dari sisa PO ditolak | FU7 | Sedang | D |
| Penyesuaian Stok | K1 menggantikan pengecualian lama; harga rata-rata otomatis; toast berhasil; konversi uang | K1, FU8 | Tinggi | D |
| Barang / Gudang & Rak | Halaman ikut hak role (B3); Gudang melihat PO/SO (B4) | B3, B4 | Sedang | D |

## Keuangan dan Pajak

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Pembayaran Pemasok **[baru]** | Alokasi tagihan, potongan PPh | OB3 | Tinggi | O |
| Pilihan akun (semua form Keuangan) | Pencarian ke server | OB2 | Tinggi | O |
| Tutup Periode | Siapkan oleh Pemilik dan Keuangan; buka kembali hanya Pemilik | RO1, RO4 | Tinggi | O |
| Kasbon dan pertanggungjawaban | Dicairkan Aqim; satu langkah | OB13, RO5 | Tinggi | O |
| Catatan / Pemotongan Pajak | Hitung otomatis; masa bupot otomatis; `vat` diperbaiki; batal dengan alasan; masa tertutup read-only | OC1–OC7 | Tinggi | O |
| Tagihan manual | Isian akun beban | OB14 | Sedang | O |

## Proyek, Aset, Lisensi

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Peminjaman Aset | Daftar unit khusus; nama bukan ID; serahkan setelah disetujui; kondisi saat kembali; status Terlambat | OD1, OD4, C13, OD7, FU13 | Tinggi | O |
| Daftar Aset / Penghapusan | Rupiah konsisten; hapus aset dipinjam ditolak; Set Peralatan disembunyikan | OD3, OD6, OD5 | Tinggi | O |
| Servis & Kondisi **[baru]** | Form catat servis/kondisi | OD5 | Sedang | O |
| Lisensi | Masa tahun kalender; kunci pindah saat periode mulai; kode aplikasi dikunci | T-2, T-3 | Sedang | D |
| Tiket Servis | Tiket berbayar bila garansi habis | FU10 | Sedang | D |

## SDM dan Portal

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Cuti / Lembur (admin dan portal) | Kuota ditolak; lembur maks. 4 jam; tolak wajib alasan | FU11, FU12, FR3 | Sedang | D |
| Lembar Absensi | Peringatan perubahan belum disimpan | FU11 | Sedang | D |
| Tugas | Teknisi dan Pekerja Lepas hanya tugas sendiri | D4 | Rendah | D |
| Portal karyawan: Kasbon, Riwayat absen lokasi, Lupa kata sandi **[baru]** | Ditambah; radius untuk check-in dan check-out | OB13, OG2, OG3, OG1, PK-1 | Tinggi | O |
| Portal pelanggan | Login Google; satu jenis akun; teks bahasa Indonesia | K13, OA4 | Sedang | D |

## Akun, Pengaturan, dan seluruh aplikasi

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Masuk (web-admin dan portal karyawan) | Tombol Google dihapus; pesan akun nonaktif dibedakan | K13, OA14 | Tinggi | O |
| Organisasi | Disembunyikan | K12 tahap 1 | Tinggi | O |
| Pengguna / Undang | Hanya Pemilik mengundang; isian organisasi dihapus; dialog konfirmasi | OA12, K12, OA13 | Tinggi | O |
| Nomor Dokumen | Pratinjau dengan kode pemasok asli; nomor tanpa celah | K6, T-1 | Tinggi | B |
| Pengaturan Gaji | PPh 21 dimatikan | OC8 | Sedang | O/D |
| Pengaturan (satu halaman) | Data induk dipindah ke bagian-bagian Pengaturan | PM-2 | Sedang | B |
| Dasbor | Kartu per role; baris "Hari ini"; lencana "Sementara" dihapus | RD1–RD3, OF1–OF3 | Sedang | O (+D untuk kartu modul D) |
| Perlu Tindakan **[baru]** dan menu | Susunan per pekerjaan; tab; nama baru; Ctrl+K; favorit; menu harian Aqim | RM1–RM4, PM-1–PM-6 | Sedang | B |

## Tambahan dari kekurangan fitur (KF-1, 27/11)

| Halaman | Perbaikan | Keputusan | Prioritas | Oleh |
|---|---|---|---|---|
| Stok: Terima / Keluarkan manual **[baru]** | Bahan proyek dan pemakaian sendiri, pilih proyek dan nomor seri | KF-G1 / B-29 | Tinggi | D |
| Tiket Servis | Cek garansi barang tanpa proyek; tombol Buat SPH/Faktur dari tiket berbayar | KF-P2, KF-P1 / B-30, B-31 | Tinggi | D |
| Pesanan Pembelian (PO) | Tombol Tutup PO kurang kirim | KF-B1 / B-32 | Tinggi | D |
| Kuitansi (detail faktur) | Isian potongan PPh 23 pelanggan | KF-K3 / B-33, M09-17 | Tinggi | D + O |
| Kas & Bank | Pindah dana antar akun **[baru]**; batalkan transaksi | KF-K1, KF-K2 / M09-15, M09-16 | Tinggi | O |
| Aset Tetap & Penyusutan | Satu jalur penyusutan | KF-A1 / M06-14 | Tinggi | O |
| Pajak | Tampilan terutang / dibayar / sisa per masa; rekap PPh Final bila UMKM | KF-T1, KF-T2 / M10-11, M10-12 | Tinggi | O |

## Tambahan dari alur lengkap (27/11; prioritas Tinggi 28/11)

| Halaman | Perbaikan | Rencana | Prioritas | Oleh |
|---|---|---|---|---|
| Proyek: Tugas | Notifikasi ke teknisi saat ditugaskan | B-35 | Tinggi | D |
| Portal pelanggan: Tiket | Tombol konfirmasi tiket selesai | B-36 | Tinggi | D |
| Cetak SO, Kuitansi, BPB, Retur **[baru]** | Halaman cetak / PDF | B-37 | Tinggi | D |
| Portal pelanggan + website: Pesanan, SPH, Faktur, Bayar | Disambungkan ke ERP (T21, T25); urutan: akun + website → pesanan/SPH/faktur/bayar → dokumen + notifikasi → lacak (PP-8) | B-38 | Tinggi | D |

## Tambahan dari kekurangan fitur bagian kedua (28/11)

| Halaman | Perbaikan | Rencana | Prioritas | Oleh |
|---|---|---|---|---|
| Penggajian + Pengaturan → Gaji | Potongan alpa, izin tanpa gaji, terlambat, pro-rata (diatur); upah lembur dihitung | B-39 | Tinggi | D |
| Portal karyawan: Laporan harian **[baru]** | Isi laporan harian, pengingat, menyusul maks. 2 hari | B-44 | Tinggi | D + O |
| Karyawan (form) | Penempatan Kantor/Lapangan, jenis Freelance, tarif harian/borongan | B-45 | Tinggi | D |
| Rekap dan pembayaran upah freelance **[baru]** | Hari kerja sah / borongan, dibayar Bella | B-45, M09-18 | Tinggi | D + O |
| Portal karyawan: menu per penempatan/freelance | Kantor vs lapangan vs freelance | PK-10 | Tinggi | O |
| Laporan mingguan/bulanan + penilaian **[baru]** | Rangkuman otomatis, ringkasan karyawan, skor Aqim, PDF per karyawan | B-44 | Tinggi | D |
| Detail pelanggan | Riwayat SPH/SO/faktur/proyek/lisensi/tiket dan saldo | B-40 | Tinggi | D |
| Detail SPH / faktur | Unduh PDF, salin tautan, wa.me / email | B-41 | Tinggi | D |
| Faktur tanpa SO **[baru]** | Faktur jasa / biaya tambahan / perpanjangan | B-42 | Tinggi | D |
| Pengguna | Ubah beberapa role; reset kata sandi | M12-14, M12-15 | Tinggi | O |
| Ubah karyawan | Bug role tambahan hilang | M12-14 | Tinggi | O + D |
| Ekspor di daftar utama; PDF laporan keuangan | Ekspor CSV/XLSX, laporan berkop | M12-16 | Tinggi | O (+ pemilik modul) |
| Kunjungan lokasi teknisi **[baru]** | Layar admin check-in lokasi dan swafoto | PK-9 | Tinggi | O |

## Tambahan pekerjaan non-modul (28/11)

| Halaman | Perbaikan | Rencana | Prioritas | Oleh |
|---|---|---|---|---|
| Impor data **[baru]** (per modul atau satu halaman di Pengaturan) | Unduh templat, unggah, periksa semua baris, daftar kesalahan per baris | L-12 | Tinggi | Bersama |
| Masuk (login) | Batas percobaan login | L-11 | Tinggi | O |

**Jumlah:** sekitar 35 halaman, termasuk 5 halaman baru (Pembayaran
Pemasok, Servis & Kondisi, Kasbon portal, Riwayat absen lokasi, Perlu
Tindakan). Tambahan dari pemeriksaan kekurangan fitur ada di bagian bawah
setelah diputuskan.
