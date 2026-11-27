# Kekurangan fitur per modul

Disusun 2026-11-27. Kembali ke [catatan penyesuaian](../README.md).

Pemeriksaan **apa yang masih kurang** di Proyek & Purna Jual, Gudang &
Inventaris, Pengadaan (modul programmer B), serta Aset, Keuangan, dan Pajak
(modul Oki). Pembandingnya:
- batas kontrak di `docs/plan/erp-plan-id.md` (M05, M06, M07, M09, M10) dan
  `docs/plan/erp-module-plans/`;
- kode backend dan web-admin (dibaca, tidak diuji di browser);
- catatan yang sudah ada di folder ini, supaya tidak ada butir ganda.

**Status: diputuskan programmer B 27/11.** 10 butir terpenting masuk rencana kerja (B-29–B-33, M09-15–M09-17, M10-11–M10-13, M06-14); butir Sedang/Rendah masuk daftar tunggu (B-34, M06-15); butir "Tambahan" menunggu permintaan Pemilik. Butir yang sudah ada di
rencana tidak diulang; nomornya disebut di bagian "Sudah direncanakan".

**Kolom:**
- **Jenis:** *Belum ada* = tidak ada endpoint maupun layar.
  *Setengah jadi* = ada sebagian (misalnya backend tanpa layar).
- **Kontrak:** *Ya* = termasuk batas kontrak. *Abu-abu* = tidak tegas.
  *Tambahan* = di luar kontrak (diterima bila dibangun, K9).
- **Prioritas** usulan: Tinggi / Sedang / Rendah.

---

## Ringkasan: 10 butir terpenting

| No | Kekurangan | Modul | Kontrak | Prioritas | Oleh |
|---|---|---|---|---|---|
| KF-G1 | **Keluar/masuk stok manual** (bahan proyek, pemakaian sendiri) belum punya layar; backend sudah ada | Gudang | Ya | Tinggi | D |
| KF-P2 | **Cek garansi untuk barang yang dijual tanpa proyek** selalu "di luar garansi" | Proyek | Ya | Tinggi | D |
| KF-P1 | **Tiket berbayar tidak bisa ditagih** (jadi SPH/faktur) | Proyek | Ya | Tinggi | D |
| KF-B1 | **PO tidak bisa ditutup** bila pemasok tidak mengirim sisanya | Pengadaan | Ya | Tinggi | D |
| KF-K1 | **Pindah dana antar kas/bank** (setor tunai ke bank, isi kas kecil) belum ada | Keuangan | Ya | Tinggi | O |
| KF-K2 | **Transaksi kas/bank yang salah tidak bisa dibatalkan** | Keuangan | Ya | Tinggi | O |
| KF-K3 | **PPh 23 dipotong pelanggan** saat membayar faktur belum didukung; sisa 2% menggantung | Keuangan + Pajak + Penjualan | Ya | Tinggi | O + D |
| KF-A1 | **Dua jalur penyusutan bentrok**: entri manual menghentikan penyusutan otomatis di buku besar | Aset | Ya | Tinggi | O |
| KF-T1 | **Status pajak terutang / dibayar per masa** tidak tersambung | Pajak | Ya | Tinggi | O |
| KF-T2 | **Rezim pajak perusahaan belum dipastikan** (PPh Final UMKM 0,5% atau normal) | Pajak | Ya | Sedang (Tinggi bila UMKM) | O + Bella |

---

