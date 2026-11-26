# UAT M02 - CRM & Penjualan (T05)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Prasyarat:** M05 bagian A dan D selesai (barang ada dan stok sudah masuk gudang WH-MAIN).

**Alur yang diuji:** lead → pelanggan → SPH → sales order → surat jalan → invoice → pembayaran → retur penjualan.

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, foto, dan baris tambahan. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Status dokumen:**

| Dokumen | Status |
|---|---|
| Lead | Baru → Dihubungi → Survei → Penawaran → Menang / Kalah |
| SPH | Draf → Menunggu persetujuan → Disetujui / Ditolak → Terkirim → Deal (lewat sales order). Juga Batal dan Direvisi |
| Sales order | Aktif → Diproses (setelah surat jalan pertama dikirim) → Dibatalkan |
| Surat jalan | Disiapkan → Dikirim → Diterima (atau Dibatalkan sebelum dikirim) |
| Invoice | Draf → Terbit → Dibayar sebagian → Lunas (atau Void sebelum ada pembayaran) |
| Retur penjualan | Draf → Menunggu persetujuan → Disetujui → Diterima (atau Dibatalkan) |

**Data contoh yang dibuat selama UAT:**

| Data | Nilai |
|---|---|
| Lead utama / pelanggan | Budi Hartono UAT, email `budi.uat@majujaya.test` |
| Perusahaan dari lead | PT Maju Jaya UAT |
| Lead kalah | Lead kalah UAT |
| Lead ke pelanggan lama | Andi Lama UAT |
| Perusahaan baru | CV Sinar Abadi UAT, NPWP `0123456789012345` |
| Pelanggan perorangan | Siti Perorangan UAT, email `siti.uat@contoh.test` |
| Pelanggan dengan perusahaan baru | Joko Mitra UAT, perusahaan PT Mitra Baru UAT |
| Kontak tambahan | Rina Lestari UAT, email `rina.uat@majujaya.test` |
| Akun portal | Dewi Keuangan UAT, email `dewi.uat@majujaya.test` |
| Barang dari M05 | Kabel UTP Cat6 UAT, SKU `UAT-KBL-01`, harga jual Rp 1.500.000 |
| Baris bebas | Jasa pemasangan kabel, 1 paket |
| Gudang dan rak | WH-MAIN, rak `R-01` |
| Nomor PO pelanggan | `PO-MJ-UAT-01` |

Siapkan juga **1 file gambar** (PNG/JPG/WebP, di bawah 2 MB) dan **1 file gambar di atas 2 MB** untuk uji foto pelanggan.

**Angka SPH yang dipakai di langkah berikutnya** (setelah revisi B7):

| Baris | Hitungan | Jumlah harga |
|---|---|---|
| Kabel UTP Cat6 UAT | 3 roll × Rp 1.500.000 − diskon Rp 300.000 | Rp 4.200.000 |
| Jasa pemasangan kabel | 1 paket × Rp 800.000 | Rp 800.000 |
| Subtotal | | Rp 5.300.000 |
| Diskon | | − Rp 300.000 |
| PPN 11% (dari Rp 5.000.000) | | Rp 550.000 |
| **Total** | | **Rp 5.550.000** |

Rencana penagihan: DP 50% (Rp 2.775.000) dan Pelunasan 50% (Rp 2.775.000).

Nomor dokumen memakai pola bawaan `0001/QT/<kode perusahaan>/XI/26`. Di langkah di bawah ditulis singkat, mis. `…/QT/…`.

---

## A. Lead dan pelanggan

### A1. Buat lead (semua kolom, login `sales_seed`)

Menu **CRM & Penjualan → CRM → Prospek** → tombol **Lead baru**.

| Isian | Isi dengan |
|---|---|
| Nama | `Budi Hartono UAT` |
| Perusahaan (Opsional) | `PT Maju Jaya UAT` |
| Telepon (Opsional) | kode negara Indonesia (+62), nomor `81311112222` |
| Nomor WhatsApp (Opsional) | kode negara Indonesia (+62), nomor `81311113333` |
| Alamat email (Opsional) | `budi.uat@majujaya.test` |
| Sumber *(cek pilihan)* | Formulir website / Chat WhatsApp / DM Instagram / Telepon / Referensi / Datang langsung / Lainnya; bawaan **Chat WhatsApp**; pilih **Referensi** |
| Estimasi nilai (Rp) (Opsional) | `6000000` |
| Follow-up berikutnya (Opsional) | besok, jam 10:00 |
| Kebutuhan (Opsional) | `Kabel jaringan dan pemasangan kantor` |

**Uji salah** (sebelum isian di atas disimpan):
- Kosongkan Telepon, Nomor WhatsApp, dan Alamat email sekaligus → tombol **Simpan** tidak bisa diklik; ada petunjuk "Isi minimal salah satu: telepon, WhatsApp, atau email."
- Kosongkan Nama → tidak bisa disimpan (kolom wajib).
- Telepon `12` → ditolak "Masukkan nomor telepon yang valid."
- Alamat email `budi@` → ditolak browser (format email).
- Estimasi nilai diketik huruf atau tanda minus → huruf dan minus tidak masuk. Angka sangat besar (`999999999999999`) → harus ditolak atau dibatasi. Kembalikan ke 6000000.

**Klik:** Simpan.
**Harus terlihat:** pesan "Lead disimpan"; di daftar muncul Budi Hartono UAT dengan Sumber Referensi, Status pipeline **Baru**, PIC Sales = nama akun `sales_seed`, dan Follow-up berikutnya besok 10:00.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Cek detail lead

Klik nama **Budi Hartono UAT** di daftar. Tekan F5.

**Harus terlihat** (semua sama dengan A1):
- Judul Budi Hartono UAT, lencana **Baru**, di bawahnya PT Maju Jaya UAT.
- Kartu **Rincian**: Telepon +6281311112222, Nomor WhatsApp +6281311113333, Alamat email, Sumber Referensi, Estimasi nilai Rp 6.000.000, Dibuat (tanggal dan jam hari ini), Kebutuhan.
- Kartu **Status pipeline**: PIC Sales = nama `sales_seed`, Follow-up berikutnya besok 10:00.
- Tombol yang ada: **Ubah** dan **Jadikan Pelanggan**. Tidak ada tombol Arsipkan (hak manajer).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Ubah lead dan batal

1. Klik **Ubah** → ubah **Estimasi nilai (Rp)** `6500000` dan **Kebutuhan** `Kabel jaringan 3 roll dan pemasangan kantor` → **Simpan**.
2. Klik **Ubah** lagi → ganti Nama menjadi `Nama Batal` → klik **Batal**.

**Harus terlihat:** setelah langkah 1, "Lead disimpan" dan Rincian berisi Rp 6.500.000 dan Kebutuhan baru. Semua kolom lain di form Ubah berisi nilai A1 (tidak ada yang kosong). Setelah langkah 2, nama tetap Budi Hartono UAT.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Ubah status dan catat follow-up

Masih di detail lead.

1. Kartu **Status pipeline**: buka pilihan **Status pipeline** *(cek pilihan)*: Baru / Dihubungi / Survei / Penawaran / Kalah (tidak ada Menang). Pilih **Dihubungi** → **Simpan status**. Tombol Simpan status tidak bisa diklik selama pilihan sama dengan status sekarang.
2. Kartu **Riwayat follow-up**:

| Isian | Isi dengan |
|---|---|
| Aktivitas *(cek pilihan)* | Telepon / Pesan WhatsApp / Pesan email / Pertemuan / Survei lokasi / Catatan; bawaan **Telepon**; pilih **Pertemuan** |
| Follow-up berikutnya (Opsional) | lusa, jam 14:00 |
| Catatan | `Minta penawaran kabel 3 roll dan jasa pasang` |

**Uji salah:** Catatan kosong → tombol **Catat follow-up** tidak bisa diklik.

**Klik:** Catat follow-up.
**Harus terlihat:** "Status disimpan" lalu "Follow-up dicatat"; lencana **Dihubungi**; di Riwayat follow-up ada baris "Pertemuan", jam sekarang, "oleh <nama sales>", dan catatan di atas; Follow-up berikutnya di kartu Status pipeline berubah ke lusa 14:00. Catat satu follow-up lagi dengan Aktivitas **Catatan** tanpa Follow-up berikutnya → muncul di atas baris sebelumnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5. Lead kalah dan dibuka lagi

