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

### Opsi pajak untuk Bella (KF-T2, T-5)

Programmer B tidak mendalami perpajakan, jadi disiapkan pilihan. **Aturan
pajak harus dikonfirmasi Bella atau konsultan pajak sebelum dipakai**; isi
di bawah adalah ringkasan umum, bukan nasihat pajak.

**1. Rezim PPh penghasilan usaha**

| Opsi | Ringkasan | Akibat di aplikasi |
|---|---|---|
| (a) **PPh Final UMKM 0,5%** (PP 55/2022) | Untuk badan usaha dengan omzet sampai Rp4,8 miliar per tahun, dalam jangka waktu terbatas sejak terdaftar | Rekap omzet bulanan × 0,5% dan setoran per bulan (KF-T2) |
| (b) **PPh Badan normal** | Pajak dari laba bersih akhir tahun, dengan fasilitas pengurangan tarif untuk omzet tertentu | Laporan laba rugi dan rekonsiliasi fiskal; tidak perlu rekap 0,5% |

**2. Status PKP (PPN)**

| Opsi | Akibat di aplikasi |
|---|---|
| (a) **PKP** (wajib bila omzet di atas Rp4,8 miliar setahun, atau memilih dikukuhkan) | Faktur memuat PPN, faktur pajak keluaran (Coretax), PPN masukan dikreditkan, tutup PPN masa (sudah ada di kode) |
| (b) **Non-PKP** | Faktur tanpa PPN; fitur PPN dimatikan lewat pengaturan |

**3. Tarif dan pembulatan (T-5):** tarif PPN dan cara menghitung dasar
pengenaan pajak berubah mengikuti peraturan terbaru; isi lewat master pajak
bertanggal berlaku (OC4), dan pembulatan ke rupiah penuh per dokumen sesuai
arahan Bella.

**Rekomendasi:** aplikasi menyediakan **pengaturan rezim PPh dan status
PKP** (dipilih Bella sekali, bisa diubah bila status perusahaan berubah),
sehingga programmer tidak perlu menebak. Bella mengisi pilihan dan tarif
sebelum UAT Pajak.

---

## Bagian kedua: modul yang diperiksa 2026-11-28

Diperiksa atas permintaan programmer B agar semua modul tercakup: M02, M03,
M04, M08 (programmer B), M01, M12, portal karyawan (Oki). M11 ditunda (K10):
yang ada hanya tiga halaman "Segera hadir", izin investor di
`erp-permissions.ts`, dan `apps/web-investor` templat kosong.

**Catatan penting:**
- **Checklist UAT M08 sebagian sudah usang.** Ubah karyawan dan ubah tugas
  SDM sudah dibangun, jadi temuan M08 no. 1, 2, 9 dan sebagian B-17 selesai.
  Sisa B-17: tolak/batal cuti tanpa alasan, contoh impor `EMP-0001`.
- **Gaji (T19/T20) sebagian besar sudah dibangun:** hitung PPh 21 TER dan
  BPJS, persetujuan Pemilik memposting jurnal, slip gaji PDF dan ZIP, slip di
  portal karyawan, BP21 XML, pembayaran lewat Keuangan. Yang kurang ada di
  KF-H1 dan KF-H2.

**Keputusan programmer B 28/11 (bagian kedua):**
- **Tinggi:** KF-H1 + KF-H2 (B-39), KF-S1 (B-40), KF-S2 (B-41), KF-S6 (B-42), KF-R1 + KF-R2 (M12-14), KF-R3 (M12-15), KF-R5 + KF-R6 (M12-16), KF-E1 (PK-9).
- **Daftar tunggu:** KF-N1, KF-L1, KF-D1, KF-I3 dan semua butir Sedang/Rendah lain (B-43, M12-17); butir "Tambahan" menunggu permintaan Pemilik.
- Catatan: KF-L1 (lisensi di portal) termasuk kontrak T25, dan KF-N1 membuat pemberitahuan tetap bergantung pada n8n sampai dikerjakan.

### Ringkasan: butir terpenting bagian kedua

