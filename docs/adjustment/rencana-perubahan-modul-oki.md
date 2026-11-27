# Rencana perubahan mendatang (modul Oki)

Kembali ke [catatan penyesuaian](README.md). Satu daftar untuk semua perubahan
di modul programmer kedua (Oki): M12, M09, M10, M06, M11, M01, dan portal
karyawan, ditambah hal lintas modul yang dipegang atau ikut dipegang Oki.
Pasangan dari [`rencana-perubahan.md`](rencana-perubahan.md) (gabungan, bagian
3 O-1..O-9 dirinci di sini). Disusun 2026-11-27.

**Status:** semua butir di sini **belum dikerjakan**. Aturan folder ini: tidak
ada eksekusi kode sampai catatan beres dan disetujui. Rincian setiap butir ada
di [`bahan-keputusan-modul-oki.md`](bahan-keputusan-modul-oki.md) (kolom
Sumber menyebut nomornya) dan di checklist
[`uat-modul/modul-oki/`](uat-modul/modul-oki/README.md).

**Arti kolom:**
- **Perlu keputusan:** ya bila belum boleh dikerjakan sebelum Pemilik/Oki memutuskan (nomor OA…/K…).
- **Prioritas:** Tinggi = memblokir alur atau data/uang salah; Sedang = bisa diakali; Rendah = tampilan/teks.
- **Wilayah** (bagian 3): O = Oki; B = Dafrin; Bersama = keduanya.

---

## 1. Keputusan yang harus diambil dulu

| No | Keputusan | Sumber | Oleh | Status |
|---|---|---|---|---|
| K1 / K1a | Pemilik boleh menyetujui sendiri, tercatat audit; tidak berlaku untuk jurnal, kasbon, pertanggungjawaban | OA6, OA7, OB9, OD2; lembar rapat K1/K1a | Pemilik + Oki (ADR-0006) | Isian lembar: K1 (b), K1a (b); menunggu rapat |
| K2 / K2b / K2d | Susunan role; Admin tidak dipakai, Anggota dan Auditor "hapus", Penjualan digabung, Akuntan "merging ke Keuangan" | OA9, OA10, OA11, OA8 | Pemilik + Oki | Isian lembar K2 (a); K2d bertentangan dengan rekomendasi (dua role); perlu dikonfirmasi |
| K12 | Hapus lapisan organisasi (cara dan tahap) | OA1, OA2 | Pemilik + Oki (+ Dafrin untuk modulnya) | Arah baru 2026-11-26, usulan bertahap |
| K13 | Login web-admin tanpa Google; portal pelanggan dengan Google | OA3, OA4 | Pemilik + Oki + Dafrin (portal M07) | Arah baru 2026-11-26 |
| OA5 | Audit wajib ikut transaksi | OA5, L-1 | Oki | Menunggu |
| K7a | Pembayaran/gaji tanpa pemeriksa kedua diterima; peminjaman aset diperbaiki | OB7, OD2 | Pemilik | Isian lembar (a) |
| K10 | M11 dibangun (ADR baru) atau ditunda | OE1 | Pemilik + Oki | Menunggu; rekomendasi tunda |
| K9 | Portal karyawan, absen GPS, PPh 21/Coretax, keuangan ADR-0030 diterima sebagai tambahan | bagian G, `lintas-modul/di-luar-scope.md` | Pemilik | Perlu dibicarakan |
| K11 | Pemilik `document`, `notification`, `webhook`, `company`, `location`, `src/shared`, `src/http`, deploy/CI | bagian 3 di bawah | Kedua programmer | Perlu dibicarakan |
| OD8 | Pembagian schema `inventory`: stok (Dafrin) vs aset/peminjaman (Oki) | OD8 | Kedua programmer | Usulan |

## 2. Perubahan per modul Oki

