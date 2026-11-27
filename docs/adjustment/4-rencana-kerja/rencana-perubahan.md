# Rencana perubahan mendatang (gabungan)

Kembali ke [catatan penyesuaian](../README.md). Satu daftar untuk semua perubahan
yang ditemukan di catatan folder ini, dikelompokkan supaya mudah diputuskan
dan dibagi. Disusun 2026-11-26.

**Status:** semua butir di sini **belum dikerjakan**. Sesuai arahan
programmer B, tidak ada eksekusi kode sampai catatan beres dan disetujui.
Rincian setiap butir ada di file sumber yang disebut.

**Arti kolom:**
- **Wilayah:** B = programmer B (Dafrin); O = Oki; Bersama = lintas modul /
  tanpa pemilik jelas; Pemilik = keputusan bisnis.
- **Perlu keputusan:** ya bila belum boleh dikerjakan sebelum Pemilik/Oki
  memutuskan.
- **Prioritas:** Tinggi = memblokir alur atau data/uang salah; Sedang =
  bisa diakali; Rendah = tampilan/teks.

---

## 1. Keputusan yang harus diambil dulu

| No | Keputusan | Sumber | Wilayah | Status |
|---|---|---|---|---|
| K1 | Pemilik boleh menyetujui dokumennya sendiri, tercatat di audit (A1 b). Termasuk apakah berlaku juga untuk jurnal, kasbon, dan pertanggungjawaban di keuangan | `bahan-keputusan.md` A1; `validasi-konsep-saat-ini.md` 3.8 | Pemilik + O (ADR-0006) | Diputuskan programmer B 27/11: (b); K1a: kasbon dan pertanggungjawaban ikut K1 (Aqim tidak mengajukan kasbon), jurnal manual tetap orang kedua. Dikerjakan setelah L-1. Disetujui Pemilik 27/11 |
| K2 | Susunan role per orang (16 → 11 role terpakai), role SDM hanya untuk Aqim, dan Manajer Penjualan + Penjualan digabung menjadi satu role Penjualan (K2b) | `validasi-konsep-saat-ini.md` 3.6, 3.8 | Pemilik | Diputuskan programmer B 27/11: (a), dengan K2b gabung, K2d gabung, Anggota dan role organisasi Admin dihapus (tanda admin aplikasi Aqim tetap). Disetujui Pemilik 27/11 |
| K3 | Langkah "Tandai terkirim" pada PO tetap atau dihapus | `bahan-keputusan.md` B1 | Pemilik | Diputuskan programmer B 27/11: (b) dihapus, PO disetujui langsung bisa diterima (B-21). Disetujui Pemilik 27/11 |
| K4 | Siapa boleh membatalkan PO; siapa mengelola data barang; Gudang boleh melihat PO/SO | B2, B3, B4 | Pemilik | Diputuskan programmer B 27/11: (b) untuk B2–B4; B2 berlaku bila nanti ada staf pembelian. Disetujui Pemilik 27/11 |
| K5 | SO otomatis Terkirim/Selesai; menu Uang Muka dibuka; Admin boleh tambah pelanggan | C1, C2, C3 | Pemilik | Diputuskan programmer B 27/11: C1, C2 (a); C3 tidak berlaku (Admin dihapus). Disetujui Pemilik 27/11 |
| K6 | Format nomor pemasok/PO (kode pemasok dipersingkat, kolom diperlebar, atau kode singkat wajib) | `lintas-modul/penomoran-dokumen.md` | Pemilik + Bersama | Diputuskan programmer B 27/11: (a) kode pemasok dipersingkat lewat Administrasi → Nomor Kode + perbaikan pratinjau. Disetujui Pemilik 27/11 |
| K7 | Bilal boleh membuat SO dan mengirim barangnya sendiri | `validasi-konsep-saat-ini.md` R5 | Pemilik | Diputuskan programmer B 27/11: (a); K7a gaji, pembayaran, klaim garansi tanpa pemeriksa kedua diterima. Disetujui Pemilik 27/11 |
| K8 | Kolom A/B di kontrak vs pembagian modul (T19/T20/T23/T24/T27/T28 ke programmer B; T02/T12/T13/T29/T30 ke Oki) | `lintas-modul/di-luar-scope.md` | Pemilik + kedua programmer | Rapat 27/11: (a) kontrak disesuaikan dengan pembagian modul; pertukaran task dicatat resmi beserta dampak pembayarannya |
| K9 | Fitur di luar kontrak yang sudah ada (portal karyawan, absen GPS, dua gateway, PPh 21/Coretax, fitur keuangan ADR-0030): diterima sebagai tambahan atau tidak | `lintas-modul/di-luar-scope.md` | Pemilik | Rapat 27/11: (a) semua diterima sebagai tambahan, ikut UAT dan serah terima |
| K10 | M11 Bonus & Investor: dibangun (butuh ADR baru karena schema `investor` dihapus) atau ditunda | `uat-modul/modul-oki/m11-bonus-investor.md` | Pemilik + O | Diputuskan programmer B 27/11: (b) ditunda; halaman investor ditutup, hanya Pemilik. Disetujui Pemilik 27/11 **[Diubah 28/11, IV-1: M11 dibangun lengkap sekarang, `rancangan-investor-m11.md`]** |
| K11 | Pemilik modul yang belum jelas: `document`, `notification`, `webhook`, `company`, `location`, `src/shared`, `src/http`, deploy/CI | `lintas-modul/di-luar-scope.md` | Kedua programmer | Rapat 27/11: dipegang bersama; setiap perubahan wajib diberitahukan ke programmer lain lewat PR |
| K12 | Hapus lapisan organisasi (satu perusahaan, role tidak per organisasi) | `lembar-keputusan-rapat.md` K12 | Pemilik + O (M12) | Diputuskan programmer B 27/11: (b) bertahap. Disetujui Pemilik 27/11. **diubah 28/11 (programmer B): organisasi **tidak dihapus**; tetap **satu organisasi**, tambah organisasi dimatikan, pemilih organisasi disembunyikan (M12-2); perlu diberitahukan ke Pemilik** |
| K13 | Login: web-admin dan portal karyawan email/username + kata sandi (Google dihapus; karyawan diundang, lalu mengganti kata sandi); portal pelanggan dengan Google, satu jenis akun (OA4) | K13 | Pemilik + O (M12) + B (portal M07) | Diputuskan programmer B 27/11: (a), portal karyawan juga tanpa Google (karyawan diundang), pelanggan satu jenis akun (OA4). Disetujui Pemilik 27/11 |
| K2c | Role Pembelian dipakai sekarang atau tidak | K2c | Pemilik | Diputuskan programmer B 27/11: (a) tidak dipakai. Disetujui Pemilik 27/11 |
| K2d | Akuntan digabung ke Keuangan atau Bella diberi dua role | K2d | Pemilik + O | Diputuskan programmer B 27/11: (a) gabung di kode (`erp-permissions.ts`, wilayah Oki); Bella melihat gaji dan rekening karyawan. Disetujui Pemilik 27/11 |

