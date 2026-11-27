# Diagram alur sekarang: modul Oki (M06, M09, M10, M12, gaji, portal karyawan)

[Kembali ke indeks diagram](README.md)

**Tujuan.** Menggambarkan alur modul programmer kedua (Oki) **seperti kode
berjalan hari ini**, supaya Pemilik dan Oki bisa melihat di langkah mana alur
macet atau berjalan tanpa pemeriksa. Ini **kondisi sekarang, belum ada
perubahan**: tidak ada usulan yang sudah dikerjakan.

**Tanggal:** 2026-11-27. **Status:** draf, disusun oleh Claude (asisten AI)
dari pembacaan kode dan catatan, belum diperiksa Oki maupun Pemilik. Belum ada
langkah yang dicoba di aplikasi untuk dokumen ini.

**Cara membaca** (sama dengan
[uat-modul/diagram-alur-per-role.md](../uat-modul/diagram-alur-per-role.md)):

* Aktor ditulis `Role - nama orang`, memakai susunan role yang
  direkomendasikan ([validasi-konsep-modul-oki.md](../validasi-konsep-modul-oki.md)
  3.1 dan 3.8): Aqim = Pemilik + SDM (pekerjaan keuangan, pembelian, dan
  operasional dikerjakannya sebagai Pemilik), Bella = Akuntan (+ Keuangan bila
  K2d b), Agus MD dan Bilal = Penjualan, Bilal juga Gudang / Layanan Pelanggan /
  Pemasaran, Agus = Manajer Proyek / Teknisi / Gudang, Jamil = Manajer Proyek /
  Teknisi, Hatta = Manajer Proyek, Fahri / Alex / Ade = Teknisi, Dafrin / Oki =
  Pekerja Lepas.
* Orang yang **seharusnya** bertindak tetap digambar. Bila kode menolaknya,
  ada `Note` berisi **DITOLAK KODE** atau **MACET**.
* Nomor temuan: RO1–RO20 di [validasi-konsep-modul-oki.md](../validasi-konsep-modul-oki.md)
  Bagian 3.2; OA–OH di [bahan-keputusan-modul-oki.md](../bahan-keputusan-modul-oki.md).

**Sumber, dibaca 2026-11-27:**

* Kode: `apps/backend/src/app/finance/services/` (`manual-journal`, `period`,
  `posting`, `supplier-bill`, `employee-advance`, `receivable-adjustment`,
  `fixed-asset`, `bank-reconciliation`), `finance/controllers/ledger.controller.ts`,
  `receivables.controller.ts`, `fixed-asset.controller.ts`;
  `payment/services/payment.service.ts`; `tax/services/tax.service.ts`;
  `inventory/services/` (`borrowing-request`, `borrowing`, `disposal`),
  `inventory/controllers/borrowing.controller.ts`;
  `human-resource/services/` (`salary`, `employee-portal`, `leave`);
  `project/services/site-attendance.service.ts`;
  `user/services/invitation.service.ts`, `organization/services/organization.service.ts`;
  `apps/web-admin/src/components/form/login-form.tsx`,
  `components/sidebar/organization-switcher.tsx`; `apps/web-employee/src/routes/`;
  status di `apps/backend/drizzle/schemas/{finance,payment,tax,inventory,human-resource}.schema.ts`;
  hak di `packages/common/src/authorization/erp-permissions.ts`.
* Catatan: [validasi-konsep-modul-oki.md](../validasi-konsep-modul-oki.md),
  [uat-modul/modul-oki/](../uat-modul/modul-oki/README.md),
  [skema-database/finance.md](../skema-database/finance.md),
  [skema-database/tax.md](../skema-database/tax.md),
  [skema-database/auth.md](../skema-database/auth.md),
  [skema-database/audit.md](../skema-database/audit.md),
  [lintas-modul/autentikasi-dan-hak-akses.md](../lintas-modul/autentikasi-dan-hak-akses.md).

Supaya diagram tidak ramai, Pemilik (`owner`, memegang semua hak) hanya
digambar di langkah yang memang dikerjakan Aqim di susunan ini.

---

## 1. M12 - Undangan, klaim, login, organisasi, role

Akun staf hanya lahir dari undangan (ADR-0029). Klaim langsung membuat sesi;
setelah itu login memakai nama pengguna atau email, lalu organisasi dipilih di
sidebar dan hak dihitung dari role anggota di organisasi itu.