### M12 Laporan & Hak Akses

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M12-1 | Audit ditulis di transaksi bisnis untuk peristiwa wajib; tambah audit perubahan role, pengeluaran anggota, ekspor, persetujuan sendiri (`meta.self_approved`) | OA5–OA7; `skema-database/audit.md` | Tinggi | Ya (OA5, OA6) |
| M12-2 | K12 tahap 1: sembunyikan pemilih dan halaman Organisasi, sesi selalu ke organisasi tunggal; ADR baru | OA1, OA2 | Tinggi | Ya (K12) |
| M12-3 | K12 tahap 2–3: role ke tingkat pengguna, buang `organization_id` per modul (`docs.dbml`, migrasi append-only, seed, test) | OA1 | Sedang | Ya (K12) |
| M12-4 | K13: hapus tombol Google di `login-form.tsx`; konfigurasi Google untuk portal pelanggan | OA3, OA4 | Sedang | Ya (K13) |
| M12-5 | `erp-permissions.ts`: label Penjualan (K2b), role tidak ditawarkan (Admin, Anggota, Auditor, `sales`), hak baru dari OB1, OB4, OB5, OB13, OD1, OF1; lalu `bun docs/gen-role-permission.ts` | OA9–OA12 | Tinggi | Ya (K2) |
| M12-6 | Label anggota multi-role tampil sebagai kode mentah (`organization-member-card.tsx:68`, `admin/users/index.tsx:526`) | UAT M12 | Sedang | Tidak |
| M12-7 | Halaman Ubah anggota: centang hilang setelah F5, hanya mencari 20 anggota pertama (`$organizationId.members.$memberId.edit.tsx:59-67`) | UAT M12 | Sedang | Tidak (gugur bila K12 tahap 2) |
| M12-8 | Form tambah pengguna mendukung beberapa role | `bahan-keputusan.md` D2 | Sedang | Tidak |
| M12-9 | Konfirmasi hapus undangan dan nonaktifkan pengguna; pesan login nonaktif terpisah | OA13, OA14 | Rendah | Sebagian |
| M12-10 | Dialog undangan: Nama bertanda opsional padahal wajib; pola nama pengguna menolak tanda hubung padahal pesan membolehkan | UAT M12 | Rendah | Tidak |
| M12-11 | Terjemahan `INVALID_USERNAME_OR_PASSWORD` di `i18n.auth.ts`; bundel `id/claim.ts` diberi tipe `Record<keyof typeof en, string>` | UAT M12; AGENTS.md i18n | Rendah | Tidak |
| M12-12 | Log Audit: filter tanggal Asia/Jakarta, pilihan filter diterjemahkan dan mencakup modul lain, metadata terbaca | UAT M12 | Sedang | Tidak |
| M12-13 | Daftar organisasi: jumlah proyek acak dan data contoh statis di tab Info | UAT M12 | Rendah | Gugur bila K12 tahap 1 |

