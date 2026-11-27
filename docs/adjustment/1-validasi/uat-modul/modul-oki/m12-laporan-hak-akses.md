# UAT M12 - Laporan & Hak Akses (T02, T30)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** masuk/keluar → undang pengguna → klaim undangan → siklus akun (nonaktifkan, pulihkan) → akun dan profil sendiri → organisasi, anggota, dan peran (termasuk role gabungan) → log audit → profil perusahaan → nomor kode → arsip dan laporan keuangan → menu yang tampil per role → hapus akun uji.

Disusun 2026-11-26 dari form aslinya di kode (`apps/web-admin/src/routes/_authed/admin`, `organizations`, `settings`, `reports`, halaman `/login`, `/invite/:token`, `/accounts`, `/profiles`) dan teks bahasa Indonesia di `packages/locales/src/id`. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, sakelar, dan gambar. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Letak menu.** Sidebar tidak punya bagian bernama "Laporan & Hak Akses". Isi modul ini tersebar di: **Laporan** (Arsip Bulanan), **Administrasi** (Organisasi, Pengguna, Log Audit), **Pengaturan** (Perusahaan, Nomor Kode), dan menu akun di kiri bawah (profil, Akun, Keluar).

**Status:**

| Data | Status |
|---|---|
| Akun pengguna | Tertunda (diundang, belum klaim) → Aktif → Dinonaktifkan → Aktif lagi (Pulihkan), atau Dihapus |
| Undangan | tertunda → diklaim, atau dibatalkan / dihapus / kedaluwarsa (berlaku 3 hari) |
| Arsip laporan bulanan | dibuat sekali per bulan setelah periode ditutup; tidak berubah lagi |

**Data contoh yang dibuat selama UAT:**

| Data | Nilai |
|---|---|
| Pengguna uji | Budi UAT, email `budi.uat@contoh.test`, role Penjualan, Karyawan tetap |
| Akun Budi setelah klaim | nama pengguna `budi_uat`, kata sandi `BudiUat123`, telepon Indonesia `812 3456 7801` |
| Data diri Budi | NIK `3201010101900001`, lahir di `Bogor` tanggal 1 Januari 1990, Laki-laki, Belum menikah, alamat `Jl. Uji Coba No. 1`, kode pos `16122` |
| Undangan massal | `uat.tim1@contoh.test` (Teknisi + Gudang), `uat.tim2@contoh.test` (Keuangan) |
| Undangan untuk dibatalkan | `uat.batal@contoh.test`, nama `UAT Batal` |
| Anggota untuk uji role gabungan | `technician_seed` (Teknisi), ditambah sementara Gudang |
| Nilai asli profil perusahaan | catat sebelum G1: ________ (dikembalikan di akhir G1) |
| Pola asli Penawaran (SPH) | catat sebelum H2: ________ (dikembalikan di akhir H2) |

