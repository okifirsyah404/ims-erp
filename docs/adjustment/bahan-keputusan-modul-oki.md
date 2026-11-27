# Bahan keputusan untuk Pemilik dan Oki (modul Oki)

Kembali ke [catatan penyesuaian](README.md). Disusun 2026-11-27 untuk modul
programmer kedua (Oki): M12 Laporan & Hak Akses, M09 Keuangan, M10 Pajak, M06
Aset & Peralatan, M11 Bonus & Investor, M01 Dasbor, dan portal karyawan
(`apps/web-employee`). Pasangan dari [`bahan-keputusan.md`](bahan-keputusan.md)
(modul programmer B). Isi kolom **Keputusan**, lalu Oki mengerjakannya.

Sumber rinciannya: checklist [`uat-modul/modul-oki/`](uat-modul/modul-oki/README.md)
(langkah ⚠️/❓ dan "Catatan penyusun"), [`rencana-perubahan.md`](rencana-perubahan.md)
bagian 3 (O-1..O-9), [`lembar-keputusan-rapat.md`](lembar-keputusan-rapat.md),
[`lintas-modul/autentikasi-dan-hak-akses.md`](lintas-modul/autentikasi-dan-hak-akses.md),
dan `skema-database/`. Klaim utama dicek ulang ke kode `main` pada 2026-11-27;
semua temuan UAT masih **dugaan dari membaca kode**, belum dilihat di layar.

**Siapa memutuskan:**
- **Pemilik:** cara kerja bisnis (siapa boleh apa, fitur dibangun atau tidak).
- **Oki:** aturan teknis dan dokumen arsitektur miliknya (ADR, `erp-permissions.ts`, guard).
- **Dafrin:** ikut menyetujui bila menyentuh modulnya (role, portal pelanggan, gaji).

**Yang sudah diisi di lembar rapat dan dipakai di sini (belum final sampai rapat):**
K1 = (b) Pemilik boleh menyetujui dokumennya sendiri, tercatat di audit;
K1a = (b) tidak berlaku untuk keuangan (jurnal, kasbon, pertanggungjawaban tetap
butuh orang kedua); K2 = (a) susunan role per orang; role **Admin** tidak dipakai,
**Anggota** dan **Auditor** "hapus", **Akuntan** "merging ke Keuangan"; K7a = (a)
gaji/pembayaran tanpa pemeriksa kedua diterima, peminjaman aset diperbaiki.
Tim: Aqim Pemilik (+SDM), Bella akuntan, Agus MD dan Bilal penjualan,
Agus/Jamil/Hatta PM, Fahri/Alex/Ade teknisi, Dafrin/Oki pekerja lepas.

**Diperbarui 2026-11-27 sesuai keputusan tanya-jawab** (jawaban programmer B,
menunggu konfirmasi Pemilik dan Oki; sumber: lembar rapat bagian 0): K1a
diganti, kasbon dan pertanggungjawaban ikut K1 (Aqim tidak mengajukan kasbon),
jurnal manual tetap orang kedua; RO5 pertanggungjawaban satu langkah oleh Aqim;
K2b Penjualan digabung; K2d Akuntan digabung ke Keuangan (Bella); Anggota dan
role organisasi Admin dihapus (tanda admin aplikasi Aqim tetap); K12 bertahap;
K13 web-admin dan portal karyawan tanpa Google, karyawan diundang; OA4
pelanggan satu jenis akun; OB7/OB8 diterima; OD1 daftar unit khusus; K10/OE1
ditunda; OG1 tolak. K8, K9, K11 dibahas di rapat.

**Diperbarui 2026-11-27 (tanya-jawab kedua):** semua kolom Keputusan yang masih
kosong diisi dari lembar rapat bagian 0 (OA2, OA8, OA12–OA14, OB2, OB3, OB5,
OB10, OB12–OB15, OC1–OC8, OD3–OD9, OE3/OE4, OF1–OF3, OG2–OG6). Yang masih
**dibahas di rapat**: OB11 (dan K8, K9, K11 di lembar rapat). ⚠️ OA2 (kolom
`organization_id` langsung dihapus di tahap pertama) bertentangan dengan K12
bertahap; perlu dikonfirmasi Oki dan Dafrin sebelum ADR K12 ditulis.

---

## A. M12 Login, role, organisasi, dan audit (paling berdampak)

