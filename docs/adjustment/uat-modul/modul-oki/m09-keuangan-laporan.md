# UAT M09 - Keuangan: Laporan (programmer kedua: Oki)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** catat angka awal → transaksi contoh di [m09-keuangan-transaksi.md](m09-keuangan-transaksi.md) → neraca saldo dan buku besar → laba rugi → neraca → arus kas (langsung, tidak langsung) dan perubahan ekuitas → biaya proyek dan laba rugi pusat biaya → profitabilitas → proyeksi kas 13 minggu → rasio → paket manajemen → arsip bulanan dan laba periode tertutup → hak akses laporan.

Versi lengkap per layar, disusun 2026-11-26 dari kode (`apps/web-admin/src/components/finance/reports-page.tsx`, `ledger-reports.tsx`, `statements-report.tsx`, `cost-reports.tsx`, `profitability-report.tsx`, `cash-forecast-report.tsx`, `ratios-report.tsx`, `management-pack-report.tsx`; backend `apps/backend/src/app/finance/services/report.service.ts`, `statement.service.ts`, `ratio.service.ts`, `cost-report.service.ts`, `cash-forecast.service.ts`, `management-pack.service.ts`). Belum diuji di aplikasi. **Setiap pilihan dan setiap tab ikut dicoba.** Setiap langkah berisi:

- **Menu**: menu yang dibuka, dengan label persis seperti di sidebar.
- **Isi dengan**: tanggal, pilihan, atau isian yang dipakai. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: angka dan tampilan yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak atau kosong dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun:** `accountant_seed` (Akuntan/Bella) untuk sebagian besar langkah; `finance_seed`, `auditor_seed`, `admin` (Pemilik/Aqim, password di `apps/backend/.env`), `sales_seed` untuk cek akses. Password dev `<role>123456`.

**Cara membaca angka.** Database dev dipakai bersama, jadi laporan sudah berisi transaksi lain. Karena itu laporan dicek dengan **selisih**: catat angka **sebelum** (langkah A1, sebelum file transaksi dikerjakan), lalu angka **sesudah**; selisihnya harus sama dengan kolom "Kenaikan" di tabel. Akun baru `1-1140`, `6-2450`, pusat biaya `CC-UAT`, dan akun kas/bank `BANK-UAT` hanya dipakai UAT, jadi angkanya dicek **persis**. Bila ada penguji lain memposting di rentang yang sama di antara "sebelum" dan "sesudah", tulis di Catatan.

**Rentang yang dipakai:** Tanggal mulai `01/10/2026`, Tanggal akhir `30/11/2026`, Tanggal per (neraca) `30/11/2026`, kecuali disebut lain. Rentang dimulai Oktober supaya jurnal penyesuaian Oktober dan pembaliknya di 1 November (J24) saling meniadakan.

**Ringkasan kenaikan yang diharapkan dari transaksi contoh** (J1–J24 di file transaksi):

| Laporan | Pos | Kenaikan (Rp) |
|---|---|---|
| Laba Rugi | Pendapatan: 4-1100 Penjualan Perangkat | 11.000.000 |
| Laba Rugi | Pendapatan: 4-1900 Retur dan Potongan Penjualan | −100.000 |
| Laba Rugi | Pendapatan: 7-1000 Pendapatan Bunga Bank | 250.000 |
| Laba Rugi | **Total Pendapatan** | **11.150.000** |
| Laba Rugi | Beban: 6-2100 Sewa 1.500.000; 6-2300 Perlengkapan 750.000; 6-2400 Transportasi 1.100.000; 6-2450 Rapat UAT 200.000; 6-2500 Penyusutan 250.000; 6-2900 Umum Lainnya 2.000.000; 6-3200 Payment Gateway 5.000; 8-1000 Administrasi Bank 15.000 | |
| Laba Rugi | **Total Beban** | **5.820.000** |
| Laba Rugi | **Laba bersih** | **5.330.000** |
| Neraca | Aset: 1-1120 6.000.000; 1-1140 48.280.000; 1-1250 −1.000.000; 1-1310 5.100.000; 1-1340 0; 1-1390 999.000 (saldo debit, lihat ❓ D6 transaksi); 1-1810 616.000; 1-2130 12.000.000; 1-2230 −250.000 | |
| Neraca | **Total Aset** | **71.745.000** |
| Neraca | Liabilitas: 2-1100 6.216.000; 2-1150 −3.600.000; 2-1200 0; 2-1410 1.199.000; 2-1420 −150.000; 2-1800 750.000 | |
| Neraca | **Total Liabilitas** | **4.415.000** |
| Neraca | Ekuitas: 3-1000 62.000.000; laba tahun berjalan 5.330.000 | |
| Neraca | **Total Ekuitas** | **67.330.000** (Liabilitas + Ekuitas = 71.745.000) |
| Arus kas langsung | Operasi 4.280.000; Investasi 0; Pendanaan 50.000.000 | |
| Arus kas langsung | **Kenaikan kas bersih** | **54.280.000** (= 1-1120 6.000.000 + 1-1140 48.280.000) |
| Arus kas tidak langsung | Laba 5.330.000; Pos non-kas −749.000; Perubahan modal kerja −301.000; Operasi 4.280.000; Investasi −12.000.000; Pendanaan 62.000.000 | **54.280.000** |
| Neraca Saldo | Total mutasi debit = total mutasi kredit | **96.751.000** |

