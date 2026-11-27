# UAT M01 - Dasbor (T14)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** buka dasbor → ringkasan keuangan (arus kas, kas & bank, laba) → operasional (grafik penjualan, penjualan, inventaris, proyek, langganan) → aktivitas dan tautan cepat → pembaruan otomatis → kartu yang tampil per role → role gabungan.

Disusun 2026-11-26 dari kode halaman `/` (`DashboardPage`) dan teks bahasa Indonesia di `packages/locales/src/id/dashboard.ts`. Dasbor **hanya membaca**: tidak ada form simpan. Yang diuji adalah setiap kartu, setiap pilihan rentang grafik, setiap tautan, dan kartu mana yang tampil untuk tiap role. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: pilihan yang diklik (rentang grafik, tanggal). Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol atau tautan yang ditekan.
- **Harus terlihat**: hasil yang benar, termasuk angka pembanding dari halaman sumber.
- **Uji salah**: isian yang sengaja salah atau akses yang seharusnya ditolak; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Aturan kartu dasbor (dari kode):** satu dasbor untuk semua orang. Setiap kartu tampil hanya bila role pengguna punya hak baca di modul sumbernya; bagian tanpa kartu disembunyikan. Server tetap memeriksa hak setiap angka.

| Kartu | Tampil bila punya hak | Role yang dapat (bawaan) |
|---|---|---|
| Ringkasan keuangan: Pemasukan, Pengeluaran, Arus kas bersih, grafik Pemasukan vs pengeluaran, Kas & Bank | Kas & Bank (baca) | Pemilik, Keuangan, Akuntan, Auditor |
| Laba | Laporan keuangan (baca) | Pemilik, Keuangan, Akuntan, Auditor |
| Grafik Penjualan difakturkan, Penjualan, Aktivitas terbaru | Faktur (baca) | Pemilik, Keuangan, Akuntan, Auditor |
| Inventaris (angka Barang) | Barang (baca) | Pemilik, Admin, Manajer Penjualan, Penjualan, Pembelian, Gudang, Keuangan, Pemasaran, Auditor |
| Inventaris (angka Nilai stok) | Harga pokok barang | Pemilik, Pembelian, Keuangan (lainnya melihat "—") |
| Proyek | Proyek (baca) | Pemilik, Manajer Operasional, Manajer Proyek, Teknisi, Keuangan, Layanan Pelanggan, Auditor |
| Langganan | Lisensi (baca) | Pemilik, Admin, Manajer Penjualan, Penjualan, Keuangan, Layanan Pelanggan, Auditor |

**Data contoh yang dipakai selama UAT:**

| Data | Nilai |
|---|---|
| Organisasi aktif | Entragate (pemilih organisasi di sidebar) |
| Bulan uji | bulan berjalan; tulis di sini: ________ |
| Akun Pemilik | `admin` (password di `apps/backend/.env`, `INITIAL_ADMIN_PASSWORD`) |
| Akun per role | `<role>_seed` / `<role>123456`, mis. `accountant_seed` / `accountant123456` |
| Akun untuk uji role gabungan | `sales_seed` (role Penjualan), ditambah sementara role Keuangan di langkah E1 |
| Transaksi untuk uji pembaruan | satu faktur baru atau satu transaksi kas/bank yang sudah diposting (boleh memakai data dari UAT M02 atau modul Keuangan) |

Sebelum mulai, catat angka pembanding dari halaman sumber (diisi penguji):

| Angka pembanding | Halaman sumber | Nilai |
|---|---|---|
| Total faktur bulan ini dan bulan lalu | CRM & Penjualan → Penjualan → Faktur | |
| Saldo tiap akun kas/bank | Keuangan → Keuangan → Kas & Bank | |
| Laba bersih tanggal 1 s.d. hari ini | Keuangan → Keuangan → Laporan Keuangan, tab Laba Rugi | |
| Jumlah produk | Inventaris → Produk | |
| Total nilai persediaan | Inventaris → Nilai Persediaan | |
| Proyek aktif, selesai, lewat target | Proyek → Proyek | |
| Kontrak berakhir ≤ 30 hari dan sudah berakhir | Proyek → Langganan & Lisensi → Kontrak lisensi | |

