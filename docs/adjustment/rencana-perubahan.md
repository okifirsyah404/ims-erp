# Rencana perubahan mendatang (gabungan)

Kembali ke [catatan penyesuaian](README.md). Satu daftar untuk semua perubahan
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
| K1 | Pemilik boleh menyetujui dokumennya sendiri, tercatat di audit (A1 b). Termasuk apakah berlaku juga untuk jurnal, kasbon, dan pertanggungjawaban di keuangan | `bahan-keputusan.md` A1; `validasi-konsep-saat-ini.md` 3.8 | Pemilik + O (ADR-0006) | Diterima programmer B, menunggu Pemilik dan Oki |
| K2 | Susunan role per orang (16 → 12 role terpakai) dan role SDM hanya untuk Aqim | `validasi-konsep-saat-ini.md` 3.6, 3.8 | Pemilik | Diterima programmer B, menunggu Pemilik |
| K3 | Langkah "Tandai terkirim" pada PO tetap atau dihapus | `bahan-keputusan.md` B1 | Pemilik | Menunggu |
| K4 | Siapa boleh membatalkan PO; siapa mengelola data barang; Gudang boleh melihat PO/SO | B2, B3, B4 | Pemilik | Menunggu |
| K5 | SO otomatis Terkirim/Selesai; menu Uang Muka dibuka; Admin boleh tambah pelanggan | C1, C2, C3 | Pemilik | Menunggu |
| K6 | Format nomor pemasok/PO (kode pemasok dipersingkat, kolom diperlebar, atau kode singkat wajib) | `lintas-modul/penomoran-dokumen.md` | Pemilik + Bersama | Menunggu |
| K7 | Bilal boleh membuat SO dan mengirim barangnya sendiri | `validasi-konsep-saat-ini.md` R5 | Pemilik | Menunggu |
| K8 | Kolom A/B di kontrak vs pembagian modul (T19/T20/T23/T24/T27/T28 ke programmer B; T02/T12/T13/T29/T30 ke Oki) | `lintas-modul/di-luar-scope.md` | Pemilik + kedua programmer | Perlu dibicarakan |
| K9 | Fitur di luar kontrak yang sudah ada (portal karyawan, absen GPS, dua gateway, PPh 21/Coretax, fitur keuangan ADR-0030): diterima sebagai tambahan atau tidak | `lintas-modul/di-luar-scope.md` | Pemilik | Perlu dibicarakan |
| K10 | M11 Bonus & Investor: dibangun (butuh ADR baru karena schema `investor` dihapus) atau ditunda | `uat-modul/modul-oki/m11-bonus-investor.md` | Pemilik + O | Menunggu |
| K11 | Pemilik modul yang belum jelas: `document`, `notification`, `webhook`, `company`, `location`, `src/shared`, `src/http`, deploy/CI | `lintas-modul/di-luar-scope.md` | Kedua programmer | Perlu dibicarakan |

## 2. Perbaikan di modul programmer B

| No | Perubahan | Sumber | Prioritas | Perlu keputusan |
|---|---|---|---|---|
| B-1 | Aturan persetujuan bersama sesuai K1 di PR, PO, retur, SPH, retur penjualan, cuti/lembur, penyesuaian stok; tombol Setujui untuk Pemilik | K1 | Tinggi | Ya (K1) |
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
| B-14 | Masa perpanjangan lisensi kurang 1 hari lewat 29 Februari; perpanjangan lebih awal bisa mengunci pelanggan | M03 Catatan penyusun | Sedang | Sebagian |
| B-15 | M04: Hapus listing katalog dan Tutup chat tanpa konfirmasi; pemilih barang katalog ikut material/komponen; listing tertimpa | M04 Catatan penyusun | Sedang | Tidak |
| B-16 | M07: foto dan prioritas tiket portal tidak tersimpan; tiket tidak bisa diubah; tenggat tugas tidak bisa diisi | M07 Catatan penyusun | Sedang | Tidak |
| B-17 | M08: data karyawan tidak bisa diubah; tolak/batal cuti tanpa alasan dan tanpa konfirmasi; contoh impor memakai kode `EMP-0001` | M08 Catatan penyusun | Sedang | Tidak |
| B-18 | Stok tidak pernah dipesan (reserved); pindah stok produk antar-gudang belum ada | `skema-database/inventory.md` | Sedang | Ya (cakupan) |
| B-19 | Kolom yang tidak pernah diisi: `company_id`/`lead_id` di SO dan proyek, beberapa kolom tiket | `skema-database/sale.md`, `project.md`, `ticket.md` | Rendah | Tidak |
| B-20 | Lanjutkan otomatisasi UAT (Playwright) untuk sisa M05 dan modul lain | `catatan-progres.md` | Rendah | Tidak |

## 3. Temuan di modul Oki (pertanyaan untuk Oki)