```mermaid
sequenceDiagram
    actor W as Pemilik + admin aplikasi - Aqim
    actor U as Staf baru - mis. Fahri
    participant BA as Better Auth
    participant API as Backend ERP (guard erp)
    participant AU as Log audit

    W->>API: Administrasi - Pengguna - Undang (email, organisasi, role)
    Note over W,API: Hanya admin aplikasi yang bisa mengundang dari layar. SDM punya invitation create tetapi tanpa halaman (OA12)
    API->>AU: invitation.sent
    API-->>U: email berisi tautan klaim
    U->>API: buka tautan invite token, isi nama pengguna, kata sandi, telepon
    API->>BA: simpan kredensial, akun jadi aktif
    API->>API: tambah keanggotaan organisasi dengan role dari undangan
    API-->>U: sesi langsung dibuat, notifikasi org.member_added
    Note over API,AU: Klaim tidak menulis audit
    U->>BA: login berikutnya - ada at maka signIn.email, selain itu signIn.username
    BA->>BA: login-gate - akun aktif dan punya minimal satu role internal
    Note over U,BA: Tombol Google ada di web-admin dan portal karyawan, server menolak akun Google baru (disableSignUp). K13 ingin tombol web-admin dihapus (OA3, RO19)
    U->>API: pilih organisasi di sidebar, header x-organization-id
    API->>API: permission-resolver menggabungkan semua role di members.role
    API-->>U: menu dan tombol tampil sesuai hak, server tetap memeriksa
    W->>API: Administrasi - Organisasi - anggota - ubah centang role
    Note over W,API: Hanya Pemilik bisa memberi role Pemilik
    Note over API,AU: Perubahan role dan pengeluaran anggota TIDAK diaudit (RO12, OA6)
    W->>API: nonaktifkan atau pulihkan akun
    API->>AU: user.deactivated atau user.restored
    W->>AU: Administrasi - Log Audit (menu hanya admin aplikasi, filter hanya tindakan modul user)
```

Yang tercatat di audit modul user: `invitation.sent`, `invitation.resent`,
`invitation.cancelled`, `invitation.deleted`, `user.precreated`,
`user.deactivated`, `user.restored`, `user.deleted`. Yang tidak tercatat:
klaim undangan, login, perubahan role, pengeluaran anggota, ekspor.

**Masalah di alur ini**

* RO12 / OA5 / OA6: audit fire-and-forget dan perubahan role tidak diaudit, padahal K1 bergantung pada audit.
* OA8: Log Audit hanya terbuka untuk admin aplikasi (Aqim), jadi tidak ada pembaca kedua.
* OA12: SDM punya hak undang tanpa halaman.
* OA3 / RO19: tombol Google masih ada di web-admin dan portal karyawan.
* OA14: pesan login akun nonaktif sama dengan akun yang belum klaim.
* RO18 / OA1: seluruh langkah pilih organisasi dan role per organisasi terdampak K12.

---

## 2. M09 - Faktur penjualan sampai kas dan rekonsiliasi

Dilihat dari sisi keuangan. Faktur dan kuitansi ada di modul sale
(programmer B), jurnalnya dibuat otomatis oleh posting finance. Penghapusan
piutang memakai pembuat-pemeriksa.

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal, Agus MD
    actor B as Keuangan + Akuntan - Bella
    actor W as Pemilik - Aqim
    actor C as Pelanggan
    participant FIN as Posting finance

    S->>B: sales order siap ditagih
    B->>B: Faktur dari SO, terbitkan
    B->>FIN: jurnal otomatis piutang dan pendapatan
    Note over B,FIN: Posting mencari periode bulan itu. Bila belum ada, PeriodNotFoundError dan faktur gagal terbit (RO1)
    C->>B: bayar (transfer atau link gateway)
    B->>B: Catat kuitansi, faktur Dibayar sebagian atau Lunas
    B->>FIN: jurnal otomatis kas dan piutang
    B->>B: Rekonsiliasi - impor rekening koran, cocokkan otomatis atau manual
    B->>B: Rekonsiliasi Selesai, lalu Tutup
    Note over B: Satu orang dari faktur sampai rekonsiliasi bila K2d b. Diawasi Aqim lewat laporan (RO9)
    opt piutang tak tertagih
        B->>W: Ajukan penghapusan piutang (sebagai Keuangan)
        Note over B,W: Bella tidak bisa menyetujui ajuannya sendiri (WriteOffSelfApprovalError)
        W->>FIN: Setujui, open item dan faktur menjadi written off
        FIN->>FIN: jurnal debit cadangan kerugian piutang 1-1390
        Note over W,FIN: Cadangan belum pernah dibentuk, jadi kerugian tidak masuk laba rugi (OB10)
    end