***

## A. Persiapan

### A1. Catat angka awal (sebelum file transaksi, login `accountant_seed`)

Menu **Keuangan → Keuangan → Laporan Keuangan**. Keterangan "Dihitung on-demand dari baris jurnal yang diposting — bukan snapshot tersimpan." Di atas ada 3 kotak tanggal tanpa label (urutannya: tanggal mulai, tanggal akhir, tanggal per untuk neraca) dan tombol **Jalankan laporan**.

| Isian | Isi dengan |
|---|---|
| Kotak tanggal 1 (mulai) | `01/10/2026` |
| Kotak tanggal 2 (akhir) | `30/11/2026` |
| Kotak tanggal 3 (tanggal per neraca) | `30/11/2026` |

**Klik:** Jalankan laporan. Buka tab satu per satu dan salin angkanya ke tabel berikut (tab Paket manajemen pakai bulan 2026-11, tab Proyeksi kas tidak perlu).

| Laporan | Angka | Sebelum | Sesudah | Selisih (harus) |
|---|---|---|---|---|
| Laba Rugi | Pendapatan | | | 11.150.000 |
| Laba Rugi | Beban | | | 5.820.000 |
| Laba Rugi | Laba bersih | | | 5.330.000 |
| Laba Rugi 01/10–31/10 | Laba bersih | | | −50.000 |
| Laba Rugi 01/11–30/11 | Laba bersih | | | 5.380.000 |
| Neraca 30/11 | Aset | | | 71.745.000 |
| Neraca 30/11 | Liabilitas | | | 4.415.000 |
| Neraca 30/11 | Ekuitas | | | 67.330.000 |
| Neraca 31/10 | Liabilitas | | | 50.000 |
| Arus Kas | Operasional / Investasi / Pendanaan | | | 4.280.000 / 0 / 50.000.000 |
| Arus Kas | Perubahan bersih kas | | | 54.280.000 |
| Neraca Saldo | Jumlah mutasi debit | | | 96.751.000 |
| Neraca Saldo | Baris 1-1310 mutasi debit / kredit | | | 13.210.000 / 8.110.000 |
| Neraca Saldo | Baris 6-2900 mutasi debit / kredit | | | 2.150.000 / 150.000 |
| Biaya proyek | Proyek M07: Biaya | | | 500.000 |
| Profitabilitas (Pelanggan) | Budi Hartono UAT: Pendapatan | | | 10.900.000 |

**Harus terlihat:** setiap tab menampilkan angka (atau kosong untuk tab tanpa data) tanpa pesan galat. Bila K2 file transaksi (amortisasi, tutup PPN masa Oktober) menghasilkan angka bukan nol, jurnalnya ikut masuk ke selisih; tulis angkanya di Catatan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Rentang salah dan label tanggal

Masih di **Laporan Keuangan**: kotak tanggal 1 `30/11/2026`, kotak tanggal 2 `01/10/2026` (mulai sesudah akhir) → **Jalankan laporan**.

**Harus terlihat:** tab Laba Rugi tetap kosong bertuliskan "Jalankan laporan" (tidak memanggil server) atau pesan "Rentang tanggal laporan tidak valid"; tidak ada angka yang salah. ⚠️ Ketiga kotak tanggal tidak berlabel; penguji harus tahu urutannya. Kembalikan ke rentang A1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## B. Neraca saldo dan buku besar (login `accountant_seed`)

Semua langkah di bawah dikerjakan **setelah** file transaksi selesai, dengan rentang A1.

### B1. Neraca saldo seimbang

Tab **Neraca Saldo**. Kolom: Akun, Saldo awal (Debit, Kredit), Mutasi (Debit, Kredit), Saldo akhir (Debit, Kredit); baris Jumlah di bawah.

**Harus terlihat:** lencana "Debit dan kredit seimbang."; di baris Jumlah, Mutasi Debit = Mutasi Kredit, dan Saldo akhir Debit = Saldo akhir Kredit. Jumlah mutasi debit naik **Rp 96.751.000** dibanding A1. Jurnal yang dibuang (I5, K3, K4 transaksi) tidak ikut.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Baris akun di neraca saldo

Masih tab **Neraca Saldo**, cari baris berikut.

