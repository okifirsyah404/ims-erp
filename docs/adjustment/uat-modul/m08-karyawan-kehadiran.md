# UAT M08 - Karyawan & Kehadiran (T10)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Data awal:** 29 karyawan dari seed (`EMP-00001` sampai `EMP-00029`, semuanya Aktif, tanggal masuk kosong) dan 4 jenis cuti: Cuti tahunan (kuota 12 hari), Cuti khusus (menikah, melahirkan, duka), Sakit, Izin. Belum ada absensi, cuti, lembur, gaji, atau tugas.

**Alur yang diuji:** karyawan → rekening gaji → absensi (manual dan impor) → cuti → lembur → rekap gaji bulanan + persetujuan Pemilik → tugas.

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), file impor, dan setiap kolom di file impor. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun:** `hr_seed` (password `hr123456`), `finance_seed` (`finance123456`), `admin_seed` (`admin123456`), `technician_seed` (`technician123456`), dan `admin` (Pemilik, password di `apps/backend/.env`, lihat README).

**Status:**

| Hal | Nilai |
|---|---|
| Karyawan | Aktif, Nonaktif, Berhenti |
| Absensi | Hadir, Izin, Sakit, Cuti, Alpa, Libur (belum diisi: "Belum diisi") |
| Cuti dan lembur | Menunggu, Disetujui, Ditolak, Dibatalkan |
| Gaji per bulan | Kosong → Draf → Disetujui (terkunci) |
| Tugas | Terbuka, Selesai, Dibatalkan |

**Data contoh yang dipakai selama UAT** (nama karyawan seed sesuai data 2026-11-25; bila beda, pegang kodenya):

| Data | Nilai |
|---|---|
| Karyawan baru | Rina Kusuma UAT, `rina.uat@entragate.test`, kode otomatis (mis. `EMP-00030`), masuk 2 November 2026 |
| Karyawan A | `EMP-00003` Samosir Daruna (cuti, lembur, gaji) |
| Karyawan B | `EMP-00004` Cahya Cahya Prasetyo |
| Karyawan C | `EMP-00005` Najwa Hasanah |
| Karyawan yang diarsipkan | `EMP-00029` Elma Elma Pratiwi |
| Tanggal absensi manual | hari ini (contoh: 25 November 2026) |
| Tanggal absensi impor | 24 November 2026 (benar), 23 November 2026 (salah) |
| Cuti | 4–7 Desember 2026 (Jumat–Senin, Minggu 6 Des tidak dihitung = 3 hari) |
| Lembur | Karyawan A, hari ini, 2,5 jam |
| Gaji November | Karyawan A: Pokok Rp 5.000.000, Tunjangan Rp 500.000, Uang lembur Rp 250.000, Bonus Rp 300.000, Potongan Rp 100.000 → bersih Rp 5.950.000 |

**Cara membuat file impor.** Bisa `.xlsx` (dari tombol Unduh template) atau `.csv` (pemisah koma atau titik koma), maksimal 2 MB dan 2000 baris. Baris 1 adalah judul kolom dan tidak dibaca; nomor "Baris N" di pesan kesalahan menghitung baris judul (baris data pertama = Baris 2). **Hapus baris contoh bawaan template**: kodenya `EMP-0001` / `EMP-0002` (4 digit), sedangkan kode karyawan sebenarnya `EMP-00001` (5 digit), jadi baris contoh akan ditolak.

---

## A. Karyawan

### A1. Buat karyawan baru dengan undangan (login `hr_seed`, semua kolom)

Menu **Karyawan & Kehadiran → Karyawan** → tombol **Karyawan baru**. Judul "Karyawan baru", satu kartu **Identitas**.

| Isian | Isi dengan |
|---|---|
| Nama lengkap | `Rina Kusuma UAT` (wajib) |
| Email login | `rina.uat@entragate.test` (wajib; petunjuk "Tautan invitasi dikirim ke alamat ini; alamat menjadi login karyawan.") |
| Telepon | kode negara Indonesia +62 (bawaan), nomor `81211112222` (opsional) |
| NIK | `3201010101900001` (opsional) |
| Tipe kepegawaian *(cek pilihan)* | Tetap / Kontrak / Percobaan / Magang / Alih daya; bawaan **Tetap**, pilih **Kontrak** |
| Tipe kerja *(cek pilihan)* | Onsite / Remote / Hybrid; bawaan **Onsite**, pilih **Hybrid** |
| Tanggal masuk | 2 November 2026 (opsional) |

**Uji salah** (sebelum isian di atas disimpan):
- Nama lengkap atau Email login kosong → tombol **Invitasi & buat** tidak bisa diklik.
- Email login `rina.uat@` (format salah) → ditolak server dengan pesan validasi; tidak ada karyawan yang dibuat.
- Telepon `123` → muncul "Masukkan nomor telepon yang valid." di bawah kolom.