Bahasa layar harus **Bahasa Indonesia** (menu akun di kiri bawah → pilihan bahasa).

***

## A. Ringkasan keuangan (login `admin`)

### A1. Buka dasbor sebagai Pemilik

Menu **Dasbor → Dasbor** (halaman pertama setelah masuk).

**Klik:** tidak ada; tunggu halaman termuat.\
**Harus terlihat:** tiga bagian berurutan: **Ringkasan keuangan** (keterangan "Basis kas: mutasi kas dan bank yang sudah diposting, tanpa saldo awal."), **Operasional** (keterangan "Penjualan, stok, proyek, dan langganan."), dan **Aktivitas**. Semua kartu di tabel aturan di atas tampil. Tidak ada tombol "Muat ulang" (pembaruan berjalan sendiri tiap menit).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Angka Pemasukan, Pengeluaran, dan Arus kas bersih

Menu **Dasbor → Dasbor**, bagian **Ringkasan keuangan**, tiga kartu angka teratas.

**Klik:** tidak ada.\
**Harus terlihat:** keterangan "Bulan berjalan: <tanggal 1> s.d. <hari ini>". Tiga kartu: **Pemasukan**, **Pengeluaran**, **Arus kas bersih** (= Pemasukan − Pengeluaran). Di bawah tiap angka ada "Bulan lalu: Rp …" dan "…% dibanding hari yang sama bulan lalu", atau "Belum ada angka untuk hari yang sama bulan lalu" bila bulan lalu kosong. Angka cocok dengan mutasi kas/bank yang **sudah diposting** di halaman Kas & Bank bulan ini (saldo awal tidak dihitung).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Grafik Pemasukan vs pengeluaran, semua rentang

Menu **Dasbor → Dasbor**, kartu **Pemasukan vs pengeluaran**.

| Isian | Isi dengan |
|---|---|
| Rentang *(cek pilihan)* | 14 hari / 1 bulan / 3 bulan / 6 bulan / 1 tahun / 5 tahun / Kustom; klik satu per satu |
| Kustom: rentang tanggal | tanggal 1 bulan lalu s.d. hari ini |

**Uji salah:**

- Pilih **Kustom**, klik hanya satu tanggal lalu tutup kalender → keterangan tetap "Pilih rentang tanggal"; grafik tidak memakai rentang setengah jadi.

**Klik:** tiap pilihan rentang.\
**Harus terlihat:** keterangan berubah menjadi "<dari> s.d. <sampai> · bersih Rp …". Rentang sampai 31 hari tampil per hari, di atasnya per bulan. Memilih **Kustom** langsung membuka kalender dua bulan (tidak perlu klik kotak isian dulu). Garis **Pemasukan** dan **Pengeluaran** muncul; arahkan kursor ke titik → nilai Rupiah tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Kartu Kas & Bank

Menu **Dasbor → Dasbor**, kartu **Kas & Bank** (keterangan "Saldo per akun").

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** satu baris per akun kas/bank dengan saldonya, lalu baris **Total** = jumlah semua saldo. Angka sama dengan tabel pembanding. Bila belum ada akun: "Belum ada akun kas atau bank." Tautan **Lihat semua** membuka **Kas & Bank**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5. Kartu Laba

Menu **Dasbor → Dasbor**, kartu **Laba**.

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** **Sejak awal bulan** (laba bersih) dengan label "Provisional — periode belum ditutup", **Pendapatan**, dan **Beban**. Laba bersih sama dengan Laporan Keuangan tab Laba Rugi untuk tanggal 1 s.d. hari ini. **Lihat semua** membuka **Laporan Keuangan**.\
⚠️ Label "Provisional" selalu tampil, juga untuk bulan yang periodenya sudah ditutup. Catat bila bulan uji sudah ditutup tetapi label masih ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## B. Operasional (login `admin`)

