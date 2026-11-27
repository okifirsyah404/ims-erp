# Catatan: skema, alur, dan hal yang membingungkan

Kembali ke [README](README.md). Dicatat 2026-11-24 saat menyiapkan UAT modul
programmer B. Tujuannya supaya hal-hal yang membingungkan tidak hilang dan
bisa diputuskan: perbaiki, ganti nama, atau terima.

## 1. Di mana membaca skema dan alur

| Kebutuhan | File |
|---|---|
| Skema database (acuan utama) | `docs/database/docs.dbml`. Cari bagian modul dengan `grep -n "^// MODULE:" docs/database/docs.dbml` |
| Skema di kode | `apps/backend/drizzle/schemas/<schema>.schema.ts` |
| Modul pemilik tiap schema | `docs/database/module-ownership.md` |
| Hubungan antar-modul | `docs/database/logical-references.md` |
| Diagram alur per role (terbaru) | [diagram-alur-per-role.md](diagram-alur-per-role.md) |
| Diagram alur lama | `docs/user-guide/diagrams.md` (dihapus 2026-11-28, ada di riwayat git) |
| Panduan pemakaian (Indonesia) | `docs/user-guide/id.md` (dihapus 2026-11-28, ada di riwayat git), bagian 4–8 |
| Panduan n8n dan WhatsApp | `docs/integrations/n8n/guide-workflows.id.md`, `whatsapp-n8n-setup.id.md`, `whatsapp-business-meta.id.md` |
| Langkah uji per modul | folder ini (`uat-modul/`) |

### Dokumen lain yang membahas role (bukan diagram per role)

| Dokumen | Penulis (git) | Isi yang terkait |
|---|---|---|
| `docs/architecture/decisions/ADR-0006-two-layer-authorization.md` | Oki, 2026-10-29 | Dua lapis otorisasi (admin aplikasi vs role organisasi); larangan menyetujui sendiri dijalankan di service |
| `docs/architecture/security-and-access.md` | Oki | Maksud tiap role; "no self-approval regardless of roles" |
| `docs/architecture/decisions/ADR-0017-warehouse-person-in-charge.md` | Oki | Akses penanggung jawab gudang |
| `docs/architecture/decisions/ADR-0018-investor-customer-app-roles.md` | Oki | Role aplikasi investor dan customer |
| `docs/architecture/role-permission.md` | Oki, 2026-11-23 (sebagian dibuat skrip) | Tabel role, hak, dan guard tiap endpoint; tanpa alur |
| `docs/user-guide/diagrams.md` | programmer B + Claude, 2026-11-06 | Diagram alur dengan aktor umum; sebagian usang |
| `docs/user-guide/id.md` bagian 2 (dihapus 2026-11-28) | programmer B (+ Oki) | Tabel peran ringkas; sebagian usang (menulis Pemilik menyetujui PO, padahal sekarang Manajer Operasional) |

## 2. Peta schema untuk modul programmer B

| Modul | Schema dan tabel utama |
|---|---|
| M05 | `product.products`; `warehouse.warehouses` → `warehouse_storages` (rak); `supplier.suppliers`; `procurement.purchase_requests` → `purchase_orders` → `goods_receipts` → `purchase_returns`; `inventory.movements`, `inventory.stocks`, `inventory.item_serials`, `inventory.stock_adjustments` |
| M02 | `project.leads`; `customer.customers` / `customer.companies`; `sale.quotations` → `sale.orders` → `sale.delivery_notes` / `sale.invoices` → `sale.receipts`; `sale.returns` |
| M07 | `project.projects` (merujuk `sale.orders`) → `tasks`, `evidence`, `costs`, `handover` (BAST), `warranties`; `ticket.tickets` → `ticket_messages` |
| M03 | `project.license_applications` → `license_contracts` → `license_keys` → `license_activations`; `license_events`, `license_api_keys` |
| M08 | `human_resource.employees` → `attendances`, `leave_requests`, `overtime_requests`, `employee_salaries` / `employee_salary_records`, `employee_tasks` |
| M04 | `automation.outbox_messages`, `faq_entries`, `whatsapp_conversations` → `whatsapp_messages`; kolom katalog (`slug`, `is_published`) di `product.products` |

## 3. Hal yang membingungkan

### Skema