**Lead baru**: Nama `Lead kalah UAT`, Alamat email `kalah.uat@contoh.test`, Sumber **Datang langsung** → **Simpan**. Buka lead itu.

1. **Status pipeline** pilih **Kalah**. Muncul kolom **Alasan kalah**. Biarkan kosong → **Simpan status** tidak bisa diklik.
2. Isi Alasan kalah `Anggaran belum ada` → **Simpan status**.
3. Pilih lagi **Baru** → **Simpan status**.

**Harus terlihat:** setelah langkah 2: "Status disimpan", lencana **Kalah**, tampil "Alasan kalah: Anggaran belum ada", dan tombol **Jadikan Pelanggan** hilang. Setelah langkah 3: lencana **Baru** dan tombol Jadikan Pelanggan muncul lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A6. Jadikan pelanggan baru

Buka lead Budi Hartono UAT → tombol **Jadikan Pelanggan**. Dialog berisi "Lead akan ditandai Menang dan terhubung ke data pelanggan."

| Isian | Isi dengan |
|---|---|
| Pelanggan *(cek pilihan)* | Buat pelanggan baru / Pilih pelanggan yang sudah ada; biarkan **Buat pelanggan baru** |
| Kode (Opsional) | **kosongkan**; petunjuk "Kosongkan untuk dibuat otomatis dari pengaturan nomor kode." |
| Nama | `Budi Hartono UAT` (sudah terisi dari lead) |
| Email | `budi.uat@majujaya.test` (sudah terisi dari lead) |

**Uji salah:** kosongkan Email → tidak bisa disimpan; Kode `CUS 01` (ada spasi) → ditolak browser (format tidak sesuai). Kembalikan.

