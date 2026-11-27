# Ringkasan aturan arsitektur (untuk modul Oki)

Kembali ke [catatan penyesuaian](../README.md). Ringkasan satu halaman dari
dokumen yang paling berpengaruh ke modul programmer kedua (Oki): M01, M06,
M09, M10, M11, M12, dan portal karyawan. Pasangan dari
[`ringkasan-arsitektur.md`](ringkasan-arsitektur.md) (modul programmer B;
aturan lapisan kode, satu modul = satu schema, dan referensi tanpa foreign key
di bagian 1–3 file itu berlaku sama dan tidak diulang). Disusun 2026-11-27.
Ini ringkasan, bukan pengganti: bila ragu, dokumen aslinya yang berlaku.

| Sumber | Status tertulis |
|---|---|
| ADR-0002 Uang dalam satuan terkecil | accepted, 2026-10-25 |
| ADR-0006 Otorisasi dua lapis | accepted, 2026-10-29 |
| ADR-0007 / ADR-0012 Multi-organisasi; ADR-0008 Inventaris organisasi nullable | accepted, 2026-11-02 / 11-08 |
| ADR-0009 Unit bernomor seri dan peminjaman; ADR-0010 | accepted / **proposed** |
| ADR-0017 Penanggung jawab gudang | accepted dan terverifikasi, 2026-11-14 |
| ADR-0018 Investor dan customer = role aplikasi | **proposed** 2026-11-14, tapi sudah dijalankan |
| ADR-0024 Normalisasi database v2 | **proposed** 2026-11-19, tapi sudah dijalankan |
| ADR-0029 Login hanya lewat undangan | **proposed** 2026-11-21, tapi sudah dijalankan |
| ADR-0030 Keuangan kelas ERP | accepted, 2026-11-25 (Pemilik menyetujui perluasan lingkup) |
| `docs/architecture/security-and-access.md`, `docs/architecture/modules/finance.md` (dihapus 2026-11-28, ada di riwayat git) | aturan umum |

---

## 1. Otorisasi dua lapis (ADR-0006, ADR-0018)

| Lapis | Disimpan di | Isi | Fungsi |
|---|---|---|---|
| Role aplikasi | `auth.users.role` | `admin` (Better Auth), `investor`, `customer` (`appRoleNames`) | Administrasi akun dan identitas portal; **tidak** memberi hak bisnis |
| Role organisasi | `auth.members.role` | 17 `erpRoleNames` | Semua hak bisnis, per organisasi |

- **Satu sumber hak:** `packages/common/src/authorization/erp-permissions.ts`; backend, web-admin, dan seeder memakai file yang sama. Ditolak kecuali diberi.
- Beberapa role per orang disimpan dipisah koma, haknya digabung. Hanya owner memberi owner; owner terakhir tidak bisa dihapus.
- Admin aplikasi tanpa keanggotaan tidak punya akses ERP; investor/customer saja ditolak web-admin (login gate, ADR-0018 butir 5).
- Guard di `src/http/plugin.ts` (`none | session | erp | erp+session`) dan guard khusus di `src/authorization/` (gudang, portal karyawan, portal pelanggan, kunci website). Cek hak di web-admin hanya tampilan.
- **K12** (hapus organisasi) akan mengubah lapis kedua: role pindah dari `members` ke pengguna. Sampai ada ADR baru, aturan di atas tetap berlaku.

## 2. Login (ADR-0029, Better Auth)

- Staf hanya lewat undangan (`/admin/invitations`, klaim `/invitations/claim/:token`); akun harus `active`.
- Tabel `auth` diubah manual; **jangan jalankan `auth:generate`**. Waktu di opsi Better Auth dalam detik; TTL Redis dalam milidetik.
- **K13**: web-admin email/username + kata sandi; Google hanya untuk portal pelanggan (belum dijalankan).

## 3. Persetujuan dan audit

- ADR-0006 butir 6: pemisahan tugas di service, bukan di hak; pembuat tidak boleh menyetujui sendiri; perubahan status aman dari tabrakan (`WHERE status = …`).
- ADR-0030 butir 4: jurnal manual `draft → submitted → approved/posted` dengan maker-checker. Isian K1a: tetap begitu walau K1 membolehkan Pemilik di dokumen lain.
- ADR-0030 butir 7: setiap transisi status dokumen keuangan, posting rule, perubahan bagan akun, dan transisi periode **wajib** ke `audit.audit_logs`.
- Kenyataan: `AuditWriter` fire-and-forget (tidak ikut transaksi); pembayaran dan klaim biaya belum maker-checker; peminjaman aset bypass. Lihat OA5, OB7, OB8, OD2.

## 4. Keuangan (ADR-0030, `modules/finance.md` (dihapus 2026-11-28, ada di riwayat git))