### B1. Grafik Penjualan difakturkan, semua rentang

Menu **Dasbor → Dasbor**, bagian **Operasional**, kartu **Penjualan difakturkan** (lebar penuh).

| Isian | Isi dengan |
|---|---|
| Rentang *(cek pilihan)* | 14 hari / 1 bulan / 3 bulan / 6 bulan / 1 tahun / 5 tahun / Kustom; klik satu per satu |
| Kustom: rentang tanggal | tanggal 1 bulan ini s.d. hari ini |

**Uji salah:**

- **Kustom** dengan satu tanggal saja → keterangan "Pilih rentang tanggal"; tidak ada angka total palsu.

**Klik:** tiap pilihan rentang.\
**Harus terlihat:** keterangan "<dari> sampai <sampai> · total Rp …". Untuk Kustom tanggal 1 s.d. hari ini, total sama dengan total faktur bulan ini di tabel pembanding. Arahkan kursor ke titik → nilai **Difakturkan** dalam Rupiah. Rentang satu titik saja tetap menampilkan titiknya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Kartu Penjualan

Menu **Dasbor → Dasbor**, kartu **Penjualan**.

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** **Difakturkan bulan ini** dengan label "…% dibanding bulan lalu" (hijau bila naik, merah bila turun), **Bulan sebelumnya**, dan **Faktur bulan ini** (jumlah faktur). Angka cocok dengan daftar Faktur. **Lihat semua** membuka **Faktur**. SPH terbuka tidak ditampilkan (sengaja, lihat Catatan penyusun).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Kartu Inventaris

Menu **Dasbor → Dasbor**, kartu **Inventaris**.

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** **Barang** = jumlah total di daftar Produk; **Nilai stok** = total di halaman Nilai Persediaan (untuk Pemilik angka tampil, bukan "—"). **Lihat semua** membuka **Stok**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Kartu Proyek

Menu **Dasbor → Dasbor**, kartu **Proyek** (keterangan "Proyek aktif per tahap").

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** **Aktif**, **Selesai**, **Lewat tanggal target** (label merah "Terlambat" bila lebih dari 0), lalu batang per tahap berurutan: Persiapan, Pengiriman, Instalasi, Uji fungsi, Training, Serah terima (BAST), Garansi. Jumlah cocok dengan daftar Proyek. **Lihat semua** membuka **Proyek**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Kartu Langganan

Menu **Dasbor → Dasbor**, kartu **Langganan**.

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** **Berakhir dalam 30 hari** dan **Sudah berakhir**, sama dengan daftar Kontrak lisensi. **Lihat semua** membuka **Langganan & Lisensi** (daftar kontrak).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## C. Aktivitas, tautan, dan pembaruan (login `admin`)

### C1. Aktivitas terbaru

Menu **Dasbor → Dasbor**, bagian **Aktivitas**, kartu **Aktivitas terbaru**.

**Klik:** tautan **Lihat semua** di kartu.\
**Harus terlihat:** paling banyak 5 baris, terbaru di atas, campuran "Faktur <kode> diterbitkan" dan "Kuitansi <kode> dicatat", masing-masing dengan nilai Rupiah dan tanggal. Bila kosong: "Belum ada faktur atau kuitansi." **Lihat semua** membuka **Faktur**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Tautan cepat

Menu **Dasbor → Dasbor**, kartu **Tautan cepat**.

**Klik:** setiap tautan satu per satu, lalu kembali ke Dasbor.\
**Harus terlihat:** enam tautan untuk Pemilik: **Faktur**, **Kas & Bank**, **Stok**, **Proyek**, **Langganan & Lisensi**, **Laporan Keuangan**. Setiap tautan membuka halaman yang namanya sama. **Laporan Keuangan** membuka halaman laporan yang sama dengan Keuangan → Laporan Keuangan (alamat `/reports`).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Pembaruan otomatis tiap menit