## 1. Proyek dan Purna Jual (M07, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-P1 | Tiket berbayar (di luar garansi) tidak bisa dibuatkan SPH atau faktur; `tickets.service_cost` tersimpan tetapi tidak dibaca modul lain | Belum ada | Ya (rencana M07) | Tinggi | Pendapatan servis hilang atau diketik dua kali |
| KF-P2 | Cek garansi hanya lewat seri → pengiriman → **proyek** → sertifikat (`warranty.service.ts:182-205`). Barang yang dijual lewat SO biasa tanpa proyek selalu dianggap di luar garansi. Kolom `item_serials.warranty_expires_on` ada tetapi tidak dipakai | Belum ada | Ya | Tinggi | Penjualan barang adalah usaha inti; tiket mereka salah ditandai berbayar |
| KF-P3 | Suku cadang / unit pengganti di tiket: tidak bisa mengeluarkan stok atau menukar nomor seri (status `applied_warranty` ada tetapi tidak dipakai) | Belum ada | Abu-abu | Sedang | Suku cadang garansi keluar tanpa tercatat |
| KF-P4 | Tiket belum ada di portal karyawan; teknisi harus memakai web-admin | Belum ada | Tambahan | Sedang | Teknisi bekerja dari ponsel |
| KF-P5 | Foto/berkas di tiket dan komentar tiket untuk staf | Belum ada | Ya ("bukti") | Sedang | Bukti kerusakan/perbaikan tidak tersimpan |
| KF-P6 | Staf tidak bisa mengisi **prioritas dan jenis tiket**; daftar tiket hanya disaring status (kolom ada di skema) | Setengah jadi | Ya | Sedang | Antrian tiket tidak bisa diurutkan |
| KF-P7 | Kartu biaya proyek tidak menghitung **PO yang ditandai proyek**, jadi margin proyek salah (`project.service.ts:78-88`) | Setengah jadi | Ya | Sedang | Margin proyek wajib benar |
| KF-P8 | PR memakai nama proyek teks bebas, bukan tautan ke proyek | Setengah jadi | Ya | Rendah | Belanja PR tidak terlacak ke proyek |
| KF-P9 | Pengingat garansi habis dan tugas terlambat | Belum ada | Abu-abu | Rendah | Peluang perpanjangan/servis |
| KF-P10 | Kontrak perawatan berkala dan jadwal kunjungan | Belum ada | Tambahan | Rendah | Untuk tahap berikutnya |
| KF-P11 | Klaim garansi ke pemasok (RMA) untuk unit yang sudah terjual | Belum ada | Abu-abu | Rendah | Jarang, tetapi terjadi pada reader/controller |

## 2. Gudang dan Inventaris (M05, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-G1 | **Terima/keluarkan stok manual**: `POST /stock/receipts` dan `/stock/issues` sudah ada, fungsi di `stock-api.ts` ada, tetapi **tidak ada layar**. Perlu pilihan proyek dan nomor seri. Termasuk bahan instalasi (kabel, habis pakai) yang tidak ada di SO | Setengah jadi | Ya | Tinggi | Bahan proyek dan pemakaian sendiri tidak bisa dicatat |
| KF-G2 | Mutasi stok tanpa saringan (backend mendukung gudang, barang, jenis, tanggal); **kartu stok per barang** dengan saldo berjalan belum ada | Setengah jadi | Ya | Sedang | Laporan inventaris paling sering dipakai; murah karena backend siap |
| KF-G3 | **Stok minimum**: `min_stock_qty` tersimpan, tetapi tidak ada peringatan, dan daftar "stok menipis" di dasbor masih **data contoh tetap** (`org-dashboard-data.ts:44-51`); belum ada jalan pintas membuat PR | Belum ada | Abu-abu | Sedang | Barang laris habis tanpa ketahuan |
| KF-G4 | **Lacak satu nomor seri**: dari PO mana, dikirim ke siapa, tiket apa, statusnya | Belum ada | Ya (seri terlacak) | Sedang | Kebutuhan harian purna jual |
| KF-G5 | Ekspor CSV/Excel stok, mutasi, nilai persediaan | Belum ada | Ya (ekspor umum) | Rendah | Pemeriksaan Keuangan dan Pemilik |
| KF-G6 | Lembar hitung stok opname yang bisa dicetak | Belum ada | Abu-abu | Rendah | Penghitungan sudah lewat penyesuaian stok |
| KF-G7 | Pindai barcode/QR | Belum ada | Tambahan | Rendah | Catatan saja |

## 3. Pengadaan (M05, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-B1 | **Tutup PO kurang kirim**: tidak ada tindakan Tutup, dan Batalkan ditolak setelah ada penerimaan, jadi PO tetap "diterima sebagian" selamanya | Belum ada | Ya | Tinggi | PO terbuka dan saldo GR/IR menumpuk |
| KF-B2 | **Retur untuk pengembalian uang / nota kredit**, bukan hanya barang pengganti (`purchase-return.service.ts:86-97`) | Belum ada | Abu-abu | Sedang | Pemasok sering mengembalikan uang atau memotong tagihan |
| KF-B3 | **Riwayat dan saldo pemasok** di halaman pemasok (PO, penerimaan, tagihan, utang) | Belum ada | Ya | Sedang | Cek sebelum memesan atau membayar |
| KF-B4 | **Pemasok perorangan** tidak bisa dibuatkan PO (`supplierCompanyId` wajib di PO) | Setengah jadi | Ya | Sedang | Vendor lokal kecil sering perorangan |
| KF-B5 | Kirim PO ke pemasok lewat email/WhatsApp dari aplikasi (cetak sudah ada) | Belum ada | Abu-abu | Rendah | Cetak + kirim manual masih cukup |
| KF-B6 | Daftar harga per pemasok / perbandingan harga | Belum ada | Abu-abu | Rendah | FU6 sudah mengisi harga beli terakhir |

