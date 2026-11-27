# UAT M10 - Pajak

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** jenis & tarif pajak → pengaturan PPh 21/BPJS di penggajian → tabel PPh 21 (PTKP, TER, Pasal 17) → hitung PPh 21 di rekap gaji → catatan pajak bulanan → koreksi → rekap periode → pemotongan pajak → PPN di dokumen penjualan/pembelian → XML Coretax → setor pajak → tutup PPN masa → cek per role.

Versi lengkap per form, disusun 2026-11-26 dari form aslinya di kode (belum diuji di aplikasi). **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, dan file impor. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun:** `admin` (Pemilik/Aqim, password di `apps/backend/.env`, lihat README), `accountant_seed` (Akuntan/Bella, `accountant123456`), `finance_seed` (`finance123456`), `auditor_seed` (`auditor123456`), `hr_seed` (`hr123456`), `admin_seed` (`admin123456`).

**Hak akses pajak (dari kode):**

| Role | Yang boleh |
|---|---|
| Pemilik (`admin`) | Semua |
| Akuntan (`accountant_seed`) | Lihat, buat, ubah, verifikasi/lapor, ekspor, impor TER, tutup PPN masa |
| Keuangan (`finance_seed`) | Lihat dan ekspor saja; tetap bisa **Setor pajak** di Kas & Bank |
| Auditor (`auditor_seed`) | Lihat dan ekspor saja |
| Role lain (`hr`, `admin_seed`, dll.) | Menu Pajak tidak tampil |

**Status:**

| Dokumen | Status |
|---|---|
| Catatan pajak | Draf → Terverifikasi → Dilaporkan; menjadi Dikoreksi bila diberi koreksi |
| Pemotongan | Tercatat → Terverifikasi → Terbayar (atau Dibatalkan) |
| Status Coretax pemotongan | Belum diekspor / Sudah diekspor / Sudah diunggah ke Coretax (diisi manual) |

**Data awal dari seed** (berlaku mulai 1 Januari 2026, aktif, tanpa tanggal akhir): `PPN` "PPN (placeholder 11%)" 11%, `PPH23` "PPh 23 (placeholder 2%)" 2%, `PPH4_2` "PPh 4(2) (placeholder 10%)" 10%. PTKP (sejak 1 Jan 2024): TK/0 Rp 54.000.000 (A), TK/1 Rp 58.500.000 (A), TK/2 Rp 63.000.000 (B), TK/3 Rp 67.500.000 (B), K/0 Rp 58.500.000 (A), K/1 Rp 63.000.000 (B), K/2 Rp 67.500.000 (B), K/3 Rp 72.000.000 (C). Pasal 17 (sejak 2022): 0 → 5%, Rp 60 jt → 15%, Rp 250 jt → 25%, Rp 500 jt → 30%, Rp 5 M → 35%. **Tabel TER tidak di-seed**; dibuat sendiri di langkah C4.

**Data contoh yang dipakai selama UAT:**

| Data | Nilai |
|---|---|
| Periode uji | November 2026 (`2026` / bulan `11`) |
| Baris tarif baru | Kode `PPH21UAT`, Nama `PPh 21 UAT`, Tarif `5`, berlaku mulai 1 Desember 2026 |
| Catatan pajak PPN | Jenis `PPN`, November 2026, Dasar pengenaan Rp 10.000.000 → Pajak **Rp 1.100.000** (11%) |
| Ubah dasar PPN | Rp 12.000.000 → seharusnya Rp 1.320.000 |
| Catatan pajak PPh 23 | Jenis `PPH23`, November 2026, Dasar Rp 5.000.000 → Pajak **Rp 100.000** (2%) |
| Koreksi | +Rp 50.000 pada catatan PPN → Neto terutang PPN Rp 1.150.000 (bila dasar tetap Rp 10.000.000) |
| Pemotongan | Kode `WHT-UAT-01`, `PPH23`, Pihak `PT Jasa Instalasi UAT`, Dasar Rp 5.000.000, Pajak Rp 100.000 |
| Data Coretax | Kode objek pajak `24-104-01`, NPWP `0123456789012345`, Nomor bukti potong `BP-UAT-0001` |
| Karyawan PPh 21 | `EMP-00003` (dari UAT M08), Status PTKP **TK/0** → kategori TER **A** |
| Gaji November | Pokok Rp 5.000.000, Tunjangan Rp 500.000, Lembur Rp 250.000, Bonus Rp 300.000, Potongan Rp 100.000 → bruto Rp 6.050.000 |
| PPh 21 tanpa BPJS | bruto Rp 6.050.000 → pita A mulai Rp 5.950.001 → TER 0,75% → **Rp 45.375**; bersih Rp 6.050.000 − 100.000 − 45.375 = **Rp 5.904.625** |
| PPh 21 dengan BPJS Kesehatan | upah (pokok + tunjangan) Rp 5.500.000; BPJS Kes perusahaan 4% = Rp 220.000, karyawan 1% = Rp 55.000; bruto TER Rp 6.050.000 + 220.000 = Rp 6.270.000 → 0,75% → **Rp 47.025**; bersih Rp 6.050.000 − 100.000 − 55.000 − 47.025 = **Rp 5.847.975** |
| PPN dokumen | SPH/Invoice: DPP Rp 10.000.000 + PPN 11% = Rp 1.100.000 → total Rp 11.100.000. Di XML Coretax: DPP nilai lain = 10.000.000 × 11/12 = Rp 9.166.667, tarif 12% |
| PO | Rp 1.000.000 "PPN ditambahkan" → PPN Rp 110.000, total Rp 1.110.000; "Harga sudah termasuk PPN" Rp 1.110.000 → DPP Rp 1.000.000, PPN Rp 110.000 |
| Setor pajak | Utang PPh potong, kode `PPH23`, Rp 100.000, NTPN `NTPN-UAT-0001` |

