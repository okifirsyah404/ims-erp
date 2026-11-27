# Rancangan karyawan kantor, lapangan, dan teknisi freelance

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: klarifikasi dan keputusan programmer B lewat tanya-jawab
**Disetujui Pemilik 28/11 (dilaporkan programmer B).**
2026-11-28.** Belum ada kode.

## 1. Aplikasi mana dipakai siapa

| Folder | Aplikasi | Dipakai oleh | Pemegang |
|---|---|---|---|
| `apps/web-admin` | Aplikasi kantor (ERP) | Aqim, Bella, Penjualan, Gudang, Manajer Proyek, Layanan Pelanggan | Bersama |
| `apps/web-employee` | **Portal karyawan** | **Semua karyawan kantor dan lapangan, termasuk teknisi freelance** (absen, check-in lokasi, tugas, bukti, laporan harian, cuti/lembur, kasbon, slip gaji) | Oki (layar), data dari modul masing-masing |
| `apps/web-customer-portal` | Portal pelanggan | Pelanggan (proyek, tiket, pesanan, faktur, bayar) | Dafrin (M07, B-38) |
| `apps/web-landing` | Website publik | Calon pelanggan (katalog, RFQ, keranjang) | Dafrin (M04, B-38) |
| `apps/web-investor` | Portal investor | Ditunda (K10, OE3) | — |

Semua "portal untuk teknisi" di catatan ini berarti **`apps/web-employee`**.

## 2. Keputusan

| No | Keputusan |
|---|---|
| KL-1 | Data karyawan diberi isian **Penempatan: Kantor / Lapangan** (bisa diubah bila karyawan dipindah) |
| KL-2 | **Kantor:** absen kantor (cap waktu), jadwal kerja, laporan harian (B-44). **Lapangan:** absen dengan **check-in lokasi proyek** (swafoto + GPS, ditolak di luar radius, OG1), tugas proyek, bukti, laporan harian; absen kantor hanya saat datang ke kantor |
| KL-3 | Teknisi freelance dicatat sebagai **data karyawan dengan jenis kepegawaian baru "Freelance"** dan penempatan Lapangan, sehingga **bisa masuk portal karyawan**. Freelance **tanpa kuota cuti dan tanpa gaji bulanan** |
| KL-4 | **Pembayaran freelance bisa harian atau borongan**, ditentukan per orang: harian = tarif per hari × hari kerja sah (check-in lokasi + laporan harian); borongan = nilai per proyek/pekerjaan, dibayar setelah selesai. Dibayar Bella lewat Keuangan (bukan slip gaji) dan dicatat sebagai biaya proyek |
| KL-5 | Hak freelance: **tugas proyek yang ditugaskan**, check-in lokasi, bukti, laporan harian, **pinjam alat**, **kasbon**, dan **dinilai mingguan/bulanan** (B-44). **Tidak** mengerjakan tiket servis dan tidak melihat proyek lain |
| KL-6 | Role untuk freelance: **Pekerja Lepas** (sudah ada) diperluas dengan hak lihat proyek yang ditugaskan, pinjam alat, dan kasbon. Dafrin dan Oki tetap Pekerja Lepas **tanpa data karyawan** (X4), jadi tidak memakai portal karyawan |

## 3. Perbandingan

| Hal | Karyawan kantor | Karyawan lapangan | Teknisi freelance |
|---|---|---|---|
| Data karyawan | Ya | Ya | Ya, jenis Freelance |
| Portal karyawan | Ya | Ya | Ya, terbatas |
| Absen | Absen kantor | Check-in lokasi proyek (+ absen kantor bila ke kantor) | Check-in lokasi proyek |
| Laporan harian | Wajib | Wajib | Wajib |
| Tugas | Tugas SDM | Tugas proyek + tugas SDM | Tugas proyek yang ditugaskan |
| Tiket servis | Sesuai role | Ya (Teknisi) | **Tidak** |
| Pinjam alat | Sesuai role | Ya | Ya |
| Kasbon | Sesuai role | Ya | Ya |
| Cuti dan lembur | Ya (kuota 12 hari) | Ya | **Tidak** |
| Bayaran | Gaji bulanan + potongan (B-39) | Gaji bulanan + potongan + lembur | Upah **harian atau borongan** lewat Keuangan |
| Evaluasi mingguan/bulanan | Ya | Ya | Ya |