| Akun | Saldo awal | Mutasi Debit | Mutasi Kredit | Saldo akhir |
|---|---|---|---|---|
| 1-1140 Kas di Bank UAT (persis) | 0 / 0 | 51.445.000 | 3.165.000 | Debit 48.280.000 |
| 6-2450 Beban Rapat UAT (persis) | 0 / 0 | 200.000 | 0 | Debit 200.000 |
| 1-1310 Piutang Usaha (selisih) | — | +13.210.000 | +8.110.000 | Debit +5.100.000 |
| 6-2900 Beban Umum Lainnya (selisih) | — | +2.150.000 | +150.000 | Debit +2.000.000 |
| 2-1800 Biaya Masih Harus Dibayar (selisih) | — | +150.000 | +900.000 | Kredit +750.000 |
| 3-1000 Modal Disetor (selisih) | — | 0 | +62.000.000 | Kredit +62.000.000 |

**Harus terlihat:** angka sesuai tabel. Akun header `6-9000` (diarsipkan, tanpa posting) tidak muncul.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Buku besar akun Kas di Bank UAT

Tab **Buku Besar** → pilihan **Pilih akun** *(cek pilihan: daftar akun `kode — nama`)* → **1-1140 — Kas di Bank UAT**. Kolom: Tanggal, Jurnal, Deskripsi, Debit, Kredit, Saldo berjalan.

**Harus terlihat:** Saldo awal 0, lalu 9 baris berurutan tanggal, Saldo akhir 48.280.000:

| Tanggal | Asal | Debit | Kredit | Saldo berjalan |
|---|---|---|---|---|
| 02/11 | Setoran modal (C3) | 50.000.000 | | 50.000.000 |
| 03/11 | Sewa gudang (C4) | | 1.500.000 | 48.500.000 |
| 04/11 | Bunga bank (C4) | 250.000 | | 48.750.000 |
| 12/11 | Bayar klaim (G4) | | 500.000 | 48.250.000 |
| 13/11 | Cairkan uang muka (G8) | | 1.000.000 | 47.250.000 |
| 15/11 | Pengembalian uang muka (G11) | 200.000 | | 47.450.000 |
| 16/11 | Settlement gateway (C7) | 995.000 | | 48.445.000 |
| 17/11 | Setor PPh 21 (C5) | | 150.000 | 48.295.000 |
| 30/11 | Biaya administrasi bank (J5) | | 15.000 | 48.280.000 |

Saldo akhir sama dengan Saldo saat ini BANK-UAT di **Kas & Bank** dan dengan Saldo buku di rekonsiliasi J6. Pembayaran yang dibatalkan (G8, G11 transaksi) tidak muncul.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Buku besar dengan pembalik

Tab **Buku Besar**: pilih **6-2900 — Beban Umum Lainnya**, lalu **1-1310 — Piutang Usaha**.

**Harus terlihat:** di 6-2900 (selain baris transaksi lain): 31/10 Debit 50.000 (penyesuaian Oktober), 01/11 Kredit 50.000 (pembaliknya), 05/11 Debit 100.000 (jurnal salah), 05/11 Kredit 100.000 (reversal), 07/11 Debit 2.000.000 (tagihan manual). Di 1-1310: 06/11 Debit 11.100.000 (Faktur 1), 08/11 Debit 1.110.000 (Faktur 2), 09/11 Kredit 1.000.000 (kuitansi salah), Debit 1.000.000 (pembatalan kuitansi, bertanggal hari pembatalan atau 09/11), 09/11 Kredit 111.000 (nota kredit), 10/11 Kredit 6.000.000 (kuitansi), Kredit 999.000 (penghapusan piutang, tanggal persetujuan). Kolom Jurnal berisi nomor jurnal yang sama dengan halaman **Jurnal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## C. Laba rugi

### C1. Laba rugi 1 Oktober – 30 November 2026

Tab **Laba Rugi** (rentang A1). Bagian Pendapatan, Beban, Laba bersih; setiap baris `kode — nama` dan nilai, lalu baris total.

**Harus terlihat:** dibanding A1, Pendapatan naik **Rp 11.150.000** (4-1100 +11.000.000, 4-1900 −100.000, 7-1000 +250.000), Beban naik **Rp 5.820.000** (rinciannya di tabel ringkasan), Laba bersih naik **Rp 5.330.000**. Baris 6-2450 Beban Rapat UAT tampil persis Rp 200.000. Beban Kerugian Piutang (6-2600) **tidak** naik (❓ lihat D6 transaksi). Laba bersih = Pendapatan − Beban.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Laba rugi per bulan (pembalik jatuh di November)

Jalankan dua kali: rentang `01/10/2026`–`31/10/2026`, lalu `01/11/2026`–`30/11/2026`.

**Harus terlihat:** Oktober: Beban naik Rp 50.000 (6-2900, penyesuaian K3), Laba bersih turun Rp 50.000. November: Pendapatan naik Rp 11.150.000, Beban naik Rp 5.770.000 (6-2900 hanya +1.950.000 karena pembalik 01/11), Laba bersih naik Rp 5.380.000. Jumlah kedua bulan = C1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3 ⚠️. Ekspor CSV

Di bawah kotak tanggal ada 3 tombol **Ekspor CSV** berlabel sama (urutannya: laba rugi, neraca, arus kas). Klik ketiganya.

