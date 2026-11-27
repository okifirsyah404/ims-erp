# Rencana perubahan mendatang (modul Oki)

Kembali ke [catatan penyesuaian](../README.md). Satu daftar untuk semua perubahan
di modul programmer kedua (Oki): M12, M09, M10, M06, M11, M01, dan portal
karyawan, ditambah hal lintas modul yang dipegang atau ikut dipegang Oki.
Pasangan dari [`rencana-perubahan.md`](rencana-perubahan.md) (gabungan, bagian
3 O-1..O-9 dirinci di sini). Disusun 2026-11-27.

**Status:** semua butir di sini **belum dikerjakan**. Aturan folder ini: tidak
ada eksekusi kode sampai catatan beres dan disetujui. Rincian setiap butir ada
di [`bahan-keputusan-modul-oki.md`](../2-keputusan/bahan-keputusan-modul-oki.md) (kolom
Sumber menyebut nomornya) dan di checklist
[`uat-modul/modul-oki/`](../1-validasi/uat-modul/modul-oki/README.md).

**Arti kolom:**
- **Perlu keputusan:** ya bila belum boleh dikerjakan sebelum Pemilik/Oki memutuskan (nomor OA…/K…).
- **Prioritas:** Tinggi = memblokir alur atau data/uang salah; Sedang = bisa diakali; Rendah = tampilan/teks.
- **Wilayah** (bagian 3): O = Oki; B = Dafrin; Bersama = keduanya.

---

## 1. Keputusan yang harus diambil dulu