**File TER uji** (`ter-uat.csv`, simpan sebagai teks biasa; ini **potongan** tabel PP 58/2023 untuk uji, bukan tabel lengkap):

```csv
kategori,penghasilan_bruto_dari,tarif_persen,berlaku_mulai
A,0,0,2026-01-01
A,5400001,0.25,2026-01-01
A,5650001,0.5,2026-01-01
A,5950001,0.75,2026-01-01
A,6300001,1,2026-01-01
A,6750001,1.25,2026-01-01
B,0,0,2026-01-01
B,6200001,0.25,2026-01-01
C,0,0,2026-01-01
C,6600001,0.25,2026-01-01
```

**File TER salah** (`ter-salah.csv`):

```csv
kategori,penghasilan_bruto_dari,tarif_persen,berlaku_mulai
D,0,0,2026-01-01
A,abc,0,2026-01-01
A,5400001,150,2026-01-01
A,5650001,0.5,01-01-2026
B,6200001,0.25,2026-01-01
B,6200001,0.25,2026-01-01
```

---

## A. Jenis & tarif pajak (login `admin`)

### A1. Lihat tarif bawaan

Menu **Keuangan → Pajak → Jenis & Tarif Pajak**. Judul "Jenis & Tarif Pajak", keterangan "Baris tarif dengan tanggal berlaku. Rentang yang tumpang tindih untuk satu kode akan ditolak."

**Harus terlihat:** kolom Kode, Nama, Tarif (%), Berlaku mulai, Berlaku hingga, Aktif. Tiga baris seed: `PPN` 11.0000, `PPH23` 2.0000, `PPH4_2` 10.0000; Berlaku mulai 1 Januari 2026; Berlaku hingga "—"; badge "Aktif". ⚠️ Nama masih bertulisan "placeholder" dan tarif tampil mentah ("11.0000"), bukan "11%".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2 ⚠️. Tambah baris tarif (semua kolom)

Di halaman yang sama, baris form di atas tabel.

| Isian | Isi dengan |
|---|---|
| Kode | `PPH21UAT` (wajib, maks. 32 karakter) |
| Nama | `PPh 21 UAT` (wajib) |
| Tarif (%) | `5` (wajib; kotak teks biasa, bukan angka) |
| Berlaku mulai | 1 Desember 2026 (wajib) |

Tidak ada kolom Berlaku hingga, Jenis (PPN/PPh), dasar, atau termasuk/tidak termasuk di form ini.

**Klik:** Tambah baris tarif (tombol mati sampai keempat kolom terisi; saat menyimpan tertulis "Menyimpan…").

**Harus terlihat:** pesan "Baris tarif pajak dibuat"; baris `PPH21UAT` muncul dengan Tarif 5.0000, badge Aktif. ⚠️ Dugaan kuat gagal dengan pesan "Validasi gagal": form selalu mengirim jenis `vat`, sedangkan server hanya menerima ppn/pph/ppn_input/ppn_output/other.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Uji salah baris tarif

Di form yang sama:

- Tarif (%) `abc` atau `12.34567` (5 desimal) → ditolak "Validasi gagal".
- Kode `PPN`, Nama `PPN tumpang tindih`, Tarif `12`, Berlaku mulai 1 Juni 2026 → ditolak "Periode berlaku bertabrakan dengan tarif yang ada untuk kode pajak ini".
- Salah satu kolom dikosongkan → tombol Tambah baris tarif tetap mati.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Nonaktifkan dan aktifkan lagi

Baris `PPH4_2` → menu baris (⋯) → **Nonaktif**.

**Harus terlihat:** pesan "Baris tarif pajak diperbarui"; badge berubah "Nonaktif". Menu baris kini berisi **Aktif**; klik → badge kembali "Aktif". F5: status tetap. ❓ Label tombol memakai kata status ("Nonaktif"/"Aktif"), bukan "Nonaktifkan"/"Aktifkan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5. Hapus baris tarif

Baris `PPH21UAT` (bila A2 berhasil) → **Hapus** → konfirmasi "Hapus baris tarif pajak ini?" → klik tombol konfirmasi. Lalu coba hapus `PPN` setelah langkah E2 (sudah dipakai catatan pajak).

**Harus terlihat:** `PPH21UAT`: pesan "Baris tarif pajak dihapus", baris hilang. `PPN`: ditolak "Jenis pajak masih digunakan". ⚠️ Tidak ada tombol **Ubah** untuk mengganti nama atau mengisi Berlaku hingga (server sudah mendukung), jadi tarif lama tidak bisa diakhiri saat tarif berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. Pengaturan PPh 21 dan BPJS (ERP-0138, login `admin`)

