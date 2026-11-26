# Catatan progres - penyesuaian konsep saat ini

Log perubahan dan catatan dari sesi validasi konsep saat ini (mulai
2026-11-24): uji alur, perbaikan kecil web-admin, UAT per modul programmer
B, catatan skema, dan diagram per role. Dokumen bersama
(`docs/plan/progress.md`, `backlog.md`, `features.md`) sengaja tidak
diubah. Isi catatan ini dipindahkan ke sana setelah disepakati.

Isi folder ini:
- [validasi-konsep-saat-ini.md](validasi-konsep-saat-ini.md): matriks role
  dan keputusan terbuka.
- [uat-modul/](uat-modul/README.md): checklist UAT per modul, catatan
  skema, dan diagram alur per role.
- [ringkasan-arsitektur.md](ringkasan-arsitektur.md): ringkasan aturan
  arsitektur yang berpengaruh ke modul programmer B.

## 2026-11-24 - Uji alur PO/SPH/Surat Jalan: dua perbaikan web-admin

Branch `fix/web-admin-account-switch-and-po-hint` (dari `761ef715`). Belum
di-commit. Belum ada nomor ERP; dipetakan ke T01–T32 bersama yang lain.

**Lingkungan dev dibuat ulang.** Container dan volume Postgres/Redis lama
sudah tidak ada. Dibuat ulang `ims-erp-postgres-1` (:15432),
`ims-erp-redis-1` (:16379), dan `ims-erp-mailpit-1` (SMTP :1025, UI :8025).
- `bun run drizzle:migrate` sukses; `bun run drizzle:seed` exit 0.
- `apps/backend/.env` (lokal, tidak di-commit) diberi `MAIL_SMTP_HOST`,
  `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE`, dan `MAIL_FROM`. Backend membaca
  `MAIL_SMTP_*`, bukan `SMTP_*`; tanpa itu semua email dibuang ("mail
  disabled").
- Daftar portal individu diuji lewat API sampai login 200.

**Temuan 1 - PO tidak muncul di Penerimaan Barang.** Bukan bug: hanya PO
berstatus Terkirim/Diterima sebagian yang bisa diterima. PO uji masih
Disetujui. Perbaikan UX:
- detail PO berstatus Disetujui menampilkan petunjuk "Tandai terkirim…"
  (`pos.approvedNotSent`);
- teks kosong di form Penerimaan Barang (`receipts.noOrders`) menjelaskan
  kapan PO muncul.

Kunci en dan id ditambahkan bersamaan.

**Temuan 2 - tombol Setujui terlihat di akun `sales_seed`.** Server benar:
`has-permission` untuk `quotation:approve` = false, `quotation:submit` =
true. SPH tercatat disetujui `sales_manager_seed`. Penyebab di UI: logout
dan login tidak me-reload halaman maupun menghapus cache React Query, dan
cookie sesi dipakai bersama antar-tab. Akibatnya halaman bisa menampilkan
tombol milik akun lain. Perbaikan (`apps/web-admin/src/lib/account-switch.ts`):
- logout dan login memakai pemuatan halaman penuh dengan cache kosong;
- path `redirect` hanya boleh path dalam origin yang sama (juga di
  `beforeLoad` halaman login);
- layout `_authed` me-reload halaman bila sesi berganti akun dari tab lain.

**Perintah dan hasil:**
- `bun test test/unit/account-switch.test.ts` (apps/web-admin): 6 pass.
- `bunx tsc -p tsconfig.app.json --noEmit` (apps/web-admin): 0 error.
- `bun test` (apps/web-admin): 215 pass, 0 fail.
- `bun test` (packages/locales): 106 pass, 0 fail.
- `bun run lint` (apps/web-admin): exit 0, 0 error. Peringatannya ada di
  file lain yang tidak diubah.

**Belum dilakukan:** uji klik di browser (ganti akun dua tab, petunjuk di
PO) oleh pengguna. `docs/database/` ditinjau dan tidak berubah (hanya UI).
Dokumen bersama (`progress.md`, `backlog.md`, `features.md`) sengaja tidak
diubah, sesuai catatan di atas.

**Tambahan 2026-11-24:** `validasi-konsep-saat-ini.md` dibuat untuk
Pemilik dan programmer kedua. Isinya:
- matriks 17 role dan hak per dokumen (pelanggan/pemasok, SPH/SO,
  PO/penerimaan, surat jalan), diambil dari `erp-permissions.ts` dan guard
  backend;
- tujuh keputusan terbuka;
- checklist UAT A–E (PO→terima barang, SPH→SO, surat jalan, login portal,
  hak akses dan ganti akun).

Status: draf, menunggu validasi.

**Tambahan 2026-11-24 (UAT per modul):** folder `uat-modul/` dibuat. Isinya
README (persiapan, akun, rekap, daftar temuan) dan checklist untuk M05,
M02, M07, M03, M08, dan M04, sesuai pembagian modul yang dipakai sebagai
acuan.
- Langkah, tombol, status, dan hak akses dipetakan dari kode web-admin,
  backend, dan `erp-permissions.ts`. Pemetaannya oleh tiga agen baca-saja;
  temuan utama dicek ulang ke kode: `AdminOnly` di halaman produk, menu Uang
  Muka tanpa hak, dan hak yang salah di tombol daftar retur penjualan.
- Satu klaim agen ditolak: bahwa halaman bisa dibuka lewat URL tanpa
  pemeriksaan. `canOpenPath` di `_authed` memeriksa semua halaman yang
  punya menu.
- `validasi-konsep-saat-ini.md`: Bagian 2 sekarang menunjuk ke
  `uat-modul/`; ditambah keputusan 8 (barang hanya untuk admin aplikasi) dan
  9 (menu yang tidak cocok dengan hak server).

Status: draf, belum ada yang diuji.

**Tambahan 2026-11-24 (catatan skema):** `uat-modul/catatan-skema-dan-alur.md`
dibuat. Isinya:
- letak skema dan diagram;
- peta schema dan tabel per modul programmer B;
- hal yang membingungkan: skema S1–S6, alur/tampilan A1–A11;
- daftar bagian `docs/user-guide/diagrams.md` yang usang (dibuat
  2026-11-06, sebelum ADR-0024/0026).

Diagram belum diperbarui.

**Tambahan 2026-11-24 (diagram per role):** `uat-modul/diagram-alur-per-role.md`
dibuat. Isinya:
- tabel role × modul;
- 8 sequence diagram per modul dengan aktor = role yang berlaku sekarang;
- 4 state diagram: PR/PO/retur, penyesuaian/unit berseri,
  SPH/SO/SJ/invoice/retur, proyek/BAST/tiket/lisensi/cuti.

Pemeriksaan sintaks: `mermaid.parse` (paket `mermaid` + `jsdom`, dipasang
di folder sementara di luar repo) → 12 blok, 0 error.

`docs/user-guide/diagrams.md` tidak diubah (folder bersama).

**Tambahan 2026-11-24 (asal-usul diagram):**
- Dicek apakah isi `diagram-alur-per-role.md` ada di ADR atau dokumen lain.
  Hasilnya: tidak ada diagram alur per role. Yang ada hanya potongannya:
  ADR-0006/0017/0018, `security-and-access.md`, dan `role-permission.md`
  (semua oleh Oki), serta `docs/user-guide/diagrams.md` dan `id.md`
  (programmer B + Claude, 2026-11-06, sebagian usang).
- Penulis dicantumkan di kepala diagram.
- Temuan M05 F4 (penyesuaian stok bisa disetujui sendiri) ditandai
  melanggar ADR-0006 butir 6 dan `security-and-access.md:238`.

**Tambahan 2026-11-24 (penulis `docs/architecture/`):** dicek dengan
`git log` per file. Hasilnya:
- 74 file; 53 hanya diubah Oki.
- Pembuat pertama: 67 file Oki, 7 file programmer B (`destroylord` /
  `RogexSan`). Ketujuh file itu: ADR-0011, 0012, 0013, 0021, 0022, 0027, dan
  `modules/customer-portal.md`.
- 64 dari 273 commit mencantumkan Claude sebagai co-author.
- Sebelum dipindah ke `docs/architecture/` pada 2026-11-04, dokumen ini ada
  di `.agents/docs/` (35 commit Oki, 23 commit programmer B).
- Catatan: penulis commit belum tentu penulis isinya.

**Tambahan 2026-11-24 (ringkasan arsitektur):** `ringkasan-arsitektur.md`
dibuat. Isinya ringkasan bahasa Indonesia dari `architecture.md`,
`security-and-access.md`, ADR-0006, ADR-0014, ADR-0024, dan ADR-0026.
Ditemukan enam bagian dokumen yang tidak cocok dengan kode (D1–D6):
- ADR-0024 masih "proposed";
- jumlah schema di `architecture.md` usang;
- 19 role vs 17 role;
- `DEFAULT_APPROVAL_LIMIT` tidak ada di backend (dicek dengan grep
  `apps/backend/src`);
- larangan menyetujui sendiri tidak berlaku di penyesuaian stok;
- multi-role vs satu role di form.

Dokumen arsitektur tidak diubah (wilayah programmer kedua).

## 2026-11-24 - Perbaikan bug pasti di modul programmer B

Branch `fix/web-admin-account-switch-and-po-hint`. Belum di-commit.
Dikerjakan sebelum UAT, atas pilihan programmer B ("perbaiki bug pasti
dulu").

**Diperbaiki:**

| Temuan | Perubahan |
|---|---|
| M05 F5 | Tombol penyesuaian stok (Penyesuaian baru, Ajukan, Batalkan, Setujui, Tolak, Catat ke stok) di daftar dan detail sekarang mengecek `stock_adjustment.create/approve/post`, sama dengan guard backend. Begitu juga "Sesuaikan stok" dan "Hitung ulang" di halaman Stok, serta "Balik" di Mutasi Barang (`stock_adjustment.post`). Petunjuk "orang lain harus menyetujui" hanya tampil untuk pengaju yang tidak punya hak setuju. |
| M05 F8 | `AdjustmentService.findDetail` mengisi `names`: nama + SKU barang lewat `ExportedProductService.productsById`, dan nama pengaju/penyetuju lewat `ExportedUserService.summaries`. Kontrak modul pemilik dipakai, bukan tabelnya. Layar menampilkan nama, dengan ID sebagai cadangan. |
| M05 D7 | Kolom nomor seri di penerimaan barang tidak lagi bertanda opsional; wajib bila qty > 0. Petunjuk en/id diperbarui. |
| M02 E1 | Tombol Retur barang di daftar retur penjualan memakai `sales_return.create` (sebelumnya `purchase_return.create`). |
| M05 F6 | Menu Nilai Persediaan butuh `stock.read` + `product.read_cost` (sama dengan backend). |
| M03 C5 | Menu Validasi & Aktivasi memakai `license.read` (backend `/events`). |
| M03 B1 | Menu baru "Kontrak lisensi" (`/subscription`, `license.read`); kunci locale `item.licenseContracts` en + id. |
| M04 A4 | Menu Webhook (n8n) memakai `automation.read_log` (sebelumnya `integration.read`, hanya Pemilik). |
| M04 B7 | Menu WhatsApp AI memakai `whatsapp.read` (sebelumnya `automation.read`), jadi Layanan Pelanggan dan Manajer Penjualan melihatnya. |

**Tidak diubah, dipindah ke daftar keputusan:** M05 F4. Pemegang
`stock_adjustment:approve` boleh menyetujui penyesuaiannya sendiri. Ini
disengaja: bypass terdokumentasi di `adjustment.controller.ts` dan
`AdjustmentService`, ada test-nya (`adjustment.service.test.ts`,
"self-approval"), dibuat 2026-11-03. Tapi bertentangan dengan ADR-0006
butir 6. Lihat `validasi-konsep-saat-ini.md` no. 10.

**Perintah dan hasil:**
- `bun test test/unit/adjustment.service.test.ts` (apps/backend): 52 pass,
  termasuk 2 test baru untuk nama.
- `bun test` (apps/backend): 1399 pass, 0 fail.
- `bunx tsc --noEmit` (apps/backend): 0 error.
- `bun run lint` (apps/backend): exit 0. Satu peringatan import tidak
  terpakai (`TStockSelect`) sudah ada sebelumnya.
- `bunx tsc -p tsconfig.app.json --noEmit` (apps/web-admin): 0 error, setelah
  satu perbaikan tipe `productId` nullable.
- `bun test` (apps/web-admin): 215 pass, 0 fail.
- `bun run lint` (apps/web-admin): exit 0, 0 error.
- `bun test` (packages/locales): 106 pass, 0 fail.
- Uji langsung ke backend dev (dinyalakan ulang karena mati):
  - login `warehouse_seed`;
  - `POST /stock/adjustments` (GLOBAL-MAIN, Door access controller) → 201,
    `0001/ADJ/DEV/XI/26`;
  - `GET /stock/adjustments/:id` → `names.products` = Door access controller
    / CTRL-DOOR-01, `names.people` = nama pengaju;
  - dokumen uji lalu dibatalkan (`cancelled`).
- Diagram Mermaid diperiksa ulang: 12 blok, 0 error, setelah titik koma di
  pesan M04 diganti koma.

**Dokumen:**
- `uat-modul/` diperbarui:
  - baris yang diperbaiki bertanda 🔧 dengan hasil yang diharapkan baru;
  - F4 bertanda ❓;
  - README punya legenda dan temuan 3–4.
- `catatan-skema-dan-alur.md` (A3, A6, A9, A11), `ringkasan-arsitektur.md`
  (D5), dan `diagram-alur-per-role.md` disesuaikan.
- `docs/role-permission.md` tidak dijalankan ulang: tidak ada route, guard,
  atau hak role backend yang berubah, hanya menu frontend.
- `docs/database/` ditinjau dan tidak berubah: tidak ada tabel atau kolom
  baru; `names` hanya bentuk respons.

**Belum dilakukan:** uji klik di browser per role (bagian UAT).

## 2026-11-24 - Bahan keputusan untuk Pemilik dan Oki

Atas permintaan programmer B, semua hal yang menunggu keputusan dirangkum
dalam satu halaman: `bahan-keputusan.md`.

- Sumber: `validasi-konsep-saat-ini.md` 1.3, baris ⚠️/❓ di `uat-modul/`, dan
  `ringkasan-arsitektur.md` bagian 7.
- Dikelompokkan: A persetujuan, B pembelian/gudang, C penjualan, D role dan
  menu, E dokumen arsitektur (untuk Oki). Setiap butir berisi kondisi
  sekarang, pilihan, rekomendasi, dan kolom keputusan.
- Dicek ke kode saat menyusun:
  - Uang Muka: menu `/sales/down-payments` di `nav-config.ts` tidak punya
    `permission`, jadi tertutup untuk semua. Backend sudah mendukung
    `termKind=down_payment` pada invoice. Kemungkinan besar bug kecil (C2).
  - SO: `sales-order.repository.ts` hanya mengubah status ke `in_progress`;
    tidak ada kode yang mengubahnya ke `delivered`/`completed` (C1).
- Tidak ada perubahan kode.

## 2026-11-24 - UAT M05 versi detail per isian form

Programmer B minta checklist UAT lebih detail sampai isian form.
`uat-modul/m05-inventaris-pembelian.md` ditulis ulang:

- Setiap langkah berisi nama kolom persis seperti di layar, contoh nilai
  yang diketik, tombol yang diklik, dan hasil yang harus terlihat.
- Data contoh dibuat konsisten sehingga angkanya bisa dicek. Contoh: total PO
  Rp 8.700.000 + PPN 11% Rp 957.000 = Rp 9.657.000.
- Sumber: inventaris field tiap form, dikumpulkan subagen dari kode
  (`item-form.tsx`, `item-category-list.tsx`, `storage-dialog.tsx`,
  `supplier-form-dialog.tsx`, `purchase-request-form.tsx`,
  `purchase-order-form.tsx`, `receipts/new.tsx`, `purchase-return-form.tsx`,
  `adjustment-form.tsx`, beserta contract backend-nya).
- Penomoran berubah:
  - A3 baru (SKU ganda ditolak), jadi A6 lama sekarang A7.
  - Uji nomor seri (🔧) sekarang D6; penerimaan sebagian D7.
  - Rujukan di `README.md` dan `bahan-keputusan.md` disesuaikan.

**Temuan baru (dicek langsung di kode), dicatat sebagai temuan 5 di README:**
- `adjustment-form.tsx:379`: kolom Penyimpanan adalah `Input` teks bebas,
  padahal contract backend meminta uuid. Mengetik `R-01` ditolak.
- Saldo stok per rak, jadi barang yang tersimpan di rak tidak bisa
  disesuaikan dengan benar: Sistem menampilkan 0.
- `adjustment-form.tsx:102`: `productsQueryOptions({})` hanya memuat halaman
  pertama (20 barang).
- Setelah "Buat penyesuaian", nomor tidak ditampilkan dan form direset.
- F1 di checklist diarahkan ke barang tanpa rak (Konektor, D8) supaya tetap
  bisa diuji.

Label di layar yang berbeda dengan checklist lama (Barang baru, Bernomor
seri, Kuantitas, Bahan) sudah disamakan. Tidak ada perubahan kode.

## 2026-11-25 - Ruang ketidaksesuaian dan syarat lulus UAT

Programmer B minta ruang untuk mencatat ketidaksesuaian sebelum bug
diperbaiki, dan minta setiap form serta penggunaan harus lulus.

- File baru `uat-modul/ketidaksesuaian.md`, berisi:
  1. syarat modul lulus;
  2. cek standar form SF1–SF10 (label, tanda wajib, jenis isian, kolom
     wajib kosong, isian tidak valid, simpan + refresh, ubah, batal,
     tampilan/klik ganda, angka/uang);
  3. cek standar penggunaan PG1–PG9 (menu, tombol, status, setuju sendiri,
     nomor, efek ke data lain, daftar, cetak, ganti akun);
  4. jenis, prioritas, dan status ketidaksesuaian;
  5. daftar K-001 sampai K-026.
- Temuan 1–5 di README dipindah ke daftar itu. Rujukan temuan 1 diperbaiki:
  dulu tertulis "M05 A4–A5", seharusnya D3–D4.
- Semua baris ⚠️/❓ dari semua modul ikut dimasukkan sebagai Dugaan atau
  Perlu keputusan.
- `m05-inventaris-pembelian.md`:
  - setiap langkah punya baris "Ketidaksesuaian (No. K)";
  - di akhir ada matriks SF per form (13 form) dan PG per alur (6 alur),
    plus kesimpulan modul.
- README:
  - bagian "Daftar temuan" diganti tautan ke `ketidaksesuaian.md`;
  - rekap punya kolom "K terbuka" dan "Kesimpulan";
  - modul lain menulis nomor K di kolom Catatan.
- Belum ada perbaikan kode. K-013 sampai K-015 (form penyesuaian stok)
  menunggu dipastikan saat UAT atau disetujui untuk langsung diperbaiki.

## 2026-11-25 - Format UAT disederhanakan

Programmer B menilai file ketidaksesuaian terpisah dan matriks cek standar
terlalu rumit. Keputusan: **UAT cukup di file tiap modul.**

Setiap langkah berisi:
- menu yang dibuka;
- isian dan nilainya;
- tombol yang diklik;
- hasil yang harus terlihat;
- `[ ] Sesuai` dicentang bila cocok, atau baris "Tidak sesuai, yang
  terjadi: ___" diisi bila tidak.

Perubahan:
- `uat-modul/ketidaksesuaian.md` (dibuat 2026-11-25) dihapus. Cek standar
  SF/PG dan matriksnya tidak dipakai.
- `m05-inventaris-pembelian.md`: 37 langkah memakai format centang; ringkasan
  menjadi jumlah sesuai, langkah yang tidak sesuai, dan kesimpulan.
- `README.md`:
  - daftar temuan yang sudah diketahui dikembalikan (5 baris, rujukan temuan
    1 diperbaiki menjadi D3–D4);
  - rekap menjadi Sesuai / Tidak sesuai / Kesimpulan;
  - aturan Lulus/Gagal diganti aturan centang.
- Modul lain (M02, M07, M03, M08, M04) akan ditulis ulang dengan format yang
  sama. Isiannya dikumpulkan dulu dari kode per form.

## 2026-11-25 - Perbaikan form penyesuaian stok (M05 F1)

Atas permintaan programmer B, setelah format UAT disepakati (centang
**Sesuai** per langkah, tabel kecil ketidaksesuaian di bawah tiap langkah;
semua 6 modul sudah memakai format ini, M02 43 langkah, M07 30, M03 25,
M08 25, M04 17, M05 37).

**Perubahan kode:**
- `apps/web-admin/src/components/inventory/adjustment-form.tsx`:
  - **Penyimpanan:** dulu `Input` teks bebas, sekarang `Select` berisi rak
    aktif gudang terpilih plus "Belum ditentukan". Ganti gudang = rak di semua
    baris dikosongkan.
  - **Sistem:** saldo diambil per barang yang dipilih
    (`useQueries`, `warehouseId` + `productId`), bukan satu halaman 100 saldo
    se-gudang, sehingga saldo per rak terbaca.
  - **Barang:** komponen baru `ProductPicker` mencari ke server
    (`SearchableSelect` + `productsQueryOptions({ search, activeOnly })`).
    Barang yang sudah dipilih tetap tampil; isian awal dari menu kartu stok
    dicari lewat `getProduct`.
  - Setelah berhasil, langsung membuka detail
    `/inventory/stock/adjustments/$adjustmentId` (nomor terlihat). Pesan
    "Penyesuaian dibuat" yang tidak dipakai lagi dihapus.
- `components/inventory/searchable-select.tsx`: prop opsional `id` supaya
  label terhubung ke kolomnya.
- `apps/backend/src/app/inventory/services/adjustment.service.ts`: server
  sekarang menolak rak yang bukan milik gudang penyesuaian
  (`InventoryReferenceError('storage')`, 422). Dicek lewat
  `ExportedWarehouseService.storageInWarehouse`, token
  `EXPORTED_WAREHOUSE_SERVICE_TOKEN`, parameter terakhir constructor. Sebelumnya
  rak dari gudang lain akan membuka saldo palsu.
- Test:
  - `test/unit/adjustment.service.test.ts`: double gudang, 2 test baru
    (rak gudang sendiri diterima; rak gudang lain ditolak sebelum ada yang
    ditulis).
  - `test/authorization/stock-test-doubles.ts`: double gudang.
- Locale en/id:
  - `adjustmentForm.creating` "Creating." / "Membuat." diganti "Creating…" /
    "Membuat…";
  - `adjustmentForm.created` dihapus (tidak dipakai lagi).

**Perintah dan hasil:**
- `bunx tsc --noEmit -p .` (apps/backend): 0 error.
- `bun test test/unit/adjustment.service.test.ts`: 54 pass, 0 fail.
- `bun test` (apps/backend):
  - run pertama 1400 pass, 1 fail, 1 error (54 detik, sambil typecheck lain
    berjalan);
  - run ulang **1401 pass, 0 fail**. Kegagalan pertama tidak terulang;
    kemungkinan test lambat/flaky, tidak terkait perubahan ini.
- `bunx tsc -p tsconfig.app.json --noEmit` (apps/web-admin): 0 error.
- `bun test` (apps/web-admin): 215 pass, 0 fail.
- `bun test` (packages/locales): 106 pass, 0 fail (parity dan dead key).
- `bun run lint` (web-admin dan backend): 0 error; hanya peringatan lama di
  file lain.

**Dokumen:**
- `uat-modul/m05-inventaris-pembelian.md`:
  - F1 menjadi 🔧 dengan dua baris uji: Kabel di R-01 (Sistem 3 → 2) dan
    Konektor tanpa rak (Sistem 2 → 1), ditambah cek ganti gudang;
  - F3 menyesuaikan hasilnya.
- `uat-modul/README.md`: temuan 5 menjadi "diperbaiki 2026-11-25, belum
  diuji".
- `docs/database/` ditinjau, tidak berubah (tidak ada tabel/kolom baru).
- `docs/role-permission.md` tidak dijalankan ulang (route, guard, dan hak
  tidak berubah).

**Belum dilakukan:** uji klik di browser.

**Server dev:** proses `bun run dev` yang saya jalankan berhenti karena batas
waktu 2 jam. Programmer B disarankan menjalankannya sendiri di terminal.
- 2026-11-25: nama pelanggan contoh di M03 dan M07 disamakan dengan M02 (Budi Hartono UAT / PT Maju Jaya UAT).

## 2026-11-25 - Merapikan file UAT setelah diubah editor

File `uat-modul/m05-inventaris-pembelian.md` tersimpan ulang oleh editor
programmer B dan formatnya rusak:
- ratusan baris berisi hanya `\`, sehingga satu kalimat terpecah dengan jarak
  besar;
- jarak kosong di antara poin;
- tabel diberi spasi lebar.

Programmer B juga tidak bisa menambah baris di tabel ketidaksesuaian dari
editornya.

Perbaikan (skrip `normalize_uat.py`, dijalankan pada keenam file modul):
- baris `\` dihapus, kalimat yang terpecah disambung lagi;
- jarak kosong di antara poin dihapus;
- tabel ketidaksesuaian dipadatkan, dan setiap tabel diberi **3 baris
  kosong**, jadi tidak perlu menambah baris.
- Isian programmer B tetap utuh: 3 temuan di M05 A1 (lihat di bawah).
  Cadangan sebelum dirapikan: `/tmp/m05.bak`.
- Jumlah langkah tidak berubah: M02 43, M03 25, M04 17, M05 37, M07 30,
  M08 25.

**Temuan UAT pertama (M05 A1, diisi programmer B, belum diperbaiki):**
1. Setelah simpan barang muncul error `Unexpected token 'a', "an unexpec"...
   is not valid JSON` (tiga kali), padahal barang tersimpan.
2. Gambar yang diunggah tidak muncul di daftar maupun di detail produk.
3. Kolom harga tidak punya batas nilai.

## 2026-11-25 - UAT M05 dilengkapi sampai semua kolom setiap form

Programmer B: UAT harus mencakup semua isian di setiap form, misalnya Jenis
produk, Kategori, serta Komponen & material.
`uat-modul/m05-inventaris-pembelian.md` ditulis ulang menjadi 46 langkah
(sebelumnya 37).

**Aturan baru yang dipakai:**
- setiap kolom form ikut diisi, termasuk kolom opsional, foto, dan baris
  tambahan;
- dropdown diberi tanda *(cek pilihan)* beserta daftar pilihan yang harus
  ada;
- ada **Uji salah** per form;
- form ubah, batal, arsip, dan tolak ikut diuji.

**Bagian A disusun ulang:**

| Langkah | Isi |
|---|---|
| A1 | Kategori, semua kolom |
| A2 | Komponen (baru) |
| A3 | Material |
| A4 | Produk biasa, semua 6 bagian form, termasuk foto dan komponen/material |
| A5 | Cek detail produk |
| A6 | Ubah produk (Jenis dan SKU terkunci) |
| A7 | Produk bernomor seri, dengan uji Kuantitas |
| A8 | SKU ganda dan batal |
| A9 | Arsipkan dan aktifkan |
| A10 | Rak, termasuk ubah |
| A11 ⚠️ | Pembelian (dulu A7) |

Tiga temuan programmer B (dulu di A1) dipindah utuh ke **A4**.

**Langkah baru di bagian lain:**
- B2 kode pemasok manual/ganda dan Instansi pemerintah; B4 ubah pemasok
  (Keuangan pindah ke B5).
- C2 ubah PR; C5 batalkan PR.
- D2 ubah PO.
- E5 batalkan retur.
- F5 tolak/batalkan penyesuaian. Nomor F lama bergeser: F5 → F6, F6 → F7,
  F7 → F8, F8 → F9.

Kolom yang sebelumnya terlewat kini masuk:
- pemasok: Nama resmi, NPWP, Situs web, WhatsApp, Catatan;
- PR: Spesifikasi dan Catatan per baris;
- PO: Tgl. penawaran, Proyek, PIC kami, Syarat lainnya, Catatan, Spesifikasi
  baris, tiga pilihan PPN beserta hitungannya;
- BPB: Surat jalan pemasok, Catatan baris;
- retur: Catatan baris;
- penyesuaian: Kode alasan, Harga pokok (untuk Pemilik).

Rujukan yang disesuaikan:
- README temuan 3 → D6, F6, F7, F9;
- `bahan-keputusan.md` B3 → M05 A11.

Dicek ke kode:
- form ubah rak ada (`storage-dialog.tsx` → `updateStorage`);
- Gudang tidak punya `product.read_cost` (Harga pokok tidak tampil);
- batas foto 10 gambar.

Modul lain diminta dilengkapi dengan aturan yang sama.
- 2026-11-25: M04 dilengkapi semua kolom form: 25 langkah (dari 17); rujukan B7→B10, C6→C9 disesuaikan di README dan bahan-keputusan.
- 2026-11-25: M08 dilengkapi semua kolom form: 39 langkah (dari 25); rujukan E3→E5 disesuaikan di bahan-keputusan.
- 2026-11-25: M03 dilengkapi semua kolom form: 31 langkah (dari 25); nomor lama tetap, langkah baru A5, A6, B9–B11, C7.
- 2026-11-25: M07 dilengkapi semua kolom form: 43 langkah (dari 30); rujukan A8→A14 disesuaikan di bahan-keputusan.
- 2026-11-25: M02 dilengkapi semua kolom form: 57 langkah (dari 43). Rujukan disesuaikan: M02 A3→A6 (M03, M07), B4→B5, C7→C8, C9→C10, D10→D11, A6→A14 (bahan-keputusan, diagram, validasi-konsep).

## 2026-11-25 - Hasil UAT M05 sampai D3 dirapikan

Programmer B sudah mengisi UAT M05 dari A1 sampai D3:
- 4 langkah dicentang Sesuai: B2, C2, C3, C5;
- 36 baris ketidaksesuaian.

Atas permintaannya, kalimat di tabel ketidaksesuaian dirapikan (ejaan,
kalimat terpotong, istilah dibuat konsisten) tanpa mengubah maksud.
Cadangan sebelum dirapikan: `/tmp/m05-before-tidy.md`. Format file dirapikan
lagi dengan `normalize_uat.py` setelah editor mengubahnya.

Dua langkah checklist diperjelas karena catatan penguji:
- **B5:** menunya disebut (Inventaris → Pengadaan → Pemasok).
- **C4:** tombol Buat purchase order dicek dengan `purchasing_seed`, karena
  tombol itu memang tidak tampil untuk Teknisi dan Manajer Operasional.

**Ringkasan ketidaksesuaian M05 A1–D3 (belum diperbaiki):**

| Kelompok | Temuan |
|---|---|
| Error JSON | `Unexpected token 'a'…` setelah simpan barang/foto (A2–A5, A7) |
| Error JSON, **penghambat** | `Unexpected token 'F', "Failed que"…` saat Setujui PO (D3); D4 dst. tertahan |
| Foto barang | Tidak terunggah / tidak tampil di daftar dan detail (A2–A7) |
| Pesan pop-up | Tertutup form dialog (A1, A3) |
| Form per jenis | Komponen, Bahan, dan bernomor seri menampilkan semua kolom; seharusnya hanya yang relevan (A2, A3, A7) |
| Batas nilai | Harga tanpa batas (A4); kapasitas 0 diterima dan 100 tampil 100.000 (A10) |
| Daftar barang | Tidak ada filter barang diarsipkan; tidak ada Nonaktifkan di menu titik tiga (A9) |
| Rak | Tidak ada tombol aktif/nonaktif di daftar (A10) |
| Pemasok | NPWP, Telepon, WhatsApp, Tempo, No. rekening bisa diisi huruf/tanpa batas; Bank sebaiknya dropdown (B1); Telepon PIC tidak rapi (B3); Kode bisa diubah saat Ubah (B4) |
| PR | Tidak ada Spesifikasi untuk barang dari inventaris; Satuan baris bebas berupa teks (C1); tombol Buat PO (C4, perlu dicek dengan `purchasing_seed`) |
| PO | Kotak Cari pemasok kosong; pilih pemasok perlu dropdown yang bisa dicari (D1, D2) |

## 2026-11-25 - Perbaikan penghambat UAT M05 D3 dan error foto

**1. D3: Setujui PO gagal (`Unexpected token 'F', "Failed que"…`).**

Penyebab, direproduksi lewat API sebagai `operations_manager_seed`:
- nomor PO dirender dengan pola bawaan
  `{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}`;
- kode pemasok otomatis berpola `{COMPANY}-{ORG}-{TYPE}-{SEQ:5}`, menjadi
  `DEV-ENTRAGATE-SUP-00001`;
- hasilnya `PO/DEV-DEV-ENTRAGATE-SUP-00001/HW/1126/005` (42 karakter),
  padahal `procurement.purchase_orders.code` hanya varchar(40) dan register
  dokumen `document.documents.code` hanya varchar(32);
- UPDATE gagal, dan server membalas teks mentah (bug 2 di bawah).

Format nomor bisa diatur Pemilik di **Administrasi → Nomor Kode**
(`/settings/code-numbers`). Pratinjau di sana memakai kode pemasok contoh
`SUP`, jadi peringatan "terlalu panjang" tidak muncul untuk kode pemasok
asli yang panjang. Ini dicatat sebagai temuan; belum diubah.

**2. Server membalas error tak dikenal sebagai teks biasa.**

Penyebab "Unexpected token 'F'/'a'… is not valid JSON". Diperbaiki (disetujui
programmer B; lapisan bersama, perlu diberitahukan ke Oki):
- `apps/backend/src/http/plugin.ts`: error `UNKNOWN` dan
  `INTERNAL_SERVER_ERROR` yang tidak dipetakan sekarang dicatat ke log
  (`pinoLogger.error`) dan dibalas 500 dengan envelope standar serta pesan
  umum `common.internalError`. SQL atau stack tidak dikirim ke browser.
- Locale `api` en/id: kunci baru `common.internalError`.
  `numbering.codeTooLong` diperjelas: menyebut kode di dalam pola, misalnya
  kode pemasok.
- `apps/backend/src/shared/numbering/domain.ts`: `CODE_MAX_LENGTH.purchase_order = 32`.
  Nomor PO yang terlalu panjang sekarang ditolak 422 dengan pesan
  `numbering.codeTooLong`, bukan error SQL 500.
- Test baru `test/unit/http-plugin-unhandled-error.test.ts` (2 test): 500
  berupa JSON dan tidak membocorkan SQL.
- Cek langsung: persetujuan PO yang sama sekarang dijawab 422 JSON "The
  generated code PO/DEV-DEV-ENTRAGATE-SUP-00001/HW/1126/005 is longer than
  32 characters…". Datanya tidak berubah. Nomor urut PO bulan ini maju
  (5 → 6) karena alokasi nomor di luar transaksi; celah nomor seperti ini
  sudah ada sebelumnya.

**3. Foto barang gagal diunggah (`an unexpected error has occurred`).**

Penyebab: lingkungan dev, bukan kode. `S3_ENDPOINT` mengarah ke
`localhost:9000`, tetapi tidak ada layanan penyimpanan yang berjalan, dan
`docker-compose.yml` tidak memuatnya. Pesan tersebut dipastikan berasal dari
klien S3 milik Bun saat endpoint mati.

Tindakan:
- image `minio/minio` dan `quay.io/minio/minio` tidak bisa diunduh lagi
  (pull access denied);
- dipakai `rustfs/rustfs` (kompatibel S3): container `ims-erp-s3-1`, port
  9000/9001, volume `ims-erp-s3-data`, kredensial dari `.env` lewat env-file
  sementara (sudah dihapus, tidak ditampilkan);
- bucket dibuat dengan `curl --aws-sigv4` (200);
- cek dengan `s3Client` backend: tulis, baca, dan hapus berhasil.

README UAT bagian Persiapan diperbarui.

**Perintah dan hasil:**
- `bunx tsc --noEmit -p .` (backend): 0 error.
- `bun test` (backend): 1403 pass, 0 fail.
- `bun test` (locales): 106 pass, 0 fail.
- `bun run lint` (backend): 0 error, hanya peringatan lama.

**Belum dilakukan / perlu keputusan:**
- Format nomor pemasok dan PO: atur di Administrasi → Nomor Kode, atau ubah
  bawaannya.
- `docker-compose.yml` belum memuat layanan S3 (wilayah Oki; temuan).

## 2026-11-25 - Otomatisasi UAT (Playwright), pilot M05

Programmer B minta dibantu otomatisasi karena cakupan UAT terlalu luas.

**Penyimpanan file:** container `ims-erp-s3-1` (RustFS) berjalan dengan
`--restart unless-stopped`, jadi ikut menyala setiap kali Docker menyala.

**Yang dipasang di `apps/web-admin`:**
- dev dependency `@playwright/test@1.65.1` (sama dengan `playwright-core` di
  backend); browser `chromium-headless-shell-1255` diunduh dengan
  `bunx playwright install chromium`;
- `playwright.config.ts`: menjalankan test ke stack dev yang sudah menyala
  (:5173 / :3001), satu worker, berurutan. Laporan dan artefak ada di
  `e2e/.results/` (git-ignored);
- `e2e/auth.setup.e2e.ts`: login 7 role lewat `/api/auth/sign-in/username`,
  cookie disimpan di `e2e/.state/` (git-ignored). Password pemilik dibaca
  dari `apps/backend/.env` saat test berjalan, tidak ditulis di mana pun;
- `e2e/support/` berisi akun, `RUN_ID` (akhiran data per run supaya tidak
  bentrok), `pageAs`, dan `toast`;
- `e2e/m05-a-barang.e2e.ts`: A1, A2, A3, A4 (dengan 2 foto), A5 (foto
  benar-benar termuat, `naturalWidth > 0`), A8;
- `e2e/m05-akses.e2e.ts`: A11 ⚠️, F6, F7;
- `e2e/fixtures/foto-1.png`, `foto-2.png` (PNG kecil buatan sendiri);
- script `test:e2e` dan `test:e2e:report`; panduan di `e2e/README.md`.

File test berakhiran `.e2e.ts`, jadi tidak ikut `bun test`.

**Hasil:**
- `bun run test:e2e`: **16 passed** (7 login + 9 langkah UAT), 34 detik;
- `bun test` (web-admin): 215 pass;
- `tsc -p tsconfig.app.json`: 0 error;
- lint: 0 error (peringatan lama).

**Temuan dari pilot:** setelah penyimpanan file berjalan, foto barang
tersimpan dan tampil. Error `Unexpected token 'a'… an unexpected error has
occurred` di A2–A5 dan A7 berasal dari penyimpanan yang mati. Langkah itu
perlu diuji ulang manual oleh programmer B; baris ketidaksesuaiannya
dibiarkan apa adanya sampai uji ulang.

Data uji dari run otomatis tertinggal di database dev, dengan nama berakhiran
kode run, misalnya "Kabel UAT RCMHA" dan `UAT-KBL-REFF5`.

**Rencana lanjutan:**
1. sisa M05: B pemasok, C PR, D PO/BPB setelah format nomor diatur, E retur,
   F penyesuaian;
2. lalu M02, M07, M03, M08, M04.

Langkah yang menilai tampilan atau alur tetap manual.
- 2026-11-25: script e2e tambahan: `test:e2e:ui` (Playwright UI mode, browser terlihat + timeline langkah) dan `test:e2e:headed` (browser terlihat; `E2E_SLOWMO` dalam ms untuk memperlambat). Opsi `launchOptions.slowMo` di playwright.config.ts. `playwright test --list`: 16 test.
- 2026-11-25: `test:e2e:ui` dan `test:e2e:headed` sekarang memakai jeda 800 ms per aksi (`E2E_SLOWMO=800`; sintaks `${VAR:-default}` ternyata tidak diproses shell bun, jadi diganti angka tetap). Config: `slowMo: Number(E2E_SLOWMO) || 0`. Cek: A1 headed 14,8 detik (sebelumnya 3,5 detik).

## 2026-11-25 - Uji UI otomatis untuk form M05

Programmer B: test sebelumnya hanya fungsional, perlu validasi UI juga.
Dipilih keempat jenis: aturan isian, posisi/tampilan, aksesibilitas, dan
screenshot pembanding.

**Yang ditambahkan (`apps/web-admin`):**
- dev dependency `@axe-core/playwright@^4.14.1`;
- `e2e/support/form-inventory.ts`: daftar setiap kolom form (label, type,
  inputmode, maxlength, min/max, wajib, tanda Opsional), dilampirkan di
  laporan;
- `e2e/support/ui-checks.ts`:
  - aturan per kolom (huruf ditolak, batas panjang, angka sangat besar
    ditolak/dibatasi, harus dropdown);
  - tidak keluar layar HP 390 px;
  - toast di depan dialog;
  - axe;
- `e2e/m05-ui.e2e.ts`: 6 form (Produk, Kategori, Rak, Pemasok, PR, PO) ×
  4 test, ditambah test toast. Screenshot baseline ada di
  `e2e/__screenshots__/m05-ui.e2e.ts/` (6 gambar desktop);
- `playwright.config.ts`: `snapshotPathTemplate`, `updateSnapshots: 'missing'`;
- `e2e/support/session.ts` mendapat `apiData`. Tes fungsional sekarang
  memastikan penyimpanan lewat API, karena setelah banyak run baris baru
  bisa ada di halaman tabel berikutnya (A1 sempat gagal karena itu).

**Hasil `bunx playwright test`:** 41 test, **30 lulus, 11 gagal**. Semua yang
gagal adalah temuan UI nyata:

| Form | Temuan otomatis | Sesuai temuan manual |
|---|---|---|
| Kategori (toast) | Toast error "slug sudah ada" **tertutup dialog** dan disembunyikan dari pembaca layar (`aria-hidden`) | A1 |
| Produk | Nama, Deskripsi, Kode batang tanpa batas panjang; Harga jual/beli dan Stok minimum menerima 9999999999999999999; ada kolom tanpa label (pilihan Jenis/Kategori/Satuan); axe: 1 tombol tanpa nama | A4 |
| Rak | Keempat label (Kode, Nama, Jenis, Kapasitas) **tidak terhubung** ke kolomnya; axe: `label` (4) dan kontras warna | A10 |
| Pemasok | NPWP, Telepon, WhatsApp, Nomor rekening bisa diisi huruf; Telepon/WhatsApp tanpa batas panjang; rekening batas 100 (harapan ≤ 20); Bank teks bebas; kolom tanpa label (kode negara); axe: 2 tombol tanpa nama, kontras | B1, B3 |
| PR | Satuan baris bebas teks bebas (harapan dropdown); kolom tanpa label; axe: `aria-allowed-attr`, kontras (2) | C1 |
| PO | Ada kolom tanpa label | D1 |
| Kategori | axe: kontras warna (1) | — |

Lulus: tampilan HP 390 px tidak keluar layar untuk keenam form; screenshot
baseline dibuat.

**Pemeriksaan:** lint web-admin 0 error (peringatan `no-empty-pattern` di
spec sudah dihilangkan); `bun test` web-admin tidak menyentuh `.e2e.ts`.

Belum diperbaiki di kode aplikasi; ini bahan perbaikan UI berikutnya.

## 2026-11-26 - Validasi role terhadap tim nyata

Programmer B memberi daftar siapa memegang role apa (12 orang). Validasi
ditulis di `validasi-konsep-saat-ini.md`.

**Perubahan dokumen:**
- 1.1 mendapat kolom "Dipegang oleh" dan catatan per role.
- Kalimat "satu user satu role" diganti. Dicek di kode: beberapa role
  didukung lewat halaman ubah anggota (`organizations/$organizationId.members.$memberId.edit.tsx`,
  centang per role, ERP-0041) dan impor undangan (`invite-dialog.tsx`,
  role dipisah `|`). Backend menggabungkan hak (`elysia-auth.ts:204`).
- Bagian 3 baru:
  - 3.1 tim dan hak gabungan;
  - 3.2 temuan R1–R9;
  - 3.3 jawaban sementara untuk 1.3 nomor 1–10;
  - 3.4 alur kerja per role;
  - 3.5 alur lintas orang;
  - 3.6 pertanyaan untuk Pemilik.
- `ringkasan-arsitektur.md` D6 dan `bahan-keputusan.md` D2 diperbarui:
  beberapa role sudah didukung.

**Sumber yang dicek:**
- hak per role dari `erpRoleGrants` (dibaca dengan skrip bun sementara);
- service yang menolak persetujuan oleh pembuat: PR, PO, retur pembelian,
  SPH, retur penjualan, cuti/lembur, peminjaman aset, penyesuaian stok (yang
  ini dengan pengecualian). Pembayaran dan gaji tidak punya aturan ini.

**Temuan utama:**
- **R1:** SDM untuk semua orang membuka data pribadi dan gaji semua karyawan.
- **R2:** PO, PR, dan retur pembelian buatan Aqim tidak bisa disetujui siapa
  pun, karena Aqim satu-satunya Manajer Operasional dan aturan "pembuat tidak
  boleh menyetujui" juga berlaku untuk Pemilik.

**Asumsi yang perlu dipastikan:** Agus MD ≠ Agus; Okik = Oki; "SDM: Semua"
berarti layanan mandiri.

Tidak ada perubahan kode.
- 2026-11-26: konfirmasi programmer B:
  - ada dua Agus (Agus MD = Manajer Penjualan; Agus = PM/Teknisi/Gudang);
  - Okik = Oki;
  - "SDM: Semua" = layanan mandiri.

  `validasi-konsep-saat-ini.md` diperbarui:
  - asumsi diganti hasil konfirmasi;
  - R1: role SDM diusulkan hanya untuk Aqim; Anggota hanya perlu untuk
    Dafrin dan Oki;
  - 1.1 baris `hr` dan `member` disesuaikan;
  - 3.7 baru: peta bentrok persetujuan (14 titik: 🔴 macet, 🟡 tanpa
    pemeriksa, 🟢 aman). Klaim garansi dicek tanpa aturan "pembuat tidak boleh
    menyetujui".
- 2026-11-26: jumlah pengguna dibetulkan menjadi 1–10 (10 karyawan + 2 pengembang, Dafrin dan Oki) di `validasi-konsep-saat-ini.md` (1.3 no. 1 dan 7, 3.1, 3.3) dan `bahan-keputusan.md` (bagian A). Draf `docs/simple-version/stage-1-rebuild/` masih menulis 1–5 dan sengaja tidak diubah (rebuild ditunda).
- 2026-11-26: `uat-modul/diagram-alur-per-role.md` diberi nama orang:
  - tabel bagian 0 mendapat kolom "Dipegang oleh";
  - setiap aktor diagram menjadi "Role - nama orang";
  - catatan bentrok ditambahkan di diagram 1 (PO macet, R2), diagram 2
    (retur macet, R2), dan diagram 3 (Bilal dan Agus MD saling menyetujui
    SPH).

  Mermaid dicek ulang dengan `mermaid.parse` + jsdom: 12 blok, 0 error.
  `docs/architecture/security-and-access.md` dibiarkan atas permintaan
  programmer B.

## 2026-11-26 - Rekomendasi role dan persetujuan Pemilik

Programmer B bertanya beda Pemilik dan Admin, dan memberi arah: Aqim boleh
menyetujui dokumennya sendiri tanpa persetujuan orang lain.

**Dokumen:**
- `validasi-konsep-saat-ini.md`:
  - bagian 3.8 baru: beda Pemilik/Admin/admin aplikasi, rekomendasi role
    per orang (16 → 12 role terpakai), aturan persetujuan (Pemilik boleh
    menyetujui sendiri dengan audit; orang lain tetap tidak; pengecualian
    penyesuaian stok diganti), alur setelah rekomendasi, dan pekerjaan bila
    disetujui;
  - 3.6 R2 diberi catatan arah ini;
  - baris Admin di 1.1 merujuk ke 3.8.
- `bahan-keputusan.md`: A1 dicatat "arah programmer B: (b), menunggu Pemilik
  dan Oki"; A3: cuti Aqim mengikuti A1 (b).
- `uat-modul/diagram-alur-per-role.md`: catatan macet di diagram 1–2
  menyebut usulan 3.8. Mermaid dicek ulang: 12 blok, 0 error.

**Dasar pembanding Pemilik/Admin:** `erpRoleGrants`
- owner = `allErpStatements`;
- admin = administrasi saja (member, invitation, company, code_number,
  master_data, portal_account, automation, whatsapp, attendance record,
  service_ticket create/assign, asset_borrowing, audit_log read);
- `LastOwnerError` di `organization.service.ts`.

**Belum dikerjakan (menunggu persetujuan Pemilik dan perubahan ADR-0006 oleh
Oki):** kode aturan persetujuan Pemilik (perkiraan kasar ±1 hari) dan
pengaturan ulang role anggota.
- 2026-11-26: rekomendasi 3.8 diterima programmer B. Status di `validasi-konsep-saat-ini.md` (baris status dan 3.8) diperbarui; masih menunggu Pemilik dan perubahan ADR-0006 oleh Oki. Pekerjaan sesi ini di-commit dan di-push ke branch `fix/web-admin-account-switch-and-po-hint`, lalu `origin/main` digabung ke branch ini.
- 2026-11-26: rekomendasi 3.8 diterima programmer B; status di `validasi-konsep-saat-ini.md` diperbarui (masih menunggu Pemilik dan perubahan ADR-0006 oleh Oki). Pekerjaan sesi ini di-commit dan di-push ke branch `fix/web-admin-account-switch-and-po-hint`, lalu `origin/main` digabung ke branch ini.
- 2026-11-26: hook pre-commit gagal hanya di `graphify update .` (graphify/Python tidak terpasang). Lint, test, dan build lulus dijalankan manual; commit dibuat dengan `--no-verify` atas persetujuan programmer B.

## 2026-11-26 - Commit, push, dan merge main

Atas permintaan programmer B, semua pekerjaan dibuat menjadi 7 commit di
branch `fix/web-admin-account-switch-and-po-hint`:
- 9f58341b ganti akun;
- 75443196 PO dan nomor seri;
- 6ecd91da menu sesuai hak;
- aa013b0e penyesuaian stok;
- 6c08152c error JSON dan nomor PO;
- 8bbcb4b9 Playwright;
- 0958a782 dokumen.

Semuanya di-push ke origin.

**Merge `origin/main`** (91 commit baru, termasuk modul keuangan, portal
karyawan/investor, dan pratinjau dokumen) menjadi commit 8f952c31, lalu
di-push. Ada 2 konflik:
- `adjustment.service.ts`: parameter `users` dan `warehouses` dari branch ini
  digabung dengan `posting?` (opsional) dari main. `posting?` ditaruh
  terakhir karena opsional.
- `nav-config.ts`: dipakai susunan menu Integrasi milik main (submenu
  Percakapan/FAQ; menu Notifikasi tidak ada lagi di sidebar). Hak menunya
  disamakan lagi dengan guard backend, yang tidak berubah di main:
  Percakapan/FAQ → `whatsapp.read` (main: `automation.read`), Webhook n8n →
  `automation.read_log` (main: `integration.read`).

**Pemeriksaan setelah merge:**
- `bun install`;
- `packages/common` di-build ulang (dist lama menyebabkan error tipe izin
  baru dari main);
- `bunx tsc` backend dan web-admin: 0 error;
- `bun run test`: 8/8 task lulus (backend 1631, web-admin 217, locales 110
  pass, 0 fail);
- `bun run lint`: 7/7;
- `bun run build`: 7/7.

**Catatan:**
- Commit dibuat dengan `--no-verify` karena hook berhenti di `graphify`
  (tidak terpasang); lint, test, dan build dijalankan manual dan lulus.
- `.claude/launch.json` lokal (belum dilacak git) dipindah ke
  `%TEMP%\launch.json.local-backup`, karena main sekarang membawa versi
  sendiri.
- `docs/plan/progress.md` dan `backlog.md` tidak diubah, sesuai arahan
  programmer B sebelumnya (dokumen bersama perlu persetujuan).

## 2026-11-26 - Pull request dan migrasi ulang database dev

**Pull request:** #169 (https://github.com/okifirsyah404/ims-erp/pull/169),
dibuat dengan akun RogexSan, `fix/web-admin-account-switch-and-po-hint` →
`main`.

**Migrasi ulang (permintaan programmer B: "dimigrate ulang dengan datanya"):**
- Main sekarang memakai PostGIS: `docker-compose.yml` beralih ke
  `postgis/postgis:18-3.6`, dan ada migrasi `20261125201740_postgis_extension`
  (`CREATE EXTENSION postgis`). Database dev lama memakai
  `postgres:18-alpine` tanpa PostGIS, dengan 26 dari 41 migrasi terpasang.
- Database lama **tidak dihapus**: container dihentikan dan diganti nama
  menjadi `ims-erp-postgres-old-20261126` (volume `ims-erp-pgdata` utuh). Data
  UAT manual sebelumnya ada di sana bila dibutuhkan.
- Container baru: `ims-erp-postgres-1`, image `postgis/postgis:18-3.6`, port
  15432, volume baru `ims-erp-pgdata-postgis`. Kredensial disalin dari
  container lama lewat env-file sementara (sudah dihapus, tidak
  ditampilkan).
- `bun run drizzle:migrate`: berhasil, 41 migrasi, PostGIS 3.6.4, 20 schema,
  192 tabel.
- `bun run drizzle:seed`: berhasil (sekitar 7 detik). Isinya mengikuti seeder
  main: 40 akun, 3 produk, 29 karyawan, proyek demo, dan lain-lain. **Tidak
  ada pemasok atau pelanggan contoh**; checklist UAT membuat datanya
  sendiri. Seeder menjalankan `flushall` Redis, jadi semua sesi login harus
  login ulang.

**Pemeriksaan:**
- login `warehouse_seed` dan `purchasing_seed` via API: 200;
- Playwright setup: 7 role login lulus;
- `m05-a-barang` + `m05-akses`: 16 passed.

**Catatan lingkungan:** folder `%LOCALAPPDATA%\ms-playwright` ikut hilang
(seperti Python sebelumnya), jadi Chromium Playwright dipasang ulang.
`PDF_CHROMIUM_PATH` memakai Chrome di Program Files dan masih ada.

README UAT bagian Persiapan menyebut image PostGIS.