## 4. Aset dan Peralatan (M06, Oki)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-A1 | **Dua jalur penyusutan bentrok**: entri manual (Aset → Penyusutan) menurunkan nilai buku tanpa jurnal, lalu "Jalankan penyusutan" di Keuangan melewati aset itu (`fixed-asset.service.ts:154-205`) | Setengah jadi | Ya | Tinggi | Buku besar diam-diam kehilangan penyusutan |
| KF-A2 | Harga perolehan masih bisa diubah setelah aset dikapitalisasi | Setengah jadi | Ya | Sedang | Nilai register tidak cocok dengan buku aset tetap |
| KF-A3 | Pengajuan peminjaman tidak memesan unitnya, jadi satu unit bisa ada di dua pengajuan yang disetujui | Setengah jadi | Ya | Sedang | Bentrok saat serah terima |
| KF-A4 | Detail aset tanpa tombol Ubah, tidak menampilkan seri, jenis, tanggal/harga perolehan, foto | Setengah jadi | Ya | Sedang | M06-8 hanya memperbaiki tombol aksi |
| KF-A5 | Dokumen aset (kartu garansi, faktur beli) hanya ada di backend | Setengah jadi | Abu-abu | Sedang | Bukti garansi untuk klaim |
| KF-A6 | Daftar penghapusan tidak menampilkan asetnya; satu aset bisa punya beberapa penghapusan aktif | Setengah jadi | Ya | Sedang | — |
| KF-A7 | "Pinjaman saya / harus kembali hari ini" untuk teknisi (dasbor atau portal) | Belum ada | Tambahan | Sedang | Sebagian tercakup kartu dasbor Teknisi (RD1) |
| KF-A8 | Kategori aset tidak bisa diarsipkan dari layar; Tolak peminjaman tanpa alasan (FR3) | Setengah jadi | Ya | Rendah | — |
| KF-A9 | Biaya servis aset tidak masuk buku besar | Belum ada | Abu-abu | Rendah | Bisa dicatat sebagai tagihan/beban |
| KF-A10 | Formulir serah terima alat yang bisa dicetak dan ditandatangani | Belum ada | Abu-abu | Rendah | Kertas manual masih bisa |

## 5. Keuangan (M09, Oki)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-K1 | **Pindah dana antar akun kas/bank** (setor tunai ke bank, tarik tunai, isi kas kecil). Sekarang hanya masuk/keluar ke akun buku besar, sehingga sisi "masuk" di akun lain tidak tercatat dan rekonsiliasi rusak | Belum ada | Ya | Tinggi | Terjadi tiap minggu |
| KF-K2 | **Batalkan/koreksi transaksi kas/bank**: status `reversed` ada di skema, tetapi tidak ada layanan maupun layar | Setengah jadi | Ya | Tinggi | Salah input terjadi setiap hari |
| KF-K3 | **PPh 23 dipotong pelanggan** saat membayar faktur: kuitansi tidak mendukung potongan, tidak ada akun "PPh 23 dibayar dimuka", jadi faktur menyisakan 2% selamanya | Belum ada | Ya | Tinggi | Biasa untuk jasa instalasi B2B; menyentuh `sale` (programmer B), `payment`, `tax` (Oki) |
| KF-K4 | Foto nota di klaim biaya: kolom ada, tidak ada unggahan | Setengah jadi | Abu-abu | Sedang | Persetujuan tanpa pemeriksa kedua (OB8) bergantung pada bukti |
| KF-K5 | Halaman Jurnal tidak menampilkan baris jurnal dan draf tidak bisa diubah (backend ada) | Setengah jadi | Ya ("terlacak ke baris jurnal") | Sedang | — |
| KF-K6 | Layar Aturan Posting belum memuat peran posting baru (kasbon, laba/rugi pelepasan aset) | Setengah jadi | Ya | Sedang | Bella tidak bisa memetakan ulang akunnya |
| KF-K7 | Rekening koran pelanggan / pengingat piutang jatuh tempo | Belum ada | Abu-abu | Sedang | Hanya pengingat utang pemasok yang ada |
| KF-K8 | Baris saldo awal tidak bisa diubah; arsip laporan tidak bisa dibuka satu per satu; halaman awal Keuangan masih "Segera hadir" | Setengah jadi | Ya | Rendah | — |
| KF-K9 | Bukti kas keluar / voucher pembayaran yang bisa dicetak; lampiran faktur pemasok di tagihan | Belum ada | Abu-abu | Rendah | — |
| KF-K10 | Karyawan mengajukan klaim biaya sendiri (di luar kasbon) lewat portal | Belum ada | Tambahan | Rendah | — |