```

**Masalah di alur ini**

* RO1 / OB4: tanpa periode bulan berjalan, terbit faktur dan catat kuitansi gagal.
* RO2 / OB1: akun yang hanya Keuangan tidak bisa memuat daftar akun di form kas/bank dan rekonsiliasi (tidak terasa bila Bella memegang dua role).
* OB2: layar rekonsiliasi meminta 200 akun, server membatasi 100.
* OB10: write-off ke cadangan yang belum dibentuk.
* RO10: write-off ajuan Bella tertahan bila Aqim tidak sempat menyetujui.

---

## 3. M09 - Tagihan pemasok dan pembayaran

Tagihan dibuat dari PO yang barangnya sudah diterima, atau manual, lalu
direkam (jurnal utang). Pembayaran punya langkah ajukan, setujui, eksekusi,
tetapi tanpa cek pembuat dan tanpa layar bayar pemasok.

```mermaid
sequenceDiagram
    actor W as Pemilik (pembelian) - Aqim
    actor G as Gudang - Agus, Bilal
    actor B as Keuangan + Akuntan - Bella
    participant FIN as Posting finance
    participant PAY as Modul payment

    W->>G: PO disetujui dan dikirim ke pemasok (modul procurement)
    G->>G: Penerimaan barang (BPB)
    B->>B: Keuangan - Utang - Tagihan dari PO, atau tagihan manual
    Note over B: Tagihan manual selalu ke akun beban bawaan 6-2900 (OB14)
    B->>FIN: Rekam tagihan, status Disetujui, jurnal utang dan open item utang
    Note over B,FIN: Tidak ada pemeriksa untuk rekam tagihan. Butuh periode bulan itu (RO1)
    B->>PAY: Buat pembayaran dengan alokasi ke tagihan
    Note over B,PAY: Belum ada layar bayar tagihan pemasok. createPayment hanya dipanggil dialog pembayaran karyawan, jadi langkah ini hanya lewat API (OB3)
    B->>PAY: Ajukan
    B->>PAY: Setujui - hanya mencatat approvedBy, pembuat boleh menyetujui sendiri (RO9, OB7)
    B->>PAY: Eksekusi - wajib akun kas/bank dan jumlah alokasi sama dengan nilai bayar
    PAY->>FIN: jurnal kas keluar dan utang, tagihan Dibayar sebagian atau Lunas
    opt sebelum eksekusi
        B->>PAY: Void (setelah dieksekusi ditolak)
    end
```

**Masalah di alur ini**

* OB3: tidak ada layar pembayaran pemasok, utang dagang tidak pernah lunas dari layar.
* RO9 / OB7: pembayaran tanpa pembuat-pemeriksa (diterima K7a, dengan audit OA6).
* OB14: tagihan manual tanpa pilihan akun beban.
* RO1: rekam tagihan butuh periode.
* Status `overdue` pada tagihan tidak pernah diisi kode; jatuh tempo hanya muncul sebagai pengingat.

---

## 4. M09 - Kasbon karyawan dan pertanggungjawaban

Kasbon diajukan teknisi, disetujui orang lain, lalu dicairkan lewat
pembayaran. Pertanggungjawaban butuh tiga orang berbeda: pengaju, verifikator,
penyetuju. Dengan susunan sekarang hak verifikasi dan setuju hanya ada di Aqim.

```mermaid
sequenceDiagram
    actor T as Teknisi - Fahri, Jamil, Agus, Alex, Ade
    actor PL as Manajer Proyek / Pekerja Lepas - Hatta, Dafrin, Oki
    actor W as Pemilik - Aqim
    actor B as Keuangan - Bella
    participant FIN as Posting finance

    T->>T: Keuangan - Beban - Kasbon baru, ajukan
    Note over T: DITOLAK KODE di layar - menu Beban butuh expense_claim read yang tidak dimiliki Teknisi, PM, Pekerja Lepas. Portal karyawan tidak punya halaman kasbon (RO6). Teknisi juga tanpa employee read untuk pemilih karyawan dan tanpa data karyawan di seed (OB13, OG4)
    W->>T: Setujui atau tolak kasbon (pengaju tidak boleh menyetujui)
    Note over W: Kasbon yang diajukan Aqim sendiri MACET, tidak ada penyetuju lain (RO5, OB9)
    B->>FIN: Cairkan lewat pembayaran ke karyawan
    Note over B,FIN: Keuangan dan Akuntan tidak punya hak advance, panel butuh advance read. Dalam praktik hanya Aqim yang bisa mencairkan dari layar (OB13)
    FIN-->>T: kasbon Dicairkan
    T->>T: Pertanggungjawaban baru dari kasbon Dicairkan, ajukan
    PL->>PL: PM dan Pekerja Lepas juga boleh membuat dan mengajukan (halaman tertutup, RO6)
    W->>T: Verifikasi (verifikator harus beda dari pengaju)
    W->>T: Setujui (penyetuju harus beda dari verifikator)
    Note over W,T: MACET - hanya Aqim memegang verifikasi dan setuju. Setelah Aqim memverifikasi, tidak ada orang lain untuk menyetujui (RO5)
    W->>FIN: (bila bisa disetujui) jurnal beban, kurangi kasbon, sisa jadi utang klaim
    FIN-->>T: kasbon Lunas bila seluruhnya tertutup, sisa dibayar lewat pembayaran