**Harus terlihat (seharusnya):** terunduh `profit-and-loss-2026-10-01_2026-11-30.csv`, `balance-sheet-2026-11-30.csv`, `cash-flow-2026-10-01_2026-11-30.csv`, isinya sama dengan tab di layar. **Dugaan:** tidak ada yang terunduh dan tidak ada pesan, karena alamat unduhan tidak memakai awalan `/finance`. ⚠️ Ketiga tombol juga tidak bisa dibedakan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## D. Neraca

### D1. Neraca per 30 November 2026

Tab **Neraca** (tanggal per `30/11/2026`). Bagian Aset, Liabilitas, Ekuitas, dan baris "Selisih belum terjelaskan".

**Harus terlihat:** dibanding A1, Aset naik **Rp 71.745.000**, Liabilitas naik **Rp 4.415.000**, Ekuitas naik **Rp 67.330.000** (3-1000 +62.000.000 dan laba tahun berjalan +5.330.000). Baris akun sesuai tabel ringkasan; 1-1140 tampil persis Rp 48.280.000. "Selisih belum terjelaskan" Rp 0 (Aset = Liabilitas + Ekuitas). ❓ 1-1390 Cadangan Kerugian Piutang naik Rp 999.000 sebagai saldo debit (menambah aset), akibat penghapusan piutang tanpa cadangan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Neraca per 31 Oktober 2026

Ganti tanggal per menjadi `31/10/2026` → **Jalankan laporan** → tab **Neraca**.

**Harus terlihat:** dibanding angka sebelum (A1, bila dicatat juga untuk 31/10), Liabilitas naik Rp 50.000 (2-1800), Ekuitas (laba tahun berjalan) turun Rp 50.000, Aset tidak berubah; Selisih belum terjelaskan Rp 0. Transaksi November tidak ikut. Kembalikan tanggal per ke `30/11/2026`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## E. Arus kas dan perubahan ekuitas

### E1. Tab Arus Kas

Tab **Arus Kas** (rentang A1). Bagian Operasional, Investasi, Pendanaan, Perubahan bersih kas.

**Harus terlihat:** dibanding A1: Operasional +4.280.000, Investasi 0, Pendanaan +50.000.000, Perubahan bersih kas **+54.280.000**. Kapitalisasi Laptop UAT (J21, tanpa kas) tidak muncul di Investasi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Arus kas metode langsung

Tab **Arus kas & ekuitas** → pilihan pembanding *(cek pilihan: Tanpa pembanding / Bandingkan dengan periode sebelumnya / Bandingkan dengan periode yang sama tahun lalu)* → **Tanpa pembanding**. Tabel "Laporan arus kas (metode langsung)".

**Harus terlihat:** baris per akun lawan di setiap bagian. Kenaikan dibanding sebelum UAT:

| Bagian | Baris akun | Kenaikan (Rp) |
|---|---|---|
| Kas bersih dari aktivitas operasi | 1-1250 1.000.000; 1-1310 6.000.000; 1-1340 −800.000; 2-1200 −500.000; 2-1420 −150.000; 6-2100 −1.500.000; 6-3200 −5.000; 7-1000 250.000; 8-1000 −15.000 | 4.280.000 |
| Kas bersih dari aktivitas investasi | — | 0 |
| Kas bersih dari aktivitas pendanaan | 3-1000 50.000.000 | 50.000.000 |
| Kenaikan (penurunan) kas bersih | | 54.280.000 |

Kas awal periode tidak berubah (tidak ada transaksi UAT sebelum 1 Oktober); Kas akhir periode naik Rp 54.280.000. Kuitansi salah dan pembatalannya (D2 transaksi) saling meniadakan di 1-1310.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3 ❓. Arus kas metode tidak langsung

Tab yang sama, tabel "Rekonsiliasi arus kas (metode tidak langsung)".

**Harus terlihat:** kenaikan dibanding sebelum UAT:

| Baris | Kenaikan (Rp) |
|---|---|
| Laba (rugi) bersih | 5.330.000 |
| Pos non-kas (penyusutan): 1-2230 +250.000; 1-1390 −999.000 | −749.000 |
| Perubahan modal kerja: 1-1250 +1.000.000; 1-1310 −5.100.000; 1-1810 −616.000; 2-1100 +6.216.000; 2-1150 −3.600.000; 2-1410 +1.199.000; 2-1420 −150.000; 2-1800 +750.000 | −301.000 |
| Kas bersih dari aktivitas operasi | 4.280.000 (sama dengan E2) |
| Kas bersih dari aktivitas investasi: 1-2130 | −12.000.000 |
| Kas bersih dari aktivitas pendanaan: 3-1000 | 62.000.000 |
| Kenaikan (penurunan) kas bersih | 54.280.000 (sama dengan E2) |

