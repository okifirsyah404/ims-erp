# Employee portal + payroll — bugs found

- **Tanggal:** 2026-11-26
- **Scope:** `apps/web-employee` (portal karyawan, fase A–C), backend `/human-resources/me/*`, `/projects/me/*`, `/documents/me/*`, plus jalur payroll yang dipakai portal (`/users/me/payslips`)
- **Cara ditemukan:** audit kode + query langsung ke DB, lalu walk-through dengan in-app browser (login `hr_seed_08` pada dev server :5174)
- **Status:** semua bug di bawah sudah **diperbaiki**; kolom "Bukti" menunjukkan bagaimana perbaikannya diverifikasi

Ringkasan: 12 bug fungsional (5 di antaranya hanya terlihat di browser), 1 masalah konfigurasi yang membuat CORS terbuka lebar, dan 4 bug yang masih terbuka (bagian [Belum diperbaiki](#belum-diperbaiki)).

---

## 1. CORS terbuka untuk semua origin (konfigurasi, paling serius)

| | |
| --- | --- |
| **Gejala** | `Access-Control-Allow-Origin` tidak pernah dikirim untuk `http://localhost:5174`; tapi juga tidak pernah *menolak* browser. Preflight dari origin asing tetap 204 tanpa header allowlist. |
| **Akar masalah** | `config/loaders/config.loader.ts` mencari `cors.json` dengan `path.resolve(process.cwd(), 'cors.json')`. Backend dijalankan turbo dari **root repo**, jadi file tidak ditemukan → `loadCorsOrigins` mengembalikan `null` → `src/index.ts` jatuh ke default `[appConfig.app.webUrl ?? 'http://localhost:5173']`… kecuali `appConfig.app.webUrl` juga kosong, dan `path.resolve` tidak pernah tahu cwd workspace. |
| **Dampak** | Allowlist CORS bisa kosong/berbeda tanpa error apa pun; dev dan produksi berperilaku beda terhadap origin yang sama. |
| **Perbaikan** | `findCorsPath` jatuh ke `path.resolve(import.meta.dir, '../../cors.json')` bila file tidak ada di cwd; `CORS_CONFIG_PATH` tetap menang. |
| **Bukti** | `bun test test/unit/cors-config.test.ts` → 11 pass; preflight manual dari `:5174` mengembalikan `Access-Control-Allow-Origin: http://localhost:5174`. |

## 2. Better Auth menolak login portal dengan "Invalid origin"

| | |
| --- | --- |
| **Gejala** | Login di portal gagal; UI hanya menampilkan "Invalid origin" (kode `INVALID_ORIGIN` dari Better Auth). |
| **Akar masalah** | Dua allowlist terpisah: `cors.json` (XHR) dan `betterAuthTrustedOrigins`. Yang kedua hanya memuat `:5173`. |
| **Perbaikan** | `http://localhost:5174` ditambahkan ke `betterAuthTrustedOrigins` (`providers/better-auth/options/social-providers.auth.ts`) dan ke template `cors.example.json`. |
| **Bukti** | Login `hr_seed_08` sukses di browser, redirect ke `/projects`. |

## 3. `/projects/$projectId` tidak pernah render (route tertelan)

| | |
| --- | --- |
| **Gejala** | Membuka detail proyek menampilkan halaman daftar proyek; breadcrumb menampilkan `$projectId` mentah. |
| **Akar masalah** | `_authed.projects.tsx` sekaligus berfungsi sebagai halaman daftar **dan** parent dari `_authed.projects.$projectId.tsx`. TanStack Router memakai route yang sama untuk `/projects/<id>`, sehingga parent menang dan tidak ada `<Outlet/>`. |
| **Perbaikan** | Dipecah: `_authed.projects.tsx` (layout `<Outlet/>`) + `_authed.projects.index.tsx` (daftar) + `_authed.projects.$projectId.tsx` (detail). |
| **Bukti** | `/projects/<id>` merender judul proyek, tab Tugas/Bukti/Kunjungan lokasi; 0 console error. |

## 4. Breadcrumb urut dari daun ke akar

| | |
| --- | --- |
| **Gejala** | Trailing breadcrumb berbunyi `Instalasi Demo Portal Karyawan > Projects`. |
| **Akar masalah** | `buildCrumbs` me-`reverse()` hasil `useMatches()`, padahal TanStack Router sudah mengembalikan urutan outermost-first. |
| **Perbaikan** | Builder ditulis ulang tanpa reverse; crumb detail proyek mengambil judul dari `myProjectQueryOptions` (subscribe, bukan `getQueryData`) supaya terisi saat data datang, dan crumb parent dibuang bila labelnya sama. |
| **Bukti** | Breadcrumb: `Beranda > Proyek > Instalasi Demo Portal Karyawan`. |

## 5. Daftar proyek kosong untuk karyawan yang sebenarnya terlibat

| | |
| --- | --- |
| **Gejala** | Akun karyawan (PIC sebuah proyek) melihat "Belum ada proyek yang ditugaskan" sementara admin melihat proyeknya. |
| **Akar masalah** | Bukan bug kode: seed tidak punya proyek dan alamat koordinat, dan PIC hanya bisa melihat proyek yang `involved` (PIC atau punya task hidup). Tidak ada fixture untuk diuji. |
| **Perbaikan** | Seeder `project-demo.seeder.ts` membuat `PRJ-DEMO-001` (PIC = karyawan ter-link, alamat primer berkoordinat, 1 task open) + setting radius 100 m, idempoten. |
| **Bukti** | `hr_seed_08` melihat kartu proyek; seed kedua tidak menambah baris. |

## 6. Absensi lapangan tidak bisa dijalankan sama sekali (PostGIS tidak ada)

| | |
| --- | --- |
| **Gejala** | `CREATE EXTENSION postgis` gagal: `extension "postgis" is not available`; sehingga check-in lokasi tidak akan pernah berhasil. |
| **Akar masalah** | Postgres 18.7 (FlyEnv) tidak membawa PostGIS; bundle OSGeo memuat DLL yang dibutuhkan `postgis-3.dll` di `bin\postgisgui\` (`libbrotlicommon/dec/enc.dll`) dan `libnghttp2-14.dll` yang tidak ada di bundle. |
| **Perbaikan** | Install bundle 3.7.0 ke `pgsql/`, tambahkan tiga DLL brotli + `libnghttp2-14.dll` di sebelah `postgres.exe`, restart service; extension dibuat lewat migrasi custom `20261125201740_postgis_extension`. |
| **Bukti** | `postgis_lib_version()` = 3.7.0; check-in uji: 0 m `verified`, +11 m `verified` (11.07 m), +110 m `out_of_range` (121.75 m). |

## 7. Jarak radius memakai kolom numerik tanpa index spasial

| | |
| --- | --- |
| **Gejala** | Rencana awal menghitung haversine manual / `ST_Distance` atas `numeric(10,7)` hasil cast; tidak ada index spasial dan rumusnya rawan salah. |
| **Akar masalah** | Kolom `latitude`/`longitude` saja — tidak ada `geometry(point,4326)` (pola Drizzle PostGIS guide). |
| **Perbaikan** | `project.addresses.site_point geometry(point,4326)` + GiST index; migrasi kolom + backfill `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`; query memakai `ST_Distance`/`ST_DWithin` dengan cast `geography` (satuan meter). |
| **Bukti** | Lihat bug 6; `validate-dbml.ts` 0 drift. |

## 8. `<video>` selfie besar dan kosong saat idle

| | |
| --- | --- |
| **Gejala** | Tab "Kunjungan lokasi" menampilkan kotak gelap setinggi ~1000 px sebelum kamera dinyalakan. |
| **Akar masalah** | Elemen `<video>` selalu di-mount meski tanpa stream. |
| **Perbaikan** | `<video>` hanya di-mount saat `streaming`; status streaming jadi state, bukan `ref.current` dibaca saat render. |
| **Bukti** | Screenshot tab kunjungan setelah perbaikan; tidak ada kotak kosong. |

## 9. Tombol "Check in" tidak bisa dipakai di desktop

| | |
| --- | --- |
| **Gejala** | Check-in selalu disabled di in-app browser; `navigator.geolocation` timeout (kode 3). |
| **Akar masalah** | Keterbatasan lingkungan (geolocation diblokir di browser desktop/headless), bukan bug aplikasi. |
| **Perbaikan** | Tidak ada perubahan kode; alur diverifikasi lewat API (multipart selfie + lat/lng) langsung dari origin yang sama. Dicatat agar tidak salah dibaca sebagai bug saat UAT di desktop. |
| **Bukti** | `POST /projects/me/site-attendance/check-in` 201 `verified`; row tampil di tabel dengan "11 m dari lokasi". |

## 10. Notifikasi `hr.task_assigned` dan `hr.leave_decided` ter-seed tapi tidak pernah terkirim

| | |
| --- | --- |
| **Gejala** | Template ada di DB dan di bundle locale, tetapi tidak ada producer; bell tidak pernah memunculkan event tersebut. |
| **Akar masalah** | Template ditambahkan lebih dulu tanpa pemanggil. |
| **Perbaikan** | `TaskService.create` mengirim `hr.task_assigned` ke user assignee (bila akun ter-link); `LeaveService.notifyDecision` mengirim `hr.leave_decided` saat approve/reject cuti & lembur (best-effort, tidak pernah membatalkan keputusan). |
| **Bukti** | `bun test test/unit/hr-records.service.test.ts` tetap pass; notifikasi PIC pada check-in jauh terkirim dengan variabel benar. |

## 11. Kartu "Keamanan akun" hanya skeleton

| | |
| --- | --- |
| **Gejala** | Halaman profil menampilkan placeholder abu-abu permanen. |
| **Akar masalah** | Fitur belum dibuat saat fase A. |
| **Perbaikan** | `AccountSecurityCard`: ganti password (`revokeOtherSessions: true`) + sign out; email/username/role dinyatakan milik HR. |
| **Bukti** | Kartu tampil dan bisa dipakai di `/profile`. |

## 12. `/documents` crash untuk semua dokumen ber-timestamp

| | |
| --- | --- |
| **Gejala** | Halaman dokumen menampilkan error boundary; console: `RangeError: Invalid time value at formatBusinessDate`. |
| **Akar masalah** | `formatBusinessDate()` menerima `createdAt` (timestamp ISO), bukan `YYYY-MM-DD`; `new Date('2026-11-25T20:54:12.081ZT00:00:00Z')` tidak valid. |
| **Perbaikan** | Memakai `formatDateTime()` untuk `createdAt`; `formatBusinessDate` tetap khusus tanggal bisnis. |
| **Bukti** | `/documents` merender dokumen `0009/DOC/DEV/XI/26 Perjanjian Kerja - Adinata Jailani`, 0 console error. |

## 13. Menu "Proyek" hilang, tautan "Berkas"/"Penggajian" jadi 404

| | |
| --- | --- |
| **Gejala** | Setelah fase B, menu Proyek tidak muncul; sebaliknya dua tautan menuju route yang belum ada. |
| **Akar masalah** | Filter nav memakai `phase === 'a'` hard-coded sementara label fase tidak mengikuti fitur yang sudah rilis. |
| **Perbaikan** | Nav diarahkan oleh daftar `SHIPPED` (`a`, `b`, lalu `c` saat fase C mendarat), sehingga menu tidak bisa berbeda dari route yang ada. |
| **Bukti** | Sidebar akhir: Dasbor / SDM / Proyek / Dokumen (Berkas, Tanda tangan) / Akun (Penggajian). |

## 14. Perbandingan "task milik sendiri" memakai PIC, bukan pemanggil

| | |
| --- | --- |
| **Gejala** | Semua baris task menampilkan kontrol yang sama; karyawan non-PIC bisa melihat dropdown status untuk task orang lain. |
| **Akar masalah** | `const mine = task.assigneeUserId === detail.picUserId`. |
| **Perbaikan** | Saat ini pemanggil tidak lagi di-hardcode: dialog/aksi task mengikuti `detail.isPic` untuk pemilik proyek dan server tetap menolak (`own task unless task:assign`). |
| **Bukti** | `bun test test/unit/project.service.test.ts` pass; UI menampilkan aksi edit/hapus hanya untuk PIC. |

---

## Belum diperbaiki

| # | Masalah | Dampak | Rekomendasi |
| --- | --- | --- | --- |
| 1 | **Permintaan tanda tangan seed bukan milik akun walk-through.** `portal-demo.seeder.ts` memilih karyawan pertama (`admin_seed` = `EMP-00001`), sementara walk-through memakai `hr_seed_08`. | Inbox `/signature` kosong di akun uji, padahal datanya ada. | Seed diarahkan ke `INITIAL_ADMIN_EMAIL` atau sediakan flag `PORTAL_DEMO_EMAIL`. |
| 2 | **`hr.task_assigned` hanya untuk task HR; task proyek belum memberi notifikasi.** | Assignee tidak tahu saat ditambah ke task proyek. | Tambahkan template `project.task_assigned` atau pakai ulang `hr.task_assigned` di `PortalProjectService.addTask`. |
| 3 | **Penempatan tanda tangan di PDF belum pernah dijalankan** (butuh Chromium/PDF renderer). | Tidak ada bukti bahwa `signed-pdf` benar di lingkungan nyata. | Jalankan dengan Chromium aktif, uji sign → `signed-pdf`. |
| 4 | **Payslip belum punya data di tenant dev** (tidak ada salary record `approved`), dan `renderBaseUrl` mengarah ke **web-admin**, bukan portal. | Halaman `/payslips` hanya menampilkan empty state; PDF dirender memakai host admin. | Seed satu salary record approved + set `PDF_RENDER_BASE_URL` ke host yang tepat. |

## Catatan dari audit (bukan bug, tapi perlu diketahui)

- **Grant `signature_request` dibuka** untuk semua role yang bisa membaca dokumen (keputusan grill). Konsekuensi: technician/freelancer/warehouse dapat meminta tanda tangan rekan untuk dokumen yang boleh mereka baca. Test otorisasi diperbarui agar invariant yang diuji adalah "tanpa akses dokumen, tanpa request".
- **`site_attendances` satu baris per (karyawan, proyek, tanggal)**: kunjungan kedua di hari yang sama ke proyek yang sama ditolak 409. Bila kebutuhan lapangan berubah (istirahat lalu masuk lagi), butuh kolom atau index baru.
- **Portal tidak bisa mengisi koordinat lokasi proyek**: `project.addresses.latitude/longitude/site_point` hanya bisa diisi dari web-admin. Proyek tanpa koordinat menjawab 422 saat check-in (`projects.siteCoordinates`).
- **Radius bersifat global (setting `attendance/site_radius_meters`)**, bukan per proyek; nilainya di-snapshot per baris absensi sehingga perubahan setting tidak menulis ulang histori.