```

**Masalah di alur ini**

* RO5: persetujuan pertanggungjawaban selalu macet (verifikator ≠ penyetuju, keduanya Aqim).
* RO6: halaman kasbon dan pertanggungjawaban tertutup bagi pengaju; portal karyawan tidak punya halamannya.
* OB9: K1a (b) membuat kasbon ajuan Aqim macet.
* OB13: pencairan hanya bisa oleh Pemilik dari layar.
* OG4: teknisi tanpa data karyawan tidak bisa dipilih sebagai pengaju.
* RO16: Manajer Operasional (satu-satunya pemegang non-Pemilik) tidak dipakai.

---

## 5. M09 - Jurnal manual dan tutup periode

Periode akuntansi harus ada sebelum apa pun bisa diposting. Jurnal manual
memakai pembuat-pemeriksa: menyetujui sama dengan memposting. Tutup bulan
berurutan open, closed (snapshot saldo), locked.

```mermaid
sequenceDiagram
    actor B as Akuntan - Bella
    actor W as Pemilik - Aqim
    participant FIN as Ledger finance
    participant AU as Log audit

    B->>FIN: Keuangan - Tutup Periode - Siapkan periode
    Note over B,FIN: MACET - route meminta accounting_period create yang tidak ada di kosakata. Tidak ada pemegang hak, termasuk Pemilik. Seeder tidak membuat periode (RO1, OB4)
    B->>FIN: Jurnal manual - buat draf, ajukan
    W->>FIN: Setujui - langsung diposting (pembuat tidak boleh menyetujui)
    Note over B,W: Jurnal Bella disetujui Aqim, jurnal Aqim disetujui Bella. Tertahan bila salah satu tidak ada (RO10)
    W->>FIN: atau Tolak, jurnal kembali ke draf
    B->>FIN: Balik jurnal yang sudah diposting (jurnal pembalik)
    B->>FIN: Daftar periksa tutup bulan (teks masih Inggris, OB15)
    B->>FIN: Tutup periode - snapshot saldo per akun
    Note over FIN: Periode closed masih menerima jurnal penyesuaian manual finance, modul lain ditolak
    B->>FIN: Kunci periode
    Note over B,FIN: Ditolak bila masih ada jurnal manual draf, diajukan, atau disetujui, dan bila pendapatan ditangguhkan belum diamortisasi
    FIN->>AU: accounting_period.closed dan accounting_period.locked
    B->>FIN: Buka kembali periode terkunci (dengan alasan)
    Note over B,FIN: Rencana M09 - hanya Pemilik. Kode memasang ownership reopen owner, tetapi macro erp mengabaikannya. Route transisi hanya meminta accounting_period close, jadi Bella bisa membuka (RO4, OB6)
    FIN->>AU: accounting_period.reopened, reopened_by tercatat
```

**Masalah di alur ini**

* RO1 / OB4: tidak ada yang bisa menyiapkan periode, semua posting gagal di database baru.
* RO4 / OB6: buka kembali periode terkunci tidak terbatas pada Pemilik.
* RO10: jurnal hanya bisa disetujui pasangan Bella dan Aqim.
* OB15: daftar periksa tutup bulan berbahasa Inggris.
* Status jurnal `approved` ada di schema tetapi tidak dipakai alur manual (setujui = posting). Catatan UAT yang menyebut "Posting" sebagai langkah terpisah perlu disesuaikan.

---

## 6. Gaji - siapkan, setujui, bayar

Rekap gaji disiapkan SDM, PPh 21 dan BPJS dihitung dari pengaturan yang hanya
bisa diubah admin aplikasi, lalu Pemilik menyetujui. Persetujuan mengunci data,
memposting jurnal gaji, dan menerbitkan slip. Pembayaran gaji terpisah lewat
kas/bank.

```mermaid
sequenceDiagram
    actor H as SDM - Aqim
    actor W as Pemilik + admin aplikasi - Aqim
    actor B as Keuangan + Akuntan - Bella
    actor K as Karyawan (portal)
    participant FIN as Posting finance

    W->>W: Pengaturan - Penggajian - PPh 21 dan BPJS (hanya admin aplikasi)
    B->>B: Pajak - Tabel PPh 21 - impor TER
    H->>H: SDM - Penggajian - siapkan bulan (generate atau impor Excel)
    H->>H: Hitung ulang PPh 21 dan BPJS untuk draf
    B->>H: boleh mengisi atau mengubah rekap (Keuangan punya payroll create dan update)
    W->>FIN: Setujui bulan ini (payroll approve, hanya Pemilik)
    Note over H,W: Tidak ada cek penyiap vs penyetuju dan tidak ada catatan disetujui pembuat (RO8). Aqim menyiapkan dan menyetujui sendiri
    FIN->>FIN: draf dihitung ulang, dikunci, satu jurnal gaji payroll.approved
    Note over FIN: Butuh periode bulan itu (RO1)
    FIN-->>K: slip gaji PDF diantrikan, tampil di portal
    B->>FIN: Kas dan Bank - Bayar gaji atau BPJS (payroll_payment execute)
    Note over B,FIN: Orang kedua ada di langkah bayar bila Bella memegang Keuangan (RO17). Pembayaran tidak mengubah status rekap gaji
    B->>B: Unduh XML BP21 untuk Coretax (hanya baris yang disetujui)
