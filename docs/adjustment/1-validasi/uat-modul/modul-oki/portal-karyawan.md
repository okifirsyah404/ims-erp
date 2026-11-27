# UAT Portal Karyawan (`apps/web-employee`)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** masuk portal → navigasi → dasbor dan profil → absensi kantor (check-in/check-out) → jadwal dan tugas HR → proyek dan absensi lokasi proyek (radius PostGIS + selfie) → tugas dan bukti proyek → cuti dan lembur (persetujuan HR di admin) → dokumen dan tanda tangan → slip gaji → notifikasi.

Versi lengkap per form, disusun 2026-11-26 dari form aslinya di kode (belum diuji di aplikasi). **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), kamera/foto, dan lokasi. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Persiapan:**

- Jalankan `bun run dev` dari root (atau `bun run dev:employee` untuk portal saja). Portal karyawan: **http://localhost:5174**. Admin ERP: http://localhost:5173. Backend: http://localhost:3000.
- Backend harus mengizinkan `http://localhost:5174` di `cors.json` **dan** di daftar trusted origin Better Auth; bila tidak, setiap login gagal "Invalid origin" (lihat `docs/architecture/runbook.md`).
- Database harus image PostGIS (`postgis/postgis:18-3.6`), karena jarak lokasi proyek dihitung PostGIS.
- Kamera dan lokasi browser hanya jalan di `https` atau `localhost`. Uji di laptop dengan Chrome; untuk mengatur lokasi pakai **DevTools → ⋮ → More tools → Sensors → Location**. Membuka portal dari HP lewat `http://<IP-LAN>:5174` akan gagal membaca lokasi/kamera.
- Siapkan: 1 foto selfie JPG (< 5 MB), 1 file JPG > 5 MB, 1 file `.heic` atau `.txt`, 1 PDF bukti, 1 gambar tanda tangan PNG.

**Akun:**

| Akun | Dipakai untuk |
|---|---|
| Akun demo portal | Karyawan utama. Saat seed berjalan, log mencetak "Portal demo ready: sign in with this account" beserta nama, kode karyawan, email, username, dan radius. Biasanya `admin_seed` (password `admin123456`, kode `EMP-00001`); **pakai yang tercetak di log** |
| `hr_seed` (`hr123456`) | Karyawan kedua di portal (bukan PIC proyek) dan penyetuju cuti/lembur di admin |
| `technician_seed` (`technician123456`) | Pengguna tanpa data karyawan (harus ditolak portal) |
| `admin` (Pemilik, password di `apps/backend/.env`) | Role aplikasi admin (harus ditolak portal); menyetujui gaji di admin |

**Siapa yang boleh masuk:** pengguna yang punya data karyawan aktif di organisasi, dan role aplikasinya bukan `admin`, `investor`, atau `customer`. Tidak ada role khusus "karyawan".

**Status:**

| Hal | Status |
|---|---|
| Absensi | Hadir, Izin, Sakit, Cuti, Tanpa keterangan, Libur; sumber: Check-in mandiri / Diinput HR / Hasil impor / Cuti |
| Kunjungan lokasi proyek | Dalam radius / Di luar radius; " · terbuka" sampai check-out |
| Cuti dan lembur | Menunggu persetujuan, Disetujui, Ditolak, Dibatalkan |
| Tugas HR | Terbuka, Selesai, Dibatalkan |
| Tugas proyek | Belum mulai, Dikerjakan, Selesai |
| Permintaan tanda tangan | Menunggu Anda, Ditandatangani, Ditolak, Dibatalkan, Kedaluwarsa |

**Data contoh (dari seed dan yang dibuat selama UAT):**

