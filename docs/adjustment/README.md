# Catatan penyesuaian (konsep saat ini)

Semua catatan kerja untuk menyesuaikan ERP dengan **konsep yang berjalan
sekarang** (17 role, skema dan alur seperti di kode). Ditulis dalam bahasa
Indonesia untuk programmer B (Dafrin), programmer kedua (Oki), dan Pemilik.

**Aturan:** tidak ada perubahan kode sebelum catatan di folder ini beres dan
disetujui (arahan programmer B, 2026-11-26).

**Status 2026-11-27:** Pemilik menyetujui semua keputusan sesuai usulan pada
rapat 27/11 (lembar rapat dan ringkasan untuk Pemilik), termasuk K8, K9, K11,
dan OB11. Yang masih terbuka: tinjauan Oki di PR #171 dan usulan baru
MN1–MN7 / FR1–FR10 di `menu-dan-form-per-role.md`.

## Isi folder

**Dokumen per wilayah programmer** (isi sejajar: validasi, keputusan,
rencana, ringkasan arsitektur):

| Jenis | Modul programmer B (Dafrin) | Modul Oki |
|---|---|---|
| Validasi role dan alur dengan tim nyata | [`validasi-konsep-saat-ini.md`](validasi-konsep-saat-ini.md) | [`validasi-konsep-modul-oki.md`](validasi-konsep-modul-oki.md) |
| Hal yang harus diputuskan | [`bahan-keputusan.md`](bahan-keputusan.md) | [`bahan-keputusan-modul-oki.md`](bahan-keputusan-modul-oki.md) |
| Rencana perubahan | [`rencana-perubahan.md`](rencana-perubahan.md) (juga memuat keputusan bersama K1–K13 dan lintas modul) | [`rencana-perubahan-modul-oki.md`](rencana-perubahan-modul-oki.md) |
| Ringkasan aturan arsitektur | [`ringkasan-arsitektur.md`](ringkasan-arsitektur.md) | [`ringkasan-arsitektur-modul-oki.md`](ringkasan-arsitektur-modul-oki.md) |
| UAT | [`uat-modul/modul-dafrin/`](uat-modul/modul-dafrin/README.md) | [`uat-modul/modul-oki/`](uat-modul/modul-oki/README.md) |

**Dokumen bersama:**

| Folder / file | Isi |
|---|---|
| [`lembar-keputusan-rapat.md`](lembar-keputusan-rapat.md) | **Untuk rapat**: semua keputusan (kedua wilayah) dalam satu lembar, tinggal diisi |
| [`ringkasan-untuk-pemilik.md`](ringkasan-untuk-pemilik.md) | **Untuk Pemilik**: satu halaman keputusan bisnis yang perlu disetujui Pak Aqim, tinggal dicentang |
| [`menu-dan-form-per-role.md`](menu-dan-form-per-role.md) | Menu yang tampil per role dan per orang (sesudah keputusan), semua form (web-admin, portal karyawan, portal pelanggan) dengan isian dan siapa yang mengisi, plus usulan perapian MN1–MN7 dan FR1–FR10 |
| [`rancangan-menu-dasbor-dan-form.md`](rancangan-menu-dasbor-dan-form.md) | **Usulan tampilan**: susunan menu per pekerjaan, halaman Perlu Tindakan, kartu dasbor per role, aturan baku form, rincian 13 form utama (isian, validasi, pesan berhasil/salah), dasar teknis |
| [`catatan-progres.md`](catatan-progres.md) | Log kerja per tanggal: perubahan, perintah, hasil |
| [`uat-modul/`](uat-modul/README.md) | Indeks UAT kedua wilayah, diagram alur, catatan skema lama |
| [`diagram-alur/`](diagram-alur/README.md) | **Semua diagram alur**: kondisi sekarang (kedua wilayah) dan sekarang vs sesudah perbaikan |
| [`skema-database/`](skema-database/README.md) | Skema database per schema (20): tabel, relasi, alur data, penomoran, perubahan mendatang |
| [`lintas-modul/`](lintas-modul/README.md) | Hal yang dipakai banyak modul dan hal di luar pembagian modul/kontrak |

## Pembagian modul

| Programmer | Modul |
|---|---|
| Programmer B (Dafrin) | M02 CRM & Penjualan, M03 Langganan & Lisensi, M04 Integrasi, M05 Inventaris & Pembelian, M07 Proyek & Purna Jual, M08 Karyawan & Kehadiran (+ gaji T19/T20) |
| Programmer kedua (Oki) | M01 Dasbor, M06 Aset & Peralatan, M09 Keuangan, M10 Pajak, M11 Bonus & Investor, M12 Laporan & Hak Akses (login, role) |

Catatan untuk wilayah Oki berisi temuan dan pertanyaan; perubahan di
wilayahnya dikoordinasikan dengan Oki.
