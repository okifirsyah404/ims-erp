# Peta kode tugas Oki

Disusun 2026-11-28. Kembali ke [aturan pengerjaan](README.md) ·
[catatan penyesuaian](../README.md).

**Kegunaan.** Satu entri per tugas Oki: perilaku yang dituju
(**Seharusnya**, dengan nomor keputusan), keadaan kode sekarang
(**Sekarang**, dengan bukti `path:baris`), file yang disentuh, skema,
test, UAT, dan ketergantungan. Bukti baris dicek ke kode pada 2026-11-28
(branch `docs/adjustment-langkah-7`, sama dengan `main` sesudah PR #171).
Nomor baris bisa bergeser; cari nama fungsinya bila tidak cocok.

**Cara pakai.**
1. Cari ID tugas di indeks di bawah (`P7-*`, `M12-*`, `M09-*`, `M10-*`,
   `M06-*`, `M11-*`, `PK-*`, `X-*`, atau `PH-*` untuk baris peta halaman
   yang belum punya nomor sendiri).
2. Buka **hanya** file di tabel "File yang diubah" entri itu. Path bertanda
   **(baru)** belum ada; namanya usulan sesuai konvensi modul.
3. Bila menyentuh skema: Gate 1 (`docs/database/`, `docs.dbml` dulu) dan
   Gate 2 (grill) sesuai `AGENTS.md`, lalu `gen-logical-references.ts` dan
   `validate-dbml.ts`.
4. Tulis UAT di `uat/` memakai butir **UAT** entri sebagai titik awal
   ([`uat-pengerjaan.md`](uat-pengerjaan.md)).
5. Yang ditandai "dicek saat desain" belum dipastikan di kode; jangan
   dianggap sudah ada.

**Singkatan sumber.** OA–OG: [`bahan-keputusan-modul-oki.md`](../2-keputusan/bahan-keputusan-modul-oki.md);
K*, RO*, X*, KL-*: [`lembar-keputusan-rapat.md`](../2-keputusan/lembar-keputusan-rapat.md);
IV: [`rancangan-investor-m11.md`](../3-rancangan/rancangan-investor-m11.md);
BP: [`rancangan-biaya-perjalanan.md`](../3-rancangan/rancangan-biaya-perjalanan.md);
KL: [`rancangan-karyawan-kantor-lapangan-freelance.md`](../3-rancangan/rancangan-karyawan-kantor-lapangan-freelance.md);
NM: [`rancangan-serah-terima.md`](../3-rancangan/rancangan-serah-terima.md);
N8: [`rancangan-n8n-whatsapp.md`](../3-rancangan/rancangan-n8n-whatsapp.md);
KF: [`kekurangan-fitur.md`](../3-rancangan/kekurangan-fitur.md);
RD/RM/PM: [`rancangan-menu-dasbor-dan-form.md`](../3-rancangan/rancangan-menu-dasbor-dan-form.md).
Path backend relatif ke `apps/backend/`, web-admin ke `apps/web-admin/src/`,
portal karyawan ke `apps/web-employee/src/`, kecuali ditulis lengkap.

---

## Indeks

**Cara memakai:** kerjakan dari **nomor terkecil** yang semua isi kolom
"Mulai setelah" sudah masuk `main`. Kalau masih menunggu orang lain, lompat
ke nomor berikutnya yang sudah bisa, lalu kembali. Jangan membuka tugas di
luar daftar ini. Urutan disusun 2026-11-28 dari baris "Bergantung pada"
setiap entri: tugas yang ditunggu banyak tugas lain ada di atas. Tugas
yang menunggu Dafrin, Aqim, atau Bella ditulis dengan nama orangnya.

| No | Tugas | Judul | Prioritas | Mulai setelah |
|---|---|---|---|---|
| 1 | [P7-1](#p7-1-audit-di-dalam-transaksi-tinggi-oa5oa7-l-1) | Audit di dalam transaksi | Tinggi | — (mulai sekarang) |
| 2 | [P7-2](#p7-2-ubah-adr-0006-tinggi-k1-k1a-e5) | Ubah ADR-0006 | Tinggi | P7-1 |
| 3 | [P7-4](#p7-4-hak-role-baru-tinggi-k2-k2b-k2d-ro1-ro4-oa8-oa12-kl-6-kl-10-b4) | Hak role baru | Tinggi | — |
| 4 | [P7-7](#p7-7-server-siap-pakai-dan-batas-login-tinggi-nm-5-nm-6-l-10-l-11) | Server siap pakai + batas login | Tinggi | — (bagian dev); Aqim: server dan SMTP untuk produksi |
| 5 | [M12-2](#m12-2-k12-hapus-organisasi-total-dalam-satu-pr-tinggi-oa1-oa2) | K12: hapus organisasi total dalam satu PR | Tinggi | P7-1, P7-4; umumkan ke Dafrin sebelum mulai |
| 6 | [M12-14](#m12-14-ubah-role-dari-halaman-pengguna--bug-form-karyawan-tinggi-kf-r1-kf-r2) | Ubah role dari halaman Pengguna + bug form karyawan | Tinggi | M12-2 |
| 7 | [PH-UNDANG](#ph-undang-pengguna--undang-tinggi-oa12-oa13-k12) | Pengguna / Undang | Tinggi | M12-2, P7-4 |
| 8 | [M12-15](#m12-15-atur-ulang-kata-sandi-oleh-admin-tinggi-kf-r3) | Atur ulang kata sandi oleh admin | Tinggi | P7-1 |
| 9 | [PH-MASUK](#ph-masuk-halaman-masuk-tanpa-google-pesan-nonaktif-tinggi-k13-oa3-oa14) | Masuk tanpa Google, pesan nonaktif | Tinggi | — |
| 10 | [M09-2](#m09-2-pemilih-akun-berpencarian-tinggi-ob2) | Pemilih akun berpencarian | Tinggi | P7-4 |
| 11 | [M09-15](#m09-15-pindah-dana-antar-kasbank-tinggi-kf-k1) | Pindah dana antar kas/bank | Tinggi | M09-2 |
| 12 | [M09-3](#m09-3-layar-pembayaran-pemasok-tinggi-ob3) | Layar pembayaran pemasok (baru) | Tinggi | M09-2, P7-1 |
| 13 | [M09-4](#m09-4-siapkan-dan-buka-kembali-periode-tinggi-ob4-ob6-ro1-ro4) | Siapkan dan buka kembali periode | Tinggi | P7-1, P7-4 |
| 14 | [M09-16](#m09-16-batalkan-transaksi-kasbank-tinggi-kf-k2) | Batalkan transaksi kas/bank | Tinggi | P7-1 |
| 15 | [M09-8](#m09-8-write-off-langsung-ke-beban-tinggi-ob10) | Write-off langsung ke beban | Tinggi | — |
| 16 | [M10-1](#m10-1-jenis-pajak-memakai-kosakata-server-tinggi-oc1) | Jenis pajak kosakata server | Tinggi | — |
| 17 | [M10-2](#m10-2-hitung-ulang-catatan-pajak-draf-tinggi-oc2) | Hitung ulang catatan pajak draf | Tinggi | M10-1 |
| 18 | [M10-3](#m10-3-masa-bupot-otomatis-tinggi-oc3) | Masa Bupot otomatis | Tinggi | — |
| 19 | [M06-3](#m06-3-sen-di-penyimpanan-rupiah-di-layar-tinggi-od3) | Sen di penyimpanan, rupiah di layar | Tinggi | — |
| 20 | [M06-14](#m06-14-satu-jalur-penyusutan-tinggi-kf-a1) | Satu jalur penyusutan | Tinggi | M06-3 |
| 21 | [M06-6](#m06-6-tolak-hapusnonaktif-aset-yang-dipinjam-tinggi-od6) | Tolak hapus/nonaktif aset dipinjam | Tinggi | — |
| 22 | [M06-1](#m06-1-daftar-unit-yang-bisa-dipinjam-tinggi-od1) | Daftar unit yang bisa dipinjam | Tinggi | P7-4 |
| 23 | [M09-7](#m09-7-kasbon-dan-pertanggungjawaban-satu-langkah-tinggi-ob9-ob13-ro5-ro6-kl-10) | Kasbon + pertanggungjawaban satu langkah | Tinggi | P7-1, P7-2, P7-4; Dafrin: P7-3 |
| 24 | [M06-2](#m06-2-persetujuan-sendiri-peminjaman-ikut-k1-tinggi-od2) | Persetujuan sendiri peminjaman ikut K1 | Tinggi | P7-1, P7-2; Dafrin: P7-3 |
| 25 | [PH-PINJAM](#ph-pinjam-halaman-peminjaman-aset-tinggi-od4-c13-od7-fu13) | Halaman Peminjaman Aset | Tinggi | M06-1, M06-2 |
| 26 | [PH-PORTAL](#ph-portal-portal-karyawan-kasbon-riwayat-lokasi-lupa-sandi-radius-tinggi-ob13-og1og3-pk-1) | Portal: kasbon, riwayat lokasi, lupa sandi, radius | Tinggi | P7-7, M09-7; persetujuan Dafrin (absensi lokasi) |
| 27 | [PK-9](#pk-9-layar-admin-kunjungan-lokasi-tinggi-kf-e1) | Layar admin kunjungan lokasi | Tinggi | persetujuan Dafrin (modul `project`) |
| 28 | [M12-16](#m12-16-ekspor-daftar-utama--pdf-laporan-berkop-tinggi-kf-r5-kf-r6) | Ekspor daftar utama + PDF laporan berkop | Tinggi | P7-1, P7-7; endpoint ekspor Dafrin |
| 29 | [M09-17 + M10-13](#m09-17--m10-13-pph-23-dipotong-pelanggan-tinggi-kf-k3-kf-t3) | PPh 23 dipotong pelanggan | Tinggi | dikerjakan bersama Dafrin B-33 |
| 30 | [M10-11](#m10-11-terutang--dibayar--sisa-per-masa-tinggi-kf-t1) | Terutang / dibayar / sisa per masa | Tinggi | M09-17, M10-3 |
| 31 | [M09-18](#m09-18-pembayaran-upah-freelance-tinggi-kl-4) | Pembayaran upah freelance | Tinggi | M09-3; Dafrin: B-45 |
| 32 | [PK-10](#pk-10-menu-portal-per-penempatan-dan-freelance-tinggi-kl-2-kl-5-kl-10) | Menu portal per penempatan/freelance | Tinggi | P7-4, M09-18; Dafrin: B-45 |
| 33 | [M09-19](#m09-19-biaya-perjalanan-kasbon-nota-klaim-batas-tinggi-bp-1bp-6) | Biaya perjalanan | Tinggi | M09-7, PH-PORTAL; dikerjakan bersama Dafrin B-48 |
| 34 | [PH-LAPHARIAN](#ph-lapharian-portal-laporan-harian-tinggi-b-44-dafrin--oki) | Portal: laporan harian (layar) | Tinggi | Dafrin: B-44 |
| 35 | [PH-IMPOR](#ph-impor-impor-data-awal-modul-oki-tinggi-l-12-nm-1-nm-2) | Impor data awal (bagian Oki) | Tinggi | Dafrin: P7-6, P7-3 |
| 36 | [M11-4](#m11-4-adr-dan-schema-investor-tinggi-iv-1) | ADR + schema investor | Tinggi | Aqim: rincian dana per proyek (IV-5); boleh diselipkan lebih awal begitu jawabannya ada |
| 37 | [M11-5](#m11-5-daftar-investor-dan-dana-tinggi-iv-2iv-4-iv-7-iv-8) | Daftar investor dan dana | Tinggi | M11-4, P7-1 |
| 38 | [M11-6](#m11-6-bagi-hasil-tahunan-tinggi-iv-5) | Bagi hasil tahunan | Tinggi | M11-5; Aqim: aturan rinci |
| 39 | [M11-7](#m11-7-portal-investor-tinggi-iv-6-iv-9-iv-10) | Portal investor | Tinggi | M11-5, M11-6, P7-7 |
| 40 | [X-13](#x-13-backup-harian-dan-panduan-deploy-tinggi-nm-3-nm-10-l-13) | Backup harian + panduan deploy | Tinggi | P7-7; Aqim: akses server, lokasi backup |
| 41 | [X-7](#x-7-deploy-s3-smtp-scheduler-web-investor-backup-tinggi-untuk-produksi) | Deploy S3/SMTP/scheduler/backup | Tinggi produksi | P7-7, X-13 |
| 42 | [X-14](#x-14-n8n-dan-waha-self-host-tinggi-n8-1-n8-2) | n8n + WAHA self-host | Tinggi | P7-7, X-13; Dafrin: B-46 |
| 43 | [PH-WA](#ph-wa-profil-pengguna-nomor-wa-staf-tinggi-b-46) | Profil pengguna: nomor WA staf | Tinggi | X-14; Dafrin: B-46 |
| 44 | [M10-9](#m10-9-gerbang-sebelum-lapor-tinggi-sebelum-lapor-oc8) | Gerbang sebelum lapor | Tinggi sebelum lapor | M09-3, M10-3; Bella: keputusan (sebelum lapor pajak) |
| 45 | [M10-12](#m10-12-pengaturan-rezim-pajak-sedang-tinggi-bila-umkm-kf-t2) | Pengaturan rezim pajak | Sedang (Tinggi bila UMKM) | Bella: rezim pajak |
| 46 | [PH-DASBOR](#ph-dasbor-dasbor-sedang-rd1rd3-of1of3) | Dasbor (M01-1..M01-4) | Sedang | P7-4; kartu modul Dafrin (langkah 9) |

**Tanpa nomor sendiri** (dikerjakan di tugas lain; entrinya tetap ada di bawah sebagai rincian): M12-1 = P7-1, M12-5 = P7-4, M09-1 = P7-4, X-1 = M12-2 + P7-4, X-2 = P7-3 (Dafrin), X-3 = P7-5 (Dafrin), X-4 = P7-1, X-5 = P7-7.


---

## Langkah 7

### P7-1 Audit di dalam transaksi (Tinggi, OA5–OA7, L-1)

- **Seharusnya:**
  - Peristiwa wajib ditulis **di transaksi yang sama** dengan perubahan
    bisnisnya; gagal tulis audit = transaksi batal (OA5 b).
  - Peristiwa wajib minimal: perubahan role anggota, hapus anggota,
    aktif/nonaktif akun, ekspor (siapa/apa/kapan, tanpa isi), dan
    **persetujuan oleh pembuat sendiri** dengan `meta.self_approved = true`
    (OA6, OA7 bentuk a).
  - Disediakan penulis audit untuk modul `sale`, `procurement`,
    `human_resource`, `payment` (dipakai Dafrin di P7-3).
  - Peristiwa tidak wajib boleh tetap fire-and-forget.
- **Sekarang:**
  - `AuditService.record` menelan galat (`src/app/audit/services/audit.service.ts:31-40`);
    `AuditWriter.record` "never throws" (`src/shared/audit/audit.writer.ts:20-45`);
    `AuditRepository.insert` tidak menerima `tx` (`src/app/audit/repositories/audit.repository.ts:37`).
  - Aksi `member.roleChanged` dan `member.removed` sudah ada di kosakata
    (`drizzle/schemas/audit.schema.ts:30-50`) tetapi tidak pernah ditulis;
    `updateMemberRole`/`removeMember` tanpa audit (`src/app/organization/services/organization.service.ts:553, 589`).
    Unit transaksi tersedia di `src/providers/database/transaction-runner.ts:16-24`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/audit/contracts/audit.repository.interface.ts` | `insert(entry, tx?)`; target type baru bila perlu (`payment`, `quotation`, `purchase_order`, … dicek saat desain) |
| backend | `src/app/audit/repositories/audit.repository.ts` | Pakai `tx ?? this.database` |
| backend | `src/app/audit/services/audit.service.ts` | Tambah `recordInTx(entry, tx)` yang **melempar** galat; `record` tetap untuk yang tidak wajib |
| backend | `src/shared/audit/audit.writer.ts` | `recordInTx(input, tx)`; helper `selfApproved` untuk `meta` |
| backend | `drizzle/schemas/audit.schema.ts` | Tambah aksi (mis. `*.self_approved` tidak perlu bila OA7 a; `export.performed`, `quotation.approved`, `purchase_order.approved`, … dicek saat desain). Kolom `action` bertipe `text` tanpa CHECK, jadi tanpa migrasi |
| backend | `src/app/organization/services/organization.service.ts` | Tulis `member.roleChanged`, `member.removed`. Role berubah lewat gateway Better Auth (bukan Drizzle tx): urutan "audit dalam tx + panggil gateway" dicek saat desain |
| backend | `src/app/user/services/user-admin.service.ts` | Nonaktif/aktif/hapus (`:94-160`) memakai jalur wajib |
| backend | `src/app/{sale,procurement,human-resource,payment}/container.ts` | Daftarkan instance `AuditWriter` per modul (pola `FINANCE_AUDIT_WRITER_TOKEN` di `src/app/finance/constants/di.ts`) |
| backend | `src/app/{sale,procurement,human-resource,payment}/constants/di.ts` | Token `*_AUDIT_WRITER_TOKEN` |
| test | `test/unit/audit-writer.test.ts` **(baru)** | `recordInTx` melempar; transaksi gagal tidak menyisakan baris |
| test | `test/helpers/audit-writer-double.ts` | Tambah `recordInTx` pada double |
| test | `test/unit/user-admin.service.test.ts`, `test/unit/multi-organization.test.ts` | Audit role berubah/anggota dihapus |
| docs | `docs/database/docs.dbml` (`audit.audit_logs`), catatan audit di `docs/database/docs.dbml` | Catatan "wajib dalam transaksi"; kosakata aksi |

- **Skema/migrasi:** tidak (kolom `action` text bebas, indeks sudah ada di `audit_logs`). Bila desain menambah indeks untuk `meta->>'self_approved'`: `docs.dbml` dulu, migrasi baru.
- **Test:** di atas; `bun run test` di backend.
- **UAT:**
  1. Ubah role anggota → Log Audit menampilkan baris "role diubah" dengan role lama dan baru.
  2. Hapus anggota → baris "anggota dikeluarkan".
  3. Paksa audit gagal (test) → perubahan bisnis ikut batal.
- **Bergantung pada:** — . Dibutuhkan oleh P7-2, P7-3 (Dafrin), M06-2, M12-16.

**Prompt AI (salin):**

```text
Kerjakan P7-1 Audit di dalam transaksi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian P7-1 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/audit/contracts/audit.repository.interface.ts, src/app/audit/repositories/audit.repository.ts, src/app/audit/services/audit.service.ts, src/shared/audit/audit.writer.ts, drizzle/schemas/audit.schema.ts, src/app/organization/services/organization.service.ts, src/app/user/services/user-admin.service.ts, src/app/{sale,procurement,human-resource,payment}/container.ts, src/app/{sale,procurement,human-resource,payment}/constants/di.ts, docs/database/docs.dbml, audit.audit_logs, docs/architecture/modules/.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/audit-writer.test.ts, test/helpers/audit-writer-double.ts, test/unit/user-admin.service.test.ts, test/unit/multi-organization.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-1 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-1.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### P7-2 Ubah ADR-0006 (Tinggi, K1, K1a, E5)

- **Seharusnya:**
  - Butir 6 ADR-0006: pembuat ≠ penyetuju, **kecuali Pemilik** yang boleh
    menyetujui dokumennya sendiri, wajib tercatat di audit (`meta.self_approved`) (K1).
  - Kasbon dan pertanggungjawaban ikut K1; **jurnal manual tetap orang kedua** (K1a, diganti 27/11).
  - Pembayaran, gaji, klaim biaya tanpa pemeriksa kedua diterima, diawasi lewat audit (K7a, OB7, OB8).
- **Sekarang:** ADR-0006 butir 6 menyatakan pemisahan tugas di service tanpa pengecualian Pemilik (`docs/architecture/decisions/ADR-0006-two-layer-authorization.md:45-50`); `security-and-access.md` masih 19 role dan `approval_rule` (OH3).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/architecture/decisions/ADR-0006-two-layer-authorization.md` | Butir 6 diubah + bagian "Revisi 2026-11" |
| docs | `docs/architecture/security-and-access.md` | **Tidak diubah** (ditahan atas arahan programmer B, T-6); jangan dibuka |
| docs | `docs/plan/progress.md`, `docs/plan/backlog.md` | Entri ERP baru |

- **Skema/migrasi:** tidak.
- **Test:** tidak ada (dokumen).
- **UAT:** Dafrin membaca butir 6 dan bisa menurunkan aturan P7-3 tanpa bertanya.
- **Bergantung pada:** P7-1. Dibutuhkan oleh P7-3 (Dafrin), M06-2, M09-7.

**Prompt AI (salin):**

```text
Kerjakan P7-2 Ubah ADR-0006.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian P7-2 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/architecture/decisions/ADR-0006-two-layer-authorization.md, docs/plan/progress.md, docs/plan/backlog.md. Jangan membuka atau mengubah security-and-access.md (ditahan, T-6).
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: tambahkan/jalankan test yang disebut di bagian Test entri ini.
Selesai bila semua butir UAT di entri P7-2 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-2.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### P7-4 Hak role baru (Tinggi, K2, K2b, K2d, RO1, RO4, OA8, OA12, KL-6, KL-10, B4)

- **Seharusnya:**
  - `sales_manager` berlabel "Penjualan"; `sales`, `admin` (role organisasi), `member`, `auditor` **tidak ditawarkan** di form (K2b, OA9); tanda admin aplikasi Aqim tetap.
  - `finance` mendapat semua hak `accountant` (`chart_of_account`, `journal`, `accounting_period`, `asset:read`, `project:read`, `investor_report`, …); `accountant` tidak ditawarkan (K2d, OB1, OB5).
  - `accounting_period:create` untuk Pemilik + Keuangan (RO1); `reopen` **hanya Pemilik** (RO4).
  - `audit_log:read` hanya Pemilik (OA8); `invitation:create` dicabut dari `hr` (OA12).
  - `freelancer` diperluas: proyek yang ditugaskan, `asset_borrowing:read,create`, `advance:read,create` (KL-6); kasbon untuk siapa pun dengan tugas proyek aktif (KL-10, cek di service, bukan hak); Gudang baca PO/SO (B4).
- **Sekarang:**
  - 17 role di `packages/common/src/authorization/erp-permissions.ts:257-275`; label `sales_manager` = "Manajer Penjualan" (`:292`); `assignableOrganizationRoles` menawarkan semua role (`:404-420`).
  - `finance` tanpa `chart_of_account`/`journal`/`accounting_period`/`advance` (`:746-784`); `accountant` punya `reopen` (`:792`); `hr` punya `invitation` (`:835`); `admin` dan `auditor` punya `audit_log:read` (`:564`, `:878`); `freelancer` hanya tugas/laporan/settlement/dokumen (`:694-700`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend (common) | `packages/common/src/authorization/erp-permissions.ts` | Grant baru, label, daftar role yang ditawarkan (konstanta baru mis. `offeredOrganizationRoles`, dipakai `assignableOrganizationRoles`) |
| backend | `src/app/finance/controllers/ledger.controller.ts:205-218` | Transisi periode `locked → open` memeriksa `accounting_period:reopen` (bukan `close` + ownership) |
| backend | `src/authorization/role-assignment.ts` | Tolak role yang tidak ditawarkan saat ubah/undang |
| backend | `database/seeders/seed/organization-roles.seeder.ts`, `organization-members.seeder.ts` | Role per orang (Bella `finance`, Dafrin/Oki `freelancer`) |
| web-admin | `lib/use-caller-org-roles.ts`, `components/invite/invite-dialog.tsx` | Hanya role yang ditawarkan |
| locale | `packages/locales/src/{en,id}/admin.ts` (dicek saat desain: kunci label role) | Label baru |
| test | `packages/common/test/grantable-roles.test.ts`, `packages/common/test/invite-sheet.test.ts` | Role yang ditawarkan |
| test | `apps/backend/test/authorization/permission-matrix.test.ts`, `test/unit/role-assignment.test.ts` | Matriks hak baru, reopen hanya owner |
| docs | `docs/architecture/role-permission.md` (jalankan `bun docs/architecture/gen-role-permission.ts`) | Regenerasi; `security-and-access.md` tidak diubah (ditahan, T-6) |

- **Skema/migrasi:** tidak (data `auth.members.role` diatur ulang oleh Aqim setelah rilis; seeder ikut).
- **Test:** di atas.
- **UAT:**
  1. Form undang/ubah anggota hanya menawarkan Pemilik…Pekerja Lepas yang dipakai; tidak ada Admin, Anggota, Auditor, Akuntan, "Sales".
  2. Login Bella (Keuangan) → buka Bagan akun, Jurnal, Tutup periode "Siapkan periode", Aset tetap, Anggaran proyek tanpa 403.
  3. Bella tidak melihat tombol "Buka kembali"; Aqim melihatnya.
  4. Login SDM: tidak ada tombol Undang; Log Audit hanya terbuka untuk Pemilik.
- **Bergantung pada:** — . Dibutuhkan oleh M09-1, M09-4, M09-7, M12-14, PK-10.

**Prompt AI (salin):**

```text
Kerjakan P7-4 Hak role baru.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian P7-4 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: packages/common/src/authorization/erp-permissions.ts, src/app/finance/controllers/ledger.controller.ts:205-218, src/authorization/role-assignment.ts, database/seeders/seed/organization-roles.seeder.ts, organization-members.seeder.ts, lib/use-caller-org-roles.ts, components/invite/invite-dialog.tsx, packages/locales/src/{en,id}/admin.ts, docs/architecture/role-permission.md, docs/architecture/security-and-access.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: packages/common/test/grantable-roles.test.ts, packages/common/test/invite-sheet.test.ts, apps/backend/test/authorization/permission-matrix.test.ts, test/unit/role-assignment.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-4 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-4.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### P7-7 Server siap pakai dan batas login (Tinggi, NM-5, NM-6, L-10, L-11)

> **Dokumen yang ikut diperbarui (A-14):** `docs/architecture/runbook.md` (env `MAIL_SMTP_*`, compose dengan S3/Mailpit/Chromium, `SCHEDULER_ENABLED`, batas login, backup).

- **Seharusnya:**
  - Lingkungan uji punya Chromium (PDF SPH/slip), S3 (RustFS), SMTP dengan nama env `MAIL_SMTP_*`, `SCHEDULER_ENABLED=true` (NM-5, L-3–L-6, X-5).
  - Compose dev lengkap (RustFS + Mailpit).
  - Batas percobaan login Better Auth aktif (NM-6, L-11); disimpan di Redis (secondary storage).
  - Backup harian disiapkan (uji restore di langkah 9, lihat X-13).
- **Sekarang:**
  - Compose mengirim `SMTP_HOST/USER/PASSWORD` (`docker-compose.yml:120-122`) padahal config membaca `MAIL_SMTP_*` (`apps/backend/config/loaders/config.loader.ts:214-223`); tidak ada layanan S3/Mailpit di compose (`docker-compose.yml:12-207`).
  - Image runtime `alpine:3.24` tanpa Chromium (`apps/backend/Dockerfile:52-61`) padahal PDF butuh `PDF_CHROMIUM_PATH` (`config.loader.ts:261-265`, `src/providers/pdf/pdf-renderer.ts:36`); tidak ada `rateLimit` di `src/providers/better-auth/auth.options.ts:160-170` (bawaan Better Auth).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| deploy | `apps/backend/Dockerfile` | `apk add chromium` (+ font) di runtime; `PDF_CHROMIUM_PATH=/usr/bin/chromium-browser` |
| deploy | `docker-compose.yml` | Ganti `SMTP_*` → `MAIL_SMTP_*`; tambah `PDF_CHROMIUM_PATH`, `PDF_RENDER_BASE_URL`, `SCHEDULER_ENABLED`, `S3_ENDPOINT`, `S3_USE_PATH_STYLE` |
| deploy | `docker-compose.local.yml` | Layanan `rustfs` dan `mailpit` untuk dev |
| deploy | `.github/workflows/main-deploy-backend.yml` | Nama secret `MAIL_SMTP_*` (nama saja, jangan cetak nilai) |
| backend | `src/providers/better-auth/auth.options.ts` | `rateLimit: { enabled: true, storage: 'secondary-storage', customRules: { '/sign-in/*': … } }` (nilai dicek saat desain) |
| backend | `apps/backend/.env.example` | Variabel baru |
| test | `test/unit/login-rate-limit.auth.test.ts` **(baru)** | Opsi `rateLimit` terpasang untuk jalur sign-in |
| docs | `docs/architecture/runbook.md` | Perintah verifikasi PDF/S3/SMTP/scheduler, nama env |

- **Skema/migrasi:** tidak.
- **Test:** di atas + build image lokal.
- **UAT:**
  1. Di lingkungan uji: PDF SPH terunduh; unggah foto produk tersimpan di S3.
  2. Email undangan masuk (Mailpit di dev, SMTP di uji).
  3. Pengingat terjadwal (mis. jatuh tempo tagihan) muncul tanpa dipicu manual.
  4. Login salah beberapa kali → pesan "terlalu banyak percobaan", berhasil lagi setelah jeda.
- **Bergantung pada:** akses server dan akun SMTP dari Aqim (produksi). Terkait X-5, X-7, X-13.

---

**Prompt AI (salin):**

```text
Kerjakan P7-7 Server siap pakai dan batas login.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian P7-7 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/Dockerfile, docker-compose.yml, docker-compose.local.yml, .github/workflows/main-deploy-backend.yml, src/providers/better-auth/auth.options.ts, apps/backend/.env.example, docs/architecture/runbook.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/login-rate-limit.auth.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-7 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-7.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## M12 Laporan & Hak Akses

### M12-1 Audit peristiwa wajib (Tinggi)

Sama dengan [P7-1](#p7-1-audit-di-dalam-transaksi-tinggi-oa5oa7-l-1). Bagian ekspor (OA6) diselesaikan di M12-16.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### M12-2 K12: hapus organisasi total dalam satu PR (Tinggi, OA1, OA2)

> **Diubah 2026-11-28 (programmer B):** K12 tidak lagi bertahap. Organisasi
> dihapus **sekaligus** (tampilan, sesi, API, dan database) dalam satu PR.
> M12-3 (tahap 2) digabung ke sini; M12-7 dan M12-13 gugur.
>
> **Dokumen yang ikut diperbarui (A-14):** ADR baru K12 (menggantikan
> ADR-0001, ADR-0007, kedua ADR-0012; mengubah ADR-0006, ADR-0008, ADR-0010);
> `AGENTS.md` (aturan modul `organization` di schema `auth`, kolom tenant di
> Gate 2); `docs/database/` (`docs.dbml`, `data-dictionary.md` kolom tenant,
> `integrity-and-consistency.md`, `module-ownership.md`, lalu kedua
> generator); `docs/architecture/role-permission.md` (generator);
> `docs/architecture/runbook.md` bila perintah berubah.

- **Seharusnya:**
  - ERP untuk **satu perusahaan**: tidak ada organisasi di tampilan, sesi,
    API, maupun database.
  - **Role disimpan di tingkat pengguna**, bisa lebih dari satu per orang
    (K2, D2). Hak dihitung dari role pengguna, bukan dari `auth.members.role`.
  - Plugin `organization()` Better Auth dilepas. Tabel `auth.organizations`,
    `auth.members` dan undangan organisasi diganti **undangan pengguna**
    (email, nama, role, data karyawan). Bentuk penggantinya diputuskan di
    Gate 2 dan ditulis di ADR.
  - Kolom `organization_id` dibuang dari **semua schema** (18 file, 207 kolom
    di `docs.dbml`) dengan migrasi append-only per schema. Header
    `x-organization-id` dan `activeOrganizationId` hilang.
  - Pengaturan per organisasi (`auth.organization_settings`) pindah ke
    pengaturan perusahaan (modul `company`). Tautan gudang–organisasi
    (ERP-0031) hilang.
  - Halaman Organisasi, pemilih organisasi, dan isian organisasi di form
    Undang dihapus. Membuka `/organizations` diarahkan ke Pengguna.
  - Data dev boleh disusun ulang (belum ada produksi, ADR-0024 Q34); seed
    tetap idempoten.
- **Sekarang:**
  - Plugin: `apps/backend/src/providers/better-auth/plugins/organization.auth.ts:56`;
    hak organisasi: `providers/better-auth/ac/organization-ac.ts`; sesi
    menyimpan `active_organization_id` (`drizzle/schemas/auth.schema.ts:106`);
    tabel `organizations` (`auth.schema.ts:151`), `members`, `invitations`.
  - Guard membaca `x-organization-id`: `src/authorization/elysia-auth.ts`;
    juga `src/authorization/employee-portal-guard.ts` dan
    `providers/better-auth/ac/auth-hooks.ts`.
  - Modul backend `apps/backend/src/app/organization/`; ±316 file di
    `apps/backend/src` memakai `organizationId`.
  - Schema dengan `organization_id`: audit, auth, automation, company,
    customer, document, finance, human-resource, inventory, notification,
    payment, procurement, product, project, sale, supplier, tax, warehouse.
  - web-admin: header di 5 file `src/lib/*-api.ts`; `OrganizationSwitcher` di
    `components/sidebar/main-sidebar.tsx:61`; menu di
    `components/sidebar/nav-config.ts:653-654`; rute
    `routes/_authed/organizations/*`; `lib/organization-store.ts`,
    `lib/use-active-organization.ts`.
  - web-employee: `src/lib/organization-store.ts`,
    `src/lib/use-active-organization.ts`,
    `src/components/organization/organization-context-sync.tsx`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (**pertama**), `data-dictionary.md`, `integrity-and-consistency.md`, `module-ownership.md` | Buang `organization_id`, tabel organisasi/anggota/undangan organisasi; tambah penyimpanan role pengguna dan undangan pengguna; lalu `gen-logical-references.ts` dan `validate-dbml.ts` harus OK |
| docs | `docs/architecture/decisions/ADR-00xx-single-company.md` **(baru)** | ADR K12 (nomor dipesan saat PR) |
| schema | `apps/backend/drizzle/schemas/*.schema.ts` (18 file); `auth.schema.ts` diedit **manual** (jangan `auth:generate`) | Kolom dan indeks `organization_id` dibuang; tabel role pengguna dan undangan pengguna |
| migrasi | `apps/backend/database/migrations/` | Satu migrasi append-only per schema yang berubah, diperiksa manual |
| auth | `src/providers/better-auth/plugins/organization.auth.ts`, `ac/organization-ac.ts`, `ac/auth-hooks.ts`, `options/session.auth.ts` | Plugin organisasi dilepas; hak dari role pengguna |
| auth | `src/authorization/elysia-auth.ts`, `employee-portal-guard.ts`, `packages/common/src/authorization/` | Guard tanpa organisasi; `erp` guard membaca role pengguna |
| backend | `src/app/organization/` | Dihapus; undangan dan ubah role pindah ke modul `user` (`/admin/users`, `/admin/invitations`) |
| backend | `src/app/*/repositories`, `services`, `contracts`, `controllers` | Parameter dan filter `organizationId` dibuang di semua modul |
| backend | `src/index.ts`, `src/app/app.ts` | Registrasi dan mount modul `organization` dihapus |
| web-admin | `lib/*-api.ts` (5 file header), `lib/organization-store.ts`, `lib/use-active-organization.ts`, `components/sidebar/*`, `routes/_authed/organizations/*`, form Undang | Header, store, pemilih, menu, rute (diganti redirect ke `/admin/users`), isian organisasi dihapus; `routeTree.gen.ts` ikut |
| web-employee | `src/lib/organization-store.ts`, `src/lib/use-active-organization.ts`, `src/components/organization/` | Dihapus; portal mengenali karyawan dari pengguna |
| seed | `apps/backend/database/seeders/` | Tanpa organisasi; role diberikan ke pengguna; idempoten (jalankan dua kali) |
| locale | `packages/locales/src/{en,id}/*.ts` | Kunci organisasi yang mati dihapus (dead-key test) |
| test | `apps/backend/test/`, `apps/web-admin/test/`, `apps/web-employee` | Test organisasi dihapus/diganti; guard, undangan, role pengguna |
| docs | `AGENTS.md`, `docs/architecture/role-permission.md` (generator) | Aturan dan rute baru |

- **Skema/migrasi:** **Ya**, semua schema yang punya `organization_id`.
- **Cara kerja (satu PR besar):**
  1. Gate 1 (baca `docs/database/`) dan Gate 2 (`grill-me`) lebih dulu;
     putuskan penyimpanan role pengguna dan pengganti undangan; tulis ADR.
  2. **Umumkan ke Dafrin sebelum mulai** (K11). Selama PR terbuka, PR lain
     yang menyentuh schema/repository ditahan atau di-rebase sesudahnya.
  3. Urutan commit di dalam PR: `docs.dbml` → schema + migrasi → auth dan
     guard → repository/service/controller per modul → web-admin dan
     web-employee → seed → test → locale → dokumen.
  4. Bagian modul Dafrin (sale, customer, procurement, supplier, product,
     warehouse, inventory, project, human-resource, automation, notification)
     ditinjau Dafrin.
- **Test:** `bun run test` dan `bun run typecheck` di root; typecheck
  web-admin (`bunx tsc -p tsconfig.app.json --noEmit`); `bun run lint`;
  `bun docs/database/validate-dbml.ts` OK; `drizzle:migrate` lalu
  `drizzle:seed` dua kali di database uji yang bisa dibuang (Redis terpisah).
- **UAT:**
  1. Login semua role → tidak ada pemilih maupun menu Organisasi; menu dan
     hak sesuai role pengguna.
  2. Aqim mengundang pengguna (email, nama, role) tanpa isian organisasi →
     pengguna klaim, login, dan mendapat role yang dipilih.
  3. Satu alur per modul berjalan seperti sebelumnya: SPH → SO → faktur →
     pembayaran; PO → BPB; proyek; tiket; gaji; kas/bank; portal karyawan.
  4. Membuka `/organizations` diarahkan ke Pengguna.
  5. Database uji tidak punya kolom `organization_id` lagi
     (`validate-dbml` OK, migrasi berjalan dari kosong).
- **Bergantung pada:** P7-1, P7-4. Harus selesai **sebelum** M12-14 dan
  PH-UNDANG. Ditinjau Dafrin untuk modulnya.

**Prompt AI (salin):**

```text
Kerjakan M12-2 K12: hapus organisasi total dalam satu PR.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M12-2 (Seharusnya, File yang diubah, Cara kerja, Test, UAT).
Mulai dengan Gate 1 (docs/database/) dan Gate 2 (grill-me): putuskan penyimpanan role pengguna dan pengganti undangan, lalu tulis ADR K12. Jangan menulis kode sebelum ADR disetujui.
Edit docs/database/docs.dbml dulu, lalu gen-logical-references dan validate-dbml harus OK. auth.schema.ts diedit manual, jangan auth:generate.
Kerjakan per lapisan sesuai urutan "Cara kerja"; commit per lapisan. Jangan refactor di luar penghapusan organisasi. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Seed tanpa organisasi, idempoten (jalankan dua kali, Redis terpisah). Hapus kunci locale organisasi yang mati.
Test: bun run test, bun run typecheck, typecheck web-admin, bun run lint, validate-dbml.
Selesai bila semua butir UAT di entri M12-2 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-2.md dari templat uat-pengerjaan.md.
Laporkan hanya: keputusan Gate 2, file yang diubah per lapisan, dan hasil test.
```

### M12-5 `erp-permissions.ts` (Tinggi)

Sama dengan [P7-4](#p7-4-hak-role-baru-tinggi-k2-k2b-k2d-ro1-ro4-oa8-oa12-kl-6-kl-10-b4).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### M12-14 Ubah role dari halaman Pengguna + bug form karyawan (Tinggi, KF-R1, KF-R2)

- **Seharusnya:**
  - Di `/admin/users`, aksi "Ubah role" membuka dialog **beberapa role** (centang), hanya role yang ditawarkan (P7-4) (KF-R1).
  - Form ubah karyawan (M08) **tidak lagi menimpa** role tambahan: pilihan banyak atau role dikelola hanya di halaman Pengguna (KF-R2; dikerjakan bersama Dafrin).
  - Setiap perubahan role diaudit (P7-1).
- **Sekarang:** aksi baris hanya Nonaktifkan/Pulihkan/Hapus (`routes/_authed/admin/users/index.tsx:565-590`); role hanya bisa diubah lewat `PATCH /organizations/:organizationId/members/:memberId` (`src/app/organization/controllers/organization.controller.ts:317-318`; rute ini hilang di M12-2); form karyawan memakai satu dropdown yang mengganti seluruh daftar (`components/hr/employee-edit-form.tsx:94-110`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/user/controllers/user-admin.controller.ts` | `PATCH /admin/users/:userId/roles` **atau** pakai rute member yang ada (dicek saat desain; tetap `member:update`) |
| backend | `src/app/user/services/user-admin.service.ts` | Ganti set role (penyimpanan role pengguna dari M12-2) + audit dalam tx |
| backend | `src/app/user/contracts/admin.contract.ts` | Skema zod `roles: string[]` min 1 |
| web-admin | `routes/_authed/admin/users/index.tsx` | Aksi "Ubah role" + dialog |
| web-admin | `components/admin/user-roles-dialog.tsx` **(baru)** | Centang role, `confirm-dialog.tsx` |
| web-admin | `components/hr/employee-edit-form.tsx` | Pertahankan role tersembunyi/tambahan saat simpan (bersama Dafrin) |
| web-admin | `lib/admin-api.ts` | Fungsi `updateUserRoles` |
| locale | `packages/locales/src/{en,id}/admin.ts`, `hr.ts` | Teks dialog |
| test | `test/unit/user-admin.service.test.ts`, `test/unit/role-assignment.test.ts` | Ganti role, tolak role tak ditawarkan, audit |
| docs | `docs/architecture/role-permission.md` (generator) | Rute baru |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Aqim membuka Pengguna → Ubah role Bilal → centang Penjualan + Gudang → simpan → kolom role menampilkan keduanya (setelah F5 tetap).
  2. Ubah data karyawan Bilal (jabatan) → role tambahan tidak hilang.
  3. Log Audit mencatat perubahan role.
- **Bergantung pada:** M12-2 (role sudah disimpan di tingkat pengguna; rute anggota organisasi sudah tidak ada), P7-1, P7-4.

**Prompt AI (salin):**

```text
Kerjakan M12-14 Ubah role dari halaman Pengguna + bug form karyawan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M12-14 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/user/controllers/user-admin.controller.ts, src/app/user/services/user-admin.service.ts, src/app/user/contracts/admin.contract.ts, routes/_authed/admin/users/index.tsx, components/admin/user-roles-dialog.tsx, components/hr/employee-edit-form.tsx, lib/admin-api.ts, packages/locales/src/{en,id}/admin.ts, hr.ts, docs/architecture/role-permission.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/user-admin.service.test.ts, test/unit/role-assignment.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M12-14 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-14.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M12-15 Atur ulang kata sandi oleh admin (Tinggi, KF-R3)

- **Seharusnya:**
  - Aqim memberi **kata sandi sementara** untuk pengguna dari halaman Pengguna; semua sesi pengguna itu dicabut.
  - Pengguna wajib mengganti kata sandi saat masuk berikutnya (dicek saat desain: penanda di `auth.users` atau alur reset email).
  - Aksi diaudit (`user.passwordReset`).
- **Sekarang:** tidak ada layar; Better Auth `admin()` menyediakan `setUserPassword` (`src/providers/better-auth/plugins/admin.auth.ts:7`) tetapi tidak dipakai di `src/app/user/adapters/better-auth-user-management.ts` (dicek saat desain).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/user/contracts/user-management-auth.gateway.interface.ts`, `src/app/user/adapters/better-auth-user-management.ts` | Metode `setPassword` + `revokeSessions` |
| backend | `src/app/user/services/user-admin.service.ts` | `resetPassword(userId, actor)` + audit |
| backend | `src/app/user/controllers/user-admin.controller.ts` | `POST /admin/users/:userId/reset-password` (`member:update`, hanya Pemilik/admin aplikasi) |
| backend | `drizzle/schemas/audit.schema.ts` | Aksi `user.passwordReset` |
| web-admin | `routes/_authed/admin/users/index.tsx`, `components/admin/reset-password-dialog.tsx` **(baru)** | Aksi + tampil kata sandi sementara sekali |
| locale | `packages/locales/src/{en,id}/admin.ts` | Teks |
| test | `test/unit/user-admin.service.test.ts` | Sesi dicabut, audit, hak |

- **Skema/migrasi:** mungkin (kolom "wajib ganti kata sandi" di `auth.users`): bila ya, `docs.dbml` dulu dan edit tangan `auth.schema.ts` (jangan `auth:generate`).
- **Test:** di atas.
- **UAT:**
  1. Aqim → Pengguna → Atur ulang kata sandi Fahri → muncul kata sandi sementara.
  2. Fahri login dengan kata sandi sementara, diminta mengganti.
  3. Sesi lama Fahri di perangkat lain keluar.
- **Bergantung pada:** P7-1.

**Prompt AI (salin):**

```text
Kerjakan M12-15 Atur ulang kata sandi oleh admin.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M12-15 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/user/contracts/user-management-auth.gateway.interface.ts, src/app/user/adapters/better-auth-user-management.ts, src/app/user/services/user-admin.service.ts, src/app/user/controllers/user-admin.controller.ts, drizzle/schemas/audit.schema.ts, routes/_authed/admin/users/index.tsx, components/admin/reset-password-dialog.tsx, packages/locales/src/{en,id}/admin.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/user-admin.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M12-15 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-15.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M12-16 Ekspor daftar utama + PDF laporan berkop (Tinggi, KF-R5, KF-R6)

- **Seharusnya:**
  - Ekspor CSV/XLSX untuk daftar utama yang punya izin `export` tanpa endpoint: pelanggan, faktur, piutang, karyawan, log audit; **endpoint per modul dikerjakan pemilik modulnya** (Oki: piutang, log audit; Dafrin: pelanggan, faktur, karyawan).
  - Setiap ekspor diaudit (siapa, apa, kapan, saringan; tanpa isi file) (OA6).
  - PDF laporan keuangan (laba rugi, neraca, arus kas) berkop perusahaan (KF-R6).
  - Perbaiki alamat CSV laporan keuangan (OB12, sekalian).
- **Sekarang:** CSV laporan ada di `/finance/reports/*.csv` (`src/app/finance/controllers/finance-operations.controller.ts:421-460`) tetapi web memanggil `/reports/*.csv` tanpa `/finance` (`components/finance/reports-page.tsx:100-119`); Log Audit hanya `GET` baca (`src/app/audit/controllers/audit.controller.ts:35-39`); ±20 izin `export` tanpa endpoint (`packages/common/src/authorization/erp-permissions.ts:32-111`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/audit/controllers/audit.controller.ts`, `src/app/audit/services/audit-query.service.ts` | `GET /admin/audit/export.csv` (`audit_log:export`) |
| backend | `src/app/finance/controllers/receivables.controller.ts` | `GET …/receivables/export.csv` (dicek saat desain: alamat daftar piutang) |
| backend | `src/app/finance/controllers/finance-operations.controller.ts` | `…/reports/*.pdf` memakai renderer PDF + kop `company` |
| backend | `src/providers/pdf/pdf-renderer.ts` | Dipakai ulang (tanpa perubahan bila cukup) |
| backend | `src/shared/export/` **(baru, bagian bersama K11)** | Pembantu CSV/XLSX + audit ekspor; dipakai semua modul |
| web-admin | `components/finance/reports-page.tsx` | Alamat `/finance/reports/*.csv`, tombol PDF, galat tampil |
| web-admin | `routes/_authed/admin/audit/index.tsx`, `components/finance/receivables-page.tsx` | Tombol Ekspor |
| web-admin | `lib/download.ts` | Dipakai ulang |
| locale | `packages/locales/src/{en,id}/finance.ts`, `admin.ts` | Label tombol |
| test | `test/finance/reports-reconciliation.test.ts`, `test/unit/report-csv.test.ts`, test audit ekspor **(baru)** | Isi CSV, audit ekspor, hak `export` |
| docs | `docs/architecture/role-permission.md` (generator) | Rute baru |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Laporan keuangan → Unduh CSV laba rugi → berkas terunduh (tidak galat).
  2. Unduh PDF neraca → ada kop perusahaan dan tanggal cetak.
  3. Log Audit → Ekspor CSV → lalu Log Audit memuat baris "ekspor log audit".
- **Bergantung pada:** P7-1, P7-7 (Chromium untuk PDF); endpoint ekspor modul Dafrin (koordinasi).

---

**Prompt AI (salin):**

```text
Kerjakan M12-16 Ekspor daftar utama + PDF laporan berkop.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M12-16 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/audit/controllers/audit.controller.ts, src/app/audit/services/audit-query.service.ts, src/app/finance/controllers/receivables.controller.ts, src/app/finance/controllers/finance-operations.controller.ts, src/providers/pdf/pdf-renderer.ts, src/shared/export/, components/finance/reports-page.tsx, routes/_authed/admin/audit/index.tsx, components/finance/receivables-page.tsx, lib/download.ts, packages/locales/src/{en,id}/finance.ts, admin.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/reports-reconciliation.test.ts, test/unit/report-csv.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M12-16 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-16.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## M09 Keuangan

### M09-1 Keuangan membaca bagan akun (Tinggi, OB1)

Tercakup [P7-4](#p7-4-hak-role-baru-tinggi-k2-k2b-k2d-ro1-ro4-oa8-oa12-kl-6-kl-10-b4) (K2d). UAT tambahan: Bella membuka form Kas/Bank dan pilihan akun lawan terisi.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### M09-2 Pemilih akun berpencarian (Tinggi, OB2)

- **Seharusnya:**
  - Semua isian akun di form Keuangan memakai **pemilih dengan pencarian ke server** (kode/nama), tanpa daftar 200/300 sekaligus (OB2).
  - Saringan jenis akun (mis. `expense`) dan `isPostable` tetap bisa dipakai.
- **Sekarang:** server membatasi `limit` 100 dan sudah menerima `search` (`src/app/finance/contracts/ledger.contract.ts:50, 53`), tetapi layar meminta 200/300 sehingga ditolak: `components/finance/reconciliation-page.tsx:85`, `fixed-assets-page.tsx:180`, `advances-panel.tsx:341` (200), `project-budgets-page.tsx:41` (300).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `components/finance/account-combobox.tsx` **(baru)** | Combobox berpencarian (pola `components/crm/company-combobox.tsx`, `packages/ui/src/components/combobox.tsx`), memanggil `accountsQueryOptions` (`lib/finance-api.ts:123`) dengan `search`, `limit ≤ 100` |
| web-admin | `components/finance/reconciliation-page.tsx`, `fixed-assets-page.tsx`, `advances-panel.tsx`, `project-budgets-page.tsx`, `cash-bank-form-dialog.tsx`, `bills-table.tsx` | Ganti `<Select>` akun dengan combobox |
| locale | `packages/locales/src/{en,id}/finance.ts` | "Cari akun…", "Tidak ada akun" |
| test | test komponen web-admin **(baru, dicek saat desain lokasi `*.test.tsx`)** | Pencarian memanggil `search` |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Rekonsiliasi, Aset tetap, Kasbon, Anggaran proyek terbuka tanpa galat validasi.
  2. Ketik "kas" di pilihan akun → muncul akun kas yang cocok.
  3. Akun ke-150 (di luar 100 pertama) bisa ditemukan lewat pencarian.
- **Bergantung pada:** P7-4 (hak bagan akun untuk Keuangan).

**Prompt AI (salin):**

```text
Kerjakan M09-2 Pemilih akun berpencarian.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-2 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: components/finance/account-combobox.tsx, components/finance/reconciliation-page.tsx, fixed-assets-page.tsx, advances-panel.tsx, project-budgets-page.tsx, cash-bank-form-dialog.tsx, bills-table.tsx, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: *.test.tsx (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-2 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-2.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-3 Layar pembayaran pemasok (Tinggi, OB3)

- **Seharusnya:**
  - Dari halaman Utang, Bella membuat **pembayaran pemasok**: pilih pemasok, tagihan yang dibayar (alokasi), akun kas/bank, potongan PPh (ERP-0140) (OB3).
  - Status pembayaran draf → kirim → setujui → jalankan sesuai backend; tanpa pemeriksa kedua (OB7), diaudit.
  - Tagihan lunas/sebagian terlihat di Utang.
- **Sekarang:** `createPayment` hanya dipakai `components/finance/employee-payment-dialog.tsx:54`; backend sudah menerima `allocations` dan `withholding` (`src/app/payment/contracts/payment.contract.ts:37-40`) dan rute `/payments`, `/payments/:id/allocations|submit|approve|execute` (`src/app/payment/controllers/payment-ledger.controller.ts:42-126`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `components/finance/supplier-payment-dialog.tsx` **(baru)** | Form pemasok, tagihan terbuka, jumlah per tagihan, PPh dipotong, kas/bank |
| web-admin | `components/finance/payables-page.tsx`, `components/finance/payments-table.tsx` | Tombol "Bayar pemasok", daftar pembayaran pemasok |
| web-admin | `lib/finance-api.ts` (`createPayment`, `setPaymentAllocations` `:780-790`) | Tipe input pemasok + withholding |
| backend | `src/app/payment/services/payment.service.ts` | Audit pembayaran (P7-1); validasi alokasi sudah ada (dicek saat desain) |
| locale | `packages/locales/src/{en,id}/finance.ts` | Teks layar |
| test | `test/finance/ap-flows.test.ts` | Bayar dengan PPh dipotong → utang lunas, utang PPh 23 bertambah |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Utang → Bayar pemasok → pilih dua tagihan, isi PPh 23 → simpan → setujui → jalankan.
  2. Tagihan berstatus lunas; aging utang berkurang.
  3. Jurnal: Utang usaha (D), Kas/Bank (K), Utang PPh 23 (K).
- **Bergantung pada:** M09-2 (pemilih akun), P7-1 (audit). Terkait M10-9.

**Prompt AI (salin):**

```text
Kerjakan M09-3 Layar pembayaran pemasok.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-3 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: components/finance/supplier-payment-dialog.tsx, components/finance/payables-page.tsx, components/finance/payments-table.tsx, lib/finance-api.ts, src/app/payment/services/payment.service.ts, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/ap-flows.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-3 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-3.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-4 Siapkan dan buka kembali periode (Tinggi, OB4, OB6, RO1, RO4)

- **Seharusnya:**
  - "Siapkan periode" untuk Pemilik dan Keuangan (`accounting_period:create`) (RO1).
  - "Buka kembali" (`locked → open`) hanya Pemilik, rute memeriksa `reopen` (RO4).
- **Sekarang:** aksi `create` sudah ada di kosakata dan rute (`packages/common/src/authorization/erp-permissions.ts:120`; `src/app/finance/controllers/ledger.controller.ts:191`), layar sudah memeriksa (`components/finance/closing-page.tsx:49-52`), tetapi `finance` tidak punya hak itu; transisi memeriksa `accounting_period:close` + `ownership: { reopen: 'owner' }` (`ledger.controller.ts:210-213`), sementara `accountant` memegang `reopen` (`erp-permissions.ts:792`).
- **File yang diubah:** hak di P7-4; tambahan:

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/finance/controllers/ledger.controller.ts:205-218` | Pisahkan pemeriksaan `reopen` untuk target `open` |
| backend | `src/app/finance/services/period.service.ts:108` (`transition`) | Audit buka kembali dalam tx |
| test | `test/finance/month-end-close.test.ts`, `test/authorization/permission-matrix.test.ts` | Keuangan bisa siapkan; hanya Pemilik buka kembali |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Bella → Tutup periode → Siapkan periode Desember → berhasil.
  2. Bella tidak melihat "Buka kembali" pada periode terkunci; Aqim bisa, dan Log Audit mencatat.
- **Bergantung pada:** P7-4, P7-1.

**Prompt AI (salin):**

```text
Kerjakan M09-4 Siapkan dan buka kembali periode.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-4 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/finance/controllers/ledger.controller.ts:205-218, src/app/finance/services/period.service.ts:108.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/month-end-close.test.ts, test/authorization/permission-matrix.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-4 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-4.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-7 Kasbon dan pertanggungjawaban satu langkah (Tinggi, OB9, OB13, RO5, RO6, KL-10)

- **Seharusnya:**
  - Pertanggungjawaban cukup **satu langkah oleh Aqim**; aturan verifikator ≠ penyetuju dihapus (RO5).
  - Kasbon ikut K1 (Pemilik boleh menyetujui sendiri, diaudit) (OB9); Aqim mencairkan (RO6).
  - Siapa pun yang punya **tugas proyek aktif** boleh mengajukan kasbon (KL-10), dari portal karyawan (layar di PH-PORTAL).
- **Sekarang:** `employee-advance.service.ts` menolak pelaku yang sama di tiga tempat (`src/app/finance/services/employee-advance.service.ts:126, 217, 235`, termasuk `verifiedBy === actor` saat setuju); controller hanya `guards: 'erp'` di `/finance` (`src/app/finance/controllers/employee-advance.controller.ts:23`); `settlements/:id/verify` masih langkah tersendiri (`:67`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/finance/services/employee-advance.service.ts` | Hapus cek verifikator; setuju langsung dari `submitted`; aturan K1 (pakai helper P7-3) + audit |
| backend | `src/app/finance/controllers/employee-advance.controller.ts` | `verify` dihapus/digabung; rute portal dipisah (lihat PH-PORTAL) |
| backend | `src/app/finance/contracts/employee-advance.contract.ts` | Status settlement tanpa `verified` (dicek saat desain) |
| backend | `src/app/finance/errors/advance.errors.ts` | `AdvanceSameActorError` disesuaikan K1 |
| web-admin | `components/finance/advances-panel.tsx` | Satu tombol Setujui |
| locale | `packages/locales/src/{en,id}/finance.ts` | Teks |
| test | `test/finance/employee-advances.test.ts` | Satu langkah, K1 Pemilik, pengaju tanpa tugas proyek ditolak |

- **Skema/migrasi:** mungkin (CHECK status `expense_settlements` bila `verified` dibuang): `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Fahri mengajukan pertanggungjawaban → Aqim sekali Setujui → status disetujui, selisih terhitung.
  2. Kasbon yang dibuat Aqim bisa ia setujui sendiri dan tercatat "disetujui oleh pembuat".
  3. Karyawan tanpa tugas proyek aktif ditolak dengan pesan KL (portal).
- **Bergantung pada:** P7-1, P7-2, P7-3 (helper K1), P7-4 (hak `advance` untuk freelancer).

**Prompt AI (salin):**

```text
Kerjakan M09-7 Kasbon dan pertanggungjawaban satu langkah.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-7 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/finance/services/employee-advance.service.ts, src/app/finance/controllers/employee-advance.controller.ts, src/app/finance/contracts/employee-advance.contract.ts, src/app/finance/errors/advance.errors.ts, components/finance/advances-panel.tsx, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/employee-advances.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-7 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-7.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-8 Write-off langsung ke beban (Tinggi, OB10)

- **Seharusnya:** write-off piutang mendebit **Beban Kerugian Piutang (6-2600)**, bukan cadangan 1-1390 (OB10); laba rugi memuat kerugian.
- **Sekarang:** baris jurnal `bad_debt_allowance` (`src/app/finance/services/receivable-adjustment.service.ts:220`); peran itu dipetakan ke 1-1390 (`src/app/finance/constants/posting-roles.ts:143`); akun 6-2600 sudah ada di seeder (`database/seeders/seed/chart-of-accounts.seeder.ts:168`) tanpa peran posting.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/finance/constants/posting-roles.ts` | Peran baru `bad_debt_expense` → `6-2600` |
| backend | `src/app/finance/services/receivable-adjustment.service.ts:220` | Pakai `bad_debt_expense` |
| backend | `database/seeders/seed/chart-of-accounts.seeder.ts` | Aturan posting `'*'` untuk peran baru |
| web-admin | `components/finance/posting-rules-page.tsx`, `lib/finance-api.ts` (daftar peran) | Peran baru tampil |
| locale | `packages/locales/src/{en,id}/finance.ts` | Label peran |
| test | `test/finance/ar-postings.test.ts` | Write-off → 6-2600 debit |

- **Skema/migrasi:** tidak (peran posting = data; cek CHECK di `finance.posting_rules` saat desain).
- **Test:** di atas; seed dua kali.
- **UAT:**
  1. Ajukan dan setujui write-off faktur Rp 1.000.000 → jurnal Beban Kerugian Piutang (D) / Piutang (K).
  2. Laba rugi periode itu memuat beban Rp 1.000.000.
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan M09-8 Write-off langsung ke beban.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-8 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/finance/constants/posting-roles.ts, src/app/finance/services/receivable-adjustment.service.ts:220, database/seeders/seed/chart-of-accounts.seeder.ts, components/finance/posting-rules-page.tsx, lib/finance-api.ts, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/ar-postings.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-8 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-8.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-15 Pindah dana antar kas/bank (Tinggi, KF-K1)

- **Seharusnya:** satu aksi "Pindah dana" (setor tunai, tarik tunai, isi kas kecil) membuat **dua** mutasi (keluar di akun asal, masuk di akun tujuan) dan satu jurnal, dalam satu transaksi; tampil di rekonsiliasi kedua akun.
- **Sekarang:** `postMovement` hanya satu sisi ke akun buku besar (`src/app/finance/services/cash-bank.service.ts:223-310`); `finance.cash_bank_transactions` tanpa kolom pasangan (`drizzle/schemas/finance.schema.ts:746-792`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs/database/docs.dbml` lalu `drizzle/schemas/finance.schema.ts` | Kolom `transfer_id` (uuid, nullable) atau `source_type = 'transfer'` (dicek saat desain) |
| backend | `src/app/finance/contracts/cash-bank.repository.interface.ts`, `src/app/finance/repositories/cash-bank.repository.ts` | Simpan pasangan dalam tx |
| backend | `src/app/finance/services/cash-bank.service.ts` | `transfer(input)` |
| backend | `src/app/finance/controllers/finance-operations.controller.ts` (dicek saat desain: controller kas/bank) | `POST /finance/cash-bank/transfers` (`cash_bank:create`) |
| web-admin | `components/finance/cash-transfer-dialog.tsx` **(baru)**, `components/finance/cash-bank-page.tsx` | Tombol + form |
| locale | `packages/locales/src/{en,id}/finance.ts` | Teks |
| test | `test/finance/finance-flows.test.ts` | Saldo kedua akun, satu jurnal |

- **Skema/migrasi:** mungkin; `docs.dbml` dulu, migrasi append-only.
- **Test:** di atas.
- **UAT:**
  1. Kas & Bank → Pindah dana Rp 5.000.000 dari Kas ke BCA → saldo Kas turun, BCA naik.
  2. Mutasi tampil di kedua akun dengan keterangan yang sama.
- **Bergantung pada:** M09-2.

**Prompt AI (salin):**

```text
Kerjakan M09-15 Pindah dana antar kas/bank.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-15 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, drizzle/schemas/finance.schema.ts, src/app/finance/contracts/cash-bank.repository.interface.ts, src/app/finance/repositories/cash-bank.repository.ts, src/app/finance/services/cash-bank.service.ts, src/app/finance/controllers/finance-operations.controller.ts, components/finance/cash-transfer-dialog.tsx, components/finance/cash-bank-page.tsx, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/finance-flows.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-15 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-15.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-16 Batalkan transaksi kas/bank (Tinggi, KF-K2)

- **Seharusnya:** transaksi kas/bank yang salah bisa **dibatalkan dengan alasan**; status `reversed`, jurnal pembalik otomatis, saldo kembali; diaudit.
- **Sekarang:** status `reversed` ada di CHECK (`drizzle/schemas/finance.schema.ts:787-788`) tetapi tidak ada service maupun layar (`cash-bank.service.ts` hanya `postMovement`, `:223`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs.dbml` + `finance.schema.ts` | Kolom `reversal_reason`, `reversed_by`, `reversed_at` bila belum ada (dicek; kolom tidak terlihat di `:746-792`) |
| backend | `src/app/finance/services/cash-bank.service.ts`, `src/app/finance/repositories/cash-bank.repository.ts` | `reverse(id, reason)` + jurnal pembalik lewat `posting.service.ts` |
| backend | controller kas/bank | `POST /finance/cash-bank/transactions/:id/reverse` (`cash_bank:update` atau aksi baru) |
| web-admin | `components/finance/cash-bank-page.tsx`, `components/finance/reason-dialog.tsx` | Tombol Batalkan + alasan |
| test | `test/finance/finance-flows.test.ts` | Pembalik, saldo, tolak dua kali |

- **Skema/migrasi:** ya bila kolom alasan ditambah; `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Batalkan mutasi salah → wajib isi alasan → status Dibatalkan, saldo kembali.
  2. Transaksi dari pembayaran/kuitansi tidak bisa dibatalkan di sini (diarahkan ke sumbernya; dicek saat desain).
- **Bergantung pada:** P7-1.

**Prompt AI (salin):**

```text
Kerjakan M09-16 Batalkan transaksi kas/bank.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-16 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs.dbml, finance.schema.ts, src/app/finance/services/cash-bank.service.ts, src/app/finance/repositories/cash-bank.repository.ts, components/finance/cash-bank-page.tsx, components/finance/reason-dialog.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/finance-flows.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-16 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-16.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-17 + M10-13 PPh 23 dipotong pelanggan (Tinggi, KF-K3, KF-T3)

- **Seharusnya:**
  - Kuitansi faktur menerima **potongan PPh 23** oleh pelanggan; faktur tertutup penuh (B-33, Dafrin, di `sale`).
  - Posting: Kas (D) + **PPh 23 Dibayar Dimuka 1-1820** (D) / Piutang (K).
  - Bupot dari pelanggan tercatat di `tax` sebagai **kredit pajak** (M10-13).
- **Sekarang:** `sale.receipts` tanpa kolom potongan (`drizzle/schemas/sale.schema.ts:820-874`); akun 1-1820 ada (`chart-of-accounts.seeder.ts:99`) tanpa peran posting (`posting-roles.ts:105-147`); `tax.withholding_tax_records` tanpa arah (dipotong oleh kita vs dari kita) (`drizzle/schemas/tax.schema.ts:207-254`).
- **File yang diubah (bagian Oki):**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs.dbml` + `drizzle/schemas/tax.schema.ts` | Kolom arah (mis. `direction`: `withheld_by_us`/`withheld_from_us`) + CHECK (dicek saat desain) |
| backend | `src/app/finance/constants/posting-roles.ts` | Peran `wht_prepaid` → `1-1820` |
| backend | `src/app/sale/services/receipt-ledger.service.ts` (posting kuitansi, milik Dafrin; Oki meninjau) + `src/app/finance/services/posting.service.ts` | Baris PPh 23 dibayar dimuka |
| backend | `src/app/tax/services/exported-tax.service.ts`, `src/app/tax/services/tax.service.ts` | Kontrak `recordCustomerWithholding` dipanggil `sale` |
| web-admin | `components/tax/withholding-list.tsx` | Saringan arah, kolom pelanggan |
| locale | `packages/locales/src/{en,id}/tax.ts`, `finance.ts` | Teks |
| test | `test/finance/ar-postings.test.ts`, `test/tax/tax.service.test.ts` | Jurnal + bupot tercatat |
| docs | `docs/database/logical-references.md` (generator) | Bila ada referensi baru |

- **Skema/migrasi:** ya (`tax`, dan `sale` oleh Dafrin); `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Faktur Rp 10.000.000 jasa → kuitansi Rp 9.800.000 + PPh 23 Rp 200.000 → faktur lunas.
  2. Jurnal memuat PPh 23 Dibayar Dimuka Rp 200.000.
  3. Pemotongan PPh → saringan "dari pelanggan" menampilkan bupotnya.
- **Bergantung pada:** B-33 (Dafrin, kuitansi). Terkait M10-11.

**Prompt AI (salin):**

```text
Kerjakan M09-17 + M10-13 PPh 23 dipotong pelanggan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-17 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs.dbml, drizzle/schemas/tax.schema.ts, src/app/finance/constants/posting-roles.ts, src/app/sale/services/receipt-ledger.service.ts, src/app/finance/services/posting.service.ts, src/app/tax/services/exported-tax.service.ts, src/app/tax/services/tax.service.ts, components/tax/withholding-list.tsx, packages/locales/src/{en,id}/tax.ts, finance.ts, docs/database/logical-references.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/ar-postings.test.ts, test/tax/tax.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-17 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-17.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-18 Pembayaran upah freelance (Tinggi, KL-4)

- **Seharusnya:**
  - Bella membayar upah freelance dari **rekap B-45** (harian: tarif × hari kerja sah; borongan: nilai per pekerjaan) (KL-4).
  - Dicatat sebagai **biaya proyek**, bukan slip gaji; status bayar terlihat di rekap dan di portal "Rekap upah" (PK-10).
- **Sekarang:** `payment.payment_allocations.payable_type` hanya `sale_invoice`, `supplier_bill`, `employee_advance`, `expense_claim`, `expense_settlement`, `employee_salary_record` (`drizzle/schemas/payment.schema.ts:95-102`); rekap freelance belum ada (B-45).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs.dbml` + `drizzle/schemas/payment.schema.ts` | `PAYABLE_TYPES` + `freelance_wage` (CHECK `payment_allocations_payable_type_check`) |
| backend | `src/app/payment/services/payment.service.ts` | Validasi payable lewat kontrak HR (B-45) |
| backend | `src/app/finance/constants/posting-roles.ts`, `src/app/finance/services/posting.service.ts` | Biaya proyek tenaga kerja (akun dicek dengan Bella) |
| web-admin | `components/finance/freelance-wage-payment-dialog.tsx` **(baru)**; layar rekap milik B-45 | Tombol Bayar dari rekap |
| locale | `packages/locales/src/{en,id}/finance.ts` | Teks |
| test | `test/unit/payment-gateway.test.ts` atau `test/finance/expense-flows.test.ts` | Bayar rekap → biaya proyek bertambah |

- **Skema/migrasi:** ya (`payment` CHECK); `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Rekap upah Ade (harian, 5 hari sah) → Bella Bayar → status Dibayar.
  2. Detail proyek → Biaya bertambah sebesar upah.
  3. Ade melihat status Dibayar di portal Rekap upah.
- **Bergantung pada:** B-45 (Dafrin: data tarif + rekap), M09-3 (pola pembayaran).

**Prompt AI (salin):**

```text
Kerjakan M09-18 Pembayaran upah freelance.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-18 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs.dbml, drizzle/schemas/payment.schema.ts, src/app/payment/services/payment.service.ts, src/app/finance/constants/posting-roles.ts, src/app/finance/services/posting.service.ts, components/finance/freelance-wage-payment-dialog.tsx, packages/locales/src/{en,id}/finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/payment-gateway.test.ts, test/finance/expense-flows.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-18 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-18.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M09-19 Biaya perjalanan: kasbon, nota, klaim, batas (Tinggi, BP-1–BP-6)

- **Seharusnya:**
  - Portal: kasbon perjalanan, pertanggungjawaban **per baris dengan foto nota**, klaim penggantian pakai uang sendiri (BP-1, BP-3).
  - Pengaturan → Perjalanan (Pemilik): uang makan dalam/luar kota, batas hotel per malam, batas per kategori (BP-2, BP-4).
  - Melebihi batas boleh diajukan dengan **alasan** + peringatan untuk Aqim (BP-4); disetujui Aqim, dibayar Bella (BP-6).
  - Kategori makan dan tiket; semua masuk biaya proyek (BP-5; kategori proyek oleh Dafrin B-48).
- **Sekarang:** `finance.expense_settlement_items` sudah punya `category_code` dan `receipt_document_id` (`drizzle/schemas/finance.schema.ts:1278-1318`); kategori biaya proyek dibatasi `material, transport, accommodation, subcontract, other` (`drizzle/schemas/project.schema.ts:381`); klaim karyawan dari portal belum ada (KF-K10).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs.dbml` + `drizzle/schemas/finance.schema.ts` | Pengaturan perjalanan (kolom di `finance.finance_settings` `:1473` atau tabel baru; dicek saat desain); `over_limit_reason` di baris settlement |
| backend | `src/app/finance/services/employee-advance.service.ts`, `src/app/finance/services/expense-claim.service.ts` | Batas + alasan, klaim dari portal |
| backend | `src/app/finance/controllers/employee-portal-finance.controller.ts` **(baru)** | `guards: 'employee-portal'`, prefix `/finance/me` (ajukan kasbon, settlement, klaim, unggah nota lewat `document`) |
| backend | `src/app/finance/controllers/finance-setup.controller.ts` | Pengaturan perjalanan |
| web-admin | `routes/_authed/settings/` halaman Perjalanan **(baru)** | Form pengaturan |
| portal | `routes/_authed.advances.tsx` **(baru)**, `routes/_authed.claims.tsx` **(baru)**, `lib/finance-portal-api.ts` **(baru)** | Layar portal |
| locale | `packages/locales/src/{en,id}/employee.ts`, `finance.ts`, `settings.ts` | Teks |
| test | `test/finance/employee-advances.test.ts`, `test/finance/expense-flows.test.ts` | Batas, alasan wajib, biaya proyek |

- **Skema/migrasi:** ya; `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Aqim mengisi batas hotel Rp 400.000/malam.
  2. Fahri di portal menambah baris hotel Rp 500.000 + foto nota → muncul peringatan, wajib alasan.
  3. Aqim menyetujui; detail proyek → Biaya memuat hotel per orang.
- **Bergantung pada:** M09-7, PH-PORTAL (kasbon portal), B-48 (Dafrin: kategori + uang makan dari check-in).

---

**Prompt AI (salin):**

```text
Kerjakan M09-19 Biaya perjalanan: kasbon, nota, klaim, batas.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M09-19 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs.dbml, drizzle/schemas/finance.schema.ts, src/app/finance/services/employee-advance.service.ts, src/app/finance/services/expense-claim.service.ts, src/app/finance/controllers/employee-portal-finance.controller.ts, src/app/finance/controllers/finance-setup.controller.ts, routes/_authed/settings/, routes/_authed.advances.tsx, routes/_authed.claims.tsx, lib/finance-portal-api.ts, packages/locales/src/{en,id}/employee.ts, finance.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/employee-advances.test.ts, test/finance/expense-flows.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M09-19 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M09-19.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## M10 Pajak

### M10-1 Jenis pajak memakai kosakata server (Tinggi, OC1)

- **Seharusnya:** form jenis pajak memakai pilihan `ppn`, `pph`, `ppn_input`, `ppn_output`, `other` (OC1 a); ada aksi **Ubah** jenis pajak.
- **Sekarang:** form mengirim `taxType: 'vat'` (`components/tax/tax-type-list.tsx:69`); server hanya menerima `TAX_TYPE_KINDS` (`drizzle/schemas/tax.schema.ts:34-40`); `updateTaxType` sudah ada di service (`src/app/tax/services/tax.service.ts:154`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `components/tax/tax-type-list.tsx` | Select jenis dari kosakata server; dialog Ubah |
| web-admin | `lib/tax-api.ts` | `updateTaxType` (dicek saat desain apakah sudah ada) |
| locale | `packages/locales/src/{en,id}/tax.ts` | Label jenis |
| test | `test/authorization/tax-authorization.test.ts`, `test/tax/tax.service.test.ts` | Buat `pph` berhasil |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Pajak → Jenis pajak → Tambah "PPh 23" jenis PPh 2% → tersimpan.
  2. Ubah tarifnya → tersimpan.
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan M10-1 Jenis pajak memakai kosakata server.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M10-1 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: components/tax/tax-type-list.tsx, lib/tax-api.ts, packages/locales/src/{en,id}/tax.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/authorization/tax-authorization.test.ts, test/tax/tax.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M10-1 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M10-1.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M10-2 Hitung ulang catatan pajak draf (Tinggi, OC2)

- **Seharusnya:** saat DPP catatan draf diubah, **service** menghitung ulang pajak = DPP × tarif (half-up rupiah) (OC2 a).
- **Sekarang:** `updateDraftTaxRecord` meneruskan patch apa adanya ke repository (`src/app/tax/services/tax.service.ts:293-303`); dialog hanya mengirim dasar (`components/tax/tax-record-edit-dialog.tsx:46`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/tax/services/tax.service.ts` | Ambil tarif (`resolveRate` `:199`), hitung via `src/app/tax/utils/tax-math.ts` |
| web-admin | `components/tax/tax-record-edit-dialog.tsx` | Tampilkan pajak hasil hitung (pratinjau `previewTax` `:215`) |
| test | `test/tax/tax.service.test.ts`, `test/tax/tax-math.test.ts` | DPP berubah → pajak berubah |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:** ubah DPP draf dari 10.000.000 ke 12.000.000 (PPN 11%) → pajak menjadi 1.320.000 setelah simpan.
- **Bergantung pada:** M10-1.

**Prompt AI (salin):**

```text
Kerjakan M10-2 Hitung ulang catatan pajak draf.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M10-2 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/tax/services/tax.service.ts, components/tax/tax-record-edit-dialog.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/tax/tax.service.test.ts, test/tax/tax-math.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M10-2 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M10-2.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M10-3 Masa Bupot otomatis (Tinggi, OC3)

- **Seharusnya:** masa (tahun/bulan) pemotongan diisi otomatis dari tanggal transaksi (Asia/Jakarta), bisa dikoreksi manual (OC3 a + b).
- **Sekarang:** form tidak mengirim periode (`components/tax/withholding-list.tsx:90-96`); kolom `period_year/period_month` ada (`drizzle/schemas/tax.schema.ts:207-230`) dan ekspor XML menyaring per periode (`src/app/tax/repositories/tax.repository.ts:475-488`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/tax/services/tax.service.ts` (`createWithholding` `:424`, `updateWithholding` `:449`) | Isi periode dari `transactionDate` bila kosong |
| web-admin | `components/tax/withholding-list.tsx`, `withholding-edit-dialog.tsx` | Masa terisi otomatis, bisa diubah |
| test | `test/tax/tax.service.test.ts` | 31 Jan 23.00 WIB → masa Januari |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:** catat pemotongan bertanggal 15/12 tanpa mengisi masa → masa Desember; muncul di ekspor Coretax Desember.
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan M10-3 Masa Bupot otomatis.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M10-3 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/tax/services/tax.service.ts, components/tax/withholding-list.tsx, withholding-edit-dialog.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/tax/tax.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M10-3 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M10-3.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M10-9 Gerbang sebelum lapor (Tinggi sebelum lapor, OC8)

- **Seharusnya:** gerbang D12/D14/D18 ditutup bersama Bella + Pemilik; **uji impor Coretax** sebelum dipakai lapor; potongan PPh saat bayar pemasok lewat M09-3. Tabel TER **tidak** diperlukan sekarang (OC8).
- **Sekarang:** ERP-0016/0138/0140 belum ditutup (`docs/plan/backlog.md`); ekspor ada di `src/app/tax/services/coretax-export.service.ts`, `src/app/tax/utils/coretax-xml.ts`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/tax/utils/coretax-xml.ts`, `tax-csv.ts` | Perbaikan kolom sesuai hasil uji impor (dicek saat uji) |
| test | `test/tax/tax-xlsx.test.ts` + test XML **(baru bila perlu)** | Contoh berkas lolos skema |
| docs | `docs/plan/backlog.md`, `docs/adjustment/catatan-progres.md` | Hasil uji impor |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:** Bella mengunggah XML Bupot satu masa ke Coretax (lingkungan uji DJP) tanpa galat.
- **Bergantung pada:** M09-3, M10-3, keputusan Bella.

**Prompt AI (salin):**

```text
Kerjakan M10-9 Gerbang sebelum lapor.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M10-9 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/tax/utils/coretax-xml.ts, tax-csv.ts, docs/plan/backlog.md, docs/adjustment/catatan-progres.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/tax/tax-xlsx.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M10-9 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M10-9.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M10-11 Terutang / dibayar / sisa per masa (Tinggi, KF-T1)

- **Seharusnya:** per masa dan jenis pajak tampil **terutang, dibayar, sisa**; setor pajak di Keuangan tersambung ke catatan pajak dan pemotongan (status bayar otomatis).
- **Sekarang:** setor pajak hanya di Keuangan (`src/app/finance/services/tax-ledger.service.ts:137` `payLiability`; layar `components/finance/tax-payment-dialog.tsx`); `filing_status` catatan pajak hanya `draft/verified/filed/corrected` (`drizzle/schemas/tax.schema.ts:168-169`); status `paid` pemotongan diubah manual (`tax.service.ts:44-49`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| skema | `docs.dbml` + `drizzle/schemas/tax.schema.ts` | Penanda bayar per catatan/masa (mis. `paid_amount`, `payment_reference`) atau tabel setoran (dicek saat desain) |
| backend | `src/app/tax/services/exported-tax.service.ts` | Kontrak `markPaid(period, taxType, amount, ref)` |
| backend | `src/app/finance/services/tax-ledger.service.ts` | Panggil kontrak tax setelah posting setoran |
| backend | `src/app/tax/services/tax.service.ts` (`recap` `:383`) | Kolom terutang/dibayar/sisa |
| web-admin | `components/tax/tax-recap.tsx` | Tabel per masa |
| locale | `packages/locales/src/{en,id}/tax.ts` | Teks |
| test | `test/finance/tax-postings.test.ts`, `test/tax/tax.service.test.ts` | Setor → sisa nol |

- **Skema/migrasi:** mungkin; `docs.dbml` dulu.
- **Test:** di atas.
- **UAT:**
  1. Rekap pajak November: PPh 23 terutang Rp 600.000, dibayar 0, sisa 600.000.
  2. Keuangan → Setor pajak Rp 600.000 → rekap: dibayar 600.000, sisa 0; pemotongan terkait berstatus Dibayar.
- **Bergantung pada:** M09-17 (kredit PPh 23), M10-3.

**Prompt AI (salin):**

```text
Kerjakan M10-11 Terutang / dibayar / sisa per masa.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M10-11 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs.dbml, drizzle/schemas/tax.schema.ts, src/app/tax/services/exported-tax.service.ts, src/app/finance/services/tax-ledger.service.ts, src/app/tax/services/tax.service.ts, components/tax/tax-recap.tsx, packages/locales/src/{en,id}/tax.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/tax-postings.test.ts, test/tax/tax.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M10-11 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M10-11.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M10-12 Pengaturan rezim pajak (Sedang, Tinggi bila UMKM, KF-T2)

- **Seharusnya:** pengaturan rezim (normal / PPh Final 0,5% UMKM) dan status PKP; bila UMKM, rekap PPh Final 0,5% omzet per bulan. **Menunggu pilihan Bella.**
- **Sekarang:** tidak ada pengaturan rezim (dicek saat desain di `src/app/tax/`).
- **File yang diubah:** pengaturan di `drizzle/schemas/tax.schema.ts` (tabel/kolom baru, `docs.dbml` dulu), `src/app/tax/services/tax.service.ts`, `components/tax/tax-recap.tsx`, `packages/locales/src/{en,id}/tax.ts`, `test/tax/tax.service.test.ts`.
- **Skema/migrasi:** ya bila dikerjakan.
- **UAT:** rezim UMKM dipilih → rekap bulan menampilkan omzet × 0,5%.
- **Bergantung pada:** keputusan Bella.

---

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

## M06 Aset & Peralatan

### M06-1 Daftar unit yang bisa dipinjam (Tinggi, OD1)

- **Seharusnya:** endpoint daftar unit **siap pinjam** yang dijaga `asset_borrowing:create` (bukan `asset:read`), hanya nama/kode/seri/lokasi tanpa nilai aset (OD1 b, X7); dipakai form peminjaman Teknisi, PM, Gudang, Pekerja Lepas.
- **Sekarang:** form memuat unit dari `assetsQueryOptions({ status: 'ready' })` yang butuh `asset:read` (`components/assets/borrowing-form.tsx:83-85`); Teknisi hanya punya `asset_borrowing: read, create` (`packages/common/src/authorization/erp-permissions.ts:677-692`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/inventory/controllers/borrowing.controller.ts` | `GET /inventory/borrowings/available-units?search=` (`asset_borrowing:create`) |
| backend | `src/app/inventory/services/borrowing-request.service.ts` | `listAvailableUnits` (status `ready`, belum ada di pengajuan disetujui) |
| backend | `src/app/inventory/repositories/` (repository item/serial, dicek saat desain) | Query ringkas |
| web-admin | `components/assets/borrowing-form.tsx`, `lib/borrowing-api.ts` | Pakai endpoint baru + pencarian |
| test | `test/unit/borrowing.service.test.ts`, `test/authorization/inventory-authorization.test.ts` | Teknisi boleh, tanpa nilai aset |
| docs | `docs/architecture/role-permission.md` (generator) | Rute baru |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Login Fahri (Teknisi) → Peminjaman → Baru → daftar unit siap pinjam muncul (tanpa harga).
  2. Unit yang sedang dipinjam tidak muncul.
- **Bergantung pada:** P7-4 (hak freelancer untuk peminjaman).

**Prompt AI (salin):**

```text
Kerjakan M06-1 Daftar unit yang bisa dipinjam.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M06-1 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/inventory/controllers/borrowing.controller.ts, src/app/inventory/services/borrowing-request.service.ts, src/app/inventory/repositories/, components/assets/borrowing-form.tsx, lib/borrowing-api.ts, docs/architecture/role-permission.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/borrowing.service.test.ts, test/authorization/inventory-authorization.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M06-1 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M06-1.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M06-2 Persetujuan sendiri peminjaman ikut K1 (Tinggi, OD2)

- **Seharusnya:** pembuat pengajuan tidak bisa menyetujui sendiri **kecuali Pemilik**, dan itu dicatat audit `meta.self_approved` (OD2 a, K1); pesan pembatalan diperbaiki.
- **Sekarang:** `canApprove` diisi dari hak `approve` (`src/app/inventory/controllers/borrowing.controller.ts:38`) dan rute approve mewajibkan hak itu, sehingga pengecualian `!actor.canApprove && …` selalu lolos (`src/app/inventory/services/borrowing-request.service.ts:256-266`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/inventory/services/borrowing-request.service.ts` | Pakai helper K1 (P7-3): `requestedBy === actor` → hanya Pemilik + audit dalam tx |
| backend | `src/app/inventory/controllers/borrowing.controller.ts` | Kirim `isOwner` alih-alih `canApprove` sebagai pengecualian |
| backend | `src/app/inventory/errors/borrowing.errors.ts` | Pesan pembatalan |
| test | `test/unit/borrowing.service.test.ts` | PM ditolak menyetujui miliknya; Pemilik boleh + audit |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Agus (PM) membuat pengajuan lalu menekan Setujui → ditolak dengan pesan K1.
  2. Aqim membuat dan menyetujui pengajuannya → berhasil; Log Audit "disetujui oleh pembuat".
- **Bergantung pada:** P7-1, P7-2, P7-3 (helper K1).

**Prompt AI (salin):**

```text
Kerjakan M06-2 Persetujuan sendiri peminjaman ikut K1.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M06-2 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/inventory/services/borrowing-request.service.ts, src/app/inventory/controllers/borrowing.controller.ts, src/app/inventory/errors/borrowing.errors.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/borrowing.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M06-2 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M06-2.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M06-3 Sen di penyimpanan, rupiah di layar (Tinggi, OD3)

- **Seharusnya:** semua nilai aset disimpan dalam sen (aturan uang di `AGENTS.md`) dan tampil sebagai rupiah: form, detail, disposal, penyusutan, seeder (OD3 a).
- **Sekarang:** form aset sudah mengonversi (`components/assets/asset-form.tsx:4, 71`), tetapi `formatMoney` tidak membagi 100 (`lib/asset-api.ts:605-611`, dipakai `asset-detail.tsx:133, 179, 188`, `asset-disposal-list.tsx:132`, `asset-depreciation-list.tsx:73`); hasil penjualan disposal dikirim tanpa konversi (`asset-disposal-list.tsx:253`); seeder `acquisitionCost: 2_500_000` = Rp 25.000 (`database/seeders/seed/inventory.seeder.ts:48`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `lib/asset-api.ts` | `formatMoney` memakai `minorToRupiah` (`lib/format.ts`) |
| web-admin | `components/assets/asset-disposal-list.tsx`, `asset-detail.tsx` (form penyusutan), `asset-service-record-list.tsx` | Input pakai `money-input.tsx` + `rupiahToMinor` |
| backend | `database/seeders/seed/inventory.seeder.ts` | Nilai × 100 |
| test | `apps/backend/test/unit/inventory-seeder.data.test.ts`; test `lib/asset-api` web-admin **(baru)** | Seeder sen; format |

- **Skema/migrasi:** tidak (data dev diperbaiki lewat seed ulang).
- **Test:** di atas; seed dua kali.
- **UAT:**
  1. Aset baru harga Rp 2.500.000 → daftar dan detail menampilkan Rp 2.500.000.
  2. Penghapusan dengan hasil jual Rp 500.000 → tampil Rp 500.000; jurnal di Keuangan sama.
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan M06-3 Sen di penyimpanan, rupiah di layar.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M06-3 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: lib/asset-api.ts, components/assets/asset-disposal-list.tsx, asset-detail.tsx, asset-service-record-list.tsx, database/seeders/seed/inventory.seeder.ts, lib/asset-api.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/inventory-seeder.data.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M06-3 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M06-3.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M06-6 Tolak hapus/nonaktif aset yang dipinjam (Tinggi, OD6)

- **Seharusnya:** pengajuan penghapusan dan nonaktif ditolak selama status `borrowed` (OD6 a), dengan pesan jelas.
- **Sekarang:** disposal hanya menolak `disposed` (`src/app/inventory/services/disposal.service.ts:62`); transisi `borrowed → inactive` diizinkan (`src/app/inventory/services/item.service.ts:44`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/inventory/services/disposal.service.ts`, `src/app/inventory/services/item.service.ts` | Tolak bila `borrowed`; hapus `inactive` dari daftar transisi `borrowed` |
| backend | `src/app/inventory/errors/item.errors.ts` | Galat "aset sedang dipinjam" (kunci `api`) |
| locale | `packages/locales/src/{en,id}/api.ts` | Pesan |
| test | `test/unit/serial-status-matrix.test.ts`, `test/unit/item-operations.test.ts` | Penolakan |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:** aset berstatus Dipinjam → Nonaktifkan atau Ajukan penghapusan → pesan "Aset sedang dipinjam".
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan M06-6 Tolak hapus/nonaktif aset yang dipinjam.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M06-6 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/inventory/services/disposal.service.ts, src/app/inventory/services/item.service.ts, src/app/inventory/errors/item.errors.ts, packages/locales/src/{en,id}/api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/serial-status-matrix.test.ts, test/unit/item-operations.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M06-6 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M06-6.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M06-14 Satu jalur penyusutan (Tinggi, KF-A1)

- **Seharusnya:** penyusutan hanya lewat "Jalankan penyusutan" di Keuangan yang memposting jurnal; entri manual di Aset → Penyusutan **dihapus** atau ikut memposting jurnal (keputusan desain), supaya tidak ada aset yang terlewat.
- **Sekarang:** `POST /finance/depreciations` mencatat entri tanpa jurnal (`src/app/finance/controllers/depreciation.controller.ts:32-37`, dipanggil `recordDepreciation` di `lib/asset-api.ts:518-526`); `runMonth` melewati aset yang sudah punya entri bulan itu (`src/app/finance/services/fixed-asset.service.ts:154-205`, `:162`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/finance/controllers/depreciation.controller.ts`, `src/app/finance/services/depreciation.service.ts` | Hapus POST manual atau arahkan ke posting jurnal per aset |
| backend | `src/app/finance/services/fixed-asset.service.ts` | Satu jalur posting |
| web-admin | `components/assets/asset-detail.tsx`, `components/assets/asset-depreciation-list.tsx`, `lib/asset-api.ts` | Hapus form manual; tautan ke Keuangan → Aset tetap |
| locale | `packages/locales/src/{en,id}/assets.ts` | Hapus kunci mati |
| test | `test/finance/fixed-assets.test.ts`, `test/unit/finance-depreciation-gateway.test.ts` | Tidak ada entri tanpa jurnal |
| docs | `docs/architecture/role-permission.md` (generator) | Rute dihapus |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Detail aset tidak lagi punya form penyusutan manual.
  2. Keuangan → Jalankan penyusutan November → semua aset aktif tersusutkan dan jurnal terbentuk.
- **Bergantung pada:** M06-3.

**Prompt AI (salin):**

```text
Kerjakan M06-14 Satu jalur penyusutan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M06-14 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/finance/controllers/depreciation.controller.ts, src/app/finance/services/depreciation.service.ts, src/app/finance/services/fixed-asset.service.ts, components/assets/asset-detail.tsx, components/assets/asset-depreciation-list.tsx, lib/asset-api.ts, packages/locales/src/{en,id}/assets.ts, docs/architecture/role-permission.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/finance/fixed-assets.test.ts, test/unit/finance-depreciation-gateway.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M06-14 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M06-14.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-PINJAM Halaman Peminjaman Aset (Tinggi, OD4, C13, OD7, FU13)

- **Seharusnya:**
  - Nama, bukan ID, untuk peminjam, nomor seri, gudang, penanggung jawab (OD4).
  - Unit hanya bisa diserahkan setelah disetujui; serah tidak lagi menyetujui otomatis (C13).
  - Pengembalian dengan kondisi Baik/Rusak/Tidak lengkap + catatan; semua unit hilang menutup peminjaman; konfirmasi Tandai hilang (OD7).
  - Status Terlambat terlihat (FU13).
- **Sekarang:** `issue` menyetujui otomatis bila status `requested` (`src/app/inventory/services/borrowing.service.ts:160-185`); kondisi kembali selalu `'good'` (`components/assets/borrowing-detail.tsx:133`); ID mentah di `borrowing-list.tsx:285`, `borrowing-detail.tsx:458, 494, 512` (dari OD4); transisi tanpa jalur "hilang → tutup" (`borrowing.service.ts:55-60`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/inventory/services/borrowing.service.ts` | Tolak serah bila `requested`; tutup bila semua unit hilang; kondisi kembali dari input |
| backend | `src/app/inventory/services/borrowing-request.service.ts` (`getById` `:128`) | Lengkapi nama lewat kontrak `user`/`human_resource`/`warehouse` |
| web-admin | `components/assets/borrowing-detail.tsx`, `borrowing-list.tsx`, `lib/borrowing-api.ts` | Pilihan kondisi + catatan, konfirmasi, nama, lencana Terlambat |
| locale | `packages/locales/src/{en,id}/assets.ts` | Teks |
| test | `test/unit/borrowing.service.test.ts` | C13, hilang menutup, kondisi |

- **Skema/migrasi:** tidak (kolom kondisi item dicek saat desain).
- **UAT:**
  1. Pengajuan Diajukan → tombol Serahkan tidak ada/ditolak sampai disetujui.
  2. Kembalikan dengan kondisi Rusak + catatan → tampil di riwayat unit.
  3. Daftar peminjaman menampilkan nama peminjam dan lencana Terlambat.
- **Bergantung pada:** M06-1, M06-2.

---

**Prompt AI (salin):**

```text
Kerjakan PH-PINJAM Halaman Peminjaman Aset.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PH-PINJAM (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/inventory/services/borrowing.service.ts, src/app/inventory/services/borrowing-request.service.ts, components/assets/borrowing-detail.tsx, borrowing-list.tsx, lib/borrowing-api.ts, packages/locales/src/{en,id}/assets.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/borrowing.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-PINJAM terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-PINJAM.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## M11 Bonus & Investor

### M11-4 ADR dan schema investor (Tinggi, IV-1)

- **Seharusnya:**
  - ADR baru: letak tabel investor (schema `investor` baru atau di `finance`), mengganti status ditunda K10/OE1 (IV-1).
  - Tabel minimal (dicek saat desain): investor, perjanjian (bentuk modal/pinjaman/dana proyek), setoran + bukti, jadwal angsuran, pengaturan porsi + cadangan, periode bagi hasil + baris per investor, laporan yang dipublikasikan, tautan akun portal.
  - Uang integer sen; tanggal bisnis `date` Asia/Jakarta; soft delete; referensi ke `project`/`auth` sebagai id nullable tanpa FK.
- **Sekarang:** schema `investor` dihapus (riwayat ADR-0024/ADR-0030, tidak perlu dibuka); hanya halaman "Segera hadir" `routes/_authed/finance/investors/{index,registry/index,profit-sharing/index}.tsx`; izin `investor`, `investor_report`, `investor_portal` masih ada (`packages/common/src/authorization/erp-permissions.ts:164-169, 232, 461`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/architecture/decisions/ADR-00xx-investor-module.md` **(baru)** | Keputusan letak + batas |
| skema | `docs/database/docs.dbml` (bagian MODULE baru), `docs/database/module-ownership.md`, `AGENTS.md` (jumlah schema/tabel) | Kontrak dulu |
| skema | `drizzle/schemas/investor.schema.ts` **(baru)** atau tambahan di `finance.schema.ts` | Tabel |
| backend | `database/migrations/` (generate) | Migrasi baru |
| backend | `database/seeders/seed/investor.seeder.ts` **(baru)** | "Bapak Budi Santoso" deterministik (IV-7) |

- **Skema/migrasi:** ya; `docs.dbml` → `gen-logical-references.ts` → `validate-dbml.ts` OK → `drizzle:generate` → migrasi diuji di DB lokal; seed dua kali.
- **Test:** `test/unit/module-seams.test.ts` (batas modul), seeder test **(baru)**.
- **UAT:** Dafrin/Oki meninjau ADR; `validate-dbml.ts` OK.
- **Bergantung pada:** Gate 1–2; jawaban Aqim untuk rincian dana per proyek (IV-5).

**Prompt AI (salin):**

```text
Kerjakan M11-4 ADR dan schema investor.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M11-4 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/architecture/decisions/ADR-00xx-investor-module.md, docs/database/docs.dbml, docs/database/module-ownership.md, AGENTS.md, drizzle/schemas/investor.schema.ts, finance.schema.ts, database/migrations/, database/seeders/seed/investor.seeder.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: tambahkan/jalankan test yang disebut di bagian Test entri ini.
Selesai bila semua butir UAT di entri M11-4 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M11-4.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M11-5 Daftar investor dan dana (Tinggi, IV-2–IV-4, IV-7, IV-8)

- **Seharusnya:**
  - Aqim mencatat investor dan perjanjian: **modal**, **pinjaman** (pokok, imbal tetap %/nominal, jadwal angsuran, pengingat), **dana per proyek** (IV-2, IV-4).
  - Setoran dicatat Aqim dengan tanggal, rekening, bukti transfer; diaudit (IV-3, IV-8).
  - Jurnal otomatis: Kas/Bank vs Modal Disetor 3-1000 / Utang investor / dana proyek; angsuran dibayar Bella lewat Keuangan.
- **Sekarang:** belum ada modul; rute "Segera hadir" di atas; guard rute induk `/finance/investors` lolos karena bukan daun menu (`lib/route-guard.ts:31`, OE2).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/investor/` **(baru)**: `container.ts`, `index.ts`, `constants/di.ts`, `contracts/`, `repositories/`, `services/investor.service.ts`, `services/investor-funding.service.ts`, `controllers/investor.controller.ts`, `errors/investor.errors.ts`, `queues/installment-due.queue.ts` | Modul sesuai `elysia-module` (lokasi mengikuti ADR M11-4) |
| backend | `src/index.ts`, `src/app/app.ts` | Daftar + mount |
| backend | `src/app/finance/services/exported-finance.service.ts`, `posting-roles.ts` | Kontrak posting setoran/angsuran (peran `investor_loan_payable`, `investor_interest_expense`; akun dicek dengan Bella) |
| backend | `src/app/document/` (kontrak unggah) | Bukti transfer |
| web-admin | `routes/_authed/finance/investors/registry/index.tsx`, `routes/_authed/finance/investors/funding/index.tsx` **(baru)** | Ganti "Segera hadir" |
| web-admin | `components/investor/` **(baru)**, `lib/investor-api.ts` **(baru)**, `components/sidebar/nav-config.ts:271-282`, `lib/route-guard.ts` | Layar, menu, guard rute induk |
| locale | `packages/locales/src/{en,id}/finance.ts` (atau namespace `investor` baru + `i18next.d.ts`) | Teks |
| test | `test/unit/investor.service.test.ts` **(baru)**, `test/authorization/investor-authorization.test.ts` **(baru)** | Hak, jurnal, jadwal angsuran |
| docs | `docs/architecture/role-permission.md` (generator) | Rute |

- **Skema/migrasi:** lihat M11-4.
- **Test:** di atas.
- **UAT:**
  1. Aqim menambah Bapak Budi Santoso, perjanjian pinjaman Rp 100.000.000, imbal 10%/tahun, 12 angsuran → jadwal tampil.
  2. Catat setoran + bukti → jurnal Kas (D) / Utang investor (K).
  3. Bella membayar angsuran pertama → jadwal berstatus lunas.
  4. Role selain Pemilik/Keuangan tidak bisa membuka `/finance/investors`.
- **Bergantung pada:** M11-4, P7-1.

**Prompt AI (salin):**

```text
Kerjakan M11-5 Daftar investor dan dana.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M11-5 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/investor/, container.ts, index.ts, constants/di.ts, contracts/, repositories/, services/investor.service.ts, services/investor-funding.service.ts, controllers/investor.controller.ts, errors/investor.errors.ts, queues/installment-due.queue.ts, src/index.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/investor.service.test.ts, test/authorization/investor-authorization.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M11-5 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M11-5.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M11-6 Bagi hasil tahunan (Tinggi, IV-5)

- **Seharusnya:**
  - Periode **tahunan**, dasar **laba sesudah pajak** dengan rincian; **cadangan %** dan **porsi % per investor** di pengaturan (IV-5).
  - Dana per proyek mendapat bagian dari **margin proyek** (rincian saat desain, kontrak dari `project`).
  - Alur draf → disetujui Aqim → dibayar Bella; publikasi ke portal.
- **Sekarang:** kontrak laba periode tertutup ada: `ExportedProfitService.closedPeriodProfit` (`src/app/finance/services/exported-profit.service.ts:46, 59`); belum ada perhitungan bagi hasil.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/investor/services/profit-sharing.service.ts` **(baru)** | Hitung dari `ExportedProfitService` (agregat tahunan, dicek saat desain) |
| backend | `src/app/finance/services/exported-profit.service.ts` | Metode tahunan bila perlu |
| backend | `src/app/project/services/` kontrak margin proyek **(Dafrin, baru)** | Nilai kontrak, biaya, margin per proyek |
| web-admin | `routes/_authed/finance/investors/profit-sharing/index.tsx`, `components/investor/profit-sharing-*.tsx` **(baru)** | Rincian, setujui, bayar, publikasi |
| locale | sama dengan M11-5 | Teks |
| test | `test/unit/profit-sharing.service.test.ts` **(baru)**, `test/finance/exported-profit.test.ts` | Perhitungan, cadangan, porsi, pembulatan |

- **Skema/migrasi:** lihat M11-4.
- **Test:** di atas.
- **UAT:**
  1. Laba sesudah pajak 2026 Rp 500.000.000, cadangan 20%, porsi Budi 10% → bagian Rp 40.000.000 dengan rincian langkah.
  2. Aqim menyetujui, Bella membayar → status Dibayar, jurnal Prive/Dividen 3-4000.
- **Bergantung pada:** M11-5; kontrak margin proyek dari Dafrin; aturan rinci dari Aqim.

**Prompt AI (salin):**

```text
Kerjakan M11-6 Bagi hasil tahunan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M11-6 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/investor/services/profit-sharing.service.ts, src/app/finance/services/exported-profit.service.ts, src/app/project/services/, routes/_authed/finance/investors/profit-sharing/index.tsx, components/investor/profit-sharing-*.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/profit-sharing.service.test.ts, test/finance/exported-profit.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M11-6 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M11-6.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M11-7 Portal investor (Tinggi, IV-6, IV-9, IV-10)

- **Seharusnya:**
  - `apps/web-investor`: masuk lewat **undangan email** → buat kata sandi → **kode verifikasi email** di perangkat baru (IV-9).
  - **Satu halaman dasbor analitik**: kartu ringkas, grafik, rincian bagi hasil, pinjaman, proyek didanai, kinerja ringkas yang dipublikasikan, riwayat setoran; saringan tahun; ekspor PDF (berkop) dan Excel (IV-10, bagian 3a).
  - Investor hanya melihat datanya sendiri (cek di server).
- **Sekarang:** `apps/web-investor/src/App.tsx` templat Vite kosong; tidak ada di compose/CI (`docker-compose.yml`, `.github/workflows/` tanpa `web-investor`); app role `investor` sudah ada (`packages/common/src/authorization/erp-permissions.ts:344, 461`; riwayat ADR-0018, tidak perlu dibuka).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/investor/controllers/investor-portal.controller.ts` **(baru)** | Prefix `/investors/portal/v1`, guard app role `investor` (pola `src/authorization/portal-auth.ts`, dicek saat desain) |
| backend | `src/providers/better-auth/plugins/email-otp.auth.ts`, `src/app/user/services/invitation.service.ts` | Undangan investor + verifikasi perangkat baru (dicek saat desain) |
| backend | `src/app/investor/services/investor-dashboard.service.ts` **(baru)** | Agregat dasbor + ekspor XLSX/PDF |
| portal | `apps/web-investor/src/` (router, auth-client, i18n, `routes/login`, `routes/index` dasbor) | Bangun aplikasi (pola `apps/web-employee`) |
| deploy | `apps/web-investor/Dockerfile` **(baru)**, `docker-compose.yml`, `.github/workflows/main-{test-and-build,deploy}-web-investor.yml` **(baru)** | Deploy |
| locale | `packages/locales/src/{en,id}/investor.ts` **(baru, bila namespace baru)** | Teks |
| test | `test/unit/investor-portal.test.ts` **(baru)**; test web-investor **(baru)** | Kepemilikan data, ekspor |

- **Skema/migrasi:** lihat M11-4.
- **Test:** di atas.
- **UAT:**
  1. Aqim mengundang Budi → email masuk → Budi membuat kata sandi → kode verifikasi di perangkat baru.
  2. Dasbor menampilkan dana, sisa pinjaman, bagi hasil 2026 dengan rincian.
  3. Ekspor PDF berkop dan Excel per bagian terunduh.
  4. Budi tidak bisa membuka data investor lain (ganti id di URL → ditolak).
- **Bergantung pada:** M11-5, M11-6, P7-7 (SMTP, Chromium).

---

**Prompt AI (salin):**

```text
Kerjakan M11-7 Portal investor.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian M11-7 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/investor/controllers/investor-portal.controller.ts, src/providers/better-auth/plugins/email-otp.auth.ts, src/app/user/services/invitation.service.ts, src/app/investor/services/investor-dashboard.service.ts, apps/web-investor/src/, routes/login, routes/index, apps/web-investor/Dockerfile, docker-compose.yml, packages/locales/src/{en,id}/investor.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: .github/workflows/main-{test-and-build,deploy}-web-investor.yml, test/unit/investor-portal.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M11-7 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M11-7.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Portal karyawan

### PK-9 Layar admin kunjungan lokasi (Tinggi, KF-E1)

- **Seharusnya:** di web-admin, Aqim melihat **semua** check-in lokasi (termasuk karyawan kantor yang ditugaskan): saring per orang, proyek, tanggal; swafoto, jarak, peta (KL 6.4).
- **Sekarang:** daftar hanya di portal: milik sendiri `GET /projects/me/site-attendance` dan semua orang **hanya PIC** `GET /projects/me/projects/:id/site-attendance` (`src/app/project/controllers/portal-project.controller.ts:110-118`, prefix `/projects/me` `:48-52`); tabel `project.site_attendances` dengan `selfie_key` (`drizzle/schemas/project.schema.ts:953-977`). Modul `project` milik Dafrin.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/project/controllers/project.controller.ts` (Bersama, K11/PR ke Dafrin) | `GET /projects/site-attendance` (hak `attendance:read` atau `project:read`, dicek saat desain) |
| backend | `src/app/project/services/site-attendance.service.ts`, repository terkait | `listAll(filter)` + URL swafoto bertanda tangan |
| web-admin | `routes/_authed/hr/site-visits/index.tsx` **(baru)**, `components/hr/site-visit-list.tsx` **(baru)**, `lib/project-api.ts` | Tabel + pratinjau foto + tautan peta |
| web-admin | `components/sidebar/nav-config.ts` | Menu di SDM |
| locale | `packages/locales/src/{en,id}/hr.ts` | Teks |
| test | `test/unit/site-attendance.service.test.ts` | Saringan, hak |
| docs | `docs/architecture/role-permission.md` (generator) | Rute |

- **Skema/migrasi:** tidak.
- **Test:** di atas.
- **UAT:**
  1. Aqim → SDM → Kunjungan lokasi → tampil check-in hari ini dengan swafoto dan jarak.
  2. Saring proyek tertentu → hanya kunjungan proyek itu.
  3. Teknisi tidak bisa membuka halaman ini.
- **Bergantung pada:** persetujuan Dafrin (modul `project`).

**Prompt AI (salin):**

```text
Kerjakan PK-9 Layar admin kunjungan lokasi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PK-9 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/project/controllers/project.controller.ts, src/app/project/services/site-attendance.service.ts, routes/_authed/hr/site-visits/index.tsx, components/hr/site-visit-list.tsx, lib/project-api.ts, components/sidebar/nav-config.ts, packages/locales/src/{en,id}/hr.ts, docs/architecture/role-permission.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/site-attendance.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PK-9 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PK-9.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PK-10 Menu portal per penempatan dan freelance (Tinggi, KL-2, KL-5, KL-10)

- **Seharusnya:**
  - Menu mengikuti **penempatan** (Kantor: absen kantor; Lapangan: check-in lokasi) dan **jenis Freelance** (tanpa cuti, lembur, jadwal, slip gaji; dengan Rekap upah) (KL 6.2).
  - Kartu **"Hari ini"** mengikuti keadaan hari (tugas lapangan, sudah hadir, cuti) (KL 6.1); menu Kasbon hanya untuk yang punya tugas proyek aktif atau kasbon terbuka (KL-10).
  - Pekerja Lepas melihat proyek yang ditugaskan, pinjam alat, kasbon, tanpa tiket (KL-6, P7-4).
- **Sekarang:** menu tetap untuk semua (`components/sidebar/portal-nav.ts:57-80`: cuti, lembur, slip gaji); `human_resource.employees.employment_type` tanpa `freelance` dan tanpa kolom penempatan (`apps/backend/drizzle/schemas/human-resource.schema.ts:137, 165-166`; skema oleh Dafrin B-45).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/human-resource/services/employee-portal.service.ts`, `src/app/human-resource/controllers/employee-portal.controller.ts` (Dafrin, B-45) | Profil portal memuat `placement`, `employmentType`, `hasActiveProjectTask` |
| portal | `components/sidebar/portal-nav.ts`, `components/sidebar/portal-sidebar.tsx`, `portal-bottom-bar.tsx` | Saring menu per profil |
| portal | `routes/_authed.index.tsx` | Kartu "Hari ini" |
| portal | `routes/_authed.wages.tsx` **(baru)** | Rekap upah freelance (data B-45/M09-18) |
| portal | `lib/portal-api.ts`, `lib/portal-guard.ts` | Profil + guard rute (cuti dll. ditolak untuk freelance) |
| locale | `packages/locales/src/{en,id}/employee.ts` | Teks kartu dan pesan KL 6.3 |
| test | `test/unit/employee-portal.service.test.ts`; test web-employee **(baru)** | Menu per profil |

- **Skema/migrasi:** tidak di bagian Oki (kolom penempatan/freelance oleh Dafrin di B-45, `docs.dbml` dulu).
- **Test:** di atas.
- **UAT:**
  1. Login Ade (Freelance) → tidak ada Cuti, Lembur, Slip gaji; ada Rekap upah dan Proyek saya.
  2. Bilal (Kantor) yang punya tugas proyek hari ini → kartu "Tugas lapangan: {proyek}" + tombol Check-in di lokasi; menu Kasbon tampil.
  3. Karyawan kantor tanpa tugas → kartu Absen kantor Masuk/Pulang; menu Kasbon tidak tampil.
- **Bergantung pada:** B-45 (Dafrin), P7-4, M09-18.

**Prompt AI (salin):**

```text
Kerjakan PK-10 Menu portal per penempatan dan freelance.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PK-10 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/human-resource/services/employee-portal.service.ts, src/app/human-resource/controllers/employee-portal.controller.ts, components/sidebar/portal-nav.ts, components/sidebar/portal-sidebar.tsx, portal-bottom-bar.tsx, routes/_authed.index.tsx, routes/_authed.wages.tsx, lib/portal-api.ts, lib/portal-guard.ts, packages/locales/src/{en,id}/employee.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/employee-portal.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PK-10 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PK-10.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-PORTAL Portal karyawan: kasbon, riwayat lokasi, lupa sandi, radius (Tinggi, OB13, OG1–OG3, PK-1)

- **Seharusnya:**
  - Halaman **Kasbon** di portal: ajukan dan lihat kasbon sendiri; dicairkan Aqim (OB13/RO6, KL-10).
  - Pekerja non-PIC melihat **riwayat absen lokasinya sendiri** (OG2).
  - Halaman **lupa kata sandi** (OG3).
  - Absen lokasi di luar radius **ditolak**, saat check-in **dan** check-out; petunjuk radius dari setting (OG1, PK-1).
- **Sekarang:** tautan `/forgot-password` tanpa rute (`apps/web-employee/src/components/form/login-form.tsx:182`; rute di `routes/` tidak ada); di luar radius dicatat `out_of_range`, tidak ditolak (`src/app/project/services/site-attendance.service.ts:65-70, 119-176`), check-out tanpa cek radius (`:187`); `listMine` sudah ada di backend (`portal-project.controller.ts:110`, cek "tugas saya" di `routes/_authed.projects.$projectId.tsx:193`); tidak ada rute kasbon portal (kasbon hanya `guards: 'erp'`, `src/app/finance/controllers/employee-advance.controller.ts:23`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `src/app/finance/controllers/employee-portal-finance.controller.ts` **(baru, sama dengan M09-19)** | Kasbon sendiri |
| backend | `src/app/project/services/site-attendance.service.ts` (Bersama, PR ke Dafrin) | Tolak di luar radius pada check-in/out |
| portal | `routes/_authed.advances.tsx` **(baru)**, `routes/forgot-password.tsx` **(baru)**, `routes/reset-password.tsx` **(baru)**, `routes/_authed.projects.$projectId.tsx`, `routes/_authed.attendance.tsx` | Layar |
| portal | `components/sidebar/portal-nav.ts`, `lib/portal-api.ts`, `lib/auth-client.ts` | Menu + `requestPasswordReset` Better Auth |
| locale | `packages/locales/src/{en,id}/employee.ts`, `api.ts` | Pesan radius KL 6.3 |
| test | `test/unit/site-attendance.service.test.ts`, `test/finance/employee-advances.test.ts` | Tolak radius; kasbon portal milik sendiri |

- **Skema/migrasi:** tidak.
- **UAT:**
  1. Fahri check-in 300 m dari lokasi (radius 100 m) → ditolak dengan jarak dan batas.
  2. Fahri (non-PIC) membuka tab kunjungan saya → riwayatnya tampil.
  3. Lupa kata sandi → email reset → masuk dengan kata sandi baru.
  4. Fahri mengajukan kasbon di portal → Aqim melihatnya di Keuangan.
- **Bergantung pada:** P7-7 (SMTP), M09-7, persetujuan Dafrin (site attendance).

---

**Prompt AI (salin):**

```text
Kerjakan PH-PORTAL Portal karyawan: kasbon, riwayat lokasi, lupa sandi, radius.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PH-PORTAL (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: src/app/finance/controllers/employee-portal-finance.controller.ts, src/app/project/services/site-attendance.service.ts, routes/_authed.advances.tsx, routes/forgot-password.tsx, routes/reset-password.tsx, routes/_authed.projects.$projectId.tsx, routes/_authed.attendance.tsx, components/sidebar/portal-nav.ts, lib/portal-api.ts, lib/auth-client.ts, packages/locales/src/{en,id}/employee.ts, api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/site-attendance.service.test.ts, test/finance/employee-advances.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-PORTAL terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-PORTAL.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Halaman lain dari peta halaman (Oki)

### PH-MASUK Halaman Masuk tanpa Google, pesan nonaktif (Tinggi, K13, OA3, OA14)

- **Seharusnya:** tombol Google dihapus di web-admin dan portal karyawan (K13, OA3; M12-4, PK-8); pesan login akun **nonaktif** berbeda dari akun yang **belum klaim undangan** (OA14; M12-9). Provider Google tetap untuk portal pelanggan (OA4, Dafrin).
- **Sekarang:** `signIn.social({ provider: 'google' })` di `apps/web-admin/src/components/form/login-form.tsx:98` dan `apps/web-employee/src/components/form/login-form.tsx:99`; satu kunci `auth.accountNotActive` untuk semua status (`src/providers/better-auth/options/session.auth.ts:46-49`, `ac/login-gate.ts:49`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `components/form/login-form.tsx`, `lib/last-login.ts` | Hapus tombol dan "terakhir dipakai Google" |
| portal | `apps/web-employee/src/components/form/login-form.tsx`, `lib/last-login.ts` | Sama |
| backend | `src/providers/better-auth/ac/login-gate.ts`, `options/session.auth.ts` | Kode `ACCOUNT_DEACTIVATED` vs `INVITATION_PENDING` |
| locale | `packages/locales/src/{en,id}/api.ts`, `auth.ts` | Dua pesan; hapus kunci Google yang mati |
| test | `test/unit/login-gate.test.ts`, `test/authorization/login-gate.guard.test.ts`, `test/unit/google-login-hardening.auth.test.ts` | Pesan berbeda |

- **Skema/migrasi:** tidak.
- **UAT:** halaman Masuk tanpa tombol Google (kedua aplikasi); akun nonaktif → "Akun dinonaktifkan, hubungi Pemilik"; akun undangan belum diklaim → "Selesaikan undangan dari email".
- **Bergantung pada:** — .

**Prompt AI (salin):**

```text
Kerjakan PH-MASUK Halaman Masuk tanpa Google, pesan nonaktif.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PH-MASUK (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: components/form/login-form.tsx, lib/last-login.ts, apps/web-employee/src/components/form/login-form.tsx, src/providers/better-auth/ac/login-gate.ts, options/session.auth.ts, packages/locales/src/{en,id}/api.ts, auth.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/login-gate.test.ts, test/authorization/login-gate.guard.test.ts, test/unit/google-login-hardening.auth.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-MASUK terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-MASUK.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-UNDANG Pengguna / Undang (Tinggi, OA12, OA13, K12)

- **Seharusnya:** hanya Pemilik mengundang (OA12, hak di P7-4); isian organisasi dihapus dari dialog (K12); dialog konfirmasi untuk hapus undangan dan nonaktifkan pengguna (OA13).
- **Sekarang:** dialog punya pemilih organisasi (`components/invite/invite-dialog.tsx:57-60`); hapus undangan tanpa konfirmasi (`components/admin/pending-invitations-panel.tsx:194-198`); nonaktifkan langsung dari menu baris (`routes/_authed/admin/users/index.tsx:568-573`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `components/invite/invite-dialog.tsx` | Hapus pemilih organisasi (pakai organisasi tunggal) |
| web-admin | `components/admin/pending-invitations-panel.tsx`, `routes/_authed/admin/users/index.tsx` | `confirm-dialog.tsx` |
| backend | `src/app/user/services/invitation.service.ts` | Isi organisasi tunggal bila tidak dikirim |
| locale | `packages/locales/src/{en,id}/admin.ts` | Teks konfirmasi |
| test | `test/unit/invitation.service.test.ts` | Tanpa organisasi → organisasi tunggal |

- **Skema/migrasi:** tidak.
- **UAT:** SDM tidak melihat tombol Undang; Aqim mengundang tanpa memilih organisasi; Hapus undangan dan Nonaktifkan meminta konfirmasi.
- **Bergantung pada:** P7-4, M12-2.

**Prompt AI (salin):**

```text
Kerjakan PH-UNDANG Pengguna / Undang.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian PH-UNDANG (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: components/invite/invite-dialog.tsx, components/admin/pending-invitations-panel.tsx, routes/_authed/admin/users/index.tsx, src/app/user/services/invitation.service.ts, packages/locales/src/{en,id}/admin.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: test/unit/invitation.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-UNDANG terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-UNDANG.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-IMPOR Impor data awal, modul Oki (Tinggi, L-12, NM-1, NM-2)

- **Seharusnya:** templat Excel, unggah, **semua baris diperiksa**, semua-atau-tidak, kesalahan per baris (NM-1). Bagian Oki: daftar akun + saldo awal + piutang/utang awal, aset (NM-2). Pelanggan/pemasok/barang/karyawan oleh Dafrin.
- **Sekarang:** templat CSV saldo awal subledger sudah ada (`src/app/finance/controllers/ledger.controller.ts:416-421`, `src/app/finance/services/opening-subledger.service.ts`); pola XLSX templat ada di HR (`src/app/human-resource/controllers/attendance.controller.ts:47`).
- **File yang diubah:** `src/app/finance/controllers/ledger.controller.ts`, `src/app/finance/services/opening-balance.service.ts`, `opening-subledger.service.ts`, `src/app/finance/services/account.service.ts` (impor akun), `src/app/inventory/controllers/item-operations.controller.ts` + service impor aset **(baru)**, `components/finance/opening-balance-page.tsx`, `components/assets/asset-register-list.tsx`, komponen impor bersama **(baru, bentuk dari P7-6)**, `packages/locales/src/{en,id}/finance.ts`, `assets.ts`, test `test/finance/opening-subledger.test.ts` + test impor aset **(baru)**.
- **Skema/migrasi:** tidak.
- **UAT:** unggah templat akun dengan satu baris salah → tidak ada yang masuk, kesalahan menyebut baris; perbaiki → semua masuk.
- **Bergantung pada:** P7-6 (komponen form/kesalahan bersama), P7-3 untuk stok awal (Dafrin).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### PH-LAPHARIAN Portal: laporan harian (Tinggi, B-44 Dafrin + Oki)

- **Seharusnya:** layar portal mengisi laporan harian, tanda "belum diisi", susulan maks. 2 hari (B-44, KL 6.1). Backend dan aturan oleh Dafrin; layar portal oleh Oki.
- **Sekarang:** tabel laporan harian di schema `project` (`apps/backend/drizzle/schemas/project.schema.ts`, dicek nama tabel saat desain); portal belum punya rute laporan (`apps/web-employee/src/routes/`).
- **File yang diubah:** `apps/web-employee/src/routes/_authed.reports.tsx` **(baru)**, `components/sidebar/portal-nav.ts`, `routes/_authed.index.tsx` (kartu), `lib/project-api.ts`, `packages/locales/src/{en,id}/employee.ts`.
- **Skema/migrasi:** tidak di bagian Oki.
- **UAT:** isi laporan hari ini → kartu Beranda "Sudah diisi pukul …"; laporan 3 hari lalu tidak bisa disusul.
- **Bergantung pada:** B-44 (Dafrin).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### PH-WA Profil pengguna: nomor WA staf (Tinggi, B-46)

- **Seharusnya:** staf mengisi nomor WhatsApp di profil sebagai penerima pesan n8n (B-46, N8-3).
- **Sekarang:** kolom `phone` ada di `auth.users` (`apps/backend/drizzle/schemas/auth.schema.ts:61-63`); form profil `apps/web-admin/src/components/profile/profile-edit-form.tsx` (dicek apakah sudah memuat telepon).
- **File yang diubah:** `components/profile/profile-edit-form.tsx` (`type="tel"`), `src/app/user/services/user.service.ts` + kontrak, `packages/locales/src/{en,id}/account.ts`, `test/unit/user.service.test.ts`.
- **Skema/migrasi:** tidak (kolom ada).
- **UAT:** Bella mengisi 0812… di profil → tersimpan dalam format E.164; pesan uji n8n masuk.
- **Bergantung pada:** B-46 (Dafrin), X-14.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### PH-DASBOR Dasbor (Sedang, RD1–RD3, OF1–OF3)

Bukan Tinggi; dicatat karena baris O di peta halaman. M01-1..M01-4 semuanya Rendah/Sedang.

- **Seharusnya:** kartu per role dan baris "Hari ini" (RD1–RD3); tautan disembunyikan bila tidak berhak (OF1); lencana "Sementara" dihapus (OF2); `dashboard:read` diperiksa (OF3).
- **Sekarang:** lencana tetap `widget.profit.provisional` (`components/dashboard/dashboard-page.tsx:346`); rute dasbor tanpa cek hak (`routes/_authed.index.tsx:14-28`).
- **File yang diubah:** `components/dashboard/dashboard-page.tsx`, `dashboard-shared.tsx`, `routes/_authed.index.tsx`, `lib/dashboard-api.ts`, `packages/locales/src/{en,id}/dashboard.ts`, `test/authorization/dashboard-aggregates.test.ts`.
- **Skema/migrasi:** tidak.
- **UAT:** login Penjualan → tidak ada tautan Stok yang berujung 403; kartu Laba tanpa "Sementara".
- **Bergantung pada:** P7-4; kartu modul Dafrin (RD1).

---

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

## Lintas modul

### X-1 Autentikasi dan organisasi (Tinggi)

Pecah ke [M12-2](#m12-2-k12-hapus-organisasi-total-dalam-satu-pr-tinggi-oa1-oa2), [PH-MASUK](#ph-masuk-halaman-masuk-tanpa-google-pesan-nonaktif-tinggi-k13-oa3-oa14), [PH-UNDANG](#ph-undang-pengguna--undang-tinggi-oa12-oa13-k12), [P7-4](#p7-4-hak-role-baru-tinggi-k2-k2b-k2d-ro1-ro4-oa8-oa12-kl-6-kl-10-b4). Portal pelanggan (OA4) di Dafrin.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-2 Aturan persetujuan K1 bersama (Tinggi)

Dikerjakan Dafrin sebagai P7-3 (lihat `peta-kode-dafrin.md`). Bagian Oki: `AuditWriter.recordInTx` + `meta.self_approved` (P7-1), ADR-0006 (P7-2), dan meninjau PR. Helper K1 diusulkan di `apps/backend/src/shared/approval/` **(baru, bagian bersama K11)**; dipakai juga M06-2 dan M09-7.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-3 Penomoran bersama (Tinggi)

Dikerjakan Dafrin sebagai P7-5 (`src/shared/numbering`, `CODE_MAX_LENGTH`, nomor di dalam transaksi). Bagian Oki: meninjau PR, dan memastikan `FinanceNumberingService` (`src/app/finance/services/finance-numbering.service.ts`), `TaxNumberingService`, `PaymentNumberingService`, `InventoryNumberingService` (aset) ikut pola baru setelah P7-5 masuk.

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-4 Audit sebagai aktivitas bisnis (Tinggi)

Sama dengan [P7-1](#p7-1-audit-di-dalam-transaksi-tinggi-oa5oa7-l-1).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-5 Chromium untuk PDF (Tinggi untuk produksi)

Bagian dari [P7-7](#p7-7-server-siap-pakai-dan-batas-login-tinggi-nm-5-nm-6-l-10-l-11). Pelebaran `document.documents.code` hanya bila opsi 3 penomoran dipilih di P7-5 (dicek saat P7-5).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-7 Deploy: S3, SMTP, scheduler, web-investor, backup (Tinggi untuk produksi)

S3/SMTP/scheduler di [P7-7](#p7-7-server-siap-pakai-dan-batas-login-tinggi-nm-5-nm-6-l-10-l-11); `web-investor` di [M11-7](#m11-7-portal-investor-tinggi-iv-6-iv-9-iv-10); backup di [X-13](#x-13-backup-harian-dan-panduan-deploy-tinggi-nm-3-nm-10-l-13).

**Prompt AI (salin):** tugas ini penunjuk; pakai prompt di entri yang dirujuk.

### X-13 Backup harian dan panduan deploy (Tinggi, NM-3, NM-10, L-13)

- **Seharusnya:**
  - Backup otomatis tiap malam: database + berkas S3, **disalin ke luar server**, simpan **30 hari**; uji restore **tiap bulan** dan dicatat (NM-3).
  - Panduan deploy, rollback, backup/restore ditulis Oki, ditinjau Dafrin (NM-10).
  - Server siap pakai dan batas login di P7-7 (NM-5, NM-6).
- **Sekarang:** tidak ada layanan atau skrip backup di `docker-compose.yml` maupun repo; `docs/architecture/runbook.md` tanpa bagian backup/restore (dicek saat desain).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| deploy | `docker-compose.yml` | Layanan backup terjadwal (mis. `pg_dump` + salin S3, dicek saat desain) |
| deploy | `apps/backend/scripts/backup/` **(baru)** atau `deploy/backup/` **(baru)** | Skrip backup + restore + rotasi 30 hari |
| docs | `docs/architecture/runbook.md` | Panduan deploy, rollback, backup, uji restore |
| docs | `docs/adjustment/catatan-progres.md` | Catatan uji restore bulanan |

- **Skema/migrasi:** tidak.
- **Test:** uji restore ke database lokal yang bisa dibuang (manual, dicatat).
- **UAT:**
  1. Pagi hari ada berkas backup tadi malam di lokasi luar server.
  2. Restore ke server uji → login dan data terakhir ada.
  3. Dafrin bisa mengikuti panduan rollback tanpa bertanya.
- **Bergantung pada:** P7-7, akses server (NM-4) dan lokasi penyimpanan luar dari Aqim.

**Prompt AI (salin):**

```text
Kerjakan X-13 Backup harian dan panduan deploy.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian X-13 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docker-compose.yml, apps/backend/scripts/backup/, deploy/backup/, docs/architecture/runbook.md, docs/adjustment/catatan-progres.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: tambahkan/jalankan test yang disebut di bagian Test entri ini.
Selesai bila semua butir UAT di entri X-13 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/X-13.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### X-14 n8n dan WAHA self-host (Tinggi, N8-1, N8-2)

- **Seharusnya:** n8n Community di Docker pada server perusahaan dengan **HTTPS publik**, ikut backup harian (N8-1); WAHA di server yang sama dengan nomor khusus perusahaan, pindah ke Meta Cloud API nanti (N8-2).
- **Sekarang:** compose tanpa layanan n8n/WAHA (`docker-compose.yml:12-207`); webhook ERP sudah di `/webhooks/whatsapp` (modul `webhook`) dan outbox di `automation` (rincian keputusan di `3-rancangan/rancangan-n8n-whatsapp.md`; ADR-0020 tidak perlu dibuka).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| deploy | `docker-compose.yml` (atau `docker-compose.automation.yml` **(baru)**) | Layanan `n8n`, `waha`, volume, reverse proxy HTTPS |
| deploy | skrip backup X-13 | Volume n8n ikut |
| backend | `apps/backend/.env.example` | Nama env URL n8n/WAHA (nama saja) |
| docs | `docs/architecture/runbook.md` | Pasang, pindah nomor, ganti ke Meta |

- **Skema/migrasi:** tidak.
- **Test:** cek manual webhook dari WAHA ke ERP dan event outbox ke n8n.
- **UAT:**
  1. n8n terbuka lewat HTTPS dengan domain perusahaan.
  2. Event ERP (mis. SPH terkirim) memicu workflow; pesan WA terkirim dari nomor perusahaan.
  3. Volume n8n ada di backup malam.
- **Bergantung pada:** P7-7, X-13, B-46 (Dafrin: sakelar pesan).

---

**Prompt AI (salin):**

```text
Kerjakan X-14 n8n dan WAHA self-host.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-oki.md bagian X-14 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docker-compose.yml, docker-compose.automation.yml, apps/backend/.env.example, docs/architecture/runbook.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: tambahkan/jalankan test yang disebut di bagian Test entri ini.
Selesai bila semua butir UAT di entri X-14 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/X-14.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Tugas yang tidak dirinci di sini

| ID | Alasan |
|---|---|
| M12-4, M12-6..M12-13, M12-17 | Bukan Tinggi (M12-4/M12-9 Tinggi lewat PH-MASUK). M12-3 (role ke pengguna) digabung ke M12-2; M12-7 dan M12-13 gugur karena halaman Organisasi dihapus (K12 diubah 28/11) |
| M09-5, M09-6, M09-9..M09-14 | Sedang/Rendah (M09-5 tercakup P7-4/M09-4; M09-10 tercakup M12-16) |
| M10-4..M10-8, M10-10 | Sedang/Rendah (M10-4 bersama Dafrin, OC4) |
| M06-4, M06-5, M06-7..M06-13, M06-15 | Sedang/Rendah (M06-4, M06-7 tercakup PH-PINJAM) |
| M11-1..M11-3 | Diganti M11-4..M11-7 (IV-1) |
| M01-1..M01-4 | Rendah; ringkas di PH-DASBOR |
| PK-1..PK-8 | Sedang/Rendah (PK-1, PK-2, PK-3 tercakup PH-PORTAL; PK-8 di PH-MASUK) |
| X-6, X-8..X-12 | Sedang/Rendah |
| Peta halaman O: Tagihan manual (OB14), Servis & Kondisi (OD5), Pengaturan Gaji (OC8) | Sedang |