```

**Masalah di alur ini**

* RO8: persetujuan gaji tanpa cek pembuat dan tanpa catatan audit khusus.
* RO17: Bella melihat dan mengubah gaji semua karyawan bila memegang Keuangan.
* RO1: jurnal gaji butuh periode.
* OC8: tabel TER resmi dan format Coretax belum diuji impor.

---

## 7. M10 - Pajak bulanan

Catatan pajak dan pemotongan dibuat, diverifikasi, dan dilaporkan oleh orang
yang sama. Tutup PPN masa memposting jurnal; setor pajak lewat kas/bank.

```mermaid
sequenceDiagram
    actor B as Akuntan + Keuangan - Bella
    actor W as Pemilik - Aqim
    participant TAX as Modul tax
    participant FIN as Posting finance

    B->>TAX: Jenis dan Tarif Pajak - tambah jenis
    Note over B,TAX: Form mengirim taxType vat yang ditolak server. Jenis pph tidak bisa dibuat dari layar, jadi tarif dan potongan PPh pemasok tidak bisa disiapkan (OC1)
    B->>TAX: Catatan pajak - buat dan ubah draf
    Note over B,TAX: Ubah dasar pada draf tidak menghitung ulang pajak (OC2)
    B->>TAX: Verifikasi, lalu Lapor (filed)
    Note over B,TAX: Tidak ada cek pembuat, hanya verifiedBy dicatat (RO13). Periode pajak tertutup belum read-only (OC7)
    B->>TAX: Koreksi catatan yang sudah diverifikasi atau dilaporkan
    B->>TAX: Pemotongan - catat, isi data Coretax, verifikasi
    Note over B,TAX: Form tidak mengirim periode Bupot, jadi pemotongan dari layar tidak masuk XML (OC3). Kode ganda galat umum (OC6)
    B->>TAX: Ekspor XML Coretax (faktur, bupot), CSV, XLSX
    B->>FIN: Tutup PPN masa - keluaran vs masukan, selisih ke Utang PPN atau Lebih Bayar (journal post)
    B->>FIN: Setor pajak dari Kas dan Bank (cash_bank create)
    B->>TAX: Tandai pemotongan Dibayar
    W->>W: memeriksa rekap pajak bulanan
```

**Masalah di alur ini**

* OC1: bug jenis pajak `vat`.
* OC2: ubah draf tidak menghitung ulang.
* OC3: pemotongan dari layar tanpa periode Bupot, tidak masuk XML.
* OC5: Dibayar → Dibatalkan diizinkan server, tanpa tombol.
* OC7: periode pajak tertutup belum dikunci.
* RO13: pajak di satu tangan, tanpa pemeriksa.
* RO1: tutup PPN butuh periode.

---

## 8. M06 - Peminjaman alat

Pengajuan, persetujuan, penyerahan oleh Gudang, lalu kembali atau hilang.
Aturan "pembuat tidak boleh menyetujui" ada di service tetapi tidak pernah
berlaku.

```mermaid
sequenceDiagram
    actor T as Teknisi / Penjualan - Fahri, Alex, Ade, Bilal, Agus MD
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor G as Gudang - Agus, Bilal
    actor W as Pemilik - Aqim
    participant INV as Modul inventory

    T->>INV: Inventaris - Aset dan Peralatan - Peminjaman - ajukan
    Note over T,INV: DITOLAK KODE - form memuat unit dari inventory items yang butuh asset read. Teknisi, Penjualan, Layanan Pelanggan, Gudang tidak punya (RO7, OD1)
    PM->>INV: ajukan untuk teknisi atau tamu (draf, lalu diajukan)
    PM->>INV: Setujui atau tolak
    Note over PM,INV: canApprove diisi dari hak approve, route approve juga mewajibkan hak itu, jadi PM bisa menyetujui pinjamannya sendiri (RO7, OD2)
    W->>INV: menyetujui bila PM tidak ada
    G->>INV: Serahkan unit, peminjaman Diserahkan, unit keluar dari rak
    Note over G,INV: Gudang boleh menyerahkan pengajuan yang belum disetujui (M06 C13)
    INV->>INV: tugas berkala menandai item terlambat (marked_late)
    G->>INV: Perpanjang tanggal kembali
    G->>INV: Kembalikan sebagian atau semua
    Note over G,INV: Kondisi kembali selalu good, tidak ada pilihan (OD7)
    G->>INV: Tandai hilang
    Note over G,INV: Peminjaman yang semua unitnya hilang tidak bisa ditutup (OD7)
    G->>INV: Tutup peminjaman, jam retensi data tamu mulai
