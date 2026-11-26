# Catatan penyesuaian (konsep saat ini)

Semua catatan kerja untuk menyesuaikan ERP dengan **konsep yang berjalan
sekarang** (17 role, skema dan alur seperti di kode). Ditulis dalam bahasa
Indonesia untuk programmer B (Dafrin), programmer kedua (Oki), dan Pemilik.

**Aturan:** tidak ada perubahan kode sebelum catatan di folder ini beres dan
disetujui (arahan programmer B, 2026-11-26).

## Isi folder

| Folder / file | Isi |
|---|---|
| [`catatan-progres.md`](catatan-progres.md) | Log kerja per tanggal: perubahan, perintah, hasil |
| [`validasi-konsep-saat-ini.md`](validasi-konsep-saat-ini.md) | Matriks role, validasi dengan tim nyata, peta bentrok persetujuan, rekomendasi role dan alur |
| [`bahan-keputusan.md`](bahan-keputusan.md) | Hal yang harus diputuskan Pemilik/Oki, dengan pilihan dan rekomendasi |
| [`rencana-perubahan.md`](rencana-perubahan.md) | Gabungan semua perubahan mendatang dari seluruh catatan |
| [`ringkasan-arsitektur.md`](ringkasan-arsitektur.md) | Ringkasan aturan arsitektur dan dokumen yang sudah tidak cocok dengan kode |
| [`uat-modul/`](uat-modul/README.md) | Checklist UAT per modul: modul programmer B di `modul-dafrin/`, modul Oki di `modul-oki/`, plus diagram alur dan catatan skema lama |
| [`skema-database/`](skema-database/README.md) | Skema database per schema: tabel, relasi, alur data, penomoran, perubahan mendatang |
| [`lintas-modul/`](lintas-modul/README.md) | Hal yang dipakai banyak modul dan hal di luar pembagian modul/kontrak |

## Pembagian modul

| Programmer | Modul |
|---|---|
| Programmer B (Dafrin) | M02 CRM & Penjualan, M03 Langganan & Lisensi, M04 Integrasi, M05 Inventaris & Pembelian, M07 Proyek & Purna Jual, M08 Karyawan & Kehadiran (+ gaji T19/T20) |
| Programmer kedua (Oki) | M01 Dasbor, M06 Aset & Peralatan, M09 Keuangan, M10 Pajak, M11 Bonus & Investor, M12 Laporan & Hak Akses (login, role) |

Catatan untuk wilayah Oki berisi temuan dan pertanyaan; perubahan di
wilayahnya dikoordinasikan dengan Oki.