Semua modul bergantung pada M12 (`erp-permissions.ts`, guard di `src/http/plugin.ts`
dan `src/authorization/`, audit). Keputusan di sini mendahului bagian lain.

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OA1 | **K12: lapisan organisasi dihapus dengan cara apa?** | Role disimpan per organisasi di `auth.members.role`; 18 file skema memakai `organization_id`; web-admin mengirim header `x-organization-id` (`apps/web-admin/src/lib/admin-api.ts`, `finance-api.ts`, `inventory-api.ts`); pemilih organisasi di sidebar; undangan ke organisasi | (a) Hapus sekaligus: role pindah ke tingkat pengguna, kolom `organization_id` dibuang, migrasi besar. (b) **Bertahap**: tahap 1 satu organisasi tetap di database tapi disembunyikan (pemilih dan halaman Organisasi hilang, sesi selalu ke organisasi tunggal); tahap 2 role pindah ke pengguna; tahap 3 kolom `organization_id` dibuang per modul. (c) Biarkan, hanya sembunyikan tampilan | **(b)**, tahap 1 saja dulu. Butuh ADR baru yang menggantikan ADR-0001/0007/0012 dan mengubah ADR-0006/ADR-0008. Tahap 2–3 mengubah `docs.dbml` dan migrasi semua modul, jadi dijadwalkan bersama Dafrin | (b) bertahap: 1 sembunyikan pemilih organisasi, 2 role ke tingkat pengguna, 3 hapus `organization_id` dengan ADR baru (K12, jawaban programmer B 27/11) |
| OA2 | Bila OA1 (b): nasib `organization_id` di tabel bisnis selama masa peralihan | Kolom nullable di banyak tabel; di `inventory` NULL berarti "seluruh perusahaan" (ADR-0008) | (a) Tetap diisi organisasi tunggal. (b) Boleh NULL di semua tabel | **(a)** sampai tahap 3, supaya filter query tidak berubah dan tidak ada data yang "hilang" | **Kolom `organization_id` langsung dihapus di tahap pertama K12**; berbeda dari rekomendasi. ⚠️ Risiko: migrasi besar di semua modul sejak awal dan bertentangan dengan K12 bertahap (kolom baru dibuang di tahap 3); perlu dikonfirmasi Oki dan Dafrin (jawaban programmer B 27/11) |
| OA3 | **K13: login web-admin tanpa Google** | Tombol Google memanggil `signIn.social` (`apps/web-admin/src/components/form/login-form.tsx:98`); Google `disableSignUp: true` | (a) Hapus tombol saja, provider Google tetap aktif untuk portal. (b) Hapus juga metode lain yang tidak dipakai (passkey, magic link, email OTP) | **(a)** sekarang; (b) dibahas terpisah karena email OTP dipakai pendaftaran pelanggan perorangan | (a); portal karyawan juga tanpa Google, karyawan diundang lalu mengganti kata sandi dan login (K13, jawaban programmer B 27/11) |
| OA4 | K13: portal pelanggan login dengan Google: aturan akun | Tombol Google di portal masih "segera hadir" (`apps/web-customer-portal/src/pages/login.astro`); `GOOGLE_*` belum diisi di server | (a) Akun Google dicocokkan ke kontak pelanggan lewat email; pelanggan perusahaan tetap diundang dulu; perorangan boleh daftar dengan Google. (b) Google hanya untuk akun yang sudah ada | **(a)**, sesuai keputusan portal 2026-11-19. Pengerjaan portal di Dafrin (M07), konfigurasi Better Auth di Oki | (a) dengan perubahan: pelanggan **satu jenis akun** (tanpa tipe perorangan/perusahaan saat login), login Google, data perusahaan diisi belakangan di profil (jawaban programmer B 27/11) |
| OA5 | **Audit ikut transaksi bisnis?** | `AuditWriter.record` "never throws" dan fire-and-forget (`apps/backend/src/shared/audit/audit.writer.ts:1-45`); bila gagal, transaksi tetap jalan dan audit hilang | (a) Tetap fire-and-forget. (b) Audit ditulis di transaksi yang sama untuk peristiwa wajib (gagal audit = gagal transaksi). (c) Outbox audit | **(b)** untuk daftar wajib di OA6; sisanya boleh tetap (a). Syarat K1 | (b) audit wajib ikut transaksi, dikerjakan sebelum K1 (jawaban programmer B 27/11) |
| OA6 | **Peristiwa yang wajib diaudit** | Modul user hanya mencatat undangan dan siklus akun (`invitation.service.ts:256-430`, `user-admin.service.ts:106-154`); `organization.service.ts` tanpa panggilan audit; ekspor tidak diaudit | Daftar usulan: perubahan role anggota, pengeluaran anggota, aktif/nonaktif akun, **persetujuan oleh pembuat sendiri (K1)**, persetujuan/pembatalan di sale, procurement, human_resource, payment, buka/tutup/kunci periode, posting rule, ekspor laporan keuangan dan data pribadi | Setujui daftar ini; ekspor cukup dicatat siapa, apa, kapan (tanpa isi file) | Setuju; minimal perubahan role, hapus anggota, dan persetujuan sendiri wajib tercatat (jawaban programmer B 27/11) |
| OA7 | Bagaimana persetujuan oleh pembuat (K1) dicatat? | Belum ada | (a) Aksi biasa + `meta.self_approved = true`. (b) Aksi tersendiri `*.self_approved` | **(a)**: tanpa kolom baru, filter cukup di Log Audit | Persetujuan sendiri wajib tercatat; bentuk (a)/(b) diserahkan ke Oki (jawaban programmer B 27/11) |
| OA8 | Siapa boleh membaca Log Audit? | Server memberi `audit_log:read` ke Pemilik, Admin, Auditor (`docs/role-permission.md:651`), tetapi menu `/admin/*` hanya untuk admin aplikasi (`nav-config.ts:662`). Admin tidak dipakai dan Auditor "hapus" (K2) | (a) Hanya Pemilik (Aqim, juga admin aplikasi). (b) Tambah Akuntan/Keuangan (Bella) untuk baca | **(a)**; (b) bila Bella perlu menelusuri pembayaran (pemeriksaan K7a lewat audit) | (a) hanya Pemilik (jawaban programmer B 27/11) |
| OA9 | K2: role yang "hapus" (Anggota, Auditor) dan "tidak dipakai" (Admin) dihapus dari kode atau hanya tidak diberikan? | 17 role di `erp-permissions.ts:257-276` | (a) Hapus dari kode (ubah `erpRoleNames`, seeder, test, locale). (b) Tetap di kode, tidak diberikan | **(b)**: sesuai catatan lembar rapat ("tidak dipakai" tetap ada). Anggota dihapus berarti Dafrin/Oki (Pekerja Lepas) tanpa absen/slip: wajar bila mereka tidak digaji lewat aplikasi | Anggota dihapus (Dafrin dan Oki hanya Pekerja Lepas, tanpa absensi/slip gaji); role organisasi Admin dihapus, tanda admin aplikasi Aqim tetap. Cara (a)/(b) di kode diserahkan ke Oki (jawaban programmer B 27/11) |
| OA10 | **K2d: Akuntan "merging ke Keuangan"** (isian lembar) atau Bella dua role? | Keuangan tidak punya `chart_of_account`/`journal`; Akuntan tidak punya `payment`/`invoice` penuh (`erp-permissions.ts:746-813`) | (a) Gabung di kode: `finance` mendapat hak `accountant`. (b) Bella diberi dua role, tanpa ubah kode | **(b)**: hasil sama untuk Bella, role masih bisa dipisah bila ada staf baru. Pilih (a) bila Pemilik ingin satu nama role | (a) gabung di kode, dipegang Bella; Bella melihat gaji dan rekening karyawan (K2d/X3, jawaban programmer B 27/11) |
| OA11 | K2b: label `sales_manager` = "Penjualan" dan `sales` tidak ditawarkan | Dua role terpisah | (a) Ubah label + daftar role yang bisa diberikan. (b) Tetap | **(a)**, ikut keputusan K2b (perubahan kecil di `erp-permissions.ts` milik Oki) | (a), ikut K2b gabung (jawaban programmer B 27/11) |
| OA12 | SDM bisa mengundang tapi tidak punya halaman | `hr` punya `invitation:create`, `member:read` tanpa `organization:read`; menu Organisasi tertutup | (a) Beri `organization:read`. (b) Cabut `invitation:create` dari SDM | **(b)** bila K12 tahap 1 menghilangkan halaman Organisasi; SDM = Aqim yang juga Pemilik | (b) cabut `invitation:create` dari SDM; mengundang lewat Pemilik (jawaban programmer B 27/11) |
| OA13 | Hapus undangan dan nonaktifkan pengguna tanpa dialog konfirmasi | `pending-invitations-panel.tsx:194-198`, `admin/users/index.tsx:569` | (a) Tambah konfirmasi. (b) Tetap | **(a)** | (a) pakai dialog konfirmasi (jawaban programmer B 27/11) |
| OA14 | Pesan login akun nonaktif sama dengan akun yang belum klaim undangan | `session.auth.ts:46-49` | (a) Pisahkan pesan. (b) Tetap (tidak membocorkan status akun) | **(a)** untuk web-admin internal; risikonya kecil karena hanya undangan | (a) pesan dibedakan (jawaban programmer B 27/11) |