```

**Masalah di alur ini**

* RO7 / OD2: tidak ada pemeriksa, PM menyetujui pinjamannya sendiri.
* RO7 / OD1: form pengajuan tidak bisa dipakai pengaju tanpa `asset:read`.
* M06 C13: Gudang meminjamkan tanpa persetujuan.
* OD4: peminjam, nomor seri, dan gudang tampil sebagai id mentah.
* OD7: kondisi kembali selalu baik; semua hilang tidak bisa ditutup.

---

## 9. M06 dan M09 - Register aset, kapitalisasi, penyusutan, penghapusan

Aset didaftarkan di inventory, dikapitalisasi dan disusutkan di finance.
Penghapusan hanya Pemilik, dari usul sampai eksekusi.

```mermaid
sequenceDiagram
    actor W as Pemilik - Aqim
    actor B as Akuntan - Bella
    participant INV as Modul inventory
    participant FIN as Posting finance

    W->>INV: Register Aset - daftarkan, tempatkan, pindahkan (asset create dan update)
    Note over W,INV: Form mengalikan biaya 100, tampilan tidak membagi, seeder memakai rupiah utuh (OD3)
    B->>FIN: Keuangan - Aset tetap - kapitalisasi (journal post)
    Note over B,FIN: DITOLAK KODE di layar - daftar aset tetap dan menu butuh asset read yang tidak dimiliki Akuntan. Sekarang hanya Aqim yang bisa (RO3, OB5)
    B->>FIN: Ubah kelompok fiskal
    B->>FIN: Jalankan penyusutan bulanan, satu jurnal
    Note over B,FIN: Butuh periode bulan itu (RO1). Layar meminta 200 akun, server 100 (OB2)
    W->>INV: Inventaris - Penyusutan - entri manual (asset update)
    W->>INV: Penghapusan Aset - usulkan (draf)
    W->>INV: Setujui (tanpa cek pengusul)
    Note over W,INV: Aqim mengusulkan, menyetujui, dan mengeksekusi sendiri (RO11). Aset yang sedang dipinjam tetap bisa diusulkan (OD6)
    W->>FIN: Eksekusi - aset Dihapus, nilai buku 0, jurnal laba rugi pelepasan
    FIN-->>INV: audit asset.disposal_approved dan eksekusi tercatat
```

**Masalah di alur ini**

* RO3 / OB5: Akuntan tidak bisa membuka Aset tetap.
* OD3: satuan uang aset kali 100.
* OD6: aset yang sedang dipinjam bisa dihapus atau dinonaktifkan.
* RO11: penghapusan tanpa pemeriksa (sesuai K1, perlu tanda audit OA7).
* OD5 / OD9: catatan servis dan set peralatan setengah jadi; PIC dan kondisi aset tidak ada.
* OD8: rencana modul `assets` berbeda dari kode.

---

## 10. Portal karyawan - absen kantor, absen lokasi proyek, cuti, lembur

Portal tidak memakai role: syaratnya punya data karyawan hidup dan bukan
pemegang role aplikasi `admin`, `investor`, atau `customer`. Absen lokasi
proyek memakai GPS, swafoto wajib, dan pengecekan radius PostGIS.

```mermaid
sequenceDiagram
    actor K as Teknisi / Pekerja Lepas - Fahri, Alex, Ade, Jamil, Agus, Dafrin, Oki
    actor P as PIC proyek - Agus, Jamil, Hatta
    actor H as SDM - Aqim
    participant EP as Portal karyawan
    participant API as Backend

    K->>EP: login (nama pengguna atau email, tombol Google ada)
    Note over K,EP: Ditolak bila tidak punya data karyawan (OG4) atau akun admin aplikasi seperti Aqim (OG5, RO15). Tautan lupa kata sandi rusak (OG3)
    K->>API: Absen kantor - check-in, lalu check-out
    Note over K,API: Absen kantor tanpa GPS dan swafoto, cukup tombol. Ditolak bila hari itu sudah tercatat cuti
    K->>API: Proyek - check-in lokasi dengan GPS dan swafoto wajib
    API->>API: proyek harus aktif, jarak dihitung PostGIS terhadap radius
    Note over K,API: Di luar radius TETAP tersimpan dengan status out_of_range, tidak ditolak. Check-out tanpa cek radius (OG1)
    K->>API: lihat kunjungan lokasi saya
    Note over K,API: Non-PIC tidak melihat kunjungan sendiri di tab itu (OG2)
    P->>API: lihat kunjungan semua orang di proyeknya
    K->>API: Cuti - ajukan (kuota 12 hari), lembur - ajukan
    H->>API: web-admin SDM - setujui atau tolak (pencatat tidak boleh memutus)
    API-->>K: cuti disetujui mengisi absensi otomatis
    K->>EP: slip gaji, dokumen, tanda tangan satu klik (OG6)