### B1. Aktifkan potong PPh 21 (semua kolom)

Menu **Pengaturan → Penggajian**. Kartu kedua "PPh 21 dan BPJS", keterangan "Aktifkan atau nonaktifkan potongan wajib untuk seluruh perusahaan."

| Isian | Isi dengan |
|---|---|
| Potong PPh 21 (TER, Pasal 17 tahunan di bulan terakhir) | dicentang (bawaan: tidak) |
| BPJS Kesehatan (perusahaan 4%, karyawan 1%) | tidak dicentang (bawaan) |
| Batas upah BPJS Kesehatan | `12000000` (bawaan) |
| BPJS Ketenagakerjaan (JHT, JP, JKK, JKM) | tidak dicentang (bawaan) |
| Tarif JKK (%) | `0,24` (bawaan; petunjuk "Sesuai kelompok risiko perusahaan: 0,24 (sangat rendah) sampai 1,74 (sangat tinggi).") |
| Batas upah JP | kosong (petunjuk "Diumumkan BPJS setiap tahun; …") |

Petunjuk di bawah: "PPh 21 memerlukan tabel TER yang diimpor di Keuangan > Pajak > Tabel PPh 21."

**Klik:** Simpan.

**Harus terlihat:** pesan "Pengaturan penggajian disimpan". F5: centang PPh 21 tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Uji salah pengaturan

- Tarif JKK (%) `2` (di atas 1,74) atau `0,1` → ditolak.
- Centang BPJS Ketenagakerjaan dengan Batas upah JP kosong → boleh disimpan, tetapi di langkah D2 hitung ulang harus ditolak "Isi batas upah JP di pengaturan penggajian sebelum menghitung BPJS Ketenagakerjaan". Hilangkan lagi centangnya lalu Simpan.
- Login `finance_seed` atau `hr_seed`, buka `/settings/payroll` → menu tidak tampil; bila dibuka lewat alamat, muncul "Hanya administrator aplikasi yang dapat membuka pengaturan penggajian."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Hitung ulang sebelum tabel TER ada (login `hr_seed`)

Prasyarat: rekap gaji November 2026 masih Draf dan berisi baris `EMP-00003` (UAT M08 D1). Pastikan di detail karyawan `EMP-00003` kolom **Status PTKP** = TK/0 (pilihan pertama "Belum diisi (dihitung TK/0)").

Menu **Sumber Daya Manusia → Penggajian**, bulan November 2026 → tombol **Hitung ulang PPh 21 & BPJS**.

**Harus terlihat:** ditolak "Tidak ada tabel TER yang berlaku untuk bulan ini; impor di Keuangan > Pajak > Tabel PPh 21". Tidak ada angka PPh 21 yang berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Tabel PPh 21 (login `accountant_seed`)

### C1. Lihat PTKP dan Pasal 17

Menu **Keuangan → Pajak → Tabel PPh 21**. Judul "Tabel PPh 21", keterangan "PTKP, TER, dan tarif Pasal 17 yang dipakai penggajian."

**Harus terlihat:** kartu "Tarif TER (PP 58/2023)" bertuliskan "Belum ada tabel TER: penggajian belum bisa memotong PPh 21."; kartu "PTKP" ("Sejak 1 Jan 2024") dengan kolom Status, PTKP setahun (Rp), Kategori TER, isinya 8 baris sesuai data awal; kartu "Tarif Pasal 17 (UU HPP)" dengan kolom PKP setahun dari (Rp), Tarif, 5 baris (5%, 15%, 25%, 30%, 35%).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Unduh template CSV

Kartu TER → tombol **Template CSV**.

**Harus terlihat:** file CSV terunduh, baris judul `kategori,penghasilan_bruto_dari,tarif_persen,berlaku_mulai` dan baris contoh `A,0,0,2024-01-01`. Petunjuk di kartu: "Impor tabel resmi sebagai CSV (kategori, penghasilan bruto bulanan dari, tarif %, berlaku mulai). Sistem tidak pernah mengisi tarif TER sendiri; …"

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Impor file TER salah

Tombol **Impor CSV TER** → pilih `ter-salah.csv`. Lalu coba juga: file `.xlsx` atau `.txt`; file CSV kosong (judul saja); file lebih dari 1 MB.

**Harus terlihat:** "Tidak ada yang diimpor. Perbaiki baris berikut lalu unggah ulang:" lalu per baris: Baris 2 "kategori harus A, B, atau C"; Baris 3 "nominal tidak valid (rupiah bulat)"; Baris 4 "tarif tidak valid (0-100, maksimal 4 desimal)"; Baris 5 "tanggal tidak valid (pakai YYYY-MM-DD)"; Baris 7 "muncul dua kali di berkas"; serta "kategori tidak punya baris yang dimulai dari 0" (untuk A/B yang baris 0-nya salah). File lain: "Unggah berkas .csv", "Berkas tidak berisi baris data", "Berkas lebih besar dari 1 MB". Tidak ada satu baris pun tersimpan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Impor file TER benar

**Impor CSV TER** → pilih `ter-uat.csv`. Coba juga simpan ulang file yang sama dengan pemisah titik koma (`;`) dan tarif `0,25` → harus diterima juga.