Status di atas diperbarui 2026-11-27 sesuai keputusan tanya-jawab
(`lembar-keputusan-rapat.md` bagian 0). Keputusan modul Oki (RO1, RO4, RO5,
OA1–OA7, OB7/OB8, OD1/OD2, OE1, OG1) ada di
[`rencana-perubahan-modul-oki.md`](rencana-perubahan-modul-oki.md) bagian 1.

## 2. Perbaikan di modul programmer B

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| B-1 | Aturan persetujuan bersama sesuai K1 di PR, PO, retur, SPH, retur penjualan, cuti/lembur, penyesuaian stok; tombol Setujui untuk Pemilik. Dikerjakan **setelah L-1** (audit dalam transaksi) | K1 | Tinggi | Disetujui Pemilik 27/11 |
| B-2 | Error JSON/foto di form barang (sudah terbukti karena penyimpanan file mati; uji ulang) | `uat-modul/modul-dafrin/m05` A2–A7 | Sedang | Tidak |
| B-3 | Form barang per jenis: Komponen/Bahan/bernomor seri hanya menampilkan kolom yang relevan | M05 A2, A3, A7 | Sedang | Tidak |
| B-4 | Batas nilai: harga, stok minimum, kapasitas rak; tampilan kapasitas 100 → 100.000 | M05 A4, A10; uji UI | Sedang | Tidak |
| B-5 | Daftar barang: filter Diarsipkan; Nonaktifkan di menu titik tiga; tombol aktif/nonaktif rak | M05 A9, A10 | Rendah | Tidak |
| B-6 | Pemasok: NPWP/telepon/WhatsApp/rekening hanya angka dan berbatas; Bank dropdown; kode terkunci saat Ubah | M05 B1, B3, B4; uji UI | Sedang | Tidak |
| B-7 | PR: kolom Spesifikasi untuk barang inventaris; Satuan baris bebas jadi dropdown | M05 C1 | Sedang | Tidak |
| B-8 | PO: pemasok dipilih lewat dropdown yang bisa dicari; hapus kotak "Cari pemasok" | M05 D1, D2 | Sedang | Tidak |
| B-9 | Toast tertutup dialog (semua form) | M05 A1; uji UI | Sedang | Tidak (komponen bersama, beri tahu Oki) |
| B-10 | Label rak tidak terhubung ke kolom; kolom pilihan tanpa label; tombol ikon tanpa nama | uji UI otomatis | Rendah | Tidak |
| B-11 | Kwitansi Rp 0 harus ditolak dengan pesan jelas (database sudah menolak) | `skema-database/sale.md`; M02 D4 | Sedang | Tidak |
| B-12 | Catatan SO tidak tampil di detail; alamat pelanggan tidak bisa diubah | M02 Catatan penyusun | Rendah | Tidak |
| B-13 | Retur penjualan "Rusak" tetap menambah stok jual (barang tanpa seri) | M02 E5 | Tinggi | Tidak |
| B-14 | Masa perpanjangan lisensi kurang 1 hari lewat 29 Februari; perpanjangan lebih awal bisa mengunci pelanggan. **T-2:** masa tahun kalender; kunci pindah saat periode baru mulai. **T-3:** kode/sumber aplikasi dikunci setelah dipakai | M03 Catatan penyusun | Sedang | Diputuskan 27/11 (T-2, T-3) |
| B-15 | M04: Hapus listing katalog dan Tutup chat tanpa konfirmasi; pemilih barang katalog ikut material/komponen; listing tertimpa | M04 Catatan penyusun | Sedang | Tidak |
| B-16 | M07: foto dan prioritas tiket portal tidak tersimpan; tiket tidak bisa diubah; tenggat tugas tidak bisa diisi | M07 Catatan penyusun | Sedang | Tidak |
| B-17 | M08: data karyawan tidak bisa diubah; tolak/batal cuti tanpa alasan dan tanpa konfirmasi; contoh impor memakai kode `EMP-0001` | M08 Catatan penyusun | Sedang | Tidak |
| B-18 | Stok tidak pernah dipesan (reserved); pindah stok produk antar-gudang belum ada | `skema-database/inventory.md` | Sedang | Ya (cakupan) |
| B-19 | Kolom yang tidak pernah diisi: `company_id`/`lead_id` di SO dan proyek, beberapa kolom tiket | `skema-database/sale.md`, `project.md`, `ticket.md` | Rendah | Tidak |
| B-20 | Lanjutkan otomatisasi UAT (Playwright) untuk sisa M05 dan modul lain | `catatan-progres.md` | Rendah | Tidak |
| B-21 | Hapus langkah "Tandai terkirim" pada PO: PO yang disetujui langsung muncul di Penerimaan Barang | K3 / B1 | Tinggi | Disetujui Pemilik 27/11 |
| B-22 | SO otomatis Terkirim saat semua barang terkirim dan Selesai saat lunas; menu Uang Muka dibuka untuk pemegang hak baca invoice | K5 / C1, C2 | Sedang | Disetujui Pemilik 27/11 |
| B-23 | Halaman barang dan gudang ikut hak role (B3); Gudang diberi hak baca PO dan SO (B4, hak diajukan ke Oki) | K4 / B3, B4 | Sedang | Disetujui Pemilik 27/11 |
| B-24 | Portal pelanggan: satu jenis akun (tanpa tipe perorangan/perusahaan saat login), login Google dicocokkan lewat email, data perusahaan diisi di profil | K13 / OA4 | Sedang | Disetujui Pemilik 27/11 |
| B-25 | Menu Tugas: teknisi dan pekerja lepas hanya melihat tugasnya sendiri | D4 | Rendah | Disetujui Pemilik 27/11 |
| B-26 | Bangun alur tabel S6: diskon, kontrak, target (penjualan); tahap, milestone, laporan harian, KPI, rencana kerja (proyek); templat dan sub-tiket. Dikerjakan **setelah perbaikan prioritas tinggi**, tiap kelompok dirancang dulu (laporan harian dan KPI pindah ke **B-44**, 28/11) | T-4 / S6 | Sedang | Diputuskan 27/11 |
| B-27 | Nomor dokumen tanpa celah: alokasi nomor di dalam transaksi penyimpanan (bagian bersama, K11) | T-1 | Sedang | Diputuskan 27/11 |
| B-28 | Rapikan dokumen arsitektur lewat PR (status ADR-0024/0020/0010, ADR-0012 ganda, `architecture.md` 20 schema); `security-and-access.md` ditunda | T-6 / E1–E5 | Rendah | Diputuskan 27/11 |
| B-29 | **Layar terima/keluarkan stok manual** (bahan proyek dan pemakaian sendiri) dengan pilihan proyek dan nomor seri; backend `/stock/receipts`, `/stock/issues` sudah ada | KF-G1 | Tinggi | Diputuskan 27/11 (KF-1) |
| B-30 | **Cek garansi untuk barang yang dijual tanpa proyek**: pakai `item_serials.warranty_expires_on` atau tanggal kirim SO + masa garansi produk | KF-P2 | Tinggi | Diputuskan 27/11 (KF-1) |
| B-31 | **Tiket berbayar bisa ditagih**: dari tiket selesai dibuat SPH atau faktur dengan biaya servis | KF-P1 | Tinggi | Diputuskan 27/11 (KF-1) |
| B-32 | **Tutup PO kurang kirim**: tindakan Tutup untuk PO yang diterima sebagian, dengan alasan; sisa tidak lagi ditunggu | KF-B1 | Tinggi | Diputuskan 27/11 (KF-1) |
| B-33 | **PPh 23 dipotong pelanggan** di form kuitansi (bagian `sale`); akun dan bupot di sisi Oki (O-KF3) | KF-K3, KF-T3 | Tinggi | Diputuskan 27/11 (KF-1) (bersama Oki) |
| B-34 | Daftar tunggu kekurangan fitur Sedang/Rendah modul programmer B (KF-P3–P11, KF-G2–G7, KF-B2–B6); butir "Tambahan" menunggu permintaan Pemilik | KF-2, KF-3 | Sedang/Rendah | Diputuskan 27/11 (KF-2, KF-3) |
| B-35 | Notifikasi ke teknisi saat **tugas proyek** ditugaskan atau tenggatnya dekat (tugas SDM sudah punya notifikasi) | Alur lengkap 7, titik 10 | Tinggi | Ditambahkan 27/11 dari alur lengkap; **Tinggi, diputuskan programmer B 28/11** (fitur utama) |
| B-36 | Tombol **konfirmasi tiket** di portal pelanggan (backend `POST /tickets/:id/confirm` sudah ada, portal belum memetakannya) | Alur lengkap 10, titik 17 | Tinggi | Ditambahkan 27/11 dari alur lengkap; **Tinggi, diputuskan programmer B 28/11** (fitur utama) |
| B-37 | Halaman cetak / PDF untuk **SO, kuitansi, BPB, retur pembelian, retur penjualan** (sekarang hanya tercatat di daftar dokumen). Contoh surat ada untuk SPH, PO, faktur, surat jalan, BAST + garansi; **contoh kuitansi, SO, BPB, retur diminta ke Aqim** (NM-11) | Alur lengkap 6, titik 9 | Tinggi (kuitansi lebih dulu) | Ditambahkan 27/11 dari alur lengkap; **Tinggi, diputuskan programmer B 28/11** (fitur utama) |
| B-38 | **Portal pelanggan dan website**: pesanan online (T21), terima/revisi SPH, lihat faktur, bayar lewat gateway, dokumen (T25). Sekarang hanya tampilan; checkout website belum tersambung. Butuh rancangan dulu (Gate 2). **Rancangan dan urutan diputuskan 28/11:** `3-rancangan/rancangan-portal-pesanan.md` (PP-1–PP-8; urutan P2 + P7 → P3 → P5 → P4) | Alur lengkap 4, titik 6; kontrak T21, T25 | Tinggi (dirancang dulu, Gate 2) | Ditambahkan 27/11 dari alur lengkap; **Tinggi, diputuskan programmer B 28/11** (fitur utama) |
| B-39 | **Gaji memakai absensi**: potongan tidak hadir dan izin tanpa gaji, pro-rata karyawan masuk/keluar, **upah lembur dihitung** dari jam yang disetujui. **Ditambah 28/11: pengaturan potongan** di Pengaturan → Gaji (per hari = gaji pokok ÷ hari kerja; alpa, izin tanpa gaji, terlambat dengan toleransi + nominal per kejadian, pro-rata), rincian `3-rancangan/rancangan-laporan-kerja-dan-potongan-gaji.md` PG-1–PG-5; **hari tugas lapangan**: check-in lokasi = hadir dan tidak dihitung terlambat kecuali ada jam mulai lapangan (KL-8, KL-9) | KF-H1, KF-H2 (T19, ERP-0018) | Tinggi | Diputuskan 28/11 (KF bagian kedua) |
| B-40 | **Riwayat dan saldo pelanggan** di halaman pelanggan: SPH, SO, faktur, sisa piutang, proyek, lisensi, tiket | KF-S1 | Tinggi | Diputuskan 28/11 (KF bagian kedua) |
| B-41 | **Kirim SPH/faktur tanpa n8n**: unduh PDF, salin tautan berbagi, tombol `wa.me` / email | KF-S2 | Tinggi | Diputuskan 28/11 (KF bagian kedua) (dinaikkan dari Sedang) |
| B-42 | **Faktur tanpa SO** (jasa, biaya tambahan, perpanjangan lisensi); backend sudah ada; dibangun bersama B-31 | KF-S6 | Tinggi | Diputuskan 28/11 (KF bagian kedua) (dinaikkan dari Sedang) |
| B-43 | Daftar tunggu bagian kedua modul programmer B: KF-N1 (notifikasi di aplikasi), KF-L1 (lisensi di portal, kontrak T25), KF-S3–S5, S7–S11, KF-L2–L6, KF-I1–I5, KF-H3–H7; butir "Tambahan" menunggu permintaan Pemilik | KF bagian kedua | Sedang/Rendah | Diputuskan 28/11 (KF bagian kedua) |
| B-44 | **Laporan kerja karyawan**: laporan harian wajib di portal karyawan (pengingat, tercatat bila lupa, menyusul maks. 2 hari); laporan mingguan dan bulanan otomatis dari harian + ringkasan karyawan; penilaian Aqim skor 1–5 per aspek + komentar; PDF per karyawan (rekap tim disiapkan untuk nanti). Rincian `3-rancangan/rancangan-laporan-kerja-dan-potongan-gaji.md` LK-1–LK-7. Mencakup laporan harian dan KPI dari B-26 | Tambahan programmer B | Tinggi | Tambahan programmer B, diputuskan 28/11 (layar portal karyawan bersama Oki) |
| B-45 | **Penempatan Kantor/Lapangan** di data karyawan (cara absen dan isi portal mengikuti); **jenis kepegawaian Freelance** untuk teknisi freelance (tanpa kuota cuti dan gaji bulanan); **tarif freelance harian atau borongan** + rekap hari kerja sah dari check-in lokasi dan laporan harian. Rincian `3-rancangan/rancangan-karyawan-kantor-lapangan-freelance.md` KL-1–KL-6; **ditambah KL-7–KL-12** (karyawan kantor ditugaskan ke lapangan: check-in lokasi = hadir, tidak terlambat di hari lapangan kecuali ada jam mulai lapangan, kasbon untuk yang punya tugas proyek) dan **tampilan** (bagian 6) | KL-1–KL-6 | Tinggi | Diputuskan programmer B 28/11 (pembayaran M09-18, hak role M12-5, portal PK-10: Oki) |
| B-46 | **n8n dan WhatsApp dijalankan sungguhan** (M04): penerima di workflow disesuaikan role baru; **event baru** (dokumen menunggu persetujuan, pesanan online masuk, SO terkirim/selesai, pengingat laporan harian); **halaman Pengaturan → Notifikasi WhatsApp** dengan sakelar on/off per pesan pelanggan (bawaan mati); status sakelar ikut di event; WAHA dengan nomor perusahaan; asisten AI aktif (penyedia dipilih Aqim). Rincian `3-rancangan/rancangan-n8n-whatsapp.md` N8-1–N8-8 | N8-1–N8-8 (T14, T27, T28) | Tinggi | Diputuskan 28/11 (server n8n: Oki, X-14) |
| B-47 | Pindah WhatsApp ke **Meta Cloud API** resmi; bangun asisten chat masuk lewat webhook Meta | N8-2 | Sedang (setelah go-live) | Diputuskan 28/11, daftar tunggu |
| B-48 | **Biaya perjalanan di proyek**: kategori baru makan/konsumsi dan tiket perjalanan, rincian transport (bensin, tol, parkir); **uang makan harian** dihitung dari check-in lokasi sah (dalam/luar kota); biaya perjalanan per orang di detail proyek. Rincian `3-rancangan/rancangan-biaya-perjalanan.md` BP-1–BP-6 | BP-1–BP-6 | Tinggi | Diputuskan 28/11 (kasbon/klaim/batas: Oki M09-19) |