## 4. Yang perlu diperhatikan saat desain

| Hal | Catatan |
|---|---|
| Skema `human_resource` | Kolom penempatan; nilai `freelance` di `employees.employment_type` (CHECK sekarang: permanent, contract, probation, internship, outsourced); jenis dan nilai tarif freelance (harian / borongan). Edit `docs.dbml` dulu (Gate 1) |
| Keputusan lama | **OG4** ("semua karyawan kecuali pekerja lepas punya data karyawan") diperjelas: teknisi freelance **punya** data karyawan jenis Freelance; Pekerja Lepas non-teknisi (Dafrin, Oki) tetap tanpa data karyawan |
| Pembayaran harian | Hari kerja sah dihitung dari check-in lokasi yang diterima + laporan harian hari itu; Bella melihat rekap per periode lalu membayar |
| Hak role | Perluasan Pekerja Lepas di `erp-permissions.ts` (wilayah Oki, M12-5); pembatasan "hanya proyek yang ditugaskan" sudah berlaku di portal (`/projects/me`) |
| Portal karyawan | Menu mengikuti penempatan dan jenis kepegawaian (freelance tanpa cuti, lembur, slip gaji; dengan rekap upah) |

---

## 5. Karyawan kantor yang ditugaskan ke lapangan (diputuskan 28/11)

Contoh: Bilal (penempatan Kantor) diberi tugas di proyek.

| No | Keputusan |
|---|---|
| KL-7 | **Penempatan adalah bawaan, bukan batasan.** Karyawan kantor yang punya **tugas proyek** bekerja dengan cara lapangan pada hari itu, tanpa mengubah penempatannya. Proyeknya otomatis tampil di "Proyek saya" (sudah berlaku di kode: proyek tampil untuk PIC dan siapa pun yang punya tugas di proyek itu). Tidak perlu role Teknisi |
| KL-8 | **Hadir:** check-in pertama hari itu, **di kantor atau di lokasi proyek**, dihitung hadir (tidak alpa, tidak dipotong) |
| KL-9 | **Terlambat tidak dihitung** pada hari yang punya tugas lapangan, **kecuali** Manajer Proyek mengisi **jam mulai lapangan** di jadwal/tugas; bila diisi, terlambat diukur dari jam itu ke check-in lokasi |
| KL-10 | **Kasbon untuk siapa pun yang punya tugas proyek aktif** (bukan hanya Teknisi); mengubah cakupan OB13/RO6 |
| KL-11 | Penempatan tetap **dua pilihan** (Kantor/Lapangan), tanpa "Campuran" |
| KL-12 | Bayaran karyawan kantor yang ke lapangan tetap **gaji bulanan**; kerja lewat jam kerja dicatat sebagai **lembur** seperti biasa |

## 6. Tampilan (bahan desain layar)

### 6.1 Portal karyawan: Beranda

Kartu paling atas **"Hari ini"** berubah mengikuti keadaan hari itu:

| Keadaan hari | Isi kartu "Hari ini" |
|---|---|
| Tidak ada tugas lapangan | **Absen kantor**: tombol **Masuk** / **Pulang**; jam masuk dan pulang dari jadwal |
| Ada tugas lapangan (karyawan lapangan, freelance, atau karyawan kantor yang ditugaskan) | **Tugas lapangan: {nama proyek}**, alamat lokasi + tombol buka peta, jam mulai lapangan bila ada, tombol **Check-in di lokasi** / **Check-out di lokasi**. Di bawahnya tautan kecil "Absen di kantor" untuk hari ia mampir kantor dulu |
| Lebih dari satu proyek hari itu | Daftar proyek; check-in per proyek |
| Sudah hadir | "Hadir pukul 08.05 · di lokasi {proyek} (32 m)" atau "Hadir pukul 07.58 · di kantor" |
| Cuti | "Cuti hari ini", tombol absen disembunyikan |