### M09 Keuangan

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M09-1 | Keuangan diberi `chart_of_account:read` (dan `journal:read`) | OB1 | Tinggi | Ya (K2d) |
| M09-2 | Daftar akun: endpoint pilihan atau batas server dinaikkan; empat layar 200/300 | OB2 | Tinggi | Ya (cara) |
| M09-3 | Layar pembayaran pemasok dari halaman Utang (alokasi tagihan, potongan PPh) | OB3 | Tinggi | Ya |
| M09-4 | Aksi `accounting_period:create` untuk "Siapkan periode" | OB4 | Tinggi | Tidak |
| M09-5 | Akuntan diberi `asset:read`, `project:read`; `reopen` hanya Pemilik | OB5, OB6 | Sedang | Ya |
| M09-6 | Klaim biaya: pengaju ≠ penyetuju; pembayaran tetap tanpa cek tetapi diaudit | OB7, OB8 | Sedang | Ya (K1a, K7a) |
| M09-7 | Kasbon/pertanggungjawaban: hak `advance`/`settlement` untuk Keuangan/Akuntan supaya Aqim punya pemeriksa | OB9, OB13 | Sedang | Ya (K1a) |
| M09-8 | Write-off: beban kerugian piutang bila cadangan kurang | OB10 | Tinggi (angka laba salah) | Ya |
| M09-9 | Arus kas tidak langsung: abaikan transaksi nonkas | OB11 | Sedang | Tidak |
| M09-10 | Ekspor CSV ke `/finance/reports/*.csv`, tampilkan galat, label tombol berbeda | OB12 | Sedang | Tidak |
| M09-11 | Tagihan pemasok manual: pilihan akun beban | OB14 | Rendah | Ya |
| M09-12 | Teks: checklist tutup bulan en + id, peran posting di web disamakan dengan backend, status periode di paket manajemen, label tanggal laporan, pesan anggaran berformat ribuan | OB15; UAT M09 | Rendah | Tidak |
| M09-13 | Rute laba periode tertutup (`ExportedProfitService`) hanya bila M11 dibangun | UAT M09 laporan; OE1 | Rendah | Ya (K10) |
| M09-14 | Tutup buku akhir tahun ke laba ditahan (ERP-0131), tes audit buka ulang (ERP-0017) | `skema-database/finance.md` | Sedang | Tidak |

### M10 Pajak

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M10-1 | Form jenis pajak memakai kosakata server (`ppn`, `pph`, …); tambah Ubah jenis pajak | OC1 | Tinggi | Tidak |
| M10-2 | Hitung ulang pajak saat dasar draf diubah (di service) | OC2 | Tinggi | Tidak |
| M10-3 | Periode Bupot otomatis dari tanggal pemotongan | OC3 | Tinggi | Ya (cara) |
| M10-4 | PPN dokumen tetap per dokumen, nilai awal dari master pajak | OC4 | Sedang | Ya |
| M10-5 | Terbayar → Dibatalkan dilarang di server; kode ganda dipetakan ke pesan jelas | OC5, OC6 | Sedang | Ya |
| M10-6 | Periode pajak terkunci read-only | OC7 | Sedang | Ya |
| M10-7 | Rekap: kolom kode pajak benar, query setelah Terapkan, saringan periode di Catatan Pajak; teks Inggris, judul vs menu | UAT M10 6–7 | Rendah | Tidak |
| M10-8 | `tax:create` diperiksa atau dihapus dari kosakata | UAT M10 8 | Rendah | Tidak |
| M10-9 | Gerbang D12/D14/D18, tabel TER resmi, uji impor Coretax, form potongan PPh saat bayar (ERP-0140) | OC8; M09-3 | Tinggi sebelum lapor | Ya (Bella + Pemilik) |

### M06 Aset & Peralatan

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M06-1 | Endpoint unit yang bisa dipinjam untuk Teknisi/PM/Gudang (tanpa `asset:read`) | OD1 | Tinggi | Ya (cara) |
| M06-2 | Persetujuan sendiri peminjaman ikut K1 (hanya Pemilik, audit); perbaiki pesan pembatalan | OD2 | Tinggi | Ya (K1) |
| M06-3 | Satu aturan rupiah-sen di form, tampilan, disposal, penyusutan, dan seeder aset | OD3 | Tinggi | Tidak (ADR-0002) |
| M06-4 | Nama, bukan id, untuk peminjam, nomor seri, gudang, penanggung jawab | OD4 | Sedang | Tidak |
| M06-5 | Sembunyikan catatan servis dan set peralatan sampai diminta | OD5 | Sedang | Ya (K9) |
| M06-6 | Tolak penghapusan/nonaktif aset yang sedang dipinjam | OD6 | Tinggi | Tidak |
| M06-7 | Kondisi pengembalian + catatan; peminjaman yang semua unitnya hilang bisa ditutup; konfirmasi Tandai hilang | OD7 | Sedang | Tidak |
| M06-8 | Tombol detail aset berfungsi (Nonaktifkan, Penghapusan, Pinjamkan); rute `/assets` tidak error; tombol disaring hak; pesan sukses dari detail | UAT M06 10, 11, 13, 6 | Sedang | Tidak |
| M06-9 | Form aset berlabel + Kategori/Deskripsi/Kode batang; ekspor register untuk kertas kerja | UAT M06 17; rencana M06 DoD | Rendah | Tidak |
| M06-10 | Istilah ("Dibusukkan", Set Peralatan/Perkakas, Penghapusan) | UAT M06 16 | Rendah | Tidak |
| M06-11 | PIC tetap dan kondisi aset | OD9 | Rendah | Ya |
| M06-12 | Notifikasi peminjaman terlambat (sekarang hanya tanda tiap 15 menit) | UAT M06 18 | Rendah | Ya |