❓ Metode tidak langsung memasukkan kapitalisasi Laptop UAT yang dibayar dengan setoran modal (tanpa kas) sebagai Investasi −12.000.000 dan Pendanaan +62.000.000, sedangkan metode langsung 0 dan 50.000.000. Totalnya sama, tetapi pembagian per aktivitas berbeda; menurut SAK transaksi nonkas tidak masuk arus kas. ❓ Penghapusan piutang (1-1390) masuk ke baris berlabel "(penyusutan)".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4. Kas akhir sama dengan neraca

Bandingkan Kas akhir periode (E2) dengan jumlah akun kas di **Neraca** per 30/11 (1-1110, 1-1120, 1-1130, 1-1140, ditambah akun GL lain yang ditautkan ke akun kas/bank).

**Harus terlihat:** keduanya sama persis; tulisan merah "Kas akhir berbeda dari buku besar sebesar …" **tidak** muncul di bawah tabel arus kas langsung.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Laporan perubahan ekuitas

Tabel "Laporan perubahan ekuitas": kolom Saldo awal, Penambahan, Pengurangan, Saldo akhir; baris per akun ekuitas, "Laba periode lalu yang belum ditutup", "Laba (rugi) periode berjalan", "Total ekuitas".

**Harus terlihat:** 3-1000 Modal Disetor: Penambahan naik Rp 62.000.000, Pengurangan tidak berubah; Laba (rugi) periode berjalan naik Rp 5.330.000; Total ekuitas akhir naik Rp 67.330.000 dan sama dengan Ekuitas di Neraca 30/11 (D1).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E6. Kolom pembanding

Pilihan pembanding → **Bandingkan dengan periode sebelumnya**, lalu **Bandingkan dengan periode yang sama tahun lalu**.

**Harus terlihat:** muncul kolom kedua dengan judul rentang pembanding (periode sebelumnya: 61 hari sebelum 01/10/2026; tahun lalu: 01/10/2025–30/11/2025); kolom pembanding tidak berisi angka UAT; kolom utama tidak berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## F. Biaya proyek dan pusat biaya

### F1. Biaya proyek

Tab **Biaya proyek** (rentang A1). Kolom: Proyek, Pendapatan (Rp), Biaya (Rp), Margin (Rp), Margin %, Anggaran (Rp). Bila tidak ada data: "Tidak ada proyek yang punya mutasi buku besar di rentang ini."

**Harus terlihat:** baris Proyek M07: Biaya naik **Rp 500.000** (klaim G3: 6-2400 300.000 + 6-2450 200.000), Margin turun Rp 500.000, Anggaran (Rp) **1.500.000** (versi 2 aktif); Margin % = Margin ÷ Pendapatan (atau "—" bila Pendapatan 0). Klaim yang dibatalkan (G5) dan pertanggungjawaban uang muka (tanpa proyek) tidak ikut.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Laba rugi per pusat biaya

Tab **Pusat biaya**. Kolom: Pusat biaya, Pendapatan (Rp), Biaya (Rp), Hasil (Rp); baris "Tanpa pusat biaya" dan "Total".

**Harus terlihat:** baris CC-UAT Pusat Biaya UAT **persis**: Pendapatan 0, Biaya 750.000, Hasil −750.000 (jurnal I3 transaksi). CC-UAT2 tidak muncul (tanpa posting). Total Pendapatan dan Total Biaya sama dengan Laba Rugi C1; Total Hasil = Laba bersih.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## G. Profitabilitas

### G1. Profitabilitas per proyek dan pelanggan

Tab **Profitabilitas** → pilihan dimensi *(cek pilihan: Lini bisnis / Proyek / Pelanggan / Produk)*. Kolom: nama dimensi, Pendapatan (Rp), Biaya (Rp), Margin (Rp), Margin %.

1. Pilih **Proyek**.
2. Pilih **Pelanggan**.

**Harus terlihat:** 1 baris Proyek M07 Biaya naik Rp 500.000 (sama dengan F1); 2 baris Budi Hartono UAT Pendapatan naik **Rp 10.900.000** (Faktur 1 10.000.000 + Faktur 2 1.000.000 − nota kredit 100.000). Keterangan "Dari dimensi pada baris jurnal: …" tampil di bawah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Total profitabilitas sama dengan laba rugi

Untuk setiap dimensi (**Lini bisnis**, **Proyek**, **Pelanggan**, **Produk**), lihat baris "Tidak teratribusi (overhead, jurnal lama)" dan baris "Total".

**Harus terlihat:** di keempat dimensi, Total Pendapatan, Total Biaya, dan Total Margin sama persis dengan Laba Rugi C1 (Pendapatan, Beban, Laba bersih). Pendapatan bunga 250.000 dan beban tanpa dimensi masuk "Tidak teratribusi". Di **Lini bisnis** dan **Produk**, pendapatan faktur UAT masuk ke kategori/produk jasa dari SO keuangan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## H. Proyeksi kas 13 minggu

### H1. Struktur dan kas awal