**Harus terlihat:** pesan "10 baris TER diimpor"; subjudul "Tabel berlaku sejak 1 Jan 2026"; "Versi tersimpan: 2026-01-01 (10)"; tabel Kategori A (6 baris), B (2), C (2) dengan kolom "Bruto bulanan dari (Rp)" dan "Tarif".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Impor ulang mengganti tanggal yang sama

Ubah `ter-uat.csv`: hapus baris `A,6750001,1.25,2026-01-01`, impor lagi.

**Harus terlihat:** "9 baris TER diimpor"; tabel A tinggal 5 baris (baris lama untuk tanggal 2026-01-01 diganti seluruhnya, tidak ditumpuk). Kembalikan baris tadi dan impor sekali lagi (10 baris).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. PPh 21 di rekap gaji

### D1. Hitung ulang PPh 21 tanpa BPJS (login `hr_seed`)

Menu **Sumber Daya Manusia → Penggajian**, November 2026 → **Hitung ulang PPh 21 & BPJS**.

**Harus terlihat:** pesan "PPh 21 dan BPJS dihitung ulang". Baris `EMP-00003`: kolom PPh 21 **Rp 45.375**, BPJS (karyawan) Rp 0, Gaji bersih **Rp 5.904.625**. Karyawan lain yang Status PTKP-nya kosong dihitung sebagai TK/0 (kategori A). F5: angka tetap. ⚠️ Bila gaji bersih tidak memotong PPh 21, catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Hitung ulang dengan BPJS Kesehatan (`admin` → `hr_seed`)

Login `admin`, **Pengaturan → Penggajian**: centang **BPJS Kesehatan (perusahaan 4%, karyawan 1%)**, Batas upah BPJS Kesehatan `12000000` → Simpan. Login `hr_seed` → **Hitung ulang PPh 21 & BPJS**.

**Harus terlihat:** `EMP-00003`: BPJS (karyawan) **Rp 55.000**, PPh 21 **Rp 47.025**, Gaji bersih **Rp 5.847.975**. Uji juga: centang BPJS Ketenagakerjaan dengan Batas upah JP kosong → hitung ulang ditolak "Isi batas upah JP di pengaturan penggajian sebelum menghitung BPJS Ketenagakerjaan". Kembalikan BPJS Ketenagakerjaan ke tidak dicentang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Unduh XML BP21 setelah disetujui (`admin` → `finance_seed`)

Login `admin` → **Sumber Daya Manusia → Penggajian**, November 2026 → **Setujui bulan ini** → "Bulan disetujui dan terkunci". Login pengguna dengan hak ekspor penggajian (coba `finance_seed`, lalu `admin`) → tombol **XML BP21 (Coretax)**.

**Harus terlihat:** file `coretax-bp21-2026-11.xml` terunduh, berisi satu baris per karyawan yang dipotong, PPh 21 `EMP-00003` = 47025. Karyawan tanpa NIK/NPWP: catat apa yang terjadi (petunjuk form karyawan: "ekspor BP21 memerlukan NIK atau NPWP"). Tombol hanya tampil setelah bulan terkunci. ❓ Format belum diuji impor ke Coretax.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Matikan semua potongan wajib (login `admin`)

**Pengaturan → Penggajian**: hilangkan ketiga centang → Simpan. Buka bulan Desember 2026 (draf baru) → **Hitung ulang PPh 21 & BPJS**.

**Harus terlihat:** PPh 21 dan BPJS = Rp 0 untuk semua baris; November yang sudah disetujui tidak berubah. ❓ Desember adalah bulan perhitungan tahunan Pasal 17 (biaya jabatan 5% maks. Rp 500.000/bulan, PKP dibulatkan ke ribuan, dikurangi potongan Januari–November; hasil bisa minus = lebih bayar); uji angka tahunan ini bersama Finance bila data setahun tersedia.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## E. Catatan pajak (login `accountant_seed`)

### E1. Pratinjau pajak

Menu **Keuangan → Pajak → Catatan Pajak**. Judul "Catatan Pajak", keterangan "Kertas kerja bulanan per jenis pajak dan periode."

| Isian | Isi dengan |
|---|---|
| Jenis pajak *(cek pilihan)* | placeholder "Jenis pajak"; pilihan hanya tarif aktif: `PPN — PPN (placeholder 11%)`, `PPH23 — PPh 23 (placeholder 2%)`, `PPH4_2 — PPh 4(2) (placeholder 10%)`; pilih **PPN** |
| Tahun | `2026` (bawaan tahun berjalan; 2000–2100) |
| Bulan *(cek pilihan)* | 1 sampai 12 (angka saja); pilih `11` |
| Dasar pengenaan | `10000000` |

**Klik:** Pratinjau.

**Harus terlihat:** "Pajak: Rp 1.100.000 (tarif 11%, berlaku 1 Jan 2026)". Belum ada catatan tersimpan. ❓ Bulan tampil angka, bukan nama bulan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Buat catatan pajak PPN dan PPh 23

Isian sama dengan E1 → **Catatan baru**. Lalu ulangi dengan Jenis pajak `PPH23`, Tahun `2026`, Bulan `11`, Dasar pengenaan `5000000` → **Catatan baru**.