**Dampak ke kode:** OA1 tahap 1 perkiraan kasar 2–3 hari (web-admin + sesi);
tahap 2–3 berminggu-minggu dan menyentuh semua modul. OA5–OA7 sekitar 1–2 hari
dan harus selesai sebelum aturan K1 diterapkan.

## B. M09 Keuangan

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OB1 | Role Keuangan diberi `chart_of_account:read`? | Form kas/bank, akun lawan, dan akun beban memuat `/finance/ledger/accounts` yang butuh `chart_of_account:read` (`docs/role-permission.md:847`); blok `finance` tidak punya hak itu (`erp-permissions.ts:746-784`) | (a) Beri baca bagan akun (dan `journal:read`). (b) Form memakai daftar akun ringkas tanpa hak bagan akun | **(a)**: perbaikan satu baris; tanpa ini form Keuangan kosong. Bila OA10 (b), Bella tetap terbantu lewat role Akuntan | (a) ikut K2d (a): role Keuangan gabungan mendapat hak Akuntan, termasuk bagan akun (jawaban programmer B 27/11) |
| OB2 | Batas daftar akun 100 vs layar yang meminta 200/300 | Server `max(100)` (`apps/backend/src/app/finance/contracts/ledger.contract.ts:50`); layar meminta 200 (`reconciliation-page.tsx:85`, `fixed-assets-page.tsx:180`, `advances-panel.tsx:341`) dan 300 (`project-budgets-page.tsx:41`), jadi permintaan ditolak validasi | (a) Naikkan batas server ke 500 untuk daftar akun. (b) Layar memakai 100 + pencarian. (c) Endpoint pilihan akun khusus tanpa paging | **(c)** atau **(a)**: bagan akun seeder sudah ±98 baris, (b) akan terpotong lagi | Pilihan akun dengan pencarian ke server (mirip (b), tanpa batas tetap di layar); berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OB3 | Layar pembayaran pemasok | Tidak ada; `createPayment` hanya di `employee-payment-dialog.tsx:54`; backend sudah mendukung alokasi tagihan dan potongan PPh (`payment.contract.ts:24-47`) | (a) Buat layar dari halaman Utang. (b) Tunda; bayar dicatat lewat kas/bank manual | **(a)**: tanpa ini utang dagang tidak pernah lunas di sistem dan PPh potong (ERP-0140) hanya lewat API | (a) layar pembayaran pemasok dibuat, termasuk potongan PPh (jawaban programmer B 27/11) |
| OB4 | "Siapkan periode" butuh `accounting_period:create` yang tidak ada di kosakata | `ledger.controller.ts:191` vs `erp-permissions.ts:120` (`read`, `close`, `reopen`); `docs/role-permission.md:873` "no org role" | (a) Tambah aksi `create` dan beri ke Akuntan/Pemilik. (b) Rute memakai `accounting_period:close` | **(a)** | (a) tambah `accounting_period:create` untuk Pemilik dan Keuangan (gabungan Akuntan) (RO1, jawaban programmer B 27/11) |
| OB5 | Akuntan membuka Aset tetap dan Anggaran proyek? | Server mengizinkan kapitalisasi/penyusutan (`journal:post`) dan simpan anggaran (`journal:approve`), tetapi daftar butuh `asset:read`/`project:read` yang Akuntan tidak punya (`erp-permissions.ts:786-813`; `docs/role-permission.md:841-844, 879-884`) | (a) Beri Akuntan `asset:read` dan `project:read`. (b) Halaman keuangan memakai hak finance sendiri (mis. `fixed_asset:read`) | **(a)** sekarang; (b) bila asset register pindah penuh ke finance | (a) Keuangan gabungan (Bella) bisa membuka Aset tetap dan Anggaran proyek (jawaban programmer B 27/11) |
| OB6 | Hak buka kembali periode untuk Akuntan | Akuntan punya `reopen` (`erp-permissions.ts:792`), padahal komentar `ledger.controller.ts:210-213` menyatakan tidak | (a) Cabut, hanya Pemilik. (b) Tetap, perbaiki komentar | **(a)**: buka kembali jarang dan diaudit (ADR-0030 butir 5) | (a) buka kembali hanya Pemilik; route pembuka periode memeriksa hak `reopen` (RO4, jawaban programmer B 27/11) |
| OB7 | **Maker-checker pembayaran** | `payment.service.ts:150-155` hanya mencatat `approvedBy`, tanpa cek pembuat | (a) Diterima tanpa pemeriksa kedua (K7a = a), diawasi lewat audit dan rekonsiliasi Bella. (b) Tambah cek pembuat ≠ penyetuju (Pemilik dikecualikan, K1) | **(a)** sesuai isian K7a, tetapi wajib audit (OA6) | (a) diterima tanpa pemeriksa kedua, diawasi lewat laporan dan audit (jawaban programmer B 27/11) |
| OB8 | **Maker-checker klaim biaya** | `expense-claim.service.ts:291` tanpa cek pengaju ≠ penyetuju; bandingkan `manual-journal.service.ts:133` dan `receivable-adjustment.service.ts:205` yang mengecek | (a) Tambah cek seperti jurnal manual. (b) Tetap | **(a)**: seragam dengan jurnal, sesuai K1a (b) | (b) tetap tanpa pemeriksa kedua, diawasi lewat laporan dan audit; berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OB9 | K1a: Pemilik boleh menyetujui sendiri jurnal manual, write-off, kasbon, pertanggungjawaban? | Semua dilarang (`manual-journal.service.ts:132`, `receivable-adjustment.service.ts:205`, `employee-advance.service.ts:126, 217, 235`) | (a) Ya, ikut K1. (b) Tidak, tetap orang kedua | Isian lembar: **(b)**. Akibatnya kasbon Aqim butuh Bella; pastikan Bella punya hak `advance`/`settlement` (sekarang tidak ada di Keuangan/Akuntan) | Campuran: jurnal manual (b) tetap orang kedua (Bella ↔ Aqim); kasbon dan pertanggungjawaban (a) ikut K1; Aqim tidak mengajukan kasbon; pertanggungjawaban cukup satu langkah oleh Aqim (RO5). Write-off tidak dibahas (jawaban programmer B 27/11) |
| OB10 | **Write-off tanpa cadangan** | `receivable-adjustment.service.ts:220` mendebit `bad_debt_allowance` (1-1390) walau cadangan belum dibentuk; laba rugi tidak memuat kerugian | (a) Write-off langsung ke beban kerugian piutang bila cadangan kurang. (b) Wajib bentuk cadangan dulu (jurnal penyesuaian). (c) Pilihan akun per write-off | **(a)**: sederhana untuk SAK EP, metode cadangan tetap bisa dipakai | (a) write-off langsung jadi beban kerugian piutang, tanpa cadangan (jawaban programmer B 27/11) |
| OB11 | **Arus kas tidak langsung memuat kapitalisasi nonkas** | `statement.service.ts:98-121` mengelompokkan semua mutasi akun neraca nonkas; kapitalisasi dengan lawan modal muncul di Investasi dan Pendanaan | (a) Abaikan jurnal yang tidak menyentuh kas (pasangan nonkas). (b) Tandai jurnal nonkas di sumbernya | **(a)**; uji dengan langkah E4 UAT laporan (kas akhir = kas neraca) | **Dibahas di rapat** |
| OB12 | **Ekspor CSV laporan salah alamat** | `reports-page.tsx:100, 109, 118` memanggil `/reports/*.csv` tanpa `/finance`; galat tidak ditampilkan (`:302-307`) | (a) Perbaiki alamat dan tampilkan galat. (b) Hapus tombol CSV, cukup XLSX paket manajemen | **(a)**: bug kecil, plus audit ekspor (OA6) | (a) diperbaiki (jawaban programmer B 27/11) |
| OB13 | Uang muka hanya bisa dicairkan Pemilik | Panel butuh `advance.read`; Keuangan/Akuntan tidak punya `advance`/`settlement`; teknisi tidak punya `employee:read` untuk pemilih karyawan dan tidak punya data karyawan di seed (`hr.seeder.ts:21-28`) | (a) Beri Keuangan/Akuntan `advance` + `settlement`; pengaju memilih dirinya sendiri tanpa pemilih karyawan. (b) Tetap Pemilik | **(a)**, terkait OB9 dan OG4 | Kasbon teknisi **dicairkan Aqim**; teknisi mengajukan dan melihat kasbonnya dari portal karyawan (OB13/RO6, jawaban programmer B 27/11) |
| OB14 | Tagihan pemasok manual tanpa pilihan akun beban | Selalu ke peran Beban bawaan 6-2900 (`bills-table.tsx`) | (a) Tambah pilihan akun. (b) Tetap, koreksi lewat jurnal | **(a)** bila Bella sering mencatat tagihan nonbarang | (a) bisa memilih akun beban (jawaban programmer B 27/11) |
| OB15 | Teks Inggris dan label yang tertinggal | Checklist tutup bulan berbahasa Inggris (`month-end-close.service.ts:130-156`); peran posting di web tertinggal dari backend (`finance-api.ts:370-433` vs `posting-roles.ts`); halaman induk Keuangan "Segera hadir" | Perbaiki (tanpa keputusan bisnis) | Kerjakan bersama perbaikan Tinggi | Nanti, prioritas rendah (jawaban programmer B 27/11) |

