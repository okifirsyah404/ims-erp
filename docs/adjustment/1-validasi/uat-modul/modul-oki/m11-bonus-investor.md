# UAT M11 - Bonus & Investor

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** menu dan halaman Bonus & Investor → hak akses per role → (rencana) data investor → modal → skema bagi hasil → hitung bagi hasil dari periode tertutup → persetujuan Pemilik → terbitkan ke portal → pembayaran → ringkasan bonus → laporan investor → portal investor (`apps/web-investor`).

Versi lengkap per form, disusun 2026-11-26 dari kode dan rencana M11 (belum diuji di aplikasi). **Penting: per 2026-11-26 M11 belum dibangun.** Di admin hanya ada menu dan tiga halaman "Segera hadir"; di backend tidak ada modul, tabel, route, atau seed investor; `apps/web-investor` masih template bawaan Vite. Bagian A dan B menguji yang ada. Bagian C dan D menguji **target rencana** (`docs/plan/kontrak/modul/m11-bonuses-investors.md`); langkahnya diberi ⚠️ dan diperkirakan tidak sesuai sampai fiturnya dibangun. Label di bagian C/D adalah usulan; bila layar memakai label lain, catat label sebenarnya. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah atau belum dibangun (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun:** `admin` (Pemilik/Aqim, password di `apps/backend/.env`, lihat README), `finance_seed` (`finance123456`), `accountant_seed` (Akuntan/Bella, `accountant123456`), `hr_seed` (`hr123456`), `admin_seed` (`admin123456`), `auditor_seed` (`auditor123456`). **Belum ada akun investor** di seed (tidak ada `investor_seed`).

**Hak akses (dari kode, `packages/common/src/authorization/erp-permissions.ts`):**

| Role | Data Investor | Bagi Hasil | Catatan |
|---|---|---|---|
| Pemilik (`admin`) | ya | ya | semua hak |
| Keuangan (`finance_seed`) | lihat | tidak | juga lihat laporan investor |
| Akuntan (`accountant_seed`) | lihat | tidak | laporan investor: lihat, buat, terbitkan, ekspor |
| `admin_seed`, `auditor_seed`, `hr_seed`, role lain | tidak | tidak | grup menu tidak tampil |
| Investor (role aplikasi `investor`) | — | — | hanya untuk portal investor; tidak bisa masuk admin |

**Status (rencana, belum ada di kode):**

| Hal | Status |
|---|---|
| Investor | Aktif / Nonaktif |
| Skema bagi hasil | satu versi aktif; perubahan membuat versi baru |
| Pembagian (run) | Draf → Disetujui (Pemilik) → Diterbitkan → Dibayar |

**Data contoh (rencana, untuk bagian C dan D):**

| Data | Nilai |
|---|---|
| Investor A | `Hendra Wijaya UAT`, jenis Investor, `hendra.uat@entragate.test`, `081234567801`, BCA `1234567890` a.n. Hendra Wijaya |
| Investor B | `CV Mitra Modal UAT`, jenis Mitra, `mitra.uat@entragate.test`, `081234567802`, Mandiri `9876543210` a.n. CV Mitra Modal |
| Modal masuk | A Rp 300.000.000 (1 Oktober 2026), B Rp 200.000.000 (1 Oktober 2026) |
| Skema | Dasar laba **setelah pajak**, cadangan **10%**, bagian A **60%**, B **40%** (jumlah 100%) |
| Periode | Oktober 2026, sudah **dikunci** di Keuangan → Tutup Periode |
| Laba Oktober (contoh) | Laba sebelum pajak Rp 150.000.000, beban PPh badan Rp 30.000.000 → laba setelah pajak **Rp 120.000.000**; rugi lalu Rp 0 |
| Hitungan | cadangan 10% × 120.000.000 = **Rp 12.000.000**; dapat dibagi **Rp 108.000.000**; A 60% = **Rp 64.800.000**; B 40% = **Rp 43.200.000** |
| Uji pembulatan | dapat dibagi Rp 100.000.001, A 60% = Rp 60.000.000,60 → sisa pembulatan masuk cadangan (aturan belum diputuskan ❓) |
| Bonus manual | `EMP-00003`, November 2026, Rp 1.000.000, keterangan `Bonus proyek UAT` |
| Pembayaran | A Rp 64.800.000, 5 November 2026, dari rekening bank seed, bukti `TRF-UAT-001` |

---

## A. Menu dan halaman yang ada (login `admin`)

### A1. Menu Bonus & Investor

Sidebar bagian **Keuangan** → grup **Bonus & Investor**.

**Harus terlihat:** grup berisi dua menu: **Data Investor** dan **Bagi Hasil**. ⚠️ Di bahasa Inggris grup ini bernama "Investors" (tanpa "Bonus"); ganti bahasa ke English lewat menu pengguna lalu catat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2 ⚠️. Halaman Data Investor

Menu **Keuangan → Bonus & Investor → Data Investor**.

**Harus terlihat (sekarang):** judul "Data Investor", ikon orang, badge "Segera hadir"; tidak ada daftar, tombol, atau form. Ini berarti fitur belum dibangun; tandai tidak sesuai bila pengguna mengharapkan daftar investor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3 ⚠️. Halaman Bagi Hasil

Menu **Keuangan → Bonus & Investor → Bagi Hasil**.

**Harus terlihat (sekarang):** judul "Bagi Hasil", ikon koin, badge "Segera hadir"; tidak ada isi lain.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Halaman induk lewat alamat

Ketik alamat `http://localhost:5173/finance/investors`.

**Harus terlihat:** judul "Bonus & Investor" dengan badge "Segera hadir". F5: halaman sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. Hak akses per role

### B1. Keuangan (login `finance_seed`)

Cek sidebar **Keuangan → Bonus & Investor**, lalu ketik alamat `/finance/investors/profit-sharing`.

**Harus terlihat:** hanya **Data Investor** yang tampil; **Bagi Hasil** tidak tampil. Membuka alamat Bagi Hasil → pesan "Anda tidak memiliki akses ke halaman tersebut." dan kembali ke Dasbor. ❓ Rencana tidak menyebut siapa yang menghitung atau membayar bagi hasil; sekarang hanya Pemilik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Akuntan (login `accountant_seed`)

Sama seperti B1.

**Harus terlihat:** sama seperti B1. ❓ Akuntan punya hak "terbitkan laporan investor", sedangkan rencana menyebut "terbitkan ke portal" untuk pembagian (run), yang hanya Pemilik.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Role tanpa hak (login `hr_seed`, `admin_seed`, `auditor_seed`)

Cek sidebar, lalu ketik alamat `/finance/investors/registry`.

**Harus terlihat:** grup **Bonus & Investor** tidak tampil; membuka alamat → "Anda tidak memiliki akses ke halaman tersebut." dan kembali ke Dasbor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4 ⚠️. Halaman induk terbuka untuk semua (login `hr_seed`)

Ketik alamat `/finance/investors`.

**Harus terlihat:** seharusnya ditolak seperti B3. ⚠️ Dugaan: halaman "Bonus & Investor" tetap terbuka, karena alamat induk tidak dijaga izin. Sekarang isinya kosong, tetapi kebiasaan ini berbahaya bila nanti diisi data.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Fitur rencana di admin (⚠️ belum dibangun)

### C1 ⚠️. Tambah investor (login `admin`, semua kolom)

Menu **Keuangan → Bonus & Investor → Data Investor** → tombol **Investor baru**.

| Isian | Isi dengan |
|---|---|
| Nama | `Hendra Wijaya UAT` (wajib) |
| Jenis *(cek pilihan)* | Investor / Mitra / Bonus karyawan; pilih **Investor** |
| Email | `hendra.uat@entragate.test` (`type=email`) |
| Telepon | `081234567801` (`type=tel`) |
| Bank | `BCA` |
| Nomor rekening | `1234567890` |
| Atas nama | `Hendra Wijaya` |
| Status | Aktif (bawaan) |

**Klik:** Simpan. Ulangi untuk Investor B (jenis **Mitra**).

**Harus terlihat:** pesan sukses; kedua investor ada di daftar dengan status Aktif. Uji salah: Nama kosong → ditolak; email `hendra@` → ditolak. **Sekarang:** tombol tidak ada (halaman "Segera hadir").

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2 ⚠️. Ubah, nonaktifkan, dan cek detail investor

Investor A → **Ubah** → Telepon `081234567809` → Simpan; lalu **Nonaktifkan** → konfirmasi; lalu **Aktifkan** lagi. F5 dan buka detail.

**Harus terlihat:** telepon baru tersimpan setelah F5; status berganti Nonaktif lalu Aktif; investor tidak pernah terhapus permanen. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3 ⚠️. Catat modal masuk

Detail Investor A → **Catat modal**.

| Isian | Isi dengan |
|---|---|
| Tanggal | 1 Oktober 2026 |
| Jumlah | `300000000` |
| Bukti | unggah file PDF/JPG bukti transfer |
| Catatan | `Setoran modal awal UAT` (opsional) |

**Klik:** Simpan. Ulangi untuk B Rp 200.000.000.

**Harus terlihat:** riwayat modal A Rp 300.000.000, B Rp 200.000.000, total Rp 500.000.000. Uji salah: Jumlah `0` atau minus → ditolak. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4 ⚠️. Atur skema bagi hasil (login `admin`)

Menu **Bagi Hasil** → **Skema** → **Ubah skema**.

| Isian | Isi dengan |
|---|---|
| Dasar laba *(cek pilihan)* | Sebelum pajak / Setelah pajak; pilih **Setelah pajak** |
| Cadangan (%) | `10` |
| Aturan rugi lalu | rugi periode lalu dikurangkan dulu sebelum dibagi |
| Bagian Investor A (%) | `60` |
| Bagian Investor B (%) | `40` |

**Klik:** Simpan.

**Harus terlihat:** skema versi 1 aktif. Uji salah: A `60` + B `30` (jumlah 90%) → ditolak server dengan pesan jumlah harus 100%. Ubah cadangan ke 15% → tercipta versi 2, versi 1 tetap tersimpan sebagai riwayat. Kembalikan ke 10%. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5 ⚠️. Hitung bagi hasil periode Oktober 2026

Prasyarat: periode Oktober 2026 dikunci di **Keuangan → Tutup Periode**. Menu **Bagi Hasil** → **Pembagian baru** → Periode `Oktober 2026` → **Hitung**.

**Harus terlihat:** laba setelah pajak Rp 120.000.000 (diambil dari laporan M09 periode terkunci; angka contoh), rugi lalu Rp 0, cadangan Rp 12.000.000, dapat dibagi Rp 108.000.000; baris A Rp 64.800.000, B Rp 43.200.000; status Draf. Uji salah: periode November 2026 (belum dikunci) → ditolak "Periode belum dikunci; laba hanya final untuk periode yang terkunci". Pajak tidak dipotong dua kali (dasar sudah setelah pajak). **Sekarang:** tidak ada layar; hanya fungsi internal laba periode tertutup (ERP-0153) tanpa route.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6 ⚠️. Setujui pembagian (Pemilik saja)

Login `finance_seed` → buka pembagian Oktober → cari tombol **Setujui** (harus tidak ada). Login `admin` → **Setujui** → konfirmasi.

**Harus terlihat:** hanya Pemilik yang bisa menyetujui; status Disetujui; angka terkunci (tidak bisa diubah). Coba **Terbitkan** sebelum Disetujui pada pembagian lain → ditolak. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7 ⚠️. Terbitkan ke portal

Pembagian Oktober (Disetujui) → **Terbitkan**.

**Harus terlihat:** status Diterbitkan; tanggal terbit tercatat; baris tampil di portal investor masing-masing (D3). **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8 ⚠️. Catat pembayaran bagi hasil

Baris Investor A → **Catat pembayaran**.

| Isian | Isi dengan |
|---|---|
| Tanggal | 5 November 2026 |
| Jumlah | `64800000` |
| Kas & Bank *(cek pilihan)* | rekening bank seed |
| Bukti | `TRF-UAT-001` / unggah file |

**Klik:** Simpan.

**Harus terlihat:** baris A Dibayar; jurnal Dr Utang bagi hasil, Cr Bank Rp 64.800.000; pembagian menjadi Dibayar setelah B juga dibayar. Uji salah: jumlah lebih dari bagian A → ditolak. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9 ⚠️. Ringkasan bonus manual

Menu **Bagi Hasil** → **Bonus** → **Bonus baru**.

| Isian | Isi dengan |
|---|---|
| Penerima *(cek pilihan)* | karyawan/penerima aktif; pilih `EMP-00003` |
| Periode | November 2026 |
| Jumlah | `1000000` |
| Keterangan | `Bonus proyek UAT` |

**Klik:** Simpan → Pemilik **Setujui** → **Catat pembayaran**.

**Harus terlihat:** bonus tercatat, disetujui, dibayar; tidak ada hitungan otomatis. ❓ Tabelnya belum diputuskan; kolom Bonus di rekap gaji HR (M08) adalah gaji, bukan bonus M11. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10 ⚠️. Laporan investor (login `accountant_seed`)

Menu **Bonus & Investor** → laporan investor → **Laporan baru** periode Oktober 2026 → **Terbitkan** → **Ekspor** (PDF/CSV).

**Harus terlihat:** laporan berisi modal, bagian, bagi hasil disetujui, dan riwayat bayar; file ekspor terunduh. `finance_seed` hanya bisa melihat. **Sekarang:** tidak ada menu laporan investor sama sekali.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Portal investor (`apps/web-investor`)

### D1 ⚠️. Buka aplikasi portal investor

Dari terminal: `cd apps/web-investor` lalu `bun run dev` (atau ikut jalan lewat `bun run dev` di root). Port tidak diatur, jadi Vite memakai 5173 atau port kosong berikutnya; lihat alamat di terminal.

**Harus terlihat (sekarang):** halaman demo Vite + React: judul tab "web-investor", tulisan "Get started", tombol "Count is 0", tautan Documentation/Vite/React/GitHub/Discord. Tidak ada logo perusahaan, bahasa Indonesia, atau login. Tandai tidak sesuai: portal belum dibangun. ⚠️ Bila web-admin juga jalan, cek bahwa keduanya tidak berebut port 5173.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2 ⚠️. Login investor

Target: halaman login portal investor.

| Isian | Isi dengan |
|---|---|
| Email atau username | email Investor A |
| Kata sandi | kata sandi dari undangan |

**Klik:** Masuk.

**Harus terlihat:** masuk ke dasbor investor A. Akun investor yang mencoba login ke web-admin (`localhost:5173` admin) harus ditolak. Uji salah: kata sandi salah → "Email/username atau kata sandi salah". **Sekarang:** tidak ada login; akun investor juga belum bisa dibuat (tidak ada undangan investor) dan gerbang login sekarang menolak pengguna yang hanya punya role investor.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3 ⚠️. Investor melihat datanya sendiri

Login Investor A di portal.

**Harus terlihat:** modal Rp 300.000.000, bagian 60%, bagi hasil Oktober Rp 64.800.000 (Diterbitkan → Dibayar 5 November 2026), riwayat pembayaran; total dapat dibagi Rp 108.000.000 hanya bila Pemilik memilih menampilkannya. Pembagian yang masih Draf atau baru Disetujui **tidak** tampil. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4 ⚠️. Investor tidak bisa melihat data investor lain

Login Investor A; coba buka alamat atau unduhan milik Investor B (ganti ID di alamat).

**Harus terlihat:** ditolak (data tidak ditemukan / tidak punya akses); baris B dan modal B tidak pernah muncul, termasuk di ekspor. **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5 ⚠️. Ekspor data sendiri

Portal investor → **Ekspor** (PDF/CSV).

**Harus terlihat:** file hanya berisi riwayat Investor A (modal, bagi hasil, pembayaran). **Sekarang:** tidak ada.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 23 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M11:** lulus / belum lulus (coret salah satu)

Catatan penguji:

## Catatan penyusun

Disusun dari kode 2026-11-26, belum dijalankan di aplikasi.

1. **M11 belum dibangun.** Ketiga route admin hanya merender `ComingSoonPage` (`apps/web-admin/src/routes/_authed/finance/investors/index.tsx:7-15`, `registry/index.tsx:7-15`, `profit-sharing/index.tsx:7-15`; komponen `apps/web-admin/src/components/coming-soon-page.tsx:11-37`). Tidak ada modul, kontrak, route, atau seeder investor di `apps/backend`. Rencana T13 berstatus `blocked` sampai Pemilik memberi skema (`m11-bonuses-investors.md:66-67`).
2. **Skema `investor` sudah dihapus** (ADR-0024 `docs/architecture/decisions/ADR-0024-database-normalization-baseline-v2.md:40-41`, ADR-0030 `:74-75`, AGENTS.md melarang dihidupkan lagi), tetapi rencana M11 masih memetakan 11 tabel `investor` (`m11-bonuses-investors.md:113-121`). Membangun M11 butuh ADR baru untuk letak tabelnya.
3. **Label beda bahasa:** "Bonus & Investor" (`packages/locales/src/id/nav.ts:91`) vs "Investors" (`packages/locales/src/en/nav.ts:95`).
4. **Alamat induk tidak dijaga:** `/finance/investors` bukan daun menu, sehingga `findNavLeaf` mengembalikan null dan guard mengizinkan semua pengguna internal (`apps/web-admin/src/lib/route-guard.ts:31-32`, `apps/web-admin/src/components/sidebar/filter-nav.ts:62-76`).
5. **Role vs rencana:** `finance` dan `accountant` hanya melihat Data Investor; hanya `owner` punya `profit_distribution` (`erp-permissions.ts:779-780, 807-808`). `accountant` punya `investor_report: publish`, sedangkan rencana "terbitkan ke portal" adalah untuk run; `profit_distribution` tidak punya aksi `publish` (`erp-permissions.ts:163-169`).
6. **Portal investor tidak bisa login sesuai rancangan:** gerbang login menolak pengguna yang hanya punya role `investor` (ADR-0018 §5); portal karyawan juga menolak `investor` (backlog ERP-0159). Tidak ada `investor_seed` (`apps/backend/database/seeders/seed/organization-members.seeder.ts:31-35`).
7. **`apps/web-investor` adalah template Vite murni** (`apps/web-investor/src/App.tsx:7-120`, dependensi hanya react/react-dom di `apps/web-investor/package.json:12-15`, `index.html` `lang="en"`), tanpa router, auth, i18n, atau port tetap (bentrok potensial dengan web-admin 5173). Backlog ERP-0163 menyebutnya "pure rename of the untouched Vite scaffold"; ERP-0023 portal investor masih `planned`.
8. **Fungsi laba periode tertutup ada tetapi tak terjangkau:** `ExportedProfitService.closedPeriodProfit` (`apps/backend/src/app/finance/services/exported-profit.service.ts:46-87`, ERP-0153) tanpa route dan tanpa konsumen; galat `accounting.profitPeriodNotLocked` (`packages/locales/src/id/api.ts:623`) belum bisa muncul lewat HTTP.
9. **Belum diputuskan:** aturan sisa pembulatan, tabel ringkasan bonus karyawan (`m11-bonuses-investors.md:126-127`), siapa yang menghitung/membayar, dan teks skenario U01–U32 yang tidak ada di repo (`:89-90`). Tidak ada kunci terjemahan M11 selain tiga label menu dan "Segera hadir".
