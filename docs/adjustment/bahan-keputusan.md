# Bahan keputusan untuk Pemilik dan Oki

Disusun 2026-11-24 untuk modul programmer B (M02, M03, M04, M05, M07, M08).
Satu halaman berisi semua hal yang **tidak bisa dikerjakan tanpa keputusan**.
Setiap butir punya pilihan dan rekomendasi. Isi kolom **Keputusan**, lalu
programmer B mengerjakannya.

Sumber rinciannya: `validasi-konsep-saat-ini.md` (bagian 1.3), baris ⚠️/❓ di
`uat-modul/`, dan `ringkasan-arsitektur.md` bagian 7.

**Siapa memutuskan:**
- **Pemilik:** cara kerja bisnis (siapa boleh apa).
- **Oki:** aturan teknis dan dokumen arsitektur (ADR, `erp-permissions.ts`).

---

## A. Persetujuan (paling penting, saling terkait)

Perusahaan punya 1–10 pengguna (10 karyawan + 2 pengembang; siapa memegang apa ada di `validasi-konsep-saat-ini.md` Bagian 3). Aturan sekarang: **pembuat dokumen tidak
boleh menyetujui dokumennya sendiri, termasuk Pemilik** (ADR-0006). Jadi
kalau Pemilik membuat PO sendiri, harus ada orang lain yang menyetujui.

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| A1 | Bolehkah Pemilik menyetujui dokumennya sendiri? | Tidak boleh untuk SPH, PO, PR, retur, cuti, lembur. **Boleh** untuk penyesuaian stok (pengecualian di kode, 3/11) | (a) Tidak boleh untuk semua, sesuai ADR. (b) **Pemilik saja** boleh, tercatat di audit, berlaku untuk semua dokumen. (c) Semua pemegang hak setuju boleh | **(b)**: cocok untuk tim kecil dan sesuai arahan Pemilik 23/11. Butuh perubahan ADR-0006 oleh Oki | **Arah programmer B (2026-11-26): (b)**, Aqim boleh menyetujui sendiri. Menunggu Pemilik dan Oki. Rincian di `validasi-konsep-saat-ini.md` 3.8 |
| A2 | SPH dan PO tetap wajib disetujui? | Wajib. Rancangan 23/11 hanya mewajibkan untuk penyesuaian stok dan gaji | (a) Tetap wajib. (b) Tidak wajib: langsung bisa dikirim | **(a)** bila A1 = (b). Persetujuan tetap ada, tapi tidak menghambat Pemilik | |
| A3 | Cuti dicatat HR, siapa yang menyetujui? (M08 C3) | HR tidak bisa menyetujui catatannya sendiri; dengan satu HR, persetujuan oleh Pemilik | (a) Tetap. (b) HR boleh menyetujui sendiri | **(a)**. Cuti Aqim sendiri ikut A1 (b) | |

**Dampak ke kode:** A1 (b) perkiraan kasar sekitar 1 hari kerja. Satu aturan bersama dipakai di semua
service persetujuan, ditambah catatan audit dan test. Pengecualian
penyesuaian stok sekarang ikut diganti aturan ini.

## B. Alur pembelian dan gudang (M05)

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| B1 | Perlu langkah **"Tandai terkirim"** pada PO sebelum gudang menerima barang? | Perlu. PO yang baru disetujui belum muncul di Penerimaan Barang (sumber kebingungan awal) | (a) Tetap, sudah ada petunjuk di layar. (b) PO yang disetujui langsung bisa diterima | **(a)** bila PO dikirim ke pemasok lewat aplikasi. **(b)** bila PO biasanya dikirim manual (WA/telepon) | |
| B2 | Siapa boleh **membatalkan PO**? (M05 D10) | Hanya Pemilik | (a) Tetap. (b) Pembelian boleh membatalkan draf miliknya; Manajer Operasional boleh semua sebelum barang diterima | **(b)** | |
| B3 | Siapa mengelola **data barang/produk dan gudang**? (M05 A11) | Halaman hanya untuk admin aplikasi, padahal Pembelian punya hak buat/ubah barang | (a) Tetap admin aplikasi. (b) Ikut hak role: Pembelian (dan Gudang untuk data gudang) | **(b)**: hak sudah ada di server, hanya halamannya yang menutup | |
| B4 | Gudang boleh **melihat PO dan SO**? (M05 D11, M02 C10) | Tidak. Link dari BPB ke PO dan dari surat jalan ke SO ditolak | (a) Tetap; link disembunyikan untuk Gudang. (b) Beri hak baca PO dan SO | **(b)**: Gudang perlu melihat isi pesanan yang ia terima/kirim | |