- **Buku besar satu-satunya sumber kebenaran.** Hanya modul `finance` menulis tabel finance.
- Modul sumber memanggil `PostingService.postBusinessEvent(tx, …)` **di dalam transaksinya sendiri** (aturan D9); peran akun diselesaikan lewat `finance.posting_rules`. Aturan hilang = posting gagal = dokumen sumber gagal.
- SAK EP, basis akrual, hanya IDR (`currency_code = 'IDR'`), persediaan perpetual rata-rata bergerak.
- Jurnal yang sudah diposting tidak bisa diubah; koreksi lewat pembalikan. Pembalikan di periode yang tidak lagi terbuka jatuh di hari pertama periode terbuka berikutnya.
- **Periode:** `open` → `closed` (hanya jurnal penyesuaian) → `locked` (tutup keras lewat checklist). Buka kembali diaudit.
- Di luar lingkup: multi-mata uang, API DJP langsung, persentase penyelesaian, konsolidasi multi-entitas. Schema `investor` tetap dihapus; M11 hanya akan memakai kontrak laba periode terkunci.

## 5. Uang dan waktu

- **Uang = bilangan bulat rupiah-sen** (ADR-0002), tidak pernah float. Nilai aset (OD3) melanggar ini di beberapa layar dan seeder.
- **Waktu = unix milidetik** (`unix-timestamp.ts`). Tanggal bisnis Asia/Jakarta; filter tanggal Log Audit dan laporan masih UTC (M12-12).

## 6. Pajak dan gaji statutori

- Tidak ada ADR pajak tersendiri; aturan pajak ada di ADR-0030 dan backlog ERP-0016, ERP-0138, ERP-0140.
- Coretax: **ekspor XML saja**, tanpa API DJP. PPN 12% dengan DPP 11/12. PPh dipotong saat bayar pemasok (Dr Utang penuh / Cr Bank neto / Cr Utang PPh), API saja tanpa form.
- PPN dokumen penjualan/pembelian disimpan per dokumen (`vatRateBps`), sesuai keputusan M02; rencana M10 yang meminta tarif master belum diselaraskan (OC4).
- **ERP-0138 (gaji statutori):** PPh 21 TER (PP 58/2023) + rekonsiliasi Pasal 17 tahunan, BPJS, semua di balik toggle organisasi; jurnal gaji saat disetujui (`payroll.approved`) dan dibayar (`payroll.paid`). Tabel PTKP/TER/tarif ada di schema `tax` (Oki); data gaji di `human_resource` (Dafrin, T19/T20). Sebagian: format BP21 belum diuji impor, tabel TER resmi belum diimpor, tanpa bukti potong A1 tahunan.
- Gerbang D12 (kolom ekspor), D14 (pembulatan), D18 (tarif) masih terbuka.

## 7. Aset vs aset tetap

| Bagian | Letak | Modul | Pemilik |
|---|---|---|---|
| Unit bernomor seri, status aset, peminjaman, penghapusan | `inventory.items`, `inventory.borrowings` (ADR-0009; ADR-0010 masih proposed) | `inventory` | Bersama: stok = Dafrin, aset/peminjaman = Oki (OD8, belum disepakati) |
| Buku aset tetap, penyusutan bulanan, jurnal kapitalisasi/pelepasan | `finance.fixed_asset_books`, `finance.asset_depreciations` (ERP-0145) | `finance` | Oki |

Nilai buku item ditulis finance lewat `ItemService.applyDepreciation` (kontrak
`inventory`), bukan langsung ke tabel. Modul `assets` (11 tabel) di rencana M06
**tidak pernah dibangun**.

## 8. Schema yang dipegang Oki

| Schema | Modul backend | Tabel (`docs.dbml`) | Catatan |
|---|---|---|---|
| `auth` | `user`, `organization` | 11 | Tabel inti Better Auth; terdampak K12 |
| `finance` | `finance` | 35 | `module-ownership.md` menulis 30 |
| `tax` | `tax` | 8 | `module-ownership.md` menulis 5 |
| `payment` | `payment` (+ `webhook` tanpa schema) | 5 | Gateway Xendit/SingaPay |
| `audit` | `audit` | 1 | Penulis audit ada di tiap modul |
| `company`, `document`, `notification` | masing-masing | 4, 12, 2 | Pemilik belum ditetapkan (K11); diusulkan Oki karena dekat M12 |
| `inventory` (bagian aset) | `inventory` | 21 (bersama) | Lihat bagian 7 |

---

## 9. Bagian dokumen yang sudah tidak cocok dengan kode

Melanjutkan D1–D6 di [`ringkasan-arsitektur.md`](ringkasan-arsitektur.md)
bagian 7. Ditemukan saat menyusun catatan modul Oki; perlu izin pemilik
dokumen sebelum diperbaiki.