Di bawah kartu "Hari ini":
- **Tugas saya hari ini** (tugas proyek dan tugas SDM, tanda proyek).
- **Laporan harian**: "Belum diisi" (tombol Isi laporan) / "Sudah diisi pukul 17.40". Hari yang masih bisa disusul (maks. 2 hari) tampil dengan tanda kuning.
- **Pinjaman alat** yang harus kembali.
- **Kasbon terbuka** dan sisa yang belum dipertanggungjawabkan.

### 6.2 Portal karyawan: menu

| Menu | Tampil untuk |
|---|---|
| Beranda | Semua |
| Absensi (riwayat gabungan kantor + lokasi, dengan label sumber) | Semua |
| Proyek saya | Yang punya tugas proyek atau PIC |
| Laporan kerja (harian, ringkasan mingguan/bulanan, nilai) | Semua |
| Kasbon | **Yang punya tugas proyek aktif atau kasbon terbuka** (KL-10) |
| Jadwal kerja | Karyawan (bukan freelance) |
| Cuti, Lembur | Karyawan (bukan freelance) |
| Slip gaji | Karyawan (bukan freelance) |
| Rekap upah | **Freelance** (hari kerja sah / borongan, status bayar) |
| Dokumen, Tanda tangan | Semua |

### 6.3 Portal karyawan: pesan

| Keadaan | Pesan |
|---|---|
| Check-in lokasi berhasil | "Hadir tercatat pukul 08.05 di lokasi {proyek} ({jarak} m)." |
| Di luar radius | "Anda berada {jarak} m dari lokasi {proyek} (batas {radius} m). Check-in tidak bisa dicatat." |
| Izin lokasi mati | "Izinkan akses lokasi dan kamera di browser untuk check-in." |
| Sudah check-in di kantor lalu ke lokasi | Check-in lokasi tetap dicatat sebagai kunjungan; status hadir memakai check-in pertama |
| Kasbon tanpa tugas proyek | Menu Kasbon tidak tampil; bila dipaksa: "Kasbon hanya untuk karyawan yang punya tugas proyek aktif." |
| Pengingat laporan (sore) | "Laporan harian {tanggal} belum diisi." |

### 6.4 Web-admin

| Layar | Tampilan |
|---|---|
| **Absensi harian (SDM)** | Kolom **Sumber**: Kantor / Lokasi {proyek} / Dicatat SDM; jam, jarak; baris dari check-in sendiri bertanda dan **perubahan oleh SDM tercatat** (KF-E4) |
| **Kunjungan lokasi** (PK-9) | Semua orang yang check-in di lokasi, termasuk karyawan kantor; saring per orang, proyek, tanggal; swafoto dan peta |
| **Tugas proyek** (detail proyek) | Pilihan petugas = semua karyawan aktif (kantor, lapangan, freelance) dengan label penempatan/jenis; isian opsional **jam mulai lapangan** (KL-9) |
| **Rekap gaji** | Kolom **hari lapangan**; hari lapangan tanpa jam mulai tidak dihitung terlambat; lembur dari jam yang disetujui |
| **Rekap upah freelance** | Hari kerja sah per freelance (check-in diterima + laporan harian) atau borongan per proyek; tombol bayar oleh Bella (M09-18) |
| **Data karyawan** | Isian Penempatan Kantor/Lapangan, jenis kepegawaian (+ Freelance), tarif freelance harian/borongan |
| **Dasbor Aqim** | Kartu "Di lapangan hari ini" (siapa, proyek mana, jam check-in) dan "Laporan harian belum diisi" |