**Akun uji.** `admin` = Pemilik dan admin aplikasi (password di `apps/backend/.env`, `INITIAL_ADMIN_PASSWORD`; jangan ditulis di dokumen). Akun lain `<role>_seed` / `<role>123456`. Email undangan dan reset masuk ke Mailpit (http://localhost:8025). Bahasa layar harus **Bahasa Indonesia**.

***

## A. Masuk dan keluar

### A1. Masuk dengan nama pengguna

Buka http://localhost:5173/login.

| Isian | Isi dengan |
|---|---|
| Email atau username | `finance_seed` |
| Kata sandi | `finance123456` |

**Uji salah** (sebelum isian di atas):

- Kedua kolom kosong → tidak bisa dikirim (browser menandai kolom wajib).
- `finance_seed` dengan kata sandi `salah123` → ditolak dengan pesan merah di atas form. ⚠️ Untuk masuk dengan nama pengguna, pesan dari server kemungkinan masih bahasa Inggris ("Invalid username or password"); catat teks persisnya.
- Nama pengguna yang tidak ada `tidakada_uat` → pesan yang **sama** dengan kata sandi salah (tidak membocorkan akun mana yang ada).

**Klik:** Masuk.\
**Harus terlihat:** judul "Selamat datang kembali", tombol berubah "Sedang masuk…", lalu masuk ke Dasbor. Ada juga tautan "Lupa kata sandi Anda?", pemisah "Atau lanjutkan dengan", tombol "Masuk dengan Google", dan label "Terakhir dipakai" pada cara masuk yang terakhir dipakai.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Masuk dengan email

Keluar dulu (A3), lalu buka `/login`.

| Isian | Isi dengan |
|---|---|
| Email atau username | `accountant.seed@entragate.local` |
| Kata sandi | `accountant123456` |

**Uji salah:**

- Email yang sama dengan kata sandi salah → "Email atau kata sandi tidak valid".

**Klik:** Masuk.\
**Harus terlihat:** masuk ke Dasbor dengan kartu untuk Akuntan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Keluar dan kembali ke halaman yang dituju

Klik nama pengguna di kiri bawah sidebar → **Keluar**. Lalu ketik alamat http://localhost:5173/settings/company.

**Klik:** masuk lagi sebagai `admin`.\
**Harus terlihat:** setelah Keluar, halaman login tampil. Membuka `/settings/company` tanpa sesi mengarah ke login; setelah masuk, langsung terbuka **Profil Perusahaan** (bukan Dasbor). Menekan tombol Back browser setelah keluar tidak menampilkan data akun sebelumnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## B. Undangan (login `admin`)

### B1. Undang satu pengguna

Menu **Administrasi → Pengguna** → tombol **Undang pengguna**. Dialog "Undang pengguna" dengan keterangan "Undangan bersifat sekali pakai, kedaluwarsa dalam 3 hari, dan merupakan satu-satunya cara membuat akun."

| Isian | Isi dengan |
|---|---|
| Karyawan tetap (sakelar) | menyala (bawaan), teks di sampingnya "Tetap"; matikan sebentar → "Kontrak", lalu nyalakan lagi |
| Tab *(cek pilihan)* | Tunggal / Tempel massal / Unggah file; pilih **Tunggal** |
| Email | `budi.uat@contoh.test` |
| Nama | `Budi UAT` |
| Organisasi *(cek pilihan)* | daftar organisasi + "Tanpa organisasi (tingkat aplikasi)"; pilih **Entragate** |
| Peran *(cek pilihan)* | Admin, Anggota, Manajer Operasional, Manajer Penjualan, Penjualan, Manajer Proyek, Teknisi, Pekerja Lepas, Pembelian, Gudang, Keuangan, Akuntan, Sumber Daya Manusia, Layanan Pelanggan, Pemasaran, Auditor (tanpa Pemilik); bawaan Anggota; pilih **Penjualan** |

**Uji salah** (sebelum isian di atas disimpan):

- Email kosong → "Email wajib diisi".
- Nama kosong → "Nama wajib diisi". ⚠️ Label kolom Nama bertanda opsional, padahal wajib.
- Email `budi.uat@` (format salah) → harus ditolak. ⚠️ Form tidak memeriksa format di browser; catat pesan dari server.
- Klik **Batal** → dialog tertutup, tidak ada undangan.

**Klik:** Kirim undangan.\
**Harus terlihat:** "Undangan terkirim"; di kartu **Undangan tertunda** muncul `budi.uat@contoh.test` dengan status "tertunda" dan Kedaluwarsa "(3h lagi)". Email undangan masuk ke Mailpit. Kirim lagi undangan ke email yang sama → "Sudah ada undangan tertunda untuk email ini".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Kirim ulang, batalkan, dan hapus undangan

Buat undangan Tunggal ke `uat.batal@contoh.test`, nama `UAT Batal`, organisasi Entragate, peran Anggota. Di kartu **Undangan tertunda**, buka menu tindakan baris itu.

| Isian | Isi dengan |
|---|---|
| Tindakan *(cek pilihan)* | Kirim ulang / Batal / Hapus |

**Klik:** berurutan **Kirim ulang**, lalu **Batal**; buat undangan baru ke email yang sama, lalu **Hapus**.\
**Harus terlihat:** Kirim ulang → "Undangan dikirim ulang (tautan lama dibatalkan)"; di Mailpit ada email kedua, dan tautan dari email pertama membuka halaman "Undangan tidak tersedia". Batal → "Undangan dibatalkan", baris hilang dari daftar tertunda. Hapus → "Undangan dihapus".\
❓ Hapus langsung terjadi tanpa dialog konfirmasi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Klaim undangan dan buat akun

Keluar. Buka email undangan Budi di Mailpit → klik tautannya (`/invite/<token>`). Judul "Siapkan akun Anda", keterangan "Hai Budi UAT — undangan ini untuk budi.uat@contoh.test. …".

| Isian | Isi dengan |
|---|---|
| Nama pengguna | `budi_uat` (muncul "Nama pengguna tersedia.") |
| Kata sandi | `BudiUat123` |
| Nomor telepon: Kode negara *(cek pilihan)* | daftar negara (bisa dicari); pilih Indonesia |
| Nomor telepon: nomor | `812 3456 7801` |
| **Data diri** (keterangan "Dipakai untuk data karyawan dan Perjanjian Kerja Anda.") | |
| Nomor KTP (NIK) | `3201010101900001` |
| Tempat lahir | `Bogor` |
| Tanggal lahir | 1 Januari 1990 |
| Jenis kelamin *(cek pilihan)* | Laki-laki / Perempuan; pilih **Laki-laki** |
| Status pernikahan (opsional) *(cek pilihan)* | — / Belum menikah / Menikah / Cerai hidup / Cerai mati; pilih **Belum menikah** |
| Alamat domisili | `Jl. Uji Coba No. 1` |
| Provinsi | Jawa Barat |
| Kabupaten / kota | Kota Bogor |
| Kecamatan | Bogor Tengah |
| Desa / kelurahan | kelurahan pertama di daftar |
| Kode pos | `16122` |

**Uji salah** (satu per satu, sebelum isian benar):

- Nama pengguna `ab` → "Gunakan 3-30 huruf, angka, tanda hubung, atau garis bawah."
- Nama pengguna `budi-uat` (tanda hubung) → ⚠️ ditolak dengan pesan yang sama, padahal pesannya menyebut tanda hubung boleh.
- Nama pengguna `admin` → "Nama pengguna sudah digunakan."
- Kata sandi `Budi123` (7 karakter) → "Kata sandi minimal 8 karakter."
- Nomor telepon kosong atau `12` → "Masukkan nomor telepon yang valid."
- NIK 15 digit `320101010190000` → "NIK terdiri dari 16 digit." (huruf yang diketik di NIK langsung terhapus).
- Tanggal lahir kosong → "Isi tempat dan tanggal lahir."
- Jenis kelamin tidak dipilih → "Pilih jenis kelamin."
- Desa / kelurahan tidak dipilih → "Isi alamat dan pilih kelurahan/desa."
- Kode pos `1612` → "Kode pos terdiri dari 5 digit."

**Klik:** Buat akun.\
**Harus terlihat:** tombol "Membuat akun…", lalu Budi langsung masuk ke ERP dan melihat Dasbor untuk role Penjualan (Inventaris dan Langganan). Buka lagi tautan yang sama → "Undangan tidak tersedia" dengan keterangan "Tautan undangan ini tidak valid, kedaluwarsa, atau sudah pernah digunakan. …" dan tombol "Kembali ke halaman masuk".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Undangan tempel massal dengan beberapa peran

Login `admin`. Menu **Administrasi → Pengguna** → **Undang pengguna** → tab **Tempel massal**.

| Isian | Isi dengan |
|---|---|
| Karyawan tetap (sakelar) | menyala |
| Baris (maksimal 100) | dua baris: `uat.tim1@contoh.test, UAT Tim Satu, entragate, technician\|warehouse` dan `uat.tim2@contoh.test, UAT Tim Dua, entragate, finance` |
| Peran bawaan (opsional) *(cek pilihan)* | daftar peran yang sama dengan B1; biarkan Anggota |

Petunjuk di bawah kolom harus berbunyi "Satu per baris: email, nama, kode organisasi, peran. Kosongkan kode organisasi untuk mengundang tanpa organisasi. …". Beberapa peran digabung dengan tanda `|`.

**Uji salah:**

- Baris `uat.tim3@contoh.test, UAT Tim Tiga, kodesalah, member` → baris itu gagal dengan pesan yang menyebut kodenya; baris lain tetap dikirim.
- Baris dengan peran `owner` → baris itu ditolak (peran Pemilik tidak bisa diundang).
- Kolom kosong → "Tidak ada baris valid untuk dikirim."
- 101 baris → ditolak dengan batas 100 baris.

**Klik:** Kirim undangan.\
**Harus terlihat:** "2 undangan terkirim" (atau "<n> terkirim, <m> gagal" bila uji salah ikut terkirim, dengan daftar baris yang gagal di dialog). Kedua email ada di **Undangan tertunda**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Unggah file undangan

Menu **Administrasi → Pengguna** → **Undang pengguna** → tab **Unggah file**.

| Isian | Isi dengan |
|---|---|
| Lembar kerja (.csv atau .xlsx, maks 100 baris) | file templat yang diunduh, diisi satu baris `uat.tim4@contoh.test`, `UAT Tim Empat`, `entragate`, `member`, `permanent` |

Petunjuk kolom: "Kolom: email, name, organizationSlug, role, employmentType. Hanya email dan nama yang wajib; …".

**Uji salah:**

- File lebih dari 1 MB → "Ukuran file melebihi 1 MB".
- Templat tanpa baris data → "File tidak berisi baris data".
- File gambar diganti nama menjadi `.xlsx` → "File tidak dapat dibaca".

**Klik:** **Unduh templat (.xlsx)** dan **Unduh templat (.csv)** (keduanya terunduh), pilih file, lalu **Kirim undangan**.\
**Harus terlihat:** setelah file dipilih: "1 baris siap dikirim"; setelah kirim: "1 undangan terkirim".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## C. Siklus akun di halaman Pengguna (login `admin`)

### C1. Daftar, pencarian, dan filter

Menu **Administrasi → Pengguna**. Judul "Pengguna", keterangan "Siklus akun, peran, dan undangan tertunda untuk organisasi ini."

| Isian | Isi dengan |
|---|---|
| Cari | `budi` lalu Enter |
| Filter → Status *(cek pilihan)* | Semua status / Tertunda / Aktif / Dinonaktifkan; pilih **Aktif** |
| Filter → Organisasi *(cek pilihan)* | Semua organisasi + daftar organisasi; pilih **Entragate** |

**Klik:** Terapkan; lalu Atur ulang.\
**Harus terlihat:** kolom Pengguna, Status, Peran organisasi, Dibuat, Bergabung. Hasil pencarian hanya Budi UAT dengan status "Aktif" dan peran "Entragate (Penjualan)". Tombol Filter menampilkan "2 aktif" setelah diterapkan. Akun `admin` berlabel "admin aplikasi". Undangan B4 berstatus "Tertunda". Atur ulang mengembalikan semua pengguna; jumlah "<n> pengguna" di kartu Akun. Pencarian tanpa hasil → "Pengguna tidak ditemukan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Nonaktifkan akun

Di baris Budi UAT, klik tombol tindakan (Buka menu tindakan).

| Isian | Isi dengan |
|---|---|
| Tindakan *(cek pilihan)* | Nonaktifkan / Hapus (untuk akun aktif) |

**Klik:** Nonaktifkan. Lalu di jendela samaran, masuk sebagai `budi_uat` / `BudiUat123`.\
**Harus terlihat:** "Pengguna dinonaktifkan"; status menjadi "Dinonaktifkan". Login Budi ditolak dengan pesan "Akun ini belum aktif. Terima undangan Anda terlebih dahulu, atau hubungi administrator."\
❓ Pesannya menyebut "terima undangan" walaupun akun dinonaktifkan admin.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Pulihkan akun

Di baris Budi UAT, buka menu tindakan.

| Isian | Isi dengan |
|---|---|
| Tindakan *(cek pilihan)* | Pulihkan / Hapus (untuk akun nonaktif) |

**Klik:** Pulihkan. Lalu masuk sebagai `budi_uat`.\
**Harus terlihat:** "Pengguna dipulihkan"; status "Aktif"; Budi bisa masuk lagi. Tekan F5 di halaman Pengguna → status tetap "Aktif".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## D. Akun dan profil sendiri (login `budi_uat`)

### D1. Profil

Klik nama di kiri bawah sidebar → baris nama/foto paling atas (membuka Profil).

| Isian | Isi dengan |
|---|---|
| Foto profil | satu gambar PNG/JPG (klik atau seret) |
| Nama | `Budi UAT Ubah` |
| Bio (opsional) | `Akun uji UAT` (penghitung "12/1000") |
| Nama pengguna | terkunci, berisi `budi_uat` |
| Email | terkunci, berisi `budi.uat@contoh.test`, dengan tanda terverifikasi/belum dan tautan "Ubah di pengaturan akun" |

**Uji salah:**

- Nama dikosongkan → tidak bisa disimpan.
- File bukan gambar sebagai foto → "Foto harus berupa gambar".
- Bio lebih dari 1000 karakter → ketikan berhenti di 1000.
- Ubah Nama lalu klik **Buang perubahan** → kembali ke nilai sebelumnya.

**Klik:** Simpan perubahan.\
**Harus terlihat:** "Profil diperbarui"; nama dan foto baru tampil di kiri bawah sidebar. Tekan F5 → isian tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Nama pengguna di halaman Akun

Klik nama di kiri bawah → **Akun**. Judul "Akun", keterangan "Data masuk, keamanan, dan layanan yang terhubung". Kartu **Nama pengguna**.

| Isian | Isi dengan |
|---|---|
| Nama pengguna | `budi_uat2` |

**Uji salah:**

- `bu` → "Gunakan 3-30 huruf, angka, atau garis bawah".
- `finance_seed` → "Sudah dipakai".

**Klik:** Simpan nama pengguna.\
**Harus terlihat:** saat mengetik "Memeriksa ketersediaan…" lalu "Tersedia"; setelah simpan "Nama pengguna diperbarui". Keluar dan masuk dengan `budi_uat2` berhasil. Kembalikan ke `budi_uat`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Ganti kata sandi

Halaman **Akun**, kartu **Kata sandi** ("Pilih kata sandi baru untuk akun Anda").

| Isian | Isi dengan |
|---|---|
| Kata sandi saat ini | `BudiUat123` |
| Kata sandi baru | `BudiUat456` (petunjuk "Minimal 8 karakter.") |
| Konfirmasi kata sandi baru | `BudiUat456` |
| Keluarkan semua perangkat lain (centang) | dicentang |

**Uji salah:**

- Konfirmasi `BudiUat457` → "Kata sandi baru tidak cocok".
- Kata sandi baru `Budi1` → ditolak (minimal 8 karakter).
- Kata sandi saat ini salah → ditolak dengan pesan dari server (mis. "Kata sandi tidak valid").

**Klik:** Ubah kata sandi.\
**Harus terlihat:** "Mengubah…" lalu "Kata sandi diubah"; sesi Budi di jendela lain ikut keluar. Login dengan `BudiUat456` berhasil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Lupa kata sandi

Keluar. Di halaman login klik **Lupa kata sandi Anda?**.

| Isian | Isi dengan |
|---|---|
| Email (halaman lupa) | `budi.uat@contoh.test` |
| Kata sandi baru (halaman reset) | `BudiUat123` |
| Konfirmasi kata sandi (halaman reset) | `BudiUat123` |

**Uji salah:**

- Email `tidakada@contoh.test` → pesan yang **sama** seperti email terdaftar (tidak membocorkan akun).
- Di halaman reset: konfirmasi berbeda → "Kata sandi tidak cocok".
- Membuka tautan reset yang sudah dipakai → "Tautan reset tidak valid atau kedaluwarsa" dan tautan "Minta tautan reset baru".

**Klik:** Kirim tautan reset; buka email di Mailpit; di halaman reset klik **Reset kata sandi**.\
**Harus terlihat:** judul "Lupa kata sandi Anda?", setelah kirim "Jika akun dengan email tersebut ada, tautan reset kata sandi telah dikirim. Periksa kotak masuk Anda." dan tautan "Kembali ke halaman masuk". Halaman reset berjudul "Reset kata sandi Anda". Setelah reset, login dengan `BudiUat123` berhasil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## E. Organisasi, anggota, dan peran (login `admin`)

### E1. Daftar dan detail organisasi

Menu **Administrasi → Organisasi** → klik kartu **Entragate**.

**Klik:** tab **Info**, lalu tab **Anggota (n)**.\
**Harus terlihat:** di daftar: judul "Organisasi", tombol "Organisasi baru" (hanya untuk admin aplikasi), kartu Entragate dengan angka Anggota, Gudang, Proyek dan label "Aktif". Di detail: "<slug> · dibuat <tanggal>", tombol Ubah dan Hapus. Tab Anggota: keterangan "Orang-orang yang memiliki akses ke organisasi ini.", tombol "Tambah anggota", kartu tiap anggota dengan peran dan tombol Ubah, lalu kartu Undangan tertunda.\
⚠️ Angka **Proyek** di kartu daftar adalah angka contoh (acak tetap), bukan jumlah proyek. ⚠️ Tab **Info** menampilkan grafik contoh (Pengguna per peran, Penjualan, Laba rugi, Kas dan bank, Aktivitas) yang bukan data asli. Catat angka yang tidak cocok dengan data.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Ubah organisasi

Di detail Entragate → tombol **Ubah**. Judul "Ubah organisasi", keterangan "Slug bersifat permanen dan tidak dapat diubah."

| Isian | Isi dengan |
|---|---|
| Gambar profil | satu gambar PNG/JPG (tarik atau klik) |
| Nama | tetap `Entragate` (atau tambahkan ` UAT` lalu kembalikan) |
| Deskripsi (opsional) | `Organisasi utama (uji UAT)` |
| Slug | tidak ada kolomnya (terkunci) |

**Uji salah:**

- Nama dikosongkan → tombol Simpan tidak aktif.
- File bukan gambar → "Hanya berkas gambar yang didukung"; gambar > 20 MB → "Gambar lebih besar dari 20 MB".
- Klik **Batal** setelah mengubah Deskripsi → kembali ke detail tanpa perubahan.
- Di detail klik **Hapus** → dialog "Hapus organisasi “Entragate”?" → klik **Batal** (jangan hapus).

**Klik:** Simpan.\
**Harus terlihat:** gambar → "Gambar profil diperbarui"; Simpan → "Organisasi diperbarui". Tekan F5 di detail → deskripsi dan gambar baru tetap. Kembalikan deskripsi semula.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Beri satu anggota beberapa peran

Tab **Anggota** → kartu `technician_seed` → **Ubah**. Judul "Ubah anggota — <nama>", keterangan "Ubah peran anggota ini atau keluarkan mereka dari organisasi."

| Isian | Isi dengan |
|---|---|
| Peran *(cek pilihan, kotak centang)* | Pemilik, Admin, Anggota, Manajer Operasional, Manajer Penjualan, Penjualan, Manajer Proyek, Teknisi, Pekerja Lepas, Pembelian, Gudang, Keuangan, Akuntan, Sumber Daya Manusia, Layanan Pelanggan, Pemasaran, Auditor; tercentang **Teknisi** dan **Gudang** |

**Uji salah:**

- Hilangkan semua centang → tombol Simpan tidak aktif.
- Tanpa perubahan apa pun → tombol Simpan tidak aktif.
- Klik **Batal** → kembali ke detail tanpa perubahan.

**Klik:** Simpan.\
**Harus terlihat:** "Peran anggota diperbarui", kembali ke detail. Kartu `technician_seed` menampilkan kedua peran.\
⚠️ Label peran gabungan kemungkinan tampil sebagai teks mentah `technician,warehouse` (bukan "Teknisi, Gudang"), di kartu anggota dan di kolom Peran organisasi halaman Pengguna.\
⚠️ Buka lagi **Ubah** untuk anggota ini lalu tekan F5 di halaman ubah: centang peran kemungkinan kosong semua. Catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4. Hak gabungan berlaku (login `technician_seed`)

Keluar, masuk sebagai `technician_seed`.

**Klik:** buka setiap menu yang tampil.\
**Harus terlihat:** gabungan hak Teknisi dan Gudang (seperti Agus di tim): **Proyek** (Proyek, Tiket, Garansi), **Inventaris → Produk**, **Inventaris → Barang** (Komponen, Material, Stok, Penyesuaian Stok, Kategori barang, Mutasi Barang), **Inventaris → Pengadaan** (Penerimaan Barang dan Retur Pembelian, di samping Permintaan Pembelian yang sudah ada dari Teknisi), **CRM & Penjualan → Penjualan** (Surat Jalan, Retur Penjualan). Dasbor berisi kartu **Proyek** dan **Inventaris** (sebelumnya hanya Proyek). Halaman Stok terbuka dan tombol terima/keluarkan barang tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Kembalikan peran tunggal

Login `admin`, ulangi E3, hilangkan centang **Gudang**.

**Klik:** Simpan. Keluar, masuk sebagai `technician_seed`.\
**Harus terlihat:** "Peran anggota diperbarui". Menu Produk, Barang, Penerimaan Barang, Retur Pembelian, Surat Jalan, dan Retur Penjualan hilang (Permintaan Pembelian tetap); dasbor hanya kartu Proyek. Membuka alamat `/inventory/stock` → kembali ke Dasbor dengan "Anda tidak memiliki akses ke halaman tersebut."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E6. Batas peran untuk admin organisasi (login `admin_seed`)

Menu **Administrasi → Organisasi** → Entragate → tab **Anggota** → kartu Pemilik (`admin`) → **Ubah**. Lalu kembali, kartu `sales_seed` → **Ubah**. Lalu **Tambah anggota**.

| Isian | Isi dengan |
|---|---|
| Peran untuk anggota Pemilik | daftar tanpa Pemilik dan tanpa Admin; ada pesan "Peran yang tidak dapat Anda ubah disembunyikan: Pemilik. Hanya pemilik yang dapat mengubahnya." |
| Peran untuk `sales_seed` *(cek pilihan)* | Anggota, Manajer Operasional, Manajer Penjualan, Penjualan, Manajer Proyek, Teknisi, Pekerja Lepas, Pembelian, Gudang, Keuangan, Akuntan, Sumber Daya Manusia, Layanan Pelanggan, Pemasaran, Auditor (tanpa Pemilik dan Admin) |
| Peran di dialog Tambah anggota *(cek pilihan)* | daftar yang sama, tanpa Pemilik dan Admin; tidak ada kolom Organisasi |

**Uji salah:**

- Di anggota Pemilik, coba **Keluarkan anggota** → ditolak "Tidak dapat menghapus atau menurunkan pemilik terakhir" (bila ia satu-satunya Pemilik).

**Klik:** Batal di setiap form (jangan simpan).\
**Harus terlihat:** admin organisasi tidak pernah bisa memberi peran Pemilik atau Admin; Pemilik tetap Pemilik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E7. Keluarkan anggota

Login `admin`. Tab **Anggota** → kartu Budi UAT → **Ubah** → tombol **Keluarkan anggota**.

**Uji salah:**

- Di dialog "Keluarkan Budi UAT Ubah dari organisasi?" klik **Batal** → Budi tetap anggota.

**Klik:** Keluarkan anggota → **Keluarkan**. Lalu masuk sebagai `budi_uat`.\
**Harus terlihat:** keterangan dialog "Pengguna kehilangan seluruh akses ke organisasi. Akunnya sendiri tidak dihapus. Pemilik terakhir tidak dapat dikeluarkan."; tombol "Mengeluarkan…", lalu "Anggota dikeluarkan" dan kembali ke detail. Login Budi ditolak: "Akun ini tidak memiliki akses ke ERP. Hubungi administrator." Di **Administrasi → Pengguna**, Budi masih ada dengan "Tidak ada keanggotaan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## F. Log audit (login `admin`)

### F1. Daftar dan filter

Menu **Administrasi → Log Audit**. Judul "Log audit", keterangan "Jejak hanya-tambah untuk undangan, siklus akun, perubahan peran dan anggota. Terbaru lebih dulu."

| Isian | Isi dengan |
|---|---|
| Tindakan *(cek pilihan)* | Semua tindakan, invitation.sent, invitation.resent, invitation.cancelled, invitation.deleted, invitation.claimed, user.precreated, user.deactivated, user.restored, user.deleted, role.created, role.updated, role.deleted, member.added, member.removed, member.roleChanged, org.created; pilih **invitation.sent** |
| Jenis sasaran *(cek pilihan)* | Semua sasaran, invitation, user, role, member, organization; pilih **invitation** |
| Dari | tanggal hari ini |
| Sampai | tanggal hari ini |

**Klik:** Terapkan; lalu Atur ulang.\
**Harus terlihat:** kolom Waktu, Tindakan, Pelaku, Sasaran, Metadata; jumlah "<n> entri" di kartu Entri. Filter menampilkan undangan B1, B2, B4, B5. Tanpa hasil → "Entri audit tidak ditemukan".\
⚠️ Pilihan Tindakan dan Jenis sasaran tampil sebagai kode bahasa Inggris, bukan teks Indonesia. ⚠️ Filter tanggal memakai jam UTC: kegiatan pukul 00.00-06.59 WIB bisa masuk ke tanggal sebelumnya. ⚠️ Metadata tampil sebagai teks JSON mentah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Jejak dari langkah UAT

Menu **Administrasi → Log Audit**, filter Atur ulang.

**Harus terlihat:** entri untuk setiap kegiatan sebelumnya, dengan pelaku yang benar: user.precreated dan invitation.sent (B1, B4, B5), invitation.resent, invitation.cancelled, invitation.deleted (B2), user.deactivated (C2), user.restored (C3).\
⚠️ Kemungkinan **tidak ada** entri untuk: klaim undangan (B3, invitation.claimed), perubahan peran (E3, E5, member.roleChanged), anggota dikeluarkan (E7, member.removed), dan login. Pilihan filternya ada, tetapi kode server tidak menulisnya. Catat yang hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Log tidak bisa diubah, dan siapa yang bisa membacanya

Di **Log Audit**, cari tombol ubah/hapus pada baris. Lalu masuk sebagai `auditor_seed` dan `admin_seed`.

**Uji salah:**

- `auditor_seed` membuka alamat `/admin/audit` → kembali ke Dasbor dengan "Anda tidak memiliki akses ke halaman tersebut."

**Harus terlihat:** tidak ada tombol ubah atau hapus di baris mana pun. Menu **Log Audit** hanya tampil untuk `admin` (admin aplikasi).\
❓ Role Auditor dan Admin punya hak baca log audit di server, tetapi menu dan halamannya hanya untuk admin aplikasi, sehingga Auditor tidak bisa melihat log audit sama sekali. Perlu keputusan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## G. Profil perusahaan

### G1. Ubah semua kolom profil (login `admin`)

Menu **Pengaturan → Perusahaan**. Judul halaman "Profil Perusahaan", keterangan "Identitas hukum dan kontak kop surat perusahaan. Satu profil untuk seluruh perusahaan." Catat dulu nilai aslinya di Data contoh.

**Perusahaan**

| Isian | Isi dengan |
|---|---|
| Nama badan usaha | nilai asli + ` UAT` |
| Nama dagang (opsional) | `Entragate UAT` |
| Kode perusahaan | nilai asli (mis. `IMS`); petunjuk "Dipakai nomor dokumen ({COMPANY}), mis. IMS. Hanya huruf dan angka." |
| NPWP (opsional) | `01.234.567.8-901.000` |
| Slogan (opsional) | `Akses aman untuk semua` |

**Alamat dan kontak**

| Isian | Isi dengan |
|---|---|
| Alamat (opsional) | `Jl. Uji Coba No. 1, Bogor` |
| Kode pos (opsional) | `16122` |
| Telepon (opsional) | kode negara Indonesia, `21 555 0101` |
| Email (opsional) | `info.uat@contoh.test` |
| Situs web (opsional) | `https://contoh.test` |

**Uji salah:**

- Nama badan usaha dikosongkan → tidak bisa disimpan (kolom wajib).
- Kode perusahaan `IMS-1` → harus ditolak. ⚠️ Form tidak memeriksa di browser; catat pesan dari server (kemungkinan hanya "Validasi gagal").
- Kode perusahaan lebih dari 16 karakter → ketikan berhenti di 16.
- Email `info@` → ditolak browser (format email).
- Situs web `contoh` → ditolak browser (harus alamat lengkap).
- Telepon `12` → ditolak "Masukkan nomor telepon yang valid."

**Klik:** Simpan.\
**Harus terlihat:** "Menyimpan…" lalu "Profil perusahaan disimpan". Tekan F5 → semua nilai tetap. Lalu kembalikan semua nilai asli dan simpan lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Gambar kop dan halaman login (login `admin`)

Menu **Pengaturan → Perusahaan**, kartu **Gambar** ("Logo kop surat dicetak di setiap dokumen; gambar halaman login adalah foto yang tampil di /login.").

| Isian | Isi dengan |
|---|---|
| Logo kop surat | file PNG (tombol "Pilih gambar", atau "Ganti gambar" bila sudah ada) |
| Gambar halaman login | file JPG |

**Uji salah:**

- File PDF → "Berkas itu bukan gambar."
- Gambar lebih dari 20 MB → "Gambar lebih dari 20 MB."

**Klik:** Pilih gambar / Ganti gambar untuk masing-masing; lalu **Hapus gambar** pada Gambar halaman login dan unggah lagi.\
**Harus terlihat:** "Gambar disimpan" tiap kali; tanpa gambar tertulis "Belum ada gambar". Keluar → halaman `/login` menampilkan gambar halaman login yang baru.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G3. Pengaturan nilai perusahaan (login `admin`)

Menu **Pengaturan → Perusahaan**, kartu **Pengaturan** ("Pengaturan kunci/nilai di level perusahaan yang dipakai modul lain."). Bila kosong ("Belum ada pengaturan."), cukup catat itu dan centang.

| Isian | Isi dengan |
|---|---|
| Tipe *(cek pilihan)* | Teks / Angka / Ya / tidak (true atau false) / JSON / Tanggal (YYYY-MM-DD); biarkan tipe aslinya |
| Nilai | nilai asli (tanpa perubahan) |

**Uji salah:**

- Ganti Tipe ke **Angka** dan Nilai `abc` → "Nilai tidak sesuai dengan tipenya".

**Klik:** tombol tindakan baris → **Ubah**; dialog "Pengaturan <grup.kunci>" dengan keterangan "Nilai kosong menghapus isi pengaturan. Nilai harus sesuai tipenya."; lalu **Simpan** dengan nilai asli (atau **Batal**).\
**Harus terlihat:** kolom Grup, Kunci, Tipe, Nilai; setelah simpan "Pengaturan disimpan"; nilai tidak berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G4. Hanya baca untuk Auditor; dapat diubah Admin organisasi

Masuk sebagai `auditor_seed`, buka **Pengaturan → Perusahaan**. Lalu masuk sebagai `admin_seed`, buka halaman yang sama.

**Harus terlihat:** Auditor melihat pesan "Anda dapat melihat profil; mengubahnya membutuhkan akses pengaturan perusahaan.", semua kolom dan tombol gambar tidak aktif, tidak ada tombol Ubah di Pengaturan. `admin_seed` dapat mengubah dan menyimpan (coba ubah Slogan lalu kembalikan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## H. Nomor kode

### H1. Daftar penomoran (login `admin`)

Menu **Pengaturan → Nomor Kode**. Judul "Nomor Kode", keterangan "Format nomor setiap kode yang diterbitkan tiap modul. Perubahan hanya berlaku untuk nomor yang diterbitkan sesudahnya."

**Harus terlihat:** 14 kartu berurutan: Pelanggan, Penjualan, Pembayaran, Dokumen, Proyek dan prospek, Tiket, Produk, Gudang, Inventaris dan aset, Pemasok, Pembelian, Sumber daya manusia, Keuangan, Pajak. Tiap kartu berisi kolom Jenis kode (dengan label "Bawaan" atau "Diubah"), Pola, Mulai ulang, Nomor berikutnya. Bila profil perusahaan belum diisi, yang tampil hanya tautan "Isi profil perusahaan terlebih dahulu: nomor memakai kode dokumennya."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2. Ubah pola Penawaran (SPH) (login `admin`)

Kartu **Penjualan** → baris **Penawaran (SPH)** → tombol tindakan → **Ubah**. Dialog "Penomoran Penawaran (SPH)". Catat pola asli di Data contoh.

| Isian | Isi dengan |
|---|---|
| Pola | `SPH/{COMPANY}/{YYYY}/{MM_ROMAN}/{SEQ:4}` (petunjuk token di bawah kolom) |
| Mulai ulang *(cek pilihan)* | Tidak pernah / Setiap tahun / Setiap bulan; pilih **Setiap tahun** |
| Pratinjau | terisi otomatis, mis. `SPH/IMS/2026/XI/0001` |

**Uji salah** (lihat pesan merah di bawah kolom Pola; tombol Simpan tidak aktif):

- Pola tanpa `{SEQ}`, mis. `SPH/{YYYY}` → "Pola harus memuat {SEQ} tepat satu kali".
- `SPH/{FOO}/{SEQ}` → "Token {FOO} tidak dikenal" (menyebut tokennya).
- `SPH#{SEQ}` → "Di luar token hanya boleh huruf, angka, spasi, / - . _".
- `SPH/{SEQ:11}` → "Lebar {SEQ:n} harus antara 1 dan 10".
- `SPH/{SUPPLIER}/{SEQ}` → "Token {SUPPLIER} hanya tersedia untuk: …".
- `SPH/{YYYY` → "Kurung kurawal token tidak seimbang atau salah".
- Pola lebih dari 100 karakter → ketikan berhenti di 100.
- Klik **Batal** → dialog tertutup, pola tidak berubah.

**Klik:** Simpan.\
**Harus terlihat:** "Penomoran disimpan"; baris SPH berlabel "Diubah", kolom Mulai ulang "Setiap tahun", Nomor berikutnya mengikuti pola baru. Tekan F5 → tetap. Lalu kembalikan pola dan Mulai ulang ke nilai asli dan simpan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H3. Akses nomor kode per role

Masuk berturut-turut sebagai `admin_seed`, `auditor_seed`, `sales_seed`, buka **Pengaturan → Nomor Kode** (atau alamat `/settings/code-numbers`).

**Harus terlihat:**

| Akun | Yang terlihat |
|---|---|
| `admin_seed` | 13 kartu (tanpa Gudang); tombol Ubah ada dan bisa menyimpan |
| `auditor_seed` | 13 kartu (tanpa Gudang); tanpa tombol Ubah |
| `sales_seed` | menu Nomor Kode tidak tampil; alamat langsung → kembali ke Dasbor dengan "Anda tidak memiliki akses ke halaman tersebut." |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## I. Laporan

### I1. Arsip laporan bulanan (login `admin`)

Menu **Laporan → Laporan → Arsip Bulanan**. Judul "Arsip Laporan Bulanan", keterangan "Laporan yang dibekukan saat bulan ditutup. Angka di sini tidak berubah setelah ada posting berikutnya." Butuh satu bulan yang periodenya **sudah ditutup** di Keuangan → Tutup Periode; bila belum ada, jalankan uji salah saja dan tulis "belum ada periode tertutup".

| Isian | Isi dengan |
|---|---|
| Tahun | tahun periode tertutup (bawaan: tahun bulan lalu) |
| Bulan | bulan periode tertutup, angka 1-12 (bawaan: bulan lalu) |

**Uji salah:**

- Bulan yang periodenya masih terbuka → "Periode masih terbuka; tutup dulu sebelum mengarsipkan".
- Bulan `13` atau Tahun `abc` → ditolak. ⚠️ Kolom tidak memeriksa angka di browser; catat pesan dari server (kemungkinan hanya "Validasi gagal").
- Arsipkan lagi bulan yang sama → "Bulan itu sudah diarsipkan".

**Klik:** Arsipkan bulan.\
**Harus terlihat:** "<n> laporan diarsipkan untuk <YYYY-MM>". Daftar menampilkan satu baris per laporan: periode, jenis (Laba Rugi / Neraca / Arus Kas / Paket manajemen), angka utama (Laba bersih / Total aset / Perubahan bersih kas), dan "Diarsipkan pada …". Tanpa arsip: "Belum ada bulan yang diarsipkan. Tutup periode, lalu arsipkan." Tidak ada tombol ubah/hapus arsip.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I2. Laporan keuangan dari bagian Laporan (login `admin`)

Menu **Dasbor → Dasbor** → Tautan cepat **Laporan Keuangan** (alamat `/reports`). Bandingkan dengan **Keuangan → Keuangan → Laporan Keuangan**.

| Isian | Isi dengan |
|---|---|
| Tanggal pertama (mulai) | tanggal 1 bulan ini (bawaan) |
| Tanggal kedua (sampai) | hari ini (bawaan) |
| Tanggal ketiga (per tanggal, untuk Neraca) | hari ini (bawaan) |
| Tab *(cek pilihan)* | Laba Rugi / Neraca / Arus Kas / Neraca Saldo / Buku Besar / Paket manajemen / Proyeksi kas / Arus kas & ekuitas / Rasio / Profitabilitas / Biaya proyek / Pusat biaya |

**Uji salah:**

- Tanggal mulai sesudah tanggal sampai → Laba Rugi dan Arus Kas tidak dihitung (tetap "Jalankan laporan").

**Klik:** Jalankan laporan, lalu tiap tab.\
**Harus terlihat:** judul "Laporan Keuangan", keterangan "Dihitung on-demand dari baris jurnal yang diposting — bukan snapshot tersimpan." Angka di `/reports` sama persis dengan Keuangan → Laporan Keuangan.\
⚠️ Ketiga kotak tanggal tidak berlabel; penguji harus menebak mana yang "mulai", "sampai", dan "per tanggal". ⚠️ Halaman `/reports` tidak ada di menu Laporan (hanya lewat tautan cepat Dasbor).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I3. Ekspor CSV laporan (login `finance_seed`)

Halaman Laporan Keuangan (I2), setelah **Jalankan laporan**.

**Klik:** ketiga tombol **Ekspor CSV** satu per satu (urutan: Laba Rugi, Neraca, Arus Kas).\
**Harus terlihat:** tiap tombol mengunduh satu file CSV: `profit-and-loss-<mulai>_<sampai>.csv`, `balance-sheet-<tanggal>.csv`, `cash-flow-<mulai>_<sampai>.csv`, dengan angka yang sama dengan layar.\
⚠️ Kemungkinan besar **tidak ada file yang terunduh** dan tidak ada pesan apa pun: tombol memanggil alamat `/reports/...csv`, sedangkan server menyediakannya di `/finance/reports/...csv`. ⚠️ Ketiga tombol berlabel sama "Ekspor CSV", tidak jelas mana untuk laporan apa.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I4. Akses laporan per role

Masuk berturut-turut dengan akun di tabel, buka **Laporan → Laporan → Arsip Bulanan** dan `/reports`.

**Harus terlihat:**

| Akun | Arsip Bulanan | Form "Arsipkan bulan" | Tombol Ekspor CSV |
|---|---|---|---|
| `admin` (Pemilik) | tampil | tampil | tampil |
| `accountant_seed` (Bella) | tampil | tampil | tampil |
| `finance_seed` | tampil | tidak tampil | tampil |
| `auditor_seed` | tampil | tidak tampil | tampil |
| `sales_seed`, `technician_seed`, `hr_seed` | menu Laporan tidak tampil; alamat langsung → kembali ke Dasbor dengan "Anda tidak memiliki akses ke halaman tersebut." | - | - |

Untuk `sales_seed`, alamat `/reports` terbuka tetapi hanya berisi judul "Laporan Keuangan" tanpa angka.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## J. Menu administrasi per role

Untuk tiap akun, catat isi bagian **Laporan**, **Administrasi**, dan **Pengaturan** di sidebar.

### J1. Pemilik dan admin aplikasi (`admin`, seperti Aqim)

**Harus terlihat:** Laporan: Laporan → Arsip Bulanan. Administrasi: Organisasi, Pengguna, Log Audit. Pengaturan: Perusahaan, Nomor Kode, Gateway pembayaran, Dokumen, Penggajian.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J2. Admin organisasi (`admin_seed`)

**Harus terlihat:** Laporan tidak tampil. Administrasi: Organisasi saja (Pengguna dan Log Audit tidak tampil). Pengaturan: Perusahaan, Nomor Kode, Dokumen. Anggota dan undangan dikelola dari Organisasi → Entragate → Anggota.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J3. Auditor (`auditor_seed`)

**Harus terlihat:** Laporan: Arsip Bulanan. Administrasi tidak tampil (Auditor tidak punya hak baca organisasi). Pengaturan: Perusahaan (hanya baca), Nomor Kode (hanya baca), Dokumen.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J4. Sumber Daya Manusia (`hr_seed`)

**Harus terlihat:** Laporan dan Administrasi tidak tampil. Pengaturan: Dokumen saja.\
❓ Role SDM punya hak mengundang anggota di server, tetapi tidak ada halaman yang bisa dibukanya untuk mengundang (Organisasi butuh hak baca organisasi, Pengguna hanya untuk admin aplikasi). Perlu keputusan apakah SDM memang harus bisa mengundang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J5. Role lain (`sales_manager_seed`, `technician_seed`, `member_seed`, `accountant_seed`)

**Harus terlihat:** keempatnya tanpa Administrasi. Pengaturan: Dokumen saja. Laporan hanya tampil untuk `accountant_seed`. Bandingkan dengan tim: Agus MD, Jamil, Fahri, Oki tidak melihat Administrasi; Bella melihat Laporan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J6. Membuka halaman terlarang lewat alamat (login `admin_seed`)

Ketik di bilah alamat satu per satu: `/admin/users`, `/admin/audit`, `/settings/payroll`.

**Harus terlihat:** setiap alamat kembali ke Dasbor dengan pesan "Anda tidak memiliki akses ke halaman tersebut." (atau kartu "Perlu akses administrator" dengan keterangan "Halaman ini hanya untuk administrator aplikasi. …" dan tombol "Kembali ke dasbor"). Tidak ada data pengguna atau log yang sempat tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

## K. Penutupan (login `admin`)

### K1. Hapus akun uji dan batalkan undangan sisa

Menu **Administrasi → Pengguna** → baris Budi UAT → menu tindakan → **Hapus**. Lalu di **Undangan tertunda**, **Batal** untuk `uat.tim1`, `uat.tim2`, `uat.tim4`.

**Uji salah:**

- Di dialog "Hapus pengguna ini?" klik **Batal** → Budi tetap ada.

**Klik:** Hapus → **Hapus** di dialog.\
**Harus terlihat:** dialog berbunyi "budi.uat@contoh.test akan dihapus secara lunak dan semua sesi dicabut. Keanggotaan tetap disimpan; admin dapat memulihkan akun nanti."; lalu "Pengguna dihapus", status "Dihapus", dan menu tindakannya hanya **Pulihkan**. Undangan sisa → "Undangan dibatalkan". **Log Audit** memuat user.deleted dan invitation.cancelled. Data karyawan yang dibuat dari undangan tetap ada di modul SDM (catat bila perlu dibersihkan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 43 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M12:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

**Beda rencana dan kode**

- Rencana (`docs/plan/erp-module-plans/m12-reports-access.md`) mengusulkan 6 role (owner, finance, admin, hr, warehouse, technician); kode punya 17 role organisasi (`packages/common/src/authorization/erp-permissions.ts:257-276`), dan satu anggota boleh memegang beberapa role (disimpan dipisah koma).
- Rencana: audit mencakup login, persetujuan, posting, pembalikan, buka/tutup periode, perubahan role, override lisensi, dan ekspor. Di kode, modul user hanya menulis undangan dan siklus akun (`apps/backend/src/app/user/services/invitation.service.ts:256-430`, `user-admin.service.ts:106-154`); perubahan peran dan pengeluaran anggota tidak tercatat (`apps/backend/src/app/organization/services/organization.service.ts` tanpa panggilan audit). Modul lain (keuangan, inventaris, produk) menulis audit sendiri, tetapi halaman Log Audit hanya punya pilihan filter untuk tindakan modul user (`apps/web-admin/src/routes/_authed/admin/audit/index.tsx:40-59`).
- Tabel "Current state" rencana (dicek 2026-11-04) menulis ekspor dan arsip bulanan "none". Arsip bulanan sudah ada (`/reports/monthly-archives`, `POST /finance/reports/archives`), ekspor CSV ada untuk tiga laporan keuangan dan XLSX untuk paket manajemen.
- Rencana: setiap ekspor diaudit. Tidak ada penulisan audit untuk ekspor di kode yang diperiksa.
- Rencana: Auditor membaca log audit. Server mengizinkan (`audit_log:read` untuk Pemilik, Admin, Auditor; `docs/role-permission.md:651`), tetapi menu dan halaman `/admin/*` hanya untuk admin aplikasi (`apps/web-admin/src/components/sidebar/nav-config.ts:662`, `apps/web-admin/src/routes/_authed/admin.tsx`).
- `docs/role-permission.md:1493-1498` mencatat `/admin/invitations` sebagai "every organization member"; pemeriksaan admin aplikasi ada di dalam controller (`apps/backend/src/app/user/controllers/invitation.controller.ts:48-51`), jadi aman, tetapi dokumen hasil generator menyesatkan.

**Temuan baru**

- ⚠️ Tombol Ekspor CSV memanggil `/reports/profit-and-loss.csv`, `/reports/balance-sheet.csv`, `/reports/cash-flow.csv`, padahal server di `/finance/reports/...` (`apps/web-admin/src/components/finance/reports-page.tsx:100`, `:109`, `:118`; server `apps/backend/src/app/finance/controllers/finance-operations.controller.ts:112`, `:421`). Kesalahannya juga tidak ditampilkan karena `onClick={() => void onClick()}` tanpa penanganan error (`reports-page.tsx:302-307`).
- ⚠️ Label peran memakai `erpRoleLabel(member.role)` pada teks gabungan `a,b`, sehingga anggota dengan beberapa role tampil sebagai kode mentah (`apps/web-admin/src/components/organization/organization-member-card.tsx:68`, `apps/web-admin/src/routes/_authed/admin/users/index.tsx:526`).
- ⚠️ Halaman Ubah anggota mengisi centang dari `useState` saat render pertama, sebelum daftar anggota termuat; setelah F5 di halaman ini semua centang kosong. Halaman juga hanya mencari anggota di halaman pertama (20 anggota) dari daftar (`apps/web-admin/src/routes/_authed/organizations/$organizationId.members.$memberId.edit.tsx:59-67`).
- ⚠️ Kolom Nama di dialog undangan bertanda opsional, tetapi wajib (`apps/web-admin/src/components/invite/invite-dialog.tsx:198-202`, `:408`). Petunjuk tempel massal juga menyebut nama opsional (`packages/locales/src/id/admin.ts:55-56`).
- ⚠️ Klaim undangan: pola nama pengguna `^[a-zA-Z0-9_]+$` menolak tanda hubung, padahal pesannya menyebut tanda hubung boleh (`apps/web-admin/src/components/form/claim-invitation-form.tsx:25`; `packages/locales/src/id/claim.ts:15-16`).
- ⚠️ Login dengan nama pengguna dan kata sandi salah: plugin `@better-auth/i18n` bahasa Indonesia tidak punya terjemahan `INVALID_USERNAME_OR_PASSWORD`, jadi pesan kemungkinan bahasa Inggris (`apps/backend/src/providers/better-auth/plugins/i18n.auth.ts:13-20`).
- ⚠️ Daftar organisasi menampilkan jumlah proyek acak tetap (`placeholderProjectCount`, `apps/web-admin/src/routes/_authed/organizations/index.tsx:37`, `:191`); tab Info detail organisasi memakai data contoh statis (`apps/web-admin/src/components/organization/org-dashboard.tsx:24-33`, `apps/web-admin/src/lib/org-dashboard-data`).
- ⚠️ Filter tanggal Log Audit memakai `T00:00:00.000Z`/`T23:59:59.000Z` (UTC), bukan tanggal Asia/Jakarta (`apps/web-admin/src/routes/_authed/admin/audit/index.tsx:99-100`). Tanggal bawaan Laporan Keuangan juga dari UTC (`reports-page.tsx:28`), sehingga sebelum 07.00 WIB "hari ini" masih kemarin.
- ⚠️ Pilihan filter Log Audit tidak diterjemahkan (kode bahasa Inggris) dan kolom Metadata berupa JSON mentah (`audit/index.tsx:201-205`, `:140-144`).
- ❓ Pesan login untuk akun yang dinonaktifkan sama dengan akun yang belum klaim undangan ("…Terima undangan Anda terlebih dahulu…") (`apps/backend/src/providers/better-auth/options/session.auth.ts:46-49`).
- ❓ SDM punya `invitation:create` dan `member:read` tetapi tidak punya `organization:read`, jadi tidak ada halaman yang bisa dibukanya untuk mengundang (`erp-permissions.ts`, blok `hr`; `nav-config.ts`, item Organisasi).
- ❓ Hapus undangan tanpa dialog konfirmasi (`apps/web-admin/src/components/admin/pending-invitations-panel.tsx:194-198`); Nonaktifkan pengguna juga tanpa konfirmasi (`admin/users/index.tsx:569`).
- Tombol "Ubah" di kartu anggota selalu tampil, juga untuk yang tidak punya `member:update`; penyimpanan baru ditolak server (`organization-member-card.tsx:74-86`).
- Bundel `packages/locales/src/id/claim.ts` ditulis `as const` tanpa tipe `Record<keyof typeof en, string>`, berbeda dari aturan i18n di `AGENTS.md`.
- Masuk dengan Google tidak diuji di sini (butuh akun Google uji dan konfigurasi OAuth); pesannya ada di `packages/locales/src/id/auth.ts:19-29`.