## C. M10 Pajak

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OC1 | **Bug jenis pajak `vat`** | Form mengirim `taxType: 'vat'` (`apps/web-admin/src/components/tax/tax-type-list.tsx:69`), server hanya menerima `ppn/pph/ppn_input/ppn_output/other` (`tax.schema.ts:35-41`); jenis `pph` tidak bisa dibuat dari layar | (a) Form memakai pilihan jenis sesuai server. (b) Server menerima `vat` sebagai alias | **(a)**; tanpa ini tarif dan potongan PPh pemasok tidak bisa disiapkan | (a) diperbaiki (jawaban programmer B 27/11) |
| OC2 | **Ubah catatan pajak draf tidak menghitung ulang** | Dialog hanya mengirim dasar baru (`tax-record-edit-dialog.tsx:46`); repository tidak menghitung ulang (`tax.repository.ts:268-286`) | (a) Service menghitung ulang dari dasar + tarif. (b) Dasar tidak bisa diubah, batalkan dan buat ulang | **(a)**, dihitung di service, bukan repository | (a) dihitung ulang otomatis (DPP × tarif) (jawaban programmer B 27/11) |
| OC3 | **Periode Bupot** untuk pemotongan dari layar | Form tidak mengirim periode (`withholding-list.tsx:90-96`); ekspor XML menyaring per periode (`tax.repository.ts:475-488`), jadi catatan dari layar tidak pernah masuk XML | (a) Periode otomatis dari tanggal pemotongan (Asia/Jakarta). (b) Kolom periode wajib di form | **(a)**, dengan (b) sebagai koreksi manual | (a) masa Bupot diisi otomatis dari tanggal transaksi (jawaban programmer B 27/11) |
| OC4 | **Sumber tarif PPN dokumen** | SPH/PO memakai `vatRateBps` per dokumen (`sale/utils/quotation-totals.ts:8-9`, `procurement/utils/po-totals.ts:8`); rencana M10 meminta tarif dari master pajak | (a) Tetap per dokumen (keputusan M02 "VAT per dokumen"), master hanya nilai bawaan saat membuat. (b) Selalu dari master | **(a)**: sesuai keputusan M02; master pajak mengisi nilai awal | Tarif dari master pajak bertanggal berlaku; dokumen menyimpan salinan tarif; pengecualian per dokumen dengan alasan; berbeda dari rekomendasi (a) (jawaban programmer B 27/11) |
| OC5 | Terbayar → Dibatalkan diizinkan server tapi tidak ada tombol | `tax.service.ts:47` vs `withholding-list.tsx:211` | (a) Tambah tombol (dengan alasan). (b) Larang di server | **(b)**: pemotongan yang sudah dibayar dikoreksi lewat pembetulan | (a) tombol Batalkan + alasan; berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OC6 | Kode pemotongan ganda menghasilkan galat umum | Unique index `withholding_tax_records_org_code_uq` tanpa pemetaan 23505 di `src/http/plugin.ts` | (a) Petakan ke pesan "kode sudah dipakai". (b) Kode otomatis dari penomoran | **(b)** bila nomor bebas tidak dibutuhkan; (a) minimal | (a) pesan jelas "kode sudah dipakai" (jawaban programmer B 27/11) |
| OC7 | Periode pajak tertutup harus read-only? | Belum ada pemeriksaan (rencana M10 baris 71) | (a) Tolak ubah catatan di periode terkunci keuangan. (b) Tetap | **(a)**, ikut status periode `locked` di finance | (a) masa pajak yang ditutup dikunci (read-only) (jawaban programmer B 27/11) |
| OC8 | Gerbang keuangan D12/D14/D18 dan tabel TER resmi | Belum ditutup (`backlog.md` ERP-0016, ERP-0138, ERP-0140); format Coretax belum diuji impor | Putuskan oleh Bella + Pemilik: kolom ekspor, pembulatan half-up rupiah, tarif final | Jadwalkan uji impor Coretax sebelum dipakai lapor | PPh 21 otomatis **belum dipakai**, dihitung di luar aplikasi; tabel TER resmi belum perlu. Gerbang D12/D14/D18 dan uji impor Coretax tetap sebelum lapor (jawaban programmer B 27/11) |