```

**Masalah di alur ini**

* OG1: absen di luar radius tetap tersimpan, tanpa peninjau.
* OG2: non-PIC tidak melihat kunjungannya sendiri.
* OG3: tautan lupa kata sandi rusak.
* OG4 / RO15: teknisi tanpa data karyawan tidak bisa masuk; menghapus role Anggota tidak menutup portal.
* OG5: Aqim (admin aplikasi) ditolak portal karyawan.
* OG6: tanda tangan tanpa konfirmasi, teks Inggris tersisa.
* RO6: portal tidak punya halaman kasbon dan pertanggungjawaban.
* RO19: tombol Google di portal karyawan masih ada di kode; diputuskan dihapus (K13, disetujui 27/11).

---

## 11. Status dokumen

Semua status di bawah diambil dari konstanta schema dan tabel transisi di
service. Nama orang di label adalah susunan rekomendasi.

### Jurnal manual dan periode akuntansi

Persetujuan jurnal langsung memposting; status `approved` tidak dipakai alur
manual. Periode tidak bisa dibuat siapa pun (RO1).

```mermaid
stateDiagram-v2
    state "Jurnal manual" as JE {
        state "draft" as je_draf
        state "submitted" as je_diajukan
        state "posted" as je_posting
        state "void" as je_void
        state "reversed" as je_dibalik
        [*] --> je_draf: Buat draf (Akuntan - Bella)
        je_draf --> je_diajukan: Ajukan
        je_diajukan --> je_draf: Tolak (Pemilik atau Akuntan lain)
        je_diajukan --> je_posting: Setujui sama dengan posting, bukan pembuat
        je_draf --> je_void: Buang
        je_diajukan --> je_void: Buang
        je_posting --> je_dibalik: Balik, jurnal pembalik diposting
    }
    state "Periode akuntansi" as AP {
        state "open" as ap_open
        state "closed" as ap_closed
        state "locked" as ap_locked
        [*] --> ap_open: Siapkan periode, MACET tanpa pemegang hak (RO1)
        ap_open --> ap_closed: Tutup, snapshot saldo (Bella)
        ap_closed --> ap_locked: Kunci, semua jurnal manual sudah diposting
        ap_closed --> ap_open: Buka kembali
        ap_locked --> ap_open: Buka kembali, rencana hanya Pemilik, kode juga Bella (RO4)
    }
```

### Tagihan pemasok dan pembayaran

```mermaid
stateDiagram-v2
    state "Tagihan pemasok" as SB {
        state "Draf" as sb_draft
        state "Disetujui (terekam)" as sb_approved
        state "Dibayar sebagian" as sb_partial
        state "Lunas" as sb_paid
        state "Void" as sb_void
        [*] --> sb_draft: Buat dari PO atau manual (Bella)
        sb_draft --> sb_approved: Rekam, jurnal utang, tanpa pemeriksa
        sb_draft --> sb_void: Batalkan draf
        sb_approved --> sb_partial: Pembayaran dieksekusi sebagian
        sb_partial --> sb_paid: sisa dibayar
        sb_approved --> sb_paid: dibayar penuh
    }
    state "Pembayaran" as PY {
        state "Draf" as py_draft
        state "Diajukan" as py_submitted
        state "Disetujui" as py_approved
        state "Dieksekusi" as py_executed
        state "Void" as py_void
        state "Menunggu gateway" as py_pending
        state "Lunas gateway" as py_paid
        state "Kedaluwarsa" as py_expired
        state "Gagal" as py_failed
        [*] --> py_draft: Buat dengan alokasi (Bella)
        py_draft --> py_submitted: Ajukan
        py_submitted --> py_approved: Setujui, pembuat boleh (RO9)
        py_approved --> py_executed: Eksekusi, jurnal kas
        py_draft --> py_void: Void
        py_submitted --> py_void: Void
        py_approved --> py_void: Void
        [*] --> py_pending: Link gateway dibuat
        py_pending --> py_paid: webhook lunas
        py_pending --> py_expired: kedaluwarsa
        py_pending --> py_failed: gagal
    }
```

Catatan: status tagihan `overdue` dan status pembayaran `reversed` /
`cancelled` ada di schema tetapi tidak diisi alur yang dibaca di sini.

### Kasbon dan pertanggungjawaban

```mermaid
stateDiagram-v2
    state "Kasbon" as EA {
        state "Draf" as ea_draft
        state "Diajukan" as ea_submitted
        state "Disetujui" as ea_approved
        state "Dicairkan" as ea_disbursed
        state "Lunas" as ea_settled
        state "Dibatalkan" as ea_cancelled
        [*] --> ea_draft: Buat (Teknisi, halaman tertutup RO6)
        ea_draft --> ea_submitted: Ajukan
        ea_submitted --> ea_approved: Setujui, bukan pengaju (Aqim)
        ea_approved --> ea_disbursed: Dicairkan lewat pembayaran
        ea_disbursed --> ea_settled: Pertanggungjawaban atau pengembalian menutup penuh
        ea_draft --> ea_cancelled: Batalkan
        ea_submitted --> ea_cancelled: Tolak atau batalkan
        ea_approved --> ea_cancelled: Batalkan sebelum cair
    }
    state "Pertanggungjawaban" as ES {
        state "Draf" as es_draft
        state "Diajukan" as es_submitted
        state "Terverifikasi" as es_verified
        state "Disetujui, jurnal" as es_approved
        state "Ditolak" as es_rejected
        state "Dibatalkan" as es_cancelled
        state "Dibayar" as es_paid
        [*] --> es_draft: Buat dari kasbon Dicairkan (Teknisi, PM, Pekerja Lepas)
        es_draft --> es_submitted: Ajukan
        es_submitted --> es_verified: Verifikasi, bukan pengaju (Aqim)
        es_verified --> es_approved: Setujui, bukan verifikator, MACET (RO5)
        es_submitted --> es_rejected: Tolak
        es_verified --> es_rejected: Tolak
        es_draft --> es_cancelled: Batalkan
        es_approved --> es_paid: sisa utang klaim dibayar
    }
