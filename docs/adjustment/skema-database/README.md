# Skema database (konsep saat ini)

Kembali ke [catatan penyesuaian](../README.md). Ringkasan berbahasa Indonesia
untuk setiap schema PostgreSQL: tabel, relasi, alur data, penomoran, temuan,
dan perubahan mendatang.

**Sumber resmi tetap `docs/database/docs.dbml`.** Bila catatan ini berbeda
dengan `docs.dbml`, yang benar adalah `docs.dbml`. Disusun 2026-11-26 dari
pembacaan `docs.dbml`, skema Drizzle, migrasi (41, termasuk PostGIS), dan
service backend.

## Aturan umum (ADR-0014, ADR-0024, ADR-0026)

- **20 schema, satu per modul.** Pengecualian: modul `user` dan
  `organization` sama-sama di schema `auth` (milik Better Auth); modul
  `webhook` tidak punya schema.
- **Referensi lintas modul** berupa kolom id biasa yang boleh kosong, tanpa
  foreign key. Keberadaan datanya dicek service pemilik (`resolve*`/`assert*`).
- **Foreign key sungguhan** hanya di dalam satu schema.
- **Waktu** dalam unix milidetik; **uang** dalam rupiah sen (bilangan bulat);
  **hapus** selalu soft delete (`deleted_at`).
- **Penomoran per schema**: setiap schema punya tabel `code_numberings` sendiri.

## Daftar schema

| Schema | Modul | Programmer | File |
|---|---|---|---|
| `auth` | Pengguna, organisasi, role, sesi (Better Auth) | Oki (M12) | [auth.md](auth.md) |
| `location` | Wilayah Indonesia | inti | [location.md](location.md) |
| `company` | Profil perusahaan | Oki (M12) | [company.md](company.md) |
| `customer` | Pelanggan, kontak, alamat, akun portal | Dafrin (M02) | [customer.md](customer.md) |
| `supplier` | Pemasok dan kontak | Dafrin (M05) | [supplier.md](supplier.md) |
| `product` | Produk, komponen, material, kategori | Dafrin (M05) | [product.md](product.md) |
| `warehouse` | Gudang, rak, penanggung jawab | Dafrin (M05) | [warehouse.md](warehouse.md) |
| `inventory` | Stok, mutasi, nomor seri, penyesuaian, peminjaman | Dafrin (M05) + Oki (M06 aset) | [inventory.md](inventory.md) |
| `sale` | SPH, SO, surat jalan, invoice, kuitansi, retur | Dafrin (M02) | [sale.md](sale.md) |
| `procurement` | PR, PO, penerimaan, retur pembelian | Dafrin (M05) | [procurement.md](procurement.md) |
| `project` | Lead, proyek, BAST, garansi, lisensi, absensi lokasi | Dafrin (M02/M03/M07) | [project.md](project.md) |
| `ticket` | Tiket servis | Dafrin (M07) | [ticket.md](ticket.md) |
| `human_resource` | Karyawan, absensi, cuti, lembur, gaji, tugas | Dafrin (M08) + Oki (gaji/PPh 21) | [human_resource.md](human_resource.md) |
| `automation` | Outbox n8n, WhatsApp, FAQ, katalog website | Dafrin (M04) | [automation.md](automation.md) |
| `finance` | Akun, jurnal, periode, piutang/utang, kas/bank, aset tetap, anggaran | Oki (M09) | [finance.md](finance.md) |
| `tax` | Kode/tarif pajak, PPh 21, pemotongan, Coretax | Oki (M10) | [tax.md](tax.md) |
| `payment` | Gateway pembayaran (Xendit/SingaPay) | inti | [payment.md](payment.md) |
| `document` | Register dokumen, template, tanda tangan | inti | [document.md](document.md) |
| `notification` | Template dan kiriman notifikasi | inti | [notification.md](notification.md) |
| `audit` | Log audit | inti | [audit.md](audit.md) |

Catatan lama tentang letak skema dan hal yang membingungkan (S1–S6) ada di
[`../uat-modul/catatan-skema-dan-alur.md`](../uat-modul/catatan-skema-dan-alur.md).