| No | Kekurangan | Modul | Kontrak | Prioritas usulan | Oleh |
|---|---|---|---|---|---|
| KF-R1 | **Ubah role pengguna (beberapa role) dari halaman Pengguna.** Sekarang hanya lewat Organisasi → anggota, yang akan disembunyikan K12 | M12 | Ya | Tinggi | O |
| KF-R2 | **Bug: form ubah karyawan menghapus role tambahan** saat disimpan (satu pilihan role menimpa semua) | M12/M08 | Ya | Tinggi | O + D |
| KF-R3 | **Admin mengatur ulang kata sandi** atau memberi kata sandi sementara | M12 | Abu-abu | Tinggi | O |
| KF-E1 | **Layar admin untuk kunjungan lokasi dan swafoto teknisi** (sekarang hanya PIC proyek di portal) | Portal karyawan | Tambahan | Tinggi | O |
| KF-H1 | **Gaji memakai absensi**: potongan tidak hadir / izin tanpa gaji, pro-rata karyawan masuk/keluar | M08 | Ya (T19) | Tinggi | D |
| KF-L1 | **Lisensi di portal pelanggan** (kontrak T25 menyebut lisensi; B-38 belum) | M03 | Ya | Tinggi | D |
| KF-N1 | **Notifikasi di aplikasi pengganti n8n**: SPH menunggu persetujuan / diputuskan, follow-up jatuh tempo, lisensi jatuh tempo, chat WA diserahkan ke admin, prospek website baru | M02/M03/M04 | Ya / Abu-abu | Tinggi | D |
| KF-S1 | **Riwayat dan saldo pelanggan** di halaman pelanggan (SPH, SO, faktur, sisa piutang, proyek, lisensi, tiket) | M02 | Ya | Tinggi | D |

### 7. Penjualan (M02, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-S1 | Riwayat dan saldo pelanggan | Belum ada | Ya | Tinggi | `crm/customers/$customerId.tsx:231-276` hanya data, alamat, kartu portal |
| KF-S2 | Kirim SPH/faktur tanpa n8n: tombol unduh PDF, salin tautan, `wa.me`/email (tautan PDF sudah dibuat, hanya dikirim ke n8n) | Setengah jadi | Ya (S02) | Sedang | `quotation-delivery.service.ts:25-35, 64` |
| KF-S3 | Laporan penjualan per periode, penjual, pelanggan, barang; konversi SPH; ekspor | Belum ada | Abu-abu | Sedang | Tinjauan bulanan Pemilik dan Penjualan |
| KF-S4 | Retur penjualan diselesaikan dengan nota kredit / pengembalian uang, bukan hanya barang pengganti | Belum ada | Abu-abu | Sedang | `sales-return.service.ts:100`; SO yang dibuka lagi tetap terbuka |
| KF-S5 | Unggah lampiran prospek oleh staf (foto survei, gambar) | Setengah jadi | Ya (S01) | Sedang | Tabel `lead_attachments` ada, hanya unduh |
| KF-S6 | Faktur tanpa SO (jasa, biaya tambahan, perpanjangan lisensi): backend siap, layar belum; bersama B-31 | Setengah jadi | Ya | Sedang | `invoice.contract.ts:32` |
| KF-S7 | Faktur proforma (permintaan DP) dan berulang belum dipakai | Setengah jadi | Abu-abu | Rendah | `sale.schema.ts:118,736` |
| KF-S8 | Status kuitansi draf/diverifikasi/void tidak dipakai (verifikasi manual S03 tanpa langkah) | Setengah jadi | Ya | Rendah | `invoice.repository.ts:512` |
| KF-S9 | Ekspor CSV prospek, pelanggan, SPH, faktur | Belum ada | Ya (ekspor) | Rendah | — |
| KF-S10 | Penjualan tunai cepat tanpa rantai SPH | Belum ada | Tambahan | Rendah | — |
| KF-S11 | Konversi prospek tanpa dialog kredensial portal; "Perusahaan terdaftar" tanpa pilihan tersimpan diam-diam; halaman `/sales` dan `/crm` "Segera hadir" | Setengah jadi | Ya | Rendah | Temuan UAT M02; RM4 |