| No | Dokumen | Tertulis | Kenyataan di kode | Pemilik dokumen |
|---|---|---|---|---|
| D1 | ADR-0024 | Status "proposed" | Sudah dijalankan (20 schema) | Oki |
| D2 | `architecture.md` | 18 schema, 188 tabel | 20 schema (ADR-0026) | Oki |
| D3 | `security-and-access.md:32` | 19 `erpRoleNames` | 17 (ADR-0018) | Oki |
| D4 | `security-and-access.md:241-242` | Persetujuan ditolak tanpa `approval_rule` / `DEFAULT_APPROVAL_LIMIT` | Tidak ada di backend | Oki |
| D5 | ADR-0006 butir 6 | Larangan menyetujui sendiri untuk semua | Bypass di penyesuaian stok **dan** peminjaman aset; arah K1 membolehkan Pemilik | Oki |
| D6 | `security-and-access.md` | Beberapa role per anggota | Cocok (dicek 2026-11-26) | — |
| D7 | ADR-0018, ADR-0029 | Status "proposed" | Sudah dijalankan (role aplikasi, login gate, undangan) | Oki |
| D8 | `docs/database/module-ownership.md` | 199 tabel; finance 30, tax 5, payment 5 | `docs.dbml` punya 208 `Table`; finance 35, tax 8 | Oki |
| D9 | AGENTS.md, `module-ownership.md` | Setiap schema punya `code_numberings` | 14 dari 20 schema | Bersama |
| D10 | `docs/architecture/role-permission.md:1493-1497` | `/admin/invitations` "every organization member" | Dicek admin aplikasi di controller (`invitation.controller.ts:48-51`) | Oki (generator `gen-role-permission.ts`) |
| D11 | `docs/architecture/role-permission.md` (sekitar 761-768, 981-998, 1334-1346) | Rute portal karyawan "no guard macro" | Dijaga `employee-portal-guard.ts`; generator belum mengenalinya | Oki (generator) |
| D12 | `docs/architecture/role-permission.md:873` | `accounting_period:create` "no org role" | Benar, tapi berarti "Siapkan periode" tidak bisa dipakai siapa pun (OB4) | Oki |
| D13 | Rencana `m12-reports-access.md` | 6 role (owner, finance, admin, hr, warehouse, technician); ekspor dan arsip "none"; setiap ekspor diaudit | 17 role; arsip bulanan dan ekspor CSV/XLSX ada; ekspor tidak diaudit | Oki |
| D14 | Rencana `m11-bonuses-investors.md:113-121` | 11 tabel schema `investor` | Schema dihapus (ADR-0024, ADR-0030); butuh ADR baru | Oki |
| D15 | Rencana `m06-assets-equipment.md:96-108` | Modul `assets` (11 tabel) "planned", register "none" | Aset di `inventory` + aset tetap di `finance`; status dan kondisi aset berbeda | Oki |
| D16 | Rencana `m09-finance.md:157`, `m10-tax.md:108` | Status "planned", tabel "Current state" 2026-11-04 | Fase A–D ADR-0030 sudah diimplementasi; M10 tanpa Coretax padahal ADR-0030 menambahkannya | Oki |
| D17 | Rencana `m01-dashboard.md` | Tombol Refresh, kartu SPH terbuka, endpoint lama, lencana provisional bersyarat | Tanpa tombol (60 detik), endpoint `/sales/...`/`/finance/...`, lencana selalu tampil | Oki |
| D18 | Rencana `m08-employees-attendance.md:61,66` | "No GPS", "no employee self-service app" | Portal karyawan dan absen GPS (ERP-0159..0164); tanpa ADR portal karyawan/PostGIS | Dafrin (rencana), Oki (ADR portal) |
| D19 | `lembar-keputusan-rapat.md` K12, `lintas-modul/autentikasi-dan-hak-akses.md` | "ADR-0006/ADR-0031" | Sudah dibetulkan 2026-11-27 menjadi ERP-0031 (tautan gudang–organisasi). Sisa: ADR-0012 ganda, ADR-0028 tidak ada | Dafrin (catatan), Bersama (penomoran ADR) |
| D20 | `ledger.controller.ts:210-213` (komentar) | `reopen` tidak diberikan ke Akuntan | Akuntan punya `reopen` (`erp-permissions.ts:792`) | Oki |

## 10. Yang perlu diingat saat mengerjakan modul Oki

1. Hak baru = ubah `erp-permissions.ts`, lalu `bun docs/architecture/gen-role-permission.ts` di perubahan yang sama.
2. Setiap aksi keuangan: posting di transaksi dokumen sumber, maker-checker, dan audit wajib (ADR-0030).
3. Uang rupiah-sen, waktu unix milidetik, tanggal bisnis Asia/Jakarta.
4. Ubah tabel: `docs.dbml` dulu, lalu Drizzle, migrasi append-only, dan `bun docs/database/validate-dbml.ts` harus `OK`.
5. K12 dan M11 butuh ADR baru sebelum kode.