## D. M06 Aset & Peralatan

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OD1 | **Teknisi mengajukan peminjaman** | Form memuat unit dari `/inventory/items` yang dijaga `asset:read` (`borrowing-form.tsx:83-85`); `technician` hanya punya `asset_borrowing: ['read', 'create']` (`erp-permissions.ts:679`); Gudang juga tanpa `asset:read` | (a) Beri `asset:read` ke Teknisi, PM, Gudang. (b) Endpoint pilihan unit tersedia yang dijaga `asset_borrowing:create` | **(b)**: teknisi cukup melihat unit yang bisa dipinjam, bukan nilai aset | (b) daftar unit khusus untuk diajukan teknisi (X7, jawaban programmer B 27/11) |
| OD2 | **Bypass persetujuan sendiri peminjaman** | `canApprove` diisi dari hak `approve` (`borrowing.controller.ts:38`) dan rute approve mewajibkan hak itu, jadi pengecualian di `borrowing-request.service.ts:259-265` selalu lolos | (a) Ikut K1: hanya Pemilik boleh menyetujui sendiri, tercatat audit. (b) Larang semua | **(a)**, sesuai isian K7a ("perbaiki peminjaman aset") | (a) diperbaiki (jawaban programmer B 27/11) |
| OD3 | **Satuan uang aset (×100)** | Form mengalikan 100 (`asset-form.tsx:86`), `formatMoney` tidak membagi (`asset-api.ts:605-611`), halaman Aset tetap membagi; disposal dan penyusutan dikirim tanpa ×100; seeder `acquisitionCost: 2_500_000` = Rp 25.000 menurut ADR-0002 | (a) Semua layar dan seeder memakai rupiah-sen (ADR-0002), perbaiki tampilan dan seeder. (b) Kolom aset dalam rupiah utuh | **(a)**: ADR-0002 berlaku untuk nilai buku besar; perlu migrasi data hanya di database dev | (a) sen di penyimpanan, rupiah di layar (jawaban programmer B 27/11) |
| OD4 | ID mentah di layar | Peminjam, nomor seri, asal gudang, penanggung jawab tampil sebagai id (`borrowing-list.tsx:285`, `borrowing-detail.tsx:458, 494, 512`, `asset-register-list.tsx:363`) | Tampilkan nama lewat kontrak modul pemilik | Kerjakan bersama OD1 | Tampilkan nama dan pakai pilihan, bukan ID (jawaban programmer B 27/11) |
| OD5 | **Catatan servis dan set peralatan setengah jadi** | `logMaintenance`/`recordConditionCheck` tidak dipakai layar mana pun (`asset-api.ts:466-505`); set peralatan memakai id mentah, isi set tidak tampil, peminjaman per set tidak ada di form | (a) Selesaikan. (b) Sembunyikan menu sampai dibutuhkan | **(b)**: di luar baseline M06; buka lagi bila Pemilik memintanya (K9) | Campuran: catatan servis/kondisi **dilengkapi**, Set Peralatan **disembunyikan** (jawaban programmer B 27/11) |
| OD6 | **Penghapusan aset yang sedang dipinjam** | Hanya menolak yang sudah `disposed` (`disposal.service.ts:62`); transisi `borrowed → inactive` diizinkan (`item.service.ts:44`) | (a) Tolak penghapusan/nonaktif selama `borrowed`. (b) Tetap | **(a)** | (a) ditolak bila sedang dipinjam (jawaban programmer B 27/11) |
| OD7 | Pengembalian selalu `good`; peminjaman yang semua unitnya hilang tidak bisa ditutup | `borrowing-detail.tsx:133`; `borrowing.service.ts:55-60, 313-370` | (a) Pilihan kondisi + catatan; hilang menutup peminjaman. (b) Tetap | **(a)** | (a) pilihan kondisi Baik/Rusak/Tidak lengkap; unit hilang bisa menutup peminjaman (jawaban programmer B 27/11) |
| OD8 | Model aset: rencana `assets` (11 tabel) vs kode di `inventory` | Rencana M06 masih "separate `assets` module, planned"; kode memakai unit bernomor seri di `inventory` + register aset tetap di finance (ADR-0030) | (a) Tetap di `inventory` + finance, perbarui rencana. (b) Bangun modul `assets` | **(a)**; sepakati dengan Dafrin pembagian schema `inventory` (stok milik B, aset/peminjaman milik Oki) | (a) tetap di `inventory` (fisik) + `finance` (nilai); tabel stok milik programmer B (M05), tabel aset milik Oki (M06); dipecah hanya bila aset banyak/rumit, saling ganggu antar-programmer, atau aplikasi terpisah; rencana M06 dibetulkan (jawaban programmer B 27/11) |
| OD9 | Kolom PIC aset dan kondisi aset | Tidak ada PIC tetap; kondisi tidak bisa diisi dari layar | (a) Tambah. (b) Tunda | Tanyakan Pemilik: perlu tahu "alat ini dipegang siapa" di luar peminjaman? | (b) belum perlu (jawaban programmer B 27/11) |