**Klik:** Jadikan Pelanggan (tombol di bawah dialog).
**Harus terlihat:**
- Pesan "Lead sudah menjadi pelanggan"; status lead **Menang**.
- Muncul tombol **Buka pelanggan** dan **Buat penawaran**; tombol Ubah, Jadikan Pelanggan, kartu ubah status, dan form follow-up hilang.
- Menu **Pelanggan** tab **Orang**: Budi Hartono UAT dengan kode `CUS-…` dan lencana **Owner**. Tab **Perusahaan**: PT Maju Jaya UAT dengan kode `CMP-…`.
- Detail Budi: Telepon +6281311112222, Catatan = isi Kebutuhan lead.
- Mailpit (http://localhost:8025): ada email ke `budi.uat@majujaya.test` berisi data login portal.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A7. Jadikan pelanggan yang sudah ada

**Lead baru**: Nama `Andi Lama UAT`, Telepon `81399990000`, Sumber **Telepon** → **Simpan**. Buka lead itu → **Jadikan Pelanggan**.

| Isian | Isi dengan |
|---|---|
| Pelanggan | **Pilih pelanggan yang sudah ada** |
| Cari pelanggan aktif | ketik `Budi` |
| Pilih pelanggan | `CUS-… — Budi Hartono UAT` |

**Klik:** Jadikan Pelanggan.
**Harus terlihat:** "Lead sudah menjadi pelanggan"; status **Menang**; tombol **Buka pelanggan** membuka Budi Hartono UAT. Tidak ada pelanggan baru bernama Andi Lama UAT di menu Pelanggan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A8. Buat perusahaan (semua kolom)

Menu **CRM → Pelanggan** → tombol tab **Perusahaan** → tombol **Perusahaan baru**.

**Identitas**

| Isian | Isi dengan |
|---|---|
| Kode (Opsional) | **kosongkan** |
| Jenis *(cek pilihan)* | Perusahaan / Instansi pemerintah / Mitra; biarkan **Perusahaan** |
| Nama | `CV Sinar Abadi UAT` |
| Nama badan usaha (Opsional) | `CV Sinar Abadi Sejahtera` |
| NPWP (Opsional) | `01.234.567.8-901.2345`; petunjuk "15 atau 16 digit; titik dan tanda hubung diabaikan." |

**Kontak**

| Isian | Isi dengan |
|---|---|
| Email (Opsional) | `info@sinarabadi.test` |
| Telepon (Opsional) | +62, `215550001` |
| Situs web (Opsional) | `https://sinarabadi.test` |

**Pengelolaan**

| Isian | Isi dengan |
|---|---|
| Catatan (Opsional) | `Calon pelanggan proyek gedung` |

Kolom Owner dan Status tidak ada di form baru (hanya saat Ubah).

**Uji salah** (sebelum menyimpan):
- NPWP `1234567890123` (13 digit) → ditolak, perusahaan tidak tersimpan. Catat pesannya (kemungkinan berbahasa Inggris, mis. "Invalid input").
- Kode = kode `CMP-…` milik PT Maju Jaya UAT → ditolak "Kode pelanggan CMP-… sudah dipakai".
- Nama kosong → tidak bisa disimpan.
- Email `info@` → ditolak browser.
- Klik **Batal** pada form yang sudah diisi → tidak ada perusahaan baru.

**Klik:** Simpan.
**Harus terlihat:** "Pelanggan disimpan"; terbuka halaman perusahaan dengan kode `CMP-…`. Tekan F5. Kartu **Rincian** berisi Jenis Perusahaan, Nama badan usaha, NPWP `0123456789012345`, Situs web, Email, Telepon +62215550001, Owner kosong, Catatan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A9. Orang baru: perorangan dan dengan perusahaan baru

Menu **CRM → Pelanggan** → tab **Orang** → tombol **Orang baru**.

**Identitas**

| Isian | Isi dengan |
|---|---|
| Foto (Opsional) | **Pilih foto** → file gambar di bawah 2 MB; petunjuk "PNG, JPG, WebP, GIF, HEIC, atau AVIF, maksimal 2 MB." Pratinjau muncul. Coba **Hapus foto**, lalu pilih lagi |
| Kode (Opsional) | **kosongkan** |
| Nama | `Siti Perorangan UAT` |
| Jabatan (Opsional) | `Pemilik rumah` |

**Perusahaan**

| Isian | Isi dengan |
|---|---|
| Bagian dari *(cek pilihan)* | Perorangan / Perusahaan terdaftar / Perusahaan baru; biarkan **Perorangan** |

**Kontak**

| Isian | Isi dengan |
|---|---|
| Email | `siti.uat@contoh.test`; petunjuk "Dipakai untuk masuk ke portal pelanggan; data login dikirim ke email ini." |
| Telepon (Opsional) | +62, `81355556666` |

**Pengelolaan**

| Isian | Isi dengan |
|---|---|
| Catatan (Opsional) | `Pelanggan rumah tinggal` |

**Uji salah:**
- Foto di atas 2 MB → "Pilih berkas gambar maksimal 2 MB."
- Email `budi.uat@majujaya.test` (sudah dipakai) → ditolak "Email budi.uat@majujaya.test sudah dipakai akun lain".
- Email kosong → tidak bisa disimpan.

**Klik:** Simpan.
**Harus terlihat:** "Pelanggan disimpan"; dialog "Akun pelanggan dibuat" berisi Nama pengguna dan Kata sandi (tombol **Salin** berubah "Tersalin"), dengan tulisan "Kata sandi hanya ditampilkan sekali."; klik **Selesai**. Di daftar: Siti Perorangan UAT, Jenis Perorangan, dengan foto.

Lalu **Orang baru** lagi: Nama `Joko Mitra UAT`, Bagian dari **Perusahaan baru**, **Nama perusahaan** `PT Mitra Baru UAT`, **Tipe perusahaan** *(cek pilihan)* Perusahaan / Instansi pemerintah / Mitra → pilih **Mitra**; petunjuk "Dibuat bersama orang ini, yang menjadi owner-nya."; Email `joko.uat@contoh.test` → **Simpan** → **Selesai**. Uji dulu Nama perusahaan kosong → tidak bisa disimpan.
**Harus terlihat:** tab Perusahaan berisi PT Mitra Baru UAT, Jenis Mitra, Owner Joko Mitra UAT.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A10. Cek dan ubah orang

Buka **Siti Perorangan UAT**. Tekan F5.

**Harus terlihat dulu:** kode `CUS-…` di bawah nama, foto, Rincian: Jenis Perorangan, Perusahaan kosong, Jabatan Pemilik rumah, Email, Telepon +6281355556666, Nama pengguna (sama dengan dialog A9), Catatan.

Klik **Ubah**. **Harus terlihat:** Kode sekarang wajib (tanpa "(Opsional)") dengan petunjuk "Huruf, angka, dan . _ - /; disimpan dalam huruf besar."; Bagian dari hanya punya pilihan Perorangan / Perusahaan terdaftar (tidak ada Perusahaan baru); ada kolom **Status** *(cek pilihan)* Aktif / Nonaktif.

| Isian | Ubah menjadi |
|---|---|
| Jabatan | `Pemilik ruko` |
| Telepon | +62, `81355557777` |
| Bagian dari | **Perusahaan terdaftar**, Perusahaan: ketik `Sinar`, pilih CV Sinar Abadi UAT |
| Owner perusahaan | dicentang; petunjuk "Satu perusahaan hanya punya satu owner; owner sebelumnya menjadi staf." |

**Uji salah:** kosongkan Kode → tidak bisa disimpan.

**Klik:** Simpan.
**Harus terlihat:** "Pelanggan disimpan"; Jenis berubah Kontak perusahaan, Perusahaan CV Sinar Abadi UAT dengan lencana Owner, Jabatan dan Telepon baru. Di detail CV Sinar Abadi UAT, Owner = Siti Perorangan UAT. (Bila email Siti sudah pernah dipakai masuk portal, kolom Email terkunci dengan petunjuk "Terverifikasi saat pertama kali masuk; tidak dapat diubah lagi.")

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A11. Tambah dan hapus alamat

Buka **Budi Hartono UAT** → kartu **Alamat** → **Tambah alamat**.

| Isian | Isi dengan |
|---|---|
| Jenis *(cek pilihan)* | Tempat tinggal / Kantor / Penagihan / Lainnya; bawaan Tempat tinggal; pilih **Kantor** |
| Keterangan (Opsional) | `Kantor pusat` |
| Alamat | `Jl. Merdeka No. 10, Jakarta Pusat` |
| Provinsi | ketik `DKI`, pilih DKI Jakarta |
| Kabupaten / kota | Kota Jakarta Pusat (terbuka setelah provinsi dipilih) |
| Kecamatan | Gambir |
| Desa / kelurahan | Gambir |
| Kode pos (Opsional) | `10110` |
| Alamat utama | dicentang |

**Uji salah:** Alamat kosong → tidak bisa disimpan; Kode pos `10A10` → ditolak (hanya angka, maksimal 10).

**Klik:** Simpan.
**Harus terlihat:** "Alamat disimpan"; di kartu Alamat: "Kantor - Kantor pusat" dengan lencana **Utama**, di bawahnya "Jl. Merdeka No. 10, Jakarta Pusat 10110".

Tambah alamat kedua: Jenis **Penagihan**, Alamat `Jl. Sudirman No. 5` → **Simpan** → klik **Hapus alamat** pada alamat itu → konfirmasi "Hapus alamat "Jl. Sudirman No. 5"?" → **Hapus alamat** → "Alamat dihapus". Di halaman perusahaan PT Maju Jaya UAT, pilihan Jenis alamat *(cek pilihan)*: Penagihan / Pengiriman / Servis / Lokasi proyek / Lainnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A12. Tambah kontak perusahaan

Buka **PT Maju Jaya UAT** (link Perusahaan di detail Budi) → kartu **Kontak** → **Tambah kontak**. Bagian Perusahaan sudah berisi **Perusahaan terdaftar** PT Maju Jaya UAT.

| Isian | Isi dengan |
|---|---|
| Foto (Opsional) | kosongkan |
| Kode (Opsional) | kosongkan |
| Nama | `Rina Lestari UAT` |
| Jabatan (Opsional) | `Purchasing` |
| Owner perusahaan | **tidak** dicentang |
| Email | `rina.uat@majujaya.test` |
| Telepon (Opsional) | +62, `81322223333` |
| Catatan (Opsional) | `PIC pembelian` |

**Uji salah:** Email `budi.uat@majujaya.test` → ditolak "Email budi.uat@majujaya.test sudah dipakai akun lain".

**Klik:** Simpan.
**Harus terlihat:** "Pelanggan disimpan"; dialog "Akun pelanggan dibuat" → **Selesai**. Rina tampil di kartu Kontak dengan "Purchasing · +6281322223333 · rina.uat@majujaya.test"; Budi tetap berlencana Owner.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A13. Ubah perusahaan: pindah owner dan status

Masih di PT Maju Jaya UAT → **Ubah**.

**Harus terlihat dulu:** Kode wajib; bagian Pengelolaan sekarang berisi **Owner (Opsional)** *(cek pilihan)*: Tanpa owner, `CUS-… - Budi Hartono UAT`, `CUS-… - Rina Lestari UAT`; petunjuk "Salah satu kontak perusahaan ini."; dan **Status** *(cek pilihan)* Aktif / Nonaktif.

1. Owner pilih **Rina Lestari UAT** → **Simpan**.
2. **Ubah** lagi → Owner kembali **Budi Hartono UAT**, Situs web `https://majujaya.test` → **Simpan**.

**Harus terlihat:** setelah 1: "Pelanggan disimpan"; Owner = Rina, lencana Owner pindah ke Rina, Budi tanpa lencana. Setelah 2: Owner Budi lagi, Situs web tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A14. Sales tidak bisa menonaktifkan atau mengundang

Masih `sales_seed`. Buka detail Budi Hartono UAT, lalu PT Maju Jaya UAT.
**Harus terlihat:** **tidak ada** tombol Nonaktifkan dan **tidak ada** kartu **Portal pelanggan** (berisi tombol Undang ke portal). Itu hak Manajer Penjualan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A15. Manajer menonaktifkan lalu mengaktifkan (login `sales_manager_seed`)

1. Buka **Pelanggan** → Budi Hartono UAT → **Nonaktifkan**.
2. Buka **Penjualan → SPH** → **Penawaran baru** → di **Cari pelanggan** ketik `Budi`. Budi Hartono UAT **tidak** ada di pilihan **Pelanggan**. Klik **Batal**.
3. Kembali ke Budi Hartono UAT → **Aktifkan**.
4. Ulangi untuk perusahaan CV Sinar Abadi UAT: **Nonaktifkan** lalu **Aktifkan**.

**Harus terlihat:** "Pelanggan dinonaktifkan" lalu "Pelanggan diaktifkan"; lencana berubah Nonaktif → Aktif, untuk orang dan perusahaan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A16. Undang ke portal (login `sales_manager_seed`)

Buka **PT Maju Jaya UAT** → kartu **Portal pelanggan**.

| Isian | Isi dengan |
|---|---|
| Nama | `Dewi Keuangan UAT` |
| Email untuk masuk | `dewi.uat@majujaya.test` |
| Peran *(cek pilihan)* | Pemilik / Penyetuju / Keuangan / Pemantau; bawaan **Pemilik**; pilih **Keuangan** |

**Uji salah:** Email untuk masuk `rina.uat@majujaya.test` (sudah punya akun) → ditolak (mis. "Email ini sudah dipakai akun lain" atau "Pelanggan ini sudah punya akun portal"); Nama kosong → tidak bisa dikirim.

**Klik:** Undang ke portal.
**Harus terlihat:** "Undangan terkirim"; Dewi tampil dengan lencana **Keuangan**, status (Aktif atau Menunggu kata sandi), dan "Belum pernah masuk"; email masuk ke Mailpit. Klik **Kirim ulang tautan** → "Tautan kata sandi baru sudah dikirim". Klik **Cabut akses** → konfirmasi "Dewi Keuangan UAT tidak bisa lagi masuk ke portal…" → **Cabut akses** → "Akses portal dicabut".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A17. Manajer melihat, membagikan, dan mengarsipkan lead (login `sales_manager_seed`)

Menu **CRM → Prospek**.

1. Cek filter: Status *(cek pilihan)* Semua status / Baru / Dihubungi / Survei / Penawaran / Menang / Kalah; Sumber Semua sumber + 7 sumber; **PIC Sales** Semua sales / Milik saya / Belum dibagikan; centang **Jatuh tempo follow-up**.
2. Buka **Lead kalah UAT** → kartu Status pipeline → **PIC Sales** pilih nama manajer sendiri.
3. Klik **Arsipkan** → konfirmasi "Arsipkan lead Lead kalah UAT?" → **Arsipkan**.

**Harus terlihat:** daftar berisi lead Budi, Andi, Lead kalah UAT, dan lead milik sales lain. Setelah 2: "PIC sales diperbarui". Setelah 3: "Lead diarsipkan", kembali ke daftar dan Lead kalah UAT hilang. Dengan `sales_seed`: filter PIC Sales **tidak ada**, hanya lead miliknya yang tampil, dan Lead kalah UAT tidak terlihat lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. SPH

### B1. Buat SPH dari lead (semua kolom, login `sales_seed`)

Buka lead Budi Hartono UAT → tombol **Buat penawaran**. Terbuka halaman **Penawaran baru** dengan Pelanggan sudah terpilih.

**Pelanggan**

| Isian | Isi dengan |
|---|---|
| Cari pelanggan | kosongkan (petunjuk "Ketik nama atau kode") |
| Pelanggan *(cek pilihan)* | "Pilih pelanggan" dan pelanggan aktif dalam format `CUS-… — Nama`; terpilih **Budi Hartono UAT** |
| Up (ditujukan kepada) (Opsional) | `Bapak Budi Hartono` |

**Dokumen**

| Isian | Isi dengan |
|---|---|
| Perihal | `Pengadaan dan pemasangan kabel jaringan UAT` |
| Judul dokumen (Opsional) | `QUOTATION KABEL JARINGAN` |
| Tanggal penawaran | hari ini (bawaan) |
| Berlaku sampai | 30 hari dari hari ini |
| Garansi (Opsional) | `1 tahun` |
| Cara pembayaran (Opsional) | `DP 50% - Pelunasan 50% setelah terpasang` |

**Barang dan jasa**
1. Di **Tambah barang dari inventaris** ketik `UAT-KBL`, klik *Kabel UTP Cat6 UAT*. Baris 1 · UAT-KBL-01:

| Isian | Isi dengan |
|---|---|
| Barang | Kabel UTP Cat6 UAT (terisi) |
| Spesifikasi (Opsional) | terisi dari barang; tambahkan baris `Warna abu-abu` |
| Jumlah | `3` |
| Satuan *(cek pilihan)* | pcs, unit, set, paket, titik, m, roll, kg, jam, bulan, tahun, lic, lot, pulau; terpilih **roll** |
| Harga satuan (Rp) | 1.500.000 (terisi) |
| Diskon (Rp) (Opsional) | `300000` |

2. Klik **Tambah baris bebas**. Baris 2 · baris bebas:

| Isian | Isi dengan |
|---|---|
| Barang | `Jasa pemasangan kabel` |
| Spesifikasi (Opsional) | `Termasuk penarikan dan terminasi` |
| Jumlah | `1` |
| Satuan | paket (bawaan) |
| Harga satuan (Rp) | `1000000` |
| Diskon (Rp) (Opsional) | kosongkan |

3. Tambah baris bebas ketiga `Coba hapus`, lalu klik **Hapus** pada baris itu → hilang.

**PPN dan penagihan**

| Isian | Isi dengan |
|---|---|
| Kenakan PPN | dicentang (bawaan) |
| Tarif PPN (%) | `11` (bawaan) |
| Rencana penagihan | klik **Tambah termin** 2 kali: `DP` `50`, `Pelunasan` `50` |

**Syarat dan catatan**

| Isian | Isi dengan |
|---|---|
| Syarat dan ketentuan (Opsional) | terisi syarat bawaan perusahaan bila ada; tambahkan baris `Harga belum termasuk bongkar plafon` |
| Catatan (Opsional) | `Pekerjaan 2 hari kerja` |

**Uji salah** (sebelum menyimpan):
- Sebelum ada baris: tulisan "Tambahkan minimal satu baris." dan tombol **Simpan** tidak bisa diklik.
- Perihal kosong → tidak bisa disimpan.
- Barang pada baris bebas kosong → tidak bisa disimpan.
- Jumlah `0` → ditolak browser (minimal 0,001).
- Tarif PPN `150` → ditolak browser (maksimal 100).
- Porsi termin `0` → ditolak browser.
- Berlaku sampai: tanggal sebelum Tanggal penawaran tidak bisa dipilih.
- Diskon Baris 1 `5000000` (lebih besar dari 3 × 1.500.000) → **Simpan** ditolak "Baris 1: diskon melebihi nilai baris". Kembalikan ke 300000.

**Harus terlihat sebelum simpan:** Jumlah harga Baris 1 **Rp 4.200.000**, Baris 2 **Rp 1.000.000**; Subtotal **Rp 5.500.000**, Diskon **− Rp 300.000**, PPN **Rp 572.000**, Total **Rp 5.772.000**.

**Klik:** Simpan.
**Harus terlihat:** "Penawaran disimpan"; terbuka detail dengan nomor `…/QT/…/XI/26` (langsung ada) dan status **Draf**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Cek detail SPH

Di detail SPH B1, tekan F5.

**Harus terlihat** (semua sama dengan B1):
- Judul = nomor, di bawahnya Perihal; lencana Draf.
- Kartu **Pelanggan**: `CUS-… — Budi Hartono UAT`, Up Bapak Budi Hartono, Telepon, Email, Alamat (alamat utama Budi dari A11), NPWP (kosong untuk orang).
- Kartu **Dokumen**: Tanggal penawaran, Berlaku sampai, Cara pembayaran, Garansi 1 tahun, Dibuat oleh = nama sales, Disetujui oleh kosong.
- Tabel barang: 2 baris dengan Spesifikasi, Jumlah "3 roll" dan "1 paket", Harga satuan, Diskon Rp 300.000 dan "—", Jumlah harga; Subtotal, Diskon, PPN 11%, Total seperti B1.
- Kartu **Rencana penagihan** (DP 50%, Pelunasan 50%), **Syarat dan catatan**, **Riwayat status**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Rencana penagihan harus 100%, dan batal ubah

Di detail SPH → **Ubah**. Semua kolom berisi nilai B1.
1. Ganti termin Pelunasan menjadi `40` → tulisan merah "Total termin 90%; harus tepat 100%." dan **Simpan** tidak bisa diklik.
2. Klik **Tambah termin** sampai ada 6 termin → tombol Tambah termin hilang. Hapus termin tambahan.
3. Klik **Batal**.

**Harus terlihat:** setelah Batal, detail SPH tetap 50% / 50% dan total Rp 5.772.000.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Cetak

Di detail SPH → **Cetak**, lalu tombol **Cetak** di halaman cetak.
**Harus terlihat:** judul di bar berwarna "QUOTATION KABEL JARINGAN"; Kepada Budi Hartono UAT, Up Bapak Budi Hartono, Hal = Perihal, Date, Ref = nomor, Payment = Cara pembayaran, Guaranty 1 tahun; 2 baris barang dengan spesifikasi; DISKON Rp 300.000; Sub Total, PPN 11%, Total Rp 5.772.000, Terbilang; Term of Condition berisi syarat. Tombol Cetak membuka dialog cetak browser. Tombol **Kembali ke daftar penawaran** ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Ajukan persetujuan

Klik **Ajukan persetujuan**.
**Harus terlihat:** "Penawaran diajukan"; status **Menunggu persetujuan**; tombol Ubah hilang; tidak ada tombol Setujui atau Tolak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Manajer menolak (login `sales_manager_seed`)

Menu **Penjualan → SPH** → buka SPH B1 → **Tolak**.
1. **Alasan ditolak** kosong → tombol **Tolak** di dialog tidak bisa diklik.
2. Isi `Harga jasa terlalu tinggi` → klik **Tolak**.

**Harus terlihat:** "Penawaran ditolak"; status **Ditolak**; tulisan "Alasan ditolak: Harga jasa terlalu tinggi"; Riwayat status bertambah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7. Buat revisi (login `sales_seed`)

Buka SPH B1 → **Buat revisi**. Terbuka revisi baru → **Ubah** → Baris 2 **Harga satuan (Rp)** `800000` → **Simpan** → **Ajukan persetujuan**.
**Harus terlihat:**
- "Revisi dibuat"; nomor revisi = nomor lama + `-R1`; status Draf sebelum diajukan; semua isian lain sama dengan B1.
- Setelah disimpan: Subtotal **Rp 5.300.000**, Diskon **− Rp 300.000**, PPN 11% **Rp 550.000**, Total **Rp 5.550.000**.
- Setelah diajukan: **Menunggu persetujuan**.
- Kartu **Revisi** berisi versi lama dengan status **Direvisi**. Versi lama tidak muncul lagi di daftar SPH.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8. Manajer menyetujui (login `sales_manager_seed`)

Buka revisi B7 → **Setujui**.
**Harus terlihat:** "Penawaran disetujui"; status **Disetujui**; Disetujui oleh = nama manajer. Muncul tombol **Buat sales order**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9. Tandai terkirim (login `sales_seed`)

Buka revisi B7 → **Tandai terkirim**.
**Harus terlihat:** "Penawaran ditandai terkirim"; status **Terkirim**; tombol **Buat sales order** dan **Buat revisi** tetap ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B10 ❓. SPH kedua tanpa PPN, ditandai batal

**Penawaran baru**: Pelanggan Budi Hartono UAT, **Up kosong**, Perihal `SPH batal UAT`, 1 baris Kabel UTP Cat6 UAT jumlah 1, **Kenakan PPN tidak dicentang** (kolom Tarif PPN hilang; PPN Rp 0; Total Rp 1.500.000), tanpa termin → **Simpan**.
**Harus terlihat dulu:** di detail, Up = Budi Hartono UAT (diisi otomatis), baris PPN bertuliskan "Tanpa PPN" Rp 0, Total Rp 1.500.000.

Lalu **Tandai batal**:

| Isian | Isi dengan |
|---|---|
| Alasan batal *(cek pilihan)* | Harga / Memilih kompetitor / Proyek dibatalkan / Tidak ada respons / Lainnya; bawaan **Harga**; pilih **Lainnya** |
| Keterangan | dulu kosong → tidak bisa disimpan (wajib untuk Lainnya); lalu isi `Pelanggan menunda` |

**Klik:** Tandai batal.
**Harus terlihat:** "Penawaran ditandai batal"; status **Batal**; tulisan "Alasan batal: Lainnya — Pelanggan menunda". Catatan: sales bisa menandai batal tanpa persetujuan (disengaja, perlu keputusan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B11. Keuangan hanya melihat SPH Deal (login `finance_seed`, setelah C1)

Menu **Penjualan → SPH**.
**Harus terlihat:** revisi B7 berstatus **Deal** terlihat; SPH B10 (Batal) dan SPH lain yang belum Deal **tidak** terlihat. Tidak ada tombol Penawaran baru.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Sales order dan surat jalan

### C1. Buat sales order (login `sales_seed`)

Buka revisi B7 (Terkirim) → tombol **Buat sales order**. Dialog berisi "Penawaran menjadi Deal; baris dan nilainya disalin ke sales order."

| Isian | Isi dengan |
|---|---|
| Nomor PO pelanggan (Opsional) | `PO-MJ-UAT-01`; petunjuk "Opsional: nomor purchase order dari pelanggan." |
| Tanggal order | hari ini (bawaan) |
| Rencana pengiriman (Opsional) | 3 hari dari hari ini (tanggal sebelum Tanggal order tidak bisa dipilih) |
| Catatan (Opsional) | `Kirim ke lantai 3` |

**Uji salah:** klik **Batal** dulu → tidak ada SO baru dan SPH tetap Terkirim. Buka dialog lagi dan isi seperti di atas.

**Klik:** Buat order.
**Harus terlihat:** "Sales order dibuat"; terbuka SO bernomor `…/SO/…`, status **Aktif**. Buka lagi SPH B7: status **Deal**, ada tombol "Sales order <nomor>", tombol Buat revisi hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2 ⚠️. Cek detail SO

Di detail SO C1, tekan F5.
**Harus terlihat:**
- Kartu **Pelanggan**: `CUS-… — Budi Hartono UAT`, Up Bapak Budi Hartono, Telepon, Nomor PO pelanggan PO-MJ-UAT-01.
- Kartu **Dokumen**: Tanggal order, Rencana pengiriman, Penawaran (nomor revisi, bisa diklik), Sales = nama sales, Cara pembayaran, Garansi.
- Tabel: 2 baris, kolom Terkirim 0, Subtotal Rp 5.300.000, Diskon − Rp 300.000, PPN 11% Rp 550.000, Total Rp 5.550.000.
- Kartu **Rencana penagihan** dan **Riwayat status** (Aktif).

**Temuan yang diperkirakan:** **Catatan** "Kirim ke lantai 3" tidak tampil di mana pun di detail SO.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Siapkan surat jalan (semua kolom, login `warehouse_seed`)

Menu **Penjualan → Surat Jalan** → **Buat surat jalan**.

**Pengiriman**

| Isian | Isi dengan |
|---|---|
| Pesanan penjualan *(cek pilihan)* | "Pilih sales order" dan SO yang masih punya sisa, format `nomor — pelanggan — perihal`; pilih **SO C1** |
| Gudang *(cek pilihan)* | "Pilih gudang" dan daftar gudang (`kode — nama`); pilih **WH-MAIN** |
| Lokasi simpan *(cek pilihan)* | terkunci sebelum gudang dipilih; lalu "Tanpa lokasi simpan khusus" dan rak WH-MAIN; pilih **R-01** |
| Tanggal kirim | hari ini (bawaan) |

**Penerima** (terisi dari SO; ubah sebagian)

| Isian | Isi dengan |
|---|---|
| Nama proyek | Perihal SPH (terisi) |
| Lokasi proyek | `Gedung Maju Jaya lantai 3` |
| Nama perusahaan / penerima | Budi Hartono UAT (terisi) |
| PIC / kontak | Bapak Budi Hartono (terisi) |
| Telp / email | terisi dari pelanggan |
| Alamat proyek | terisi alamat pelanggan; ganti `Jl. Merdeka No. 10, Jakarta Pusat` |

**Barang yang keluar**

| Barang | Jumlah | Keterangan (Opsional) |
|---|---|---|
| Kabel UTP Cat6 UAT (tertulis "sisa 3 roll") | `2` | `Roll 1 dan 2` |
| Jasa pemasangan kabel (tertulis "Bukan barang stok: hanya dicetak, tanpa pergerakan stok.") | kosongkan | kosongkan |

**Pengangkutan dan catatan**

| Isian | Isi dengan |
|---|---|
| Supir (Opsional) | `Slamet` |
| Nomor kendaraan (Opsional) | `B 1234 UAT` |
| Catatan (Opsional) | sudah berisi teks garansi bawaan "Garansi barang berlaku selama 1 (satu) tahun…"; biarkan |

**Uji salah:**
- Gudang belum dipilih, atau semua Jumlah kosong → **Siapkan surat jalan** tidak bisa diklik.
- Nama perusahaan / penerima dikosongkan → tidak bisa disimpan.
- **Batal** → kembali ke daftar, tidak ada surat jalan baru.

**Klik:** Siapkan surat jalan.
**Harus terlihat:** "Surat jalan disiapkan"; nomor `…/SJ/…`; status **Disiapkan**. Tekan F5: kartu Pengiriman berisi Pesanan penjualan, Pelanggan, Tanggal kirim, Gudang WH-MAIN, Lokasi simpan R-01, Supir "Slamet · B 1234 UAT"; kartu Penerima berisi semua isian di atas; tabel barang Kabel 2 roll dengan Keterangan "Roll 1 dan 2"; teks catatan garansi tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Jumlah melebihi sisa ditolak

**Buat surat jalan** lagi, pilih SO C1 dan WH-MAIN. Baris Kabel sekarang "sisa 1 roll". Isi Jumlah `2` → **Siapkan surat jalan**.
**Harus terlihat:** browser menolak (kolom tidak boleh lebih dari 1), surat jalan tidak tersimpan. Klik **Batal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Cetak lalu kirim

Buka surat jalan C3 → **Cetak** (cek isi, lalu **Kembali ke surat jalan**) → **Kirim** → di dialog klik **Kirim**.
**Harus terlihat:**
- Halaman cetak "SURAT JALAN BARANG" berisi No. Surat Jalan, Nama Proyek, Lokasi Proyek, Data Pengirim, Data Penerima, Kabel 2 roll dengan keterangan, Catatan garansi, kolom tanda tangan Supir / Pengirim / Penerima.
- Dialog berisi "Barang keluar dari stok dengan HPP rata-rata dan unit bernomor seri ditandai terjual. Tidak bisa dibatalkan."
- "Surat jalan dikirim"; status **Dikirim**; Dikirim pada terisi; tombol Batalkan surat jalan hilang.
- Menu **Inventaris → Barang → Stok**: Kabel di R-01 berkurang 2.
- Status SO dicek di C9 (Gudang tidak bisa membuka SO, lihat C10).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6. Tandai diterima

Klik **Tandai diterima**. Kolom **Diterima oleh** sudah terisi PIC (Bapak Budi Hartono).
1. Kosongkan → tombol **Tandai diterima** tidak bisa diklik.
2. Isi `Budi Hartono UAT` → klik **Tandai diterima**.

**Harus terlihat:** "Penerimaan dicatat"; status **Diterima**; Diterima oleh = Budi Hartono UAT. Muncul tombol **Retur barang** untuk pengguna yang berhak (bukan gudang).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7. Batalkan surat jalan yang disiapkan

**Buat surat jalan**: SO C1, WH-MAIN, R-01, Kabel `1` → **Siapkan surat jalan**. Lalu **Batalkan surat jalan** (dialog berisi "Hanya surat jalan yang disiapkan yang bisa dibatalkan; jumlahnya kembali ke sales order.").
1. **Alasan** kosong → tombol **Batalkan surat jalan** tidak bisa diklik.
2. Isi `Truk tidak tersedia` → klik **Batalkan surat jalan**.

**Harus terlihat:** "Surat jalan dibatalkan"; status **Dibatalkan**; tulisan "Alasan: Truk tidak tersedia"; stok Kabel tidak berubah; di form Buat surat jalan Kabel kembali "sisa 1 roll".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8 ⚠️. Kirim sisa terakhir

**Buat surat jalan** ketiga: SO C1, WH-MAIN, R-01, Kabel `1` → **Siapkan surat jalan** → **Kirim**.
**Harus terlihat:** status **Dikirim**; stok Kabel di R-01 berkurang 1.
**Temuan yang diperkirakan:** SO tetap **Diproses** (dicek di C9), tidak pernah menjadi Terkirim atau Selesai walau semua barang sudah dikirim.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9. Sales melihat SO (login `sales_seed`)

Menu **Penjualan → Sales order** → buka SO C1.
**Harus terlihat:** status **Diproses**; kolom Terkirim Kabel = 3; kartu **Surat jalan** berisi 3 surat jalan (Diterima, Dibatalkan, Dikirim); **tidak ada** tombol Buat surat jalan dan **tidak ada** tombol Batalkan order.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10 ⚠️. Gudang membuka SO dari surat jalan (login `warehouse_seed`)

Buka surat jalan C3 → klik nomor di **Pesanan penjualan**.
**Temuan yang diperkirakan:** muncul "Anda tidak memiliki akses ke halaman tersebut." dan kembali ke dasbor, karena Gudang tidak punya hak baca SO.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C11. Manajer membatalkan SO tanpa surat jalan

Siapkan dulu: `sales_seed` membuat **Penawaran baru** (Budi Hartono UAT, Perihal `SPH untuk SO batal UAT`, 1 baris Kabel jumlah 1) → **Simpan** → **Ajukan persetujuan**. `sales_manager_seed` buka SPH itu → **Setujui** → **Buat sales order** → **Buat order**.

Lalu `sales_manager_seed` di SO baru → **Batalkan order**. Dialog berisi "Penawaran kembali ke status disetujui atau terkirim dan bisa dijadikan order lagi."
1. **Alasan pembatalan** kosong → tombol **Batalkan order** tidak bisa diklik.
2. Isi `Pelanggan membatalkan` → klik **Batalkan order**.

**Harus terlihat:** "Sales order dibatalkan"; status **Dibatalkan**; tulisan "Alasan pembatalan: Pelanggan membatalkan"; tombol Batalkan order hilang; SPH-nya kembali **Disetujui** dengan tombol Buat sales order.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Invoice dan pembayaran (login `finance_seed`)

### D1. Buat invoice DP (semua kolom)

Menu **Penjualan → Sales order** → buka SO C1 → kartu **Penagihan** (Sudah ditagih Rp 0, Sudah dibayar Rp 0, Sisa tagihan Rp 0, Belum ditagih Rp 5.550.000) → **Buat invoice**. Dialog berisi "Sisa yang belum ditagih pada order ini: Rp 5.550.000. Nilai pastinya dihitung oleh server."

| Isian | Isi dengan |
|---|---|
| Yang ditagih *(cek pilihan)* | Termin rencana berikutnya: DP / Persentase dari order / Nominal tetap (termasuk PPN) / Seluruh sisa; bawaan **Termin rencana berikutnya: DP** |
| Termin tagihan (Opsional) | `DP 50% kabel jaringan`; petunjuk "Dicetak sebagai termin, mis. DP 30%. Kosongkan untuk bawaan." |
| Jatuh tempo (Opsional) | 7 hari dari hari ini |

**Klik:** Buat draf.
**Harus terlihat:** "Draf invoice dibuat"; terbuka invoice bernomor `…/INV/…` (nomor langsung ada walau masih draf); lencana **Draf** dan **Uang muka**; kartu Nilai: Tanggal terbit kosong, Jatuh tempo +7 hari, DPP **Rp 2.500.000**, PPN 11% **Rp 275.000**, Total invoice **Rp 2.775.000**, Sisa tagihan Rp 2.775.000.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Terbitkan dan cek detail

Klik **Terbitkan invoice**.

| Isian | Isi dengan |
|---|---|
| Tanggal terbit | hari ini (bawaan) |
| Jatuh tempo | 14 hari dari hari ini (tanggal sebelum Tanggal terbit tidak bisa dipilih) |

**Klik:** Simpan.
**Harus terlihat:** "Invoice diterbitkan"; status **Terbit**; tombol Terbitkan hilang, muncul **Catat pembayaran** dan **Void invoice**. Tekan F5: kartu **Ditujukan kepada** berisi Pelanggan Budi Hartono UAT, Up, Sales order (nomor, bisa diklik), Referensi penawaran (nomor revisi); kartu **Nilai** berisi Tanggal terbit hari ini, Jatuh tempo +14 hari, DPP, PPN, Total, Sisa tagihan Rp 2.775.000; Termin tagihan "DP 50% kabel jaringan". **Cetak** membuka invoice yang bisa dicetak dengan angka yang sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Bayar sebagian (semua kolom)

Klik **Catat pembayaran**. Nominal sudah terisi sisa tagihan.

| Isian | Isi dengan |
|---|---|
| Nominal (Rp) | `1000000` |
| Tanggal terima | hari ini (bawaan) |
| Metode *(cek pilihan)* | Transfer / Tunai / Kartu / Dompet digital / Cek/Giro; bawaan **Transfer** |
| Referensi (Opsional) | `TRF-UAT-001` |

**Klik:** Simpan.
**Harus terlihat:** "Pembayaran dicatat"; tabel **Pembayaran diterima** berisi Nomor kwitansi `…/KW/…`, Tanggal terima, Metode Transfer, Referensi TRF-UAT-001, Nominal Rp 1.000.000; status **Dibayar sebagian**; Sisa tagihan **Rp 1.775.000**; tombol Void invoice hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4 ⚠️. Uji salah pembayaran

**Catat pembayaran**:
1. Nominal (Rp) `2000000` → **Simpan** → ditolak "Pembayaran melebihi sisa tagihan".
2. Nominal (Rp) dikosongkan → tidak bisa disimpan.
3. Nominal (Rp) diketik huruf → huruf tidak masuk.
4. Nominal (Rp) `0` → **Simpan**.

**Harus terlihat:** 1–3 tidak menyimpan kwitansi. **Temuan yang diperkirakan** untuk 4: kwitansi Rp 0 **tersimpan** (server menerima nominal nol). Bila tersimpan, batalkan kwitansi Rp 0 itu (seperti D8) sebelum lanjut.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. Lunasi

**Catat pembayaran** → Nominal (Rp) `1775000` (sudah terisi), Metode **Tunai**, Referensi `KAS-UAT-002` → **Simpan**.
**Harus terlihat:** status **Lunas**; Sisa tagihan Rp 0; 2 kwitansi (Transfer dan Tunai); tombol Catat pembayaran hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6. Invoice berikutnya: uji salah, lalu seluruh sisa

Kembali ke SO C1 → kartu **Penagihan**: Sudah ditagih Rp 2.775.000, Sudah dibayar Rp 2.775.000, Sisa tagihan Rp 0, Belum ditagih Rp 2.775.000 → **Buat invoice**. Bawaan Yang ditagih sekarang "Termin rencana berikutnya: Pelunasan".

**Uji salah:**
- Yang ditagih **Nominal tetap (termasuk PPN)** → kolom **Nominal termasuk PPN (Rp)** muncul dengan petunjuk "Nominal dipecah menjadi DPP dan PPN."; isi `3000000` → **Buat draf** → ditolak "Termin melebihi sisa yang belum ditagih".
- Yang ditagih **Persentase dari order** → kolom **Persentase (%)**; isi `150` → ditolak browser (maksimal 100); isi `0` → ditolak browser.

Lalu Yang ditagih **Seluruh sisa**, Termin tagihan kosong, Jatuh tempo kosong → **Buat draf**.
**Harus terlihat:** lencana **Pelunasan**; Termin tagihan "Pelunasan"; DPP Rp 2.500.000, PPN Rp 275.000, Total invoice tepat **Rp 2.775.000** (tanpa selisih pembulatan). Di SO C1, tombol Buat invoice hilang (Belum ditagih Rp 0).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7. Void invoice

Di invoice D6 (masih Draf) → **Void invoice**.
1. **Alasan** kosong → **Simpan** → ditolak browser (wajib).
2. Isi `Salah tanggal tagih` → **Simpan**.

**Harus terlihat:** "Invoice di-void"; status **Void**; tulisan "Alasan void: Salah tanggal tagih"; tidak ada tombol Terbitkan, Catat pembayaran, atau Void. Di SO C1, Belum ditagih kembali Rp 2.775.000 dan tombol Buat invoice muncul lagi. Invoice Lunas D1 tidak punya tombol Void.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D8. Batalkan satu kwitansi

Buka invoice D1 → tabel **Pembayaran diterima** → baris Rp 1.775.000 → **Batalkan**.
1. **Alasan** kosong → **Simpan** → ditolak browser.
2. Isi `Kas tercatat ganda` → **Simpan**.

**Harus terlihat:** "Kwitansi dibatalkan"; baris itu dicoret dan tombol Batalkan-nya hilang; status invoice kembali **Dibayar sebagian**; Sisa tagihan Rp 1.775.000; tombol Catat pembayaran muncul lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D9. Daftar Faktur dan Kuitansi

1. Menu **Penjualan → Faktur**. Judul halaman "Invoice". Filter Status *(cek pilihan)*: Semua status / Draf / Terbit / Dibayar sebagian / Lunas / Void / Dibatalkan. Centang **Hanya yang lewat jatuh tempo**. Cari nomor invoice D1.
2. Menu **Penjualan → Kuitansi**. Judul halaman "Kwitansi". Cari `TRF-UAT-001`.

**Harus terlihat:** daftar invoice berisi D1 (Dibayar sebagian, Sisa tagihan Rp 1.775.000) dan D6 (Void) dengan kolom Nomor invoice, Pelanggan, Termin tagihan, Jatuh tempo, Status, Total invoice, Sisa tagihan; filter Lunas mengosongkan D1; centang lewat jatuh tempo tidak memunculkan D1. Daftar kwitansi berisi 2 kwitansi D1, yang dibatalkan berlencana **Dibatalkan**, dengan kolom Nomor kwitansi, Nomor invoice, Pelanggan, Tanggal terima, Metode, Nominal.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D10. Sales tidak melihat penagihan (login `sales_seed`)

Buka SO C1.
**Harus terlihat:** kartu **Penagihan** tidak ada. Menu Faktur dan Kuitansi tidak tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D11 ⚠️. Menu Uang Muka (login `admin`)

Cari menu **Penjualan → Uang Muka**, lalu buka alamat http://localhost:5173/sales/down-payments.
**Temuan yang diperkirakan:** menu tidak tampil untuk siapa pun, termasuk Pemilik; membuka alamatnya memunculkan "Anda tidak memiliki akses ke halaman tersebut." dan kembali ke dasbor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## E. Retur penjualan

### E1 🔧. Tombol Retur barang (login `sales_seed`)

Menu **Penjualan → Retur Penjualan**.
**Harus terlihat:** tombol **Retur barang** muncul dan membuka halaman "Retur barang" *(diperbaiki 2026-11-24)*.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Buat retur dari surat jalan (semua kolom)

Menu **Penjualan → Surat Jalan** → buka surat jalan C3 (Diterima) → tombol **Retur barang**. Halaman berisi "Pilih surat jalan tempat barang keluar, barang yang kembali, dan alasannya…".

**Retur**

| Isian | Isi dengan |
|---|---|
| No. surat jalan *(cek pilihan)* | "Pilih surat jalan" dan surat jalan terkirim yang masih bisa diretur; terpilih **surat jalan C3** |
| Tanggal retur | hari ini (bawaan) |
| Alasan | `Kabel tertekuk saat datang`; petunjuk "Keluhan pelanggan, mis. rusak atau salah tipe." |

**Barang yang kembali**

| Barang | Jumlah diretur |
|---|---|
| Kabel UTP Cat6 UAT · UAT-KBL-01 · "bisa diretur 2 roll" | `1` |

| Isian | Isi dengan |
|---|---|
| Catatan | `Foto kerusakan dikirim lewat WhatsApp` |

**Uji salah:**
- Alasan kosong, atau Jumlah diretur kosong → **Simpan draf** tidak bisa diklik.
- Jumlah diretur `3` → ditolak browser (maksimal 2).
- **Batal** → tidak ada retur baru.

**Klik:** Simpan draf.
**Harus terlihat:** "Retur penjualan disimpan"; judul "Belum bernomor"; status **Draf**. Tekan F5: Alasan tampil di bawah judul; kartu Retur berisi No. surat jalan (C3), Pesanan penjualan (SO) C1, Pelanggan, Tanggal retur, Gudang WH-MAIN; tabel Kabel jumlah 1 dengan Jumlah; Total harga jual terisi; Catatan tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Ubah retur

Di retur E2 → **Ubah**. Judul "Ubah retur penjualan".
**Harus terlihat dulu:** **No. surat jalan** terkunci; kolom lain berisi nilai E2.

Ubah **Catatan** menjadi `Foto kerusakan sudah diterima` → **Simpan draf**.
**Harus terlihat:** "Retur penjualan disimpan"; Catatan baru tampil di detail; jumlah tetap 1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4. Ajukan, tolak, ajukan lagi, setujui

1. `sales_seed`: **Ajukan persetujuan** → "Diajukan untuk disetujui"; status **Menunggu persetujuan**; tidak ada tombol Setujui.
2. `sales_manager_seed`: menu **Penjualan → Retur Penjualan** → buka retur → **Tolak**. **Alasan** kosong → tombol **Simpan** tidak bisa diklik. Isi `Lampirkan foto dulu` → **Simpan**.
3. `sales_seed`: retur kembali **Draf** dengan tulisan "Ditolak karena: Lampirkan foto dulu" → **Ajukan persetujuan**.
4. `sales_manager_seed`: buka retur → **Setujui**.

**Harus terlihat:** setelah 2: "Retur penjualan ditolak". Setelah 4: "Retur penjualan disetujui"; nomor `…/RTJ/…` muncul (nomor diberikan saat disetujui); status **Disetujui**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Gudang menerima, layak jual (login `warehouse_seed`)

Buka retur → **Terima barang**. Dialog berisi "Periksa setiap baris: barang layak jual masuk stok, yang rusak ditandai rusak…".

| Isian | Isi dengan |
|---|---|
| Tanggal terima | hari ini (bawaan) |
| Kabel UTP Cat6 UAT → Kondisi *(cek pilihan)* | Layak jual / Rusak; bawaan **Layak jual** |
| Kabel UTP Cat6 UAT → Lokasi penyimpanan *(cek pilihan)* | "Tanpa lokasi khusus" dan rak WH-MAIN; pilih **R-01** |

**Klik:** Terima barang.
**Harus terlihat:** "Retur penjualan diterima"; status **Diterima**; tulisan "Sudah diterima: barang kembali ke stok dan SO menunggu pengiriman barang pengganti."; kolom Kondisi Layak jual; stok Kabel di R-01 bertambah 1. Dengan `sales_seed`: SO C1 tetap **Diproses**, kolom Terkirim Kabel turun dari 3 menjadi 2.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E6 ⚠️. Retur dengan kondisi Rusak

Ulangi E2, E4 (tanpa tolak), dan E5 untuk sisa 1 roll dari surat jalan C3 (Alasan `Jaket kabel sobek`), tetapi saat **Terima barang** pilih **Kondisi: Rusak** dan **Lokasi penyimpanan: Tanpa lokasi khusus**.
**Harus terlihat:** status **Diterima**; kolom Kondisi di detail = Rusak.
**Temuan yang diperkirakan:** untuk barang tanpa nomor seri seperti Kabel, stok tetap **bertambah 1 dan bisa dijual lagi**. Tanda "rusak" hanya ada di catatan mutasi (`· damaged`). Hanya unit bernomor seri yang benar-benar ditandai rusak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E7. Batalkan retur

`sales_seed`: buat retur dari surat jalan C8 (Kabel 1 roll), Alasan `Salah input`, Jumlah diretur `1` → **Simpan draf** → **Batalkan retur**.
1. **Alasan** kosong → tombol **Simpan** tidak bisa diklik.
2. Isi `Retur tidak jadi` → **Simpan**.

**Harus terlihat:** "Retur penjualan dibatalkan"; status **Dibatalkan**; tulisan "Dibatalkan karena: Retur tidak jadi"; stok dan SO tidak berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Catatan penyusun

**Pemetaan nomor langkah lama → baru** (versi 2026-11-25 sebelumnya → versi ini):

| Lama | Baru | Lama | Baru |
|---|---|---|---|
| A1 | A1 | C1 | C1 |
| A2 | A4 | C2 | C3 |
| A3 | A6 | C3 | C4 |
| A4 | A8 | C4 | C5 |
| A5 | A11 + A12 | C5 | C6 |
| A6 | A14 | C6 | C7 |
| A7 | A15 | C7 | C8 |
| A8 | A17 | C8 | C9 |
| B1 | B1 | C9 | C10 |
| B2 | B3 | C10 | C11 |
| B3 | B4 | D1–D8 | D1–D8 |
| B4 | B5 | D9 | D10 |
| B5 | B6 | D10 | D11 |
| B6 | B7 | E1, E2 | E1, E2 |
| B7 | B8 | E3 | E4 |
| B8 | B9 | E4 | E5 |
| B9 | B10 | E5 | E6 |
| B10 | B11 | | |

Langkah baru: A2, A3, A5, A7, A9, A10, A13, A16, B2, C2, D9, E3, E7.

**Perbedaan dengan dokumen lama** (kode yang diikuti):
- Tombol Tambah kontak hanya ada di detail perusahaan, tidak di detail orang (`apps/web-admin/src/routes/_authed/crm/customers/$customerId.tsx:404-410`).
- Setelah invoice "Seluruh sisa" order sudah tertagih penuh, jadi yang di-void adalah draf itu (`apps/web-admin/src/components/finance/billing-card.tsx:58`).
- Gudang tidak bisa membuka SO, jadi status SO dicek oleh sales (C9).
- Pembatalan SO perlu SPH ketiga yang disetujui (C11).
- Nomor dokumen memakai pola `0001/QT/<kode>/XI/26`, `…/SO/…`, `…/SJ/…`, `…/INV/…`, `…/KW/…`, `…/RTJ/…` (`apps/backend/src/shared/numbering/domain.ts:140`).

**Temuan dari pembacaan kode:**
- Retur "Rusak" untuk barang tanpa nomor seri tetap menambah stok jual (`apps/backend/src/app/sale/services/sales-return.service.ts:431-446`). Lihat E6.
- Kwitansi bernominal Rp 0 diterima server: `minorAmount` hanya `nonnegative` (`apps/backend/src/app/finance/contracts/ledger.contract.ts:15-19`, dipakai di `apps/backend/src/app/sale/contracts/invoice.contract.ts:142`; cek di `apps/backend/src/app/sale/services/invoice.service.ts:446` hanya batas atas). Lihat D4.
- Catatan sales order disimpan tetapi tidak ditampilkan di detail SO (`apps/web-admin/src/components/sales/create-order-dialog.tsx:89-90`; tidak ada di `apps/web-admin/src/routes/_authed/sales/orders/$orderId.tsx`). Lihat C2.
- Daftar alamat pelanggan tidak menampilkan provinsi/kabupaten/kecamatan/desa yang dipilih, hanya alamat dan kode pos; alamat juga tidak bisa diubah, hanya ditambah atau dihapus (`apps/web-admin/src/routes/_authed/crm/customers/$customerId.tsx:111-118`).
- Pesan validasi dari zod tidak diterjemahkan, kemungkinan tampil dalam bahasa Inggris (`apps/backend/src/http/plugin.ts:128-146`; aturan NPWP tanpa pesan di `apps/backend/src/app/customer/contracts/customer.contract.ts:59-66`).
- Menu Uang Muka tanpa izin, jadi tersembunyi dan halamannya ditolak untuk semua orang (`apps/web-admin/src/components/sidebar/nav-config.ts`, item `downPayments`; `apps/web-admin/src/lib/route-guard.ts:31-55`).
- SO tidak pernah Terkirim/Selesai setelah semua barang dikirim (`apps/backend/src/app/sale/services/delivery-note.service.ts:79`).
- Label menu dan judul halaman berbeda: Prospek / "Daftar lead", SPH / "Penawaran (SPH)", Faktur / "Invoice", Kuitansi / "Kwitansi" (`packages/locales/src/id/nav.ts:30-35`, `packages/locales/src/id/finance.ts:8,19`).
- Kolom opsional tanpa tanda "(Opsional)": Jatuh tempo di dialog Terbitkan invoice (`apps/web-admin/src/routes/_authed/sales/invoices/$invoiceId/index.tsx:310`), Berlaku sampai di SPH (`apps/web-admin/src/components/sales/quotation-form.tsx:300`), Lokasi simpan di surat jalan (`apps/web-admin/src/routes/_authed/sales/deliveries/new.tsx`), Catatan di retur (`apps/web-admin/src/components/sales/sales-return-form.tsx:230`). Ini sebabnya beberapa kolom di tabel isian ditulis tanpa "(Opsional)".
- Label tidak terhubung ke kolomnya di form retur (`htmlFor` `rt-*`, `id` `srt-*`), jadi klik label tidak memfokuskan kolom (`apps/web-admin/src/components/sales/sales-return-form.tsx:157-158, 214-215, 230-231`).
- Jadikan Pelanggan tidak menampilkan dialog "Akun pelanggan dibuat"; data login hanya lewat email (`apps/web-admin/src/components/crm/convert-lead-dialog.tsx`), berbeda dengan Orang baru / Tambah kontak.
- Di form Orang baru, memilih "Perusahaan terdaftar" tanpa memilih perusahaan tetap tersimpan sebagai perorangan tanpa peringatan (`apps/web-admin/src/components/crm/customer-form-dialog.tsx:101`).
- Estimasi nilai lead dan nominal uang lain tidak punya batas atas di form (`apps/web-admin/src/lib/money-input.ts:26-41`).
- Tetap dari versi sebelumnya: sales bisa menandai SPH Batal tanpa persetujuan (B10); hak "sales_discount" dan "sales_order.approve" ada di role tetapi tidak dipakai; invoice draf sudah bernomor, jadi nomor draf yang di-void tetap terpakai (teks "Draf (belum bernomor)" di `packages/locales/src/id/finance.ts:25` praktis tidak pernah tampil).

---

## Ringkasan

Sesuai: ___ dari 57 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M02:** lulus / belum lulus (coret salah satu)

Catatan penguji:
