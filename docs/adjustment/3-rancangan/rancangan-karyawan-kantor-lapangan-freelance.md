# Rancangan karyawan kantor, lapangan, dan teknisi freelance

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: klarifikasi dan keputusan programmer B lewat tanya-jawab
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
