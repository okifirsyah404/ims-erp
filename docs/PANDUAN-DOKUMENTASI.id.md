# Panduan Dokumentasi IMS / Entragate ERP (Bahasa Indonesia)

Ringkasan berbahasa Indonesia atas seluruh isi folder `docs/`.

- **Ditulis:** 2026-11-21, dari `origin/main` commit `638ab9fa` (PR #138).
- **Tujuan:** pintu masuk berbahasa Indonesia. File ini tidak menggantikan dokumen aslinya (berbahasa Inggris), tetapi menjelaskan isinya, statusnya, dan bagian mana yang sudah usang.

**Sumber kebenaran.** Kalau dokumen saling bertentangan, urutan yang dipercaya:

1. `AGENTS.md`
2. `docs/database/docs.dbml`
3. Kode di `apps/`

Dokumen lain yang berbeda dari ketiganya dianggap usang dan perlu diperbaiki. Daftarnya ada di bagian 12.

---

## Daftar isi

1. [Peta folder `docs/`](#1-peta-folder-docs)
2. [Gambaran sistem](#2-gambaran-sistem)
3. [Aturan arsitektur yang wajib dipatuhi](#3-aturan-arsitektur-yang-wajib-dipatuhi)
4. [Database: konvensi dan 20 schema](#4-database-konvensi-dan-20-schema)
5. [Modul bisnis satu per satu](#5-modul-bisnis-satu-per-satu)
6. [Keamanan dan hak akses](#6-keamanan-dan-hak-akses)
7. [Konvensi API dan URL](#7-konvensi-api-dan-url)
8. [Integrasi n8n dan WhatsApp](#8-integrasi-n8n-dan-whatsapp)
9. [Status pekerjaan](#9-status-pekerjaan)
10. [Daftar ADR (keputusan arsitektur)](#10-daftar-adr-keputusan-arsitektur)
11. [Cara kerja: gate, migrasi, test, perintah](#11-cara-kerja-gate-migrasi-test-perintah)
12. [Dokumen usang dan kontradiksi](#12-dokumen-usang-dan-kontradiksi)
13. [Glosarium](#13-glosarium)

---

## 1. Peta folder `docs/`

| Folder | Jumlah file | Isi | Kebaruan |
| --- | --- | --- | --- |
| `docs/architecture/` | 10 | Aturan teknis inti: README (indeks), project-audit, stack-compatibility, architecture, runbook, domain-map, data-model, api-conventions, security-and-access, testing-strategy | Angka schema/tabel sudah 20 / 196 (disinkronkan 2026-11-24); drift lain masih ada |
| `docs/architecture/api/` | 1 | `licensing.yaml`: OpenAPI untuk License API | Isinya benar, path kodenya lama |
| `docs/architecture/decisions/` | 29 | ADR-0001 s/d ADR-0029 (ada dua file ADR-0012) | Banyak ADR lama belum ditandai "superseded" |
| `docs/architecture/modules/` | 34 | Satu dokumen per modul backend + website/portal | `product`, `warehouse`, `inventory` ditulis ulang 2026-11-24 (ADR-0026); halaman lain sebagian *deprecated* |
| `docs/database/` | 8 | **Kontrak database** (`docs.dbml`), aturan kepemilikan, integritas, kamus data, referensi logis, riwayat fase, skrip generator dan validator | `docs.dbml` valid (196 tabel / 153 ref / 189 kolom referensi); pendampingnya disinkronkan 2026-11-24 |
| `docs/plan/` | 6 | `progress.md` (log kerja, ±14.000 baris), `backlog.md` (daftar ERP-xxxx), `plan.md`, rencana komersial EN/ID v5.1, rencana port portal | Bagian atas progress terkini; bagian bawahnya historis |
| `docs/plan/database-refactor/` | 22 | Rencana refactor database ADR-0024 per modul | Status masih "planned" padahal sudah dikerjakan |
| `docs/plan/plans/` | 15 | `features.md` (rangkuman fitur per modul) + rencana per topik (finance, tax, inventory, dashboard, signature, dll.) | `features.md` dipelihara; file lain historis |
| `docs/plan/erp-module-plans/` | 13 | Rencana M01-M12 dari baseline komersial v5.1 | Bagian "Current state" M02-M10 usang |
| `docs/plan/phases/` | 8 | Fase 1-7 beserta syarat masuk dan keluar | Path dan nama modul sebagian lama |
| `docs/plan/uat/` | 7 | Skrip UAT M02, M03, M04, M05, M07, M08 | Ditulis 2026-11-12, **belum pernah dijalankan** |
| `docs/integrations/n8n/` | 8+ | Workflow n8n siap impor, sumber JS, template Meta, skrip uji | Terkini |
| `docs/user-guide/` | 10 | Panduan pengguna EN/ID, diagram, panduan n8n, WhatsApp Meta, setup WAHA | Panduan utama bertanggal 2026-11-06; sebagian keterbatasan sudah tidak berlaku |

**Urutan baca resmi** (`docs/architecture/README.md`) untuk sesi baru:

1. `AGENTS.md`
2. `project-audit.md`
3. `stack-compatibility.md`
4. `docs/plan/progress.md` (bagian atas)
5. `architecture.md`
6. `runbook.md`

Dokumen lain dibaca sesuai kebutuhan.

---

## 2. Gambaran sistem

**Bisnisnya.** ERP untuk perusahaan access control di Indonesia (perangkat keras, perangkat lunak, instalasi, maintenance, proyek, langganan). Modelnya **satu perusahaan dengan banyak organisasi internal**, tanpa multi-tenant (ADR-0001, ADR-0007, ADR-0011).

**Aplikasi dalam monorepo:**

| Aplikasi | Teknologi | Port lokal | Fungsi |
| --- | --- | --- | --- |
| `apps/backend` | Bun + Elysia, tsyringe DI, Better Auth, Drizzle ORM (`drizzle-orm/bun-sql`) | 3001 (ada dokumen lama yang menulis 3000) | API ERP |
| `apps/web-admin` | React 19, Vite, TanStack Router/Query/Form/Table, `@ims-erp/ui` | 5173 | Aplikasi internal staf |
| `apps/web-landing` | Astro SSR | 4321 | Website publik (katalog, RFQ, kontak, demo) |
| `apps/web-customer-portal` | Astro + React islands, PWA | 4322 | Portal pelanggan |
| `packages/common` | TypeScript | – | Kode bersama yang aman untuk browser (katalog permission, tipe envelope) |
| `packages/locales` | – | – | Terjemahan `en` + `id` |
| `packages/ui`, `design-tokens`, `react-email` | – | – | Komponen UI, token desain, template email |

**Versi stack** (dari `stack-compatibility.md`):

| Komponen | Versi |
| --- | --- |
| Bun | 1.4.2 |
| Turborepo | 2.10.13 |
| TypeScript | ^6.0.3 |
| Elysia | 1.4.30 |
| drizzle-orm / drizzle-kit | 1.0.0-rc.5 (**Relational v2**; jangan turun ke v1) |
| Better Auth | 1.7.14 |
| zod | 4 |
| React | 19.3.1 |
| Vite | 8.3.5 |
| `@faker-js/faker` | 10.6.0 (hanya seeder) |

Infrastruktur pendukung:
- Redis (Bun `RedisClient`) untuk sesi dan cache.
- BullMQ untuk antrean.
- S3-compatible storage untuk file.
- Chromium headless untuk PDF SPH.

**Modul backend di kode** (`apps/backend/src/app/`, 22 folder): `audit`, `automation`, `company`, `customer`, `document`, `finance`, `human-resource`, `inventory`, `location`, `notification`, `organization`, `payment`, `procurement`, `product`, `project`, `sale`, `supplier`, `tax`, `ticket`, `user`, `warehouse`, `webhook`.

**Modul yang sudah dihapus dan tidak boleh dibangkitkan lagi:** `accounting`, `aftersales`, `assets`, `catalog`, `code-number`, `crm`, `licensing`, `portal`. Schema `organization`, `payroll`, `approval`, `budgeting`, `investor` dan `commerce` juga dihapus (ADR-0024).

---

## 3. Aturan arsitektur yang wajib dipatuhi

Sumber: `AGENTS.md`, `architecture.md`, skill `elysia-module`, `elysia-layered-architecture`, `elysia-tsyringe`, `tsyringe`.

1. **Satu modul memiliki satu schema Postgres.**
   - Pengecualian: modul `user` dan `organization` berbagi schema `auth` (milik Better Auth). Modul `webhook` tidak punya schema.
   - Tidak ada modul yang membaca atau menulis tabel modul lain, atau mengimpor repository modul lain.
2. **Pembagian lapisan:**
   - **Controller** hanya mengurus HTTP: parse, envelope, status.
   - **Service** berisi use case, cek izin, dan batas transaksi.
   - **Repository** berisi query Drizzle.
   - Controller dan service dilarang menyuntikkan `DRIZZLE_TOKEN`; kalau data kurang, tambahkan method repository. Aturan ini **masih dilanggar** di sale, finance, inventory dan payment (lihat `project-audit.md`).
3. **Akses lintas modul** hanya lewat service atau facade yang diekspor (`Exported<Module>Service`) melalui token DI. Siklus dipecah dengan facade yang hanya bergantung ke repository modulnya sendiri.
4. **Referensi lintas modul selalu nullable dan tanpa FK** (ADR-0014). Keberadaan data dicek lewat kontrak `assert*` / `resolve*` milik modul pemiliknya sebelum menulis. FK di dalam satu modul tetap FK sungguhan.
5. **Bentuk folder modul:**
   - `container.ts` (berisi `register<Module>`), `index.ts`, `constants/di.ts`, `contracts/`, `repositories/`, `services/`, `controllers/`, `errors/`.
   - Opsional: `adapters/`, `utils/`, `queues/`, `middleware/`.
   - **Tidak ada folder `routes/`.**
6. **Registrasi dan mounting.** Modul diregistrasi di `src/index.ts`, lalu di-mount di `src/app/app.ts` di dalam factory `createApp()`.
7. **Lapisan bersama yang tidak boleh dibuat ulang per modul:**
   - `src/http/response.ts`: `ok`, `created`, `noContent` (mengembalikan **200**), `okPaginated`, `errorEnvelope`.
   - `src/http/errors.ts`: `AppError` dan turunannya.
   - `src/http/plugin.ts`: `domainPlugin({ name, prefix, tags, guards })`.
   - `src/di/tokens.ts`: token DI.
8. **Tanggal dan uang:**
   - Timestamp disimpan sebagai unix milidetik.
   - Tanggal bisnis mengikuti Asia/Jakarta.
   - Uang berupa integer minor unit IDR (sen rupiah), tidak pernah float (ADR-0002).
   - Opsi Better Auth dalam detik, TTL Redis dalam milidetik.
9. **Soft delete.** Kode fitur tidak pernah menghapus fisik. Master data yang dirujuk transaksi keuangan tidak boleh dihapus.
10. **Bahasa:**
    - Kode, komentar dan dokumen dalam bahasa Inggris.
    - UI bisnis default bahasa Indonesia.
    - **Semua teks di web-admin wajib ada dalam `en` dan `id`.** Test parity dan dead-key di `packages/locales` menjaga aturan ini.
11. **Kejujuran status.** Status bergerak `planned → in-progress → implemented → verified → accepted` (atau `blocked`) dan hanya boleh naik dengan bukti. `accepted` hanya diberikan setelah reviewer menyetujui.
12. **Setiap perubahan kode** wajib memperbarui `docs/plan/progress.md`, `docs/plan/backlog.md` dan `docs/plan/plans/features.md` dalam commit yang sama.
13. **Frontend.** Pemeriksaan izin di frontend hanya untuk UX; keamanan sebenarnya di server. Jangan mengedit `routeTree.gen.ts` dengan tangan.

---

## 4. Database: konvensi dan 20 schema

Sumber: `docs/database/*`, `docs/plan/database-refactor/*`, ADR-0024 dan ADR-0026.

### 4.1 Angka saat ini

Hasil `bun docs/database/validate-dbml.ts`, dijalankan 2026-11-24:

```
parsed: 196 tables, 153 refs
cross-module refs: 0
timestamp gaps: 0
drizzle parity drift: 0
column parity drift (nullability, type): 0
OK
```

- Ada **20 schema dan 196 tabel**: 176 sudah dibangun (jumlah `CREATE TABLE` di 20 migrasi baseline), 20 berstatus `status: target` (baru ada di kontrak).
- Ada 189 kolom referensi logis lintas modul, menunjuk ke 25 tabel target.

### 4.2 Konvensi kolom

| Hal | Aturan |
| --- | --- |
| Primary key | `id uuid default uuidv7()`. Tabel Better Auth memakai `id text`, jadi kolom yang menunjuk user atau organisasi bertipe `text` |
| Waktu operasional | `bigint` unix ms UTC: `created_at`, `updated_at`, `deleted_at`, `*_at` |
| Tanggal bisnis | `date` (hari kalender Asia/Jakarta), dengan CHECK urutan tanggal |
| Uang | `bigint` sen IDR + `currency_code varchar(3) default 'IDR'`. Akhiran `_amount/_total/_cost/_price/_value`. CHECK tanda. Tarif dalam basis poin (`vat_rate_bps`) |
| Kuantitas | `numeric(18,3)`. Baris dokumen harus `> 0`, saldo `>= 0` |
| Soft delete | `deleted_at` nullable. Kode unik memakai partial unique index `WHERE deleted_at IS NULL`. Tidak dipakai di ledger, log, proyeksi, dan 7 tabel Better Auth |
| Tenant | Sebagian besar data company-wide tanpa `organization_id`. Kalau ada, kolomnya nullable. `NULL` = global hanya di `inventory.*` dan `audit`; di tabel lain artinya "belum ditautkan" |
| Status | `text` + CHECK (bukan enum). Aktor tiap langkah disimpan di kolom terpisah (`approved_by`, dll.). Transisi status = UPDATE bersyarat (`WHERE status = 'submitted'`) |
| Penomoran | Tiap schema punya tabel `code_numberings` (14 schema) dan `<Module>NumberingService`. Alokasi atomik `INSERT … ON CONFLICT DO UPDATE … RETURNING` di transaksi yang sama. Token: `{TYPE}`, `{SEQ:n}`, `{COMPANY}`, `{ORG}`, `{SUPPLIER}`, `{MM_ROMAN}`, `{YY}`. Default `{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}` |
| Polimorf | Pasangan `<role>_type` + `<role>_id` hanya dipakai kalau baris menunjuk satu dari **lebih dari 3** tabel. Contoh: `payment.payment_allocations.payable_*`, `inventory.movements.reference_*` |
| Alamat | Hanya `address_line`, `village_id`, `postal_code`, `label`, `is_primary`, `kind`. Kecamatan, kabupaten dan provinsi diturunkan lewat `ExportedLocationService.resolveVillagePath` |
| Referensi lintas modul | Kolom id polos, nullable, dengan catatan baku "Logical reference to … Cross-module FK intentionally omitted. Validated through the … module contract." |
| FK di dalam modul | CASCADE untuk baris anak dokumen, RESTRICT untuk master yang dirujuk uang, SET NULL untuk tautan opsional |

### 4.3 Ke-20 schema

| # | Schema (modul) | Isi utama | Tabel target (belum dibangun) | Kontrak yang diekspor |
| --- | --- | --- | --- | --- |
| 1 | `auth` (`user` + `organization`) | users, sessions, accounts, verifications, passkeys, apikeys, organizations, members, invitations, user_invitations, organization_settings | – | `ExportedUserService`, `ExportedOrganizationService.requireOrganizationCode` |
| 2 | `location` | provinces, regencies, districts, villages (seed wilayah Indonesia) | – | `assertVillage`, `resolveVillagePath` |
| 3 | `company` | profiles (singleton, `document_code` untuk `{COMPANY}`), addresses, contacts, settings | – | `ExportedCompanyService` |
| 4 | `customer` (dulu `crm` + portal) | companies (B2B), customers (orang/PIC + login portal: `user_id`, `portal_role`, `portal_status`), addresses, company_addresses, settings, code_numberings | – | `ExportedCustomerService` |
| 5 | `supplier` | companies (rekening bank dilindungi `supplier:read_bank`), suppliers (PIC), addresses, company_addresses, settings, code_numberings | – | `ExportedSupplierService` |
| 6 | `product` (ADR-0026) | products (SKU + listing website), product_categories, settings, code_numberings | – | `ExportedProductService` |
| 7 | `warehouse` (ADR-0026) | warehouses, warehouse_addresses, warehouse_storages (rak), warehouse_managers (PIC, ADR-0017), warehouse_organizations (ADR-0010), warehouse_settings, settings, code_numberings | – | `ExportedWarehouseService` |
| 8 | `inventory` (menyerap `assets`) | item_serials, items (unit fisik alat/aset), item_categories, documents, movements (ledger append-only), stocks (proyeksi), stock_adjustments (+items), borrowing_requests, borrowings, borrowing_items, borrowing_events, borrowing_request_events, maintenances, condition_checks, disposals, tool_sets, tool_set_items, settings, code_numberings | – | `ExportedInventoryService` |
| 9 | `sale` (dulu `sales`) | quotations (SPH), quotation_items, quotation_status_history, orders, order_items, order_status_history, delivery_notes (surat jalan), delivery_note_items, returns, return_items, invoices, invoice_items, receipts (kwitansi), settings, code_numberings | discount_requests, contracts, targets | `ExportedOrderService`, `ExportedInvoiceService`, `IInvoicePaymentPort` |
| 10 | `procurement` | purchase_requests (+items), purchase_orders (+items), goods_receipts (BPB, +items), purchase_returns (+items), code_numberings | – | (`ExportedPurchaseOrderService` direncanakan) |
| 11 | `finance` (menyerap `accounting`) | chart_of_accounts, accounting_periods, journal_entries, journal_lines, opening_balances, account_balances, bank_account_links, report_archives, payment_terms, cash_bank_accounts, cash_bank_transactions, bank_reconciliations (+items), supplier_bills (+items), ar_open_items, ap_open_items, expense_claims (+items), asset_depreciations, settings, code_numberings | journal_templates, credit_memos, employee_advances, expense_settlements (+items) | posting service; `ExportedFinanceService` / `ExportedJournalService` **belum dibangun** |
| 12 | `tax` | taxes (tarif per tanggal efektif), records (rekap periode), corrections, withholding_tax_records, code_numberings | – | – |
| 13 | `payment` | payments (satu-satunya ledger uang; channel manual/gateway), payment_allocations (polimorf), gateways (secret AES-256-GCM), settings, code_numberings | – | `ExportedPaymentService`, `ExportedPaymentWebhookService` |
| 14 | `project` (menyerap leads, licensing, warranty) | projects, tasks, evidence, costs, handover (BAST), addresses, leads, lead_activities, lead_attachments, warranties, license_applications, license_contracts, license_keys, license_activations, license_events, license_api_keys, settings, code_numberings | types, phases, task_dependencies, milestones, daily_reports, site_assignments, kpi_definitions, kpi_evaluations, changes, work_plans | (`ExportedLeadService`, `ExportedProjectService`, `ExportedWarrantyService` direncanakan) |
| 15 | `ticket` (menggantikan `aftersales`) | tickets (tipe installation/repair/maintenance/warranty_service/inspection/other; ditutup dengan konfirmasi pelanggan), ticket_messages, settings, code_numberings | ticket_templates, sub_ticket_templates | (`ExportedTicketService` direncanakan) |
| 16 | `human_resource` (dulu `hr`) | employees, attendances, leave_types, leave_requests, overtime_requests, employee_tasks, employee_salaries, employee_salary_records, settings, code_numberings | employee_addresses, schedules | `ExportedEmployeeService` |
| 17 | `document` | templates, documents (registri), files, signatures, signature_requests, user_signatures, access_logs, shares, tags, tag_links, settings, code_numberings | – | registry: `register`, `voidBySource`, `attachGeneratedFile` |
| 18 | `notification` | push_notification_templates, push_notifications | – | `ExportedNotificationService.notify` |
| 19 | `audit` | audit_logs (append-only) | – | `AuditService` |
| 20 | `automation` | outbox_messages, faq_entries, whatsapp_conversations, whatsapp_messages | – | `OutboxService.publish`, `ExportedWhatsappWebhookService` |
| – | `webhook` (tanpa schema) | Menerima `/webhooks/{xendit,singapay,whatsapp}` lalu meneruskannya ke `payment` dan `automation` | – | – |

### 4.4 Refactor database ADR-0024 dan ADR-0026

**Mengapa ada refactor.**
- Sebelumnya ada sekitar 27 schema dan 270 tabel rencana, banyak di antaranya hanya ada di dokumen, dan ada pelanggaran batas modul.
- ADR-0024 (dirapatkan 2026-11-19) menormalkan menjadi 18 schema dan 188 tabel. ADR-0026 lalu memisahkan `product` dan `warehouse` dari `inventory`, menjadi **20 schema dan 196 tabel** (tabel `docs.dbml`; migrasi baseline membuat 176 di antaranya).

**Keputusan penting** (Q1-Q39 di `docs/plan/database-refactor/00-overview.md`):

| Q | Keputusan |
| --- | --- |
| Q1 | Schema yang belum dibangun dan tidak dibutuhkan dihapus: `payroll`, `approval`, `budgeting`, `investor`, `commerce` |
| Q2 | Migrasi di-squash menjadi baseline baru |
| Q5 | Login portal pindah ke `customer.customers` |
| Q6 | Penomoran per schema; modul `code-number` dihapus |
| Q8/Q33 | Folder mengikuti nama schema. Prefix URL jamak (`/customers`, `/sales`, `/projects`); `/inventory` dan `/finance` tetap tunggal |
| Q11-Q13 | Lisensi, leads dan garansi masuk `project`; tiket masuk `ticket` |
| Q14/Q15 | Inventory: produk = SKU, items = unit fisik, item_serials = serial produk. `assets` dilebur ke `inventory`. ADR-0026 kemudian memindahkan produk ke `product` |
| Q16/Q17 | Customer dan supplier dipisah menjadi `companies` (perusahaan) dan orang/PIC |
| Q18 | Satu ledger `payment.payments` + alokasi polimorf; secret gateway dienkripsi |
| Q19 | `accounting` menjadi `finance`; tabel pajak menjadi `tax`; rekening bank ke `finance.cash_bank_accounts` |
| Q22 | **Tabel yang belum dibangun hanya ditulis di `docs.dbml` dengan `status: target`** |
| Q29 | Template tiket memunculkan sub-tiket |
| Q34 | Tidak ada alias URL lama (direvisi 2026-11-20; belum ada yang di-deploy) |
| Q38 | Modul `webhook` tanpa database |
| Q39 | Gaji tetap di HR |

**Yang ikut dihapus**, karena tabel target yang belum pernah dibangun tidak dibawa:
- survei kepuasan, rencana dan kunjungan maintenance, kontrak servis, polis dan klaim garansi (dari `aftersales`);
- `sales.payments`, `gateway_payments`, `portal_identities`, `company.bank_accounts`, `hr.bank_accounts`;
- engine approval pusat.

**Fase dan status:**
- P0-P8, ditambah P8b (baseline dipecah menjadi 20 folder migrasi per schema, 2026-11-21), sudah dikerjakan di kode.
- Backlog ERP-0070 s/d ERP-0091 **semuanya masih `in-progress`**. ADR-0024 masih berstatus `proposed`.
- Yang masih terbuka:
  - UI belum dicoba klik secara menyeluruh;
  - `ExportedFinanceService` / `ExportedJournalService` belum dibangun;
  - ticket template dan `employee_addresses` masih target;
  - controller alamat supplier belum ada;
  - body envelope webhook masih menulis `status: 200` untuk 401/404.

### 4.5 Cara menambah atau mengubah tabel

1. **Gate 1, baca berurutan:** `docs.dbml` (hanya bagian modulnya; cari dengan `grep -n "^// MODULE:"`), `module-ownership.md`, `integrity-and-consistency.md`, `data-dictionary.md`, `logical-references.md`. `implementation-phases.md` hanya untuk konteks sejarah.
2. **Gate 2, grill desain:** kepemilikan modul, tenant, soft delete, tipe uang/tanggal, kontrak referensi lintas modul, kosakata status. Jawabannya dicatat di `progress.md`.
3. **Edit `docs.dbml` dulu**, lalu `bun docs/database/gen-logical-references.ts`, lalu `bun docs/database/validate-dbml.ts` (harus `OK`).
4. Baru setelah itu edit schema Drizzle → repository → `bunx --bun drizzle-kit generate` → periksa SQL-nya → uji di **database sekali pakai** → jalankan seed dua kali (yang kedua harus 0 insert).
5. Perbarui `progress.md`, `backlog.md` dan `features.md`.

**Yang diperiksa `validate-dbml.ts`:**
1. DBML bisa di-parse.
2. Tidak ada nama tabel ganda (kecuali whitelist).
3. Tidak ada `Ref:` lintas schema.
4. Kolom timestamp lengkap.
5. Setiap tabel dan kolom Drizzle ada di dbml.
6. Nullability dan tipe kolom sama.

Validator **tidak** memeriksa format catatan referensi logis, nilai default, maupun index.

---

## 5. Modul bisnis satu per satu

Status di bawah mengikuti `features.md` dan `backlog.md`. **Belum ada satu pun fitur yang `accepted`**, artinya belum ada persetujuan bisnis.

### Identitas, organisasi, perusahaan
- **Auth (Better Auth):**
  - Login email/password, username, passkey, email OTP, magic link.
  - Sesi 7 hari, disimpan di Redis.
  - Login gate: hanya user yang punya role internal boleh masuk web-admin.
- **Organisasi:**
  - Unit internal (departemen), bukan tenant.
  - Hanya admin aplikasi yang boleh membuat organisasi; organisasi terakhir tidak bisa dihapus (409).
  - Role per member disimpan di `auth.members.role`, dipisah koma.
- **User:** undangan lebih dulu (user dibuat `pending`), avatar DiceBear, dan halaman akun.
- **Company:**
  - Profil kop surat (singleton), alamat, kontak, settings.
  - `document_code` dipakai sebagai token `{COMPANY}`.
  - Prefix URL di kode `/companies`; dokumen lama menulis `/company`.
- **Penomoran (ERP-0092, 2026-11-21):** halaman `/settings/code-numbers` berisi satu kartu per schema, plus token `{ORG}`. Belum dicek di browser.

### Penjualan (`sale`) — M02
- **Alur:** SPH (quotation) → approval (tidak boleh oleh pembuatnya) → kirim → revisi `-R1` / menang / kalah.
- Setelah menang: sales order → surat jalan (stok keluar, serial terjual) → invoice (DP / cicilan / pelunasan) → kwitansi.
- Retur penjualan: hanya penggantian barang, kondisi dicatat per baris (ERP-0065).
- **PDF SPH otomatis saat dikirim (ERP-0067):**
  - Halaman cetak dirender dengan Chromium, disimpan di registri dokumen, dan diberi link publik 30 hari.
  - Event `quotation.sent` dikirim ke n8n.
- **Pengingat follow-up lead dan SPH lewat n8n (ERP-0066):** hari kerja jam 08.00, pesan hanya ke internal.
- **Pembayaran online (ERP-0020):** Xendit, SingaPay atau `fake`; hanya webhook terverifikasi yang mengubah status. Masih `in-progress`: belum ada sandbox nyata dan belum ada rekonsiliasi.
- **URL:** `/sales/quotations`, `/sales/orders`, `/sales/delivery-notes`, `/sales/returns`, `/sales/invoices`, `/sales/receipts`. Render publik di `/sales/public/v1/render/quotations/:id?token=` (token HMAC 2 menit).

### Pelanggan (`customer`) dan portal
- **Data pelanggan:** `customer.companies` untuk perusahaan, `customer.customers` untuk orang (individu atau PIC perusahaan).
- **Portal pelanggan** (ERP-0022 tahap 1, URL `/customers/portal/v1`):
  - Satu login per kontak dengan peran `owner | approver | finance | viewer`.
  - Pelanggan individu daftar sendiri dengan kode email 6 digit; pelanggan bisnis diundang.
  - Login terkunci 15 menit setelah 5 kali gagal (423).
  - Fitur yang sudah ada: proyek (tanpa biaya), tiket beserta thread dan konfirmasi perbaikan, perangkat dan garansi, anggota akun.
- **Tahap 2 belum ada di main:** pemesanan, SPH, invoice, pembayaran, dokumen, notifikasi.
  - Pekerjaan ini ada di branch cadangan `feat/erp-0069-portal-session` dan sedang di-port lewat rencana `docs/plan/port-portal-onto-main.md`.
  - P1 sudah diajukan sebagai PR #139.

### Pengadaan (`procurement` + `supplier`) — M05
- **Supplier:** dipisah menjadi perusahaan dan PIC. Rekening bank hanya terlihat dengan izin `supplier:read_bank`.
- **Purchase request (ERP-0063):**
  - Satu level approval, tidak boleh oleh pemohon.
  - Baris PR dipecah ke PO; satu baris hanya bisa masuk ke satu PO yang masih hidup.
- **PO** dengan approval → **BPB / goods receipt** (stok masuk + HPP moving average) → **retur pembelian** (ERP-0068, hanya penggantian) → **tagihan supplier dari PO/BPB** (ERP-0012).
- **URL:** `/procurement/purchase-requests`, `/procurement/purchase-orders`, `/procurement/goods-receipts`, `/procurement/purchase-returns`.

### Persediaan (`product` + `warehouse` + `inventory`) — M05/M06
- **Produk:** master SKU dengan jenis product / component / material, kategori, dan listing website (slug, publish, mode harga list atau rfq).
- **Gudang:**
  - Multi-gudang dengan rak; hanya admin aplikasi yang boleh mengubah.
  - PIC gudang (ADR-0017).
  - Tautan gudang ke organisasi (ADR-0010) masih `proposed`.
- **Inventory:**
  - Ledger `movements` append-only dengan proyeksi `stocks`.
  - Penyesuaian stok dengan approval, nilai persediaan, unit serial.
  - Alat dan aset (`items`): peminjaman, maintenance aset internal, pemeriksaan kondisi, disposal, dan tool set.
- **Matriks status unit serial:** `pre_order, in_stock, lost, sold, applied_warranty, returned, damaged`.
- **URL:** `/products`, `/product-categories`, `/warehouses`, `/inventory/items`, `/inventory/borrowings`, `/inventory/borrowing-requests`, `/stock`, `/stock/adjustments`, `/stock/valuation`. Katalog publik di `/products/public/v1/catalog`.

### Proyek, garansi, lisensi (`project`) — M03/M07
- **Leads:** dari website (`/projects/public/v1/rfq|contact|demo`), WhatsApp, atau input manual → aktivitas → konversi menjadi pelanggan.
- **Proyek:** task, bukti, biaya (hanya terlihat dengan `project:read_cost`), dan BAST/handover. Penutupan proyek butuh bukti function test, training, dan BAST bertanda tangan.
- **Garansi (`project.warranties`):** Surat Keterangan Garansi yang dimulai dari tanggal BAST; tiket memakai data ini untuk cek garansi.
- **Lisensi aplikasi sendiri (ERP-0019):**
  - Kontrak → key `XXXXX-XXXXX-XXXXX-XXXXX` → aktivasi per seat.
  - API mesin `/projects/api/v1/licenses/validate|activate|deactivate`, dengan Bearer `elk_…`, batas 120 panggilan/menit.
  - Masa tenggang 7 hari; perpanjangan aktif otomatis saat invoice lunas.
  - Integrasi ke aplikasi pilot (T24) masih **blocked**.

### Tiket (`ticket`) — M07
- **Alur:** `new → in_progress → resolved → closed`. Penutupan butuh konfirmasi pelanggan, baik oleh staf maupun dari portal.
- Saat tiket dibuat, sistem mengecek garansi lewat serial number.
- Thread pesan punya dua visibilitas: `internal` dan `customer`.
- Tipe tiket sudah mencakup `maintenance` dan `warranty_service`. Template tiket dan sub-tiket masih target.
- Setiap perubahan tiket mengirim event `service_ticket.updated` ke n8n.

### Keuangan (`finance`) — M09
- **Stage 1 (F1-F9) sudah ada:**
  - Bagan akun (COA) dan periode.
  - Jurnal yang wajib seimbang; koreksi hanya lewat reversal.
  - Kas/bank, sub-ledger AR/AP, tagihan supplier.
  - Rekonsiliasi bank dengan gate selisih nol.
  - Laporan laba rugi / neraca / arus kas yang dihitung saat diminta, plus arsip bulanan.
  - Tutup buku; membuka kembali periode terkunci hanya oleh owner.
  - Depresiasi aset.
- **Belum:** beban (ERP-0013), posting payroll, rekonsiliasi gateway, dan **COA final**. Kode akun seperti `1-1300`, `1-1100`, `4-1000` dan `1-1400` masih provisional.

### Pajak (`tax`) — M10
- Tarif berlaku per tanggal efektif, rekap periode (`draft → verified → filed`), koreksi, dan PPh potong. Ekspor CSV/XLSX tersedia.
- Fungsinya sebatas kertas kerja; tidak ada e-filing DJP.
- Tarif masih placeholder (PPN 11%, PPh23 2%, PPh4(2) 10%) dan aturan pembulatannya menunggu keputusan finance.

### SDM (`human_resource`) — M08
- Karyawan dibuat lewat undangan; organisasi sendiri plus level perusahaan.
- Absensi manual atau impor (all-or-nothing). Cuti 12 hari dengan approval, hari Minggu tidak dihitung, cuti yang disetujui otomatis tercatat di absensi.
- Lembur, tugas, dan rekap gaji yang di-approve owner lalu terkunci.
- **Payroll otomatis (ERP-0018/T19) masih blocked** karena aturan komponen gaji belum ada.

### Dokumen (`document`)
- **Registri dokumen terbit** untuk 11 tipe: SPH, SO, invoice, kwitansi, PO, BPB, surat jalan, BAST, garansi, tiket, kontrak lisensi.
- File maks 10 MB (PDF atau gambar). Jejak akses dicatat (view/download/print/share).
- Link publik dengan masa berlaku wajib (default 30, maks 365 hari) dan bisa dicabut.
- Permintaan tanda tangan internal, gambar tanda tangan per user, dan penempatan tanda tangan di PDF (ERP-0048/0049).

### Notifikasi (`notification`) dan realtime
- Lonceng notifikasi di aplikasi, lewat satu WebSocket `/ws` dengan frame `{type,status,sentAt,data}`.
- Producer memanggil `ExportedNotificationService.notify`, yang dijalankan lewat antrean BullMQ.
- Notifikasi yang sudah dibaca dihapus fisik setelah 90 hari. Ini pengecualian sah dari aturan soft delete.

### Otomasi (`automation`) — M04
- **Outbox event bertanda tangan HMAC ke n8n.** Topik event ada di bagian 8.
- **Asisten WhatsApp:**
  - WAHA mengirim pesan masuk ke `/webhooks/whatsapp`.
  - Asisten menjawab dari FAQ dan katalog, menyerahkan chat ke admin bila perlu, dan menolak topik diskon/pembayaran/order/refund.
  - Bisa membuat lead dari chat.
  - Model AI bersifat provider-neutral, tetapi belum pernah dicoba ke provider sungguhan.

### Audit, lokasi, webhook
- **`audit`:** `audit.audit_logs` append-only, dibaca di `GET /admin/audit`.
- **`location`:** pohon wilayah Indonesia dari seed.
- **`webhook`:** pintu masuk provider tanpa database. Hasilnya: 200 untuk accepted/duplicate/ignored, 401 untuk rejected, 404 untuk provider yang tidak dikenal.

### Dihapus atau belum pernah dibangun
- **Investor dan bagi hasil (M11):** dihapus dari kontrak oleh ADR-0024. Kalau dibutuhkan lagi, perlu ADR baru.
- **Reporting dan dashboard:** dashboard memakai data asli lewat komposisi di klien (ERP-0060, `in-progress`). Laporan keuangan ada di `finance`.

---

## 6. Keamanan dan hak akses

Sumber: `security-and-access.md`, ADR-0006/0017/0018.

- **Dua lapis otorisasi (ADR-0006):**
  - `admin()`, lewat `auth.users.role`, hanya untuk administrasi akun.
  - `organization()`, lewat `auth.members.role`, untuk **semua izin bisnis**. Admin global tanpa membership organisasi tidak punya akses ERP.
- **Role ERP adalah enum tertutup** di `packages/common/src/authorization/erp-permissions.ts`. Di kode ada **17 role**; dokumen lama menulis 19 karena masih memuat `investor` dan `customer`. Tidak ada tabel `auth.roles`.
- **App role** (ADR-0018): `customer` (dan dulu `investor`) disimpan di `user.role` dan tidak bisa login ke web-admin.
- **Guard:**
  - `erpGuard` (macro `erp`, dengan header `x-organization-id`).
  - `sessionGuard` untuk `/users/me` dan pembuatan organisasi.
  - `warehouseGuard` untuk PIC gudang.
  - `portal` untuk portal pelanggan.
- **Arti status HTTP:** 401 tanpa sesi; 403 tanpa izin; **404 untuk menyembunyikan keberadaan data** milik pihak lain.
- **Tangga penugasan role (escalation guard):**
  - Hanya owner yang boleh memberi role owner, dan owner terakhir tidak bisa dihapus.
  - Org admin boleh memberi semua role kecuali owner/admin.
  - HR boleh memberi semua role kecuali owner/admin/hr.
  - Aturan ini ditegakkan di tiga lapis: hook Better Auth, guard controller, dan service.
- **Pemisahan tugas:** pembuat tidak boleh menyetujui (SPH, PR, PO, cuti, dll.). Approval berupa UPDATE bersyarat yang atomik.
- **Sesi dan cache:**
  - Sesi disimpan di Redis.
  - `cookieCache` 5 menit, sehingga perubahan role berlaku paling lambat 5 menit.
  - Cache izin di frontend 60 detik.
- **Data sensitif:**
  - Rekening supplier butuh `supplier:read_bank`.
  - Secret gateway pembayaran hanya untuk owner (`payment_gateway:*`).
  - NIK dan rekening karyawan dimasking tanpa `employee:read_private`.
  - Biaya proyek butuh `project:read_cost`.
- **Audit:** `audit.audit_logs` append-only untuk undangan, user, member, organisasi.
- **Aturan penting:** secret tidak pernah di-commit atau dicetak. Log dev mencetak cookie sesi, jadi jangan ditempel ke mana pun.

---

## 7. Konvensi API dan URL

Sumber: `api-conventions.md`, `AGENTS.md`.

**Bentuk respons:**
- `ok` / `created` / `noContent` (200) / `okPaginated`.
- Error berupa `errorEnvelope` yang selalu membawa `errors[]`.
- List memakai query `page` (mulai 1) dan `limit`. Repository memakai method `paginate()` dengan helper `paginationResult`. Hasil kosong memberi `totalPages = 0`.

**Kode error:**

| Kode | Arti |
| --- | --- |
| 400 | Validasi |
| 401 | Tanpa sesi |
| 403 | Tanpa izin |
| 404 | Tidak ada, sudah dihapus, atau disembunyikan |
| 409 | Konflik unik (23505) |
| 422 | Aturan status dilanggar |
| 423 | Terkunci |
| 500 | Tanpa detail internal |

**Prefix per modul:** `/sales`, `/inventory`, `/procurement`, `/finance`, `/taxes`, `/payments`, `/projects`, `/tickets`, `/human-resources`, `/documents`, `/suppliers`, `/customers`, `/companies`, `/products`, `/warehouses`, `/notifications`. Halaman admin berada di bawah `/admin/*`.

**Titik masuk eksternal** (masing-masing satu URL, **tanpa alias**):

| Kegunaan | URL |
| --- | --- |
| Webhook provider | `/webhooks/{xendit,singapay,whatsapp}` |
| License API | `/projects/api/v1/licenses/*` |
| Form website | `/projects/public/v1/*` |
| Katalog publik | `/products/public/v1/catalog/*` |
| Render SPH | `/sales/public/v1/render/quotations/:id` |
| Share dokumen | `/documents/public/v1/shares/:token` (+ `/file`) |
| Portal pelanggan | `/customers/portal/v1/*` |
| Self-service (tanpa prefix) | `/users/me*`, `/invitations/claim/:token`, `/username-availability` |

**Aturan pindah route:** memindah route berarti mengubah backend **dan** web-admin (pemanggilan bertipe, sidebar, `routeTree.gen.ts`) dalam perubahan yang sama.

---

## 8. Integrasi n8n dan WhatsApp

Sumber: `docs/integrations/n8n/`, `automation.md`, user-guide n8n/Meta/WAHA.

**Cara kerja.** Modul bisnis memanggil `OutboxService.publish` setelah data tersimpan. Pesan dikirim ke `POST <N8N_WEBHOOK_URL>` dengan:
- body `{id, topic, occurredAt, aggregate, data}`;
- header `X-Erp-Event-Id`, `X-Erp-Event-Type`, `X-Erp-Timestamp`, `X-Erp-Signature: sha256=…` (HMAC dari `"<timestamp>.<body>"`).

Respons 2xx berarti terkirim. Respons 5xx, 408 atau 429 dicoba ulang 5 kali (mulai 30 detik). Log dan kirim ulang tersedia di `/integrations/webhooks`.

**Workflow `erp-event-router.workflow.json`** (dibangun dari `src/*.js` oleh `build-workflow.ts`):

```
webhook → 1 verifikasi HMAC (tolak > 10 menit) → 2a/2b/2c cegah duplikat (data table erp_processed_events)
→ 3 susun pesan (CONFIG + handler per topik) → 4 kirim WhatsApp (WAHA atau Meta)
→ 5a catat event (hanya kalau terkirim) → 5b selesai → jawab ERP → (opsional) email
```

**`CONFIG` di node 3:**
- Nomor WA per role: `owner`, `salesManager`, `sales`, `operationsManager`, `purchasing`, `warehouse`, `finance`, `support`, `adminOnDuty`.
- `notifyCustomers: false` dan `notifySuppliers: false` secara default. Keduanya baru dinyalakan setelah owner menyetujui teks pesannya.
- `erpUrl` dipakai untuk tautan di pesan.

**13 topik event:**

| Topik | Pemicu | Penerima |
| --- | --- | --- |
| `lead.created` | Lead baru | sales manager |
| `lead.follow_up_due` | Jadwal follow-up lead (hari kerja 08.00) | pemilik lead; terlambat > 3 hari → juga sales manager |
| `quotation.sent` | SPH dikirim (dengan PDF) | pelanggan* dengan lampiran PDF; kalau PDF gagal → sales pembuat |
| `quotation.follow_up_due` | SPH belum dijawab H+3/H+7, H-2 sebelum habis | sales pembuat |
| `invoice.issued` | Invoice terbit | pelanggan*, finance |
| `receipt.recorded` | Pembayaran dicatat | pelanggan* |
| `service_ticket.updated` | Tiket dibuat/ditugaskan/dikerjakan/selesai/dibuka lagi/ditutup | pelanggan*; tiket baru → support |
| `whatsapp.handoff` | Chat WA perlu admin | admin jaga |
| `license.due` | Lisensi H-30/H-7/berakhir | pelanggan*, sales manager |
| `purchase_return.updated` | Retur pembelian | ops manager / gudang / purchasing / PIC pemasok** |
| `sales_return.updated` | Retur penjualan | sales manager / gudang / sales / pelanggan* |
| `supplier_bill.recorded` | Tagihan pemasok dicatat | finance (WA + email) |
| `supplier_bill.due` | Tagihan H-7 / hari ini / lewat | finance; lewat jatuh tempo → juga owner |

\* hanya kalau `notifyCustomers: true`; \*\* hanya kalau `notifySuppliers: true`.

**Job terjadwal** (BullMQ, hanya kalau `SCHEDULER_ENABLED=true`):
- `licensing-due` (harian 08.00 WIB);
- `lead-follow-up` dan `quotation-follow-up` (Senin-Jumat 08.00);
- `supplier-bill-due`;
- `quotation-sent` (bukan cron, berjalan setiap kali SPH dikirim).

**Dua provider WhatsApp** (pilih lewat `WHATSAPP_PROVIDER`):

| | WAHA (default) | Meta Cloud API |
| --- | --- | --- |
| Jenis pesan | Teks bebas (`/api/sendText`, lampiran lewat `/api/sendFile`) | Hanya template yang sudah APPROVED |
| Risiko / biaya | Tidak resmi; nomor bisa diblokir | Resmi; biaya per pesan (perkiraan ±US$0,025 per pesan utility + PPN) |
| Template | – | 20 template UTILITY bahasa `id` di `meta-templates.json`. `erp_penawaran_terkirim` punya header PDF dan harus dibuat manual di WhatsApp Manager |
| Asisten chat masuk | Ada | **Belum dibangun** |

**Skrip bantu:**
- `send-test-event.ts`: kirim event uji yang ditandatangani. Opsi `--bad-signature` harus menghasilkan 401; opsi `--repeat` harus menghasilkan "duplicate".
- `check-meta-templates.ts`: harus mencetak `OK`.
- `create-meta-templates.ts`: punya opsi `--dry-run`.
- `samples.ts`: contoh data event.

Semua sudah diuji dengan n8n 2.47.7 dan WAHA/Graph tiruan, **belum dengan nomor sungguhan**.

**Panduan pengguna:** `docs/user-guide/n8n-workflows.{id,en}.md`, `whatsapp-business-meta.{id,en}.md` (cara daftar Meta), `whatsapp-n8n-setup.{id,en}.md` (WAHA + AI).

---

## 9. Status pekerjaan

### 9.1 Backlog (`docs/plan/backlog.md`, 89 baris)

| Status | Jumlah | Contoh |
| --- | --- | --- |
| implemented | 40 | ERP-0011 penjualan, ERP-0012 hutang, ERP-0022 portal tahap 1, ERP-0048 tanda tangan, ERP-0063 PR, ERP-0065/0068 retur, ERP-0066/0067 follow-up dan PDF, ERP-0092 penomoran |
| in-progress | 29 | ERP-0070..0091 refactor DB dan frontend, ERP-0016 pajak, ERP-0019 lisensi, ERP-0020 gateway, ERP-0024 UAT, ERP-0060 dashboard |
| planned | 12 | ERP-0010 fondasi akuntansi, ERP-0013 beban, ERP-0017 tutup periode, ERP-0018 payroll, ERP-0023 investor portal, ERP-0025 rilis, ERP-0061 audit feed |
| verified | 5 | ERP-0047 notifikasi, ERP-0051 sidebar per role, ERP-0052 migrasi, ERP-0054 parity dbml, ERP-0062 |
| proposed | 3 | ERP-0031 tautan gudang-organisasi, ERP-0032 transfer stok, ERP-0033 |
| accepted | **0** | Belum ada persetujuan bisnis untuk apa pun |

**Nomor ganda yang perlu dibereskan:**
- **ERP-0039** dipakai untuk undangan organisasi *dan* M04 tahap 1.
- **ERP-0063** dipakai untuk purchase request *dan* tampilan kartu inventory.
- **ERP-0092** di main berarti pengaturan penomoran, tetapi rencana port portal memakainya untuk "ticket thread".
- **ERP-0050, ERP-0055..0058, ERP-0059** dirujuk di dokumen tetapi tidak ada di backlog.

### 9.2 Pekerjaan terakhir (`progress.md`, bagian atas)

1. **2026-11-21, ERP-0092:** halaman pengaturan penomoran dipulihkan untuk 14 modul, plus token `{ORG}`.
   - Test: backend 1315, web-admin 144, locales 106, portal 60, landing 24.
   - Belum dicek di browser.
2. **ADR-0026:** `product` dan `warehouse` menjadi schema/modul sendiri (tanggal entrinya tertulis 2026-11-23).
3. **Refactor `paginate()`:** tiga bug filter ganda diperbaiki.
4. **2026-11-21:**
   - migrasi dipecah per schema;
   - web-admin memakai komponen `@ims-erp/ui` + DataTable (ADR-0025);
   - tangga role di dialog undangan.
5. **2026-11-20:** `docs.dbml` disejajarkan dengan Drizzle, smoke API (69 GET), rencana port portal.

**Next executable task** (entri teratas):
- walk-through browser `/settings/code-numbers`;
- meneruskan `organizationId` ke ±40 pemanggil `numbering.next` agar `{ORG}` berlaku di semua tipe kode.

Bagian `## Next executable task` di **akhir** file sudah usang.

### 9.3 Fase proyek (`docs/plan/phases/`)

| Fase | Isi | Keadaan |
| --- | --- | --- |
| 1 | Audit repo, set dokumen | Selesai (ERP-0001 housekeeping masih planned) |
| 2 | Auth + slice customer | Implemented; test integrasi PostgreSQL nyata belum ada |
| 3 | Master data, COA, opening balance | Sebagian; COA/opening (ERP-0010) planned |
| 4 | Penjualan, pembelian, akuntansi | Penjualan dan pembelian implemented; posting engine dan beban planned |
| 5 | Laporan, pajak, tutup buku | Pajak in-progress; sisanya planned |
| 6 | Payroll, langganan, portal | Portal dan WA implemented; payroll dan investor planned |
| 7 | UAT, rilis | Skrip UAT ditulis, **belum dijalankan** |

### 9.4 UAT (`docs/plan/uat/`)

Ada skrip untuk M02 (13 kasus), M03 (11), M04 (11), M05 (11), M07 (9) dan M08 (10). Semua ditulis 2026-11-12 dan **belum ada satu pun yang dijalankan**; tabel tanda tangan masih kosong. Beberapa kasus ditandai "N/T" (tidak diuji) karena fiturnya dulu belum ada, misalnya gateway dan portal. Sekarang fitur itu sudah ada, jadi skrip perlu diperbarui.

### 9.5 Rencana port portal (`docs/plan/port-portal-onto-main.md`)

Pekerjaan portal tahap 2 dan website dinamis ada di branch `feat/erp-0069-portal-session`, ditulis sebelum refactor database. Pekerjaan ini **di-port per slice** ke branch baru dari main; tidak di-merge langsung (merge langsung menghasilkan 91 konflik).

**Keputusan D1-D11:**

| D | Keputusan |
| --- | --- |
| D1 | Schema baru `website` (perlu ADR) |
| D2 | Cart dan wishlist di `customer` |
| D3 | Pengaturan login portal sebagai kolom di `customer.customers` |
| D4 | Akun portal = `company_id` atau `customers.id` individu |
| D5 | Lokasi instalasi + PIC (opsi belum diputuskan) |
| D6 | Permintaan perubahan data perusahaan + kolom `industry` |
| D7 | RFQ website ditautkan ke akun |
| D8 | Kurir dan nomor resi di surat jalan |
| D9 | Lampiran tiket |
| D10 | Sesi portal pakai cookie yang dipegang server + role `customer` |
| D11 | Dafrin memport, Oki me-review PR yang mengubah schema |

**Penomoran ulang:** nomor ERP-0069..0081 di branch lama menjadi ERP-0094..0106. ADR portal menjadi ADR-0027, ADR website menjadi ADR-0028.

**Langkah:**

| Langkah | Isi | Nomor | Keadaan |
| --- | --- | --- | --- |
| P1 | Sesi + keamanan | ERP-0094, ERP-0106 | PR #139, sedang direview |
| P2 | Halaman akun | | |
| P3 | Pemesanan dan pembayaran | | |
| P4 | Tracking | | |
| P5 | Dokumen dan notifikasi | | |
| P6 | Thread tiket dan lampiran | | |
| P7 | Website dinamis | | |

---

## 10. Daftar ADR (keputusan arsitektur)

| ADR | Judul | Status di file | Inti keputusan | Catatan |
| --- | --- | --- | --- | --- |
| 0001 | Model organisasi | accepted | Satu perusahaan, banyak organisasi internal, tanpa kolom tenant | Diperbarui 0007 |
| 0002 | Uang | accepted | `bigint` minor unit IDR, tidak pernah float | Masih berlaku |
| 0003 | Alamat Indonesia | accepted | Alamat terstruktur dari seed wilayah | Sekarang hanya `village_id` (Q10) |
| 0004 | Drizzle Relational v2 | accepted | Hanya v2; v1 dilarang | Versi dan path di file lama |
| 0005 | Drizzle client NestJS | superseded | – | Era NestJS |
| 0006 | Otorisasi dua lapis | accepted | `admin()` vs role organisasi | Diubah 0018 |
| 0007 | Multi-organisasi | accepted | Banyak organisasi; master data company-wide | – |
| 0008 | Inventory organisasi nullable | accepted | `organization_id` NULL = global; pasangan partial unique; ledger append-only | Nama tabel lama; bagian satu-schema diganti 0026 |
| 0009 | Unit berserial + custody peminjaman | accepted | Status unit, peminjaman, serial provisional | Nama tabel lama |
| 0010 | Organisasi = departemen + tautan gudang | **proposed** | Akses gudang lewat tautan organisasi | Masih menunggu |
| 0011 | Merge branch M02/M05/M07 ke main | accepted | Satu item master, `uuidv7` | Historis |
| 0012 | Multi-organisasi + master company-wide | accepted | Dokumen menyimpan organisasi penerbit | **Ada dua file ADR-0012**; versi "single organization" superseded |
| 0013 | Satu otoritas penomoran | accepted | `NumberingService` pusat | **Diganti ADR-0024** (penomoran per schema), belum ditandai di file |
| 0014 | Referensi lintas modul nullable | accepted | Semua referensi lintas modul nullable + kontrak `assert*` | Inti aturan sekarang |
| 0015 | Pecah company/document/code_number | accepted | – | `code_number` dihapus 0024 |
| 0016 | Notifikasi + satu socket `/ws` | accepted | Schema `notification`, BullMQ | Masih berlaku |
| 0017 | PIC gudang + login gate | accepted | `warehouse_managers`, `warehouseGuard` | Masih berlaku |
| 0018 | Investor/customer sebagai app role | **proposed** (sudah dibangun) | Keluar dari role ERP | Status perlu dinaikkan |
| 0019 | Baseline migrasi per schema (lama) | accepted | 19 migrasi per schema lama | Diganti baseline 0024 |
| 0020 | Event outbox ke n8n; WhatsApp lewat WAHA | proposed | HMAC-SHA256, retry, n8n sebagai mesin | Dipakai di produksi kode |
| 0021 | Payment gateway netral provider | proposed | Port `IPaymentGateway`; hanya webhook terverifikasi mengubah status | §1 diganti 0023 |
| 0022 | Portal pelanggan | proposed | Satu login per kontak, `/portal/v1` | Sekarang `/customers/portal/v1` di modul `customer` |
| 0023 | Modul payment memiliki checkout gateway | accepted | `IInvoicePaymentPort` | Sebagian diganti 0024 |
| 0024 | Normalisasi database baseline v2 | **proposed** (sudah dibangun) | 18 schema, tanpa FK lintas schema, penomoran per schema | Status perlu dinaikkan |
| 0025 | TanStack Table untuk web-admin | accepted | Satu komponen `DataTable` | Baru |
| 0026 | Product dan warehouse jadi modul sendiri | accepted (tertulis 2026-11-23) | 20 schema / 196 tabel | Tanggal di file lebih maju dari hari ini |

Nomor berikutnya yang dipesan rencana port: **ADR-0027** (sesi portal, di PR #139) dan **ADR-0028** (website). Sebelum memakai nomor ADR atau ERP baru, **cek dulu main, semua branch, dan PR yang masih terbuka**. Tabrakan nomor sudah terjadi berkali-kali.

---

## 11. Cara kerja: gate, migrasi, test, perintah

**Sebelum mengubah modul:**
1. Baca skill backend yang relevan.
2. Lakukan Gate 1 (baca `docs/database/`) dan Gate 2 (grill desain).
3. Cek nomor ERP/ADR di main, semua branch, dan PR terbuka.

**Perintah yang sudah terverifikasi:**

| Perintah | Lokasi | Keterangan |
| --- | --- | --- |
| `bun install` | root | – |
| `bun run dev` | root | Turbo; backend `bun run --watch src/index.ts` |
| `bun run lint` / `test` / `typecheck` | root | Test 7/7 workspace. **Typecheck root tidak mencakup web-admin**; jalankan `cd apps/web-admin && bunx tsc -p tsconfig.app.json --noEmit`. Aplikasi Astro dicek dengan `astro check` |
| `bun run drizzle:generate` / `drizzle:migrate` / `drizzle:seed` | `apps/backend` | Selalu `bunx --bun drizzle-kit` (`--bun` wajib) |
| `bun run database/migrate-reset.ts` | `apps/backend` | Drop semua schema, migrate, seed — hanya untuk database lokal yang boleh dibuat ulang |
| `bun docs/database/gen-logical-references.ts` / `validate-dbml.ts` | root | `validate-dbml.ts` harus mencetak `OK` |

**Migrasi:**
- Baseline ADR-0024 berupa **satu folder per schema**: 20 folder, dari `20261123204301_create_auth_schema` sampai `20261123204332_create_warehouse_schema` (re-squash 2026-11-24; 176 `CREATE TABLE`, 20 tabel `docs.dbml` masih target-only).
- Migrasi baru bersifat append-only, SQL-nya diperiksa manual, dan diuji di database lokal yang boleh dibuat ulang.
- `drizzle-kit push` hanya untuk database yang boleh dibuat ulang.
- **Jangan pernah** `generate --fix-conflicts`.
- **Jangan pernah** `auth:generate`.

**Test:**
- Backend memakai `bun test`. DB dan Redis selalu di-mock; preload `reflect-metadata` wajib.
- **Belum ada** test integrasi ke PostgreSQL nyata maupun test e2e.
- Cakupan wajib per slice: otorisasi, kepemilikan data, validasi 400, tulis sukses + evict cache, soft delete, race 23505 → 409, satu query Relational v2 nyata, integritas migrasi.
- Pre-commit hook (husky) menjalankan lint + test.

**Smoke script** (backend di :3001): `smoke-admin-api.ts`, `smoke-cache-invalidation.ts`, `smoke-login-gate.ts` (wajib pakai database sekali pakai), `smoke-warehouse-pic.ts`.

**Docker:**
- Compose berisi postgres, redis, backend, web-admin, web-landing, web-customer-portal.
- `docker-compose.local.yml` untuk build dari source.
- Chromium untuk PDF SPH **belum** dimasukkan ke image backend.

---

## 12. Dokumen usang dan kontradiksi

Daftar ini hasil pembacaan menyeluruh pada 2026-11-21. Urutannya dari dampak terbesar. **Bagian A sudah diperbaiki 2026-11-24; bagian B dan seterusnya belum.**

### A. Angka dan struktur setelah ADR-0026 — ✅ diperbaiki 2026-11-24
- Angka schema/tabel diseragamkan ke **20 schema / 196 tabel** (hasil `bun docs/database/validate-dbml.ts`: 196 tabel, 153 `Ref:` intra-modul, 189 kolom referensi logis, 25 target) di `AGENTS.md`, `README.md`, `docs/architecture/*`, `docs/architecture/modules/README.md`, `docs/database/*`, dan `features.md` (catatan di kepala file; entri historis ERP-0070 tidak diubah).
- `product` dan `warehouse` sekarang didokumentasikan sebagai modul + schema sendiri (ADR-0026): `modules/product.md`, `modules/warehouse.md`, `modules/inventory.md` ditulis ulang; `architecture.md`, `domain-map.md`, `data-model.md` diperbarui.
- `AGENTS.md` tidak lagi mengklaim arsip `database/migrations-archive/v3-per-schema-20261121` (yang ada hanya `v1`) dan memakai angka 176 `CREATE TABLE` (bukan 164/168).
- Istilah "disposable database" diganti "local/throwaway database you can drop and recreate" di `AGENTS.md`, `README.md`, `runbook.md`, `data-model.md`, `project-audit.md`, `testing-strategy.md`, `integrity-and-consistency.md`, `implementation-phases.md`, dan halaman modul. `migrate-reset.ts` + `drizzle:migrate-reset` tetap ada.

### B. URL lama
- **Katalog** ditulis `/inventory/public/v1/catalog` di `api-conventions.md`, `modules/automation.md`, `modules/inventory.md`, dan `database-refactor/*`. Yang benar `/products/public/v1/catalog`.
- **Portal** ditulis `/portal/v1` di ADR-0022, `features.md`, `website-integration.md`. Yang benar `/customers/portal/v1`.
- **Lisensi** ditulis `/licensing/v1` di `features.md` dan UAT M03. Yang benar `/projects/api/v1/licenses`.
- **Share dokumen** ditulis `/public/v1/...` di `features.md` dan `samples.ts` (n8n). Yang benar `/documents/public/v1/shares/...`.
- **Route lama lainnya:**
  - `/company` di `modules/company.md`; yang benar `/companies`.
  - `/tax/*` di `modules/tax.md`; yang benar `/taxes`.
  - `/purchase-requests` di `modules/purchasing.md`; yang benar `/procurement/purchase-requests`.
  - Route keuangan tanpa prefix di `modules/finance.md`; yang benar `/finance/*`.
  - `/hr/*`; yang benar `/human-resources`.
  - `/gateway-payments` di `modules/sales.md`; yang benar `/payments`.
- **Alias URL:** `features.md` dan beberapa file `database-refactor/modules/*` masih menyebutnya, padahal Q34 memutuskan tanpa alias.

### C. Modul atau konsep yang sudah dihapus tapi belum ditandai
- **ADR lama tanpa catatan superseded:** ADR-0013 (penomoran pusat), ADR-0015 (`code_number`), ADR-0019 (daftar schema lama), ADR-0022 (`portal_identities`, `aftersales`).
- **Investor** masih muncul di `domain-map.md`, `security-and-access.md`, `api-conventions.md`, `testing-strategy.md`, `phases/phase-6`, dan backlog ERP-0023. Modulnya sudah dihapus.
- **Role:** `security-and-access.md` mendaftar 19 role (termasuk investor dan customer); di kode ada 17.
- **Topik event dan nama modul:**
  - `modules/ticket.md` menyebut topik `ticket.*`; di kode `service_ticket.updated`.
  - `modules/automation.md` menyebut penerbit "CRM / After-sales / Licensing".
- **Isi era NestJS tanpa label deprecated:** `authentication.md`, `infrastructure.md`, sebagian `user.md`. `authentication.md` bahkan menyuruh `auth:generate`, padahal **dilarang**.
- **Lain-lain:**
  - `modules/organization.md` terpotong (heading terakhir tanpa isi).
  - `diagrams.md` (user-guide) masih memakai modul `crm`, `aftersales`, `code_number`.

### D. Stack dan arsitektur
- **Driver dan cache:**
  - `stack-compatibility.md` menyebut driver `pg`; yang benar `drizzle-orm/bun-sql`.
  - Keyv disebut di beberapa dokumen; yang benar Bun `RedisClient`.
  - Vitest disebut; yang benar `bun test`.
- **Struktur kode:**
  - `architecture.md` / `api-conventions.md` menyebut folder `routes|controllers`; yang benar **controllers saja**.
  - Client diambil dari `drizzle/container.ts`; yang benar token `DRIZZLE_TOKEN` di `src/di/tokens.ts`.
- **Konvensi:**
  - `data-model.md` menulis ID `text` nanoid; tabel bisnis memakai `uuid` `uuidv7()`.
  - `api-conventions.md` menulis "204/200" untuk no-content; yang benar selalu 200.
  - `testing-strategy.md` menulis test frontend "not established", padahal web-admin, landing dan portal sudah punya test.

### E. Status dan tanggal
- **ADR-0018 dan ADR-0024** masih `proposed` padahal sudah dibangun.
- **Tanggal di masa depan:** ADR-0026 dan entri progress bertanggal 2026-11-22/23.
- **"Next executable task" ganda:** bagian bawah `progress.md` berbeda dengan entri teratas.
- **Rencana yang tertinggal dari kode:**
  - `database-refactor/00-overview.md` masih "Status: planned".
  - Bagian "Current state" di `erp-module-plans/m02..m10` masih menulis "planned / nothing exists".
  - UAT M02/M05/M07 masih menandai gateway, portal dan hutang "belum ada".
- **User guide:**
  - Panduan utama masih menyebut branch `merge/main-sync` "belum digabung".
  - Bagian keterbatasannya menyebut retur dan hutang pemasok belum ada; keduanya sudah ada.
  - Panduan WA/n8n masih menulis "10 topik"; sekarang 13.
- **Harga:** `plan.md` menulis Rp12 juta, sedangkan `erp-plan-{en,id}.md` menulis Rp15 juta.
- **Nomor ERP ganda:** ERP-0039, ERP-0063, ERP-0092 (lihat 9.1).

### F. Modul hidup yang belum punya halaman dokumen terkini
`location`, `audit`, `procurement`, `payment`, `product`, `warehouse`, `organization`. Halaman yang ada untuk kelompok ini berlabel deprecated atau menunjuk ke `inventory`.

---

## 13. Glosarium

| Istilah | Arti |
| --- | --- |
| SPH | Surat Penawaran Harga = quotation (`sale.quotations`) |
| SO | Sales order (`sale.orders`) |
| Surat jalan | Delivery note (`sale.delivery_notes`) |
| Kwitansi | Bukti pembayaran (`sale.receipts`) |
| DP | Down payment / uang muka, dicatat sebagai liabilitas sampai barang dikirim |
| PR / PO | Purchase request / purchase order |
| BPB | Bukti Penerimaan Barang = goods receipt |
| BAST | Berita Acara Serah Terima = handover proyek; awal masa garansi |
| HPP | Harga Pokok Penjualan; dihitung moving average |
| SN | Serial number (`inventory.item_serials`) |
| PIC | Person in charge (penanggung jawab) |
| COA | Chart of accounts / bagan akun |
| DJP | Direktorat Jenderal Pajak (tidak ada integrasi e-filing) |
| Outbox | Tabel event yang menunggu dikirim ke n8n (`automation.outbox_messages`) |
| WAHA | WhatsApp HTTP API (self-hosted, tidak resmi) |
| Meta Cloud API | WhatsApp Business resmi dari Meta |
| Target table | Tabel yang sudah ada di `docs.dbml` tapi belum dibangun (`status: target`) |
| Gate 1 / Gate 2 | Wajib baca `docs/database/` / wajib grill desain sebelum menulis kode |
| Programmer A / B | Pembagian kerja di backlog (`backlog.md` baris 14). Modul M02/M03/M04/M05/M07/M08 tercatat milik B |
| ADR | Architecture Decision Record (`docs/architecture/decisions/`) |