**Harus terlihat:** pesan "Catatan pajak dibuat" dua kali. Tabel (kolom Kode, Jenis pajak, Periode, Dasar pengenaan, Jumlah pajak, Status): kode otomatis `TR-202611-…`, Periode `2026-11`; PPN Rp 10.000.000 / **Rp 1.100.000**; PPH23 Rp 5.000.000 / **Rp 100.000**; status "Draf".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Uji salah catatan pajak

- PPN, 2026, bulan 11 lagi → ditolak "Catatan pajak untuk jenis dan periode ini sudah ada".
- PPN, 2025, bulan 12 → ditolak "Tidak ada tarif pajak aktif untuk tanggal ini" (tarif seed mulai Januari 2026).
- Jenis pajak tidak dipilih atau Dasar pengenaan kosong → tidak bisa disimpan.
- Tahun `1999` → ditolak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4 ⚠️. Ubah catatan draf

Baris PPN → menu baris → **Ubah**. Dialog "Ubah catatan pajak", keterangan "TR-202611-… — 2026-11".

| Isian | Isi dengan |
|---|---|
| Dasar pengenaan | `12000000` (wajib, ≥ 0) |

**Klik:** Simpan (atau **Batal** dulu: dialog tertutup tanpa perubahan).

**Harus terlihat:** pesan "Catatan pajak diperbarui"; Dasar pengenaan Rp 12.000.000 dan Jumlah pajak **Rp 1.320.000**. ⚠️ Dugaan: Jumlah pajak tetap Rp 1.100.000 (tidak dihitung ulang). Setelah dicatat, kembalikan dasar ke `10000000`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Verifikasi dan lapor

Baris PPN → **Verifikasi** → lalu **Lapor**. Coba **Ubah** pada baris yang sudah Terverifikasi.

**Harus terlihat:** pesan "Status diperbarui" setiap kali; status "Terverifikasi" lalu "Dilaporkan". Menu **Ubah** hilang setelah bukan draf (bila dipanggil: "Catatan pajak tidak lagi dapat diubah"). F5: status tetap. ⚠️ Tidak ada saringan tahun/bulan di halaman ini walau alamatnya mendukung.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## F. Koreksi & bukti (login `accountant_seed`)

### F1. Koreksi pada catatan draf ditolak

Menu **Keuangan → Pajak → Koreksi & Bukti**. Judul "Koreksi & Bukti", keterangan "Penyesuaian bertanda tangan; jumlah pajak tercatat tidak pernah diubah." Pilih catatan PPH23 (masih Draf), isi Jumlah `10000`, Alasan `Uji draf` → **Tambah koreksi**.

**Harus terlihat:** ditolak "Perubahan status tersebut tidak diizinkan untuk catatan ini". ⚠️ Pilihan catatan menampilkan status mentah bahasa Inggris (`draft`, `filed`), dan sebelum memilih catatan tertulis "Belum ada catatan pajak." (teks keliru).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Tambah koreksi (semua kolom)

| Isian | Isi dengan |
|---|---|
| Catatan Pajak *(cek pilihan)* | daftar `KODE — 2026-11 (status)`; pilih catatan PPN (Dilaporkan) |
| Jumlah | `50000` (wajib, boleh minus, tidak boleh 0) |
| Alasan | `Selisih faktur susulan November` (wajib) |
| ID dokumen bukti | kosong (opsional; harus UUID) |

**Klik:** Tambah koreksi (saat proses "Menambahkan…").

**Harus terlihat:** pesan "Koreksi ditambahkan"; tabel (Jumlah, Alasan, ID dokumen bukti, Oleh) berisi +Rp 50.000 berwarna hijau. Di Catatan Pajak status PPN menjadi "Dikoreksi", Jumlah pajak tetap Rp 1.100.000. ⚠️ Kolom Oleh menampilkan ID pengguna mentah, bukan nama. Tambah satu koreksi `-20000` alasan `Uji minus` → merah; neto koreksi +Rp 30.000.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Uji salah koreksi

- Jumlah `0` → ditolak.
- Alasan kosong → tidak bisa disimpan.
- ID dokumen bukti `bukti-001` (bukan UUID) → ditolak "Validasi gagal". ❓ Tidak ada unggah file bukti; rencana M10 meminta lampiran bukti.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## G. Rekap pajak (login `accountant_seed`)

### G1. Rekap periode November 2026

Menu **Keuangan → Pajak → Rekap Pajak** (judul halaman "Rekap Periode", keterangan "Neto terutang per jenis pajak, termasuk koreksi."). Isi tahun `2026`, bulan `11` → **Terapkan**.

**Harus terlihat:** kolom Kode pajak, Dasar pengenaan, Jumlah pajak, Koreksi, Neto terutang, Status. PPN: Rp 10.000.000 / Rp 1.100.000 / +Rp 30.000 / **Rp 1.130.000** / Dikoreksi; PPH23: Rp 5.000.000 / Rp 100.000 / Rp 0 / Rp 100.000 / Draf. Baris "Total neto terutang" **Rp 1.230.000**. Bulan 10 → "Tidak ada catatan untuk periode ini." ⚠️ Kolom "Kode pajak" berisi kode catatan (`TR-…`), bukan `PPN`/`PPH23`. ⚠️ Rekap sudah berubah saat tahun/bulan diganti, sebelum Terapkan diklik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Ekspor rekap