| Data | Nilai |
|---|---|
| Proyek demo | `PRJ-DEMO-001` "Instalasi Demo Portal Karyawan", pelanggan PT Pelanggan Demo, lokasi "Kantor Demo Jakarta", Jl. Medan Merdeka Barat No. 1, Jakarta Pusat; tahap Instalasi; status Aktif; PIC = akun demo |
| Titik lokasi proyek | lintang `-6.1753920`, bujur `106.8271530` (Monas); radius **100 m** |
| Lokasi uji dalam radius | `-6.1753920`, `106.8271530` → jarak ±0 m → Dalam radius |
| Lokasi uji di luar radius | `-6.1800000`, `106.8271530` → jarak ±513 m → Di luar radius |
| Tugas proyek seed | "Cek panel lantai 1", Belum mulai, petugas = akun demo |
| Tugas proyek baru | "Pasang reader pintu UAT", tahap Instalasi, tenggat 5 Desember 2026, petugas `hr_seed` |
| Cuti seed | Cuti tahunan, hari ini +3 sampai +4 (2 hari), "Demo: acara keluarga", Menunggu persetujuan |
| Lembur seed | kemarin, 2 jam, "Demo: lembur instalasi", Disetujui |
| Cuti baru | Cuti tahunan, 14–15 Desember 2026 (Senin–Selasa, 2 hari), alasan `Urusan keluarga UAT` |
| Cuti untuk ditolak | Izin, 21 Desember 2026 (1 hari), alasan `Uji tolak` |
| Lembur baru | hari ini, 2,5 jam, alasan `Lembur instalasi UAT` |
| Kuota cuti tahunan | 12 hari; setelah cuti seed (2) + cuti baru (2) tertulis "4 dari 12 hari terpakai" |
| Tanda tangan seed | "Perjanjian Kerja - {nama akun demo}", catatan "Demo: mohon tanda tangan perjanjian kerja", Menunggu Anda |
| Jadwal seed | minggu ini dan depan: Senin–Sabtu 08:00–17:00 "Pagi", Minggu libur |
| Slip gaji | rekap gaji bulan berjalan yang memuat akun demo dan sudah **disetujui** Pemilik (lihat UAT M08 D1, D6) |

---

## A. Masuk dan navigasi

### A1. Buka portal dan pilih bahasa

Buka http://localhost:5174.

**Harus terlihat:** halaman login. Bahasa awal bisa English (bawaan aplikasi). Pilih **Bahasa Indonesia** di pengalih bahasa → judul "Selamat datang kembali", subjudul "Masuk ke akun Entragate Anda" (atau nama perusahaan). F5: tetap Bahasa Indonesia.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Masuk dengan akun demo (semua kolom)

| Isian | Isi dengan |
|---|---|
| Email atau username | username akun demo dari log seed (mis. `admin_seed`); placeholder "m@example.com atau johndoe" |
| Kata sandi | `admin123456` (atau `<role>123456` sesuai akun); ikon mata menampilkan/menyembunyikan |

**Klik:** Masuk (saat proses "Sedang masuk…").

**Harus terlihat:** masuk ke Dasbor "Halo, {nama}". Keluar, lalu masuk lagi memakai **email** akun demo → juga berhasil; pil "Terakhir dipakai" menandai cara terakhir. Ada pula tombol "Masuk dengan Google" di bawah "Atau lanjutkan dengan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Uji salah login

- Kata sandi `salah123` → "Email/username atau kata sandi salah" (atau pesan Better Auth setara).
- Kolom kosong → tidak bisa dikirim.
- Matikan backend lalu Masuk → "Tidak dapat menghubungi server. Periksa koneksi Anda dan coba lagi."
- Masuk dengan Google memakai akun Google yang tidak diundang → "Akun Google ini belum terdaftar. Akses hanya melalui undangan: minta administrator untuk mengundang Anda."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4 ⚠️. Pengguna bukan karyawan ditolak

Masuk sebagai `technician_seed`, lalu sebagai `admin`.

**Harus terlihat:** keduanya keluar otomatis dan kembali ke login dengan kotak merah "Portal karyawan tidak tersedia" / "Portal ini untuk karyawan yang memiliki data karyawan. Minta HR menautkan akun Anda, atau gunakan aplikasi yang biasa Anda pakai." ⚠️ Dugaan: di bawah form ikut muncul "Masuk dengan Google gagal. Silakan coba lagi." (pesan ganda). ❓ Teknisi (`technician_seed`) tidak punya data karyawan dari seed, padahal teknisi justru pengguna utama absensi lokasi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5 ⚠️. Tautan lupa kata sandi

Di login klik **Lupa kata sandi Anda?**.

**Harus terlihat:** halaman reset kata sandi. ⚠️ Dugaan: halaman tidak ditemukan (route `/forgot-password` tidak ada di portal).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A6. Navigasi desktop dan HP

Masuk akun demo. Cek sidebar, lalu perkecil jendela (atau DevTools mode perangkat) sampai bilah bawah muncul.