| No | Hal | Penjelasan | Keputusan |
|---|---|---|---|
| S1 | Lead dan lisensi disimpan di schema `project` | Nama schema tidak sama dengan menu. Lead tampil di menu CRM, lisensi di menu Langganan & Lisensi, tapi tabelnya ada di `project` | |
| S2 | Stok tidak disimpan di dokumen | BPB, surat jalan, retur, dan penyesuaian hanya membuat baris `inventory.movements`. Saldo per barang/gudang/rak (dan HPP) ada di `inventory.stocks` | |
| S3 | Penomoran tersebar | Setiap schema punya tabel `code_numberings` sendiri (QT, SO, SJ, INV, KW, PR, PO, BPB, RTB, RTJ, ADJ, …). Tidak ada satu tempat pengaturan nomor | |
| S4 | Hubungan antar-modul tanpa foreign key | Contoh: `sale.quotations.customer_id` → `customer.customers`, hanya kolom id biasa (ADR-0014). Datanya diperiksa di kode, jadi tidak terlihat sebagai garis relasi di database | |
| S5 | Barang ada dua tabel | `product.products` = barang dagangan, komponen, material. `inventory.items` = unit alat/aset (wilayah M06) | |
| S6 | Tabel ada tapi tidak dipakai | `sale.discount_requests`, `sale.contracts`, `sale.targets`, serta sebagian tabel `project` (phases, milestones, daily_reports, kpi_*, work_plans) ada di skema, tapi belum masuk alur UAT | |

### Alur dan tampilan (dari pemetaan kode)

| No | Hal | Keputusan |
|---|---|---|
| A1 | PO yang disetujui harus **ditandai terkirim** dulu sebelum bisa diterima gudang (petunjuk ditambahkan 2026-11-24) | |
| A2 | Halaman Barang/Produk dan Gudang hanya untuk **admin aplikasi**; role Pembelian tidak bisa membukanya | |
| A3 | Pembuat dokumen tidak bisa menyetujui dokumennya sendiri, termasuk Pemilik. Pengecualian: penyesuaian stok bisa disetujui pembuatnya sendiri. Pengecualian ini **disengaja** di kode (`adjustment.controller.ts`: "documented bypass", ada test-nya, dibuat 2026-11-03), tapi bertentangan dengan ADR-0006 butir 6 dan `docs/architecture/security-and-access.md:238` ("No self-approval … regardless of roles"). Perlu keputusan: ikuti ADR, atau ubah ADR (arahan Pemilik 23/11 justru mengizinkan Pemilik menyetujui dokumennya sendiri dengan audit) | |
| A4 | Sales order tidak pernah jadi Terkirim/Selesai, walaupun semua barang sudah dikirim | |
| A5 | Menu Uang Muka tidak bisa dibuka siapa pun | |
| A6 | Menu tidak cocok dengan hak di server: Webhook n8n hanya untuk Pemilik; WhatsApp AI tidak tampil untuk Layanan Pelanggan; Validasi & Aktivasi lisensi tidak tampil untuk Sales; Nilai Persediaan tampil untuk Gudang tapi datanya ditolak | diperbaiki 2026-11-24 |
| A7 | Nama menu dan judul halaman berbeda: Prospek/Lead, Faktur/Invoice, Kuitansi/Kwitansi; status lead Menang/Kalah, status SPH Deal/Batal | |
| A8 | Invoice draf sudah bernomor; kalau di-void, nomornya terpakai | |
| A9 | Daftar kontrak lisensi tidak ada di menu samping | diperbaiki 2026-11-24 |
| A10 | Gudang tidak bisa membuka PO atau SO yang ditautkan dari BPB/surat jalan | |
| A11 | Nomor seri di penerimaan barang tertulis opsional, padahal wajib sebanyak qty | diperbaiki 2026-11-24 |

## 4. Diagram `docs/user-guide/diagrams.md` yang usang

Diagram itu dibuat 2026-11-06, sebelum refactor schema (ADR-0024/0026) dan
sebelum beberapa fitur ditambahkan. Yang perlu diperbarui:

| Bagian | Masalah |
|---|---|
| 1 dan 3 (alur pembelian) | Belum ada permintaan pembelian (PR) dan retur pembelian |
| 1 dan 2 (alur penjualan) | Belum ada lead, retur penjualan, dan pembayaran gateway |
| 5 (status invoice) | Tertulis "create (unnumbered)"; sekarang draf langsung bernomor |
| 5 (status BAST) | Tertulis "numbered on creation"; sekarang bernomor saat "Terbitkan BAST" |
| 5 (unit berseri) | Belum ada status dikembalikan (retur pembelian) dan rusak (retur penjualan) |
| 6 (komponen modul) | Masih memakai modul lama yang sudah dihapus (`crm`, `aftersales`, `code_number`, `organization`). Sekarang: `customer`, `ticket`, penomoran per modul, `company` |
| Tidak ada | M03 lisensi, M08 karyawan/cuti/gaji, M04 n8n/WhatsApp |

Status: versi pengganti ada di [diagram-alur-per-role.md](diagram-alur-per-role.md). File lama belum diubah karena ada di folder bersama.
