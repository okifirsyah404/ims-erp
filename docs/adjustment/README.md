# Catatan penyesuaian ERP (konsep saat ini)

Semua catatan kerja untuk menyesuaikan ERP dengan **konsep yang berjalan
sekarang**. Dipakai oleh programmer B (Dafrin), programmer kedua (Oki), dan
Pemilik (Aqim). Ditulis dalam bahasa Indonesia.

**Aturan:** tidak ada perubahan kode sebelum catatan di folder ini beres dan
disetujui (arahan programmer B, 2026-11-26). Catatan dinyatakan beres setelah
langkah 6 selesai.

**Posisi sekarang (2026-11-28):** langkah 1–6 selesai (PR #171 di-merge).
**Catatan dinyatakan beres oleh programmer B (28/11)**, jadi kode boleh
dimulai. Rencana rinci langkah 7:
[`4-rencana-kerja/rencana-langkah-7.md`](4-rencana-kerja/rencana-langkah-7.md).
**Semua pengerjaan kode mengikuti
[`5-pengerjaan/README.md`](5-pengerjaan/README.md)** (aturan, peta kode, UAT
pengerjaan, trik prompt AI).

---

## Langkah kerja

Kerjakan berurutan. Setiap langkah punya tujuan, file yang dipakai, siapa,
dan status. Status: ✅ selesai · 🔄 berjalan · ⏳ belum.

| Langkah | Tujuan | File | Siapa | Status |
|---|---|---|---|---|
| **1. Validasi** | Mencocokkan role, hak, dan alur di kode dengan tim nyata (12 orang) | [`1-validasi/validasi-konsep-saat-ini.md`](1-validasi/validasi-konsep-saat-ini.md), [`1-validasi/validasi-konsep-modul-oki.md`](1-validasi/validasi-konsep-modul-oki.md) | Dafrin | ✅ 26–27/11 |
| **2. Checklist UAT** | Langkah uji per modul, per isian, dengan tabel ketidaksesuaian (588 langkah) | [`1-validasi/uat-modul/`](1-validasi/uat-modul/README.md) | Dafrin | ✅ disusun · UAT manual berhenti di M05 D3, diulang di langkah 9 |
| **3. Keputusan** | Semua pertanyaan dijawab dan disetujui Pemilik | [`2-keputusan/ringkasan-untuk-pemilik.md`](2-keputusan/ringkasan-untuk-pemilik.md) (1 halaman), [`2-keputusan/lembar-keputusan-rapat.md`](2-keputusan/lembar-keputusan-rapat.md) (lengkap, termasuk T-1–T-7), [`2-keputusan/bahan-keputusan.md`](2-keputusan/bahan-keputusan.md), [`2-keputusan/bahan-keputusan-modul-oki.md`](2-keputusan/bahan-keputusan-modul-oki.md) | Pemilik, Oki, Dafrin | ✅ rapat 27/11 |
| **4. Rancangan** | Bentuk sesudah perbaikan: arsitektur, skema, lintas modul, alur, menu, dasbor, form, kekurangan fitur | Folder [`3-rancangan/`](#3-rancangan) | Dafrin (Oki meninjau) | ✅ 27/11 |
| **5. Rencana kerja** | Daftar tugas per programmer dan peta halaman yang diperbaiki | [`4-rencana-kerja/rencana-perubahan.md`](4-rencana-kerja/rencana-perubahan.md) (Dafrin), [`4-rencana-kerja/rencana-perubahan-modul-oki.md`](4-rencana-kerja/rencana-perubahan-modul-oki.md) (Oki), [`4-rencana-kerja/peta-halaman.md`](4-rencana-kerja/peta-halaman.md) | Dafrin, Oki | ✅ 27/11 |
| **6. Tinjauan dan merge** | Oki meninjau semua catatan, terutama bagian wilayahnya, lalu PR #171 di-merge ke `main`. Dafrin menyatakan catatan beres | PR #171 | Oki, Dafrin | ✅ PR #171 di-merge 28/11 |
| **7. Fondasi kode** | Dasar yang dipakai semua perbaikan: (a) audit di dalam transaksi (M12-1, OA5–OA7); (b) ubah ADR-0006; (c) aturan persetujuan sendiri K1 (B-1, X-2); (d) hak role baru (M12-5); (e) penomoran tanpa celah dan kode pemasok pendek (L-2, B-27); (f) dasar form: TanStack Form + zod, pesan per isian, konfirmasi baku (TF-1–TF-3); (g) server siap pakai dan batas percobaan login (L-10, L-11) | Rencana kerja bagian Tinggi; [`3-rancangan/rancangan-menu-dasbor-dan-form.md`](3-rancangan/rancangan-menu-dasbor-dan-form.md) bagian 6 | (a)(b)(d) Oki · (c) Dafrin · (e)(f) bersama | 🔄 rencana rinci: [`4-rencana-kerja/rencana-langkah-7.md`](4-rencana-kerja/rencana-langkah-7.md) |
| **8. Perbaikan prioritas tinggi** | Semua baris **Tinggi** di peta halaman, termasuk 10 kekurangan fitur terpenting (B-29–B-33, M09-15–17, M10-11–13, M06-14) kekurangan fitur bagian kedua (B-39–B-42, laporan kerja B-44, kantor/lapangan/freelance B-45, n8n dan WhatsApp B-46, biaya perjalanan B-48 + M09-19, investor M11-4–M11-7, M12-14–M12-16, PK-9), dan fitur utama dari alur lengkap (B-35–B-38: notifikasi tugas proyek, konfirmasi tiket portal, cetak SO/kuitansi/BPB/retur, portal pesanan/SPH/faktur/bayar) | [`4-rencana-kerja/peta-halaman.md`](4-rencana-kerja/peta-halaman.md) | Dafrin, Oki | ⏳ |
| **9. Data dan UAT ulang** | Aqim mengatur role per orang (K2) dan kode pemasok (K6); Bella mengisi tarif pajak (T-5) dan memastikan rezim pajak (KF-T2); UAT diulang dari M05 A1 di database baru; impor data awal dengan templat Excel (L-12); skenario resmi U01–U32 dipetakan (L-14); uji restore pertama (L-13) | [`1-validasi/uat-modul/`](1-validasi/uat-modul/README.md) | Aqim, Bella, Dafrin, Oki | ⏳ |
| **10. Tampilan** | Menu per pekerjaan dengan tab, Perlu Tindakan, dasbor per role, menu harian Aqim, Ctrl+K, favorit, lalu 13 form utama dan form lain bertahap | [`3-rancangan/rancangan-menu-dasbor-dan-form.md`](3-rancangan/rancangan-menu-dasbor-dan-form.md) | Bersama | ⏳ |
| **11. Daftar tunggu** | Perbaikan Sedang/Rendah, kekurangan fitur Sedang/Rendah (B-34, M06-15), tabel S6 (B-26); butir "Tambahan" bila diminta Pemilik | Rencana kerja; [`3-rancangan/kekurangan-fitur.md`](3-rancangan/kekurangan-fitur.md) | Dafrin, Oki | ⏳ |
| **12. Serah terima** | Pelatihan tatap muka, panduan per modul dan dari awal sampai akhir, panduan deploy/rollback/backup, daftar keterbatasan, daftar akun/akses, hasil UAT di Excel (T18, T31, T32) | [`3-rancangan/rancangan-serah-terima.md`](3-rancangan/rancangan-serah-terima.md) | Dafrin, Oki | ⏳ |

Setiap kali sebuah langkah maju: perbarui kolom **Status** di tabel ini dan
tulis entri di [`catatan-progres.md`](catatan-progres.md).

---

## Isi folder

### 1-validasi

| File | Isi |
|---|---|
| [`validasi-konsep-saat-ini.md`](1-validasi/validasi-konsep-saat-ini.md) | Role, hak, dan alur modul programmer B dibandingkan dengan tim nyata |
| [`validasi-konsep-modul-oki.md`](1-validasi/validasi-konsep-modul-oki.md) | Sama, untuk modul Oki |
| [`uat-modul/`](1-validasi/uat-modul/README.md) | Checklist UAT: [`modul-dafrin/`](1-validasi/uat-modul/modul-dafrin/README.md), [`modul-oki/`](1-validasi/uat-modul/modul-oki/README.md), diagram alur per role, catatan skema lama |

### 2-keputusan

| File | Isi |
|---|---|
| [`ringkasan-untuk-pemilik.md`](2-keputusan/ringkasan-untuk-pemilik.md) | Satu halaman keputusan bisnis yang disetujui Aqim |
| [`lembar-keputusan-rapat.md`](2-keputusan/lembar-keputusan-rapat.md) | Semua keputusan kedua wilayah; bagian 8c keputusan teknis T-1–T-7 |
| [`bahan-keputusan.md`](2-keputusan/bahan-keputusan.md) | Bahan keputusan modul programmer B (A–E) |
| [`bahan-keputusan-modul-oki.md`](2-keputusan/bahan-keputusan-modul-oki.md) | Bahan keputusan modul Oki (OA–OG) |

### 3-rancangan

| File | Isi |
|---|---|
| [`ringkasan-arsitektur.md`](3-rancangan/ringkasan-arsitektur.md), [`ringkasan-arsitektur-modul-oki.md`](3-rancangan/ringkasan-arsitektur-modul-oki.md) | Aturan arsitektur yang harus diikuti per wilayah |
| [`skema-database/`](3-rancangan/skema-database/README.md) | Skema per schema (20): tabel, relasi, alur data, perubahan mendatang |
| [`lintas-modul/`](3-rancangan/lintas-modul/README.md) | Hal yang dipakai banyak modul (login, penomoran, dokumen, notifikasi, portal, infrastruktur, di luar scope) |
| [`diagram-alur/`](3-rancangan/diagram-alur/README.md) | Diagram alur: **alur lengkap saat ini** ([`alur-lengkap-saat-ini.md`](3-rancangan/diagram-alur/alur-lengkap-saat-ini.md)), per modul, dan sekarang vs sesudah perbaikan |
| [`menu-dan-form-per-role.md`](3-rancangan/menu-dan-form-per-role.md) | Menu per role dan per orang (dihitung dari kode), daftar semua form |
| [`rancangan-menu-dasbor-dan-form.md`](3-rancangan/rancangan-menu-dasbor-dan-form.md) | Menu per pekerjaan, pemangkasan menu, Perlu Tindakan, dasbor per role, aturan baku form, 13 form utama |
| [`rancangan-portal-pesanan.md`](3-rancangan/rancangan-portal-pesanan.md) | Portal pelanggan dan pesanan online (B-38): keputusan PP-1–PP-8, alur target, urutan port P2+P7 → P3 → P5 → P4 |
| [`rancangan-laporan-kerja-dan-potongan-gaji.md`](3-rancangan/rancangan-laporan-kerja-dan-potongan-gaji.md) | Laporan kerja harian/mingguan/bulanan + penilaian (LK-1–LK-7) dan pengaturan potongan gaji (PG-1–PG-5) |
| [`rancangan-karyawan-kantor-lapangan-freelance.md`](3-rancangan/rancangan-karyawan-kantor-lapangan-freelance.md) | Aplikasi mana dipakai siapa (folder `apps/`), penempatan Kantor/Lapangan, teknisi freelance (KL-1–KL-6) |
| [`rancangan-serah-terima.md`](3-rancangan/rancangan-serah-terima.md) | Pekerjaan non-modul kontrak: impor data awal, server siap pakai, backup/restore, UAT resmi U01–U32, pelatihan, panduan, serah terima (NM-1–NM-11) |
| [`rancangan-n8n-whatsapp.md`](3-rancangan/rancangan-n8n-whatsapp.md) | n8n, WhatsApp (WAHA dulu, Meta nanti, langkah pendaftaran), penerima staf, sakelar pesan pelanggan, event baru, asisten AI (N8-1–N8-8) |
| [`rancangan-biaya-perjalanan.md`](3-rancangan/rancangan-biaya-perjalanan.md) | Biaya perjalanan teknisi: kasbon, nota, klaim, uang makan harian, batas, kategori (BP-1–BP-6) |
| [`rancangan-investor-m11.md`](3-rancangan/rancangan-investor-m11.md) | Investor dan suntikan dana: modal, pinjaman, dana per proyek, bagi hasil, portal investor (IV-1–IV-6; mengubah K10) |
| [`teks-pesan-wa-pelanggan.md`](3-rancangan/teks-pesan-wa-pelanggan.md) | Teks awal pesan WA ke pelanggan dan pemasok (8 jenis) untuk dimasukkan ke n8n; disetujui saat uji di n8n (N8-9) |
| [`rancangan-data-seeder.md`](3-rancangan/rancangan-data-seeder.md) | Data uji seeder: akun per orang (K2), data per alur dan semua status, prinsip deterministik/idempoten (L-16) |
| [`kekurangan-fitur.md`](3-rancangan/kekurangan-fitur.md) | Fitur yang belum ada atau setengah jadi di Proyek, Gudang, Pengadaan, Aset, Keuangan, Pajak |

### 4-rencana-kerja

| File | Isi |
|---|---|
| [`rencana-perubahan.md`](4-rencana-kerja/rencana-perubahan.md) | Tugas programmer B (B-1–B-34), keputusan bersama K1–K13, lintas modul |
| [`rencana-perubahan-modul-oki.md`](4-rencana-kerja/rencana-perubahan-modul-oki.md) | Tugas Oki per modul (M01, M06, M09, M10, M11, M12, portal karyawan) |
| [`rencana-langkah-7.md`](4-rencana-kerja/rencana-langkah-7.md) | Rencana rinci langkah 7: paket P7-1 sampai P7-7, pemegang, ketergantungan, aturan PR, kriteria selesai |
| [`peta-halaman.md`](4-rencana-kerja/peta-halaman.md) | Halaman yang diperbaiki, prioritas, dan pemegangnya |

### 5-pengerjaan

| File | Isi |
|---|---|
| [`README.md`](5-pengerjaan/README.md) | **Aturan pengerjaan kode**: alur satu tugas, aturan menulis kode, checklist sebelum push, templat PR |
| [`peta-kode-dafrin.md`](5-pengerjaan/peta-kode-dafrin.md) | Per tugas programmer B: seharusnya, sekarang, file yang diubah, skema, test, UAT |
| [`peta-kode-oki.md`](5-pengerjaan/peta-kode-oki.md) | Sama, untuk tugas Oki |
| [`uat-pengerjaan.md`](5-pengerjaan/uat-pengerjaan.md) | UAT setelah pengerjaan: Valid / Tidak valid, daftar perbaikan, syarat push |
| [`prompt-ai.md`](5-pengerjaan/prompt-ai.md) | Trik prompt supaya AI langsung ke file yang dituju dan hemat token |

[`catatan-progres.md`](catatan-progres.md): log kerja per tanggal.

---

## Pembagian modul

| Programmer | Modul |
|---|---|
| Programmer B (Dafrin) | M02 CRM & Penjualan, M03 Langganan & Lisensi, M04 Integrasi, M05 Inventaris & Pembelian, M07 Proyek & Purna Jual, M08 Karyawan & Kehadiran (+ gaji T19/T20) |
| Programmer kedua (Oki) | M01 Dasbor, M06 Aset & Peralatan, M09 Keuangan, M10 Pajak, M11 Bonus & Investor, M12 Laporan & Hak Akses (login, role) |
| Bersama (K11) | Dokumen, notifikasi, webhook, profil perusahaan, lokasi, penomoran/audit bersama, `src/http`, paket bersama, deploy/CI: diubah lewat PR dan diberitahukan |

Kontrak disesuaikan dengan pembagian ini (K8). Fitur yang sudah ada di luar
kontrak diterima sebagai tambahan (K9).

**Catatan nama file:** di dalam catatan, file sering disebut dengan nama
saja (misalnya `skema-database/inventory.md`). Nama folder dan file tidak
berubah, hanya dikelompokkan ke folder bernomor di atas (2026-11-27).