## E. M11 Bonus & Investor

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OE1 | **K10: dibangun atau ditunda?** | Belum dibangun: tiga halaman "Segera hadir" (`routes/_authed/finance/investors/*`); schema `investor` dihapus (ADR-0024, ADR-0030), rencana M11 masih memetakan 11 tabel; T13 `blocked` menunggu skema bagi hasil dari Pemilik | (a) Bangun: ADR baru (letak tabel, mis. di `finance`), skema bagi hasil dari Pemilik. (b) Tunda, keluarkan dari kontrak tahap ini | **(b)** sampai Pemilik memberi skema bagi hasil; catat di K8/K9 | (b) ditunda (K10, jawaban programmer B 27/11) |
| OE2 | `/finance/investors` terbuka untuk semua pengguna internal | Bukan daun menu, `findNavLeaf` null sehingga guard mengizinkan (`apps/web-admin/src/lib/route-guard.ts:31-32`) | (a) Guard memakai hak `investor:read` untuk awalan ini. (b) Hapus rute induk | **(a)**; perbaikan kecil, berlaku umum untuk semua rute induk | (a) halaman investor ditutup, hanya Pemilik (jawaban programmer B 27/11) |
| OE3 | `apps/web-investor` masih template Vite | Tanpa router/auth/i18n, `lang="en"`, tidak ada di compose/CI | (a) Hapus sampai OE1 = (a). (b) Biarkan | **(a)** atau tandai jelas "belum dimulai" di README aplikasinya | Ditunda ikut K10 (jawaban programmer B 27/11) |
| OE4 | Hak investor di role sekarang | Keuangan/Akuntan baca investor; Akuntan `investor_report: publish`; hanya Pemilik `profit_distribution` | (a) Biarkan sampai dibangun. (b) Cabut semua hak investor sampai dibangun | **(a)**: tidak berbahaya karena tidak ada data | Ditunda ikut K10 (jawaban programmer B 27/11) |