Tab **Proyeksi kas** (tidak memakai kotak tanggal). Tulisan "13 minggu ke depan mulai hari ini, berangkat dari kas dan bank Rp …" lalu "Gaji mengikuti penggajian … yang disetujui." atau "Belum ada penggajian yang disetujui, jadi gaji belum diproyeksikan."

**Harus terlihat:** 13 baris minggu (nomor, tanggal mulai – akhir) dengan kolom Minggu, Piutang masuk, Masuk lain, Utang keluar, Gaji, PPh 21 & BPJS, Keluar lain, Saldo akhir. Kas awal = jumlah akun kas di Neraca per hari ini. Untuk setiap minggu: Saldo akhir = Saldo akhir minggu sebelumnya (atau kas awal) + Piutang masuk + Masuk lain − Utang keluar − Gaji − PPh 21 & BPJS − Keluar lain. Minggu dengan saldo terendah berlatar abu-abu; saldo negatif berwarna merah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2. Baris manual (login `finance_seed`)

Bagian **Baris manual**:

| Isian | Isi dengan |
|---|---|
| Tanggal | `08/12/2026` |
| Arah *(cek pilihan)* | Penerimaan / Pembayaran; pilih **Penerimaan** |
| Nilai | `5000000` |
| Keterangan | `Termin proyek UAT (perkiraan)` |

**Uji salah:** Nilai `0` atau Keterangan kosong → tombol Simpan tidak bisa diklik.

**Klik:** Simpan. Lalu tambah baris kedua: `15/12/2026`, **Pembayaran**, `1000000`, `Sewa Desember UAT` → Simpan → hapus baris kedua dengan ikon tempat sampah (Hapus baris).

**Harus terlihat:** baris "08/12/2026 · +5.000.000 · Termin proyek UAT (perkiraan)" di daftar; minggu yang memuat 08/12 kolom **Masuk lain** naik Rp 5.000.000 dan Saldo akhir minggu itu serta minggu berikutnya naik Rp 5.000.000. Baris kedua sempat menambah **Keluar lain** Rp 1.000.000 lalu hilang setelah dihapus. Login `accountant_seed`/`auditor_seed`: baris manual terlihat tetapi form dan tombol hapus tidak tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H3 ❓. Utang dan piutang di proyeksi

Lihat kolom **Utang keluar** dan **Piutang masuk**.

**Harus terlihat:** tagihan manual E1 (Rp 2.220.000, jatuh tempo 07/12/2026) masuk **Utang keluar** di minggu yang memuat 07/12. Tagihan dari PO E2 (Rp 3.996.000, jatuh tempo 20/11, sudah lewat) dan Faktur 1 (sisa Rp 5.100.000, jatuh tempo 20/11, sudah lewat): catat di minggu mana keduanya muncul (harapan: minggu 1), atau apakah tidak muncul sama sekali ❓. Bila ada kontrak lisensi yang jatuh tempo, bagian "Perpanjangan lisensi jatuh tempo" tampil dengan catatan "Kontrak tidak menyimpan nominal: tambahkan perkiraan penerimaan sebagai baris manual."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## I. Rasio

### I1. Rasio dihitung ulang dari neraca dan laba rugi

Tab **Rasio** (rentang A1; neraca diambil per tanggal akhir 30/11/2026). Bagian Likuiditas, Profitabilitas, Solvabilitas, "Efisiensi (hari, dari 61 hari)". Keterangan: "Angka neraca per tanggal akhir, laba rugi selama rentang; ROA dan ROE memakai saldo akhir; HPP = akun 5-xxxx. "—" bila penyebutnya nol."

Hitung ulang dengan angka **sesudah** dari Neraca 30/11 (D1) dan Laba Rugi C1:

| Rasio | Rumus (dari kode) | Hasil hitung sendiri | Di layar |
|---|---|---|---|
| Rasio lancar | jumlah akun 1-1xxx ÷ jumlah akun 2-1xxx | | |
| Rasio cepat | (akun 1-1xxx − 1-1410 Persediaan) ÷ akun 2-1xxx | | |
| Rasio kas | akun kas ÷ akun 2-1xxx | | |
| Margin laba kotor | (Pendapatan − akun 5-xxxx) ÷ Pendapatan | | |
| Margin laba bersih | Laba bersih ÷ Pendapatan | | |
| Imbal hasil aset (ROA) | Laba bersih ÷ Total aset | | |
| Imbal hasil ekuitas (ROE) | Laba bersih ÷ Total ekuitas (termasuk laba berjalan) | | |
| Utang terhadap ekuitas (DER) | Total liabilitas ÷ Total ekuitas | | |
| Rata-rata umur piutang (DSO) | 1-1310 ÷ Pendapatan × 61 | | |
| Rata-rata umur utang (DPO) | 2-1100 ÷ akun 5-xxxx × 61 | | |
| Rata-rata umur persediaan (DIO) | 1-1410 ÷ akun 5-xxxx × 61 | | |

