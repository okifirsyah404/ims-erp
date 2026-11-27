# UAT pengerjaan (setelah kode ditulis)

Disusun 2026-11-28. Kembali ke [aturan pengerjaan](README.md).

UAT pengerjaan dibuat **oleh penulis kode** untuk setiap tugas, dijalankan
di browser (manual atau Playwright `apps/web-admin/e2e/`), **sebelum push**.
Tujuannya: membuktikan perubahan berjalan sesuai "Seharusnya" di peta kode
dan keputusan yang dirujuk. Ini berbeda dengan UAT resmi U01–U32 (langkah 9)
yang dijalankan bersama pemakai.

## 1. Letak file

Satu file per tugas: `docs/adjustment/5-pengerjaan/uat/<ID>-<slug>.md`,
misalnya `uat/P7-3-aturan-k1.md`, `uat/B-21-po-tanpa-tandai-terkirim.md`.
Salin templat bagian 3.

## 2. Aturan

| No | Aturan |
|---|---|
| U-1 | Langkah UAT diambil dari bagian **UAT** di peta kode, ditambah langkah untuk setiap pesan salah, hak akses (role yang boleh dan tidak boleh), dan data yang tersimpan |
| U-2 | Format per langkah sama dengan checklist UAT modul: **Menu**, **Isi dengan**, **Klik**, **Harus terlihat**, **Uji salah**, lalu status |
| U-3 | Status langkah: **✅ Valid** (sesuai) atau **❌ Tidak valid** (tidak sesuai). Tidak ada status setengah |
| U-4 | Setiap **❌** wajib punya baris di **Daftar perbaikan** (bagian 4) dengan ID `<tugas>-F<n>` |
| U-5 | Setelah diperbaiki, langkah yang gagal **diuji ulang**; baris perbaikan ditutup dengan tanggal dan commit |
| U-6 | Bukti: tangkapan layar atau laporan Playwright untuk langkah utama, disimpan di luar repo atau dilampirkan di PR (tanpa data rahasia) |
| U-7 | **Push hanya bila** semua langkah ✅ dan semua perbaikan berstatus Selesai |
| U-9 | UAT memeriksa juga **informasi penggunaan** (RF-28–RF-34): keterangan menu, panel cara pakai, tooltip kolom, keadaan kosong, teks aturan di isian, tooltip status |
| U-10 | UAT memakai **data seeder** (`rancangan-data-seeder.md`); data yang belum ada ditambahkan ke seeder di PR yang sama (A-10) |
| U-8 | Akun uji per role (Pemilik, Penjualan, Gudang, Keuangan, Manajer Proyek, Teknisi, Pekerja Lepas) dipakai untuk memeriksa hak; jangan memakai data pribadi sungguhan |

## 3. Templat

```markdown
# UAT <ID> <judul tugas>

- Tugas: <ID> (peta kode: peta-kode-<dafrin|oki>.md#<ID>)
- Keputusan: <ID keputusan>
- Penulis kode: <nama> · Branch: <branch> · Commit uji: <hash>
- Lingkungan: <lokal / uji>, database <nama database uji>
- Tanggal uji: <YYYY-MM-DD>

## Ringkasan
| Langkah | Status |
|---|---|
| 1 | ✅ / ❌ |
| 2 | ✅ / ❌ |

**Hasil akhir:** <Valid semua / Masih ada perbaikan terbuka>

## Langkah

### 1. <judul langkah>
**Akun:** <role - akun uji>
**Menu:** <menu → halaman>
**Isi dengan:** <isian>
**Klik:** <tombol>
**Harus terlihat:** <pesan / perubahan data / status>
**Uji salah:** <isian salah → pesan yang harus muncul>

- [ ] ✅ Valid  - [ ] ❌ Tidak valid → perbaikan: <tugas>-F<n>

| Yang terlihat | Seharusnya | Catatan |
|---|---|---|
| | | |

## Daftar perbaikan
| ID | Langkah | Temuan | Sebab (file:baris) | Status | Ditutup (tanggal, commit) |
|---|---|---|---|---|---|
| <tugas>-F1 | 1 | | | Terbuka / Selesai | |
```

## 4. Daftar perbaikan lintas tugas

Temuan yang tidak bisa ditutup di tugas asal (misalnya butuh keputusan atau
tugas lain) dicatat di sini dan di rencana kerja.

| ID | Dari tugas | Temuan | Butuh | Pemegang | Status |
|---|---|---|---|---|---|
| FB-1 | `docs/found-bugs/employee-portal-payroll-26112026.md` #1 | Permintaan tanda tangan seed bukan milik akun uji portal | L-16 (seeder akun per orang) | Bersama | Terbuka |
| FB-2 | found-bugs #2 | Tugas proyek tidak memberi notifikasi | B-35 | Dafrin | Terbuka |
| FB-3 | found-bugs #3 | Penempatan tanda tangan di PDF belum pernah diuji (butuh Chromium) | P7-7 / L-10 | Oki | Terbuka |
| FB-4 | found-bugs #4 | Slip gaji tanpa data di dev; `renderBaseUrl` slip mengarah ke web-admin, bukan portal | L-16 (data gaji disetujui) + cek render slip (PK) | Oki + Dafrin | Terbuka |

## 5. Contoh singkat (P7-3 aturan K1)

### 1. Aqim menyetujui PO buatannya sendiri
**Akun:** Pemilik - Aqim
**Menu:** Pembelian → Pesanan Pembelian → PO draf buatan Aqim
**Klik:** Ajukan, lalu Setujui
**Harus terlihat:** dialog konfirmasi "Anda menyetujui PO buatan Anda sendiri. Dicatat di log audit."; status Disetujui; Log Audit berisi "disetujui oleh pembuat"
**Uji salah:** akun Penjualan Bilal mencoba menyetujui SPH buatannya sendiri → "Penawaran buatan Anda sendiri harus disetujui rekan Penjualan atau Pemilik."

- [x] ✅ Valid  - [ ] ❌ Tidak valid