## 6. Pajak (M10, Oki)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-T1 | **Status terutang / dibayar per masa** tidak tersambung: setor pajak hanya tercatat di Keuangan, catatan pajak hanya draf → diverifikasi → dilaporkan (tanpa "dibayar"), status bayar pemotongan diubah manual; tidak ada tampilan terutang vs dibayar vs sisa per masa | Setengah jadi | **Ya** (butir tahap 1 kontrak) | Tinggi | — |
| KF-T2 | **Rezim pajak**: PPh Final UMKM 0,5% omzet (PP 55/2022) tidak dihitung atau direkap; perlu dipastikan dengan Bella apakah perusahaan memakai rezim ini | Belum ada | Ya | Sedang (Tinggi bila UMKM) | — |
| KF-T3 | PPh 23 dipotong pelanggan (bupot dari pelanggan, kredit pajak) | Belum ada | Ya | Tinggi | Satu paket dengan KF-K3 |
| KF-T4 | Catatan pajak diketik manual; faktur, tagihan, dan gaji tidak membuat catatan pajak otomatis | Setengah jadi | Ya (rencana M10) | Sedang | Risiko beda dengan buku besar |
| KF-T5 | Bukti pajak berupa kotak ID teks, bukan unggahan berkas (NTPN, e-Faktur, bupot) | Setengah jadi | Ya | Sedang | Sama dengan FR1 |
| KF-T6 | Faktur pajak masukan per tagihan pemasok (sekarang hanya saldo buku besar) | Belum ada | Abu-abu | Sedang | PPN masukan dikreditkan tanpa bukti per faktur |
| KF-T7 | Pengingat batas setor (tanggal 15) dan lapor (tanggal 20/akhir bulan) | Belum ada | Abu-abu | Rendah | — |
| KF-T8 | Bukti potong PPh 21 tahunan 1721-A1 | Belum ada | Tambahan | Rendah | PPh 21 dihitung di luar aplikasi (OC8) |

---

## Sudah direncanakan (tidak diulang)

| Modul | Nomor di rencana / keputusan |
|---|---|
| Proyek | B-16 (foto/prioritas tiket portal, ubah tiket, tenggat tugas), B-19, B-25, B-26 (S6: tahap, milestone, laporan harian, KPI, templat/sub-tiket), FU10, RM3 |
| Gudang | B-1/K1, B-2–B-5, B-9, B-10, B-13 (retur rusak), B-18 (reservasi, pindah antar-gudang), B-23 (B3), FU8, PM-1 |
| Pengadaan | B-1, B-6, B-7, B-8, B-21 (B1), B-23 (B4), L-2 (K6), FU6, FU7, OB3 (pembayaran pemasok), OB14 |
| Aset | M06-1 sampai M06-13 (OD1–OD9), C13, FU13, OB5 |
| Keuangan | M09-1 sampai M09-14 (OB1–OB15, RO1–RO6), FU9, usulan di `skema-database/finance.md` (jurnal berulang, nota kredit pemasok, impor settlement gateway) |
| Pajak | M10-1 sampai M10-10 (OC1–OC8), T-5 |

---

## Yang perlu diputuskan

| No | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| KF-1 | 10 butir terpenting (ringkasan atas) masuk rencana kerja | (a) Semua masuk, prioritas seperti tabel. (b) Pilih sebagian | (a) |
| KF-2 | Butir Sedang dan Rendah | (a) Masuk daftar tunggu, dikerjakan setelah perbaikan prioritas tinggi. (b) Ditolak | (a) |
| KF-3 | Butir "Tambahan" (di luar kontrak) | (a) Daftar tunggu, menunggu permintaan Pemilik. (b) Dibangun bersama yang lain | (a) |
| KF-4 | KF-T2 rezim pajak | Bella memastikan sebelum UAT Pajak | — |

**Keputusan 27/11:** KF-1 (a) semua 10 butir masuk rencana; KF-2 (a) daftar tunggu; KF-3 (a) menunggu permintaan Pemilik; KF-4 ditanyakan ke Bella.