| No | Keputusan | Sumber | Oleh | Status |
|---|---|---|---|---|
| K1 / K1a | Pemilik boleh menyetujui sendiri, tercatat audit. K1a diganti 27/11: kasbon dan pertanggungjawaban **ikut K1** (Aqim tidak mengajukan kasbon); jurnal manual tetap butuh orang kedua (Bella ↔ Aqim) | OA6, OA7, OB9, OD2; lembar rapat K1/K1a, X1 | Pemilik + Oki (ADR-0006) | Diputuskan programmer B 27/11, disetujui Pemilik 27/11. Dikerjakan setelah OA5–OA7 |
| RO5 | Pertanggungjawaban kasbon teknisi cukup **satu langkah oleh Aqim**; aturan verifikator ≠ penyetuju dihapus | OB9, OB13; lembar X2 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| K2 / K2b / K2d | Susunan role per orang; Penjualan digabung (K2b); Akuntan **digabung** ke Keuangan di kode (K2d, Bella); Anggota dihapus (Dafrin, Oki hanya Pekerja Lepas); role organisasi Admin dihapus, tanda admin aplikasi Aqim tetap; Auditor "hapus" | OA9, OA10, OA11, OA8 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| RO1 / RO4 | Periode akuntansi dibuat Pemilik dan Keuangan (`accounting_period:create`); buka kembali periode hanya Pemilik (route memeriksa `reopen`) | OB4, OB6 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| K12 | Hapus lapisan organisasi **bertahap**: 1 sembunyikan pemilih organisasi, 2 role ke tingkat pengguna, 3 hapus `organization_id` (ADR baru). OA2 (27/11, diganti): kolom `organization_id` tetap diisi perusahaan tunggal sampai tahap 3 | OA1, OA2 | Pemilik + Oki (+ Dafrin untuk modulnya) | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| K13 / OA4 | Web-admin dan portal karyawan: username/email + kata sandi, tanpa Google; karyawan diundang lalu mengganti kata sandi. Portal pelanggan: Google, **satu jenis akun**, data perusahaan diisi di profil | OA3, OA4 | Pemilik + Oki + Dafrin (portal M07) | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OA5–OA7 | Audit wajib ikut transaksi; perubahan role, hapus anggota, persetujuan sendiri wajib tercatat; **sebelum K1** | OA5, OA6, OA7, L-1 | Oki | Disetujui Pemilik 27/11; menunggu tinjauan Oki (PR #171) |
| K7a / OB7 / OB8 | Pembayaran, gaji, klaim biaya tanpa pemeriksa kedua diterima, diawasi lewat laporan dan audit | OB7, OB8 | Pemilik | Disetujui Pemilik 27/11 |
| OD1 / OD2 | Teknisi mengajukan peminjaman dari daftar unit khusus; persetujuan sendiri yang selalu lolos diperbaiki | OD1, OD2; lembar X7 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| K10 / OE1 | M11 **ditunda**; halaman investor ditutup, hanya Pemilik | OE1, OE2 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OG1 | Absen lokasi di luar radius **ditolak** (berbeda dari rekomendasi) | OG1 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| K9 | Portal karyawan, absen GPS, PPh 21/Coretax, keuangan ADR-0030 diterima sebagai tambahan | bagian G, `lintas-modul/di-luar-scope.md` | Pemilik | Rapat 27/11: diterima sebagai tambahan |
| K11 | Pemilik `document`, `notification`, `webhook`, `company`, `location`, `src/shared`, `src/http`, deploy/CI | bagian 3 di bawah | Kedua programmer | Rapat 27/11: dipegang bersama; setiap perubahan wajib lewat PR dan diberitahukan |
| OD8 | Data aset **tetap** di `inventory` (fisik) + `finance` (nilai). Pembagian pemilik di dalam `inventory`: tabel stok = programmer B (M05), tabel aset/peminjaman = Oki (M06). Dipecah ke schema sendiri hanya bila: aset banyak/rumit, kedua programmer saling ganggu di schema yang sama, atau aset jadi aplikasi terpisah | OD8 | Kedua programmer | Disetujui Pemilik 27/11; menunggu tinjauan Oki (PR #171) |

| OA8 / OA12–OA14 | Log Audit hanya dibaca Pemilik; hak mengundang dicabut dari SDM; dialog konfirmasi hapus undangan/nonaktifkan; pesan login nonaktif vs belum klaim dibedakan | OA8, OA12–OA14 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OB2 / OB3 / OB5 / OB10 / OB12 / OB14 | Pilihan akun berpencarian; layar pembayaran pemasok (baru); Bella membuka Aset tetap dan Anggaran proyek; write-off langsung ke beban; CSV diperbaiki; akun beban di tagihan manual | OB2–OB14 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OB11 | Arus kas tidak langsung (kapitalisasi nonkas) | OB11 | Pemilik + Oki + Bella | Rapat 27/11: (a) abaikan jurnal yang tidak menyentuh kas |
| OB15 | Teks Inggris di Keuangan | OB15 | Oki | Nanti (prioritas rendah) |
| OC1–OC7 | Bug `vat`; hitung ulang DPP × tarif; masa Bupot otomatis; tarif PPN dari master bertanggal berlaku + salinan di dokumen + pengecualian beralasan; Batalkan + alasan; pesan kode ganda; masa pajak tertutup read-only | OC1–OC7 | Pemilik + Oki (+ Dafrin untuk OC4) | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OC8 | **PPh 21 otomatis belum dipakai**: setelan PPh 21 di penggajian dimatikan, PPh 21 dihitung di luar aplikasi; tabel TER resmi belum perlu | OC8 | Pemilik + Bella + Dafrin (gaji M08) | Disetujui Pemilik 27/11 |
| OD3–OD7 / OD9 | Sen di penyimpanan, rupiah di layar; nama bukan ID; catatan servis/kondisi dilengkapi, Set Peralatan disembunyikan; hapus aset dipinjam ditolak; kondisi pengembalian + unit hilang menutup peminjaman; PIC tetap belum perlu | OD3–OD9 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OE3 / OE4 | Portal investor dan hak investor ikut K10 | OE3, OE4 | Pemilik + Oki | Ditunda (27/11) |
| OF1–OF3 | Kartu/tautan disembunyikan bila tidak berhak; lencana "Sementara" dihapus (buku tidak ditutup rutin); `dashboard:read` diperiksa | OF1–OF3 | Pemilik + Oki | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |
| OG2–OG6 | Riwayat absen lokasi sendiri; halaman lupa kata sandi; semua karyawan (kecuali pekerja lepas) punya data karyawan; Aqim tanpa portal karyawan; tanda tangan dengan pratinjau dan konfirmasi | OG2–OG6 | Pemilik + Oki (+ Dafrin untuk data karyawan) | Diputuskan programmer B 27/11, disetujui Pemilik 27/11 |

Status tabel ini diperbarui 2026-11-27 sesuai keputusan tanya-jawab
(`lembar-keputusan-rapat.md` bagian 0). Diperbarui lagi 2026-11-27 sesudah
tanya-jawab ketiga: baris OA8 sampai OG2–OG6 ditambahkan, K12 diberi catatan
risiko OA2 (diganti 27/11: kolom dihapus di tahap 3), OD8 diputuskan.

## 2. Perubahan per modul Oki

### M12 Laporan & Hak Akses

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M12-1 | Audit ditulis di transaksi bisnis untuk peristiwa wajib; tambah audit perubahan role, pengeluaran anggota, ekspor, persetujuan sendiri (`meta.self_approved`) (OA5–OA7 diputuskan 27/11; **sebelum** K1) | OA5–OA7; `skema-database/audit.md` | Tinggi | Diputuskan programmer B 27/11 |
| M12-2 | K12 tahap 1: sembunyikan pemilih dan halaman Organisasi, sesi selalu ke organisasi tunggal; ADR baru. Kolom `organization_id` tetap, diisi perusahaan tunggal (OA2, 27/11) | OA1, OA2 | Tinggi | Diputuskan programmer B 27/11 (K12, OA2) |
| M12-3 | K12 tahap 2: role ke tingkat pengguna (kolom `organization_id` masih ada; dibuang di tahap 3 per modul dengan migrasi append-only) | OA1, OA2 | Sedang | Diputuskan programmer B 27/11 (K12) |
| M12-4 | K13: hapus tombol Google di `login-form.tsx`; konfigurasi Google untuk portal pelanggan → 27/11: tombol Google juga dihapus di portal karyawan; karyawan diundang lalu mengganti kata sandi; pelanggan satu jenis akun (OA4) | OA3, OA4 | Sedang | Diputuskan programmer B 27/11 (K13) |
| M12-5 | `erp-permissions.ts`: label Penjualan (K2b), role tidak ditawarkan (Admin, Anggota, Auditor, `sales`), hak baru dari OB1, OB4, OB5, OB13, OD1; lalu `bun docs/gen-role-permission.ts` → 27/11: Akuntan digabung ke Keuangan (`finance` mendapat hak `accountant`, K2d) termasuk `asset:read` dan `project:read` (OB5); role Anggota dihapus; role organisasi Admin dihapus, tanda admin aplikasi Aqim tetap; `accounting_period:create` untuk Pemilik + Keuangan (RO1); `invitation:create` dicabut dari SDM (OA12); `audit_log:read` hanya Pemilik (OA8). OF1 tidak menambah hak (tautan disembunyikan) | OA8–OA12, OB5, OF1 | Tinggi | Diputuskan programmer B 27/11 (K2, OA8, OA12, OB5) |
| M12-6 | Label anggota multi-role tampil sebagai kode mentah (`organization-member-card.tsx:68`, `admin/users/index.tsx:526`) | UAT M12 | Sedang | Tidak |
| M12-7 | Halaman Ubah anggota: centang hilang setelah F5, hanya mencari 20 anggota pertama (`$organizationId.members.$memberId.edit.tsx:59-67`) | UAT M12 | Sedang | Tidak (gugur bila K12 tahap 2) |
| M12-8 | Form tambah pengguna mendukung beberapa role | `bahan-keputusan.md` D2 | Sedang | Tidak |
| M12-9 | Dialog konfirmasi hapus undangan dan nonaktifkan pengguna (OA13); pesan login akun nonaktif dan akun yang belum klaim undangan dibedakan (OA14) | OA13, OA14 | Rendah | Diputuskan programmer B 27/11 |
| M12-10 | Dialog undangan: Nama bertanda opsional padahal wajib; pola nama pengguna menolak tanda hubung padahal pesan membolehkan | UAT M12 | Rendah | Tidak |
| M12-11 | Terjemahan `INVALID_USERNAME_OR_PASSWORD` di `i18n.auth.ts`; bundel `id/claim.ts` diberi tipe `Record<keyof typeof en, string>` | UAT M12; AGENTS.md i18n | Rendah | Tidak |
| M12-12 | Log Audit: filter tanggal Asia/Jakarta, pilihan filter diterjemahkan dan mencakup modul lain, metadata terbaca | UAT M12 | Sedang | Tidak |
| M12-13 | Daftar organisasi: jumlah proyek acak dan data contoh statis di tab Info | UAT M12 | Rendah | Gugur bila K12 tahap 1 |
| M12-14 | **Ubah role pengguna (beberapa) dari halaman Pengguna**, sebelum halaman Organisasi disembunyikan (K12); **perbaiki form ubah karyawan yang menimpa semua role** (form milik M08, dikerjakan bersama Dafrin) | KF-R1, KF-R2 | Tinggi | Diputuskan 28/11 (KF bagian kedua) |
| M12-15 | **Atur ulang kata sandi oleh admin** / kata sandi sementara (Better Auth `setUserPassword`) | KF-R3 | Tinggi | Diputuskan 28/11 (KF bagian kedua) |
| M12-16 | **Ekspor CSV/XLSX daftar utama** (pelanggan, faktur, piutang, karyawan, log audit) untuk izin `export` yang belum punya endpoint, dengan audit; **PDF laporan keuangan berkop** | KF-R5, KF-R6 | Tinggi | Diputuskan 28/11 (KF bagian kedua) (dinaikkan dari Sedang; endpoint per modul dikerjakan pemilik modulnya) |
| M12-17 | Daftar tunggu bagian kedua modul Oki: KF-R4, KF-R7–R10, KF-D1–D4, KF-E2–E7 | KF bagian kedua | Sedang/Rendah | Diputuskan 28/11 (KF bagian kedua) |

### M09 Keuangan

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M09-1 | Keuangan diberi `chart_of_account:read` (dan `journal:read`) (tercakup bila K2d gabung) | OB1 | Tinggi | Diputuskan programmer B 27/11 (K2d) |
| M09-2 | Pilihan akun **dengan pencarian ke server** (OB2, 27/11); empat layar yang meminta 200/300 diganti pemilih berpencarian | OB2 | Tinggi | Diputuskan programmer B 27/11 |
| M09-3 | **Pekerjaan baru:** layar pembayaran pemasok dari halaman Utang (alokasi tagihan, potongan PPh); backend sudah ada | OB3 | Tinggi | Diputuskan programmer B 27/11 |
| M09-4 | Aksi `accounting_period:create` untuk "Siapkan periode" untuk Pemilik dan Keuangan (RO1, 27/11) | OB4 | Tinggi | Tidak |
| M09-5 | Akuntan diberi `asset:read`, `project:read`; `reopen` hanya Pemilik → 27/11: hak Akuntan pindah ke role Keuangan gabungan (K2d), jadi Bella membuka Aset tetap dan Anggaran proyek (OB5); route pembuka periode memeriksa `reopen`, hanya Pemilik (RO4) | OB5, OB6 | Sedang | Diputuskan programmer B 27/11 |
| M09-6 | Klaim biaya: pengaju ≠ penyetuju; pembayaran tetap tanpa cek tetapi diaudit → diganti 27/11: klaim biaya juga tanpa pemeriksa kedua (OB8 diterima), cukup diaudit | OB7, OB8 | Sedang | Diputuskan programmer B 27/11 |
| M09-7 | Kasbon/pertanggungjawaban: hak `advance`/`settlement` untuk Keuangan/Akuntan supaya Aqim punya pemeriksa → diganti 27/11: Aqim tidak mengajukan kasbon; pertanggungjawaban satu langkah oleh Aqim, aturan verifikator ≠ penyetuju dihapus di `employee-advance.service.ts` (RO5)  (cakupan pengaju diperluas 28/11, KL-10: siapa pun yang punya tugas proyek aktif) | OB9, OB13 | Tinggi (macet sekarang) | Diputuskan programmer B 27/11 |
| M09-8 | Write-off piutang **langsung ke beban kerugian piutang**, tanpa cadangan (OB10, 27/11); write-off tidak lagi mendebit akun cadangan 1-1390 | OB10 | Tinggi (angka laba salah) | Diputuskan programmer B 27/11 |
| M09-9 | Arus kas tidak langsung: abaikan transaksi nonkas | OB11 | Sedang | Ya (OB11 = (a), rapat 27/11) |
| M09-10 | Ekspor CSV ke `/finance/reports/*.csv`, tampilkan galat, label tombol berbeda | OB12 | Sedang | Diputuskan programmer B 27/11 |
| M09-11 | Tagihan pemasok manual: pilihan akun beban (OB14, 27/11) | OB14 | Sedang | Diputuskan programmer B 27/11 |
| M09-12 | Teks: checklist tutup bulan en + id, peran posting di web disamakan dengan backend, status periode di paket manajemen, label tanggal laporan, pesan anggaran berformat ribuan (OB15: **nanti**) | OB15; UAT M09 | Rendah | Diputuskan programmer B 27/11 (nanti) |
| M09-13 | Rute laba periode tertutup (`ExportedProfitService`) hanya bila M11 dibangun (M11 ditunda, 27/11) | UAT M09 laporan; OE1 | Rendah | Ya (K10) |
| M09-14 | Tutup buku akhir tahun ke laba ditahan (ERP-0131), tes audit buka ulang (ERP-0017) | `skema-database/finance.md` | Sedang | Tidak |
| M09-15 | **Pindah dana antar akun kas/bank** (setor tunai, tarik tunai, isi kas kecil), tercatat di kedua akun | KF-K1 | Tinggi | Diputuskan 27/11 (KF-1) |
| M09-16 | **Batalkan/koreksi transaksi kas/bank** (status `reversed` sudah ada di skema) dengan alasan | KF-K2 | Tinggi | Diputuskan 27/11 (KF-1) |
| M09-17 | **PPh 23 dipotong pelanggan**: akun "PPh 23 dibayar dimuka", posting saat kuitansi, sisa faktur tertutup (bersama B-33 di `sale`) | KF-K3 | Tinggi | Diputuskan 27/11 (KF-1) (bersama Dafrin) |
| M09-18 | **Pembayaran upah freelance** (harian atau borongan) dari rekap B-45, dibayar Bella, dicatat sebagai biaya proyek | KL-4 | Tinggi | Diputuskan programmer B 28/11 |

### M10 Pajak

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M10-1 | Form jenis pajak memakai kosakata server (`ppn`, `pph`, …); tambah Ubah jenis pajak | OC1 | Tinggi | Diputuskan programmer B 27/11 |
| M10-2 | Pajak draf dihitung ulang otomatis (DPP × tarif) saat dasar diubah, di service | OC2 | Tinggi | Diputuskan programmer B 27/11 |
| M10-3 | Masa Bupot diisi otomatis dari tanggal transaksi (Asia/Jakarta) | OC3 | Tinggi | Diputuskan programmer B 27/11 |
| M10-4 | Tarif PPN dari **master pajak bertanggal berlaku**; SPH/PO/faktur menyimpan salinan tarif; pengecualian per dokumen wajib alasan. Menyentuh `sale` dan `procurement` (Dafrin) | OC4 | Sedang | Diputuskan programmer B 27/11 (Bersama) |
| M10-5 | Tombol **Batalkan + alasan** untuk pemotongan yang sudah terbayar (OC5, berbeda dari rekomendasi); kode pemotongan ganda dipetakan ke pesan jelas (OC6) | OC5, OC6 | Sedang | Diputuskan programmer B 27/11 |
| M10-6 | Masa pajak yang sudah ditutup dikunci (read-only) | OC7 | Sedang | Diputuskan programmer B 27/11 |
| M10-7 | Rekap: kolom kode pajak benar, query setelah Terapkan, saringan periode di Catatan Pajak; teks Inggris, judul vs menu | UAT M10 6–7 | Rendah | Tidak |
| M10-8 | `tax:create` diperiksa atau dihapus dari kosakata | UAT M10 8 | Rendah | Tidak |
| M10-9 | Gerbang D12/D14/D18, uji impor Coretax, form potongan PPh saat bayar (ERP-0140, lewat M09-3). Tabel TER resmi **tidak perlu sekarang** (OC8) | OC8; M09-3 | Tinggi sebelum lapor | Ya (Bella + Pemilik) |
| M10-10 | PPh 21 otomatis dimatikan: setelan PPh 21 di pengaturan penggajian dalam posisi mati, tombol hitung ulang PPh 21 di rekap gaji tidak dipakai; PPh 21 dihitung di luar aplikasi. Tabel `pph21_*` tetap, tidak dihapus | OC8 | Sedang | Diputuskan programmer B 27/11 (Bersama: gaji milik Dafrin M08) |
| M10-11 | **Status terutang / dibayar / sisa per masa pajak**: setor pajak di Keuangan tersambung ke catatan pajak dan pemotongan | KF-T1 | Tinggi | Diputuskan 27/11 (KF-1) |
| M10-12 | **Rezim pajak dan status PKP dipilih Bella (dengan konsultan bila perlu)**; aplikasi menyediakan **pengaturan** agar tidak terkunci pada satu rezim. Opsi di `3-rancangan/kekurangan-fitur.md` bagian "Opsi pajak". Bila UMKM: rekap PPh Final 0,5% omzet per bulan | KF-T2 | Sedang (Tinggi bila UMKM) | Opsi disiapkan 28/11; menunggu pilihan Bella |
| M10-13 | Bupot PPh 23 dari pelanggan sebagai kredit pajak | KF-T3 | Tinggi | Diputuskan 27/11 (KF-1) (satu paket M09-17) |

### M06 Aset & Peralatan

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M06-1 | Endpoint unit yang bisa dipinjam untuk Teknisi/PM/Gudang (tanpa `asset:read`) (daftar unit khusus, OD1/X7, 27/11) | OD1 | Tinggi | Diputuskan programmer B 27/11 |
| M06-2 | Persetujuan sendiri peminjaman ikut K1 (hanya Pemilik, audit); perbaiki pesan pembatalan | OD2 | Tinggi | Diputuskan programmer B 27/11 (OD2) |
| M06-3 | Satu aturan: sen di penyimpanan, rupiah di layar (form, tampilan, disposal, penyusutan, seeder aset) | OD3 | Tinggi | Diputuskan programmer B 27/11 (ADR-0002) |
| M06-4 | Nama dan pilihan, bukan id, untuk peminjam, nomor seri, gudang, penanggung jawab | OD4 | Sedang | Diputuskan programmer B 27/11 |
| M06-5 | Catatan servis dan cek kondisi **dilengkapi** (layar memakai `logMaintenance`/`recordConditionCheck`); menu Set Peralatan **disembunyikan** | OD5 | Sedang | Diputuskan programmer B 27/11 |
| M06-6 | Tolak penghapusan/nonaktif aset yang sedang dipinjam | OD6 | Tinggi | Diputuskan programmer B 27/11 |
| M06-7 | Kondisi pengembalian Baik/Rusak/Tidak lengkap + catatan; peminjaman yang semua unitnya hilang bisa ditutup; konfirmasi Tandai hilang | OD7 | Sedang | Diputuskan programmer B 27/11 |
| M06-8 | Tombol detail aset berfungsi (Nonaktifkan, Penghapusan, Pinjamkan); rute `/assets` tidak error; tombol disaring hak; pesan sukses dari detail | UAT M06 10, 11, 13, 6 | Sedang | Tidak |
| M06-9 | Form aset berlabel + Kategori/Deskripsi/Kode batang; ekspor register untuk kertas kerja | UAT M06 17; rencana M06 DoD | Rendah | Tidak |
| M06-10 | Istilah ("Dibusukkan", Set Peralatan/Perkakas, Penghapusan) | UAT M06 16 | Rendah | Tidak |
| M06-11 | PIC tetap dan kondisi aset | OD9 | Rendah | Ditunda (OD9: belum perlu, 27/11) |
| M06-12 | Notifikasi peminjaman terlambat (sekarang hanya tanda tiap 15 menit) | UAT M06 18 | Rendah | Ya |
| M06-13 | OD8: schema tetap (`inventory` fisik + `finance` nilai), tanpa modul `assets`. Catat pembagian pemilik tabel di `inventory` (stok = programmer B/M05; aset dan peminjaman = Oki/M06) di `module-ownership.md` dan rencana M06; catat tanda pemecahan (aset banyak/rumit, saling ganggu antar-programmer, aplikasi aset terpisah) | OD8; `skema-database/inventory.md` | Rendah (dokumen) | Diputuskan programmer B 27/11 |
| M06-14 | **Satu jalur penyusutan**: entri manual dihapus atau ikut memposting jurnal, supaya "Jalankan penyusutan" tidak melewati aset | KF-A1 | Tinggi | Diputuskan 27/11 (KF-1) |
| M06-15 | Daftar tunggu kekurangan fitur Sedang/Rendah Aset, Keuangan, Pajak (KF-A2–A10, KF-K4–K10, KF-T4–T8); butir "Tambahan" menunggu permintaan Pemilik | KF-2, KF-3 | Sedang/Rendah | Diputuskan 27/11 (KF-2, KF-3) |

### M11 Bonus & Investor

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M11-1 | Guard awalan `/finance/investors` (rute induk bukan daun menu): hanya Pemilik (OE1, 27/11) | OE2 | Sedang | Tidak |
| M11-2 | ADR baru + skema bagi hasil + modul + `web-investor` bila dibangun | OE1 | Sedang | Ditunda (K10, 27/11) |
| M11-3 | `apps/web-investor` dihapus atau ditandai "belum dimulai"; label en "Investors" vs id "Bonus & Investor"; hak investor di role dibiarkan | OE3, OE4 | Rendah | Ditunda ikut K10 (27/11) |

### M01 Dasbor

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M01-1 | Kartu dan tautan dasbor (mis. Stok) **disembunyikan** bila role tidak punya hak tujuan; tidak menambah `stock:read` | OF1 | Rendah | Diputuskan programmer B 27/11 |
| M01-2 | Lencana "Sementara" **dihapus**, karena pembukuan tidak ditutup rutin (OF2, berbeda dari rekomendasi) | OF2 | Rendah | Diputuskan programmer B 27/11 |
| M01-3 | `dashboard:read` diperiksa | OF3 | Rendah | Diputuskan programmer B 27/11 |
| M01-4 | Kartu Aktivitas: syarat `receipt.read` untuk daftar kuitansi | UAT M01 | Rendah | Tidak |

### Portal karyawan (`apps/web-employee`)

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| PK-1 | Di luar radius: simpan bertanda + layar tinjau admin; petunjuk radius dari setting; cek saat check-out → diganti 27/11: absen di luar radius **ditolak** (OG1), tanpa layar tinjau; petunjuk radius dari setting tetap | OG1 | Sedang | Diputuskan programmer B 27/11 |
| PK-2 | Pekerja proyek (non-PIC) melihat riwayat absen lokasinya sendiri; perbaiki cek "tugas saya" (`_authed.projects.$projectId.tsx:193`) | OG2 | Sedang | Diputuskan programmer B 27/11 |
| PK-3 | Halaman lupa kata sandi portal karyawan **dibuat** (OG3, berbeda dari rekomendasi) | OG3 | Sedang | Diputuskan programmer B 27/11 |
| PK-4 | Semua karyawan wajib punya data karyawan, kecuali pekerja lepas (data oleh Aqim; seeder HR milik Dafrin). Aqim tidak perlu portal karyawan (OG5) | OG4, OG5 | Sedang | Diputuskan programmer B 27/11 (diperjelas 28/11, KL-3: teknisi freelance punya data karyawan jenis Freelance) |
| PK-5 | Tanda tangan dengan pratinjau dan konfirmasi; pesan `portal-denied` tidak ganda dan diterjemahkan; teks Inggris, bahasa awal Indonesia; `type="tel"` di profil | OG6; UAT portal 5–7 | Rendah | Diputuskan programmer B 27/11 |
| PK-6 | Seeder demo portal deterministik (`ORDER BY`), lembur seed tidak disetujui pemohon sendiri | UAT portal 9 | Rendah | Tidak |
| PK-7 | Hak `self_service` diperiksa di guard portal atau dihapus (kaitan: Anggota "hapus") → Anggota dihapus (27/11) | UAT portal 12; OA9 | Rendah | Ya |
| PK-8 | Login portal karyawan tanpa Google: karyawan diundang, mengganti kata sandi, lalu login dengan username/email + kata sandi | K13 | Sedang | Diputuskan programmer B 27/11 |
| PK-9 | **Layar admin kunjungan lokasi dan swafoto teknisi** untuk Aqim (bukan hanya PIC proyek) | KF-E1 | Tinggi | Diputuskan 28/11 (KF bagian kedua) |
| PK-10 | Menu portal karyawan mengikuti **penempatan** (kantor: absen kantor; lapangan: check-in lokasi) dan **jenis Freelance** (tanpa cuti, lembur, slip gaji; dengan rekap upah); perluasan role **Pekerja Lepas** untuk freelance: proyek yang ditugaskan, pinjam alat, kasbon, tanpa tiket (M12-5); **kartu "Hari ini" mengikuti keadaan hari dan menu Kasbon untuk yang punya tugas proyek aktif** (KL-7–KL-10, tampilan bagian 6 dokumen kantor/lapangan) | KL-2, KL-5, KL-6 | Tinggi | Diputuskan programmer B 28/11 |

## 3. Lintas modul yang dipegang atau ikut dipegang Oki

| No | Perubahan | Sumber | Wilayah | Prioritas |
|---|---|---|---|---|
| X-1 | Auth/organisasi: K12, K13, eskalasi role, form tambah pengguna (M12-2..M12-5) | `lintas-modul/autentikasi-dan-hak-akses.md` | O (+B portal) | Tinggi |
| X-2 | Aturan persetujuan bersama K1 untuk 7 service milik Dafrin memakai audit dari M12-1 | L-1; `rencana-perubahan.md` B-1 | Bersama | Tinggi |
| X-3 | Penomoran: pola pemasok pendek (K6), pratinjau dengan kode asli, `warranty` di `CODE_MAX_LENGTH`, alokasi nomor di dalam transaksi atau terima celah; `adminOrErpGuard` nomor kode | L-2; `lintas-modul/penomoran-dokumen.md` | Bersama (`src/shared/numbering` tanpa pemilik, K11) | Tinggi |
| X-4 | Audit sebagai aktivitas bisnis (ERP-0061), penulis audit di sale/procurement/human_resource/payment | L-1; `skema-database/audit.md` | O (modul `audit`) + B (penulis di modulnya) | Tinggi |
| X-5 | Dokumen/PDF: Chromium di image backend, `PDF_CHROMIUM_PATH`/`PDF_RENDER_BASE_URL` di compose; perlebar `document.documents.code` bila opsi 3 penomoran | L-4; `lintas-modul/dokumen-tanda-tangan-dan-file.md` | O (deploy) + pemilik `document` (K11) | Tinggi untuk produksi |
| X-6 | Notifikasi "menunggu persetujuan / disetujui pembuat"; kosakata status/kanal; awalan kode template | `skema-database/notification.md` | Pemilik `notification` (K11) | Sedang |
| X-7 | Deploy: S3 (RustFS) dan Mailpit di compose, nama env `MAIL_SMTP_*`, `SCHEDULER_ENABLED=true`, `web-investor` di compose/CI bila dibangun, backup/restore (T17) | L-3, L-5, L-6, L-9 | O (deploy, K11) | Tinggi untuk produksi |
| X-8 | Pesan validasi server Zod mentah berbahasa Inggris (`src/http`) | L-7 | Bersama | Sedang |
| X-9 | Seeder tanpa `flushall` Redis; hook pre-commit `graphify` opsional | L-8; `lintas-modul/infrastruktur-dan-pengembangan.md` | Bersama | Rendah |
| X-10 | Toast tertutup dialog (komponen bersama web-admin) | `rencana-perubahan.md` B-9 | Bersama (dikerjakan B, beri tahu Oki) | Sedang |
| X-11 | Halaman Produk/Gudang mengikuti hak role, bukan `appAdminOnly` | `bahan-keputusan.md` B3 | O (guard) + B (halaman) | Sedang |
| X-12 | Profil perusahaan: jalur baca pengaturan rahasia (ERP-0045), tutup ERP-0073 | `skema-database/company.md` | Pemilik `company` (K11) | Rendah |

## 4. Dokumen yang perlu dirapikan (pemilik: Oki)

Rincian dan bukti di
[`ringkasan-arsitektur-modul-oki.md`](../3-rancangan/ringkasan-arsitektur-modul-oki.md) bagian 9.

| No | Dokumen | Masalah | Pemilik |
|---|---|---|---|
| DO-1 | ADR-0006 butir 6, `security-and-access.md` | Ikut K1/K1a; 19 role; `approval_rule` | Oki |
| DO-2 | ADR-0018, ADR-0024, ADR-0029 | Status "proposed" padahal berjalan | Oki |
| DO-3 | ADR baru K12 (dan K10 bila dibangun) | Rujukan "ADR-0031" sudah dibetulkan menjadi ERP-0031 (2026-11-27); ADR-0012 ganda, ADR-0028 kosong | Oki (penomoran Bersama) |
| DO-4 | Rencana m01, m06, m09, m10, m11, m12 | Tabel "Current state" dan status basi | Oki |
| DO-5 | `docs/role-permission.md` (generator) | Guard di dalam controller dan guard `employee-portal` tidak dikenali | Oki (generator) |
| DO-6 | `module-ownership.md`, `architecture.md`, AGENTS.md | Jumlah schema/tabel berbeda; "setiap schema punya `code_numberings`" (nyatanya 14 dari 20) | Oki |
| DO-7 | Tidak ada ADR portal karyawan dan PostGIS | Perlu ADR singkat bila K9 menerima portal | Oki |

---

## Urutan yang disarankan

1. ~~Konfirmasi di rapat~~ **Selesai 27/11:** Pemilik menyetujui semua keputusan sesuai usulan; K8, K9, K11, OB11 diputuskan. Tinggal tinjauan Oki (PR #171).
2. **Kerjakan M12-1 (audit dalam transaksi, OA5–OA7) lebih dulu**, baru aturan K1 (X-2); lalu M12-5 (hak: K2b, K2d, Anggota, Admin, RO1), karena hampir semua perbaikan hak bergantung padanya.
3. **Perbaikan Tinggi:** M09-1..M09-5 (RO1, RO4; M09-3 layar pembayaran pemasok baru), M09-7 (RO5), M09-8 (write-off ke beban), M10-1..M10-3, M06-1..M06-3, M06-6, lalu M12-2 (⚠️ OA2 membuat M12-2 jauh lebih besar; konfirmasi dulu).
4. **UAT ulang** M12 → M09 → M10 → M06 sesuai urutan di checklist, lalu perbaikan Sedang dan Rendah.
5. **Lintas modul X-5, X-7** sebelum rilis produksi; **M11** ditunda (K10, 27/11), halaman investor ditutup lewat M11-1; **dokumen** bagian 4 setelah Oki setuju.

## Tambahan keputusan programmer B (27/11, sesudah tanya-jawab kedua)

| Keputusan | Dampak ke rencana | Wilayah |
|---|---|---|
| OB13 / RO6: kasbon teknisi dicairkan Aqim; teknisi mengajukan dan melihat kasbon dari portal karyawan | Tambah halaman kasbon di portal karyawan; pencairan tetap hak Pemilik | Oki (portal karyawan, M09) |
| C13: unit pinjaman wajib disetujui sebelum diserahkan | `borrowing.service.ts`: tolak serah unit bila status masih `requested` | Oki (M06) |
| PK-1: check-out lokasi juga dicek radius | Cek radius saat check-out, sama dengan check-in (OG1) | Oki (portal karyawan) |
