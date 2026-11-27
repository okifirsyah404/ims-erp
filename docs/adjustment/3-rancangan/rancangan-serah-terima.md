# Rancangan pekerjaan non-modul: impor, server, backup, UAT resmi, pelatihan, serah terima

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: keputusan programmer B lewat tanya-jawab 2026-11-28.** Belum ada
kode. Mencakup tugas kontrak bersama A + B (`docs/plan/kontrak/erp-plan-id.md`):
T16 impor terbatas dan UAT, T17 deployment dan uji backup/restore, T18
pilot pelatihan dan serah terima, T31 integrasi UAT, T32 rilis terpadu dan
serah terima.

**Syarat kontrak yang mengikat:**
- 32 skenario UAT (U01–U20 versi awal, U21–U32 tambahan dan siklus
  terpadu) **wajib lulus dengan bukti dan reviewer**; temuan kritis ditutup
  sebelum rilis diterima.
- Keluaran serah terima (T32): source code dan skema, konfigurasi tanpa
  rahasia terbuka, daftar akun/akses, panduan admin/finance/portal,
  dokumentasi endpoint dan callback, panduan WA/n8n, hasil UAT, daftar
  keterbatasan, backup/restore, prosedur deploy/rollback, pelatihan.
- Hosting/VPS dan backup eksternal **biaya perusahaan**, di luar biaya
  pengembangan.

---

## 1. Keputusan

| No | Keputusan | Tugas |
|---|---|---|
| NM-1 | **Impor dengan templat Excel, semua-atau-tidak:** unduh templat → isi → unggah → semua baris diperiksa; bila ada yang salah, tidak ada yang masuk dan kesalahan ditampilkan per baris (pola pesan RF 4.5) | T16 |
| NM-2 | **Data yang diimpor:** pelanggan + pemasok; barang + **stok awal** (masuk sebagai penyesuaian stok yang disetujui Aqim); daftar akun + saldo awal + piutang/utang awal; aset + karyawan (**karyawan hasil impor belum punya login sampai diundang**) | T16 |
| NM-3 | **Backup harian otomatis** (database + berkas S3) tiap malam, **disalin ke luar server**, disimpan **30 hari**; **uji restore tiap bulan** dan dicatat | T17 |
| NM-4 | Aplikasi dipasang di **server milik perusahaan** | T17 |
| NM-5 | **Server siap pakai, prioritas Tinggi:** Chromium untuk PDF, penyimpanan berkas S3, email SMTP (nama env `MAIL_SMTP_*`), scheduler (`SCHEDULER_ENABLED=true`) | T17 (L-3–L-6, X-5, X-7) |
| NM-6 | **Batas percobaan login, prioritas Tinggi** (perlindungan tebak kata sandi di produksi) | T17 / M12 |
| NM-7 | **Pelatihan tatap muka** per kelompok role | T18 |
| NM-8 | **Panduan lengkap per modul** dan **panduan penggunaan dari awal sampai akhir** (alur end-to-end: data awal → jual → beli/gudang → proyek → tagih/bayar → laporan → tutup bulan), memenuhi syarat panduan admin/finance/portal | T18, T32 |
| NM-9 | **Skenario U01–U32 disalin ke repo dan dipetakan** ke langkah checklist UAT kita (`1-validasi/uat-resmi.md`, dibuat setelah file Excel kontrak diterima); hasil, tanggal, bukti, dan reviewer tetap diisi di sheet UjiTerima Excel | T31 |
| NM-10 | **Panduan deploy, rollback, dan backup/restore ditulis Oki, ditinjau Dafrin** (bagian bersama, K11) | T17, T32 |
| NM-11 | **Templat dokumen: daftar tunggu**; halaman cetak mengikuti contoh surat perusahaan (bagian 4) | — |

## 2. Urutan

| Kapan | Pekerjaan |
|---|---|
| Langkah 7 (fondasi) | NM-5 server siap pakai di lingkungan uji; NM-6 batas login |
| Langkah 8 | Templat impor per modul (NM-1, NM-2) oleh pemilik modulnya; backup otomatis (NM-3) |
| Langkah 9 (UAT ulang) | U01–U32 dipetakan (NM-9); impor data uji; uji restore pertama |
| Sebelum rilis (T31, T32) | Panduan per modul dan end-to-end (NM-8), panduan deploy/rollback/backup (NM-10), pelatihan tatap muka (NM-7), daftar keterbatasan, daftar akun/akses |

## 3. Yang masih dibutuhkan

| Hal | Dari siapa |
|---|---|
| **File Excel kontrak** (sheet UjiTerima berisi U01–U32). **Dicek 28/11: tidak ada di `.agents/samples-private/`** (isinya hanya contoh surat PDF) | Programmer B / Pemilik |
| Akses server perusahaan dan tempat salinan backup di luar server | Aqim |
| Akun SMTP (email) untuk undangan dan pengingat | Aqim |
| Contoh surat kuitansi, SO, BPB, retur | Aqim |

## 4. Templat dokumen (penjelasan)

Menu **Dokumen → Templat** sekarang halaman "Segera hadir" (ERP-0050).
Maksudnya: tempat mengatur **bentuk surat yang dicetak/PDF** (SPH, faktur,
kuitansi, PO, surat jalan, BAST, sertifikat garansi), misalnya kop, logo,
teks ketentuan, nama dan jabatan penanda tangan, catatan kaki. Sekarang
bentuk surat **tertulis tetap di kode** halaman cetak; yang bisa diubah hanya
profil perusahaan (nama, alamat, logo, NPWP) dan pengaturan dokumen
(kunci/nilai).

**Keputusan 28/11 (NM-11): daftar tunggu.** Templat dokumen **tidak
penting untuk sekarang dan tidak menghambat bagian lain**, karena contoh
surat perusahaan sudah ada dan halaman cetak dibuat mengikuti contoh itu.
Menu Templat tetap disembunyikan (RM4). Bila nanti teks ketentuan atau
penanda tangan sering berubah, dibuat pengaturan sederhana per jenis surat.

**Contoh surat yang tersedia** (`.agents/samples-private/`, tidak di-commit):
SPH, PO, faktur, surat jalan, BAST + surat keterangan garansi. **Belum ada
contoh:** kuitansi, SO, BPB, retur (dibutuhkan B-37; minta contoh ke Aqim
atau dibuat mengikuti gaya faktur).