## 3. Temuan di modul Oki (pertanyaan untuk Oki)

| No | Temuan | Sumber | Prioritas |
|---|---|---|---|
| O-1 | M06: teknisi tidak bisa mengajukan peminjaman; pengecualian "menyetujui sendiri" selalu lolos; satuan uang aset tidak konsisten (×100); ID mentah di layar; catatan servis dan set peralatan setengah jadi → keputusan 27/11: teknisi mengajukan dari daftar unit pinjam khusus (OD1/X7); persetujuan sendiri diperbaiki (OD2) | `uat-modul/modul-oki/m06-aset-peralatan.md` | Tinggi |
| O-2 | M09: daftar akun dibatasi server 100 tetapi 4 layar meminta 200/300; role Keuangan tidak punya hak baca bagan akun; tidak ada layar pembayaran pemasok; "Siapkan periode" butuh hak yang tidak dimiliki role mana pun; Akuntan tidak bisa membuka Aset tetap/Anggaran → keputusan 27/11: periode dibuat Pemilik dan Keuangan (`accounting_period:create`, RO1); buka kembali hanya Pemilik, route memeriksa `reopen` (RO4); Akuntan digabung ke Keuangan (K2d) | `m09-keuangan-transaksi.md` | Tinggi |
| O-3 | M09: ekspor CSV laporan salah alamat (tanpa `/finance`); arus kas tidak langsung menghitung kapitalisasi non-tunai; write-off tanpa cadangan; label daftar periksa tutup bulan berbahasa Inggris | `m09-keuangan-laporan.md` | Sedang |
| O-4 | M10: menambah tarif pajak selalu gagal (`vat`); ubah catatan pajak tidak menghitung ulang; pemotongan dari UI tidak masuk XML Bupot; PPN dokumen tidak memakai master pajak | `m10-pajak.md` | Tinggi |
| O-5 | M11: belum dibangun; `/finance/investors` terbuka untuk semua yang login; `apps/web-investor` masih template → keputusan 27/11: M11 ditunda; halaman investor ditutup, hanya Pemilik (K10/OE1) | `m11-bonus-investor.md` | Sedang (lihat K10) **[Diubah 28/11, IV-1: M11 dibangun lengkap sekarang, `rancangan-investor-m11.md`]** |
| O-6 | M12: perubahan role dan penghapusan anggota tidak tercatat di audit; anggota multi-role tampil sebagai kode mentah; halaman ubah anggota kehilangan centang setelah F5 dan hanya menemukan 20 anggota pertama; Auditor/Admin tidak bisa membuka audit → keputusan 27/11: audit wajib ikut transaksi; perubahan role, hapus anggota, persetujuan sendiri wajib tercatat; dikerjakan sebelum K1 (OA5–OA7) | `m12-laporan-hak-akses.md` | Sedang |
| O-7 | M01: tautan Stok di dasbor ditolak untuk Penjualan/Pemasaran; lencana "Sementara" pada Laba selalu tampil | `m01-dasbor.md` | Rendah |
| O-8 | Portal karyawan: absen di luar radius tetap tersimpan; pekerja non-PIC tidak melihat kunjungan sendiri; tautan lupa password rusak; akun teknisi tanpa data karyawan; tanda tangan satu klik tanpa konfirmasi → keputusan 27/11: absen di luar radius **ditolak** (OG1); login portal karyawan hanya kata sandi, karyawan diundang (K13) | `portal-karyawan.md` | Sedang |
| O-9 | Gaji: persetujuan periode gaji tidak mengecek pembuat; pembayaran dan klaim biaya tanpa maker-checker → keputusan 27/11: pembayaran dan klaim biaya tanpa pemeriksa kedua diterima, diawasi laporan dan audit (OB7/OB8) | `lintas-modul/autentikasi-dan-hak-akses.md`; M09 | Sedang (lihat K1) |
| O-10 | RO5: pertanggungjawaban kasbon teknisi cukup **satu langkah oleh Aqim**; aturan verifikator ≠ penyetuju dihapus (`employee-advance.service.ts`). Aqim tidak mengajukan kasbon | `validasi-konsep-modul-oki.md` RO5; lembar X2 | Tinggi |
| O-11 | Role di `erp-permissions.ts`: Akuntan digabung ke Keuangan (K2d); Manajer Penjualan + Penjualan digabung (K2b); role Anggota dihapus; role organisasi Admin dihapus, tanda admin aplikasi Aqim tetap | lembar bagian 0; `bahan-keputusan-modul-oki.md` OA9–OA11 | Tinggi |
| O-12 | K12 (diubah 28/11): tetap satu organisasi; tolak organisasi kedua, sembunyikan pemilih (M12-2) | `rencana-perubahan-modul-oki.md` | Tinggi |
| O-13 | K13: tombol Google dihapus di web-admin dan portal karyawan; karyawan diundang lalu mengganti kata sandi | `lintas-modul/autentikasi-dan-hak-akses.md` | Sedang |