**Klik:** Invitasi & buat.
**Harus terlihat:** pesan "Karyawan EMP-000xx dibuat; email invitasi sedang dikirim" (kode berikutnya, mis. `EMP-00030`); halaman pindah ke detail karyawan dengan status **Aktif**. Di Mailpit (http://localhost:8025) ada email undangan ke `rina.uat@entragate.test`.

Lalu buka lagi **Karyawan baru**, isi Nama lengkap `Rina Duplikat`, Email login `rina.uat@entragate.test`, klik **Invitasi & buat** → ditolak "Email atau kode login sudah dipakai karyawan lain".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Batal membuat karyawan

**Karyawan baru** → isi Nama lengkap `Batal UAT`, Email login `batal.uat@entragate.test` → klik **Batal**.
**Harus terlihat:** kembali ke daftar Karyawan; cari `Batal UAT` di kotak "Cari nama, kode, atau email…" (tekan Enter) → tidak ada; tidak ada email ke `batal.uat@entragate.test` di Mailpit.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Cek detail karyawan setelah muat ulang

Buka detail **Rina Kusuma UAT**, tekan F5.
**Harus terlihat:** judul `Rina Kusuma UAT` dengan kode di bawahnya dan lencana **Aktif**. Kartu **Detail**:

| Baris | Nilai |
|---|---|
| Kode karyawan | `EMP-000xx` (sama dengan A1) |
| Email login | `rina.uat@entragate.test` |
| Telepon | `+6281211112222` |
| NIK | `3201010101900001` |
| Tipe kepegawaian | Kontrak |
| Tipe kerja | Hybrid |
| Tanggal masuk | 2/11/2026 (format tanggal bawaan browser) |
| Company-level | — |

Ada juga kartu **Rekening gaji** ("Belum ada rekening.") dan kartu **Sisa cuti 2026**: Cuti tahunan "Sisa 12 dari 12 hari (0 terpakai, 0 menunggu)". Di daftar Karyawan, kartu Rina menampilkan email dan "Kontrak · Hybrid".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Klaim undangan dan login

Buka email undangan di Mailpit → klik tautannya. Halaman "Siapkan akun Anda" terbuka, dengan teks "Hai Rina Kusuma UAT — undangan ini untuk rina.uat@entragate.test…".

| Isian | Isi dengan |
|---|---|
| Nama pengguna | `rina_uat` (3-30 huruf, angka, `-`, `_`) |
| Kata sandi | `rinauat123` |
| Nomor telepon | Kode negara Indonesia, nomor `81211112222` (wajib di halaman ini) |

**Uji salah:**
- Nama pengguna `ri` → "Gunakan 3-30 huruf, angka, tanda hubung, atau garis bawah."
- Nama pengguna `hr_seed` → "Nama pengguna sudah digunakan."
- Kata sandi `abc` → "Kata sandi minimal 8 karakter."
- Nomor telepon kosong → "Masukkan nomor telepon yang valid."

**Klik:** Buat akun.
**Harus terlihat:** "Nama pengguna tersedia." saat mengetik `rina_uat`; setelah klik, akun dibuat dan bisa login sebagai `rina_uat`. Tautan yang sama bila dibuka lagi menampilkan "Undangan tidak tersedia".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5 ⚠️. Ubah data karyawan (login `hr_seed`)

Buka detail **Rina Kusuma UAT**. Cari tombol untuk mengubah Nama lengkap, Email login, Telepon, NIK, Tipe kepegawaian, Tipe kerja, Tanggal masuk, atau status (Aktif/Nonaktif/Berhenti).
**Temuan yang diperkirakan:** tidak ada tombol ubah data. Di detail hanya ada **Ubah rekening** (A6) dan **Arsipkan** (A8). Status Nonaktif dan Berhenti tidak bisa dipilih di mana pun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A6. Isi dan ubah rekening gaji

Detail **Rina Kusuma UAT** → kartu **Rekening gaji** → **Ubah rekening**.

| Isian | Isi dengan |
|---|---|
| Bank | `BCA` (wajib, maks. 100 karakter) |
| Nomor rekening | `1234567890` (wajib, hanya angka, spasi, `-`) |
| Atas nama | terisi otomatis `Rina Kusuma UAT`; biarkan (wajib) |

**Uji salah:**
- Ketik huruf di Nomor rekening (`12AB34`) → huruf langsung hilang, tersisa `1234`.
- Nomor rekening `12` (kurang dari 3 digit) → ditolak server dengan pesan validasi.
- Kosongkan Bank → browser menolak (kolom wajib).
- Isi Bank `Mandiri`, lalu klik **Batal** → form tertutup, rekening tidak berubah.

**Klik:** Simpan rekening.
**Harus terlihat:** "Rekening disimpan"; tampil Bank `BCA`, Nomor rekening `1234567890`, Atas nama `Rina Kusuma UAT`.

Lalu **Ubah rekening** lagi: semua kolom terisi nilai lama. Ubah Bank `BNI`, Nomor rekening `0987654321`, Atas nama `Rina K` → **Simpan rekening** → tekan F5.
**Harus terlihat:** setelah F5 tampil BNI, `0987654321`, Rina K.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A7. Cari dan saring daftar karyawan

Menu **Karyawan**.

| Isian | Isi dengan |
|---|---|
| Cari nama, kode, atau email… | `rina` lalu Enter → hanya Rina; ganti `EMP-00003` lalu Enter → hanya Samosir Daruna; kosongkan lalu Enter |
| Status *(cek pilihan)* | Semua status / Aktif / Nonaktif / Berhenti; pilih **Nonaktif** → "Belum ada karyawan"; kembalikan **Semua status** |

**Harus terlihat:** hasil sesuai saringan; 12 kartu per halaman dengan tombol halaman bila lebih dari 12.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A8 ⚠️. Arsipkan karyawan

Di daftar Karyawan, cari `EMP-00029` → di kartunya klik **Arsipkan**.
**Harus terlihat:** "Karyawan diarsipkan"; kartu `EMP-00029` hilang dari daftar (juga dengan saringan Nonaktif/Berhenti), dan tidak muncul lagi di pilihan Karyawan pada Cuti/Lembur/Tugas.
**Temuan yang diperkirakan:** tidak ada dialog konfirmasi; status tidak berubah menjadi Nonaktif/Berhenti (karyawan dihapus lunak dan hilang).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A9. Keuangan membuka detail karyawan (login `finance_seed`)

Menu **Karyawan & Kehadiran → Karyawan** → buka **Rina Kusuma UAT**.
**Harus terlihat:** NIK lengkap `3201010101900001` dan nomor rekening lengkap `0987654321`. **Tidak ada** tombol Karyawan baru, Arsipkan, atau Ubah rekening. Kartu Sisa cuti tidak tampil. Di menu hanya ada Karyawan dan Penggajian.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A10. Admin organisasi hanya melihat (login `admin_seed`)

Menu **Karyawan & Kehadiran → Karyawan** → buka **Rina Kusuma UAT**.
**Harus terlihat:** data tampil, tetapi NIK dan nomor rekening tersamar (hanya angka terakhir terlihat). Tidak ada tombol Karyawan baru, Arsipkan, atau Ubah rekening. Di menu ada Karyawan dan Absensi saja.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. Absensi

### B1. Isi lembar harian (login `hr_seed`, semua kolom)

Menu **Karyawan & Kehadiran → Absensi**. Tombol tampilan **Lembar harian** (aktif) / **Rekap bulanan**; kolom Tanggal = hari ini (bawaan). Kolom tabel: Karyawan, Status, Masuk, Pulang, Catatan. Semua baris awalnya "Belum diisi"; Masuk, Pulang, Catatan abu-abu sampai Status dipilih.

1. Klik **Isi baris kosong dengan Hadir**: semua baris jadi Hadir.
2. Isi baris berikut:

| Karyawan | Status *(cek pilihan)* | Masuk | Pulang | Catatan |
|---|---|---|---|---|
| `EMP-00003` | Hadir | `08:00` | `17:00` | `Tepat waktu` |
| `EMP-00004` | **Sakit** | kosong | kosong | `Demam` |
| `EMP-00005` | **Libur** | kosong | kosong | kosong |

Pilihan Status harus: Belum diisi (abu-abu, tidak bisa dipilih) / Hadir / Izin / Sakit / Cuti / Alpa / Libur.

**Uji salah:** `EMP-00003` Masuk `17:00`, Pulang `08:00` → klik **Simpan hari ini** → ditolak "Jam pulang lebih awal dari jam masuk"; tidak ada yang tersimpan. Kembalikan ke 08:00 / 17:00.

**Klik:** Simpan hari ini.
**Harus terlihat:** pesan "N disimpan, 0 hari cuti tetap" (N = jumlah baris, sekitar 29: 28 karyawan seed + Rina). Tekan F5: semua isian (status, jam, catatan) tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Ubah lembar harian

Masih di hari ini. Ubah `EMP-00005` dari Libur ke **Izin**, Catatan `Urus KTP`; hapus Catatan `EMP-00003`. Klik **Simpan hari ini** → F5.
**Harus terlihat:** pesan "N disimpan, 0 hari cuti tetap"; setelah F5 `EMP-00005` Izin dengan catatan `Urus KTP`, Catatan `EMP-00003` kosong.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Rekap bulanan

Klik **Rekap bulanan** → Bulan November 2026.
**Harus terlihat:** kolom Karyawan, Hadir, Izin, Sakit, Cuti, Alpa, Libur. `EMP-00004` Sakit = 1; `EMP-00005` Izin = 1; karyawan lain Hadir = 1; kolom lain "—". Ganti Bulan ke Oktober 2026 → semua "—".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Impor 3 baris benar (semua kolom)

Klik **Impor** (kanan atas) → dialog "Impor dari spreadsheet" dengan petunjuk "Gunakan template (.xlsx atau .csv, maksimal 2 MB). Jika ada baris yang salah, tidak ada yang diimpor." → **Unduh template** (file `template-absensi.xlsx`, kolom `kode_karyawan`, `tanggal`, `status`, `jam_masuk`, `jam_pulang`, `catatan`). Hapus baris contoh, lalu isi:

| kode_karyawan | tanggal | status | jam_masuk | jam_pulang | catatan |
|---|---|---|---|---|---|
| `EMP-00003` | `2026-11-24` | `hadir` | `08:00` | `17:00` | `Impor UAT` |
| `EMP-00004` | `2026-11-24` | `izin` | | | `Urusan keluarga` |
| `EMP-00005` | `2026-11-24` | `alpa` | | | |

Status boleh: `hadir`, `izin`, `sakit`, `cuti`, `alpa` (atau `alpha`), `libur`. Tanggal `YYYY-MM-DD`, jam `HH:MM`.

Isian **File**: pilih file tadi. **Klik:** Impor.
**Harus terlihat:** pesan "3 baris diimpor"; dialog tertutup. Lembar harian 24 November 2026: `EMP-00003` Hadir 08:00–17:00 catatan `Impor UAT`, `EMP-00004` Izin catatan `Urusan keluarga`, `EMP-00005` Alpa.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Impor file dengan baris salah

File 1, satu baris salah:

| kode_karyawan | tanggal | status | jam_masuk | jam_pulang | catatan |
|---|---|---|---|---|---|
| `EMP-00003` | `2026-11-23` | `hadir` | `08:00` | `17:00` | |
| `EMP-00004` | `2026-11-23` | `masuk` | | | |
| `EMP-00005` | `2026-11-23` | `hadir` | | | |

**Klik:** Impor → pilih file → Impor.
**Harus terlihat:** dialog tetap terbuka dengan kotak merah "Tidak ada yang diimpor. Perbaiki baris berikut lalu coba lagi:" dan "Baris 3: status tidak dikenal (masuk)". Lembar harian 23 November 2026 tetap kosong untuk ketiga karyawan.

File 2, setiap jenis kesalahan (kode Rina dari A1):

| Baris | kode_karyawan | tanggal | status | jam_masuk | jam_pulang | Pesan yang diharapkan |
|---|---|---|---|---|---|---|
| 2 | `EMP-99999` | `2026-11-23` | `hadir` | | | "Baris 2: kode karyawan tidak dikenal (EMP-99999)" |
| 3 | kode Rina | `2026-11-01` | `hadir` | | | "Baris 3: karyawan belum/tidak bekerja pada tanggal itu" |
| 4 | `EMP-00003` | `23-11-2026` | `hadir` | | | "Baris 4: tanggal tidak valid (pakai YYYY-MM-DD) (23-11-2026)" |
| 5 | `EMP-00004` | `2026-11-23` | `hadir` | `17:00` | `08:00` | "Baris 5: jam tidak valid (pakai HH:MM; pulang setelah masuk)" |
| 6 | `EMP-00005` | `2026-11-23` | `hadir` | `25:00` | | "Baris 6: jam tidak valid (pakai HH:MM; pulang setelah masuk)" |
| 7 | `EMP-00005` | `2026-11-23` | `sakit` | | | "Baris 7: muncul dua kali di file" (sama dengan baris 6) |

**Harus terlihat:** semua pesan di atas tampil sekaligus; tidak ada yang diimpor.

File lain:
- File `.txt` (pilih "Semua file" di jendela pilih file) → pesan "Unggah file .xlsx atau .csv".
- File `.csv` berisi hanya baris judul → pesan "File tidak berisi baris data".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Batal impor

**Impor** → pilih file B4 → klik **Batal**.
**Harus terlihat:** dialog tertutup, tidak ada pesan, tidak ada data berubah. Buka **Impor** lagi: kolom File kosong dan tombol **Impor** tidak bisa diklik sebelum file dipilih.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7. Admin organisasi mengisi absensi (login `admin_seed`)

Menu **Karyawan & Kehadiran → Absensi** → Lembar harian, tanggal 23 November 2026 → **Isi baris kosong dengan Hadir** → **Simpan hari ini**.
**Harus terlihat:** tombol Impor juga tampil; pesan "N disimpan, 0 hari cuti tetap". (Admin boleh mencatat absensi.)

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Cuti dan lembur

### C1. Catat cuti tahunan (login `hr_seed`, semua kolom)

Menu **Karyawan & Kehadiran → Cuti** → tombol **Catat cuti**.

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "Pilih karyawan" lalu daftar karyawan aktif `KODE — Nama` urut nama (tanpa `EMP-00029`); pilih `EMP-00003 — Samosir Daruna` (wajib) |
| Jenis cuti *(cek pilihan)* | — / Cuti tahunan / Izin / Sakit / Cuti khusus (menikah, melahirkan, duka); pilih **Cuti tahunan** (wajib) |
| Dari | bawaan hari ini; pilih 4 Desember 2026 (Jumat) |
| Sampai | bawaan hari ini; pilih 7 Desember 2026 (Senin; tanggal sebelum "Dari" tidak bisa dipilih) |
| Alasan | `Liburan keluarga` (opsional, maks. 1000 karakter) |

**Harus terlihat sebelum klik:** di bawah Jenis cuti tertulis "Sisa 12 dari 12 hari (0 terpakai, 0 menunggu)". Pilih Jenis cuti Sakit sebentar → tulisan sisa hilang (bukan cuti berkuota); kembalikan ke Cuti tahunan.
**Klik:** Catat cuti.
**Harus terlihat:** pesan "Cuti dicatat; menunggu persetujuan". Di daftar: Karyawan Samosir Daruna `EMP-00003`; Jenis cuti Cuti tahunan dengan alasan `Liburan keluarga` di bawahnya; Dari "4 Desember 2026 – 7 Desember 2026"; Hari **3** (Minggu 6 Des tidak dihitung, Sabtu dihitung); status **Menunggu**. Detail karyawan `EMP-00003` → kartu Sisa cuti: "Sisa 9 dari 12 hari (0 terpakai, 3 menunggu)".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Uji salah cuti

**Catat cuti** lagi, Karyawan `EMP-00003 — Samosir Daruna`.

| Isian yang salah | Pesan yang diharapkan |
|---|---|
| Karyawan atau Jenis cuti kosong | tombol **Catat cuti** tidak bisa diklik |
| Cuti tahunan, Dari 8 Desember 2026, Sampai 19 Desember 2026 (11 hari tanpa Minggu 13 Des) | "Sisa cuti tahun ini tidak cukup: sisa 9 hari, diajukan 11" (sebelum klik tertulis "Sisa 9 dari 12 hari (0 terpakai, 3 menunggu)") |
| Sakit, Dari dan Sampai 6 Desember 2026 (Minggu saja) | "Rentang tanggal tidak berisi hari kerja (Minggu tidak dihitung)" |
| Sakit, Dari 5 Desember 2026, Sampai 5 Desember 2026 (tumpang tindih dengan C1) | "Karyawan sudah punya cuti di tanggal tersebut" |
| Sakit, Sampai 9 Desember 2026, lalu ubah Dari ke 10 Desember 2026 | "Tanggal selesai sebelum tanggal mulai" |

Terakhir klik **Batal**.
**Harus terlihat:** setiap isian ditolak dengan pesan di atas; tidak ada baris baru di daftar.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3 ⚠️. HR menyetujui cuti yang ia catat sendiri

Di daftar Cuti, lihat baris C1 (kolom Tindakan).
**Harus terlihat:** tidak ada tombol Setujui/Tolak; yang ada tulisan "Anda yang mencatat: orang lain yang memutuskan". Server juga menolak dengan "Persetujuan harus oleh orang lain, bukan yang mencatat pengajuan". Dengan satu HR, persetujuan harus oleh Pemilik. Sesuai?
**Temuan yang diperkirakan:** tombol **Batalkan** juga tidak muncul bagi pencatat selama status Menunggu.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Pemilik menyetujui cuti (login `admin`)

Menu **Karyawan & Kehadiran → Cuti** → baris C1 → menu Tindakan → **Setujui**.
**Harus terlihat:** pesan "Disetujui"; status **Disetujui**. Di **Absensi** → Lembar harian 4, 5, dan 7 Desember 2026: baris `EMP-00003` berlabel "Cuti · Dari cuti" dan tidak bisa diubah. 6 Desember (Minggu) tidak terisi. Kartu Sisa cuti: "Sisa 9 dari 12 hari (3 terpakai, 0 menunggu)".

**Uji salah:** impor absensi (login `hr_seed`) baris `EMP-00003`, `2026-12-04`, `hadir` → "Baris 2: adalah hari cuti yang sudah disetujui"; tidak ada yang diimpor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Batalkan cuti yang sudah disetujui (login `hr_seed`)

Daftar **Cuti** → baris C1 → menu Tindakan → **Batalkan**.
**Harus terlihat:** pesan "Dibatalkan"; status **Dibatalkan** (tanpa dialog konfirmasi). Absensi 4, 5, 7 Desember untuk `EMP-00003` kembali "Belum diisi". Kartu Sisa cuti kembali "Sisa 12 dari 12 hari (0 terpakai, 0 menunggu)".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6 ⚠️. Tolak cuti (tanpa alasan)

`hr_seed`: **Catat cuti** → Karyawan `EMP-00004 — Cahya Cahya Prasetyo`, Jenis cuti **Cuti khusus (menikah, melahirkan, duka)**, Dari 14 Desember 2026, Sampai 15 Desember 2026, Alasan `Pernikahan saudara` → **Catat cuti**.
`admin`: baris tersebut → Tindakan → **Tolak**.
**Harus terlihat:** pesan "Ditolak"; status **Ditolak**; tidak ada pilihan tindakan lagi pada baris itu. Tidak ada tulisan sisa kuota saat mencatat (Cuti khusus tanpa kuota).
**Temuan yang diperkirakan:** tidak ada kotak untuk mengisi alasan penolakan; penolakan langsung tersimpan tanpa alasan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7 ⚠️. Batalkan pengajuan yang masih Menunggu

`hr_seed`: **Catat cuti** → Karyawan `EMP-00005 — Najwa Hasanah`, Jenis cuti **Sakit**, Dari dan Sampai 21 Desember 2026, Alasan kosong → **Catat cuti**. Lihat kolom Tindakan.
**Temuan yang diperkirakan:** HR (pencatat) tidak melihat **Batalkan**, hanya "Anda yang mencatat: orang lain yang memutuskan".
`admin`: baris itu → Tindakan → **Batalkan**.
**Harus terlihat:** pesan "Dibatalkan"; status **Dibatalkan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8. Catat dan setujui lembur (`hr_seed` → `admin`, semua kolom)

`hr_seed`: menu **Karyawan & Kehadiran → Lembur** → tombol **Catat lembur**.

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "Pilih karyawan" + karyawan aktif; pilih `EMP-00003 — Samosir Daruna` (wajib) |
| Tanggal | hari ini (bawaan) |
| Jam | bawaan `1`; ketik `2.5` (atau `2,5` bila browser memakai koma; kelipatan 0,25, maks. 24) |
| Alasan | `Instalasi malam UAT` (opsional, maks. 1000 karakter) |

**Uji salah:**
- Karyawan kosong atau Jam `0` → tombol **Catat lembur** tidak bisa diklik.
- Jam `2.3` → browser menolak (bukan kelipatan 0,25).
- Jam `25` → browser menolak (maks. 24).

**Klik:** Catat lembur.
**Harus terlihat:** "Lembur dicatat; menunggu persetujuan"; di daftar Tanggal hari ini, Jam 2.5, Alasan `Instalasi malam UAT`, status **Menunggu**, dan tulisan "Anda yang mencatat: orang lain yang memutuskan".

`admin`: menu **Lembur** (Bulan = bulan ini) → baris tadi → Tindakan → **Setujui**.
**Harus terlihat:** pesan "Disetujui"; status **Disetujui**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9 ⚠️. Tolak dan batalkan lembur

`hr_seed`: **Catat lembur** dua kali, Karyawan `EMP-00004 — Cahya Cahya Prasetyo`, Tanggal hari ini, Jam `1`, Alasan kosong (satu) dan `Lembur kedua` (dua).
`admin`: baris pertama → **Tolak** → "Ditolak"; baris kedua → **Batalkan** → "Dibatalkan". Lalu baris C8 (Disetujui) → **Batalkan** → "Dibatalkan".
**Harus terlihat:** status masing-masing **Ditolak** dan **Dibatalkan**; Alasan kosong tampil "—". Sebelum D1, catat ulang lembur C8 (`EMP-00003`, hari ini, 2,5 jam) dan setujui lagi oleh `admin`, supaya D1 tetap menampilkan 2,5 jam.
**Temuan yang diperkirakan:** tidak ada kotak alasan saat menolak atau membatalkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10. Saring daftar cuti dan lembur

Menu **Cuti**, lalu **Lembur**.

| Isian | Isi dengan |
|---|---|
| Status *(cek pilihan)* | Semua status / Menunggu / Disetujui / Ditolak / Dibatalkan; pilih **Dibatalkan** |
| Bulan | Cuti: bawaan kosong (semua bulan), pilih Desember 2026. Lembur: bawaan bulan ini |

**Harus terlihat:** Cuti + Dibatalkan + Desember 2026 → baris C1 dan C7; Lembur + Dibatalkan + bulan ini → dua baris dari C9 (dan C8 lama). Pilih status yang tidak ada barisnya → "Belum ada pengajuan cuti." / "Belum ada lembur.".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Rekap gaji

### D1. Tambah baris gaji bulan ini (login `hr_seed`, semua kolom)

Menu **Karyawan & Kehadiran → Penggajian**, Bulan = November 2026 (bawaan bulan ini). Status awal **Kosong**, "Belum ada baris gaji bulan ini." → tombol **Tambah baris**. Dialog "Tambah baris" dengan petunjuk "Nominal dalam rupiah."

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "Pilih karyawan" + karyawan aktif; pilih `EMP-00003 — Samosir Daruna` (wajib) |
| Pokok | `5000000` (wajib) |
| Tunjangan | `500000` |
| Uang lembur | `250000` (diketik manual, lihat catatan) |
| Bonus | `300000` |
| Potongan | `100000` |
| Gaji bersih | dihitung sendiri, tidak bisa diketik |
| Catatan | `Gaji November UAT` (opsional, maks. 1000 karakter) |

**Uji salah:**
- Karyawan kosong → tombol **Simpan** tidak bisa diklik.
- Pokok kosong → browser menolak (kolom wajib).
- Potongan `7000000` → Gaji bersih merah dan negatif, tombol **Simpan** tidak bisa diklik. Kembalikan ke `100000`.

**Harus terlihat sebelum klik:** Gaji bersih **Rp 5.950.000** (5.000.000 + 500.000 + 250.000 + 300.000 − 100.000).
**Klik:** Simpan.
**Harus terlihat:** "Baris gaji disimpan"; bulan **Draf**; kolom Pokok Rp 5.000.000, Tunjangan Rp 500.000, Uang lembur Rp 250.000, Bonus Rp 300.000, Potongan Rp 100.000, Gaji bersih Rp 5.950.000; di bawah nama tertulis "Lembur disetujui 2.5 jam" (dari C8) dan `Gaji November UAT`; baris Total sama.
**Catatan:** kolom Uang lembur **tidak** terisi otomatis dari lembur; hanya jumlah jamnya yang tampil sebagai acuan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Ubah dan hapus baris gaji

1. Baris `EMP-00003` → **Ubah baris**. **Harus terlihat:** judul "Ubah baris"; Karyawan tampil sebagai teks `Samosir Daruna` (tidak bisa diganti); semua nominal terisi nilai lama. Ubah Catatan menjadi `Gaji November UAT (revisi)` → **Simpan** → "Baris gaji disimpan" → F5 → catatan baru tetap, nominal tetap.
2. **Ubah baris** lagi → ubah Bonus `999999` → **Batal** → nilai Bonus tetap Rp 300.000.
3. **Tambah baris** → Karyawan `EMP-00004`, Pokok `1000000` → **Simpan** → baris tersebut → **Hapus**.

**Harus terlihat:** pesan "Baris dihapus" (tanpa konfirmasi); baris `EMP-00004` hilang; Total kembali Rp 5.950.000.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Isi bulan depan dari bulan lalu

Ganti Bulan ke **Desember 2026** → klik **Isi dari bulan lalu**.
**Harus terlihat:** pesan "Draf dibuat untuk karyawan yang belum punya baris"; bulan **Draf**. Baris `EMP-00003`: Pokok Rp 5.000.000, Tunjangan Rp 500.000, Uang lembur Rp 0, Bonus Rp 0, Potongan Rp 0, Gaji bersih Rp 5.500.000.
**Yang juga terjadi:** baris dibuat untuk **semua** karyawan aktif (sekitar 29, termasuk Rina, tanpa `EMP-00029`), yang lain bernilai Rp 0. Hanya Pokok dan Tunjangan yang disalin. Catat bila ini membingungkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Impor gaji dari file (semua kolom)

Masih di Desember 2026 → **Impor** → **Unduh template** (`template-gaji.xlsx`, kolom `kode_karyawan`, `gaji_pokok`, `tunjangan`, `lembur`, `bonus`, `potongan`, `catatan`). Hapus baris contoh. Nominal dalam rupiah (boleh `4.500.000`, `4500000`, atau `Rp 4.500.000`; kosong = 0).

**Uji salah** (satu file, semua salah sekaligus):

| Baris | kode_karyawan | gaji_pokok | tunjangan | lembur | bonus | potongan | Pesan yang diharapkan |
|---|---|---|---|---|---|---|---|
| 2 | `EMP-99999` | `1000000` | | | | | "Baris 2: kode karyawan tidak dikenal (EMP-99999)" |
| 3 | `EMP-00004` | `abc` | | | | | "Baris 3: nominal tidak valid (abc)" |
| 4 | `EMP-00005` | `1000000` | | | | `2000000` | "Baris 4: potongan lebih besar dari pendapatan" |
| 5 | `EMP-00005` | `1000000` | | | | | "Baris 5: muncul dua kali di file" |

**Harus terlihat:** "Tidak ada yang diimpor. Perbaiki baris berikut lalu coba lagi:" dengan semua pesan di atas; data Desember tidak berubah.

File benar:

| kode_karyawan | gaji_pokok | tunjangan | lembur | bonus | potongan | catatan |
|---|---|---|---|---|---|---|
| `EMP-00004` | `4.500.000` | `300.000` | `0` | `0` | `50.000` | `Impor UAT` |
| `EMP-00005` | `4000000` | `250000` | `150000` | | `0` | |

**Klik:** Impor.
**Harus terlihat:** "2 baris diimpor". `EMP-00004` Gaji bersih **Rp 4.750.000** dengan catatan `Impor UAT`; `EMP-00005` Uang lembur Rp 150.000, Bonus Rp 0, Gaji bersih **Rp 4.400.000**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. HR tidak bisa menyetujui

Ganti Bulan ke **November 2026**, cari tombol **Setujui bulan ini**.
**Harus terlihat:** tombol tidak ada (hanya Pemilik). Tombol Isi dari bulan lalu, Impor, dan Tambah baris tetap ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6. Pemilik menyetujui bulan ini (login `admin`)

**Penggajian** → Bulan November 2026 → **Setujui bulan ini**.
**Harus terlihat di dialog:** judul "Setujui bulan ini", "Persetujuan mengunci semua baris bulan ini." dan "Total: Rp 5.950.000". Klik **Batal** dulu → dialog tertutup, status tetap **Draf**. Buka lagi.
**Klik:** Setujui bulan ini (di dialog).
**Harus terlihat:** pesan "Bulan disetujui dan terkunci"; status **Disetujui**; tombol Ubah baris, Hapus, Tambah baris, Isi dari bulan lalu, Impor, dan Setujui bulan ini hilang untuk November. Desember tetap **Draf**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7. Keuangan mengisi tapi tidak menyetujui (login `finance_seed`)

Menu **Karyawan & Kehadiran → Penggajian**.
- November 2026: **Disetujui**, tidak ada tombol ubah.
- Desember 2026: ada Isi dari bulan lalu, Impor, Tambah baris; **tidak ada** Setujui bulan ini. Baris `EMP-00005` → **Ubah baris** → Bonus `100000` → **Simpan**.

**Harus terlihat:** "Baris gaji disimpan"; `EMP-00005` Gaji bersih **Rp 4.500.000**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

Belum ada: perhitungan payroll otomatis (T19), slip gaji, dan jurnal gaji (T20). Keduanya masih menunggu aturan gaji dari Finance.

---

## E. Tugas

### E1. Buat tugas (login `hr_seed`, semua kolom)

Menu **Karyawan & Kehadiran → Tugas** → tombol **Tugas baru**.

| Isian | Isi dengan |
|---|---|
| Karyawan *(cek pilihan)* | "Pilih karyawan" + karyawan aktif; pilih `EMP-00005 — Najwa Hasanah` (wajib) |
| Tugas | `Rapikan gudang kabel UAT` (wajib, maks. 200 karakter) |
| Rincian | `Susun ulang rak R-01` (opsional, maks. 2000 karakter) |
| Tenggat | 30 November 2026 (opsional) |

**Uji salah:**
- Karyawan kosong, atau Tugas kosong / hanya spasi → tombol **Tugas baru** di dialog tidak bisa diklik.
- Isi semua, lalu klik **Batal** → dialog tertutup, tidak ada tugas baru.

**Klik:** Tugas baru.
**Harus terlihat:** pesan "Tugas ditambahkan"; di daftar Tugas `Rapikan gudang kabel UAT` dengan rincian di bawahnya, Karyawan Najwa Hasanah, Tenggat 30 November 2026, status **Terbuka**.

Buat juga tugas kedua tanpa Rincian dan Tenggat: Karyawan `EMP-00004`, Tugas `Cek APAR kantor` → Tenggat tampil "—".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Tandai selesai

Baris E1 → menu Tindakan → **Selesai**.
**Harus terlihat:** pesan "Selesai"; baris hilang dari daftar karena saringan bawaan "Terbuka". Ganti saringan status ke **Selesai**: baris tampil dengan status **Selesai** dan pilihan Tindakan hanya **Buka lagi**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Batalkan, buka lagi, dan saring

1. Saringan Status *(cek pilihan)*: Semua status / Terbuka / Selesai / Dibatalkan. Pilih **Terbuka** → tugas `Cek APAR kantor` → **Batalkan** → pesan "Dibatalkan".
2. Saringan **Dibatalkan** → tugas itu → **Buka lagi** → pesan "Terbuka".
3. Saringan Karyawan: pilih `EMP-00005 — Najwa Hasanah` dengan status **Semua status** → hanya tugas E1.

**Harus terlihat:** status berubah sesuai tindakan; tugas yang tenggatnya lewat dan masih Terbuka ditulis merah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4 ⚠️. Ubah tugas

Cari cara mengubah Tugas, Rincian, Tenggat, atau Karyawan pada tugas E1.
**Temuan yang diperkirakan:** tidak ada tombol ubah; Tindakan hanya Selesai / Batalkan / Buka lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5 ⚠️. Teknisi membuka Tugas (login `technician_seed`)

Buka menu **Karyawan & Kehadiran → Tugas**.
**Temuan:** menu tampil untuk teknisi, PM, pekerja lepas, dan auditor. Cek apa yang terlihat dan apakah sesuai.
**Yang diperkirakan:** di menu hanya ada Tugas; tidak ada tombol Tugas baru; teknisi melihat **semua** tugas organisasi (bukan hanya tugasnya sendiri) dan bisa menandai Selesai/Batalkan/Buka lagi tugas siapa pun; pilihan saringan Karyawan kosong (hanya tulisan "Karyawan").

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

**Kesimpulan M08:** lulus / belum lulus (coret salah satu)

Catatan penguji:

---

## Catatan penyusun

**Perubahan nomor langkah (2026-11-25, versi semua kolom):**

| Lama | Baru |
|---|---|
| A1 | A1 (+ A2 Batal, A3 cek detail setelah F5, baru) |
| A2 | A4 |
| A3 | dipecah: A5 (ubah data), A6 (rekening gaji), A8 (arsipkan); A7 cari/saring baru |
| A4 | A9 |
| A5 | A10 |
| B1 | B1 (+ B2 ubah lembar harian, baru) |
| B2 | B3 |
| B3 | B4 |
| B4 | B5 (+ B6 batal impor, baru) |
| B5 | B7 |
| C1–C5 | C1–C5 (+ C6 tolak cuti, C7 batalkan pengajuan Menunggu, baru) |
| C6 | C8 (+ C9 tolak/batalkan lembur, C10 saringan, baru) |
| D1 | D1 (+ D2 ubah/hapus baris, baru) |
| D2 | D3 |
| D3 | D4 |
| D4 | D5 |
| D5 | D6 |
| D6 | D7 |
| E1, E2 | E1, E2 (+ E3 batalkan/buka lagi, E4 ubah tugas, baru) |
| E3 | E5 |

**Perbedaan dengan versi lama dan masalah yang ditemukan dari kode:**

1. **Ubah data karyawan tidak ada.** `updateEmployee` ada di `apps/web-admin/src/lib/hr-api.ts:185` tetapi tidak dipakai; detail karyawan (`apps/web-admin/src/routes/_authed/hr/employees/$employeeId.tsx`) hanya punya Ubah rekening dan Arsipkan. Backend PATCH sudah ada.
2. **Arsipkan tidak mengubah status.** Arsipkan adalah hapus lunak (`apps/backend/src/app/human-resource/services/employee.service.ts:254`); status Nonaktif/Berhenti tidak bisa diatur dari layar; tanpa konfirmasi (`apps/web-admin/src/components/hr/employee-list.tsx:248-257`, `$employeeId.tsx:117-125`).
3. **Contoh di template impor memakai kode yang tidak ada** (`EMP-0001` vs `EMP-00001`): `attendance.service.ts:142-143`, `salary.service.ts:138`.
4. **Uang lembur tidak otomatis**; hanya "Lembur disetujui X jam" (`salary.service.ts:46-50`, `apps/web-admin/src/routes/_authed/hr/payroll/index.tsx:140-142`).
5. **Isi dari bulan lalu** membuat baris untuk semua karyawan aktif dan hanya menyalin Pokok dan Tunjangan (`salary.service.ts:100-125`).
6. **Pencatat tidak bisa membatalkan pengajuannya sendiri selama Menunggu** (`apps/web-admin/src/components/hr/request-actions.tsx:31-37`), walau HR punya `leave:cancel`/`overtime:cancel`.
7. **C3 lama tertulis "Ditolak"**; di layar tombol Setujui tidak muncul sama sekali (diganti teks).
8. **Tidak ada kotak alasan saat Tolak/Batalkan** cuti dan lembur: layar selalu mengirim `null` (`apps/web-admin/src/routes/_authed/hr/leave/index.tsx:66`, `apps/web-admin/src/routes/_authed/hr/overtime/index.tsx:133`), padahal backend menerima `note` (`apps/backend/src/app/human-resource/contracts/hr-records.contract.ts:74`). Alasan keputusan juga tidak ditampilkan di daftar.
9. **Tidak ada layar ubah tugas**: endpoint `PUT /human-resources/employee-tasks/:id` ada (`docs/role-permission.md:832`), tetapi `apps/web-admin/src/lib/hr-records-api.ts` tidak punya fungsi ubah tugas.
10. **Teknisi melihat dan mengubah semua tugas organisasi** (`task.service.ts` `list`/`setStatus`; `docs/role-permission.md:832-833`); saringan Karyawan kosong karena `/human-resources/active-employees` butuh `employee:read` (`docs/role-permission.md:821`, `apps/web-admin/src/components/hr/employee-select.tsx:31`).
11. **Daftar Tugas memfilter "Terbuka" secara bawaan** (`apps/web-admin/src/routes/_authed/hr/tasks/index.tsx:42`), jadi tugas Selesai langsung hilang.
12. **Hapus baris gaji tanpa konfirmasi** (`payroll/index.tsx:156`); Batalkan cuti/lembur/tugas juga tanpa konfirmasi.
13. **Form karyawan baru bukan `<form>`**: tombol memakai `onClick` (`apps/web-admin/src/components/hr/employee-form.tsx:184-189`), sehingga cek format email bawaan browser tidak jalan dan email salah baru ditolak server. Nama lengkap tidak punya batas panjang di layar (`employee-form.tsx:99-104`) padahal server membatasi 200 (`hr.contract.ts:35`). Telepon yang tidak valid hanya memberi pesan dan dikirim kosong (`employee-form.tsx:122`), jadi karyawan tetap dibuat tanpa telepon.
14. **Data awal:** nama lengkap jenis cuti "Cuti khusus" adalah "Cuti khusus (menikah, melahirkan, duka)" (`apps/backend/database/seeders/seed/hr-leave-types.seeder.ts:16`). Pilihan Jenis cuti urut kode: Cuti tahunan, Izin, Sakit, Cuti khusus (`apps/backend/src/app/human-resource/repositories/leave.repository.ts:23`).