Buka **Dasbor → Dasbor** di satu tab. Di tab lain, buat transaksi uji (lihat Data contoh), misalnya satu faktur baru bulan ini.

**Klik:** tidak ada di tab dasbor; tunggu minimal 1 menit.\
**Harus terlihat:** angka yang terkait (Penjualan, grafik, Aktivitas terbaru, atau Pemasukan) berubah sendiri tanpa memuat ulang halaman dan tanpa kerangka loading. Tekan F5 → angka yang sama tetap tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Ganti organisasi

Lewati bila hanya ada satu organisasi; tulis "dilewati" di tabel. Klik pemilih organisasi di sidebar → pilih organisasi lain.

**Klik:** nama organisasi lain.\
**Harus terlihat:** pesan "Organisasi diganti"; semua angka dasbor berganti ke data organisasi itu (tidak tersisa angka organisasi sebelumnya). Bila gagal: "Tidak dapat mengganti organisasi". Kembalikan ke Entragate.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Akses halaman lain lewat alamat (login `sales_seed`)

Masuk sebagai `sales_seed`. Ketik alamat `/finance/cash-bank` di bilah alamat browser.

**Uji salah:**

- Alamat `/finance/reports` → sama, ditolak.

**Klik:** Enter.\
**Harus terlihat:** kembali ke Dasbor dengan pesan "Anda tidak memiliki akses ke halaman tersebut."; tidak ada angka kas yang sempat tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## D. Kartu yang tampil per role

Masuk dengan akun di tiap langkah (keluar dulu dari akun sebelumnya: menu akun di kiri bawah → **Keluar**), buka **Dasbor → Dasbor**, lalu cocokkan kartu yang tampil. "Tidak tampil" berarti kartunya tidak ada sama sekali, bukan kartu berisi nol.

### D1. Akuntan (`accountant_seed`, seperti Bella)

**Harus terlihat:** **Ringkasan keuangan** lengkap (Pemasukan, Pengeluaran, Arus kas bersih, grafik Pemasukan vs pengeluaran, Kas & Bank, Laba); **Operasional** hanya grafik **Penjualan difakturkan** dan kartu **Penjualan**; **Aktivitas terbaru**; **Tautan cepat**: Faktur, Kas & Bank, Laporan Keuangan. **Tidak tampil:** Inventaris, Proyek, Langganan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Keuangan (`finance_seed`)

**Harus terlihat:** semua kartu seperti Pemilik, termasuk angka **Nilai stok** (bukan "—"). Tautan cepat enam buah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Manajer Penjualan (`sales_manager_seed`, seperti Agus MD)

**Harus terlihat:** hanya bagian **Operasional** dengan kartu **Inventaris** (Nilai stok "—") dan **Langganan**; **Tautan cepat**: Stok, Langganan & Lisensi. **Tidak tampil:** Ringkasan keuangan, grafik penjualan, Penjualan, Proyek, Aktivitas terbaru.\
⚠️ Klik **Lihat semua** di kartu Inventaris dan tautan cepat **Stok** → kemungkinan kembali ke Dasbor dengan "Anda tidak memiliki akses ke halaman tersebut." karena role ini tidak punya hak baca Stok. Catat yang terjadi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Penjualan (`sales_seed`)

**Harus terlihat:** sama dengan D3 (Inventaris dengan Nilai stok "—", Langganan, tautan Stok dan Langganan & Lisensi). ⚠️ Tautan Stok sama seperti D3.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. Admin organisasi (`admin_seed`)

**Harus terlihat:** **Inventaris** (Nilai stok "—") dan **Langganan**; tautan cepat Stok dan Langganan & Lisensi; tautan Stok terbuka normal. **Tidak tampil:** kartu keuangan, penjualan, proyek.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6. Pembelian (`purchasing_seed`)

**Harus terlihat:** hanya **Inventaris**, dengan angka **Nilai stok** tampil (role ini boleh melihat harga pokok); tautan cepat Stok.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7. Gudang (`warehouse_seed`)