## 4. Lintas modul dan infrastruktur

| No | Perubahan | Sumber | Wilayah | Prioritas |
|---|---|---|---|---|
| L-1 | Audit log harus ikut transaksi (sekarang fire-and-forget, bisa hilang); penulis audit untuk persetujuan di sale, procurement, human_resource, payment | `skema-database/audit.md` | Bersama | Tinggi (syarat K1; OA5–OA7 diputuskan programmer B 27/11: wajib, dikerjakan **sebelum** B-1) |
| L-2 | Nomor PO > 32 karakter: perbaiki pola bawaan kode pemasok atau perlebar kolom; pratinjau Nomor Kode memakai kode pemasok sungguhan; batasi juga nomor garansi | `lintas-modul/penomoran-dokumen.md` | Bersama | Tinggi |
| L-3 | `docker-compose.yml`: tambah layanan S3 (MinIO tidak bisa diunduh lagi; dipakai RustFS di lokal) dan Mailpit | `lintas-modul/infrastruktur-dan-pengembangan.md` | Bersama | Sedang |
| L-4 | Image backend tidak memasang Chromium, jadi PDF SPH mati di server | `lintas-modul/dokumen-tanda-tangan-dan-file.md` | Bersama | Tinggi untuk produksi |
| L-5 | Nama variabel SMTP berbeda: CI/runbook `SMTP_*`, config `MAIL_SMTP_*` | infrastruktur | Bersama | Sedang |
| L-6 | Pengingat terjadwal hanya jalan bila `SCHEDULER_ENABLED=true` | notifikasi | Bersama | Sedang |
| L-7 | Pesan validasi server masih berbahasa Inggris (Zod mentah) | M02, M04 Catatan penyusun | Bersama | Sedang |
| L-8 | Hook pre-commit butuh `graphify` (Python); pasang ulang atau jadikan opsional | infrastruktur | Bersama | Rendah |
| L-9 | Backup/restore (T17) belum ada | `lintas-modul/di-luar-scope.md` | Bersama | Tinggi untuk produksi |
| L-10 | **Server siap pakai** di lingkungan uji lalu produksi: Chromium (PDF), S3, SMTP `MAIL_SMTP_*`, `SCHEDULER_ENABLED=true`; menyatukan L-3–L-6 | NM-5, `3-rancangan/rancangan-serah-terima.md` | Bersama (deploy: Oki) | **Tinggi** (Diputuskan 28/11) |
| L-11 | **Batas percobaan login** (rate limit Better Auth) | NM-6, KF-R10 | Bersama (M12: Oki) | **Tinggi** (Diputuskan 28/11) |
| L-12 | **Impor data awal dengan templat Excel semua-atau-tidak**: pelanggan + pemasok, barang + stok awal (penyesuaian disetujui Aqim), akun + saldo awal + piutang/utang awal, aset + karyawan (tanpa login sampai diundang); tiap modul menyiapkan templatnya | NM-1, NM-2 (T16) | Bersama (per pemilik modul) | Tinggi (Diputuskan 28/11) |
| L-13 | **Backup harian** database + berkas, disalin ke luar server, simpan 30 hari, uji restore bulanan (mengisi L-9); panduan deploy/rollback/backup ditulis Oki, ditinjau Dafrin | NM-3, NM-10 (T17, T32) | Bersama (Oki menulis) | Tinggi (Diputuskan 28/11) |
| L-14 | **UAT resmi U01–U32** disalin ke `1-validasi/uat-resmi.md` dan dipetakan ke checklist; hasil dan bukti di sheet UjiTerima. **Menunggu file Excel kontrak** | NM-9 (T31) | Bersama | Tinggi sebelum rilis (Diputuskan 28/11) |
| L-15 | **Pelatihan tatap muka** per kelompok role; **panduan lengkap per modul** dan **panduan penggunaan dari awal sampai akhir** | NM-7, NM-8 (T18, T32) | Bersama | Sebelum rilis (Diputuskan 28/11) |
| L-16 | **Rombak seeder uji** mengikuti susunan role K2 dan akun per orang; data uji per alur (penjualan, pembelian, proyek, tiket, lisensi, aset, SDM kantor/lapangan/freelance, keuangan, investor); deterministik dan idempoten. Rincian `3-rancangan/rancangan-data-seeder.md` | Permintaan programmer B 28/11 | Bersama (role: Oki; data modul: pemilik modul) | Tinggi, akhir langkah 7 setelah P7-4 |
| L-17 | **Informasi penggunaan** (RF-28–RF-34) diterapkan bertahap pada menu, halaman, tabel, dan form yang disentuh setiap tugas; menu baru (RM1) sekaligus dengan keterangan | Permintaan programmer B 28/11 | Bersama | Ikut setiap tugas (A-11) |
| L-18 | **Dokumentasi API**: request body dan response body per endpoint di OpenAPI `/docs` (helper `responseDoc`), endpoint eksternal dulu (webhook, API lisensi, API website, katalog, render SPH, tautan berbagi, portal pelanggan), internal menyusul bertahap; `docs/architecture/api/licensing.yaml` diganti tautan ke `/docs`. Rincian `5-pengerjaan/peta-kode-dafrin.md#l-18` | Permintaan programmer B 28/11; T32 | Bersama (`src/http`; controller per pemilik modul) | Tinggi untuk eksternal (setelah P7-6), internal ikut setiap tugas |