```

### Peminjaman alat dan penghapusan aset

```mermaid
stateDiagram-v2
    state "Pengajuan peminjaman" as BR {
        state "Draf" as br_draft
        state "Diajukan" as br_requested
        state "Disetujui" as br_approved
        state "Ditolak" as br_rejected
        state "Dibatalkan" as br_cancelled
        [*] --> br_draft: Buat (PM, Pemilik, form tertutup bagi teknisi)
        br_draft --> br_requested: Ajukan
        br_requested --> br_approved: Setujui, pembuat boleh (RO7)
        br_requested --> br_rejected: Tolak
        br_draft --> br_cancelled: Batalkan
        br_requested --> br_cancelled: Batalkan
        br_approved --> br_cancelled: Batalkan
    }
    state "Peminjaman" as BW {
        state "Diserahkan" as bw_issued
        state "Kembali sebagian" as bw_partial
        state "Kembali" as bw_returned
        state "Ditutup" as bw_closed
        [*] --> bw_issued: Serahkan (Gudang), juga dari Diajukan tanpa persetujuan
        bw_issued --> bw_partial: Kembali sebagian atau hilang sebagian
        bw_issued --> bw_returned: Semua kembali
        bw_partial --> bw_returned: Sisa kembali
        bw_returned --> bw_closed: Tutup (Gudang)
    }
    state "Penghapusan aset" as DP {
        state "Draf" as dp_draft
        state "Disetujui" as dp_approved
        state "Dieksekusi" as dp_executed
        state "Dibatalkan" as dp_cancelled
        [*] --> dp_draft: Usulkan (hanya Pemilik)
        dp_draft --> dp_approved: Setujui, tanpa cek pengusul (RO11)
        dp_approved --> dp_executed: Eksekusi, aset Dihapus, jurnal
        dp_draft --> dp_cancelled: Batalkan
        dp_approved --> dp_cancelled: Batalkan
    }
```

Catatan: status penghapusan `submitted` ada di schema, tetapi tidak ada
langkah ajukan; persetujuan menerima draf langsung. Terlambat bukan status
peminjaman, melainkan tanda `marked_late` per item.

### Catatan pajak, pemotongan, dan rekap gaji

```mermaid
stateDiagram-v2
    state "Catatan pajak" as TR {
        state "draft" as tr_draft
        state "verified" as tr_verified
        state "filed" as tr_filed
        state "corrected" as tr_corrected
        [*] --> tr_draft: Buat (Bella)
        tr_draft --> tr_verified: Verifikasi, tanpa cek pembuat (RO13)
        tr_verified --> tr_filed: Lapor
        tr_verified --> tr_corrected: Koreksi
        tr_filed --> tr_corrected: Koreksi
    }
    state "Pemotongan pajak" as WH {
        state "recorded" as wh_recorded
        state "verified" as wh_verified
        state "paid" as wh_paid
        state "reversed" as wh_reversed
        [*] --> wh_recorded: Catat (Bella)
        wh_recorded --> wh_verified: Verifikasi
        wh_verified --> wh_paid: Dibayar
        wh_verified --> wh_reversed: Batalkan
        wh_paid --> wh_reversed: Batalkan, tanpa tombol (OC5)
    }
    state "Rekap gaji bulan" as SP {
        state "Kosong" as sp_empty
        state "Draf" as sp_draft
        state "Disetujui, terkunci" as sp_approved
        [*] --> sp_empty: belum ada baris
        sp_empty --> sp_draft: Siapkan atau impor (SDM - Aqim)
        sp_draft --> sp_draft: Hitung ulang PPh 21 dan BPJS
        sp_draft --> sp_approved: Setujui, hanya Pemilik, tanpa cek penyiap (RO8), jurnal gaji
    }
```

Catatan: status rekap gaji dihitung per bulan dari baris
`employee_salary_records` (`draft` / `approved`); bulan dianggap draf selama
masih ada satu baris draf. Pembayaran gaji lewat kas/bank tidak mengubah
status ini.