## F. M01 Dasbor

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OF1 | **Tautan dasbor ditolak per role** | Kartu Inventaris tampil dengan `product.read`, tautan "Lihat semua"/Stok butuh `stock.read` (`dashboard-page.tsx:374, 673`); Penjualan dan Pemasaran ditolak | (a) Sembunyikan tautan bila tidak punya hak tujuan. (b) Beri `stock:read` ke Penjualan/Pemasaran | **(b)** untuk Penjualan (Bilal/Agus MD perlu melihat stok saat menawar), (a) untuk lainnya | (a) kartu/tautan disembunyikan bila role tidak berhak; berbeda dari rekomendasi (b) untuk Penjualan (jawaban programmer B 27/11) |
| OF2 | **Lencana "Sementara" pada Laba selalu tampil** | Teks tetap "Provisional — periode belum ditutup" (`dashboard-page.tsx:346`) | (a) Tampil hanya bila periode belum `closed`/`locked`. (b) Hapus | **(a)**, sesuai rencana M01 | (b) lencana "Sementara" dihapus, karena pembukuan tidak ditutup rutin; berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OF3 | `dashboard:read` tidak pernah diperiksa | Dasbor terbuka untuk semua role internal (`routes/_authed.index.tsx`) | (a) Periksa hak; role tanpa hak melihat dasbor ringkas. (b) Hapus hak dari kosakata | **(a)** bila Teknisi/Gudang tidak boleh melihat angka; kartu sudah disaring per hak, jadi risikonya kecil | (a) hak `dashboard:read` diperiksa (jawaban programmer B 27/11) |

