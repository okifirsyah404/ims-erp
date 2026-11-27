# Lintas modul dan di luar scope

Kembali ke [catatan penyesuaian](../../README.md). Disusun 2026-11-26 untuk
programmer B (Dafrin), Oki, dan Pemilik. Semua isi dicek ke kode di `main`
(9974a817) dan memakai catatan yang sudah ada di `docs/adjustment/`, bukan
diturunkan ulang.

## Arti istilah

- **Lintas modul**: bagian yang dipakai lebih dari satu modul M01–M12,
  sehingga perubahan di sana berdampak ke kedua programmer. Contoh:
  login dan hak akses, penomoran dokumen, register dokumen dan PDF,
  notifikasi, n8n, portal, serta infrastruktur dev/deploy.
- **Di luar scope** punya tiga arti:
  1. ada di kode tetapi **tidak masuk pembagian modul** (tidak ada pemiliknya),
     misalnya modul `document` dan `notification`;
  2. ada di kode tetapi **melewati batas kontrak v5.1**
     (`docs/plan/erp-plan-id.md`), misalnya banyak gudang atau portal karyawan;
  3. ada di kontrak tetapi **belum dibangun atau belum tercakup**, misalnya
     portal investor dan backup/restore.

Pembagian modul: programmer B memegang M02, M03, M04, M05, M07, M08 (+ gaji
T19/T20); Oki memegang M01, M06, M09, M10, M11, M12.

## Isi folder

| File | Isi |
|---|---|
| [autentikasi-dan-hak-akses.md](autentikasi-dan-hak-akses.md) | Better Auth, role aplikasi vs 17 role organisasi, beberapa role per anggota, `erp-permissions.ts`, cek backend vs frontend, aturan menyetujui sendiri dan pengecualiannya, login lewat undangan, akun portal; rencana persetujuan sendiri oleh Pemilik (A1) |
| [penomoran-dokumen.md](penomoran-dokumen.md) | Penomoran per schema, token dan pola, Administrasi → Nomor Kode, masalah panjang kode PO dan pilihan perbaikannya |
| [dokumen-tanda-tangan-dan-file.md](dokumen-tanda-tangan-dan-file.md) | Register dokumen, render PDF Chromium, tanda tangan, penyimpanan S3 dan URL presigned, galeri foto |
| [notifikasi-otomasi-dan-integrasi.md](notifikasi-otomasi-dan-integrasi.md) | Notifikasi aplikasi dan email, event outbox n8n, WhatsApp/AI, webhook Xendit/SingaPay/WAHA, job terjadwal, Redis/BullMQ |
| [portal-dan-website.md](portal-dan-website.md) | Portal pelanggan, website, portal karyawan, portal investor, API publik dan cara autentikasinya |
| [infrastruktur-dan-pengembangan.md](infrastruktur-dan-pengembangan.md) | Monorepo, stack dev (PostGIS, Redis, Mailpit, S3), migrasi dan seed, test, hook pre-commit, CI, aturan dokumen |
| [di-luar-scope.md](di-luar-scope.md) | Fitur di luar pembagian/kontrak, task kontrak yang belum dibangun, bagian tanpa pemilik, ketidaksesuaian kolom A/B kontrak, keputusan yang dibutuhkan |

Setiap file memakai susunan yang sama: `Kondisi saat ini`, `Alur lintas
modul`, `Catatan dan temuan`, `Perubahan mendatang` (status: usulan /
menunggu keputusan / direncanakan).

## Temuan utama (ringkas)

1. **Persetujuan sendiri.** Penyesuaian stok **dan** peminjaman aset
   sebenarnya tidak menjalankan larangan "pembuat tidak boleh menyetujui"
   sama sekali (pengecualian memakai izin yang sama dengan route-nya).
   Rencana A1 (Pemilik boleh menyetujui sendiri dengan audit) menunggu
   Pemilik dan Oki.
2. **Nomor PO.** Pola bawaan pemasok (`{COMPANY}-{ORG}-{TYPE}-{SEQ:5}`) membuat
   nomor PO melewati 32 karakter register dokumen; sejak 2026-11-25 ditolak
   dengan pesan jelas, tetapi akar masalahnya belum diperbaiki.
3. **Server belum siap untuk PDF dan file:** image backend tanpa Chromium,
   compose tanpa S3; Mailpit dan RustFS lokal dibuat manual.
4. **Kontrak vs kode:** portal investor (T13/T29/T30), order online (T21),
   dokumen portal (T25), dan backup/restore (T17) belum ada; sebaliknya
   banyak gudang, portal karyawan, absen GPS, penyusutan otomatis, dan dua
   gateway sudah dibangun di luar batas kontrak.
5. **Kolom A/B kontrak tidak sejajar dengan pembagian modul** (contoh: T19,
   T20, T23, T24, T27, T28 di kontrak milik A tetapi sekarang di programmer
   B; T02, T12, T13, T29, T30 sebaliknya).
6. **Tanpa pemilik:** modul `document`, `notification`, `webhook`,
   `company`, `location`, lapisan `src/shared/` dan `src/http/`, deploy/CI;
   schema `inventory` dipakai dua programmer.

## Catatan lain

- `.agents/docs/erp-plan.md` tidak ada di repo; kontrak versi Inggris ada di
  `docs/plan/erp-plan-en.md`.
- Nomor ADR ganda: dua file `ADR-0012-*` (single-organization yang
  digantikan, dan multi-organization), dan tidak ada ADR-0028. Perlu
  diperhatikan saat memesan nomor ADR baru.
- Catatan ini tidak mengubah kode, konfigurasi, maupun database.