| No | Temuan | Sumber | Prioritas |
|---|---|---|---|
| O-1 | M06: teknisi tidak bisa mengajukan peminjaman; pengecualian "menyetujui sendiri" selalu lolos; satuan uang aset tidak konsisten (×100); ID mentah di layar; catatan servis dan set peralatan setengah jadi | `uat-modul/modul-oki/m06-aset-peralatan.md` | Tinggi |
| O-2 | M09: daftar akun dibatasi server 100 tetapi 4 layar meminta 200/300; role Keuangan tidak punya hak baca bagan akun; tidak ada layar pembayaran pemasok; "Siapkan periode" butuh hak yang tidak dimiliki role mana pun; Akuntan tidak bisa membuka Aset tetap/Anggaran | `m09-keuangan-transaksi.md` | Tinggi |
| O-3 | M09: ekspor CSV laporan salah alamat (tanpa `/finance`); arus kas tidak langsung menghitung kapitalisasi non-tunai; write-off tanpa cadangan; label daftar periksa tutup bulan berbahasa Inggris | `m09-keuangan-laporan.md` | Sedang |
| O-4 | M10: menambah tarif pajak selalu gagal (`vat`); ubah catatan pajak tidak menghitung ulang; pemotongan dari UI tidak masuk XML Bupot; PPN dokumen tidak memakai master pajak | `m10-pajak.md` | Tinggi |
| O-5 | M11: belum dibangun; `/finance/investors` terbuka untuk semua yang login; `apps/web-investor` masih template | `m11-bonus-investor.md` | Sedang (lihat K10) |
| O-6 | M12: perubahan role dan penghapusan anggota tidak tercatat di audit; anggota multi-role tampil sebagai kode mentah; halaman ubah anggota kehilangan centang setelah F5 dan hanya menemukan 20 anggota pertama; Auditor/Admin tidak bisa membuka audit | `m12-laporan-hak-akses.md` | Sedang |
| O-7 | M01: tautan Stok di dasbor ditolak untuk Penjualan/Pemasaran; lencana "Sementara" pada Laba selalu tampil | `m01-dasbor.md` | Rendah |
| O-8 | Portal karyawan: absen di luar radius tetap tersimpan; pekerja non-PIC tidak melihat kunjungan sendiri; tautan lupa password rusak; akun teknisi tanpa data karyawan; tanda tangan satu klik tanpa konfirmasi | `portal-karyawan.md` | Sedang |
| O-9 | Gaji: persetujuan periode gaji tidak mengecek pembuat; pembayaran dan klaim biaya tanpa maker-checker | `lintas-modul/autentikasi-dan-hak-akses.md`; M09 | Sedang (lihat K1) |

## 4. Lintas modul dan infrastruktur

| No | Perubahan | Sumber | Wilayah | Prioritas |
|---|---|---|---|---|
| L-1 | Audit log harus ikut transaksi (sekarang fire-and-forget, bisa hilang); penulis audit untuk persetujuan di sale, procurement, human_resource, payment | `skema-database/audit.md` | Bersama | Tinggi (syarat K1) |
| L-2 | Nomor PO > 32 karakter: perbaiki pola bawaan kode pemasok atau perlebar kolom; pratinjau Nomor Kode memakai kode pemasok sungguhan; batasi juga nomor garansi | `lintas-modul/penomoran-dokumen.md` | Bersama | Tinggi |
| L-3 | `docker-compose.yml`: tambah layanan S3 (MinIO tidak bisa diunduh lagi; dipakai RustFS di lokal) dan Mailpit | `lintas-modul/infrastruktur-dan-pengembangan.md` | Bersama | Sedang |
| L-4 | Image backend tidak memasang Chromium, jadi PDF SPH mati di server | `lintas-modul/dokumen-tanda-tangan-dan-file.md` | Bersama | Tinggi untuk produksi |
| L-5 | Nama variabel SMTP berbeda: CI/runbook `SMTP_*`, config `MAIL_SMTP_*` | infrastruktur | Bersama | Sedang |
| L-6 | Pengingat terjadwal hanya jalan bila `SCHEDULER_ENABLED=true` | notifikasi | Bersama | Sedang |
| L-7 | Pesan validasi server masih berbahasa Inggris (Zod mentah) | M02, M04 Catatan penyusun | Bersama | Sedang |
| L-8 | Hook pre-commit butuh `graphify` (Python); pasang ulang atau jadikan opsional | infrastruktur | Bersama | Rendah |
| L-9 | Backup/restore (T17) belum ada | `lintas-modul/di-luar-scope.md` | Bersama | Tinggi untuk produksi |

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

1. **Putuskan K1, K2, K6** (persetujuan, role, nomor PO): paling banyak
   memblokir alur.
2. **Kerjakan L-1 dan L-2** (audit dan nomor), karena K1 dan PO bergantung
   pada keduanya.
3. **Perbaikan Tinggi** di masing-masing wilayah: B-1, B-13, O-1, O-2, O-4.
4. **UAT ulang** modul yang terdampak, lalu perbaikan Sedang dan Rendah.
5. **Dokumen** (bagian 5) setelah pemiliknya setuju.