Tombol **Ekspor CSV** lalu **Ekspor XLSX**.

**Harus terlihat:** file `tax-recap-2026-11.csv` dan `tax-recap-2026-11.xlsx` (dengan kop perusahaan); isi dan total sama dengan G1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## H. Pemotongan pajak (login `accountant_seed`)

### H1. Catat pemotongan (semua kolom)

Menu **Keuangan → Pajak → Pemotongan Pajak** (judul "Pemotongan", keterangan "Pajak yang dipotong pada pembayaran ke pihak lain."). Baris form:

| Isian | Isi dengan |
|---|---|
| Kode | `WHT-UAT-01` (wajib, maks. 32) |
| Jenis pajak *(cek pilihan)* | tarif aktif (PPN, PPH23, PPH4_2); pilih **PPH23** |
| Pihak | `PT Jasa Instalasi UAT` (opsional) |
| Jumlah dasar | `5000000` (wajib) |
| Jumlah pajak | `100000` (wajib; diketik sendiri, tidak dihitung) |

**Klik:** Pemotongan baru.

**Harus terlihat:** pesan "Pemotongan dicatat"; tabel (Kode, Jenis pajak, Pihak, Jumlah dasar, Jumlah pajak, Status) berisi `WHT-UAT-01`, Rp 5.000.000, Rp 100.000, "Tercatat". ❓ Jumlah pajak tidak dihitung dari tarif 2%; ketik `90000` pun diterima. ⚠️ Form tidak punya kolom periode/tanggal (lihat I4).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2 ⚠️. Uji salah pemotongan

- Kode `WHT-UAT-01` lagi → seharusnya pesan jelas "kode sudah dipakai"; dugaan muncul "Terjadi kesalahan di server. …".
- Kode kosong atau Jumlah dasar kosong → tidak bisa disimpan.
- Kode 33 karakter → ditolak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H3. Ubah pemotongan

Baris `WHT-UAT-01` → **Tindakan → Ubah**. Dialog "Ubah pemotongan", satu kolom **Jumlah pajak** → `100000` (bila tadi diganti) → **Simpan**; ulangi lalu **Batal**.

**Harus terlihat:** pesan "Pemotongan diperbarui"; Batal tidak mengubah apa pun. Hanya baris "Tercatat" yang punya **Ubah**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H4. Isi data Coretax

**Tindakan → Data Coretax**.

| Isian | Isi dengan |
|---|---|
| Kode objek pajak | `24-104-01` (maks. 20) |
| NPWP/NIK lawan transaksi | `0123456789012345` (maks. 32) |
| Nomor bukti potong | `BP-UAT-0001` (maks. 40) |
| Status Coretax *(cek pilihan)* | Belum diekspor (bawaan) / Sudah diekspor / Sudah diunggah ke Coretax; biarkan **Belum diekspor** |

**Klik:** Simpan.

**Harus terlihat:** pesan "Data Coretax disimpan"; buka lagi dialognya setelah F5 → isian tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H5 ⚠️. Verifikasi, bayar, batalkan

Buat pemotongan kedua `WHT-UAT-02` (PPH4_2, Pihak `CV Sewa Gedung UAT`, dasar `2000000`, pajak `200000`). `WHT-UAT-01`: **Tandai terverifikasi** → **Tandai terbayar**. `WHT-UAT-02`: **Tandai terverifikasi** → **Batalkan**.

**Harus terlihat:** pesan "Status diperbarui"; `WHT-UAT-01` "Terbayar", `WHT-UAT-02` "Dibatalkan" (Data Coretax hilang dari menunya). ⚠️ Baris "Terbayar" tidak punya **Batalkan** padahal server mengizinkan Terbayar → Dibatalkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## I. PPN di dokumen dan XML Coretax

### I1. PPN di SPH dan invoice (login `sales_seed`, lalu `finance_seed`)

Menu **Penjualan → SPH** → Penawaran baru (lihat UAT M02). Bagian "PPN dan penagihan": **Kenakan PPN** dicentang, **Tarif PPN (%)** `11` (bawaan), satu baris barang Rp 10.000.000. Teruskan sampai Sales Order dan invoice diterbitkan dengan tanggal di November 2026.

**Harus terlihat:** detail SPH "PPN 11%" = Rp 1.100.000, total Rp 11.100.000; tanpa centang tertulis "Tanpa PPN". Invoice membawa PPN yang sama. ❓ Tarif PPN dokumen diambil dari kolom dokumen (bawaan 11%), **bukan** dari Jenis & Tarif Pajak; mengubah tarif `PPN` di A tidak mengubah SPH.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I2. PPN di PO (login `purchasing_seed`)

Menu **Inventaris → Pengadaan → Pesanan Pembelian** → **Purchase order baru** (lihat UAT M05). Bagian "PPN dan syarat":

| Isian | Isi dengan |
|---|---|
| PPN *(cek pilihan)* | Tanpa PPN / Harga sudah termasuk PPN / PPN ditambahkan; pilih **PPN ditambahkan** |
| Tarif PPN (%) | `11` (bawaan) |

