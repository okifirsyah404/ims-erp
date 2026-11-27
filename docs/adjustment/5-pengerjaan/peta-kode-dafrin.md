# Peta kode pekerjaan Dafrin (programmer B)

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Tujuan:** untuk setiap paket langkah 7 dan setiap tugas prioritas **Tinggi**
milik Dafrin, peta ini menyebut perilaku target ("Seharusnya"), keadaan kode
sekarang dengan bukti `path:baris`, file yang harus disentuh, perlu tidaknya
migrasi, test, dan cek UAT. Sumber tugas:
[`rencana-langkah-7.md`](../4-rencana-kerja/rencana-langkah-7.md),
[`rencana-perubahan.md`](../4-rencana-kerja/rencana-perubahan.md),
[`peta-halaman.md`](../4-rencana-kerja/peta-halaman.md), dan rancangan di
`3-rancangan/`.

**Cara pakai:**
1. Cari ID tugas di indeks, lalu buka bagiannya.
2. Buka **hanya** file yang ada di tabel "File yang diubah". Path relatif dari
   root repo. Baris yang disebut dicek 2026-11-28 dan bisa bergeser.
3. "(baru)" = file belum ada; path-nya usulan yang mengikuti konvensi modul
   (`AGENTS.md`, skill `elysia-module` / `elysia-layered-architecture`).
4. "dicek saat desain" = belum pasti dari kode; diputuskan saat Gate 1 (baca
   `docs/database/`) dan Gate 2 (grill).
5. Cek UAT di setiap bagian disalin ke
   [`uat-pengerjaan.md`](uat-pengerjaan.md).

**Aturan yang berlaku di semua tugas** (tidak diulang per bagian):
- Skema berubah: edit `docs/database/docs.dbml` **dulu**, lalu
  `bun docs/database/gen-logical-references.ts` dan
  `bun docs/database/validate-dbml.ts` (harus `OK`), baru Drizzle
  (`apps/backend/drizzle/schemas/*.schema.ts`) dan
  `bunx --bun drizzle-kit generate` di `apps/backend`. Kolom lintas modul =
  id biasa, nullable, tanpa FK.
- Rute/guard/hak baru: `bun docs/gen-role-permission.ts`.
- Teks layar: kunci di `packages/locales/src/en/<ns>.ts` **dan**
  `packages/locales/src/id/<ns>.ts`; pesan error server di
  `packages/locales/src/{en,id}/api.ts`.
- Rute web-admin baru: `apps/web-admin/src/routeTree.gen.ts` ikut berubah;
  menu di `apps/web-admin/src/components/sidebar/nav-config.ts`.
- Setiap PR: `docs/plan/progress.md`, `docs/plan/backlog.md`,
  `docs/plan/plans/features.md`, dan `docs/adjustment/catatan-progres.md`.

---

## Indeks