**Harus terlihat:** sidebar: pengalih organisasi di atas; **Dasbor**; **Sumber Daya Manusia**: Absensi, Jadwal Kerja, Cuti, Lembur, Tugas; **Proyek**: Proyek; **Dokumen**: Berkas, Tanda tangan; **Akun**: Penggajian. Kepala halaman: breadcrumb, lonceng notifikasi, avatar (Tema terang/gelap/sistem, Bahasa, Akun, Keluar). Bilah bawah HP: Dasbor, Absensi, Cuti, Tugas, Lainnya; "Lainnya" membuka lembar berisi Jadwal Kerja, Lembur, Proyek, Berkas, Tanda tangan, Penggajian. ❓ Nama menu beda dengan judul halaman (Berkas/Dokumen, Penggajian/Slip Gaji, Tanda tangan/Permintaan tanda tangan, Jadwal Kerja/Jadwal).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. Dasbor dan profil (akun demo)

### B1. Dasbor

Menu **Dasbor**.

**Harus terlihat:** "Halo, {nama}", "Ringkasan hari Anda"; kartu **Absensi hari ini** ("Anda belum check-in hari ini" sebelum C1), **Jadwal hari ini** (Senin–Sabtu "08:00 – 17:00" Pagi; Minggu "Hari libur"), **Tugas terbuka** (maks. 3, "Tenggat {tanggal}", atau "Tidak ada tugas terbuka"), **Organisasi** (kode karyawan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2 ⚠️. Ubah data pribadi (semua kolom)

Avatar → **Akun** (halaman "Profil Karyawan", "Data Anda dan keamanan akun"). Kartu **Kepegawaian** hanya dibaca (NIK karyawan, Nama lengkap, Email, Status, Jenis kepegawaian, Cara kerja, Tanggal masuk). Kartu **Data pribadi**:

| Isian | Isi dengan |
|---|---|
| Nama panggilan | `Demo` (opsional, maks. 100) |
| Telepon | `081234567890` |
| Alamat | `Jl. Kebon Sirih No. 10, Jakarta Pusat` (opsional, maks. 500) |
| Kode pos | `10340` (maks. 10) |

Petunjuk "NIK, NPWP, BPJS, email, jabatan, gaji dan data bank dikelola HR."

**Klik:** Simpan perubahan.

**Harus terlihat:** "Profil diperbarui"; F5 isian tetap; HR melihat telepon baru di detail karyawan admin. ⚠️ Status/Jenis/Cara kerja tampil mentah bahasa Inggris (`active`, `permanent`, `onsite`); kolom Telepon bukan `type="tel"`. Uji salah: Kode pos `12345678901` (11 karakter) → ditolak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Ganti kata sandi

Kartu **Keamanan akun** ("Ganti kata sandi atau akhiri sesi Anda").

| Isian | Isi dengan |
|---|---|
| Kata sandi saat ini | kata sandi akun demo |
| Kata sandi baru | `demoBaru123` (petunjuk "Minimal 8 karakter.") |
| Konfirmasi kata sandi baru | `demoBaru123` |

**Klik:** Ganti kata sandi.

**Harus terlihat:** "Kata sandi diubah"; petunjuk "Mengganti kata sandi juga mengakhiri sesi Anda yang lain." (sesi di tab/peramban lain keluar). Uji salah: konfirmasi beda → "Kedua kata sandi tidak sama"; `abc` → "Minimal 8 karakter."; kata sandi saat ini salah → ditolak. **Kembalikan** kata sandi ke semula setelah uji. Tombol **Keluar** di kartu ini mengeluarkan akun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4 ⚠️. Organisasi dan notifikasi

Klik pengalih organisasi di atas sidebar; klik lonceng notifikasi; ketik alamat `/notifications`.

**Harus terlihat:** pengalih hanya berisi organisasi tempat akun punya data karyawan ("Ganti organisasi"). Panel "Notifikasi" dengan "Tandai semua dibaca" atau "Belum ada notifikasi". ⚠️ Klik notifikasi tidak membuka apa pun; halaman `/notifications` hanya bisa dibuka lewat alamat, tombol per baris tertulis "Tandai semua dibaca", dan breadcrumb kosong.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Absensi kantor (akun demo)

### C1. Check-in

Menu **Absensi** (judul "Absensi", "Check-in, check-out, dan rekap bulan ini") → tombol **Check-in**.

**Harus terlihat:** "Check-in tercatat"; kartu "Absensi hari ini" menampilkan jam masuk dan badge "Check-in mandiri"; tombol Check-in mati. Dasbor: "Check-in pukul HH:mm". ❓ Tidak ada lokasi, selfie, atau cek jadwal/telat untuk absensi kantor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Check-out

Tombol **Check-out**.

**Harus terlihat:** "Check-out tercatat"; jam pulang tampil; daftar "Bulan ini" berisi hari ini dengan jam masuk–pulang, status Hadir, sumber Check-in mandiri. Kartu bulan (mis. "November 2026") menambah 1 di **Hadir**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Uji salah absensi

- Check-in lagi hari yang sama (bila tombol bisa diklik, mis. dari tab lain) → "Anda sudah check-in hari ini".
- Check-out lagi → "Anda sudah check-out hari ini".
- Masuk `hr_seed` (belum check-in) → Check-out dulu → "Check-in dulu sebelum check-out".
- Pada hari yang tercatat cuti disetujui → Check-in mati; bila dipaksa "Hari ini dicatat oleh cuti yang disetujui; batalkan cutinya".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4 ⚠️. HR melihat absensi mandiri (login `hr_seed` di admin)

Admin **Sumber Daya Manusia → Absensi** → Lembar harian, hari ini.

**Harus terlihat:** baris akun demo: Hadir, jam masuk dan pulang sama dengan C1–C2, dan tanda bahwa ini check-in mandiri. ⚠️ Dugaan: tidak ada tanda sumber "mandiri", dan HR bisa menimpanya tanpa jejak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Jadwal dan tugas HR (akun demo)

### D1. Jadwal kerja

Menu **Jadwal Kerja** (judul "Jadwal", "Shift Anda minggu ini") → **Minggu depan** → **Minggu lalu** → **Minggu ini**.

**Harus terlihat:** 7 kotak hari; Senin–Sabtu "08:00 – 17:00" Pagi, Minggu "Hari libur"; hari ini disorot. Minggu lalu (tidak di-seed) → "Belum ada shift untuk minggu ini". ❓ Judul kartu menampilkan tanggal mentah `YYYY-MM-DD`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2 ⚠️. Tugas dari HR

Prasyarat: `hr_seed` membuat tugas untuk akun demo di admin **Sumber Daya Manusia → Tugas** (judul `Kirim fotokopi KTP UAT`, tenggat 30 November 2026; lihat UAT M08 E1). Portal: menu **Tugas** ("Tugas yang diberikan HR kepada Anda") → **Tandai selesai** → **Buka kembali**.

**Harus terlihat:** kartu tugas dengan "Tenggat 30 Nov 2026", badge Terbuka → Selesai → Terbuka; admin ikut berubah setelah F5. Tanpa tugas: "Belum ada tugas untuk Anda". ⚠️ Tidak ada pesan sukses setelah klik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## E. Proyek dan absensi lokasi

### E1. Daftar dan detail proyek (akun demo)

Menu **Proyek** ("Proyek yang Anda pimpin, atau yang punya tugas untuk Anda"). Cari `DEMO` di "Cari proyek" → buka `PRJ-DEMO-001`.

**Harus terlihat:** kartu `PRJ-DEMO-001`, "Instalasi Demo Portal Karyawan", badge "PIC", status Aktif, PT Pelanggan Demo, tahap Instalasi, lokasi Kantor Demo Jakarta. Detail punya tab **Tugas**, **Bukti**, **Kunjungan lokasi saya**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Check-in lokasi dalam radius (semua kolom)

DevTools Sensors → Location: lintang `-6.1753920`, bujur `106.8271530`. Tab **Kunjungan lokasi saya** → kartu "Check-in di lokasi ini".

| Isian | Isi dengan |
|---|---|
| Baca lokasi saya | klik; izinkan lokasi → "Lokasi siap (akurasi {n} m)" |
| Selfie | **Nyalakan kamera** → **Ambil foto** (kamera depan); atau "Atau pilih foto" → selfie JPG < 5 MB. Petunjuk "Radius 100 m" |
| Catatan | `Mulai pasang panel UAT` (opsional) |

**Klik:** Check-in (mati sampai lokasi dan selfie siap).

**Harus terlihat:** "Check-in lokasi tercatat"; tabel kunjungan: tanggal hari ini " · terbuka", "0 m dari lokasi" (atau beberapa meter), "Radius 100 m", badge **Dalam radius**, tombol Check-out. ⚠️ Kolom badge berjudul "Tahap", bukan status.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Uji salah check-in lokasi

Lakukan **sebelum** E2 atau pada proyek/hari lain:

- Tolak izin lokasi di browser → "Baca lokasi Anda dulu"; Check-in tetap mati.
- Kamera tidak ada/ditolak → "Kamera tidak tersedia. Pakai pilih file di bawah."
- Pilih file JPG > 5 MB → "Selfie maksimal 5 MB".
- Pilih file `.heic` atau `.txt` → "Selfie harus berupa gambar JPG, PNG atau WebP".
- Check-in kedua di proyek yang sama hari yang sama → "Anda sudah check-in di proyek ini hari ini".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4. Check-out lokasi

Baris kunjungan hari ini → **Check-out** (lokasi dibaca ulang).

**Harus terlihat:** "Check-out lokasi tercatat"; " · terbuka" hilang. Check-out kedua → "Kunjungan lokasi ini sudah check-out". ⚠️ Bila lokasi gagal dibaca saat check-out, pesannya mentah (teks browser atau `geolocation-unavailable`), bukan bahasa Indonesia. ❓ Tidak ada cek radius saat check-out.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5 ❓. Check-in di luar radius (hari berikutnya)

Keesokan harinya (satu check-in per proyek per hari), Sensors → lintang `-6.1800000`, bujur `106.8271530` → ulangi E2.

**Harus terlihat:** check-in **tetap diterima** dengan badge **Di luar radius**, "±513 m dari lokasi", "Radius 100 m". PIC proyek mendapat notifikasi kunjungan (kecuali PIC sendiri yang check-in). ❓ Perlu keputusan: apakah di luar radius seharusnya ditolak, atau cukup ditandai.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E6. Tugas proyek oleh PIC (semua kolom)

Tab **Tugas** → **Tambah tugas**. Dialog "Tambah tugas", petunjuk "Tentukan petugas dan tenggatnya; petugas yang memindahkan status."

| Isian | Isi dengan |
|---|---|
| Judul tugas | `Pasang reader pintu UAT` (wajib, maks. 300) |
| Tahap *(cek pilihan)* | Persiapan / Pengiriman / Instalasi / Pengujian / Pelatihan / Serah terima (tanpa Garansi); bawaan **Instalasi** |
| Tenggat | 5 Desember 2026 |
| Petugas *(cek pilihan)* | "Belum ditugaskan" + daftar staf; pilih `hr_seed` |

**Klik:** Simpan. Lalu **Ubah tugas** → Tenggat 6 Desember 2026 → Simpan; **Batal** pada dialog ubah kedua; tugas "Cek panel lantai 1" → status *(cek pilihan)* Belum mulai / Dikerjakan / Selesai → **Dikerjakan**; buat tugas `Tugas hapus UAT` lalu **Hapus tugas** → "Hapus tugas ini?" → Konfirmasi.

**Harus terlihat:** tugas baru tampil dengan tenggat 6 Desember; status "Cek panel lantai 1" Dikerjakan setelah F5; tugas hapus hilang. Uji salah: Judul kosong → tidak bisa disimpan. ⚠️ Tidak ada pesan sukses setelah simpan/hapus.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E7 ⚠️. Unggah bukti proyek (semua kolom)

Tab **Bukti** → form "Unggah bukti".

| Isian | Isi dengan |
|---|---|
| Selfie (seharusnya "File") | PDF bukti pengujian |
| Jenis *(cek pilihan)* | Pengujian / Pelatihan / BAST / Foto (bawaan) / Lainnya; pilih **Pengujian** |
| Tugas *(cek pilihan)* | "Belum ditugaskan" + tugas proyek; pilih **Cek panel lantai 1** |
| Catatan | `Hasil uji panel lantai 1` |

**Klik:** Unggah bukti.

**Harus terlihat:** bukti muncul di daftar dengan jenis Pengujian dan tugasnya. Uji salah: tanpa file → pesan meminta file. ⚠️ Label file tertulis "Selfie" dan pesan tanpa file "Ambil atau pilih selfie dulu"; tidak ada pesan sukses.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E8 ⚠️. Pekerja bukan PIC (login portal `hr_seed`)

`hr_seed` sudah ditugasi "Pasang reader pintu UAT" (E6). Masuk portal sebagai `hr_seed` → **Proyek** → `PRJ-DEMO-001`.

**Harus terlihat:** proyek tampil (tanpa badge PIC); tab Tugas: `hr_seed` bisa mengubah status tugasnya sendiri saja; tab **Kunjungan lokasi saya**: bisa check-in (E2) dan melihat kunjungannya sendiri. ⚠️ Dugaan: tab kunjungan menampilkan "Gagal" + "Hanya penanggung jawab proyek yang bisa melakukan ini"; pilihan status juga muncul di tugas orang lain lalu ditolak server ("Hanya petugas atau manajer proyek…"). Sebaliknya PIC melihat kunjungan semua orang di tab "saya", dan Check-out di baris orang lain gagal "Proyek tidak ditemukan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E9 ⚠️. Admin melihat kunjungan lokasi (login `admin` di admin ERP)

Buka proyek `PRJ-DEMO-001` di admin **Proyek**.

**Harus terlihat:** daftar kunjungan lokasi (tanggal, karyawan, jarak, Dalam/Di luar radius, selfie). ⚠️ Dugaan: tidak ada layar admin untuk kunjungan lokasi atau selfie; hanya PIC di portal yang bisa melihat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## F. Cuti dan lembur

### F1. Kuota dan pengajuan seed (akun demo)

Menu **Cuti** ("Ajukan cuti; keputusan tetap di HR").

**Harus terlihat:** kartu kuota per jenis: Cuti tahunan "2 dari 12 hari terpakai" (cuti seed yang masih menunggu ikut dihitung), jenis tanpa kuota "Tidak dibatasi". Daftar: "Cuti tahunan · {+3} → {+4}", "2 hari", "Menunggu persetujuan". ❓ Hari yang masih menunggu dihitung "terpakai".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Ajukan cuti (semua kolom)

Form "Ajukan cuti":

| Isian | Isi dengan |
|---|---|
| Jenis cuti *(cek pilihan)* | Cuti tahunan / Cuti khusus (menikah, melahirkan, duka) / Sakit / Izin; pilih **Cuti tahunan** (tanpa placeholder; tombol mati sampai dipilih) |
| Alasan | `Urusan keluarga UAT` (opsional) |
| Tanggal mulai | 14 Desember 2026 (bawaan hari ini) |
| Tanggal selesai | 15 Desember 2026 (bawaan hari ini) |

**Klik:** Ajukan cuti.

**Harus terlihat:** "Pengajuan terkirim"; daftar: "Cuti tahunan · 2026-12-14 → 2026-12-15", "2 hari", Menunggu persetujuan; kuota "4 dari 12 hari terpakai". Ajukan juga **Izin** 21 Desember 2026, alasan `Uji tolak` (untuk F5).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Uji salah cuti

- Tanggal selesai 13 Desember (sebelum mulai 14) → "Tanggal selesai sebelum tanggal mulai".
- Mulai dan selesai Minggu 20 Desember 2026 → "Rentang tanggal tidak berisi hari kerja (Minggu tidak dihitung)".
- 14–15 Desember lagi → "Karyawan sudah punya cuti di tanggal tersebut".
- Cuti tahunan 1–31 Januari 2027 dengan sisa tidak cukup → "Sisa cuti tahun ini tidak cukup: sisa {n} hari, diajukan {m}".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F4. HR menyetujui cuti (login `hr_seed` di admin)

Admin **Sumber Daya Manusia → Cuti** → baris cuti 14–15 Desember akun demo → **Setujui**.

**Harus terlihat:** status Disetujui di admin; portal (F5) juga "Disetujui". `hr_seed` tidak bisa menyetujui cuti yang ia catat sendiri (pesan keputusan sendiri), tetapi pengajuan dari portal dicatat oleh karyawan, jadi boleh.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F5. HR menolak cuti (login `hr_seed` di admin)

Baris Izin 21 Desember → **Tolak** (isi alasan bila diminta: `Bentrok jadwal proyek`).

**Harus terlihat:** portal menampilkan "Ditolak"; tombol **Batalkan pengajuan** tidak ada di baris ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F6 ❓. Batalkan pengajuan (akun demo)

Baris cuti seed (Menunggu) → **Batalkan pengajuan** → "Batalkan pengajuan ini?" → Konfirmasi. Ulangi pada cuti 14–15 Desember (sudah Disetujui).

**Harus terlihat:** "Pengajuan dibatalkan"; status Dibatalkan; kuota turun ("0 dari 12 hari terpakai" setelah keduanya). Membatalkan lagi → "Pengajuan ini sudah ditolak atau dibatalkan". ❓ Karyawan bisa membatalkan cuti yang **sudah disetujui** tanpa HR.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F7. Catat lembur (semua kolom)

Menu **Lembur** ("Catat lembur; keputusan tetap di HR"). Daftar sudah berisi lembur seed kemarin 2 jam Disetujui. Form "Catat lembur":

| Isian | Isi dengan |
|---|---|
| Tanggal kerja | hari ini (bawaan) |
| Jam | `2.5` (bawaan 1; langkah 0,25; 0,25–24) |
| Alasan | `Lembur instalasi UAT` (opsional) |

**Klik:** Catat lembur.

**Harus terlihat:** "Pengajuan terkirim"; daftar: hari ini, "2.5 jam" (atau "2,5 jam"), Menunggu persetujuan. `hr_seed` di admin **Sumber Daya Manusia → Lembur** → **Setujui** → portal "Disetujui".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F8 ⚠️. Uji salah lembur

- Jam `0` atau `25` → ditolak.
- Jam `1.1` (bukan kelipatan 0,25) → ditolak.
- Cari tombol batal pada lembur yang masih Menunggu.

**Harus terlihat:** isian salah ditolak dengan pesan yang dimengerti. ⚠️ Tidak ada tombol batal lembur (beda dengan cuti). ⚠️ Lembur seed tercatat "disetujui" oleh karyawan itu sendiri, padahal alur asli melarang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## G. Dokumen dan tanda tangan (akun demo)

### G1. Daftar dokumen

Menu **Berkas** (judul "Dokumen", "Dokumen untuk Anda dan yang menunggu tanda tangan Anda"). Cari `Perjanjian` di "Cari dokumen" → **Unduh**.

**Harus terlihat:** kartu "Perjanjian Kerja - {nama}" dengan badge "Perlu tanda tangan" dan "Terbit {tanggal}". Unduh → "File belum siap" (dokumen seed tanpa file). ❓ Dokumen draf ikut tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Unggah gambar tanda tangan

Menu **Tanda tangan** (judul "Permintaan tanda tangan", "Permintaan yang ditujukan kepada Anda"). Kartu "Tanda tangan saya" ("Unggah gambar yang dipakai saat menandatangani dokumen.") → pilih PNG tanda tangan. Lalu **Hapus gambar**, lalu unggah lagi.

**Harus terlihat:** "Gambar tanda tangan tersimpan" (langsung terunggah saat dipilih); "Gambar tanda tangan dihapus" → "Belum ada gambar tanda tangan"; unggah ulang tersimpan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G3 ⚠️. Tandatangani permintaan

Saringan **Menunggu Anda** (bawaan) → baris Perjanjian Kerja (peminta, "Berlaku sampai {tanggal}") → **Tandatangani**.

**Harus terlihat:** seharusnya ada pratinjau dokumen dan konfirmasi sebelum menandatangani. ⚠️ Dugaan: satu klik langsung "Ditandatangani" tanpa pratinjau/konfirmasi, dan bisa jalan meski belum ada gambar tanda tangan. Saringan **Semua** → status "Ditandatangani".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G4 ⚠️. Tolak permintaan

Prasyarat: buat permintaan tanda tangan baru untuk akun demo di admin **Dokumen → Tanda tangan** (dokumen apa saja). Portal → baris itu → **Tolak**. Dialog "Tolak permintaan ini":

| Isian | Isi dengan |
|---|---|
| Alasan | `Isi pasal gaji belum sesuai` (wajib) |

**Klik:** Tolak (atau **Batal** dulu: dialog tertutup).

**Harus terlihat:** status "Ditolak"; peminta di admin melihat alasannya. Uji salah: Alasan kosong → tombol Tolak mati/ditolak. ⚠️ Tidak ada pesan sukses. Tanpa permintaan: "Tidak ada permintaan tanda tangan untuk Anda".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## H. Slip gaji (akun demo)

### H1. Slip gaji sebelum disetujui

Menu **Penggajian** (judul "Slip Gaji", "Slip gaji Anda yang sudah disetujui, terbaru lebih dulu"). Bulan berjalan masih Draf di admin.

**Harus terlihat:** "Belum ada slip gaji untuk Anda" (gaji draf tidak tampil).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2. Slip gaji setelah disetujui

Admin: `hr_seed` menambah baris gaji akun demo di **Sumber Daya Manusia → Penggajian** (Pokok Rp 5.000.000, Tunjangan Rp 500.000, Lembur Rp 250.000, Bonus Rp 300.000, Potongan Rp 100.000 → bersih Rp 5.950.000 bila PPh 21/BPJS mati), lalu `admin` **Setujui bulan ini**. Portal: F5 halaman Slip Gaji → **Unduh**.

**Harus terlihat:** kartu Periode (nama bulan), Gaji bersih **Rp 5.950.000**; badge "Sedang dibuat" sampai PDF siap; Unduh membuka PDF slip yang angkanya sama. `hr_seed` di portal tidak melihat slip akun demo.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 39 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan portal karyawan:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

Disusun dari kode 2026-11-26, belum dijalankan di aplikasi.

1. **Tab "Kunjungan lokasi saya" hanya untuk PIC**: memanggil `/projects/me/projects/:id/site-attendance` yang dibatasi PIC (`apps/web-employee/src/lib/project-api.ts:210-214`, `apps/backend/src/app/project/controllers/portal-project.controller.ts:114-118`, `apps/backend/src/app/project/services/site-attendance.service.ts:208-216`). Pekerja bukan PIC melihat "Gagal"; PIC melihat kunjungan semua orang.
2. **Cek "tugas saya" keliru**: `apps/web-employee/src/routes/_authed.projects.$projectId.tsx:193` menganggap tugas yang bukan milik PIC sebagai milik pengguna.
3. **Di luar radius tidak ditolak**, hanya ditandai `out_of_range` (`site-attendance.service.ts:119-176`, repository `site-attendance.repository.ts:65-105`); radius dari setting `attendance/site_radius_meters`, bawaan 100 m, tetapi petunjuk "Radius 100 m" ditulis mati di `apps/web-employee/src/components/projects/selfie-capture.tsx:137`. Tidak ada cek radius saat check-out.
4. **Label keliru**: kolom status kunjungan berjudul "Tahap" (`_authed.projects.$projectId.tsx:402`); file bukti berlabel "Selfie" (`:276`) dan pesan tanpa file memakai teks selfie (`:100`); galat lokasi saat check-out tidak diterjemahkan (`:136-148`).
5. **Login**: `portal-denied` jatuh ke `login.googleFailed` sehingga pesan ganda (`apps/web-employee/src/routes/login/index.tsx:54`, `apps/web-employee/src/lib/login-error.ts:85-87`); tautan "Lupa kata sandi Anda?" ke `/forgot-password` yang tidak ada (`apps/web-employee/src/components/form/login-form.tsx:182`). Bahasa awal English (`packages/locales/src/index.ts:42`).
6. **Profil**: enum mentah Inggris di kartu Kepegawaian (`apps/web-employee/src/routes/_authed.profile.tsx`); Telepon memakai `inputMode` saja, bukan `type="tel"`.
7. **Notifikasi**: klik item tidak membuka apa pun (`apps/web-employee/src/components/notification/notification-bell.tsx:46`); tombol per baris berlabel "Tandai semua dibaca" (`_authed.notifications.tsx:71`); `/signature` dan `/notifications` tanpa label breadcrumb (`apps/web-employee/src/components/layout/build-crumbs.ts:33-44`). Teks cadangan "Something went wrong" (`apps/web-employee/src/components/empty-state.tsx:451-453`) dan "Request failed" (`apps/web-employee/src/lib/portal-api.ts:146`) masih Inggris.
8. **Absensi kantor** tanpa lokasi/selfie/cek jadwal (`apps/backend/src/app/human-resource/services/employee-portal.service.ts:205-235`); admin `/hr/attendance` tidak membedakan `source=self`. Tidak ada layar admin untuk kunjungan lokasi/selfie.
9. **Seed rapuh**: akun demo dipilih dengan `.limit(1)` tanpa `ORDER BY` (`apps/backend/database/seeders/seed/portal-demo.seeder.ts:43-62`, juga di `project-demo.seeder.ts`), jadi orangnya tidak pasti dan kedua seeder bisa memilih orang berbeda; pakai yang tercetak di log. Role `technician` tidak mendapat data karyawan (`apps/backend/database/seeders/seed/hr.seeder.ts:21-28`). Lembur seed disetujui oleh pemohon sendiri. Tugas HR, gaji disetujui, dan notifikasi karyawan tidak di-seed.
10. **Rencana vs kode**: `docs/plan/kontrak/modul/m08-employees-attendance.md:61,66` masih menulis "No GPS integration" dan "No employee self-service app", sedangkan backlog ERP-0159/0160/0161/0164 (`docs/plan/backlog.md:183-188`) sudah membangunnya; tidak ada ADR untuk portal karyawan atau PostGIS. `docs/architecture/role-permission.md` (sekitar baris 761-768, 981-998, 1334-1346) mencatat route ber-guard `employee-portal` sebagai "no guard macro" karena generator belum mengenali guard itu.
11. **Label menu admin**: kode memakai bagian "Sumber Daya Manusia" (`packages/locales/src/id/nav.ts:13`), sedangkan UAT M08 menulis "Karyawan & Kehadiran"; samakan saat uji.
12. Hak `self_service` ada di role `member` dan `technician` (`packages/common/src/authorization/erp-permissions.ts:569-574, 677-690`) tetapi route portal tidak memeriksanya; akses ditentukan data karyawan dan role aplikasi (`apps/backend/src/authorization/employee-portal-guard.ts:11-15,66`).