Satu baris Rp 1.000.000. Simpan, lalu ganti ke **Harga sudah termasuk PPN** dengan harga Rp 1.110.000.

**Harus terlihat:** "PPN ditambahkan": PPN Rp 110.000, total Rp 1.110.000. "Harga sudah termasuk PPN": DPP Rp 1.000.000, PPN Rp 110.000, total Rp 1.110.000. "Tanpa PPN": PPN Rp 0.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I3. XML e-Faktur Coretax (login `accountant_seed`)

Menu **Keuangan → Pajak → Pemotongan Pajak**, panel Coretax di atas. Petunjuk: "Berkas untuk diunggah manual di Coretax. Formatnya mengikuti template impor DJP sejauh yang kami pahami dan belum terverifikasi sampai uji impor berhasil."

| Isian | Isi dengan |
|---|---|
| Tahun | `2026` (kotak teks biasa) |
| Bulan | `11` |

**Klik:** XML e-Faktur Coretax.

**Harus terlihat:** file `coretax-faktur-2026-11.xml`; berisi invoice I1 (status terbit/terbayar, PPN > 0, tanggal November): kode transaksi 04, NPWP penjual dari profil perusahaan, per baris DPP 10000000, DPP nilai lain **9166667**, tarif PPN 12. Barang berstok = Opt A, jasa = Opt B. Invoice draf atau tanpa PPN tidak ikut. Uji salah: Tahun `abcd` → catat pesannya (⚠️ kolom tidak dibatasi angka). ❓ Belum terbukti diterima Coretax.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I4 ⚠️. XML bukti potong Coretax

Panel yang sama, Tahun `2026`, Bulan `11` → **XML bukti potong Coretax**.

**Harus terlihat:** file `coretax-bupot-2026-11.xml` berisi `WHT-UAT-01` (kode objek `24-104-01`, NPWP lawan, nomor `BP-UAT-0001`, dasar 5000000, tarif 2) dan **tanpa** `WHT-UAT-02` (dibatalkan). ⚠️ Dugaan kuat file kosong: pemotongan yang dibuat dari layar tidak menyimpan periode, sedangkan ekspor menyaring per periode.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## J. Setor pajak dan tutup PPN masa

### J1. Setor pajak (login `finance_seed`, semua kolom)

Menu **Keuangan → Kas & Bank** → tombol **Setor pajak**. Dialog "Setor pajak", petunjuk "Menyetor utang pajak ke negara; kas/bank keluar dengan lawan akun utang pajaknya."

| Isian | Isi dengan |
|---|---|
| Utang pajak *(cek pilihan)* | Utang PPN / Utang PPh potong (PPh 23 / 4(2)) / Utang PPh 21 / Utang PPh 25/29; pilih **Utang PPh potong (PPh 23 / 4(2))** |
| Kode pajak (mis. PPH23) | `PPH23` (hanya muncul untuk PPh potong) |
| Kas & Bank *(cek pilihan)* | bawaan "—"; pilih rekening bank seed |
| Tanggal | hari ini (bawaan) |
| Nilai | `100000` |
| Kode billing / NTPN | `NTPN-UAT-0001` (wajib) |

**Klik:** Simpan.

**Harus terlihat:** pesan "Setoran pajak dicatat"; mutasi kas/bank keluar Rp 100.000; jurnal Dr Utang PPh 23, Cr Bank. Uji salah: Nilai `0` → "Setoran pajak butuh jumlah yang lebih dari nol"; NTPN kosong → tidak bisa disimpan; ganti Utang pajak ke Utang PPN → kolom Kode pajak hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J2. Tutup PPN masa (login `accountant_seed`)

Prasyarat: November 2026 berisi invoice ber-PPN (I1, keluaran Rp 1.100.000) dan tagihan pemasok ber-PPN (dari PO I2, masukan Rp 110.000). Menu **Keuangan → Tutup Periode** (judul "Penutupan Periode"), pilih periode November 2026 → tombol **Tutup PPN masa** (langsung jalan, tanpa konfirmasi).

**Harus terlihat:** pesan "PPN ditutup: keluaran Rp 1.100.000, masukan Rp 110.000, neto Rp 990.000" (angka sesuai jurnal bulan itu bila ada transaksi lain; catat angkanya). Jurnal tertanggal 30 November 2026: Dr PPN keluaran 1.100.000, Cr PPN masukan 110.000, Cr Utang PPN 990.000. Bila masukan > keluaran: selisih ke PPN lebih bayar. ⚠️ Tidak ada dialog konfirmasi untuk aksi yang membuat jurnal.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### J3. Tutup PPN masa dua kali

Klik **Tutup PPN masa** sekali lagi untuk November 2026.

**Harus terlihat:** tidak ada jurnal kedua (sekali per bulan); pesan sama atau pesan "sudah ditutup". Login `finance_seed`: tombol **Tutup PPN masa** tidak tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## K. Cek per role

### K1. Keuangan hanya lihat dan ekspor (login `finance_seed`)

Buka keenam menu **Keuangan → Pajak**.