## C. Alur penjualan (M02)

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| C1 | SO perlu status **Terkirim/Selesai**? (M02 C8) | SO berhenti di **Diproses** walau semua barang sudah dikirim; kode tidak pernah mengubahnya | (a) Otomatis Terkirim saat semua barang terkirim, Selesai saat lunas. (b) Tombol manual | **(a)** | |
| C2 | Menu **Uang Muka** (M02 D11) | Tidak bisa dibuka siapa pun. Data DP sebenarnya sudah ada (invoice termin pertama), hanya menunya tidak diberi hak | (a) Buka untuk pemegang hak baca invoice. (b) Hapus menunya | **(a)**: perbaikan kecil, kemungkinan besar bug | |
| C3 | Admin perlu hak **tambah pelanggan**? | Tidak, padahal Admin bisa mengundang akun portal pelanggan | (a) Tetap. (b) Beri hak tambah/ubah pelanggan | **(b)** bila Admin Kantor yang menerima pelanggan baru | |

## D. Role dan menu lain

| No | Pertanyaan | Kondisi sekarang | Pilihan | Rekomendasi | Keputusan |
|---|---|---|---|---|---|
| D1 | Role mana yang benar-benar dipakai? | 17 role; tiap user satu role | (a) Pakai semua. (b) Pakai beberapa saja (misalnya Pemilik, Admin, Penjualan, Pembelian, Gudang, Keuangan, Teknisi); sisanya tetap ada di kode tapi tidak diberikan | **(b)**: tidak perlu mengubah kode | |
| D2 | Satu orang boleh punya **beberapa role**? | **Sudah didukung** (dicek 2026-11-26): ubah anggota memakai centang per role; hanya form tambah pengguna yang memilih satu role | (a) Satu role saja. (b) Beberapa role | **(b)**, sesuai data tim 2026-11-26 (lihat `validasi-konsep-saat-ini.md` Bagian 3) | |
| D3 | Admin perlu akses **Proyek**? (M07 A14) | Tidak punya hak proyek sama sekali | (a) Tetap. (b) Hak baca proyek | Tergantung tugas Admin Kantor | |
| D4 | Menu **Tugas** untuk teknisi, PM, pekerja lepas, auditor (M08 E5) | Tampil untuk semua role itu | (a) Tetap. (b) Teknisi/pekerja lepas hanya melihat tugasnya sendiri | Cek saat UAT dulu | |
| D5 | Halaman **konten website** (testimoni, gambar) untuk Pemasaran (M04 C9) | Hak ada, halaman admin belum ada | (a) Buat halamannya. (b) Tunda | **(b)** sampai alur website diprioritaskan | |

## E. Dokumen arsitektur yang sudah tidak cocok (untuk Oki)

Bukan keputusan bisnis. Butuh persetujuan Oki karena dokumennya miliknya.

| No | Dokumen | Masalah |
|---|---|---|
| E1 | ADR-0024 | Status masih "proposed", padahal sudah dijalankan |
| E2 | `architecture.md` | Masih 18 schema; seharusnya 20 (ADR-0026) |
| E3 | `security-and-access.md` | Masih 19 role organisasi; seharusnya 17 (ADR-0018) |
| E4 | `security-and-access.md` | Menyebut batas nominal persetujuan SPH (`approval_rule`) yang tidak ada di kode |
| E5 | ADR-0006 butir 6 | Mengikuti keputusan A1 |

Keputusan Oki: boleh diperbaiki programmer B / Oki sendiri / biarkan.
______________________

---

## Urutan pengerjaan setelah diputuskan

1. **A1–A3:** aturan persetujuan bersama (paling banyak dampak).
2. **B2–B4, C1, C2:** perbaikan alur M05/M02 yang kecil.
3. **C3, D2, D3:** penyesuaian hak role (`erp-permissions.ts`, wilayah Oki,
   jadi diajukan dulu).
4. **D5 dan E:** sesuai jadwal.

| Diputuskan oleh | Tanggal | Tanda tangan |
|---|---|---|
| Pemilik | | |
| Oki | | |