**Harus terlihat:** setiap angka di layar sama dengan hitungan sendiri (pembulatan 2 desimal); "—" hanya bila penyebutnya nol (misalnya DPO dan DIO bila tidak ada HPP di rentang).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## J. Paket manajemen

### J1. Paket November 2026 cocok dengan laporan

Tab **Paket manajemen** → kotak Bulan `2026-11` (November 2026). Judul "Paket manajemen 2026-11".

**Harus terlihat:** tulisan "Draf: periode masih terbuka, angka masih bisa berubah."; 8 kartu: Pendapatan, Beban, Laba bersih (sama persis dengan **Laba Rugi** rentang 01/11–30/11 di C2), Total aset, Total liabilitas, Total ekuitas (sama dengan **Neraca** per 30/11 di D1), Kenaikan (penurunan) kas dan Kas akhir (sama dengan arus kas langsung rentang 01/11–30/11). Kotak Rasio (Rasio lancar, Rasio cepat, Margin laba kotor, Margin laba bersih, DER, DSO) sama dengan tab **Rasio** untuk rentang 01/11–30/11. Tabel "Profitabilitas per lini bisnis" (Lini bisnis, Pendapatan, Biaya, Marjin, baris Tidak teratribusi dan Jumlah): Jumlah = Laba Rugi November.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J2. Anggaran vs realisasi, Excel, dan cetak

Masih paket 2026-11: tabel "Anggaran proyek vs realisasi" (Proyek, Anggaran, Realisasi, Selisih, Anggaran s.d. bulan ini, Realisasi s.d. bulan ini, Jumlah). Lalu klik **Excel** dan **Cetak / PDF**.

**Uji salah:** kosongkan kotak Bulan → tombol Excel tidak bisa diklik.

**Harus terlihat:** baris Proyek M07: Anggaran 1.500.000, Realisasi 500.000, Selisih 1.000.000, Anggaran s.d. bulan ini 1.500.000, Realisasi s.d. bulan ini 500.000 (bila F1 transaksi gagal: "Tidak ada anggaran proyek aktif dengan angka untuk tahun ini."). Keterangan "Selisih = anggaran - realisasi (negatif berarti melebihi anggaran)…". Excel terunduh `management-pack-2026-11.xlsx` dengan angka yang sama. Cetak membuka dialog cetak tanpa kotak bulan dan tombol.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J3 ⚠️. Paket Oktober 2026 saat periode terkunci

Kerjakan **di antara langkah K4 dan K7 file transaksi** (Oktober masih Terkunci). Kotak Bulan `2026-10`.

**Harus terlihat:** tulisan "Periode Terkunci: diarsipkan bersama arsip akhir bulan." ⚠️ Dugaan: status tampil mentah dalam bahasa Inggris, "Periode locked: …". Laba bersih paket Oktober = Laba Rugi Oktober (C2), sudah termasuk penyesuaian −50.000. Setelah K7 (Oktober dibuka lagi), paket Oktober kembali bertuliskan "Draf: …".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## K. Arsip bulanan dan laba periode tertutup

### K1. Arsip Oktober tidak berubah

Menu **Laporan → Laporan → Arsip Bulanan** (judul "Arsip Laporan Bulanan", keterangan "Laporan yang dibekukan saat bulan ditutup. Angka di sini tidak berubah setelah ada posting berikutnya."). Buka arsip 2026-10 yang dibuat di K6 file transaksi.

**Harus terlihat:** Laba bersih = Laba bersih Laba Rugi 01/10–31/10 saat diarsipkan (termasuk −50.000); Total aset = Aset Neraca 31/10; Perubahan bersih kas = arus kas Oktober. Setelah reversal K5 (01/11) dan pembukaan kembali K7, angka arsip **tetap sama**. Login `finance_seed` dan `auditor_seed` bisa melihat arsip tetapi tidak melihat tombol **Arsipkan bulan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K2 ❓. Laba periode tertutup

Rencana (ADR-0030, ERP-0153) menyediakan "laba periode tertutup" untuk bagi hasil investor (M11): laba final hanya untuk periode **Terkunci**; periode Terbuka/Ditutup ditolak "Periode belum dikunci; laba hanya final untuk periode yang terkunci". Cari di menu Keuangan, Laporan, dan **Keuangan → Bonus & Investor → Bagi Hasil** tempat angka ini tampil.

**Harus terlihat (saat ini):** tidak ada layar maupun alamat server yang memakainya; fungsi hanya ada di dalam backend. Centang Sesuai bila memang tidak ada dan tulis "tidak ada layar"; bila ada layar, catat angkanya untuk Oktober (saat Terkunci) dan November (harus ditolak). Lihat juga [m11-bonus-investor.md](m11-bonus-investor.md).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## L. Hak akses laporan

### L1. Keuangan (login `finance_seed`)

Buka **Laporan Keuangan**, jalankan rentang A1, buka semua 12 tab: Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Paket manajemen, Proyeksi kas, Arus kas & ekuitas, Rasio, Profitabilitas, Biaya proyek, Pusat biaya.