**Harus terlihat:** hanya **Inventaris** (Nilai stok "—"); tautan cepat Stok terbuka normal.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D8. Proyek dan lapangan (`operations_manager_seed`, `project_manager_seed`, `technician_seed`; seperti Jamil, Hatta, Fahri, Alex, Ade)

Ulangi untuk ketiga akun.\
**Harus terlihat:** hanya kartu **Proyek** dan tautan cepat **Proyek**, untuk ketiga akun. **Tidak tampil:** kartu lain.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D9. Layanan Pelanggan (`customer_service_seed`)

**Harus terlihat:** **Proyek** dan **Langganan**; tautan cepat Proyek dan Langganan & Lisensi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D10. Pemasaran (`marketing_seed`)

**Harus terlihat:** hanya **Inventaris** (Nilai stok "—"); tautan cepat Stok.\
⚠️ Sama seperti D3: role ini tidak punya hak baca Stok, sehingga tautan Stok dan **Lihat semua** kemungkinan ditolak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D11. Auditor (`auditor_seed`)

**Harus terlihat:** semua kartu seperti Pemilik, tetapi **Nilai stok** berisi "—". Tautan cepat enam buah dan semuanya terbuka (hanya baca).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D12. Role tanpa angka dasbor (`member_seed`, `freelancer_seed`, `hr_seed`; seperti Oki dan Dafrin)

Ulangi untuk ketiga akun.\
**Harus terlihat:** judul "Tidak ada yang bisa ditampilkan untuk peran Anda" dan keterangan "Peran Anda di organisasi ini tidak mencakup angka dasbor apa pun. Gunakan menu untuk membuka halaman yang bisa Anda akses."; tidak ada kartu berisi nol.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D13. Ringkasan tim nyata (tanpa login baru)

Cocokkan hasil D1-D12 dengan susunan role tim (`docs/adjustment/validasi-konsep-saat-ini.md` Bagian 3.1). Hasil yang diharapkan:

| Orang | Role | Kartu dasbor |
|---|---|---|
| Aqim | Pemilik (+ role lain) | semua kartu |
| Agus MD | Manajer Penjualan | Inventaris (Nilai stok "—"), Langganan |
| Bilal | Manajer Penjualan, Penjualan, Gudang, Layanan Pelanggan, Pemasaran, Anggota | Inventaris (Nilai stok "—"), Proyek, Langganan |
| Agus | Manajer Proyek, Teknisi, Gudang, Anggota | Inventaris (Nilai stok "—"), Proyek |
| Jamil, Hatta, Fahri, Alex, Ade | Manajer Proyek / Teknisi / Pekerja Lepas | Proyek |
| Bella | Akuntan | seperti D1 |
| Oki, Dafrin | Pekerja Lepas, Anggota | "Tidak ada yang bisa ditampilkan untuk peran Anda" |

**Harus terlihat:** penguji (atau Pemilik) setuju susunan kartu ini memang yang diinginkan; bila tidak, tulis kartu yang harus ditambah/dikurangi per orang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## E. Role gabungan (satu orang, beberapa role)

### E1. Tambah role Keuangan ke akun Penjualan

Login `admin`. Menu **Administrasi → Organisasi** → klik **Entragate** → tab **Anggota (n)** → kartu `sales_seed` → **Ubah**.

| Isian | Isi dengan |
|---|---|
| Peran *(cek pilihan, kotak centang)* | Pemilik, Admin, Anggota, Manajer Operasional, Manajer Penjualan, Penjualan, Manajer Proyek, Teknisi, Pekerja Lepas, Pembelian, Gudang, Keuangan, Akuntan, Sumber Daya Manusia, Layanan Pelanggan, Pemasaran, Auditor; yang tercentang: **Penjualan** dan **Keuangan** |