## G. Portal karyawan (`apps/web-employee`)

Portal ini di luar kontrak (K9). Keputusan di bawah berlaku bila Pemilik
menerimanya sebagai tambahan.

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| OG1 | **Absen di luar radius tetap tersimpan** | Ditandai `out_of_range`, tidak ditolak (`apps/backend/src/app/project/services/site-attendance.service.ts:119-176`); petunjuk "Radius 100 m" tertulis mati; tidak ada cek radius saat check-out | (a) Tolak. (b) Simpan dengan tanda, PM/SDM meninjau | **(b)** + layar tinjau untuk Aqim/PM (sekarang belum ada); petunjuk radius dari setting | (a) tolak absen di luar radius; berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OG2 | **Pekerja non-PIC tidak melihat kunjungan sendiri** | Tab "Kunjungan lokasi saya" memanggil rute khusus PIC (`portal-project.controller.ts:114-118`, `site-attendance.service.ts:113-117`); PIC melihat semua orang | (a) Non-PIC melihat miliknya sendiri, PIC melihat semua. (b) Tetap | **(a)** | (a) pekerja melihat riwayat absen lokasinya sendiri (jawaban programmer B 27/11) |
| OG3 | **Tautan lupa kata sandi rusak** | `/forgot-password` tidak ada di `apps/web-employee/src/routes` (`login-form.tsx:182`) | (a) Buat halaman reset. (b) Hapus tautan; reset lewat Aqim | **(b)** untuk tim 10 orang; (a) bila karyawan sering lupa | (a) halaman lupa kata sandi dibuat; berbeda dari rekomendasi (jawaban programmer B 27/11) |
| OG4 | **Teknisi tanpa data karyawan** | Seeder HR tidak membuat data karyawan untuk teknisi (`hr.seeder.ts:21-28`); portal butuh baris `human_resource.employees` | (a) Semua staf yang absen wajib punya data karyawan (Aqim mendaftarkan). (b) Portal tetap bisa dibuka tanpa data karyawan | **(a)**, termasuk Fahri/Alex/Ade; perbaiki seeder (milik Dafrin, M08) | (a) semua karyawan wajib punya data karyawan, kecuali pekerja lepas (jawaban programmer B 27/11) |
| OG5 | Aqim (admin aplikasi) ditolak portal karyawan | Guard menolak role aplikasi `admin` | (a) Aqim pakai akun kedua. (b) Izinkan admin | **(a)**; Aqim juga tidak cuti (A3a) | Aqim tidak perlu portal karyawan (jawaban programmer B 27/11) |
| OG6 | Tanda tangan satu klik tanpa konfirmasi; galat dan teks Inggris | `_authed.signature.tsx`; `empty-state.tsx:451-453`, `portal-api.ts:146` | Perbaiki | Tambah konfirmasi; terjemahkan | Pakai pratinjau dan konfirmasi; pesan diterjemahkan (jawaban programmer B 27/11) |

## H. Dokumen arsitektur milik Oki yang sudah tidak cocok

Bukan keputusan bisnis. Rincian di
[`ringkasan-arsitektur-modul-oki.md`](ringkasan-arsitektur-modul-oki.md) bagian 9.

| No | Dokumen | Masalah |
|---|---|---|
| OH1 | ADR-0006 butir 6 | Ikut K1 (Pemilik boleh menyetujui sendiri, kecuali keuangan sesuai K1a) |
| OH2 | ADR-0018, ADR-0024, ADR-0029 | Status "proposed" padahal sudah dijalankan |
| OH3 | `security-and-access.md` | 19 role; batas `approval_rule` yang tidak ada |
| OH4 | ADR baru untuk K12 | Rujukan "ADR-0031" di lembar rapat sudah dibetulkan menjadi ERP-0031 (2026-11-27); ADR-0012 ganda, ADR-0028 tidak ada |
| OH5 | Rencana m06, m09, m10, m11, m12 | Status "planned"/tabel "Current state" 2026-11-04 basi |
| OH6 | `docs/role-permission.md` | `/admin/invitations` tertulis "every organization member"; guard `employee-portal` tertulis "no guard macro" |

Keputusan Oki: boleh diperbaiki Dafrin / Oki sendiri / biarkan.

---

## Urutan pengerjaan setelah diputuskan

1. **OA5–OA7** (audit) dan **OD2** (bypass peminjaman): syarat K1.
2. **OB1–OB4, OC1, OD1, OD3**: perbaikan yang memblokir alur keuangan, pajak, dan aset.
3. **OA1 tahap 1, OA3** (K12/K13 tampilan), lalu OA4 bersama Dafrin.
4. **OB5–OB15, OC2–OC7, OF1–OF3, OG1–OG6**: perbaikan sedang dan rendah.
5. **OE1** setelah Pemilik memberi skema bagi hasil; **H** sesuai izin Oki.

| Diputuskan oleh | Tanggal | Tanda tangan |
|---|---|---|
| Pemilik | | |
| Oki | | |
| Dafrin | | |