### M11 Bonus & Investor

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M11-1 | Guard awalan `/finance/investors` (rute induk bukan daun menu) | OE2 | Sedang | Tidak |
| M11-2 | ADR baru + skema bagi hasil + modul + `web-investor` bila dibangun | OE1 | Sedang | Ya (K10) |
| M11-3 | `apps/web-investor` dihapus atau ditandai "belum dimulai"; label en "Investors" vs id "Bonus & Investor" | OE3 | Rendah | Ya |

### M01 Dasbor

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| M01-1 | Tautan Stok: beri `stock:read` ke Penjualan atau sembunyikan tautan | OF1 | Rendah | Ya |
| M01-2 | Lencana "Sementara" hanya bila periode belum ditutup | OF2 | Rendah | Tidak |
| M01-3 | `dashboard:read` diperiksa atau dihapus | OF3 | Rendah | Ya |
| M01-4 | Kartu Aktivitas: syarat `receipt.read` untuk daftar kuitansi | UAT M01 | Rendah | Tidak |

### Portal karyawan (`apps/web-employee`)

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| PK-1 | Di luar radius: simpan bertanda + layar tinjau admin; petunjuk radius dari setting; cek saat check-out | OG1 | Sedang | Ya |
| PK-2 | Non-PIC melihat kunjungan sendiri; perbaiki cek "tugas saya" (`_authed.projects.$projectId.tsx:193`) | OG2 | Sedang | Tidak |
| PK-3 | Tautan lupa kata sandi dihapus atau halaman reset dibuat | OG3 | Sedang | Ya |
| PK-4 | Data karyawan untuk semua staf yang absen (data oleh Aqim; seeder HR milik Dafrin) | OG4 | Sedang | Ya |
| PK-5 | Konfirmasi tanda tangan; pesan `portal-denied` tidak ganda; teks Inggris, bahasa awal Indonesia; `type="tel"` di profil | OG6; UAT portal 5–7 | Rendah | Tidak |
| PK-6 | Seeder demo portal deterministik (`ORDER BY`), lembur seed tidak disetujui pemohon sendiri | UAT portal 9 | Rendah | Tidak |
| PK-7 | Hak `self_service` diperiksa di guard portal atau dihapus (kaitan: Anggota "hapus") | UAT portal 12; OA9 | Rendah | Ya |

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
[`ringkasan-arsitektur-modul-oki.md`](ringkasan-arsitektur-modul-oki.md) bagian 9.

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

1. **Putuskan K1/K1a, K2, K12 tahap 1, K13, OA5** di rapat.
2. **Kerjakan M12-1 (audit) dan M12-5 (hak)**, karena K1 dan hampir semua perbaikan hak bergantung padanya.
3. **Perbaikan Tinggi:** M09-1..M09-4, M09-8, M10-1..M10-3, M06-1..M06-3, M06-6, lalu M12-2.
4. **UAT ulang** M12 → M09 → M10 → M06 sesuai urutan di checklist, lalu perbaikan Sedang dan Rendah.
5. **Lintas modul X-5, X-7** sebelum rilis produksi; **M11** setelah K10; **dokumen** bagian 4 setelah Oki setuju.
