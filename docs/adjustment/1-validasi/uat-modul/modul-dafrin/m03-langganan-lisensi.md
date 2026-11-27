# UAT M03 - Langganan & Lisensi (T09)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Prasyarat:** ada pelanggan aktif (M02 A6). Untuk uji perpanjangan otomatis (D5) dibutuhkan sales order yang bisa dilunasi (M02 C–D).

**Alur yang diuji:** aplikasi → kunci API → kontrak → kunci lisensi → aktivasi lewat API → tangguhkan/aktifkan → perpanjang → hentikan.

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, dan isian API. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki 2026-11-24 (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Status:**

| Data | Status |
|---|---|
| Kontrak lisensi | Draf → Aktif ⇄ Ditangguhkan → Dihentikan. Kontrak lama jadi Diperpanjang saat draf perpanjangannya aktif |
| Kunci lisensi | Aktif → Dicabut |
| Kunci API | Aktif → Dicabut |
| Aplikasi | aktif ⇄ Dipensiunkan |

"Kedaluwarsa" bukan status kontrak: setelah tanggal berakhir ada **7 hari masa tenggang** (hasil API "Masa tenggang"), lalu API menolak kunci.

**Data contoh yang dibuat selama UAT:**

| Data | Nilai |
|---|---|
| Pelanggan | Budi Hartono UAT / PT Maju Jaya UAT (dari M02 A6); di pilihan tampil `CUS-… — Budi Hartono UAT` |
| Aplikasi sendiri | Kode `GYM`, Nama `Gym Access UAT` |
| Aplikasi pihak ketiga | Kode `ZKT-BIO`, Nama `ZKTeco BioTime UAT`, Vendor `ZKTeco` |
| Kunci API | `Server UAT GYM` (dipakai), `Kunci cadangan UAT` (dicabut di A6) |
| Kontrak GYM | Paket 1 gerbang, Tahunan, mulai hari ini, berakhir hari ini + 1 tahun − 1 hari, Rp 1.500.000 |
| Kontrak ZKT | Paket 50 karyawan, Bulanan, Rp 250.000 |
| Kunci vendor ZKT | `ZK-UAT-0001-ABCD` |
| Contoh tanggal | bila UAT dijalankan 25 November 2026: kontrak GYM berakhir 24 November 2027 |
| Perangkat (instanceId) | `PC-UAT-01`, `PC-UAT-02`, `PC-UAT-03` |

**Contoh perintah API** (dipakai di A6, C, dan D). Ganti `<KUNCI_API>` dan `<KUNCI_LISENSI>`; jangan tempel nilai aslinya di laporan. Di PowerShell pakai `curl.exe`.

```bash
curl -s -X POST http://localhost:3001/projects/api/v1/licenses/activate \
  -H "Authorization: Bearer <KUNCI_API>" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: id" \
  -d '{"licenseKey":"<KUNCI_LISENSI>","instanceId":"PC-UAT-01","deviceName":"PC Resepsionis 1"}'
```

Untuk `validate` kirim `{"licenseKey":"<KUNCI_LISENSI>"}` (boleh ditambah `"instanceId"`); untuk `deactivate` kirim `{"licenseKey":"<KUNCI_LISENSI>","instanceId":"…"}`.

---

## A. Aplikasi dan kunci API (login `sales_manager_seed`)

### A1. Buat aplikasi sendiri (semua kolom)

Menu **Proyek → Langganan & Lisensi → Aplikasi** → tombol **Aplikasi baru**. Dialog berjudul "Aplikasi baru".

| Isian | Isi dengan |
|---|---|
| Kode | `GYM` (petunjuk "Huruf, angka, titik, strip, dan garis bawah.") |
| Nama | `Gym Access UAT` |
| Vendor (opsional) | `Internal IMS` |
| Sumber kunci *(cek pilihan)* | Pihak ketiga (kunci dari vendor) / Aplikasi sendiri (kunci dibuat sistem); bawaan Pihak ketiga; pilih **Aplikasi sendiri (kunci dibuat sistem)** |
| Deskripsi (opsional) | `Aplikasi akses gym milik sendiri` |

**Uji salah** (sebelum menyimpan):
- Kosongkan Kode atau Nama → tombol **Simpan** tidak bisa diklik.
- Kode `GYM APP` (ada spasi) → browser menolak saat Simpan (format tidak sesuai). Kembalikan ke `GYM`.
- Ketik Kode lebih dari 32 karakter → huruf ke-33 dan seterusnya tidak masuk.
- Klik **Batal** → dialog tertutup, tidak ada aplikasi baru. Buka lagi **Aplikasi baru** dan isi seperti tabel.

**Klik:** Simpan.
**Harus terlihat:** pesan "Aplikasi disimpan"; baris GYM muncul dengan Nama Gym Access UAT (deskripsi tampil kecil di bawahnya), Vendor Internal IMS, Sumber kunci "Aplikasi sendiri (kunci dibuat sistem)".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Buat aplikasi pihak ketiga (dan kode ganda ditolak)

Tombol **Aplikasi baru** lagi.

**Uji salah:** Kode `gym` (huruf kecil), Nama `Duplikat` → **Simpan** → ditolak "Kode ini sudah dipakai aplikasi lain" (kode disimpan huruf besar, jadi `gym` = `GYM`).

Ganti isian:

| Isian | Isi dengan |
|---|---|
| Kode | `zkt-bio` (sengaja huruf kecil) |
| Nama | `ZKTeco BioTime UAT` |
| Vendor (opsional) | `ZKTeco` |
| Sumber kunci *(cek pilihan)* | Pihak ketiga (kunci dari vendor) (bawaan) |
| Deskripsi (opsional) | `Software absensi, kunci dari vendor` |

**Klik:** Simpan.
**Harus terlihat:** "Aplikasi disimpan"; baris dengan Kode **ZKT-BIO** (huruf besar), Vendor ZKTeco, Sumber kunci "Pihak ketiga (kunci dari vendor)".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Buat kunci API untuk GYM

Menu **Proyek → Langganan & Lisensi → Kunci API**. Hanya aplikasi sendiri yang tampil (kartu "GYM - Gym Access UAT"; ZKT-BIO tidak ada). Di kartu GYM klik **Kunci API baru**.

| Isian | Isi dengan |
|---|---|
| Nama | `Server UAT GYM` (petunjuk: 'Tempat pemakaiannya, misalnya "Server produksi pilot".') |

**Uji salah:**
- Nama kosong → tombol **Buat kunci** tidak bisa diklik.
- Ketik Nama lebih dari 100 karakter → karakter ke-101 tidak masuk.
- Klik **Batal** → dialog tertutup, tabel tetap "Belum ada kunci API.". Buka lagi **Kunci API baru**.

**Klik:** Buat kunci.
**Harus terlihat:**
- Tulisan "Salin kunci ini ke konfigurasi aplikasi sekarang. Kunci tidak akan ditampilkan lagi." dan kunci yang diawali `elk_`.
- Klik **Salin** → pesan "Disalin". Simpan kunci ini untuk bagian C.
- Klik **Sudah saya salin** → tabel berisi kolom Nama, Diawali, Dibuat, Diterbitkan oleh, Terakhir dipakai, Status: Server UAT GYM, awal kunci + "…", tanggal-jam sekarang, nama akun `sales_manager_seed`, "—", **Aktif**. Kunci lengkap tidak bisa dilihat lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Pensiunkan lalu pulihkan aplikasi kedua

Menu **Proyek → Langganan & Lisensi → Aplikasi** → baris ZKT-BIO → tombol **Tindakan** → **Pensiunkan**.
**Harus terlihat:**
- Pesan "Aplikasi disimpan"; ZKT-BIO hilang dari daftar.
- Buka **Kontrak lisensi → Kontrak baru** → pilihan **Aplikasi** tidak memuat ZKT-BIO. Klik **Batal**.
- Kembali ke **Aplikasi**, centang **Tampilkan yang dipensiunkan**: ZKT-BIO muncul dengan label **Dipensiunkan**, dan di **Tindakan** hanya ada Ubah dan Pulihkan.
- **Tindakan** → **Pulihkan** → "Aplikasi disimpan"; label Dipensiunkan hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5. Ubah aplikasi

Baris ZKT-BIO → **Tindakan** → **Ubah**. Dialog "Ubah aplikasi".

**Harus terlihat dulu:** semua kolom berisi nilai A2 (Kode ZKT-BIO, Nama, Vendor, Sumber kunci, Deskripsi). Tidak ada kolom yang terkunci; Kode dan Sumber kunci pun bisa diubah (lihat Catatan penyusun).

1. Ubah Nama menjadi `Ubah lalu batal` → klik **Batal** → nama di daftar tetap ZKTeco BioTime UAT.
2. **Ubah** lagi → Kode `GYM` → **Simpan** → ditolak "Kode ini sudah dipakai aplikasi lain". Kembalikan Kode ke `ZKT-BIO`.
3. Ubah:

| Isian | Ubah menjadi |
|---|---|
| Nama | `ZKTeco BioTime 8 UAT` |
| Vendor (opsional) | `ZKTeco Indonesia` |
| Deskripsi (opsional) | kosongkan |

**Klik:** Simpan.
**Harus terlihat:** "Aplikasi disimpan"; daftar menampilkan nama dan vendor baru, tanpa deskripsi. Tekan F5; tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A6. Cabut kunci API

Menu **Proyek → Langganan & Lisensi → Kunci API** → kartu GYM → **Kunci API baru** → Nama `Kunci cadangan UAT` → **Buat kunci** → **Salin** → **Sudah saya salin**. Lalu pada baris Kunci cadangan UAT → **Tindakan** → **Cabut**.
**Harus terlihat:**
- Pesan "Kunci API dicabut"; Status **Dicabut**; di bawah nama penerbit ada "Dicabut oleh <nama akun>"; baris ini tidak punya tindakan lagi.
- Panggil API `validate` (contoh di atas) dengan kunci cadangan ini → `"status": 401`, pesan "Kunci API lisensi tidak valid".
- Kunci Server UAT GYM tetap **Aktif**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. Kontrak dan kunci lisensi

### B1 🔧. Menu Kontrak lisensi (login `sales_seed`)

Buka menu **Proyek → Langganan & Lisensi → Kontrak lisensi**.
**Harus terlihat:** menu ada dan membuka halaman "Kontrak lisensi" berisi daftar kontrak (atau "Belum ada kontrak lisensi."), dengan tombol **Kontrak baru** *(diperbaiki 2026-11-24)*.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Buat kontrak GYM (login `sales_seed`, semua kolom)

Tombol **Kontrak baru**. Halaman berjudul "Kontrak baru" dengan petunjuk "Kontrak dimulai sebagai draf…".

**Uji salah dulu:**
- Tanpa memilih Pelanggan dan Aplikasi → tombol **Simpan draf** tidak bisa diklik.
- Isi beberapa kolom lalu klik **Batal** → kembali ke daftar, tidak ada kontrak baru. Klik **Kontrak baru** lagi.

| Isian | Isi dengan |
|---|---|
| Pelanggan *(cek pilihan)* | "Pilih pelanggan" + pelanggan aktif berbentuk `CUS-… — nama`; pilih **`CUS-…` — Budi Hartono UAT** |
| Aplikasi *(cek pilihan)* | "Pilih aplikasi", `GYM — Gym Access UAT`, `ZKT-BIO — ZKTeco BioTime 8 UAT`; pilih **GYM — Gym Access UAT** |
| Paket (opsional) | `Paket 1 gerbang` |
| Sales order *(cek pilihan)* | abu-abu sebelum Pelanggan dipilih; setelahnya berisi "Tanpa sales order" + SO milik Budi Hartono UAT yang tidak dibatalkan (dari M02 C1); pilih **Tanpa sales order** |
| Tanggal mulai | hari ini |
| Tanggal berakhir | hari ini + 1 tahun − 1 hari (contoh 24 November 2027); petunjuk "Kosongkan untuk lisensi selamanya." |
| Siklus tagihan *(cek pilihan)* | Bulanan / Per 3 bulan / Per 6 bulan / Tahunan / Sekali bayar; bawaan dan pilihan **Tahunan** |
| Nilai kontrak (Rp) (opsional) | `1500000` (tampil `1.500.000`) |
| Catatan (opsional) | `Kontrak UAT M03` |

**Uji salah** (sebelum menyimpan):
- Di kalender Tanggal berakhir, tanggal sebelum Tanggal mulai tidak bisa dipilih.
- Nilai kontrak: ketik huruf atau tanda minus → tidak masuk. Ketik `999999999999999999` → ⚠️ dugaan: tidak dibatasi di layar; bila disimpan, ditolak "Validasi gagal" (lihat Catatan penyusun). Kembalikan ke `1500000`.
- Ganti Pelanggan ke pelanggan lain lalu kembali → Sales order kembali ke "Tanpa sales order".

**Klik:** Simpan draf.
**Harus terlihat:** pesan "Kontrak disimpan sebagai draf"; halaman detail terbuka dengan nomor `…/LIC/…`, status **Draf** (isi lengkap dicek di B10).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Tambah kunci buatan sistem (semua kolom)

Di detail kontrak B2, kartu **Kunci lisensi** → tombol **Tambah kunci**. Dialog "Tambah kunci".

| Isian | Isi dengan |
|---|---|
| Kunci | **kosongkan** (petunjuk "Kosongkan agar kunci dibuat otomatis.") |
| Maks. aktivasi | `2` (bawaan 1) |
| Berlaku sampai (opsional) | kosongkan (petunjuk "Kosong = tanggal berakhir kontrak.") |
| Catatan (opsional) | `Kunci utama gerbang depan` |

**Uji salah** (klik tombol **Tambah kunci** di dialog setiap kali):
- Maks. aktivasi `0` atau `-1` → browser menolak (minimal 1).
- Maks. aktivasi `100001` → browser menolak (maksimal 100000).
- Maks. aktivasi `1,5` / `1.5` → browser menolak (harus bilangan bulat).
- Klik **Batal** → tidak ada kunci baru. Buka lagi **Tambah kunci** dan isi seperti tabel.

**Klik:** Tambah kunci.
**Harus terlihat:** pesan "Kunci ditambahkan"; kunci baru berbentuk `XXXXX-XXXXX-XXXXX-XXXXX`, Sumber kunci **Dibuat sistem**, Maks. aktivasi 2, Berlaku sampai = tanggal berakhir kontrak (24 November 2027), Status **Aktif**, tombol **Salin** dan **Cabut**. Klik **Salin** ("Disalin") dan simpan kunci untuk bagian C. ⚠️ Catatan kunci tidak ditampilkan di mana pun (lihat Catatan penyusun).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Kontrak pihak ketiga: kunci vendor wajib dan tidak boleh ganda

1. **Kontrak lisensi** → **Kontrak baru**: Pelanggan `CUS-… — Budi Hartono UAT`, Aplikasi **ZKT-BIO — ZKTeco BioTime 8 UAT**, Paket `Paket 50 karyawan`, Sales order Tanpa sales order, **Tanggal mulai dan Tanggal berakhir dikosongkan**, Siklus tagihan **Bulanan**, Nilai kontrak `250000`, Catatan kosong → **Simpan draf** → "Kontrak disimpan sebagai draf". Kartu Ketentuan: Masa berlaku "— – Selamanya".
2. **Tambah kunci**, biarkan **Kunci** kosong, Maks. aktivasi `1` → petunjuk "Ketik kunci yang diberikan vendor."; tombol **Tambah kunci** di dialog tidak bisa diklik.
3. Isi:

| Isian | Isi dengan |
|---|---|
| Kunci | `ZK-UAT-0001-ABCD` |
| Maks. aktivasi | `1` |
| Berlaku sampai (opsional) | 31 Desember 2027 |
| Catatan (opsional) | `Kunci dari email vendor` |

**Klik:** Tambah kunci.
**Harus terlihat:** "Kunci ditambahkan"; kunci tampil persis `ZK-UAT-0001-ABCD`, Sumber kunci **Vendor**, Berlaku sampai 31 Desember 2027.

**Uji salah:**
- **Tambah kunci** lagi dengan Kunci `ZK-UAT-0001-ABCD` → ditolak "Kunci lisensi ini sudah terdaftar".
- ⚠️ Berlaku sampai bisa dipilih tanggal yang sudah lewat (misal kemarin); dugaan: diterima tanpa peringatan. Bila diterima, cabut kunci itu nanti di D6 atau catat saja.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Sales tidak bisa mengaktifkan

Masih `sales_seed`, buka kontrak B2.
**Harus terlihat:** ada tombol **Ubah**, **Buat SPH**, dan **Tambah kunci**, tetapi **tidak ada** tombol **Aktifkan** maupun **Hentikan** (hak Manajer Penjualan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Manajer mengaktifkan (login `sales_manager_seed`)

1. Buka kontrak ZKT (B4, tanpa tanggal mulai) → **Aktifkan** → ditolak "Isi tanggal mulai sebelum mengaktifkan"; status tetap **Draf**.
2. Buka kontrak B2 → **Aktifkan**.

**Harus terlihat:** pesan "Kontrak diaktifkan"; status **Aktif**. Muncul tombol **Tangguhkan**, **Perpanjang**, **Buat SPH**, dan **Hentikan**, serta petunjuk "Perpanjangan membuat draf periode berikutnya…". Tombol Ubah hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7. Customer Service melihat dan menyalin (login `customer_service_seed`)

Buka **Proyek → Langganan & Lisensi → Kontrak lisensi** → kontrak B2.
**Harus terlihat:** kunci tampil lengkap dan tombol **Salin** ada (klik → "Disalin"). **Tidak ada** tombol Ubah, Tambah kunci, Tangguhkan, Perpanjang, Buat SPH, Hentikan, atau Cabut.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8. Admin atau Keuangan hanya melihat kunci tersamar (login `admin_seed` atau `finance_seed`)

Buka kontrak B2.
**Harus terlihat:** kunci tampil sebagai `••••-` + 4 karakter terakhir, tanpa tombol Salin, dengan tulisan "Hanya karakter terakhir yang ditampilkan untuk Anda." Tidak ada tombol tindakan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9. Ubah draf kontrak (login `sales_seed`)

Buka kontrak ZKT (B4, masih Draf) → **Ubah**. Halaman "Ubah kontrak" dengan nomor kontrak di bawah judul.

**Harus terlihat dulu:** semua kolom berisi nilai B4 (Pelanggan, Aplikasi ZKT-BIO, Paket 50 karyawan, Tanpa sales order, tanggal kosong, Bulanan, 250.000). Tidak ada kolom yang terkunci. Kontrak B2 (Aktif) **tidak** punya tombol Ubah.

1. Ubah Paket menjadi `Batal UAT` → **Batal** → kembali ke detail, Paket tetap "Paket 50 karyawan".
2. **Ubah** lagi:

| Isian | Ubah menjadi |
|---|---|
| Paket (opsional) | `Paket 100 karyawan` |
| Tanggal mulai | hari ini |
| Tanggal berakhir | hari ini + 1 bulan − 1 hari |
| Siklus tagihan | **Bulanan** (tetap) |
| Nilai kontrak (Rp) (opsional) | `300000` |
| Catatan (opsional) | `Naik paket sebelum aktif` |

**Klik:** Simpan draf.
**Harus terlihat:** pesan "Kontrak disimpan"; detail menampilkan Paket 100 karyawan, masa berlaku baru, "Rp 300.000,00 · Bulanan", catatan baru; status tetap **Draf**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B10. Cek detail kontrak GYM setelah F5

Buka kontrak B2, tekan F5.
**Harus terlihat**, semuanya sama dengan isian B2–B3:
- Judul nomor `…/LIC/…`; di bawahnya "Budi Hartono UAT · Gym Access UAT"; lencana **Aktif**.
- **Ketentuan**: Aplikasi "GYM — Gym Access UAT" dengan "Aplikasi sendiri (kunci dibuat sistem)"; Paket "Paket 1 gerbang"; Masa berlaku "25 November 2026 – 24 November 2027" (sesuai tanggal Anda); Nilai kontrak "Rp 1.500.000,00 · Tahunan"; Sales order "—"; Memperpanjang "—"; Perpanjangan "—"; Catatan "Kontrak UAT M03".
- **Kunci lisensi**: kolom Kunci, Sumber kunci, Maks. aktivasi, Berlaku sampai, Status berisi kunci B3, Dibuat sistem, 2, 24 November 2027, Aktif.
- **Log aktivitas**: "Belum ada aktivitas." (⚠️ aktivasi oleh staf di B6 tidak tercatat; lihat Catatan penyusun).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B11. Daftar kontrak: kolom, cari, dan saring

Menu **Proyek → Langganan & Lisensi → Kontrak lisensi**.
**Harus terlihat:** kolom Kode, Pelanggan, Aplikasi, Masa berlaku, Nilai kontrak, Status; kontrak GYM (Aktif) dan ZKT (Draf) ada.

| Isian | Isi dengan | Harus terlihat |
|---|---|---|
| Cari kode, pelanggan, aplikasi, atau kunci | `Gym Access` | hanya kontrak GYM |
| (sama) | `Budi Hartono` | kedua kontrak |
| (sama) | `ZK-UAT-0001` | hanya kontrak ZKT (cari berdasarkan kunci) |
| (sama) | `Paket 100` | hanya kontrak ZKT |
| (sama) | dikosongkan | kedua kontrak |
| Status *(cek pilihan)* | Semua status / Draf / Aktif / Ditangguhkan / Dihentikan / Diperpanjang; pilih **Draf** | hanya kontrak ZKT |
| Status | **Aktif** | hanya kontrak GYM |
| Status | **Semua status** | kedua kontrak |
| Jatuh tempo perpanjangan (30 hari) | dicentang | pilihan Status jadi abu-abu; kontrak GYM tidak tampil (berakhir lebih dari 30 hari lagi); kontrak ZKT tidak tampil (masih Draf) |
| Jatuh tempo perpanjangan (30 hari) | centang dihapus | kedua kontrak kembali |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Aktivasi lewat API

Butuh terminal (curl) atau Postman, kunci API dari A3, dan kunci lisensi dari B3. Kontrak B2 harus sudah **Aktif** (B6); kontrak Draf dijawab "Belum mulai". Endpoint: `POST http://localhost:3001/projects/api/v1/licenses/{validate,activate,deactivate}`. Isian body: `licenseKey` (wajib, maks 500 karakter), `instanceId` (wajib untuk activate/deactivate, maks 200), `deviceName` (opsional, hanya activate, maks 200).

### C1. Aktivasi perangkat 1

Jalankan contoh perintah activate (instanceId `PC-UAT-01`, deviceName `PC Resepsionis 1`).

**Uji salah dulu:** kirim body tanpa `instanceId` → `"status": 400`, pesan "Validasi gagal".

**Harus terlihat:** jawaban `"status": 200`, di dalam `data`: `"valid": true`, `"status": "ok"`, `"warning": false`, `"maxActivations": 2`, `licenseKey` tersamar `••••-…`, `application` GYM / Gym Access UAT, `customerName` Budi Hartono UAT, `packageName` Paket 1 gerbang, `endsOn` = tanggal berakhir kontrak, `graceEndsOn` = 7 hari setelahnya, `activation.instanceId` PC-UAT-01. Di detail kontrak, di bawah kunci: PC-UAT-01 dengan nama "PC Resepsionis 1" dan "terakhir terlihat …".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Kursi habis pada perangkat 3

Ulangi activate dengan `"instanceId":"PC-UAT-02"`, lalu `"instanceId":"PC-UAT-03"`.
**Harus terlihat:**
- PC-UAT-02: berhasil seperti C1.
- PC-UAT-01 dikirim ulang: tetap berhasil (tidak memakai kursi baru).
- PC-UAT-03: ditolak, `"status": 409`, pesan "Semua aktivasi kunci ini sudah terpakai" (di log: **Kursi habis**).
- Di detail kontrak B2: "Aktivasi: 2 dari 2 kursi terpakai", berisi PC-UAT-01 dan PC-UAT-02.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Kunci salah dan kunci API kosong

1. Validate dengan `{"licenseKey":"SALAH-12345"}` → `"status": 200`, di `data`: `"valid": false`, `"status": "unknown"` (di log: **Kunci tidak dikenal**).
2. Ulangi tanpa baris `Authorization` → `"status": 401`, pesan "Kunci API lisensi wajib dikirim".
3. Validate kunci vendor ZKT `ZK-UAT-0001-ABCD` dengan kunci API GYM → `"status": "unknown"` (kunci aplikasi lain dianggap tidak dikenal).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Log validasi & aktivasi (login `sales_manager_seed`)

Menu **Proyek → Langganan & Lisensi → Validasi & Aktivasi**.
**Harus terlihat:** judul "Log validasi & aktivasi", keterangan menyebut masa tenggang 7 hari. Kolom Waktu, Kejadian, Hasil, Kontrak, Oleh, Rincian. Baris terbaru (dibaca dari bawah ke atas):

| Kejadian | Hasil | Kontrak | Oleh | Rincian |
|---|---|---|---|---|
| Aktivasi | Berhasil | kontrak B2 | Aplikasi | PC-UAT-01 |
| Aktivasi | Berhasil | kontrak B2 | Aplikasi | PC-UAT-02 |
| Aktivasi | Berhasil | kontrak B2 | Aplikasi | PC-UAT-01 |
| Aktivasi | Kursi habis | kontrak B2 | Aplikasi | PC-UAT-03 |
| Validasi | Kunci tidak dikenal | — | Aplikasi | — |
| Validasi | Kunci tidak dikenal | — | Aplikasi | — (kunci ZKT) |

Panggilan yang ditolak sebelum masuk (tanpa kunci API, kunci API dicabut, body tidak valid) tidak tercatat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5 🔧. Sales membaca log (login `sales_seed`)

Buka menu **Proyek → Langganan & Lisensi → Validasi & Aktivasi**.
**Harus terlihat:** menu tampil dan log C4 terbaca (hak baca lisensi cukup) *(diperbaiki 2026-11-24)*. Menu **Kunci API** tidak tampil untuk `sales_seed`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6. Lepas kursi lalu aktivasi perangkat 3 (login `sales_manager_seed`)

Buka kontrak B2 → di daftar aktivasi, baris PC-UAT-01 → klik **Lepas**.
**Harus terlihat:** pesan "Kursi dilepas"; PC-UAT-01 berlabel **Dilepas**; "Aktivasi: 1 dari 2 kursi terpakai"; Log aktivitas kontrak berisi **Deaktivasi** oleh "Staf / sistem".
Lalu jalankan API activate dengan `"instanceId":"PC-UAT-03"` → berhasil (`"valid": true`); setelah halaman dimuat ulang "Aktivasi: 2 dari 2 kursi terpakai".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7. Validasi per perangkat dan deaktivasi lewat API

1. Validate `{"licenseKey":"<KUNCI_LISENSI>","instanceId":"PC-UAT-02"}` → `"valid": true`, `"status": "ok"`, `activation.instanceId` PC-UAT-02.
2. Deactivate `{"licenseKey":"<KUNCI_LISENSI>","instanceId":"PC-UAT-02"}` → `"status": 200`, `data` `{"released": true}`.
3. Ulangi validate nomor 1 → `"valid": false`, `"status": "not_activated"` (log: **Belum diaktivasi**).
4. Ulangi deactivate nomor 2 → `"status": 404`, pesan "Instalasi ini belum diaktivasi".

**Harus terlihat** di detail kontrak: PC-UAT-02 berlabel **Dilepas**; "Aktivasi: 1 dari 2 kursi terpakai" (tinggal PC-UAT-03). Di log ada baris **Deaktivasi** Berhasil dan **Deaktivasi** Belum diaktivasi oleh "Aplikasi".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Tangguhkan, perpanjang, hentikan

### D1. Tangguhkan (login `sales_manager_seed`)

Buka kontrak B2 → **Tangguhkan**. Dialog "Tangguhkan kontrak".

**Uji salah:**
- **Alasan** kosong atau hanya spasi → tombol **Tangguhkan** tidak bisa diklik.
- Ketik Alasan lebih dari 1000 karakter → karakter berikutnya tidak masuk.
- Klik **Batal** → status tetap **Aktif**. Klik **Tangguhkan** lagi.

| Isian | Isi dengan |
|---|---|
| Alasan | `Tagihan tahunan belum dibayar` |

**Klik:** Tangguhkan.
**Harus terlihat:** pesan "Kontrak ditangguhkan"; status **Ditangguhkan**; tombol Aktifkan kembali dan Hentikan tampil; Log aktivitas berisi **Ditangguhkan** dengan alasan. API validate kunci B3 → `"valid": false`, `"status": "suspended"`; di log hasilnya **Ditangguhkan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Aktifkan kembali

Klik **Aktifkan kembali**.
**Harus terlihat:** pesan "Kontrak diaktifkan kembali"; status **Aktif**; Log aktivitas berisi **Diaktifkan kembali**. API validate → `"valid": true`, `"status": "ok"`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Perpanjang (login `sales_seed`)

Buka kontrak B2 → **Perpanjang**.
**Harus terlihat:**
- Pesan "Draf perpanjangan dibuat"; halaman draf baru `…/LIC/…` terbuka dengan status **Draf**.
- Ketentuan sama (GYM, Paket 1 gerbang, Rp 1.500.000,00 · Tahunan, Catatan "Kontrak UAT M03"), Memperpanjang = nomor kontrak B2, Sales order "—", belum ada kunci.
- Masa berlaku mulai sehari setelah tanggal berakhir lama. Contoh: 25 November 2027 – 23 November 2028 (lihat Catatan penyusun no. 1 soal tahun kabisat).
- Di kontrak B2: kolom Perpanjangan berisi nomor draf + "Draf", dan tombol Perpanjang tidak tampil lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Buat SPH dari draf perpanjangan

Di draf D3 klik **Buat SPH**.
**Harus terlihat:** halaman SPH baru terbuka dengan Pelanggan Budi Hartono UAT sudah terisi. Isi seperti M02 B1, cukup satu baris bebas `Perpanjangan lisensi GYM 1 tahun`, jumlah 1, harga `1500000`, lalu simpan. SPH baru tersimpan untuk pelanggan ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5 ⚠️. Perpanjangan aktif sendiri setelah lunas (lingkungan)

Langkah:
1. `sales_seed` dan `sales_manager_seed`: SPH D4 → Ajukan → Setujui → Tandai terkirim → Buat sales order (seperti M02 B5–C1).
2. `sales_seed`: buka draf D3 → **Ubah** → **Sales order** *(cek pilihan)*: "Tanpa sales order" + SO milik Budi Hartono UAT; pilih SO langkah 1 → **Simpan draf** → "Kontrak disimpan"; di Ketentuan muncul link "Buka sales order".
3. `finance_seed`: buat invoice "Seluruh sisa" untuk SO itu, terbitkan, catat pembayaran sampai **Lunas** (seperti M02 D1–D6).
4. Buka draf D3 lagi (cukup membuka halaman, tidak perlu menunggu jadwal).

**Harus terlihat:** draf jadi **Aktif**; kontrak B2 jadi **Diperpanjang**; kunci B3 pindah ke kontrak perpanjangan dengan Berlaku sampai = tanggal berakhir baru; di Log aktivitas ada **Diperpanjang**.

**Temuan yang diperkirakan:**
- Pengingat 30/7 hari sebelum berakhir butuh `SCHEDULER_ENABLED=true` (mati di dev), jadi tidak diuji di sini.
- API validate kunci B3 setelah perpanjangan aktif kemungkinan menjawab `"valid": false`, `"status": "not_started"` (**Belum mulai**), karena kunci sudah pindah ke kontrak yang baru mulai tahun depan. Pelanggan yang memperpanjang lebih awal justru terkunci. Lihat Catatan penyusun no. 2.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6. Cabut satu kunci (login `sales_manager_seed`)

Pakai kontrak GYM yang sedang **Aktif** (kontrak perpanjangan bila D5 berhasil; kalau tidak, kontrak B2). Supaya D7 tetap bisa diuji, tambahkan dulu kunci kedua: **Tambah kunci** → Kunci kosong, Maks. aktivasi `1`, Catatan `Kunci cadangan` → **Tambah kunci**. Lalu pada kunci kedua itu klik **Cabut**. Dialog "Cabut kunci".

**Uji salah:**
- **Alasan** kosong → tombol **Cabut** tidak bisa diklik.
- Klik **Batal** → kunci tetap **Aktif**. Klik **Cabut** lagi.

| Isian | Isi dengan |
|---|---|
| Alasan | `Kunci bocor` |

**Klik:** Cabut.
**Harus terlihat:** pesan "Kunci dicabut"; kunci kedua berstatus **Dicabut** dengan alasan "Kunci bocor" di bawahnya dan tanpa tombol Cabut; Log aktivitas berisi **Kunci dicabut**. API validate kunci kedua → `"valid": false`, `"status": "revoked"` (log: **Kunci dicabut**).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7. Hentikan kontrak

Kontrak yang sama → **Hentikan**. Dialog "Hentikan kontrak". Tombol **Hentikan** di dialog tidak bisa diklik selama Alasan kosong.

| Isian | Isi dengan |
|---|---|
| Alasan | `Pelanggan berhenti berlangganan` |

**Klik:** Hentikan.
**Harus terlihat:** pesan "Kontrak dihentikan"; status **Dihentikan**; Alasan penghentian tampil di Ketentuan; semua tombol tindakan hilang, termasuk Tambah kunci; Log aktivitas berisi **Dihentikan**. API validate kunci B3 → `"valid": false`, `"status": "terminated"` (log: **Dihentikan**). API activate → ditolak `"status": 403`, "Lisensi sudah dihentikan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 31 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M03:** lulus / belum lulus (coret salah satu)

Catatan: integrasi lisensi ke aplikasi pilot (T24) **ditunda** (keputusan 27/11, T-7), jadi tidak diuji di sini.

Catatan penguji:

---

## Catatan penyusun

**Nomor langkah (2026-11-25):** semua nomor lama tetap (A1–A4, B1–B8, C1–C6, D1–D7). Langkah baru: A5 (ubah aplikasi), A6 (cabut kunci API), B9 (ubah draf kontrak), B10 (detail setelah F5), B11 (daftar, cari, saring), C7 (validasi per perangkat dan deaktivasi). Tidak ada penomoran ulang.

Hal yang ditemukan saat menyusun dari kode:

1. **Masa perpanjangan bisa kurang sehari.** Perpanjangan memakai jumlah hari periode lama, bukan "1 tahun kalender". Bila periode baru melewati 29 Februari, tanggal berakhir maju sehari (25 Nov 2027 → 23 Nov 2028, bukan 24 Nov 2028). `apps/backend/src/app/project/utils/license.ts:41-43`.
2. **Perpanjangan dini mengunci pelanggan.** Saat draf perpanjangan aktif, kunci pindah ke kontrak baru (`apps/backend/src/app/project/services/licensing.service.ts:306`), padahal tanggal mulainya sehari setelah tanggal berakhir lama (`utils/license.ts:41`). API lalu menjawab "Belum mulai" sampai periode baru mulai (`utils/license.ts:127`). **Keputusan 27/11 (T-2):** masa dihitung tahun kalender; kunci tetap di kontrak lama sampai periode baru mulai.
3. **B4: tidak "ditolak", tapi dicegah.** Dokumen lama menulis "Ditolak: kunci wajib". Di layar, kolom Kunci wajib dan tombol Tambah kunci mati selama kosong (`apps/web-admin/src/routes/_authed/subscription/$contractId/index.tsx:394,441`). Pesan server ("Ketik kunci dari vendor (aplikasi pihak ketiga)") hanya muncul bila form dilewati.
4. **Kunci yang dicabut menutupi status Dihentikan.** API memeriksa status kunci lebih dulu (`utils/license.ts:122`). Karena itu D6 memakai kunci kedua.
5. **Pesan pensiun/pulihkan aplikasi** tetap "Aplikasi disimpan" (`apps/web-admin/src/routes/_authed/subscription/applications/index.tsx:68`).
6. **Pilihan form kontrak dibatasi 100.** Pelanggan aktif dan sales order hanya diambil 100 pertama (`apps/web-admin/src/components/licensing/contract-form.tsx:42,44`).
7. **Label wajib/opsional tidak konsisten.** Tanggal mulai dan Sales order tidak bertanda opsional padahal boleh kosong (`contract-form.tsx:132,152`); kontrak tanpa tanggal mulai baru ditolak saat Aktifkan.
8. **D5 tidak bergantung pada scheduler.** Aktivasi otomatis perpanjangan yang lunas berjalan saat kontrak/daftar dibuka dan saat API dipanggil (`licensing.service.ts:182,192`). Hanya pengingat 30/7 hari yang butuh `SCHEDULER_ENABLED=true`.
9. **Catatan kunci lisensi tidak pernah tampil.** Dialog Tambah kunci punya kolom Catatan dan tersimpan, tetapi tabel Kunci lisensi tidak menampilkannya (`$contractId/index.tsx:251-286`).
10. **Aktivasi manual tidak tercatat di log.** Mengaktifkan draf biasa (bukan perpanjangan) tidak menulis kejadian apa pun (`licensing.service.ts:303`); Log aktivitas kosong sampai ada panggilan API.
11. **Nilai kontrak tanpa batas di layar.** Kolom Nilai kontrak (Rp) tidak punya batas atas (`contract-form.tsx:180`); angka sangat besar baru ditolak server dengan pesan umum "Validasi gagal" (`apps/backend/src/app/project/contracts/licensing.contract.ts:52`).
12. **Berlaku sampai kunci tidak dicek.** Tanggal lampau atau di luar masa kontrak diterima tanpa peringatan (`licensing.service.ts:466-480`, `$contractId/index.tsx:419`).
13. **Kode dan Sumber kunci aplikasi bisa diubah kapan saja**, juga setelah aplikasi punya kontrak atau kunci API (`licensing.service.ts:127`, `applications/index.tsx:200-234`). Mengubah GYM menjadi Pihak ketiga akan menyembunyikannya dari halaman Kunci API. **Keputusan 27/11 (T-3):** dikunci setelah dipakai; nama dan deskripsi tetap bisa diubah.