**Harus terlihat:** semua tab tampil dengan angka yang sama seperti dilihat Akuntan; tombol Ekspor CSV dan Excel tampil; form baris manual Proyeksi kas tampil. ⚠️ Pilihan **Pilih akun** di Buku Besar mungkin kosong karena Keuangan tidak bisa membaca Daftar Akun; catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### L2. Akuntan (login `accountant_seed`)

Sama seperti L1.

**Harus terlihat:** semua tab dan tombol ekspor tampil; form baris manual Proyeksi kas **tidak** tampil (butuh hak kas/bank); bisa mengarsipkan bulan di **Arsip Bulanan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### L3. Auditor (login `auditor_seed`)

Sama seperti L1, lalu **Laporan → Laporan → Arsip Bulanan**.

**Harus terlihat:** semua tab tampil dengan angka sama; tombol Ekspor CSV dan Excel tampil (auditor boleh ekspor); form baris manual dan tombol Arsipkan bulan tidak tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### L4. Role tanpa akses (login `sales_seed`)

Sidebar: menu **Laporan Keuangan** dan **Arsip Bulanan** tidak tampil. Buka langsung `/finance/reports` dan `/reports/monthly-archives`.

**Harus terlihat:** halaman kosong bertuliskan judul saja ("Laporan Keuangan"), tanpa angka; tidak ada pesan galat teknis.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 34 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M09 laporan:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

Disusun dari kode pada 2026-11-26; angka harapan dihitung dari jurnal J1–J24 file transaksi dengan akun bawaan seeder. Semua ⚠️ adalah dugaan dari pembacaan kode.

- **Ekspor CSV kemungkinan gagal diam-diam:** `apps/web-admin/src/components/finance/reports-page.tsx:100`, `:109`, `:118` memanggil `/reports/profit-and-loss.csv`, `/reports/balance-sheet.csv`, `/reports/cash-flow.csv` tanpa awalan `/finance` (rute server di `/finance/reports/*.csv`, `docs/role-permission.md:899-911`); galatnya tidak ditangkap (`void onClick()` di `ExportButton`), dan ketiga tombol berlabel sama. Bandingkan `management-pack-report.tsx` yang memakai `/finance/reports/management-pack.xlsx` dan menampilkan galat.
- **Status periode mentah di paket manajemen:** `management-pack-report.tsx:81` mengisi `{{status}}` dengan nilai `locked`/`closed` apa adanya, bukan label "Terkunci"/"Ditutup".
- **Arus kas tidak langsung memuat transaksi nonkas:** `apps/backend/src/app/finance/services/statement.service.ts:98-121` mengelompokkan setiap mutasi akun neraca nonkas menurut kategori arus kas akunnya, sehingga kapitalisasi aset dengan lawan modal muncul di Investasi dan Pendanaan, sedangkan metode langsung (`:76-95`) tidak. Akun kontra-aset apa pun (termasuk cadangan kerugian piutang) masuk ke baris berlabel "Pos non-kas (penyusutan)".
- **Laba periode tertutup tanpa layar dan tanpa rute:** `apps/backend/src/app/finance/services/exported-profit.service.ts:59` hanya didaftarkan di container; galat `accounting.profitPeriodNotLocked` (`packages/locales/src/id/api.ts:623`) belum bisa muncul.
- **Penghapusan piutang tanpa beban:** `apps/backend/src/app/finance/services/receivable-adjustment.service.ts:220` mendebit cadangan kerugian piutang; tanpa cadangan yang dibentuk lebih dulu, laba rugi tidak memuat kerugian piutang dan neraca menampilkan 1-1390 bersaldo debit (lihat C1, D1).
- **Kotak tanggal laporan tanpa label:** `reports-page.tsx:75-89` (tiga `DatePicker` tanpa label mulai/akhir/tanggal per).
- **Keuangan tanpa hak Daftar Akun:** pilihan akun Buku Besar memakai daftar akun yang butuh `chart_of_account:read` (`docs/role-permission.md:847`), yang tidak dimiliki Keuangan (`packages/common/src/authorization/erp-permissions.ts:746-784`).
- **Rasio:** rumus diambil dari `apps/backend/src/app/finance/services/ratio.service.ts:47-118` (aset lancar = kode `1-1…`, liabilitas jangka pendek = `2-1…`, HPP = `5-…`, ekuitas ditambah laba yang belum ditutup).
- **Proyeksi kas:** perlakuan utang/piutang yang sudah lewat jatuh tempo belum dipastikan dari kode (H3); minggu dihitung dari hari uji, jadi baris minggu bergeser bila UAT dikerjakan di hari lain.
- Rencana M09 (`docs/plan/erp-module-plans/m09-finance.md`, bagian Controls) meminta laporan bisa ditelusuri sampai baris jurnal dan kas akhir arus kas = kas neraca. Yang kedua diuji di E4; yang pertama hanya lewat Buku Besar per akun (B3–B4), karena halaman Jurnal tidak punya detail baris.