### 8. Langganan dan Lisensi (M03, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-L1 | Lisensi di portal pelanggan | Belum ada | Ya (T25) | Tinggi | `erp-routes.ts` tanpa lisensi |
| KF-L2 | Pengingat lisensi jatuh tempo di aplikasi (sekarang hanya event n8n) | Setengah jadi | Ya | Tinggi | `licensing.service.ts:362-399`; termasuk KF-N1 |
| KF-L3 | Tagihan berulang / perpanjangan otomatis untuk kontrak bulanan/triwulan (`billingCycle` tersimpan, tidak dipakai) | Setengah jadi | Abu-abu | Sedang | `licensing.service.ts:451` |
| KF-L4 | Temuan UAT M03 yang belum punya nomor: pemilih dibatasi 100 (#6), "berlaku sampai" kunci tidak dicek (#12), toast salah (#5), label opsional (#7), catatan kunci tidak tampil (#9), nilai kontrak tanpa batas (#11) | Setengah jadi | Ya | Sedang (#6, #12) / Rendah | `subscription/$contractId/index.tsx`, `contract-form.tsx` |
| KF-L5 | Masa tenggang 7 hari tertulis di kode, seharusnya pengaturan | Setengah jadi | Ya | Rendah | `license.ts:64` |
| KF-L6 | Draf kontrak lisensi dari SO yang berisi barang lisensi; ekspor daftar jatuh tempo | Belum ada | Abu-abu | Rendah | — |

### 9. Integrasi (M04, sisi ERP; n8n tidak dibahas)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-I1 | Notifikasi/lencana saat chat WA perlu admin dan saat ada prospek website baru (sekarang hanya event n8n; kotak masuk hanya diperbarui saat dibuka) | Setengah jadi | Ya (T28) | Tinggi | Termasuk KF-N1 |
| KF-I2 | Penangkal spam di form website (honeypot / batas per pengunjung) | Belum ada | Ya | Sedang | `public-website.controller.ts:60-90` |
| KF-I3 | Website berbahasa Indonesia (`lang="en"`, teks Inggris) | Setengah jadi | Ya (DoD M04) | Sedang | `BaseLayout.astro:24` |
| KF-I4 | Foto/berkas WA masuk disimpan sebagai teks `[media]` | Setengah jadi | Abu-abu | Sedang | `whatsapp.service.ts:85`; pelanggan mengirim foto kerusakan |
| KF-I5 | Kirim pesan WA keluar dari ERP (misalnya SPH); hubungkan chat ke pelanggan yang ada | Belum ada | Abu-abu / Tambahan | Rendah | — |

### 10. Karyawan, Kehadiran, Gaji (M08, programmer B)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-H1 | Gaji memakai absensi: potongan, izin tanpa gaji, pro-rata, terlambat (pengaturan PG-1–PG-5, B-39) | Belum ada | Ya (T19) | Tinggi | `salary.service.ts:177-182`, `payroll-calculation.service.ts:38-55` |
| KF-H2 | Upah lembur selalu 0 dan diketik manual | Setengah jadi | Ya | Tinggi | `salary.service.ts:182` (ERP-0018) |
| KF-H3 | Kalender libur nasional (cuti di hari libur memotong kuota) | Belum ada | Abu-abu | Sedang | `hr.ts:25-26` |
| KF-H4 | Jabatan dan departemen karyawan (untuk slip gaji dan perjanjian kerja) | Belum ada | Ya | Sedang | `human-resource.schema.ts:114-186` |
| KF-H5 | Tanggal akhir kontrak / masa percobaan + pengingat | Belum ada | Abu-abu | Sedang | — |
| KF-H6 | Keterlambatan dibanding jadwal tidak dihitung | Setengah jadi | Abu-abu | Sedang | jadwal dan absensi sudah ada |
| KF-H7 | Layar jenis cuti dan kuota; ekspor rekap absensi/lembur; pilihan atasan; bantuan THR | Belum ada | Abu-abu / Tambahan | Rendah | — |

### 11. Dasbor (M01, Oki)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-D1 | Kartu umur piutang dan utang (endpoint `/ar/aging`, `/ap/aging` sudah ada) | Setengah jadi | Ya | Tinggi | Murah; bagian RD1 |
| KF-D2 | Kartu tahap 2: gaji disetujui, transaksi gateway terverifikasi | Belum ada | Ya (M01 tahap 2) | Sedang | `m01-dasbor.md:543` |
| KF-D3 | Dasbor tanpa organisasi aktif menautkan ke `/organizations`, yang disembunyikan K12 | Setengah jadi | Ya | Sedang | `dashboard-page.tsx:118-137` |
| KF-D4 | Jumlah dan nilai SPH terbuka di kartu Penjualan | Belum ada | Ya | Rendah | — |

### 12. Laporan dan Hak Akses (M12, Oki)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-R1 | Ubah role pengguna (beberapa) dari halaman Pengguna | Belum ada | Ya | Tinggi | `admin/users/index.tsx:565-590` |
| KF-R2 | Bug form ubah karyawan menimpa semua role | Setengah jadi | Ya | Tinggi | `employee-edit-form.tsx:95-110` |
| KF-R3 | Atur ulang kata sandi oleh admin / kata sandi sementara | Belum ada | Abu-abu | Tinggi | Better Auth `setUserPassword` tanpa layar |
| KF-R4 | Audit login berhasil dan gagal | Belum ada | Ya | Sedang | `session.auth.ts:142` |
| KF-R5 | Ekspor CSV/XLSX daftar (pelanggan, faktur, piutang, karyawan, log audit); ±20 izin `export` tanpa endpoint | Setengah jadi | Ya | Sedang | `erp-permissions.ts:32-111` |
| KF-R6 | PDF laporan keuangan berkop | Belum ada | Abu-abu | Sedang | Untuk bank dan tender |
| KF-R7 | Arsip bulanan juga memuat ringkasan operasional, otomatis saat tutup, sebagai berkas | Setengah jadi | Ya | Sedang | `report-archive.service.ts:87-111` |
| KF-R8 | Undang / hubungkan login untuk karyawan yang sudah ada | Setengah jadi | Ya | Sedang | `employee-account-card.tsx:12-16` |
| KF-R9 | Menu Laporan hanya berisi Arsip Bulanan; `/reports` tidak ada di menu | Setengah jadi | Ya | Sedang | `nav-config.ts:585-597` (ikut PM-6) |
| KF-R10 | Halaman baca hak per role; kolom login terakhir; 2FA akun Pemilik; batas percobaan login | Belum ada | Abu-abu / Tambahan | Rendah | — |

### 13. Portal karyawan (Oki, tambahan K9)

| No | Kekurangan | Jenis | Kontrak | Prioritas | Bukti / alasan |
|---|---|---|---|---|---|
| KF-E1 | Layar admin kunjungan lokasi dan swafoto | Belum ada | Tambahan | Tinggi | `site-attendance.service.ts:208-216` hanya PIC |
| KF-E2 | Pengajuan koreksi absen (lupa absen); izinnya sudah ada | Belum ada | Abu-abu | Sedang | `erp-permissions.ts:69, 821` |
| KF-E3 | Cuti yang sudah disetujui bisa dibatalkan karyawan tanpa SDM | Setengah jadi | Abu-abu | Sedang | `leave.service.ts:198-207` |
| KF-E4 | Absen mandiri tidak ditandai di absensi SDM dan bisa ditimpa tanpa jejak | Setengah jadi | Abu-abu | Sedang | `employee-portal.service.ts:205-235` |
| KF-E5 | Lampiran surat sakit, cuti setengah hari | Belum ada | Tambahan | Sedang | — |
| KF-E6 | Batalkan lembur sendiri; klik notifikasi tidak membuka apa pun; sisa cuti menghitung pengajuan tertunda; label kecil | Setengah jadi | Tambahan | Rendah | Temuan UAT portal |
| KF-E7 | Pasang di ponsel (PWA) dan notifikasi push | Belum ada | Tambahan | Rendah | — |