**Harus terlihat:** semua halaman termuat; tidak ada baris form tambah (tarif, catatan, pemotongan, koreksi), tidak ada **Impor CSV TER**, tidak ada Ubah/Verifikasi/Lapor/Tandai; tombol **Ekspor CSV**, **Ekspor XLSX**, **Template CSV**, dan kedua tombol XML Coretax tampil dan berfungsi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K2. Auditor hanya lihat dan ekspor (login `auditor_seed`)

Sama seperti K1.

**Harus terlihat:** sama seperti K1; menu **Setor pajak** di Kas & Bank tidak tampil (auditor tidak punya hak kas/bank buat).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K3. Role tanpa hak pajak (login `hr_seed`, lalu `admin_seed`)

Cek sidebar, lalu ketik alamat `/finance/tax/records`.

**Harus terlihat:** grup **Pajak** tidak tampil; membuka alamat → pesan "Anda tidak memiliki akses ke halaman tersebut." dan kembali ke Dasbor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### K4. Pemilik melihat semua (login `admin`)

Buka keenam menu Pajak dan **Tutup Periode**.

**Harus terlihat:** semua tombol yang dipakai akuntan juga tampil untuk Pemilik (tambah, ubah, verifikasi, lapor, impor TER, ekspor, Tutup PPN masa); data dari langkah sebelumnya terlihat sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 43 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M10:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

Disusun dari kode 2026-11-26, belum dijalankan di aplikasi.

1. **Tambah baris tarif selalu gagal**: form mengirim `taxType: 'vat'` (`apps/web-admin/src/components/tax/tax-type-list.tsx:69`), padahal jenis yang diterima `ppn/pph/ppn_input/ppn_output/other` (`apps/backend/drizzle/schemas/tax.schema.ts:35-41`). Form juga tidak bisa membuat jenis `pph`, yang dibutuhkan potongan PPh saat bayar pemasok.
2. **Ubah catatan draf tidak menghitung ulang pajak**: dialog hanya mengirim dasar baru (`tax-record-edit-dialog.tsx:46`), repository tidak menghitung ulang (`apps/backend/src/app/tax/repositories/tax.repository.ts:268-286`).
3. **Pemotongan dari layar tidak masuk XML bupot**: form tidak mengirim periode (`withholding-list.tsx:90-96`), ekspor menyaring per periode (`tax.repository.ts:475-488`).
4. **Terbayar → Dibatalkan** diizinkan server (`tax.service.ts:47`) tetapi tombol hanya untuk Terverifikasi (`withholding-list.tsx:211`).
5. **Kode pemotongan ganda** kena unique index `withholding_tax_records_org_code_uq` tanpa pemetaan 23505 di `apps/backend/src/http/plugin.ts`; dugaan pesan galat server umum.
6. **Rekap**: kolom "Kode pajak" berisi kode catatan (`tax-recap.tsx:180`); query jalan sebelum Terapkan (`tax-recap.tsx:71-78`). Halaman Catatan Pajak tidak punya saringan periode walau route menerima search param.
7. **Teks**: status mentah Inggris di pilihan koreksi (`tax-corrections.tsx:144`), teks kosong keliru (`:156`), kolom Oleh berisi ID; tombol aktif/nonaktif memakai kata status. Tahun/Bulan Coretax kotak teks bebas (`coretax-panel.tsx:35-36`). Menu "Rekap Pajak" tetapi judul halaman "Rekap Periode", menu "Pemotongan Pajak" tetapi judul "Pemotongan".
8. **Tidak ada Ubah jenis pajak** di layar (PATCH nama/effectiveTo ada di server). Izin `tax:create` diberikan tetapi tidak pernah diperiksa; semua route buat memakai `tax:update`.
9. **Rencana vs kode** (`docs/plan/erp-module-plans/m10-tax.md`): rencana menghitung ringkasan dari baris dokumen (baris 26, 67), kode diisi manual; status rencana draft→reviewed→paid (baris 27), kode draft→verified→filed→corrected; rencana punya tabel bukti berkas (baris 29), kode hanya kolom UUID; periode tertutup harus read-only (baris 71), belum ada pemeriksaan; PPN dokumen pakai tarif master (baris 66), kode memakai `vatRateBps` dokumen (`apps/backend/src/app/sale/utils/quotation-totals.ts:8-9`, `procurement/utils/po-totals.ts:8`); tabel "Current state" (baris 97-108) basi; baris 50 dan 89 menyebut tanpa Coretax, padahal ADR-0030 menambahkannya.
10. **Gerbang Finance masih terbuka**: D12 (kolom ekspor), D14 (pembulatan half-up rupiah), D18 (tarif placeholder); format Coretax belum diuji impor; tabel TER resmi belum diimpor; potongan PPh saat bayar pemasok (ERP-0140) hanya di API, tanpa form (`docs/plan/backlog.md` baris 77, 163, 165).
11. Angka PPh 21 di Data contoh dihitung dari rumus `apps/backend/src/app/human-resource/utils/payroll-statutory.ts:44-64` (upah BPJS = pokok + tunjangan; bruto TER = gaji + BPJS Kes perusahaan + JKK + JKM) dan `apps/backend/src/app/tax/utils/pph21.ts` (TER dibulatkan ke bawah). Asumsi gaji bersih = bruto − potongan − PPh 21 − BPJS karyawan perlu dikonfirmasi saat uji.