## 5. Dokumen yang perlu dirapikan (setelah izin pemiliknya)

| No | Dokumen | Masalah | Pemilik |
|---|---|---|---|
| D-1 | ADR-0024 | Status "proposed", padahal sudah dijalankan | Oki |
| D-2 | `architecture.md`, AGENTS.md, `module-ownership.md` | Jumlah schema/tabel berbeda-beda (192/199/208); jumlah tabel finance/tax/project | Oki |
| D-3 | `security-and-access.md` | 19 role; batas nominal persetujuan yang tidak ada; aturan menyetujui sendiri (ikut K1) | Oki (dibiarkan dulu atas permintaan programmer B) |
| D-4 | `docs/database/docs.dbml` (catatan) | Penomoran finance dan sale, pola invoice, topik outbox, catatan `finance.settings`, indeks dokumen, CHECK penyesuaian stok | Bersama |
| D-5 | `logical-references.md` | Masih menyebut `inventory.products`/`inventory.warehouses` dan nama method yang tidak ada | Bersama |
| D-6 | `role-permission.md` | `/admin/invitations` tertulis terbuka; rute portal tertulis "no guard macro" | Bersama (generator) |
| D-7 | Rencana modul (m08, m11, m12) | Masih menulis "tanpa GPS/aplikasi pegawai", 6 role, arsip belum ada | Pemilik masing-masing |
| D-8 | `docs/plan/progress.md`, `backlog.md` | Belum mencatat pekerjaan PR #169; beberapa ERP masih in-progress padahal sudah jadi | Bersama (izin programmer B) |
| D-9 | Nomor ADR | Ada dua ADR-0012 dan tidak ada ADR-0028 | Bersama |

---

## Urutan yang disarankan

1. ~~Konfirmasi di rapat~~ **Selesai 27/11:** Pemilik menyetujui semua keputusan sesuai usulan; K8, K9, K11 diputuskan.
2. **Kerjakan L-1 dan L-2** (audit dalam transaksi OA5–OA7, dan nomor), karena K1 dan PO bergantung
   pada keduanya. L-1 **selesai sebelum** B-1 (K1).
3. **Perbaikan Tinggi** di masing-masing wilayah: B-1, B-13, B-21, O-1, O-2, O-4, O-10, O-11.
4. **UAT ulang** modul yang terdampak, lalu perbaikan Sedang dan Rendah.
5. **Dokumen** (bagian 5) setelah pemiliknya setuju.

**Tambahan 27/11:** matriks PO dan Surat Jalan di lembar rapat bagian 6
disetujui programmer B: Aqim membuat, menyetujui, dan membatalkan PO; Gudang
menerima barang dan boleh melihat PO (B4); Gudang menyiapkan, mengirim, dan
menandai surat jalan diterima; Penjualan melihat. Keputusan modul Oki
tambahan (OB13/RO6, C13, PK-1) ada di `rencana-perubahan-modul-oki.md`.