**Klik:** Simpan. Lalu keluar, masuk sebagai `sales_seed`, buka **Dasbor → Dasbor**.\
**Harus terlihat:** pesan "Peran anggota diperbarui". Dasbor `sales_seed` sekarang berisi **gabungan** hak kedua role: semua kartu Ringkasan keuangan, grafik Penjualan difakturkan, Penjualan, Inventaris dengan **Nilai stok** tampil, Proyek, Langganan, Aktivitas terbaru, dan enam tautan cepat. Tautan **Stok** sekarang terbuka (hak baca Stok datang dari Keuangan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Kembalikan role Penjualan saja

Login `admin`, ulangi jalur E1, hilangkan centang **Keuangan**.

**Klik:** Simpan. Keluar, masuk sebagai `sales_seed`, buka Dasbor (tekan F5 bila perlu).\
**Harus terlihat:** "Peran anggota diperbarui"; dasbor kembali seperti D4 (Inventaris dengan "—" dan Langganan saja). Tidak ada kartu keuangan yang tersisa dari sesi sebelumnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 30 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M01:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

**Beda rencana dan kode**

- `docs/plan/kontrak/modul/m01-dashboard.md` menyebut tombol Refresh di header dasbor; kode sengaja tanpa tombol, pembaruan diam-diam tiap 60 detik (`apps/web-admin/src/lib/dashboard-api.ts:41-50`).
- Rencana menyebut kartu Penjualan berisi jumlah dan nilai SPH terbuka; kode tidak menampilkannya (dicatat di rencana sebagai keputusan, halaman SPH pemilik daftarnya).
- Rencana menulis endpoint lama (`/invoices/summary`, `/cash-bank/accounts`, `/reports/profit-and-loss`, `/licenses/summary`); kode memakai `/sales/invoices/summary`, `/finance/cash-bank-accounts`, `/finance/reports/profit-and-loss`, `/projects/stats`, `/stock/valuation` (`apps/web-admin/src/lib/dashboard-api.ts:310-420`).
- Rencana: label "provisional" hanya untuk periode yang belum ditutup. Kode selalu menampilkan "Provisional — periode belum ditutup" (`apps/web-admin/src/components/dashboard/dashboard-page.tsx:346`).
- Tahap 2 (gateway, penggajian, langganan terverifikasi) belum ada di dasbor; sesuai status rencana "in progress".
- Kartu baru yang tidak ada di rencana: tiga kartu arus kas dan grafik Pemasukan vs pengeluaran (`apps/web-admin/src/components/dashboard/cash-flow-summary.tsx`).

**Temuan baru**

- ⚠️ Kartu Inventaris tampil dengan hak `product.read`, tetapi tautan **Lihat semua** dan tautan cepat **Stok** menuju `/inventory/stock` yang butuh `stock.read`. Manajer Penjualan, Penjualan, dan Pemasaran punya yang pertama tanpa yang kedua, jadi tautannya ditolak (`apps/web-admin/src/components/dashboard/dashboard-page.tsx:374`, `:673`; `apps/web-admin/src/components/sidebar/nav-config.ts`, item Stok).
- ❓ Hak `dashboard:read` diberikan ke banyak role tetapi tidak dipakai di mana pun: dasbor terbuka untuk siapa saja yang punya role internal, termasuk Teknisi, Gudang, dan Pekerja Lepas yang tidak punya `dashboard:read` (`packages/common/src/authorization/erp-permissions.ts:531` dst.; `apps/web-admin/src/routes/_authed.index.tsx`).
- Kartu Aktivitas terbaru memanggil daftar kuitansi dengan syarat `invoice.read` saja; tidak masalah untuk role bawaan (semua yang punya `invoice.read` juga punya `receipt.read`), tetapi akan gagal bila kelak ada role dengan faktur tanpa kuitansi (`apps/web-admin/src/components/dashboard/dashboard-page.tsx:584-586`).
- Penolakan izin di browser belum pernah diverifikasi (rencana: "Not verified"); bagian D adalah verifikasi pertamanya.