| ID | Judul | Prioritas | Paket / urutan |
|---|---|---|---|
| [P7-5](#p7-5-penomoran-tanpa-celah-dan-kode-pemasok-pendek-tinggi-t-1-k6-l-2-b-27) | Penomoran tanpa celah + kode pemasok pendek (mencakup L-2, B-27, halaman Nomor Dokumen) | Tinggi | Langkah 7, mulai langsung |
| [P7-6](#p7-6-dasar-form-tinggi-rf-a-tf-a-tf-1tf-3-rf-27-l-7) | Dasar form: error per isian, pembaca error, komponen form (mencakup L-7) | Tinggi | Langkah 7, mulai langsung |
| [P7-3](#p7-3--b-1-aturan-persetujuan-k1-tinggi-k1-a1-b-1-x-2) | Aturan persetujuan K1 (= B-1) | Tinggi | Langkah 7, setelah P7-1 + P7-2 (Oki) |
| [B-21](#b-21-hapus-tandai-terkirim-pada-po-tinggi-k3--b1) | Hapus "Tandai terkirim" PO | Tinggi | Langkah 8, awal |
| [PH-PO](#ph-po-halaman-pesanan-pembelian-harga-beli-terakhir-dan-konfirmasi-tinggi-fu6-k6) | Halaman PO: harga beli terakhir, konfirmasi | Tinggi | Langkah 8, setelah B-21 |
| [B-32](#b-32-tutup-po-kurang-kirim-tinggi-kf-b1) | Tutup PO kurang kirim | Tinggi | Langkah 8, setelah B-21 |
| [PH-ADJ](#ph-adj-halaman-penyesuaian-stok-tinggi-fu8-k1-tf-9) | Halaman Penyesuaian Stok | Tinggi | Langkah 8, setelah P7-3 |
| [B-29](#b-29-layar-terimakeluarkan-stok-manual-tinggi-kf-g1-kf-1) | Layar terima/keluarkan stok manual | Tinggi | Langkah 8 |
| [B-13](#b-13-retur-penjualan-rusak-tidak-menambah-stok-jual-tinggi-m02-e5) | Retur penjualan "Rusak" tidak menambah stok jual | Tinggi | Langkah 8, awal |
| [PH-SPH](#ph-sph-halaman-penawaran-sph-tinggi-fu3-oc4-k1) | Halaman Penawaran (SPH) | Tinggi | Langkah 8 (urutan alur uang, FU-B) |
| [B-33](#b-33-pph-23-dipotong-pelanggan-di-kuitansi-tinggi-kf-k3-kf-t3-bersama-oki-m09-17) | PPh 23 dipotong pelanggan di kuitansi | Tinggi | Langkah 8, bersama Oki (M09-17) |
| [B-37](#b-37-halaman-cetak-so-kuitansi-bpb-retur-tinggi-alur-lengkap-6-nm-11) | Cetak SO, kuitansi, BPB, retur | Tinggi (kuitansi dulu) | Langkah 8 |
| [B-40](#b-40-riwayat-dan-saldo-pelanggan-tinggi-kf-s1) | Riwayat dan saldo pelanggan | Tinggi | Langkah 8 |
| [B-41](#b-41-kirim-sphfaktur-tanpa-n8n-tinggi-kf-s2) | Kirim SPH/faktur tanpa n8n | Tinggi | Langkah 8 |
| [B-42](#b-42-faktur-tanpa-so-tinggi-kf-s6) | Faktur tanpa SO | Tinggi | Langkah 8, bersama B-31 |
| [B-30](#b-30-cek-garansi-barang-tanpa-proyek-tinggi-kf-p2) | Cek garansi barang tanpa proyek | Tinggi | Langkah 8 |
| [B-31](#b-31-tiket-berbayar-bisa-ditagih-tinggi-kf-p1) | Tiket berbayar bisa ditagih | Tinggi | Langkah 8, setelah B-42 |
| [B-35](#b-35-notifikasi-tugas-proyek-ke-teknisi-tinggi-alur-lengkap-7) | Notifikasi tugas proyek | Tinggi | Langkah 8 |
| [B-36](#b-36-tombol-konfirmasi-tiket-di-portal-pelanggan-tinggi-alur-lengkap-10) | Konfirmasi tiket di portal pelanggan | Tinggi | Langkah 8 |
| [B-38](#b-38-portal-pelanggan-dan-website-pesanan-online-tinggi-pp-1pp-8-t21-t25) | Portal pelanggan + website: pesanan online | Tinggi (rancang dulu) | Langkah 8; P2+P7 → P3 → P5 → P4 |
| [B-45](#b-45-penempatan-kantorlapangan-freelance-dan-tarif-tinggi-kl-1kl-12) | Penempatan, Freelance, tarif freelance | Tinggi | Langkah 8, sebelum B-39 dan B-48 |
| [B-39](#b-39-gaji-memakai-absensi-dan-pengaturan-potongan-tinggi-kf-h1-kf-h2-pg-1pg-6) | Gaji memakai absensi + pengaturan potongan | Tinggi | Langkah 8, setelah B-45 |
| [B-44](#b-44-laporan-kerja-karyawan-tinggi-lk-1lk-7) | Laporan kerja karyawan | Tinggi | Langkah 8, bersama Oki (layar portal) |
| [B-48](#b-48-biaya-perjalanan-di-proyek-tinggi-bp-1bp-6) | Biaya perjalanan di proyek | Tinggi | Langkah 8, bersama Oki (M09-19) |
| [B-46](#b-46-n8n-dan-whatsapp-dijalankan-sungguhan-tinggi-n8-1n8-10) | n8n dan WhatsApp sungguhan | Tinggi | Langkah 8, uji langkah 9 |
| [M12-14-D](#m12-14-d-form-ubah-karyawan-tidak-menimpa-role-tinggi-kf-r2-bagian-dafrin) | Form ubah karyawan tidak menimpa role (bagian Dafrin) | Tinggi | Langkah 8, bersama Oki |
| [M12-16-D](#m12-16-d-ekspor-daftar-utama-modul-dafrin-tinggi-kf-r5-bagian-pemilik-modul) | Ekspor daftar utama modul Dafrin | Tinggi | Langkah 8, setelah pola Oki |
| [L-12-D](#l-12-d-templat-impor-data-awal-modul-dafrin-tinggi-nm-1-nm-2) | Templat impor data awal modul Dafrin | Tinggi | Langkah 8–9 |
| [B-14](#b-14-masa-perpanjangan-lisensi-dan-kode-aplikasi-sedang-t-2-t-3) | Perpanjangan lisensi + kode aplikasi | **Sedang** (diminta masuk peta) | Langkah 9 |

**Tidak dipetakan di sini (bukan pekerjaan Dafrin):** L-1 (= P7-1), P7-2,
P7-4, L-4/L-10 (= P7-7), L-11, L-13, L-14 (Oki atau bersama tanpa kode
modul Dafrin); PK-10 dan semua layar `apps/web-employee` (Oki; Dafrin hanya
menyiapkan data/backend di B-44, B-45, B-48). L-7 masuk P7-6; L-2 dan B-27
masuk P7-5; B-1 = P7-3.

---

## Langkah 7

### P7-5 Penomoran tanpa celah dan kode pemasok pendek (Tinggi, T-1, K6, L-2, B-27)

- **Seharusnya:**
  - Nomor diambil **di dalam transaksi yang sama** dengan penyimpanan
    dokumen; simpan gagal tidak memakan nomor (T-1, B-27).
  - Pola bawaan kode pemasok pendek sehingga nomor PO (pola
    `{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}`) muat 32 karakter
    (K6, L-2).
  - Pratinjau di Pengaturan → Nomor Dokumen memakai **kode pemasok asli**
    (yang terpanjang / dipilih), bukan `SUP` (K6).
  - `warranty` dibatasi di `CODE_MAX_LENGTH` (32, mengikuti
    `document.documents.code`).
  - Pesan FU6: "Nomor PO melebihi 32 karakter. Persingkat kode pemasok di
    Pengaturan → Nomor Dokumen."
- **Sekarang:**
  - `repository-base.ts:118-146` sudah menerima `tx`, tetapi beberapa pemanggil
    tidak meneruskannya, misalnya `purchase-order.service.ts:249` (nomor diambil
    lalu `transition` + `documents.register` di luar satu transaksi, baris
    253-270), juga `purchase-request.service.ts:186`,
    `purchase-return.service.ts:349`, `quotation.service.ts:323`,
    `sales-order.service.ts:146`, `sales-return.service.ts:357`,
    `invoice.service.ts:488`, `licensing.service.ts:243,441`,
    `project.service.ts:329`, `ticket.service.ts:162`,
    `customer.service.ts:153,231,235`, `supplier.service.ts:97`,
    `product.service.ts:132`, `warehouse.service.ts:287`,
    `employee-invite.service.ts:177` (daftar hasil grep, dicek lagi saat desain).
  - Pola pemasok `{COMPANY}-{ORG}-{TYPE}-{SEQ:5}` di `domain.ts:186`;
    `CODE_MAX_LENGTH` tanpa `warranty` (`domain.ts:196-204`); pratinjau memakai
    `PREVIEW_CONTEXT.supplier = 'SUP'` (`domain.ts:239-243`,
    `service-base.ts:244`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend (bersama) | `apps/backend/src/shared/numbering/domain.ts` | Pola bawaan `supplier_company` pendek (misal `{TYPE}{SEQ:3}` atau setara, dipilih saat desain); `warranty: 32` di `CODE_MAX_LENGTH` |
| backend (bersama) | `apps/backend/src/shared/numbering/service-base.ts` | Pratinjau PO memakai kode pemasok asli terpanjang (lewat konteks yang diberikan modul `procurement`/`supplier`), bukan `SUP` |
| backend (bersama) | `apps/backend/src/shared/numbering/controller.ts` | Pratinjau menerima konteks opsional (misal `supplierCompanyId`) bila dibutuhkan |
| backend | Service di daftar "Sekarang" | Bungkus ambil nomor + simpan dokumen dalam `this.transactions.run(tx => ...)` dan teruskan `tx` ke `numbering.next` |
| backend | `apps/backend/src/app/procurement/services/purchase-order.service.ts` | `decide()`: nomor, transisi, `documents.register` dalam satu transaksi (cek apakah `DocumentService.register` menerima `tx`, dicek saat desain) |
| web-admin | `apps/web-admin/src/components/settings/numbering-settings.tsx`, `apps/web-admin/src/lib/code-numbering-api.ts` | Tampilkan contoh dengan kode pemasok asli dan peringatan bila > 32 |
| locale | `packages/locales/src/{en,id}/settings.ts`, `packages/locales/src/{en,id}/api.ts` | Teks peringatan dan pesan `numbering.codeTooLong` sesuai FU6 |
| test | `apps/backend/test/unit/code-numbering.test.ts`, `apps/backend/test/unit/procurement.service.test.ts` | Nomor tidak maju bila simpan gagal (mock transaksi melempar); pola pemasok bawaan → nomor PO ≤ 32; `warranty` > 32 ditolak |
| test | `apps/web-admin/test/unit/code-numbering-api.test.ts` | Pratinjau dengan konteks pemasok |
| docs | `docs/adjustment/3-rancangan/lintas-modul/penomoran-dokumen.md` | Tandai temuan 1, 3, 5, 6 selesai |

- **Skema/migrasi:** Tidak (perubahan pola bawaan dan alur transaksi).
  Kode pemasok lama yang panjang diperpendek Aqim lewat pengaturan, bukan
  migrasi data.
- **Test:** lihat tabel.
- **UAT:**
  1. Pengaturan → Nomor Dokumen → PO: contoh nomor memakai kode pemasok asli;
     bila > 32 karakter tampil peringatan.
  2. Pemasok baru dengan kode otomatis → buat dan setujui PO → disetujui, nomor
     ≤ 32 karakter.
  3. Paksa simpan gagal (misal PO dengan anggaran proyek terlampaui) lalu
     simpan PO lain → nomor urut tidak melompat.
- **Bergantung pada:** — (ditinjau Oki, K11).

**Prompt AI (salin):**

```text
Kerjakan P7-5 Penomoran tanpa celah dan kode pemasok pendek.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian P7-5 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/shared/numbering/domain.ts, apps/backend/src/shared/numbering/service-base.ts, apps/backend/src/shared/numbering/controller.ts, apps/backend/src/app/procurement/services/purchase-order.service.ts, apps/web-admin/src/components/settings/numbering-settings.tsx, apps/web-admin/src/lib/code-numbering-api.ts, packages/locales/src/{en,id}/settings.ts, packages/locales/src/{en,id}/api.ts, docs/adjustment/3-rancangan/lintas-modul/penomoran-dokumen.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/code-numbering.test.ts, apps/backend/test/unit/procurement.service.test.ts, apps/web-admin/test/unit/code-numbering-api.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-5 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-5.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### P7-6 Dasar form (Tinggi, RF-A, TF-A, TF-1–TF-3, RF-27, L-7)

- **Seharusnya:**
  - Server mengirim **semua** kesalahan validasi, masing-masing `field` +
    **kunci terjemahan**, pesan berbahasa Indonesia sesuai pola 4.5 (TF-1, L-7).
  - Satu pembaca error API di web-admin menggantikan salinan di ±40
    `lib/*-api.ts`; mengembalikan pesan per isian (TF-2).
  - Komponen form bersama: label wajib `*`, pesan di bawah isian, ringkasan di
    atas form yang bisa diklik, fokus ke isian salah pertama (TF-3, RF-6,
    RF-14–RF-17).
  - TanStack Form + skema zod bersama lewat `packages/common` (TF-A).
  - Konfirmasi baku `confirm-dialog.tsx`; error server non-isian menampilkan
    nomor referensi (RF-27, memakai `meta.requestId` yang sudah ada).
  - Satu form contoh memakai semua ini: **Prospek (FU1)**.
- **Sekarang:**
  - `apps/backend/src/http/plugin.ts:74-92` hanya membaca **satu**
    `valueError` dan teks Zod Inggris; `plugin.ts:146-155` menggabungkan
    pesan Zod dengan `;` tanpa `field`; `plugin.ts:170-174` error 500 tanpa ref.
  - `apps/web-admin/src/lib/lead-api.ts:113` (dan pola yang sama di ±40 file
    `lib/*-api.ts`) hanya mengambil `errors[0].message`.
    `apps/web-admin/src/components/form/field-label.tsx` hanya menandai
    "(Opsional)". `@tanstack/react-form` sudah jadi dependensi
    (`apps/web-admin/package.json:22`) tetapi belum dipakai.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend (bersama) | `apps/backend/src/http/plugin.ts` | Kumpulkan semua issue Zod/TypeBox → `errors[] { field, message, key }`; pesan diterjemahkan lewat `t()`; 500 menyertakan `requestId` di pesan |
| backend (bersama) | `apps/backend/src/http/response.ts` | `errorEnvelope` tetap; pastikan `meta.requestId` terisi untuk RF-27 |
| shared | `packages/common/src/contracts/api-response.ts` | `TApiErrorMessage` ditambah `key?: string` (dan `params?`) |
| shared | `packages/common/src/forms/` (baru) | Pemetaan issue Zod → kunci terjemahan (`required`, `invalidFormat`, `min`, `max`, `dateOrder`, `taken`, `exceedsRemaining`, `emptyTable`) |
| shared | `packages/common/src/crm/lead.schema.ts` (baru) | Skema zod Prospek yang dipakai backend dan web-admin (contoh TF-A) |
| backend | `apps/backend/src/app/project/contracts/lead.contract.ts` | Memakai skema bersama di atas |
| web-admin | `apps/web-admin/src/lib/api-error.ts` (baru) | `readApiError(envelope)` → `{ message, fieldErrors, ref }`; `ApiError` class |
| web-admin | `apps/web-admin/src/lib/*-api.ts` (±40 file, misal `lead-api.ts:113`) | Ganti `throw new Error(errors[0]...)` dengan `readApiError` (bertahap; minimal lead dulu) |
| web-admin | `apps/web-admin/src/components/form/field-label.tsx` | Tambah `required` → `*` merah |
| web-admin | `apps/web-admin/src/components/form/form-error-summary.tsx` (baru), `apps/web-admin/src/components/form/form-field.tsx` (baru) | Ringkasan atas form + pembungkus isian TanStack Form dengan `FieldError` dari `packages/ui/src/components/field.tsx` |
| web-admin | `apps/web-admin/src/components/confirm-dialog.tsx` | Dipakai sebagai konfirmasi baku (teks akibat sebagai prop) |
| web-admin | `apps/web-admin/src/components/crm/lead-form-dialog.tsx` | Form contoh FU1 memakai komponen baru |
| locale | `packages/locales/src/{en,id}/common.ts`, `packages/locales/src/{en,id}/api.ts` | Kunci pola pesan 4.5 dan "\* wajib diisi", "Ada {{count}} isian yang perlu diperbaiki", pesan ref RF-27 |
| test | `apps/backend/test/unit/http-plugin-unhandled-error.test.ts` (perluas), `apps/backend/test/unit/http-plugin-validation.test.ts` (baru) | Dua isian salah → dua `errors` dengan `field` + `key`; 500 berisi ref |
| test | `apps/web-admin/test/unit/api-error.test.ts` (baru) | Pemetaan envelope → per isian |
| test | `apps/backend/test/unit/lead.service.test.ts` | Skema bersama menolak lead tanpa kontak dengan `field` |

- **Skema/migrasi:** Tidak.
- **Test:** lihat tabel; locale parity lewat `bun run test` di
  `packages/locales`.
- **UAT:**
  1. Prospek baru, kosongkan nama dan semua kontak, klik Simpan → ringkasan di
     atas "Ada 2 isian yang perlu diperbaiki", pesan Indonesia di bawah tiap
     isian, kursor ke isian pertama.
  2. Isian wajib bertanda `*` merah; di atas form tertulis "\* wajib diisi".
  3. Matikan backend sementara / picu 500 → pesan "Terjadi kesalahan di server
     (ref: ...)"; isian yang diketik tidak hilang.
- **Bergantung pada:** — (ditinjau Oki, K11). Dipakai semua perbaikan form
  langkah 8.

**Prompt AI (salin):**

```text
Kerjakan P7-6 Dasar form.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian P7-6 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/http/plugin.ts, apps/backend/src/http/response.ts, packages/common/src/contracts/api-response.ts, packages/common/src/forms/, packages/common/src/crm/lead.schema.ts, apps/backend/src/app/project/contracts/lead.contract.ts, apps/web-admin/src/lib/api-error.ts, apps/web-admin/src/lib/*-api.ts, lead-api.ts:113, apps/web-admin/src/components/form/field-label.tsx, apps/web-admin/src/components/form/form-error-summary.tsx, apps/web-admin/src/components/form/form-field.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/http-plugin-unhandled-error.test.ts, apps/backend/test/unit/http-plugin-validation.test.ts, apps/web-admin/test/unit/api-error.test.ts, apps/backend/test/unit/lead.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-6 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-6.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### P7-3 = B-1 Aturan persetujuan K1 (Tinggi, K1, A1, B-1, X-2)

- **Seharusnya:**
  - Satu aturan bersama: **pembuat ≠ penyetuju, kecuali Pemilik**; persetujuan
    Pemilik atas dokumennya sendiri dicatat di audit (`meta.self_approved`)
    dalam transaksi yang sama (K1, L-1/P7-1).
  - Berlaku di 7 tempat: PR, PO, retur pembelian, SPH, retur penjualan,
    cuti/lembur, penyesuaian stok. Penyesuaian stok: pengecualian
    `canSelfApprove` (siapa pun yang punya hak approve) **diganti** aturan K1.
  - Tombol Setujui tampil untuk Pemilik pada dokumennya sendiri, dengan
    konfirmasi "Anda menyetujui {dokumen} buatan Anda sendiri. Tindakan ini
    dicatat di log audit." (FU3, FU6).
  - Riwayat dokumen menampilkan "disetujui oleh pembuat" (RF-26). Jurnal
    manual tetap orang kedua (K1a, modul Oki, tidak disentuh).
- **Sekarang:**
  - Larangan mutlak: `purchase-request.service.ts:204,214`,
    `purchase-order.service.ts:241` (rencana menulis :225, baris sudah
    bergeser), `purchase-return.service.ts:342`, `quotation.service.ts:367`,
    `sales-return.service.ts:350`, `leave.service.ts:152,185,287`.
  - Penyesuaian: `adjustment.controller.ts:68` memberi `canSelfApprove` ke
    semua pemegang `stock_adjustment:approve`, dipakai di
    `adjustment.service.ts:373-378`. Web menyembunyikan tombol untuk pembuat:
    `purchase-orders/$purchaseOrderId/index.tsx:142,183,216`,
    `purchase-requests/$purchaseRequestId/index.tsx:139`,
    `purchase-returns/$purchaseReturnId/index.tsx:148`,
    `sales/quotes/$quotationId/index.tsx:162`,
    `sales/returns/$salesReturnId/index.tsx:167`,
    `components/hr/request-actions.tsx:49,56,70`,
    `components/inventory/adjustment-detail.tsx:144,262`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend (bersama) | `apps/backend/src/shared/approval/maker-checker.ts` (baru) | `decideMakerChecker({ makerUserId, actor: { userId, roles } })` → `{ selfApproved }` atau lempar error modul; "Pemilik" = role `owner` dari `packages/common/src/authorization/erp-permissions.ts` |
| backend | `apps/backend/src/authorization/elysia-auth.ts` (`ErpContext`, baris 70) | Dibaca controller untuk mengirim `roles` aktor ke service (tidak diubah bila sudah cukup) |
| backend | `apps/backend/src/app/procurement/services/purchase-request.service.ts`, `purchase-order.service.ts`, `purchase-return.service.ts` | Ganti `if (... === actorUserId) throw` dengan aturan bersama; catat audit `self_approved` di transaksi (penulis audit dari P7-1) |
| backend | `apps/backend/src/app/sale/services/quotation.service.ts`, `sales-return.service.ts` | Sama |
| backend | `apps/backend/src/app/human-resource/services/leave.service.ts` | Sama untuk cuti dan lembur (approve + reject) |
| backend | `apps/backend/src/app/inventory/controllers/adjustment.controller.ts`, `apps/backend/src/app/inventory/services/adjustment.service.ts` | Hapus `canSelfApprove`; pakai aturan bersama |
| backend | Controller terkait (`procurement/controllers/purchase-*.controller.ts`, `sale/controllers/quotation.controller.ts`, `sale/controllers/sales-return.controller.ts`, `human-resource/controllers/leave.controller.ts`) | Kirim aktor `{ userId, roles }` dari `erp` |
| backend | `apps/backend/src/app/*/errors/*.errors.ts` (procurement, sale, human-resource, inventory) | Pesan error menyebut "harus disetujui rekan atau Pemilik" |
| web-admin | 7 halaman/komponen di "Sekarang" | `own && !isOwner` menyembunyikan Setujui; `own && isOwner` menampilkan Setujui dengan `confirm-dialog.tsx` + teks K1; peran dari `apps/web-admin/src/lib/use-caller-org-roles.ts` |
| web-admin | Halaman detail dokumen (riwayat) | Label "disetujui oleh pembuat" bila audit/kolom menandai (sumber data dicek saat desain: audit `meta.self_approved`) |
| locale | `packages/locales/src/{en,id}/api.ts` (`procurement.selfApproval`, `sales.selfApproval`, `hr.selfDecision`, `inventory.selfApprovalForbidden`, ...), `packages/locales/src/{en,id}/common.ts` | Teks error dan konfirmasi K1 |
| test | `apps/backend/test/unit/purchase-request.service.test.ts`, `procurement.service.test.ts`, `purchase-return.service.test.ts`, `quotation.service.test.ts`, `sales-return.service.test.ts`, `hr-records.service.test.ts`, `adjustment.service.test.ts`, `apps/backend/test/unit/maker-checker.test.ts` (baru) | Pemilik menyetujui milik sendiri → lolos + audit `self_approved`; non-Pemilik → 403; orang lain → lolos tanpa tanda |
| docs | `docs/architecture/decisions/` (ADR-0006 diubah di P7-2 oleh Oki) | Dirujuk, tidak ditulis di paket ini |

- **Skema/migrasi:** Tidak (audit memakai `meta`; kolom audit bila ada di
  P7-1).
- **Test:** lihat tabel; test otorisasi di
  `apps/backend/test/authorization/inventory-authorization.test.ts` diperbarui
  untuk penyesuaian.
- **UAT:**
  1. Aqim membuat PO, mengajukan, lalu menyetujui sendiri → dialog K1 tampil,
     PO disetujui, Log Audit mencatat "disetujui oleh pembuat".
  2. Bilal membuat SPH dan mencoba menyetujui sendiri → tombol Setujui tidak
     ada; lewat API → pesan "harus disetujui rekan Penjualan atau Pemilik".
  3. Agus (Gudang) membuat penyesuaian stok → Agus tidak bisa menyetujui;
     Aqim bisa.
  4. Cuti yang dicatat Aqim sendiri bisa disetujui Aqim dan tercatat di audit.
- **Bergantung pada:** P7-1 (audit dalam transaksi), P7-2 (ADR-0006).

---

**Prompt AI (salin):**

```text
Kerjakan P7-3 Aturan persetujuan K1.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian P7-3 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/shared/approval/maker-checker.ts, apps/backend/src/authorization/elysia-auth.ts, apps/backend/src/app/procurement/services/purchase-request.service.ts, purchase-order.service.ts, purchase-return.service.ts, apps/backend/src/app/sale/services/quotation.service.ts, sales-return.service.ts, apps/backend/src/app/human-resource/services/leave.service.ts, apps/backend/src/app/inventory/controllers/adjustment.controller.ts, apps/backend/src/app/inventory/services/adjustment.service.ts, procurement/controllers/purchase-*.controller.ts, sale/controllers/quotation.controller.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/purchase-request.service.test.ts, procurement.service.test.ts, purchase-return.service.test.ts, quotation.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri P7-3 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/P7-3.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Langkah 8: Pembelian dan Gudang

### B-21 Hapus "Tandai terkirim" pada PO (Tinggi, K3 / B1)

- **Seharusnya:**
  - PO yang **disetujui** langsung bisa diterima di Penerimaan Barang; tombol
    "Tandai terkirim" hilang (K3, B1).
  - Setelah disetujui: "PO {nomor} disetujui dan siap diterima di gudang." (FU6).
  - PO lama berstatus `sent` tetap bisa diterima (data lama).
- **Sekarang:**
  - `purchase-order.service.ts:281-286` `markSent` (approved → sent),
    rute `purchase-order.controller.ts:53`.
  - Penerimaan hanya untuk `sent`/`partially_received`:
    `goods-receipt.service.ts:150,193`, `purchase-order.repository.ts:164`;
    pembatalan penerimaan mengembalikan ke `sent`
    (`purchase-order.repository.ts:232`). Web: tombol di
    `purchase-orders/$purchaseOrderId/index.tsx:196-201`,
    `lib/procurement-api.ts:275`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/procurement/services/goods-receipt.service.ts` | Terima PO `approved`, `sent`, `partially_received` (baris 150, 193) |
| backend | `apps/backend/src/app/procurement/repositories/purchase-order.repository.ts` | Baris 164: izinkan `approved`; baris 232: tanpa penerimaan kembali ke `approved` |
| backend | `apps/backend/src/app/procurement/services/purchase-order.service.ts`, `controllers/purchase-order.controller.ts` | Hapus `markSent` dan rute `POST /:id/send` |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx` | Hapus tombol markSent; tombol Terima tampil untuk `approved` |
| web-admin | `apps/web-admin/src/lib/procurement-api.ts` | Hapus `sendPurchaseOrder` |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/receipts/new.tsx` | Pilihan PO memuat `approved` |
| locale | `packages/locales/src/{en,id}/procurement.ts` | Hapus `pos.markSent`, `pos.sent` (dead-key test); teks sukses FU6 |
| test | `apps/backend/test/unit/goods-receipt.service.test.ts`, `procurement.service.test.ts` | PO approved bisa diterima; rute send hilang |
| docs | `docs/role-permission.md` (generator) | Rute `/send` hilang |

- **Skema/migrasi:** Tidak. Nilai `sent` tetap di CHECK
  (`procurement.schema.ts:281`) untuk baris lama; catatan di `docs.dbml`
  (status `sent` = historis) diperbarui.
- **Test:** lihat tabel; e2e `apps/web-admin/e2e/` bila ada skenario PO.
- **UAT:**
  1. Setujui PO → tidak ada tombol "Tandai terkirim"; PO langsung muncul di
     Penerimaan Barang → BPB baru.
  2. Buat BPB sebagian → status "diterima sebagian"; sisa tetap bisa diterima.
- **Bergantung pada:** — (bisa sebelum/bersama P7-3).

**Prompt AI (salin):**

```text
Kerjakan B-21 Hapus "Tandai terkirim" pada PO.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-21 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/procurement/services/goods-receipt.service.ts, apps/backend/src/app/procurement/repositories/purchase-order.repository.ts, apps/backend/src/app/procurement/services/purchase-order.service.ts, controllers/purchase-order.controller.ts, apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx, apps/web-admin/src/lib/procurement-api.ts, apps/web-admin/src/routes/_authed/procurement/receipts/new.tsx, packages/locales/src/{en,id}/procurement.ts, docs/role-permission.md.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/goods-receipt.service.test.ts, procurement.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-21 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-21.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-PO Halaman Pesanan Pembelian: harga beli terakhir dan konfirmasi (Tinggi, FU6, K6)

- **Seharusnya:**
  - Harga baris **terisi otomatis dari harga beli terakhir** barang itu,
    bisa diubah; selisih > 20% memunculkan peringatan kuning (FU6).
  - Ajukan/Setujui/Batalkan memakai konfirmasi; Batalkan wajib alasan dan
    ditolak bila sudah ada penerimaan (RF-23, RF-24).
  - Pesan nomor terlalu panjang sesuai K6 (dari P7-5).
- **Sekarang:**
  - Tidak ada endpoint/metode "harga beli terakhir" (grep `lastPurchase`
    kosong); harga baris diketik manual di
    `components/procurement/purchase-order-form.tsx`.
  - Setujui tanpa konfirmasi: `purchase-orders/$purchaseOrderId/index.tsx:183-190`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/procurement/repositories/purchase-order.repository.ts` | `lastUnitPrices(productIds)` dari baris PO `approved`/`sent`/`received` terbaru |
| backend | `apps/backend/src/app/procurement/services/purchase-order.service.ts`, `controllers/purchase-order.controller.ts` | `GET /procurement/purchase-orders/last-prices?productIds=` (hak `purchase_order:create` + `product:read_cost`, dicek saat desain) |
| web-admin | `apps/web-admin/src/components/procurement/purchase-order-form.tsx` | Isi harga otomatis, peringatan > 20% |
| web-admin | `apps/web-admin/src/lib/procurement-api.ts` | Fungsi `getLastPurchasePrices` |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx` | Konfirmasi Ajukan/Setujui (`confirm-dialog.tsx`) |
| locale | `packages/locales/src/{en,id}/procurement.ts` | Teks peringatan harga dan konfirmasi |
| test | `apps/backend/test/unit/procurement.service.test.ts` | Harga terakhir per barang; tanpa riwayat → kosong |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. PO baru, pilih barang yang pernah dibeli → harga terisi harga PO
     terakhir.
  2. Ubah harga 30% lebih tinggi → peringatan kuning menyebut harga terakhir.
  3. Klik Setujui → dialog konfirmasi "Setelah disetujui, PO tidak bisa diubah
     dan langsung muncul di Penerimaan Barang."
- **Bergantung pada:** B-21, P7-6, P7-3.

**Prompt AI (salin):**

```text
Kerjakan PH-PO Halaman Pesanan Pembelian: harga beli terakhir dan konfirmasi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian PH-PO (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/procurement/repositories/purchase-order.repository.ts, apps/backend/src/app/procurement/services/purchase-order.service.ts, controllers/purchase-order.controller.ts, apps/web-admin/src/components/procurement/purchase-order-form.tsx, apps/web-admin/src/lib/procurement-api.ts, apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx, packages/locales/src/{en,id}/procurement.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/procurement.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-PO terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-PO.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-32 Tutup PO kurang kirim (Tinggi, KF-B1)

- **Seharusnya:**
  - Tindakan **Tutup** untuk PO `partially_received`, wajib alasan; sisa tidak
    lagi ditunggu dan tidak muncul di Penerimaan Barang (KF-B1).
  - Komitmen anggaran proyek dan saldo GR/IR mengikuti jumlah yang diterima
    (dicek saat desain dengan Oki; `budgets.check` di
    `purchase-order.service.ts:248`).
- **Sekarang:**
  - `purchase-order.service.ts:288-290` menolak batal bila sudah ada
    penerimaan; tidak ada tindakan tutup. CHECK status tanpa `closed`
    (`procurement.schema.ts:281`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`procurement.purchase_orders`) | Status `closed`; kolom `closed_by`, `closed_at`, `closed_reason` |
| skema | `apps/backend/drizzle/schemas/procurement.schema.ts` | Sama + CHECK |
| backend | `apps/backend/src/app/procurement/services/purchase-order.service.ts`, `repositories/purchase-order.repository.ts`, `controllers/purchase-order.controller.ts`, `contracts/` (zod alasan) | `close(actor, id, reason)` hanya dari `partially_received`; rute `POST /:id/close` (hak `purchase_order:cancel` atau baru, dicek saat desain) |
| backend | `apps/backend/src/app/procurement/services/goods-receipt.service.ts` | PO `closed` tidak bisa diterima |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx`, `apps/web-admin/src/lib/procurement-api.ts` | Tombol Tutup + dialog alasan; badge status |
| locale | `packages/locales/src/{en,id}/procurement.ts`, `common.ts` (status) | Teks |
| test | `apps/backend/test/unit/procurement.service.test.ts`, `goods-receipt.service.test.ts` | Tutup hanya dari diterima sebagian; PO tertutup ditolak di BPB |

- **Skema/migrasi:** Ya: `procurement.purchase_orders` (status `closed`,
  `closed_by`, `closed_at`, `closed_reason`); `docs.dbml` dulu.
- **UAT:**
  1. PO 10 unit, diterima 6 → tombol Tutup; isi alasan → status "Ditutup",
     alasan tampil di detail.
  2. PO tertutup tidak muncul di pilihan Penerimaan Barang baru.
- **Bergantung pada:** B-21.

**Prompt AI (salin):**

```text
Kerjakan B-32 Tutup PO kurang kirim.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-32 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, procurement.purchase_orders, apps/backend/drizzle/schemas/procurement.schema.ts, apps/backend/src/app/procurement/services/purchase-order.service.ts, repositories/purchase-order.repository.ts, controllers/purchase-order.controller.ts, contracts/, apps/backend/src/app/procurement/services/goods-receipt.service.ts, apps/web-admin/src/routes/_authed/procurement/purchase-orders/$purchaseOrderId/index.tsx, apps/web-admin/src/lib/procurement-api.ts, packages/locales/src/{en,id}/procurement.ts, common.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/procurement.service.test.ts, goods-receipt.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-32 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-32.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-ADJ Halaman Penyesuaian Stok (Tinggi, FU8, K1, TF-9)

- **Seharusnya:**
  - Gudang tidak mengisi harga pokok; sistem memakai **harga rata-rata**
    barang; Aqim bisa mengubahnya saat menyetujui (kolom hanya untuk pemegang
    `product:read_cost`) (FU8).
  - Bila belum ada harga rata-rata saat disetujui: "Barang {nama} belum punya
    harga pokok. Isi harga sebelum posting."
  - Toast setelah simpan; konfirmasi posting; Tolak wajib alasan (FU8, FR3).
  - Konversi uang memakai `rupiahToMinor` (TF-9). Aturan K1 dari P7-3.
- **Sekarang:**
  - `components/inventory/adjustment-form.tsx:204` mengonversi
    `Math.round(Number(line.unitCost) * 100)`; kolom harga di form
    (`:456-463`). Simpan tanpa toast (temuan K-6). Rata-rata tersedia di
    `inventory/repositories/stock.repository.ts:268-297`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/inventory/services/adjustment.service.ts` | Saat approve/post: harga baris kosong → `averageCost` saldo; tanpa rata-rata → error baru; Aqim boleh kirim harga |
| backend | `apps/backend/src/app/inventory/errors/inventory.errors.ts` | `AdjustmentCostMissingError` (baru) |
| web-admin | `apps/web-admin/src/components/inventory/adjustment-form.tsx` | Hapus isian harga untuk Gudang; pakai `rupiahToMinor` dari `apps/web-admin/src/lib/format.ts:73` |
| web-admin | `apps/web-admin/src/components/inventory/adjustment-detail.tsx` | Harga bisa diubah saat setujui (pemegang read_cost); konfirmasi posting; alasan tolak; toast |
| locale | `packages/locales/src/{en,id}/inventory.ts`, `api.ts` | Teks |
| test | `apps/backend/test/unit/adjustment.service.test.ts` | Harga dari rata-rata; tanpa rata-rata ditolak |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Agus membuat penyesuaian rusak → tidak ada kolom harga; Simpan → toast
     "Penyesuaian ADJ/... disimpan sebagai draf".
  2. Aqim membuka detail → harga terisi rata-rata, bisa diubah; Posting → dialog
     "Stok akan berubah sesuai selisih...".
  3. Tolak tanpa alasan → tidak bisa.
- **Bergantung pada:** P7-3, P7-6.

**Prompt AI (salin):**

```text
Kerjakan PH-ADJ Halaman Penyesuaian Stok.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian PH-ADJ (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/inventory/services/adjustment.service.ts, apps/backend/src/app/inventory/errors/inventory.errors.ts, apps/web-admin/src/components/inventory/adjustment-form.tsx, apps/web-admin/src/components/inventory/adjustment-detail.tsx, packages/locales/src/{en,id}/inventory.ts, api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/adjustment.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-ADJ terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-ADJ.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-29 Layar terima/keluarkan stok manual (Tinggi, KF-G1, KF-1)

- **Seharusnya:**
  - Layar **Terima stok** dan **Keluarkan stok** manual untuk bahan proyek dan
    pemakaian sendiri, dengan pilihan **proyek** dan **nomor seri** (KF-G1).
  - Barang keluar ke proyek tercatat sebagai bahan/biaya proyek (cara posting
    dicek saat desain dengan Oki).
- **Sekarang:**
  - Backend ada: `inventory/controllers/stock.controller.ts:116` (`/receipts`,
    hak `stock:receive`) dan `:143` (`/issues`, `stock:issue`); skema
    `inventory/contracts/stock.contract.ts:113-125` tanpa seri/proyek
    (proyek hanya lewat `referenceType`/`referenceId` bebas).
  - Fungsi web ada tanpa layar: `lib/stock-api.ts:205` `receiveStock`,
    `:219` `issueStock`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/inventory/contracts/stock.contract.ts` | `projectId` (logical ref) dan `serialNumbers[]` opsional |
| backend | `apps/backend/src/app/inventory/services/stock.service.ts`, `controllers/stock.controller.ts` | Validasi proyek lewat kontrak modul `project` (`ProjectLookupService`, dicek saat desain); seri keluar/masuk lewat `serial-unit.service.ts` |
| web-admin | `apps/web-admin/src/routes/_authed/inventory/stock/receive.tsx` (baru), `apps/web-admin/src/routes/_authed/inventory/stock/issue.tsx` (baru) | Form gudang, rak, barang (pencarian), jumlah, proyek, seri, catatan |
| web-admin | `apps/web-admin/src/components/inventory/stock-movement-form.tsx` (baru) | Form bersama dua layar (komponen P7-6) |
| web-admin | `apps/web-admin/src/components/sidebar/nav-config.ts`, `apps/web-admin/src/lib/stock-api.ts` | Menu (dekat `/inventory/stock`, baris ±390) dan tipe input baru |
| locale | `packages/locales/src/{en,id}/inventory.ts`, `nav.ts` | Teks |
| test | `apps/backend/test/unit/stock.service.test.ts`, `apps/backend/test/authorization/stock-authorization.test.ts` | Seri dan proyek; hak receive/issue |

- **Skema/migrasi:** Tidak bila proyek memakai `reference_type = 'project'`
  pada `inventory.stock_movements`; dicek saat desain (Gate 1).
- **UAT:**
  1. Gudang → Keluarkan stok: pilih kabel 50 m, proyek X → stok berkurang,
     mutasi menyebut proyek X.
  2. Keluarkan barang bernomor seri → wajib pilih seri; seri berstatus keluar.
  3. Terima stok manual → stok bertambah, tercatat di Mutasi Stok.
- **Bergantung pada:** P7-6.

---

**Prompt AI (salin):**

```text
Kerjakan B-29 Layar terima/keluarkan stok manual.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-29 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/inventory/contracts/stock.contract.ts, apps/backend/src/app/inventory/services/stock.service.ts, controllers/stock.controller.ts, apps/web-admin/src/routes/_authed/inventory/stock/receive.tsx, apps/web-admin/src/routes/_authed/inventory/stock/issue.tsx, apps/web-admin/src/components/inventory/stock-movement-form.tsx, apps/web-admin/src/components/sidebar/nav-config.ts, apps/web-admin/src/lib/stock-api.ts, packages/locales/src/{en,id}/inventory.ts, nav.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/stock.service.test.ts, apps/backend/test/authorization/stock-authorization.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-29 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-29.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Langkah 8: Penjualan dan Penagihan

### B-13 Retur penjualan "Rusak" tidak menambah stok jual (Tinggi, M02 E5)

- **Seharusnya:**
  - Baris retur berkondisi **Rusak** tidak menambah stok yang bisa dijual,
    juga untuk barang tanpa nomor seri (B-13, peta halaman).
  - Barang rusak tetap tercatat (jejak dan nilai) di tempat terpisah (rak
    karantina/rusak atau penghapusan; pilihan dicek saat desain).
- **Sekarang:**
  - `sale/services/sales-return.service.ts:443-458` selalu memposting
    `return_in` ke stok gudang untuk semua kondisi; hanya seri yang diberi
    status `damaged` (`:468`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/sale/services/sales-return.service.ts` | Kondisi `damaged`: posting ke rak/stok rusak atau langsung `disposal`, bukan stok jual (sesuai keputusan desain) |
| backend | `apps/backend/src/app/inventory/services/stock.service.ts` / kontrak ekspor inventory | Bila perlu, gerakan/rak "rusak" yang tidak dihitung tersedia (dicek saat desain) |
| web-admin | `apps/web-admin/src/routes/_authed/sales/returns/$salesReturnId/index.tsx` | Teks bantuan "Barang rusak tidak masuk stok jual" pada dialog terima |
| locale | `packages/locales/src/{en,id}/sales.ts` | Teks |
| test | `apps/backend/test/unit/sales-return.service.test.ts` | Baris rusak tanpa seri tidak menambah stok jual; baris baik tetap |
| docs | `docs/database/docs.dbml` (catatan `sale.returns`, baris 2267) | Perbarui catatan "Receiving posts return_in..." |

- **Skema/migrasi:** Mungkin (bila dibuat jenis rak/penanda stok rusak di
  `warehouse`/`inventory`); dicek saat desain, `docs.dbml` dulu.
- **UAT:**
  1. Retur 2 unit barang tanpa seri, kondisi Rusak → stok jual di Stok Barang
     tidak bertambah.
  2. Retur kondisi Baik → stok jual bertambah.
  3. Barang rusak terlihat di tempat yang diputuskan (rak rusak / penghapusan).
- **Bergantung pada:** —.

**Prompt AI (salin):**

```text
Kerjakan B-13 Retur penjualan "Rusak" tidak menambah stok jual.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-13 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/sale/services/sales-return.service.ts, apps/backend/src/app/inventory/services/stock.service.ts, apps/web-admin/src/routes/_authed/sales/returns/$salesReturnId/index.tsx, packages/locales/src/{en,id}/sales.ts, docs/database/docs.dbml, sale.returns.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/sales-return.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-13 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-13.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### PH-SPH Halaman Penawaran (SPH) (Tinggi, FU3, OC4, K1)

- **Seharusnya:**
  - **Berlaku sampai wajib**, bawaan Tanggal SPH + 14 hari, ≥ Tanggal SPH;
    lewat tanggal tampil **Kedaluwarsa** dan muncul di dasbor Penjualan (FU3).
  - Diskon per baris **Rp atau %**, yang lain dihitung otomatis (FU3).
  - PPN dari **master pajak bertanggal**; mengubah tarif membuka isian
    **Alasan** wajib (OC4).
  - Revisi: SPH disetujui/dikirim tidak bisa diubah; tombol **Revisi** →
    versi baru draf (sudah ada di skema), versi lama "Diganti revisi" (FU3).
  - Konfirmasi Ajukan/Setujui/Tolak (wajib alasan); aturan K1 dari P7-3.
- **Sekarang:**
  - `sale/contracts/quotation.contract.ts:91` `validUntil` opsional
    (`nullish`), urutan tanggal dicek `:99-101`; `docs.dbml` baris ±1977
    menulis "Expiry is shown, never a status".
  - Diskon hanya `discountAmount` (`quotation.contract.ts:52`); `vatRateBps`
    diketik (`:94`), belum dari master (`ExportedTaxService` belum punya
    tarif PPN bertanggal).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/sale/contracts/quotation.contract.ts` | `validUntil` wajib (bawaan +14 di layar); alasan perubahan PPN |
| backend | `apps/backend/src/app/sale/services/quotation.service.ts` | Isi tarif PPN dari master; tolak tarif berbeda tanpa alasan |
| backend (Oki) | `apps/backend/src/app/tax/services/exported-tax.service.ts` | Metode tarif PPN pada tanggal (diminta ke Oki, K11) |
| web-admin | `apps/web-admin/src/components/sales/quotation-form.tsx` | Bawaan +14 hari; diskon Rp/%; PPN dari master + alasan; komponen P7-6 |
| web-admin | `apps/web-admin/src/routes/_authed/sales/quotes/$quotationId/index.tsx`, `apps/web-admin/src/routes/_authed/sales/quotes/index.tsx` | Badge Kedaluwarsa (turunan tanggal); konfirmasi; tombol Revisi |
| locale | `packages/locales/src/{en,id}/sales.ts` | Teks FU3 |
| test | `apps/backend/test/unit/quotation.service.test.ts`, `apps/web-admin/test/unit/quotation-helpers.test.ts` | Berlaku sampai wajib; diskon % → jumlah; PPN master |

- **Skema/migrasi:** Mungkin: kolom alasan perubahan PPN di
  `sale.quotations` (OC4 "pengecualian per dokumen dengan alasan"); diskon %
  dihitung di layar dan disimpan sebagai `discount_amount` (dicek saat desain).
  Kedaluwarsa tetap turunan, bukan status.
- **UAT:**
  1. SPH baru → Berlaku sampai terisi Tanggal SPH + 14 hari; dikosongkan →
     "Berlaku sampai wajib diisi."
  2. Diskon 10% pada baris Rp 1.000.000 → kolom Rp terisi 100.000.
  3. Ubah tarif PPN → isian Alasan muncul dan wajib.
  4. SPH lewat Berlaku sampai → label Kedaluwarsa di daftar.
- **Bergantung pada:** P7-3, P7-6; tarif PPN master dari Oki (OC4).

**Prompt AI (salin):**

```text
Kerjakan PH-SPH Halaman Penawaran (SPH).
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian PH-SPH (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/sale/contracts/quotation.contract.ts, apps/backend/src/app/sale/services/quotation.service.ts, apps/backend/src/app/tax/services/exported-tax.service.ts, apps/web-admin/src/components/sales/quotation-form.tsx, apps/web-admin/src/routes/_authed/sales/quotes/$quotationId/index.tsx, apps/web-admin/src/routes/_authed/sales/quotes/index.tsx, packages/locales/src/{en,id}/sales.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/quotation.service.test.ts, apps/web-admin/test/unit/quotation-helpers.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri PH-SPH terpenuhi; buat docs/adjustment/5-pengerjaan/uat/PH-SPH.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-33 PPh 23 dipotong pelanggan di kuitansi (Tinggi, KF-K3, KF-T3, bersama Oki M09-17)

- **Seharusnya:**
  - Form kuitansi punya isian **potongan PPh 23** (jumlah, no. bukti potong
    opsional); jumlah diterima + potongan menutup sisa faktur, faktur bisa
    Lunas (KF-K3).
  - Akun "PPh 23 dibayar dimuka" dan bupot sebagai kredit pajak di sisi Oki
    (M09-17, M10-13).
- **Sekarang:**
  - `sale/services/invoice.service.ts:477-486` `addReceipt` hanya membandingkan
    `amount` dengan sisa; `sale/contracts/invoice.contract.ts:153`
    `createReceiptSchema` tanpa potongan; `sale.receipts` tanpa kolom
    potongan (`docs.dbml` baris 2415-2447).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`sale.receipts`) | `withholding_amount bigint`, `withholding_tax_id uuid` (logical ref `tax.taxes`), `withholding_slip_number` (nama final saat desain) |
| skema | `apps/backend/drizzle/schemas/sale.schema.ts` | Sama + CHECK `withholding_amount >= 0` |
| backend | `apps/backend/src/app/sale/contracts/invoice.contract.ts`, `services/invoice.service.ts` | `amount + withholding ≤ outstanding`; status faktur dihitung dari keduanya |
| backend | `apps/backend/src/app/sale/services/receipt-ledger.service.ts` | Kirim potongan ke posting jurnal Oki (port finance; dicek saat desain) |
| web-admin | `apps/web-admin/src/routes/_authed/sales/invoices/$invoiceId/index.tsx`, `apps/web-admin/src/lib/invoice-api.ts` | Isian potongan PPh 23 di dialog kuitansi |
| locale | `packages/locales/src/{en,id}/finance.ts` (kunci `receipt.*`), `api.ts` | Teks |
| test | `apps/backend/test/unit/invoice-billing.service.test.ts` / `invoice-summary.test.ts` | Faktur 100, bayar 98 + PPh 2 → lunas |

- **Skema/migrasi:** Ya: `sale.receipts` (kolom potongan); `docs.dbml` dulu;
  logical reference ke `tax.taxes` lewat kontrak modul `tax`.
- **UAT:**
  1. Faktur jasa Rp 10.000.000 → Catat pembayaran Rp 9.800.000 + PPh 23
     Rp 200.000 → faktur Lunas.
  2. Kuitansi menampilkan potongan PPh 23.
  3. Potongan + bayar melebihi sisa → ditolak dengan pesan.
- **Bergantung pada:** M09-17 / M10-13 (Oki), P7-6.

**Prompt AI (salin):**

```text
Kerjakan B-33 PPh 23 dipotong pelanggan di kuitansi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-33 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, sale.receipts, apps/backend/drizzle/schemas/sale.schema.ts, apps/backend/src/app/sale/contracts/invoice.contract.ts, services/invoice.service.ts, apps/backend/src/app/sale/services/receipt-ledger.service.ts, apps/web-admin/src/routes/_authed/sales/invoices/$invoiceId/index.tsx, apps/web-admin/src/lib/invoice-api.ts, packages/locales/src/{en,id}/finance.ts, receipt.*, api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/invoice-billing.service.test.ts, invoice-summary.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-33 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-33.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-37 Halaman cetak SO, kuitansi, BPB, retur (Tinggi, alur lengkap 6, NM-11)

- **Seharusnya:**
  - Halaman cetak/PDF untuk **kuitansi** (lebih dulu), **SO**, **BPB**,
    **retur pembelian**, **retur penjualan**, mengikuti kop surat dan contoh
    surat perusahaan (NM-11; contoh kuitansi/SO/BPB/retur diminta ke Aqim).
  - Dipakai juga untuk unduhan portal (B-38 P5).
- **Sekarang:**
  - Cetak sudah ada untuk SPH, PO, faktur, surat jalan, BAST, garansi
    (`sales/quotes/$quotationId/print.tsx`,
    `procurement/purchase-orders/$purchaseOrderId/print.tsx`,
    `sales/invoices/$invoiceId/print.tsx`,
    `sales/deliveries/$deliveryNoteId/print.tsx`, `projects/$projectId/bast/...`).
  - Tidak ada untuk SO (`sales/orders/$orderId.tsx` file tunggal), kuitansi
    (`sales/receipts/index.tsx` saja), BPB (`procurement/receipts/$receiptId.tsx`),
    retur (`procurement/purchase-returns/...`, `sales/returns/...`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `apps/web-admin/src/routes/_authed/sales/receipts/$receiptId/print.tsx` (baru) + `apps/web-admin/src/components/sales/receipt-document.tsx` (baru) | Kuitansi (terbilang dari `lib/terbilang.ts`) |
| web-admin | `apps/web-admin/src/routes/_authed/sales/orders/$orderId_.print.tsx` (baru) + `components/sales/sales-order-document.tsx` (baru) | SO |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/receipts/$receiptId_.print.tsx` (baru) + `components/procurement/goods-receipt-document.tsx` (baru) | BPB |
| web-admin | `apps/web-admin/src/routes/_authed/procurement/purchase-returns/$purchaseReturnId/print.tsx` (baru), `apps/web-admin/src/routes/_authed/sales/returns/$salesReturnId/print.tsx` (baru) + komponen dokumen | Retur |
| web-admin | Halaman detail terkait | Tombol Cetak |
| backend | `apps/backend/src/app/sale/controllers/invoice.controller.ts` / `receipt.controller.ts` | Endpoint detail kuitansi bila belum ada (dicek saat desain) |
| backend | `apps/backend/src/app/sale/controllers/quotation-render.controller.ts` (pola) | Render PDF server untuk kuitansi/SO bila dibutuhkan portal (dicek saat desain) |
| locale | `packages/locales/src/{en,id}/sales.ts`, `procurement.ts` | Label dokumen |
| test | `apps/web-admin/test/unit/` (helper total/terbilang bila baru) | — |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Detail faktur → kuitansi → Cetak → kuitansi berkop, nomor, jumlah,
     terbilang, tanda tangan.
  2. Cetak SO, BPB, retur pembelian, retur penjualan dari detailnya.
- **Bergantung pada:** contoh surat dari Aqim (NM-11).

**Prompt AI (salin):**

```text
Kerjakan B-37 Halaman cetak SO, kuitansi, BPB, retur.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-37 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/web-admin/src/routes/_authed/sales/receipts/$receiptId/print.tsx, apps/web-admin/src/components/sales/receipt-document.tsx, apps/web-admin/src/routes/_authed/sales/orders/$orderId_.print.tsx, components/sales/sales-order-document.tsx, apps/web-admin/src/routes/_authed/procurement/receipts/$receiptId_.print.tsx, components/procurement/goods-receipt-document.tsx, apps/web-admin/src/routes/_authed/procurement/purchase-returns/$purchaseReturnId/print.tsx, apps/web-admin/src/routes/_authed/sales/returns/$salesReturnId/print.tsx, apps/backend/src/app/sale/controllers/invoice.controller.ts, receipt.controller.ts, apps/backend/src/app/sale/controllers/quotation-render.controller.ts, packages/locales/src/{en,id}/sales.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/web-admin/test/unit/ (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-37 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-37.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-40 Riwayat dan saldo pelanggan (Tinggi, KF-S1)

- **Seharusnya:**
  - Detail pelanggan menampilkan tab/kartu **SPH, SO, faktur, sisa piutang,
    proyek, lisensi, tiket** (KF-S1), masing-masing dengan tautan.
- **Sekarang:**
  - `crm/customers/$customerId.tsx:231` kartu data, alamat, kartu portal saja.
  - Filter `customerId` sudah ada di daftar SPH
    (`quotation.contract.ts:130`), SO (`sales-order.contract.ts:35`), faktur
    (`invoice.contract.ts:99`), lisensi (`licensing.contract.ts:71`); **belum**
    di daftar proyek (`project.contract.ts:43-49`) dan tiket
    (`ticket.contract.ts:51-56`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/project/contracts/project.contract.ts`, `repositories/project.repository.ts` | Filter `customerId` |
| backend | `apps/backend/src/app/ticket/contracts/ticket.contract.ts`, repositori tiket | Filter `customerId` |
| backend | `apps/backend/src/app/sale/services/invoice.service.ts` (atau `invoice-lookup.service.ts`) | Ringkasan sisa piutang per pelanggan (endpoint `GET /sales/invoices/summary?customerId=`, dicek saat desain) |
| web-admin | `apps/web-admin/src/routes/_authed/crm/customers/$customerId.tsx` | Kartu saldo + tab riwayat |
| web-admin | `apps/web-admin/src/components/crm/customer-history.tsx` (baru) | Tabel per jenis, memakai `lib/quotation-api.ts`, `sales-order-api.ts`, `invoice-api.ts`, `project-api.ts`, `license-api.ts`, `service-ticket-api.ts` |
| locale | `packages/locales/src/{en,id}/crm.ts` | Teks |
| test | `apps/backend/test/unit/project.service.test.ts`, `service-ticket.service.test.ts` | Filter pelanggan; hak lihat tetap per modul |

- **Skema/migrasi:** Tidak (indeks `customer_id` pada `project.projects` dan
  `ticket.tickets` dicek saat desain).
- **UAT:**
  1. Buka pelanggan yang punya SPH, SO, faktur → semua tampil dengan tautan.
  2. Kartu saldo menunjukkan total sisa piutang sama dengan jumlah sisa faktur.
  3. Pengguna tanpa hak lihat faktur tidak melihat tab faktur.
- **Bergantung pada:** —.

**Prompt AI (salin):**

```text
Kerjakan B-40 Riwayat dan saldo pelanggan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-40 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/project/contracts/project.contract.ts, repositories/project.repository.ts, apps/backend/src/app/ticket/contracts/ticket.contract.ts, apps/backend/src/app/sale/services/invoice.service.ts, invoice-lookup.service.ts, apps/web-admin/src/routes/_authed/crm/customers/$customerId.tsx, apps/web-admin/src/components/crm/customer-history.tsx, packages/locales/src/{en,id}/crm.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/project.service.test.ts, service-ticket.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-40 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-40.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-41 Kirim SPH/faktur tanpa n8n (Tinggi, KF-S2)

- **Seharusnya:**
  - Detail SPH dan faktur: **Unduh PDF**, **Salin tautan** berbagi, tombol
    **WhatsApp** (`wa.me` dengan teks + tautan) dan **email** (`mailto:`)
    (KF-S2).
- **Sekarang:**
  - PDF SPH dan tautan 30 hari hanya dibuat di antrean dan dikirim ke n8n:
    `sale/services/quotation-delivery.service.ts:25-35,64-68`. Faktur hanya
    punya halaman cetak `sales/invoices/$invoiceId/print.tsx`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/sale/services/quotation-delivery.service.ts`, `controllers/quotation.controller.ts` | Endpoint ambil/buat tautan PDF SPH (`GET /sales/quotations/:id/share-link`) |
| backend | `apps/backend/src/app/sale/controllers/invoice.controller.ts` (+ service) | Sama untuk faktur (render lewat pola `quotation-render.controller.ts`) |
| web-admin | `apps/web-admin/src/routes/_authed/sales/quotes/$quotationId/index.tsx`, `apps/web-admin/src/routes/_authed/sales/invoices/$invoiceId/index.tsx` | Menu Kirim: unduh, salin, WA, email |
| web-admin | `apps/web-admin/src/lib/share-links.ts` (baru) | Penyusun URL `wa.me` (nomor dari `lib/phone.ts`) dan `mailto:` |
| locale | `packages/locales/src/{en,id}/sales.ts` | Teks pesan bawaan |
| test | `apps/backend/test/unit/quotation-delivery.service.test.ts`; `apps/web-admin/test/unit/share-links.test.ts` (baru) | Tautan dibuat sekali; format `wa.me` |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Detail SPH terkirim → Unduh PDF mengunduh SPH.
  2. Salin tautan → tautan dibuka di jendela samaran menampilkan PDF.
  3. Tombol WhatsApp membuka `wa.me/62...` dengan teks dan tautan.
- **Bergantung pada:** Chromium di server (P7-7, Oki).

**Prompt AI (salin):**

```text
Kerjakan B-41 Kirim SPH/faktur tanpa n8n.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-41 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/sale/services/quotation-delivery.service.ts, controllers/quotation.controller.ts, apps/backend/src/app/sale/controllers/invoice.controller.ts, apps/web-admin/src/routes/_authed/sales/quotes/$quotationId/index.tsx, apps/web-admin/src/routes/_authed/sales/invoices/$invoiceId/index.tsx, apps/web-admin/src/lib/share-links.ts, packages/locales/src/{en,id}/sales.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/quotation-delivery.service.test.ts, apps/web-admin/test/unit/share-links.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-41 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-41.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-42 Faktur tanpa SO (Tinggi, KF-S6)

- **Seharusnya:**
  - Layar **Faktur baru** tanpa SO untuk jasa, biaya tambahan, perpanjangan
    lisensi: pelanggan, baris bebas/katalog, PPN, jatuh tempo wajib (FU9).
  - Dipakai juga dari tiket berbayar (B-31) dan lisensi.
- **Sekarang:**
  - Backend siap: `sale/contracts/invoice.contract.ts:32-33` (`customerId`,
    `orderId` nullable). Web hanya membuat faktur dari SO:
    `components/finance/billing-card.tsx:132`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `apps/web-admin/src/routes/_authed/sales/invoices/new.tsx` (baru) | Form faktur tanpa SO (komponen P7-6), parameter opsional `ticketId`/`licenseContractId` untuk isi awal |
| web-admin | `apps/web-admin/src/components/sales/invoice-form.tsx` (baru) | Baris barang/jasa, total |
| web-admin | `apps/web-admin/src/routes/_authed/sales/invoices/index.tsx`, `apps/web-admin/src/lib/invoice-api.ts` | Tombol "+ Faktur baru"; `createInvoice` tanpa `orderId` |
| backend | `apps/backend/src/app/sale/services/invoice.service.ts` | Validasi pelanggan aktif lewat kontrak `customer`; jatuh tempo wajib saat terbit (FU9) |
| locale | `packages/locales/src/{en,id}/finance.ts` / `sales.ts` | Teks |
| test | `apps/backend/test/unit/invoice-billing.service.test.ts` | Faktur tanpa SO: buat, terbit, bayar |

- **Skema/migrasi:** Tidak (kecuali kolom sumber tiket di B-31).
- **UAT:**
  1. Penagihan → Faktur baru → pilih pelanggan, baris "Jasa servis" Rp 500.000
     → simpan draf → terbitkan → bernomor.
  2. Catat pembayaran → Lunas.
- **Bergantung pada:** P7-6.

---

**Prompt AI (salin):**

```text
Kerjakan B-42 Faktur tanpa SO.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-42 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/web-admin/src/routes/_authed/sales/invoices/new.tsx, apps/web-admin/src/components/sales/invoice-form.tsx, apps/web-admin/src/routes/_authed/sales/invoices/index.tsx, apps/web-admin/src/lib/invoice-api.ts, apps/backend/src/app/sale/services/invoice.service.ts, packages/locales/src/{en,id}/finance.ts, sales.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/invoice-billing.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-42 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-42.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Langkah 8: Proyek, tiket, portal pelanggan

### B-30 Cek garansi barang tanpa proyek (Tinggi, KF-P2)

- **Seharusnya:**
  - Seri yang dijual lewat SO biasa (tanpa proyek) dinilai garansinya dari
    `item_serials.warranty_expires_on`, atau tanggal kirim SO + masa garansi
    produk (KF-P2).
  - Seri tidak ditemukan atau garansi habis: tiket tetap dibuat, ditandai
    berbayar (FU10).
- **Sekarang:**
  - `project/services/warranty.service.ts:182-205` hanya lewat seri →
    pengiriman → **proyek** → sertifikat; tanpa proyek selalu
    `inWarranty: false`. Kolom `inventory.item_serials.warranty_expires_on`
    (`inventory.schema.ts:496`) tidak dipakai. Produk tidak punya kolom masa
    garansi.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/project/services/warranty.service.ts` | Urutan cek: sertifikat proyek → `warranty_expires_on` seri → tanggal kirim + masa garansi produk |
| backend | `apps/backend/src/app/inventory/services/exported-inventory.service.ts` | Metode baca garansi seri (kontrak lintas modul) |
| backend | `apps/backend/src/app/sale/services/sales-fulfilment.service.ts` | `findShipmentBySerial` mengembalikan tanggal kirim (dicek) |
| backend | `apps/backend/src/app/sale/services/delivery-note.service.ts` | Saat kirim tanpa proyek: isi `warranty_expires_on` seri (opsional, dicek saat desain) |
| docs/skema | `docs/database/docs.dbml` (`product.products`), `apps/backend/drizzle/schemas/product.schema.ts` | Kolom masa garansi (bulan) bila dipilih |
| web-admin | `apps/web-admin/src/components/inventory/item-form.tsx` | Isian masa garansi produk (bila kolom dibuat) |
| web-admin | `apps/web-admin/src/routes/_authed/tickets/new.tsx` | Peringatan kuning FU10 |
| test | `apps/backend/test/unit/handover-warranty.test.ts` | Seri dari SO tanpa proyek dalam/luar garansi |

- **Skema/migrasi:** Mungkin: `product.products.warranty_months` (nama final
  saat desain); `docs.dbml` dulu.
- **UAT:**
  1. Jual barang bernomor seri lewat SO tanpa proyek, kirim → buat tiket dengan
     seri itu → "Dalam garansi" sampai tanggal yang benar.
  2. Seri tidak dikenal → peringatan kuning, tiket ditandai berbayar.
- **Bergantung pada:** —.

**Prompt AI (salin):**

```text
Kerjakan B-30 Cek garansi barang tanpa proyek.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-30 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/project/services/warranty.service.ts, apps/backend/src/app/inventory/services/exported-inventory.service.ts, apps/backend/src/app/sale/services/sales-fulfilment.service.ts, apps/backend/src/app/sale/services/delivery-note.service.ts, docs/database/docs.dbml, product.products, apps/backend/drizzle/schemas/product.schema.ts, apps/web-admin/src/components/inventory/item-form.tsx, apps/web-admin/src/routes/_authed/tickets/new.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/handover-warranty.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-30 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-30.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-31 Tiket berbayar bisa ditagih (Tinggi, KF-P1)

- **Seharusnya:**
  - Dari tiket **selesai** yang berbayar (di luar garansi, `service_cost > 0`)
    tersedia tombol **Buat SPH** dan **Buat faktur** dengan biaya servis terisi
    (KF-P1).
  - Tiket menyimpan tautan ke SPH/faktur yang dibuat, agar tidak ditagih dua
    kali.
- **Sekarang:**
  - `ticket.tickets.service_cost` tersimpan (`docs.dbml` baris 5182) tetapi
    tidak dibaca modul lain; detail tiket hanya Selesaikan/Tutup
    (`routes/_authed/tickets/$ticketId.tsx:147-153`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs/skema | `docs/database/docs.dbml` (`sale.invoices`, `sale.quotations`), `apps/backend/drizzle/schemas/sale.schema.ts` | `ticket_id uuid` logical ref (atau sebaliknya di `ticket.tickets`; arah dicek saat grill) |
| backend | `apps/backend/src/app/ticket/services/exported-ticket.service.ts` (baru) + token di `ticket/constants/di.ts` | `resolveBillableTicket(id)` untuk dipakai `sale` |
| backend | `apps/backend/src/app/sale/services/invoice.service.ts`, `quotation.service.ts` | Terima `ticketId`, validasi lewat kontrak tiket, tolak bila sudah ditagih |
| web-admin | `apps/web-admin/src/routes/_authed/tickets/$ticketId.tsx` | Tombol Buat SPH / Buat faktur → `sales/quotes/new` atau `sales/invoices/new` (B-42) dengan `ticketId` |
| locale | `packages/locales/src/{en,id}/projects.ts` (`ticket.*`) | Teks |
| test | `apps/backend/test/unit/service-ticket.service.test.ts`, `invoice-billing.service.test.ts` | Tiket garansi tidak bisa ditagih; tagih dua kali ditolak |

- **Skema/migrasi:** Ya (kolom tautan tiket); `docs.dbml` dulu, logical
  reference + kontrak di modul `ticket`.
- **UAT:**
  1. Tiket di luar garansi, selesaikan dengan biaya Rp 350.000 → tombol Buat
     faktur → form faktur terisi pelanggan dan baris biaya servis.
  2. Setelah faktur dibuat, tombol berubah jadi tautan ke faktur itu.
  3. Tiket dalam garansi → tombol tidak tampil.
- **Bergantung pada:** B-42, B-30.

**Prompt AI (salin):**

```text
Kerjakan B-31 Tiket berbayar bisa ditagih.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-31 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, sale.invoices, sale.quotations, apps/backend/drizzle/schemas/sale.schema.ts, apps/backend/src/app/ticket/services/exported-ticket.service.ts, ticket/constants/di.ts, apps/backend/src/app/sale/services/invoice.service.ts, quotation.service.ts, apps/web-admin/src/routes/_authed/tickets/$ticketId.tsx, packages/locales/src/{en,id}/projects.ts, ticket.*.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/service-ticket.service.test.ts, invoice-billing.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-31 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-31.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-35 Notifikasi tugas proyek ke teknisi (Tinggi, alur lengkap 7)

- **Seharusnya:**
  - Teknisi diberi notifikasi saat **tugas proyek** ditugaskan kepadanya dan
    saat tenggat dekat (seperti tugas SDM), muncul di portal karyawan dan
    Perlu Tindakan (B-35, N8-3).
- **Sekarang:**
  - `project/services/project.service.ts:408-421` `addTask`/`updateTask` tanpa
    notifikasi; tugas SDM sudah memanggil `notify` dengan `hr.task_assigned`
    (`human-resource/services/task.service.ts:42-55`). Kode template di
    `drizzle/schemas/notification.schema.ts:44-56`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/drizzle/schemas/notification.schema.ts` | Kode `project.task_assigned`, `project.task_due` + alias |
| backend | `apps/backend/database/seeders/seed/notification-templates.seeder.ts` | Template baru |
| backend | `apps/backend/src/app/project/services/project.service.ts`, `project/container.ts` | Panggil `ExportedNotificationService.notify` saat penugasan berubah |
| backend | `apps/backend/src/app/project/queues/task-due.queue.ts` (baru), `task-due.worker.ts` (baru) | Pengingat tenggat (pola `license-due.queue.ts`; butuh `SCHEDULER_ENABLED`) |
| locale | `packages/locales/src/{en,id}/notifications.ts` | Teks notifikasi |
| test | `apps/backend/test/unit/project.service.test.ts`, `notification.producers.test.ts` | Penugasan memicu notifikasi; tanpa perubahan petugas tidak |

- **Skema/migrasi:** Tidak bila kode template hanya konstanta (CHECK di
  `notification.schema.ts` baris 109/157/161 dicek saat desain).
- **UAT:**
  1. Tugaskan tugas proyek ke Teknisi → lonceng/portal karyawan menampilkan
     "Tugas baru: {judul}".
  2. Tugas dengan tenggat besok → pengingat muncul.
- **Bergantung pada:** P7-7 (scheduler aktif).

**Prompt AI (salin):**

```text
Kerjakan B-35 Notifikasi tugas proyek ke teknisi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-35 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/drizzle/schemas/notification.schema.ts, apps/backend/database/seeders/seed/notification-templates.seeder.ts, apps/backend/src/app/project/services/project.service.ts, project/container.ts, apps/backend/src/app/project/queues/task-due.queue.ts, task-due.worker.ts, packages/locales/src/{en,id}/notifications.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/project.service.test.ts, notification.producers.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-35 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-35.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-36 Tombol konfirmasi tiket di portal pelanggan (Tinggi, alur lengkap 10)

- **Seharusnya:**
  - Tiket **Selesai (resolved)** di portal menampilkan tombol **Konfirmasi
    selesai**; setelah diklik tiket **Ditutup** (B-36, FU10).
- **Sekarang:**
  - Backend ada: `customer/controllers/portal.controller.ts:312-314`
    (`POST /customers/portal/v1/tickets/:id/confirm`). Portal belum memetakan:
    `web-customer-portal/src/services/portal/erp-routes.ts:57-61`; halaman
    `pages/support/[id].astro:26,100` hanya teks "This ticket is resolved".
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| portal | `apps/web-customer-portal/src/services/portal/erp-routes.ts` | `confirmTicket: ${PORTAL}/tickets/:id/confirm` |
| portal | `apps/web-customer-portal/src/api/portal.ts`, `apps/web-customer-portal/src/services/portal/demo.ts` | Metode `confirmTicket` (sumber ERP + demo) |
| portal | `apps/web-customer-portal/src/actions/index.ts` | Action konfirmasi + flash |
| portal | `apps/web-customer-portal/src/pages/support/[id].astro` | Tombol + konfirmasi; teks Indonesia |
| test | `apps/web-customer-portal/src/services/portal/erp-source.test.ts` | Panggilan POST ke rute benar |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Staf menyelesaikan tiket → pelanggan membuka tiket di portal → tombol
     Konfirmasi selesai.
  2. Klik → status Ditutup di portal dan di web-admin.
- **Bergantung pada:** —.

**Prompt AI (salin):**

```text
Kerjakan B-36 Tombol konfirmasi tiket di portal pelanggan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-36 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/web-customer-portal/src/services/portal/erp-routes.ts, apps/web-customer-portal/src/api/portal.ts, apps/web-customer-portal/src/services/portal/demo.ts, apps/web-customer-portal/src/actions/index.ts, apps/web-customer-portal/src/pages/support/[id].astro.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/web-customer-portal/src/services/portal/erp-source.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-36 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-36.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-38 Portal pelanggan dan website: pesanan online (Tinggi, PP-1–PP-8, T21, T25)

Butuh rancangan dulu (Gate 1 + Gate 2 per bagian). Rencana port:
`docs/plan/port-portal-onto-main.md`; kode lama di cabang
`feat/erp-0069-portal-session` (di-port, tidak digabung).

- **Seharusnya:**
  - Urutan PP-8: (1) **P2 + P7** akun portal (satu jenis akun, Google, PP-3)
    dan modul `website` (schema ke-21, ADR baru); (2) **P3** keranjang → draf
    SPH (PP-1, PP-2), pemegang Bilal (PP-4), terima/revisi SPH → SO, faktur
    termin tampil dengan tombol Bayar dan tautan gateway otomatis (PP-5),
    ketersediaan stok tampil (PP-6); (3) **P5** unduh dokumen + notifikasi;
    (4) **P4** lacak pesanan.
  - Data perusahaan dari portal = permintaan yang diperiksa Penjualan (PP-7).
- **Sekarang:**
  - Portal: `web-customer-portal/src/services/portal/erp-routes.ts:22-23`
    menyatakan belum ada rute backend untuk pesanan, SPH, faktur, bayar;
    halaman `pages/orders/`, `pages/quotations/`, `pages/payments/` masih data
    demo (`services/portal/demo.ts`). Website: `apps/web-landing/src/pages/cart.astro`,
    `checkout.astro` belum tersambung.
  - Login portal masih email + kata sandi (`customer/services/portal-auth.service.ts`).
- **File yang diubah (garis besar per bagian):**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml`, `AGENTS.md`, `docs/database/module-ownership.md`, `docs/architecture/decisions/` (ADR baru) | Schema `website` (P7) dan tabel keranjang/wishlist di `customer` |
| skema | `apps/backend/drizzle/schemas/website.schema.ts` (baru), `customer.schema.ts` | Tabel P7 / keranjang (dicek saat desain) |
| backend | `apps/backend/src/app/website/` (baru: `container.ts`, `controllers/`, `services/`, `repositories/`, `contracts/`) | Modul website + mount di `src/index.ts` dan `src/app/app.ts` |
| backend | `apps/backend/src/app/customer/controllers/portal.controller.ts`, `customer/services/portal.service.ts`, `portal-auth.service.ts` | Rute portal pesanan/SPH/faktur/bayar; login Google (K13) |
| backend | `apps/backend/src/app/sale/services/quotation.service.ts` (+ kontrak ekspor `sale`) | Buat draf SPH dari keranjang; terima/minta revisi dari portal |
| backend | `apps/backend/src/app/payment/` (Oki, kontrak ekspor) | Tautan gateway per faktur dari portal (PP-5) |
| portal | `apps/web-customer-portal/src/services/portal/erp-routes.ts`, `src/api/portal.ts`, `src/actions/index.ts`, `src/pages/orders/*`, `src/pages/quotations/*`, `src/pages/payments/*`, `src/pages/documents.astro`, `src/pages/track.astro` | Ganti demo dengan ERP |
| website | `apps/web-landing/src/pages/cart.astro`, `checkout.astro`, `track.astro` | Keranjang dan checkout ke ERP |
| web-admin | `apps/web-admin/src/routes/_authed/integrations/website-catalog/index.tsx` dan rute editor website (baru) | Editor modul website; pengaturan petugas bawaan (PP-4) |
| locale | `packages/locales/src/{en,id}/sales.ts`, `crm.ts`, `integrations.ts` | Teks web-admin |
| test | `apps/backend/test/unit/portal-data.test.ts`, `portal-account.test.ts`, `quotation.service.test.ts`; `apps/web-customer-portal/src/services/portal/erp-source.test.ts` | Per bagian |

- **Skema/migrasi:** Ya (schema `website` baru, tabel keranjang/wishlist,
  kemungkinan kolom sumber pesanan online di `sale.quotations`); `docs.dbml`
  dulu dan ADR baru.
- **UAT (ringkas, rinci per bagian saat desain):**
  1. Pelanggan masuk portal dengan Google → isi keranjang (1 barang berharga +
     1 "harga menyusul") → checkout → muncul draf SPH di Perlu Tindakan Bilal.
  2. Bilal melengkapi harga, mengajukan; Agus MD menyetujui; kirim → pelanggan
     melihat SPH di portal dan klik Terima → SO terbentuk.
  3. Bella menerbitkan faktur termin → faktur tampil di portal dengan tombol
     Bayar → bayar di gateway → faktur Lunas, kuitansi bisa diunduh.
  4. Lacak pesanan menunjukkan tahap sesuai status SO.
- **Bergantung pada:** B-37 (PDF SO/kuitansi untuk P5), B-46 (notifikasi),
  K13/B-24 (login Google), C1/B-22 (status SO otomatis untuk P4), Oki
  (payment, gateway).

---

**Prompt AI (salin):**

```text
Kerjakan B-38 Portal pelanggan dan website: pesanan online.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-38 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, AGENTS.md, docs/database/module-ownership.md, docs/architecture/decisions/, apps/backend/drizzle/schemas/website.schema.ts, customer.schema.ts, apps/backend/src/app/website/, container.ts, controllers/, services/, repositories/, contracts/.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/portal-data.test.ts, portal-account.test.ts, quotation.service.test.ts, apps/web-customer-portal/src/services/portal/erp-source.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-38 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-38.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Langkah 8: SDM

### B-45 Penempatan Kantor/Lapangan, Freelance, dan tarif (Tinggi, KL-1–KL-12)

- **Seharusnya:**
  - Data karyawan: **Penempatan Kantor/Lapangan** (dua pilihan, KL-1, KL-11),
    jenis kepegawaian **Freelance** (KL-3), **tarif freelance harian atau
    borongan** per orang (KL-4).
  - Freelance tanpa kuota cuti dan tanpa gaji bulanan; rekap **hari kerja sah**
    = check-in lokasi diterima + laporan harian hari itu (KL-4).
  - Karyawan kantor dengan tugas proyek bekerja cara lapangan hari itu tanpa
    mengubah penempatan (KL-7); pilihan petugas tugas proyek = semua karyawan
    aktif + label, isian **jam mulai lapangan** opsional (KL-9, tampilan 6.4).
  - Pembayaran upah freelance oleh Bella (M09-18, Oki); menu portal (PK-10, Oki).
- **Sekarang:**
  - `employment_type` CHECK tanpa `freelance`
    (`drizzle/schemas/human-resource.schema.ts:165-166`,
    `packages/common/src/hr/employment.ts`); `work_type` = onsite/remote/hybrid
    (`docs.dbml` HR employees), bukan penempatan; tidak ada kolom tarif.
  - Check-in lokasi di `project/services/site-attendance.service.ts:119-155`;
    `project.tasks` tanpa jam mulai lapangan.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`human_resource.employees`, `project.tasks`) | `placement` (`office`/`field`), `employment_type` + `freelance`, `freelance_rate_type` (`daily`/`lump_sum`), `freelance_daily_rate bigint`; `project.tasks.field_start_time` (nama final saat desain) |
| skema | `apps/backend/drizzle/schemas/human-resource.schema.ts`, `project.schema.ts` | Sama |
| shared | `packages/common/src/hr/employment.ts` | `EMPLOYMENT_TYPES` + `freelance`; `PLACEMENTS` |
| backend | `apps/backend/src/app/human-resource/contracts/hr.contract.ts`, `services/employee.service.ts`, `services/leave.service.ts` | Isian baru; freelance tidak punya kuota cuti/lembur |
| backend | `apps/backend/src/app/human-resource/services/freelance-pay.service.ts` (baru) + controller (baru) | Rekap hari kerja sah per periode (data check-in lewat kontrak `project`, laporan harian dari B-44) |
| backend | `apps/backend/src/app/project/services/project.service.ts`, `contracts/project.contract.ts` | Jam mulai lapangan di tugas; petugas = karyawan aktif |
| backend | `apps/backend/src/app/human-resource/services/salary.service.ts` | Freelance dilewati di rekap gaji bulanan |
| web-admin | `apps/web-admin/src/components/hr/employee-create-dialog.tsx`, `employee-edit-form.tsx` | Isian penempatan, jenis, tarif |
| web-admin | `apps/web-admin/src/components/projects/project-tasks-card.tsx` | Label penempatan/jenis; jam mulai lapangan |
| web-admin | `apps/web-admin/src/routes/_authed/hr/freelance-pay/index.tsx` (baru), `apps/web-admin/src/lib/hr-api.ts`, `nav-config.ts` | Rekap upah freelance (tombol bayar milik Oki, M09-18) |
| locale | `packages/locales/src/{en,id}/hr.ts`, `projects.ts`, `nav.ts` | Teks |
| test | `apps/backend/test/unit/hr-records.service.test.ts`, `site-attendance.service.test.ts`, `freelance-pay.service.test.ts` (baru) | Freelance tanpa kuota; rekap hari sah |

- **Skema/migrasi:** Ya: `human_resource.employees` (penempatan, freelance,
  tarif), `project.tasks` (jam mulai lapangan); `docs.dbml` dulu.
- **UAT:**
  1. Ubah karyawan → pilih Penempatan Lapangan, simpan, tampil di detail.
  2. Karyawan baru jenis Freelance, tarif harian Rp 200.000 → tidak muncul di
     rekap gaji; tidak bisa mengajukan cuti.
  3. Freelance check-in di lokasi 3 hari + laporan harian 2 hari → rekap upah
     menunjukkan 2 hari sah × Rp 200.000.
  4. Tugas proyek: pilihan petugas memuat karyawan kantor dengan label "Kantor".
- **Bergantung pada:** B-44 (laporan harian untuk hari sah), P7-4 (hak
  Pekerja Lepas, Oki), M09-18 dan PK-10 (Oki).

**Prompt AI (salin):**

```text
Kerjakan B-45 Penempatan Kantor/Lapangan, Freelance, dan tarif.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-45 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, human_resource.employees, project.tasks, apps/backend/drizzle/schemas/human-resource.schema.ts, project.schema.ts, packages/common/src/hr/employment.ts, apps/backend/src/app/human-resource/contracts/hr.contract.ts, services/employee.service.ts, services/leave.service.ts, apps/backend/src/app/human-resource/services/freelance-pay.service.ts, apps/backend/src/app/project/services/project.service.ts, contracts/project.contract.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/hr-records.service.test.ts, site-attendance.service.test.ts, freelance-pay.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-45 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-45.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-39 Gaji memakai absensi dan pengaturan potongan (Tinggi, KF-H1, KF-H2, PG-1–PG-6)

- **Seharusnya:**
  - Pengaturan → Gaji (Aqim): aktif/tidak per potongan, toleransi terlambat
    (menit), nominal per keterlambatan, jenis cuti tidak dibayar (PG-1, PG-4).
  - Potongan per hari = gaji pokok ÷ hari kerja bulan itu dari jadwal (PG-2);
    dipotong alpa, izin tanpa gaji, terlambat, pro-rata masuk/keluar (PG-3).
  - Hari tugas lapangan: check-in pertama di kantor/lokasi = hadir; terlambat
    tidak dihitung kecuali ada jam mulai lapangan (PG-6, KL-8, KL-9).
  - **Upah lembur dihitung** dari jam lembur yang disetujui (KF-H2); potongan
    tampil per baris di rekap dan slip, bisa diubah SDM sebelum disetujui
    (PG-5).
- **Sekarang:**
  - `human-resource/services/salary.service.ts:182` mengisi
    `overtimePay: 0, deductions: 0`; `payroll-calculation.service.ts:38-55`
    hanya PPh 21/BPJS. `human_resource.employee_salary_records` hanya kolom
    `deductions` tunggal; `leave_types` tanpa penanda tidak dibayar.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`human_resource.employee_salary_records`, `leave_types`, `settings`) | Kolom rincian potongan (`absence_deduction`, `unpaid_leave_deduction`, `late_deduction`, `prorate_deduction`, `field_days`) + `overtime_hours`; `leave_types.is_paid`; kunci pengaturan potongan di `settings` (key-value) |
| skema | `apps/backend/drizzle/schemas/human-resource.schema.ts` | Sama |
| backend | `apps/backend/src/app/human-resource/services/payroll-deduction.service.ts` (baru) | Hitung hari kerja (jadwal), alpa, izin tanpa gaji, terlambat, pro-rata, hari lapangan |
| backend | `apps/backend/src/app/human-resource/services/salary.service.ts`, `payroll-calculation.service.ts` | Pakai hasil potongan + upah lembur (tarif lembur dari pengaturan, dicek saat desain) |
| backend | `apps/backend/src/app/human-resource/contracts/payroll-settings.contract.ts`, `controllers/payroll-settings.controller.ts`, `repositories/hr-settings.repository.ts` | Isian pengaturan potongan |
| backend | `apps/backend/src/app/project/services/site-attendance.service.ts` (kontrak ekspor) | Check-in lokasi per karyawan per hari untuk hari lapangan |
| backend | `apps/backend/src/app/human-resource/services/payslip.service.ts`, `apps/web-admin/src/components/hr/payslip-document.tsx` | Baris potongan di slip |
| web-admin | `apps/web-admin/src/routes/_authed/settings/payroll/index.tsx` | Bagian Potongan |
| web-admin | `apps/web-admin/src/routes/_authed/hr/payroll/index.tsx`, `apps/web-admin/src/components/hr/employee-salary-cards.tsx` | Kolom potongan, hari lapangan, lembur |
| locale | `packages/locales/src/{en,id}/hr.ts`, `settings.ts` | Teks |
| test | `apps/backend/test/unit/payroll-deduction.service.test.ts` (baru), `hr-salary-period.service.test.ts`, `hr-payslip.service.test.ts`, `payroll-statutory.test.ts` | Contoh angka PG-2; hari lapangan tanpa jam mulai tidak terlambat; lembur |

- **Skema/migrasi:** Ya: rincian potongan di `employee_salary_records`,
  `leave_types.is_paid`; pengaturan di `settings` (data, bukan kolom);
  `docs.dbml` dulu.
- **UAT:**
  1. Pengaturan → Gaji: aktifkan potongan alpa dan terlambat (toleransi 15
     menit, Rp 25.000/kejadian), simpan.
  2. Karyawan gaji Rp 4.400.000, 22 hari kerja, 1 alpa, 2 kali terlambat 20
     menit → rekap: potongan alpa Rp 200.000, terlambat Rp 50.000.
  3. Lembur 3 jam disetujui → upah lembur terisi di rekap.
  4. Hari check-in di lokasi proyek tanpa jam mulai lapangan → tidak terlambat.
- **Bergantung pada:** B-45 (hari lapangan, freelance dikecualikan).

**Prompt AI (salin):**

```text
Kerjakan B-39 Gaji memakai absensi dan pengaturan potongan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-39 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, human_resource.employee_salary_records, apps/backend/drizzle/schemas/human-resource.schema.ts, apps/backend/src/app/human-resource/services/payroll-deduction.service.ts, apps/backend/src/app/human-resource/services/salary.service.ts, payroll-calculation.service.ts, apps/backend/src/app/human-resource/contracts/payroll-settings.contract.ts, controllers/payroll-settings.controller.ts, repositories/hr-settings.repository.ts, apps/backend/src/app/project/services/site-attendance.service.ts, apps/backend/src/app/human-resource/services/payslip.service.ts, apps/web-admin/src/components/hr/payslip-document.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/payroll-deduction.service.test.ts, hr-salary-period.service.test.ts, hr-payslip.service.test.ts, payroll-statutory.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-39 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-39.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-44 Laporan kerja karyawan (Tinggi, LK-1–LK-7)

- **Seharusnya:**
  - Laporan harian wajib semua karyawan (termasuk freelance yang ditugaskan)
    di portal karyawan: pekerjaan, proyek/tugas, jam, foto, kendala, rencana
    besok (LK-1, LK-2).
  - Pengingat sore; hari tanpa laporan tercatat; boleh menyusul maks. 2 hari
    (LK-3).
  - Laporan mingguan/bulanan otomatis + ringkasan karyawan (LK-4); penilaian
    Aqim skor 1–5 per aspek + komentar (LK-5, LK-6); PDF per karyawan (LK-7).
- **Sekarang:**
  - `project.daily_reports`, `kpi_definitions`, `kpi_evaluations` hanya target
    di `docs.dbml` (baris 4886, 4942, 4968); tidak ada di Drizzle
    (`drizzle/schemas/project.schema.ts:11` hanya menyebut di komentar).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` | Pemilik tabel diputuskan saat grill (`human_resource` laporan kerja karyawan, atau `project.daily_reports` + tabel baru); tabel laporan periodik dan penilaian |
| skema | `apps/backend/drizzle/schemas/human-resource.schema.ts` atau `project.schema.ts` | Tabel laporan harian, ringkasan periode, penilaian |
| backend | `apps/backend/src/app/human-resource/services/work-report.service.ts` (baru), `repositories/work-report.repository.ts` (baru), `controllers/work-report.controller.ts` (baru), `contracts/work-report.contract.ts` (baru) | CRUD harian (batas susulan 2 hari), rangkuman otomatis, penilaian Aqim, PDF |
| backend | `apps/backend/src/app/human-resource/controllers/employee-portal.controller.ts`, `services/employee-portal.service.ts` | Rute portal karyawan untuk laporan saya |
| backend | `apps/backend/src/app/human-resource/queues/work-report-reminder.queue.ts` (baru) + worker | Pengingat sore + event n8n (B-46) |
| web-employee (Oki, PR bersama) | `apps/web-employee/src/routes/_authed.reports.tsx` (baru), `apps/web-employee/src/lib/portal-api.ts` | Layar isi laporan |
| web-admin | `apps/web-admin/src/routes/_authed/hr/work-reports/index.tsx` (baru), `apps/web-admin/src/components/hr/work-report-document.tsx` (baru), `lib/hr-api.ts`, `nav-config.ts` | Rekap, penilaian, PDF |
| locale | `packages/locales/src/{en,id}/hr.ts`, `employee.ts`, `notifications.ts` | Teks |
| test | `apps/backend/test/unit/work-report.service.test.ts` (baru); `apps/web-employee/test/unit/` | Susulan > 2 hari ditolak; rangkuman; hanya Aqim menilai |

- **Skema/migrasi:** Ya (tabel baru); `docs.dbml` dulu.
- **UAT:**
  1. Karyawan mengisi laporan harian di portal (dengan foto) → tampil "Sudah
     diisi pukul ..." .
  2. Hari kemarin belum diisi → tanda kuning, bisa diisi; 3 hari lalu → ditolak.
  3. Akhir minggu → laporan mingguan otomatis; Aqim memberi skor 1–5 dan
     komentar; unduh PDF per karyawan.
- **Bergantung pada:** B-45 (freelance), Oki (layar `web-employee`), P7-7
  (scheduler).

**Prompt AI (salin):**

```text
Kerjakan B-44 Laporan kerja karyawan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-44 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, apps/backend/drizzle/schemas/human-resource.schema.ts, project.schema.ts, apps/backend/src/app/human-resource/services/work-report.service.ts, repositories/work-report.repository.ts, controllers/work-report.controller.ts, contracts/work-report.contract.ts, apps/backend/src/app/human-resource/controllers/employee-portal.controller.ts, services/employee-portal.service.ts, apps/backend/src/app/human-resource/queues/work-report-reminder.queue.ts, apps/web-employee/src/routes/_authed.reports.tsx, apps/web-employee/src/lib/portal-api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/work-report.service.test.ts, apps/web-employee/test/unit/ (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-44 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-44.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M12-14-D Form ubah karyawan tidak menimpa role (Tinggi, KF-R2, bagian Dafrin)

- **Seharusnya:**
  - Menyimpan form Ubah Karyawan **tidak menghapus** role tambahan anggota;
    pengaturan beberapa role dilakukan di halaman Pengguna (M12-14, Oki).
- **Sekarang:**
  - `components/hr/employee-edit-form.tsx:95-109` dropdown satu role dan
    `updateMemberRole(..., [effectiveRole])` mengganti seluruh set role;
    `hiddenRoles` (`:103`) ikut hilang.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| web-admin | `apps/web-admin/src/components/hr/employee-edit-form.tsx` | Role tampil baca saja + tautan ke halaman Pengguna, atau simpan dengan mempertahankan role lain (keputusan bersama Oki) |
| locale | `packages/locales/src/{en,id}/hr.ts` | Teks tautan |
| test | `apps/web-admin/test/unit/` (helper gabung role bila dibuat) | Role lain tetap |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Anggota dengan dua role → ubah data karyawannya → simpan → kedua role
     tetap di halaman Pengguna.
- **Bergantung pada:** M12-14 (Oki, halaman Pengguna multi-role).

---

**Prompt AI (salin):**

```text
Kerjakan M12-14-D Form ubah karyawan tidak menimpa role.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian M12-14-D (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/web-admin/src/components/hr/employee-edit-form.tsx, packages/locales/src/{en,id}/hr.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/web-admin/test/unit/ (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M12-14-D terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-14-D.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Langkah 8: Proyek, integrasi, lintas modul

### B-48 Biaya perjalanan di proyek (Tinggi, BP-1–BP-6)

- **Seharusnya:**
  - Kategori biaya proyek baru **makan/konsumsi** dan **tiket perjalanan**;
    transport dirinci bensin/tol/parkir (BP-5).
  - **Uang makan harian** dihitung dari check-in lokasi sah (dalam/luar kota,
    nominal di Pengaturan → Perjalanan milik Oki) (BP-2).
  - Detail proyek → Biaya: per kategori dan **per orang** (tampilan BP).
  - Kasbon, pertanggungjawaban, klaim, batas: Oki (M09-19).
- **Sekarang:**
  - `COST_CATEGORIES` = material, transport, accommodation, subcontract, other
    (`drizzle/schemas/project.schema.ts:90-96`, CHECK `:381`); `project.costs`
    tanpa kolom orang/rincian transport (`docs.dbml` baris 4437-4466).
    Tampilan di `components/projects/project-costs-card.tsx`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`project.costs`) | Kategori `meal`, `travel_ticket`; `transport_kind` (`fuel`/`toll`/`parking`/`other`); `employee_id` logical ref ke `human_resource.employees` |
| skema | `apps/backend/drizzle/schemas/project.schema.ts` | Sama |
| backend | `apps/backend/src/app/project/contracts/project.contract.ts`, `services/project.service.ts`, `repositories/project.repository.ts` | Validasi kategori/rincian; ringkasan per orang |
| backend | `apps/backend/src/app/project/services/meal-allowance.service.ts` (baru) | Hitung uang makan dari `site_attendances` sah × nominal pengaturan (sumber pengaturan dari Oki, dicek saat desain) |
| web-admin | `apps/web-admin/src/components/projects/project-costs-card.tsx`, `apps/web-admin/src/lib/project-api.ts` | Kategori baru, rincian transport, tabel per orang, uang makan |
| locale | `packages/locales/src/{en,id}/projects.ts` | Teks kategori |
| test | `apps/backend/test/unit/project.service.test.ts`, `meal-allowance.service.test.ts` (baru) | Hari lapangan sah → uang makan; out_of_range tidak dihitung |

- **Skema/migrasi:** Ya: `project.costs` (kategori, rincian, orang);
  `docs.dbml` dulu.
- **UAT:**
  1. Catat biaya proyek kategori Makan dan Tiket perjalanan → tersimpan dan
     tampil per kategori.
  2. Biaya transport memilih rincian Tol.
  3. Teknisi check-in sah 3 hari luar kota → uang makan 3 × nominal luar kota
     tampil di biaya per orang.
- **Bergantung pada:** B-45, M09-19 (Oki, pengaturan dan kasbon).

**Prompt AI (salin):**

```text
Kerjakan B-48 Biaya perjalanan di proyek.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-48 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, project.costs, apps/backend/drizzle/schemas/project.schema.ts, apps/backend/src/app/project/contracts/project.contract.ts, services/project.service.ts, repositories/project.repository.ts, apps/backend/src/app/project/services/meal-allowance.service.ts, apps/web-admin/src/components/projects/project-costs-card.tsx, apps/web-admin/src/lib/project-api.ts, packages/locales/src/{en,id}/projects.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/project.service.test.ts, meal-allowance.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-48 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-48.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### B-46 n8n dan WhatsApp dijalankan sungguhan (Tinggi, N8-1–N8-10)

- **Seharusnya:**
  - Penerima di workflow mengikuti role baru; nomor WA staf dari profil
    pengguna (N8-4).
  - Event baru: dokumen menunggu persetujuan, pesanan online masuk, SO
    terkirim/selesai, pengingat laporan harian (N8-6).
  - Halaman **Pengaturan → Notifikasi WhatsApp** (Pemilik): sakelar per pesan
    pelanggan/pemasok, bawaan mati; status sakelar ikut di setiap event (N8-5).
  - Teks pesan dikelola di n8n (N8-9); WAHA nomor perusahaan; asisten AI aktif
    (N8-7). Server n8n: Oki (X-14).
- **Sekarang:**
  - 13 topik di `automation/contracts/outbox.contract.ts:11-31`; tidak ada
    pengaturan sakelar (tidak ada tabel `automation.settings`); workflow
    `docs/integrations/n8n/erp-event-router.workflow.json` memakai role lama.
    Nomor telepon pengguna ada di `auth.users.phone`
    (`drizzle/schemas/auth.schema.ts:61-63`).
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| docs | `docs/database/docs.dbml` (`automation`) | `automation.settings` (key-value, pola `sale.settings`) untuk sakelar |
| skema | `apps/backend/drizzle/schemas/automation.schema.ts` | Sama |
| backend | `apps/backend/src/app/automation/contracts/outbox.contract.ts` | Topik baru: `approval.pending`, `online_order.created`, `sales_order.delivered`, `sales_order.completed`, `work_report.reminder` (nama final saat desain) |
| backend | `apps/backend/src/app/automation/services/outbox.service.ts` | Sertakan `customerNotifications` (status sakelar) di payload |
| backend | `apps/backend/src/app/automation/services/notification-settings.service.ts` (baru), `controllers/notification-settings.controller.ts` (baru), `repositories/` | GET/PUT sakelar (hanya Pemilik) |
| backend | Penerbit event: `procurement`, `sale`, `inventory`, `human-resource` services (P7-3 titik persetujuan), `sale/services/sales-order.service.ts`, `human-resource` pengingat laporan (B-44) | Publish event baru |
| web-admin | `apps/web-admin/src/routes/_authed/settings/whatsapp-notifications/index.tsx` (baru), `apps/web-admin/src/lib/automation-api.ts`, `nav-config.ts` | Halaman sakelar |
| web-admin | `apps/web-admin/src/routes/_authed/integrations/webhooks/index.tsx` | Topik baru terlihat dan bisa dikirim ulang |
| web-admin | `apps/web-admin/src/components/profile/profile-edit-form.tsx` | Nomor WA staf (bila belum bisa diubah; bersama Oki) |
| integrasi | `docs/integrations/n8n/erp-event-router.workflow.json`, `docs/integrations/n8n/build-workflow.ts`, `docs/integrations/n8n/samples.ts`, `send-test-event.ts` | Penerima role baru, cek sakelar dari payload, teks dari `teks-pesan-wa-pelanggan.md` |
| locale | `packages/locales/src/{en,id}/settings.ts`, `integrations.ts`, `nav.ts` | Teks |
| test | `apps/backend/test/unit/outbox.service.test.ts`, `sales-invoice-events.test.ts`, `whatsapp-assistant.test.ts` | Payload membawa sakelar; topik baru |
| docs | `docs/user-guide/n8n-workflows.id.md`, `docs/user-guide/whatsapp-n8n-setup.id.md` | Penerima dan sakelar |

- **Skema/migrasi:** Ya: `automation.settings` (atau pengaturan di schema
  lain, dicek saat desain); `docs.dbml` dulu.
- **UAT:**
  1. Pengaturan → Notifikasi WhatsApp: semua sakelar mati bawaan; hidupkan "SPH
     terkirim" → simpan.
  2. Kirim SPH → event `quotation.sent` di Integrasi → Webhook memuat status
     sakelar; WA tim uji menerima pesan.
  3. Ajukan PO → Aqim menerima WA "menunggu persetujuan".
  4. Sakelar mati → pelanggan tidak menerima pesan, staf tetap.
- **Bergantung pada:** P7-3 (titik persetujuan), B-38 (pesanan online), B-44
  (pengingat), Oki (server n8n, X-14), Aqim (nomor WA, penyedia AI).

**Prompt AI (salin):**

```text
Kerjakan B-46 n8n dan WhatsApp dijalankan sungguhan.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-46 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: docs/database/docs.dbml, apps/backend/drizzle/schemas/automation.schema.ts, apps/backend/src/app/automation/contracts/outbox.contract.ts, apps/backend/src/app/automation/services/outbox.service.ts, apps/backend/src/app/automation/services/notification-settings.service.ts, controllers/notification-settings.controller.ts, repositories/, sale/services/sales-order.service.ts, apps/web-admin/src/routes/_authed/settings/whatsapp-notifications/index.tsx, apps/web-admin/src/lib/automation-api.ts, nav-config.ts, apps/web-admin/src/routes/_authed/integrations/webhooks/index.tsx.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: send-test-event.ts, apps/backend/test/unit/outbox.service.test.ts, sales-invoice-events.test.ts, whatsapp-assistant.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-46 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-46.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### M12-16-D Ekspor daftar utama modul Dafrin (Tinggi, KF-R5, bagian pemilik modul)

- **Seharusnya:**
  - Ekspor CSV/XLSX untuk daftar utama yang punya izin `export` tetapi belum
    punya endpoint, dengan audit ekspor (M12-16; pola dan audit dari Oki,
    P7-1). Bagian Dafrin: pelanggan, faktur/piutang, karyawan.
- **Sekarang:**
  - Ekspor hanya di beberapa laporan keuangan
    (`finance/controllers/finance-operations.controller.ts:421,441,460`) dan
    `management-pack.xlsx` (`finance/controllers/cost-report.controller.ts:102`).
    `exceljs` sudah dependensi backend.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/customer/controllers/customer.controller.ts` (+ service) | `GET /customers/export.xlsx` (hak `customer:export`, dicek di `erp-permissions.ts`) |
| backend | `apps/backend/src/app/sale/controllers/invoice.controller.ts` (+ service) | Ekspor faktur/piutang |
| backend | `apps/backend/src/app/human-resource/controllers/employee.controller.ts` (+ service) | Ekspor karyawan (data sensitif sesuai hak) |
| web-admin | `apps/web-admin/src/routes/_authed/crm/customers/index.tsx`, `sales/invoices/index.tsx`, `hr/employees/index.tsx`, `apps/web-admin/src/lib/download.ts` | Tombol Ekspor |
| test | `apps/backend/test/authorization/permission-matrix.test.ts`, unit per modul | Hak export; audit tercatat |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Daftar pelanggan → Ekspor → file XLSX berisi kolom yang tampil.
  2. Pengguna tanpa hak export tidak melihat tombol; Log Audit mencatat ekspor.
- **Bergantung pada:** pola ekspor + audit Oki (M12-16, P7-1).

**Prompt AI (salin):**

```text
Kerjakan M12-16-D Ekspor daftar utama modul Dafrin.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian M12-16-D (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/customer/controllers/customer.controller.ts, apps/backend/src/app/sale/controllers/invoice.controller.ts, apps/backend/src/app/human-resource/controllers/employee.controller.ts, apps/web-admin/src/routes/_authed/crm/customers/index.tsx, sales/invoices/index.tsx, hr/employees/index.tsx, apps/web-admin/src/lib/download.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/authorization/permission-matrix.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri M12-16-D terpenuhi; buat docs/adjustment/5-pengerjaan/uat/M12-16-D.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

### L-12-D Templat impor data awal modul Dafrin (Tinggi, NM-1, NM-2)

- **Seharusnya:**
  - Impor Excel **semua-atau-tidak** dengan templat: pelanggan + pemasok,
    barang + stok awal (lewat penyesuaian yang disetujui Aqim), karyawan (tanpa
    login sampai diundang). Daftar kesalahan per baris (NM-1, NM-2, L-12).
- **Sekarang:**
  - Pola impor sudah ada di HR: `human-resource/controllers/attendance.controller.ts:47-52`
    dan `salary.controller.ts:52-57` (`/template`, `/import`), utilitas
    `human-resource/utils/import-file.ts`, `human-resource/utils/spreadsheet.ts`;
    dialog `components/hr/import-dialog.tsx`.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend (bersama) | `apps/backend/src/shared/import/` (baru) | Pindahkan `import-file.ts` + `spreadsheet.ts` jadi utilitas bersama (K11) |
| backend | `apps/backend/src/app/customer/`, `supplier/`, `product/` + `inventory/`, `human-resource/` (controller + service per modul) | `GET .../import/template`, `POST .../import` dalam satu transaksi; stok awal membuat penyesuaian draf |
| web-admin | `apps/web-admin/src/components/import-dialog.tsx` (baru, dari `components/hr/import-dialog.tsx`) + tombol di daftar pelanggan, pemasok, barang, karyawan | Unggah, daftar kesalahan per baris |
| locale | `packages/locales/src/{en,id}/common.ts` dan namespace modul | Teks |
| test | `apps/backend/test/unit/customer.service.test.ts`, `supplier.service.test.ts`, `product.service.test.ts`, `hr-records.service.test.ts` | Satu baris salah → tidak ada yang tersimpan |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Unduh templat pelanggan, isi 10 baris (1 NPWP ganda) → unggah → ditolak,
     daftar menyebut baris yang salah, tidak ada pelanggan tersimpan.
  2. Perbaiki → unggah → 10 pelanggan tersimpan.
  3. Impor stok awal → muncul penyesuaian draf menunggu persetujuan Aqim.
- **Bergantung pada:** P7-6 (pesan per baris), PH-ADJ (stok awal).

---

**Prompt AI (salin):**

```text
Kerjakan L-12-D Templat impor data awal modul Dafrin.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian L-12-D (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/shared/import/, apps/backend/src/app/customer/, supplier/, product/, inventory/, human-resource/, apps/web-admin/src/components/import-dialog.tsx, components/hr/import-dialog.tsx, packages/locales/src/{en,id}/common.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/customer.service.test.ts, supplier.service.test.ts, product.service.test.ts, hr-records.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri L-12-D terpenuhi; buat docs/adjustment/5-pengerjaan/uat/L-12-D.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```

## Sedang (diminta masuk peta)

### B-14 Masa perpanjangan lisensi dan kode aplikasi (Sedang, T-2, T-3)

- **Seharusnya:**
  - Masa perpanjangan dihitung **tahun/bulan kalender** (tidak kurang 1 hari
    lewat 29 Februari) (T-2).
  - Kunci/aktivasi pindah ke kontrak baru **saat periode baru mulai**, bukan
    saat perpanjangan diaktifkan lebih awal (T-2).
  - Kode/sumber aplikasi **dikunci** setelah aplikasi punya kontrak atau kunci
    API (T-3).
- **Sekarang:**
  - `project/utils/license.ts:35-44` `renewalPeriod` memakai jumlah hari
    periode lama (`periodDays`), bukan kalender.
  - `project/services/licensing.service.ts:273-316` `activateDraft` langsung
    menandai kontrak lama `renewed` dan memindah kunci; `updateApplication`
    (`:127-136`) mengizinkan kode berubah kapan saja.
- **File yang diubah:**

| Lapisan | Path | Perubahan |
|---|---|---|
| backend | `apps/backend/src/app/project/utils/license.ts` | Periode kalender (tambah tahun/bulan sesuai `billingCycle`) |
| backend | `apps/backend/src/app/project/services/licensing.service.ts`, `queues/license-due.worker.ts` | Pindah kunci saat `startDate` tiba (job harian); kunci kode aplikasi yang sudah dipakai |
| backend | `apps/backend/src/app/project/errors/licensing.errors.ts` | Error kode aplikasi terkunci |
| web-admin | `apps/web-admin/src/routes/_authed/subscription/applications/index.tsx`, `apps/web-admin/src/routes/_authed/subscription/$contractId/index.tsx` | Isian kode terkunci; info "kunci pindah pada {tanggal}" |
| locale | `packages/locales/src/{en,id}/licensing.ts`, `api.ts` | Teks |
| test | `apps/backend/test/unit/licensing.service.test.ts`, `license-api.service.test.ts` | 2028-02-29 → 2029-02-28; perpanjangan dini tidak memindah kunci sebelum mulai |

- **Skema/migrasi:** Tidak.
- **UAT:**
  1. Kontrak 1 Mar 2027–29 Feb 2028 → Perpanjang → periode 1 Mar 2028–28 Feb
     2029.
  2. Perpanjangan dibayar lebih awal → pelanggan tetap aktif di kontrak lama
     sampai periode baru mulai.
  3. Aplikasi yang sudah punya kontrak → kode tidak bisa diubah.
- **Bergantung pada:** —.

**Prompt AI (salin):**

```text
Kerjakan B-14 Masa perpanjangan lisensi dan kode aplikasi.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-dafrin.md bagian B-14 (Seharusnya, File yang diubah, Test, UAT).
Buka hanya file ini: apps/backend/src/app/project/utils/license.ts, apps/backend/src/app/project/services/licensing.service.ts, queues/license-due.worker.ts, apps/backend/src/app/project/errors/licensing.errors.ts, apps/web-admin/src/routes/_authed/subscription/applications/index.tsx, apps/web-admin/src/routes/_authed/subscription/$contractId/index.tsx, packages/locales/src/{en,id}/licensing.ts, api.ts.
Jangan menjelajah folder lain, jangan refactor di luar tugas. Ikuti AGENTS.md dan 5-pengerjaan/README.md.
Bila skema berubah: edit docs/database/docs.dbml dulu, lalu validate-dbml harus OK.
Tambahkan data seeder untuk fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34, A-11).
Test: apps/backend/test/unit/licensing.service.test.ts, license-api.service.test.ts (jalankan hanya ini saat iterasi).
Selesai bila semua butir UAT di entri B-14 terpenuhi; buat docs/adjustment/5-pengerjaan/uat/B-14.md dari templat uat-pengerjaan.md.
Laporkan hanya: file yang diubah dan hasil test.
```
