# UAT M05 - Inventaris & Pembelian (T07)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** kategori → komponen/material → produk → rak → pemasok → permintaan pembelian (PR) → PO → penerimaan barang (BPB) → retur pembelian → penyesuaian stok.

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, foto, dan baris tambahan. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Status dokumen:**

| Dokumen          | Status                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| PR               | Draf → Menunggu persetujuan → Disetujui → Sudah dipesan (atau Dibatalkan)                                      |
| PO               | Draf → Menunggu persetujuan → Disetujui → Terkirim ke pemasok → Diterima sebagian → Diterima (atau Dibatalkan) |
| Retur pembelian  | Draf → Menunggu persetujuan → Disetujui → Dikirim ke pemasok (atau Dibatalkan)                                 |
| Penyesuaian stok | Draf → Diajukan → Disetujui → Tercatat (atau Ditolak / Dibatalkan)                                             |

**Data contoh yang dibuat selama UAT:**

| Data                 | Nilai                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Kategori             | Kabel UAT (`uat-kabel`)                                                    |
| Komponen             | Modul relay UAT, SKU `UAT-CMP-01`                                          |
| Material             | Konektor RJ45 UAT, SKU `UAT-MAT-01`                                        |
| Produk biasa         | Kabel UTP Cat6 UAT, SKU `UAT-KBL-01`, jual Rp 1.500.000, beli Rp 1.000.000 |
| Produk bernomor seri | Kamera IP UAT, SKU `UAT-CAM-01`, jual Rp 2.500.000, beli Rp 1.800.000      |
| Rak                  | `R-01` di gudang WH-MAIN                                                   |
| Pemasok              | PT Sumber Kabel UAT, kontak Budi Santoso                                   |
| Nomor seri kamera    | `CAM-UAT-001`, `CAM-UAT-002`, pengganti `CAM-UAT-003`                      |

Siapkan juga **2 file gambar** (PNG/JPG/WebP) untuk uji foto barang.

***

## A. Data barang dan gudang (login `admin`)

### A1. Buat kategori barang

Menu **Inventaris → Barang → Kategori barang** → tombol **Kategori baru**.

| Isian       | Isi dengan                 |
| ----------- | -------------------------- |
| Slug URL    | `uat-kabel`                |
| Nama        | `Kabel UAT`                |
| Urutan      | `5`                        |
| Nama pendek | `Kabel`                    |
| Deskripsi   | `Kategori kabel untuk UAT` |
| Aktif       | dicentang (bawaan)         |

**Uji salah** (sebelum isian di atas disimpan):

- Slug URL `Kabel UAT` (huruf besar dan spasi) → ditolak; petunjuk "Huruf kecil, angka, dan tanda hubung…".
- Slug URL atau Nama dikosongkan → tidak bisa disimpan.

**Klik:** Simpan.\
**Harus terlihat:** pesan "Kategori disimpan"; Kabel UAT muncul di daftar dengan urutan 5. Buat lagi kategori dengan slug `uat-kabel` → ditolak "Kategori barang dengan slug ini sudah ada".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Posisi pesan (pop-up) | Pesan muncul di belakang form dialog, sehingga tidak terlihat | Pesan seharusnya tampil di atas tengah layar, di depan form dialog |
| | | |
| | | |
| | | |

### A2. Buat komponen

Menu **Inventaris → Barang → Komponen** → tombol **Barang baru**.

| Isian                 | Isi dengan                                       |
| --------------------- | ------------------------------------------------ |
| Jenis *(cek pilihan)* | Produk / Komponen / Bahan; terpilih **Komponen** |
| Nama                  | `Modul relay UAT`                                |
| Kode SKU              | `UAT-CMP-01`                                     |
| Kategori              | Tanpa kategori (bawaan)                          |
| Harga beli            | `75000`                                          |
| Satuan                | pcs                                              |

**Klik:** Buat barang.\
**Harus terlihat:** "Barang dibuat"; kode otomatis `CMP-…`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Kolom form untuk jenis Komponen | Semua kolom ditampilkan, sama seperti Produk | Form seharusnya hanya menampilkan kolom yang relevan untuk Komponen, seperti contoh di langkah ini. Begitu juga untuk Bahan |
| Unggah gambar | Gambar gagal terunggah dan tidak muncul di daftar | Gambar yang diunggah seharusnya tampil di daftar |
| Pesan setelah simpan | Muncul error `Unexpected token 'a', "an unexpec"... is not valid JSON`, padahal barang tersimpan | Error ini harus diperbaiki; yang tampil seharusnya hanya pesan sukses |
| | | |
| | | |
| | | |

|   |
| - |
|   |

### A3. Buat material

Menu **Inventaris → Barang → Material** → tombol **Barang baru**. Judul halaman tertulis "Bahan", sama artinya dengan Material.

| Isian        | Isi dengan          |
| ------------ | ------------------- |
| Jenis        | terpilih **Bahan**  |
| Nama         | `Konektor RJ45 UAT` |
| Kode SKU     | `UAT-MAT-01`        |
| Merek        | `AMP`               |
| Harga beli   | `50000`             |
| Satuan       | pcs                 |
| Stok minimum | `10`                |

**Klik:** Buat barang.\
**Harus terlihat:** "Barang dibuat"; kode otomatis `MAT-…`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Unggah gambar | Sama seperti A1 dan A2: gambar tidak muncul | Perlu diperbaiki |
| Kolom form untuk jenis Bahan | Semua kolom ditampilkan | Form seharusnya hanya menampilkan kolom yang relevan untuk Bahan |
| Pesan (pop-up) | Sama seperti A1 dan A2: pesan tertutup form dan muncul error JSON | Perlu diperbaiki |
| | | |
| | | |
| | | |

### A4. Buat produk biasa (semua kolom)

Menu **Inventaris → Produk** → tombol **Barang baru**. Form terbagi 6 bagian: Identitas, Gambar, Harga, Stok & pelacakan, Spesifikasi, Komponen & material.

**Identitas**

| Isian                    | Isi dengan                                                            |
| ------------------------ | --------------------------------------------------------------------- |
| Jenis *(cek pilihan)*    | Produk / Komponen / Bahan; biarkan **Produk**                         |
| Nama                     | `Kabel UTP Cat6 UAT`                                                  |
| Kode SKU                 | `UAT-KBL-01`                                                          |
| Nomor seri               | kosongkan                                                             |
| Kategori *(cek pilihan)* | ada "Tanpa kategori" dan **Kabel UAT** (dari A1); pilih **Kabel UAT** |
| Merek                    | `Belden`                                                              |
| Deskripsi                | `Kabel jaringan untuk instalasi CCTV`                                 |

**Gambar**

| Isian           | Isi dengan                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foto di dokumen | klik **Tambah gambar**, pilih 2 file gambar. Isi **Keterangan** gambar pertama `Tampak depan`. Coba **Geser maju / Geser mundur**; gambar pertama bertanda **Sampul** |

**Harga**

| Isian      | Isi dengan                      |
| ---------- | ------------------------------- |
| Harga jual | `1500000` (tampil Rp 1.500.000) |
| Harga beli | `1000000`                       |

**Stok & pelacakan**

| Isian                  | Isi dengan                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Satuan *(cek pilihan)* | pcs, unit, set, paket, titik, m, roll, kg, jam, bulan, tahun, lic, lot, pulau; pilih **roll** |
| Stok minimum           | `2`                                                                                           |
| Kode batang            | `8991234567890`                                                                               |
| Bernomor seri          | tidak dicentang                                                                               |
| Kuantitas              | dicentang (bawaan)                                                                            |
| Aktif                  | dicentang (bawaan)                                                                            |

**Spesifikasi** (kotak teks, satu poin per baris)

```javascript
Panjang 305 m
Tembaga murni 23 AWG
Jaket PVC abu-abu
```

**Komponen & material**

| Isian                         | Isi dengan                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| Tambah komponen atau material | ketik `UAT-CMP`, pilih Modul relay UAT; **Jumlah per unit** `2`   |
| Tambah komponen atau material | ketik `UAT-MAT`, pilih Konektor RJ45 UAT; **Jumlah per unit** `4` |

**Uji salah** (sebelum menyimpan):

- Kosongkan Nama atau Kode SKU → tombol Buat barang tidak bisa diklik.
- Jumlah per unit `0` atau `1,2345` → pesan "Setiap jumlah harus lebih dari 0, dengan maksimal 3 desimal." Kembalikan ke 2 dan 4.
- Harga jual diisi huruf, angka negatif, atau angka sangat besar (misal `999999999999999`) → harus ditolak atau dibatasi. Kembalikan ke 1500000.
- Klik **Hapus** pada salah satu baris komponen, lalu tambahkan lagi.

**Klik:** Buat barang.\
**Harus terlihat:** pesan "Barang dibuat", tanpa pesan error lain; di daftar muncul dengan kode otomatis `PRD-…`, nama, kategori Kabel UAT, harga Rp 1.500.000, dan foto sampul.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Pesan setelah simpan | Muncul error `Unexpected token 'a', "an unexpec"... is not valid JSON` sampai tiga kali, padahal barang tersimpan | Error ini tidak boleh muncul; yang tampil seharusnya hanya pesan sukses |
| Unggah gambar | Gambar tidak muncul di daftar, dan setelah Ubah juga tidak muncul di detail produk | Gambar seharusnya tampil di daftar dan di detail produk |
| Kolom harga | Nilai bisa diisi tanpa batas | Perlu batas nilai maksimal |
| | | |
| | | |
| | | |

### A5. Cek detail produk

Klik Kabel UTP Cat6 UAT di daftar untuk membuka detailnya.

**Harus terlihat** di **Detail barang**, semuanya sama dengan isian A4:

- Kategori Kabel UAT, Merek Belden, status Aktif.
- Satuan roll, Kode batang 8991234567890, Stok minimum 2.
- Harga jual Rp 1.500.000, Harga beli Rp 1.000.000.
- Pelacakan: Kuantitas (bukan Bernomor seri).
- **Komponen & material**: Modul relay UAT × 2 dan Konektor RJ45 UAT × 4, dengan kode dan nama.
- **Spesifikasi**: 3 baris seperti yang diketik.
- **Foto di dokumen**: 2 gambar, yang pertama bertanda Sampul, keterangan "Tampak depan".

Tekan F5; semua tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Foto di detail produk | Foto tidak tampil | Foto seharusnya tampil di detail produk |
| Simpan foto saat Ubah | Muncul error `Unexpected token 'a', "an unexpec"... is not valid JSON` | Perlu diperbaiki |
| | | |
| | | |
| | | |

### A6. Ubah produk

Di detail Kabel UTP Cat6 UAT klik **Ubah**.

**Harus terlihat dulu:** kolom **Jenis** dan **Kode SKU** terkunci (tidak bisa diubah); semua kolom lain berisi nilai A4.

| Isian               | Ubah menjadi                              |
| ------------------- | ----------------------------------------- |
| Merek               | `Belden Pro`                              |
| Harga jual          | `1600000`                                 |
| Stok minimum        | `3`                                       |
| Foto di dokumen     | hapus gambar kedua                        |
| Komponen & material | ubah Jumlah per unit Konektor menjadi `6` |

**Klik:** Simpan.\
**Harus terlihat:** "Barang diperbarui"; detail menunjukkan Belden Pro, Rp 1.600.000, stok minimum 3, satu foto, Konektor × 6. Ubah lagi Harga jual ke `1500000` dan simpan (angka ini dipakai di M02).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Foto | Foto belum muncul setelah produk diubah | Foto seharusnya tampil |
| | | |
| | | |
| | | |

### A7. Buat produk bernomor seri

Menu **Inventaris → Produk** → **Barang baru**.

| Isian         | Isi dengan                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ |
| Nama          | `Kamera IP UAT`                                                                            |
| Kode SKU      | `UAT-CAM-01`                                                                               |
| Kategori      | Tanpa kategori                                                                             |
| Merek         | `Hikvision`                                                                                |
| Harga jual    | `2500000`                                                                                  |
| Harga beli    | `1800000`                                                                                  |
| Satuan        | pcs                                                                                        |
| Bernomor seri | **dicentang**; petunjuk "Barang bernomor seri dilacak per unit; kuantitas tidak dihitung." |
| Kuantitas     | biarkan tercentang (setelah Bernomor seri dicentang, kolom ini abu-abu)                    |

**Uji salah:** sebelum mencentang Bernomor seri, hilangkan centang **Kuantitas**, lalu centang Bernomor seri dan klik Buat barang → ditolak "A serialized product must be stock-tracked" (atau pesan sejenis). Centang lagi Kuantitas.

**Klik:** Buat barang.\
**Harus terlihat:** tersimpan dengan kode `PRD-…`; di detail, Pelacakan = Bernomor seri.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Kolom form | Semua kolom ditampilkan | Form seharusnya hanya menampilkan kolom yang diperlukan |
| Unggah foto | Error yang sama seperti di A1 dan langkah lain | Foto harus berhasil diunggah |
| | | |
| | | |
| | | |

### A8. SKU ganda dan batal

1. **Barang baru** → Nama `Kabel duplikat`, Kode SKU `UAT-KBL-01` → **Buat barang** → ditolak "Barang dengan SKU ini sudah ada".

2. **Barang baru** → isi Nama `Batal UAT`, SKU `UAT-BATAL` → klik **Batal** → tidak ada barang baru di daftar.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A9. Arsipkan dan aktifkan

1. Buat barang `Arsip UAT`, SKU `UAT-ARSIP`, Jenis Produk.

2. Di daftar, menu kartu barang itu → **Arsipkan** → konfirmasi "Arsipkan barang ini?" → **Arsipkan**.

3. Ubah satu barang lain menjadi tidak **Aktif** lewat Ubah, lalu aktifkan lagi lewat menu kartu **Aktifkan**.

**Harus terlihat:** "Barang diarsipkan"; Arsip UAT hilang dari daftar. Barang nonaktif tampil nonaktif lalu kembali aktif.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Barang yang diarsipkan | Barang hilang dari daftar, dan tidak ada filter untuk melihatnya lagi | Perlu filter "Diarsipkan" di daftar Produk, Komponen, dan Material, supaya barang arsip tetap bisa dicari |
| Menonaktifkan barang | Harus lewat Ubah di halaman detail; terlalu banyak langkah | Tambahkan pilihan "Nonaktifkan" di menu titik tiga, di bawah Arsipkan |
| | | |
| | | |
| | | |

### A10. Buat dan ubah rak gudang

Menu **Inventaris → Gudang** → buka **WH-MAIN** → tab **Penyimpanan** → **Tambah penyimpanan**.

| Isian     | Isi dengan         |
| --------- | ------------------ |
| Kode      | `R-01`             |
| Nama      | `Rak 1`            |
| Jenis     | `Rak`              |
| Kapasitas | `100`              |
| Aktif     | dicentang (bawaan) |

**Klik:** Tambah penyimpanan.\
**Harus terlihat:** "Penyimpanan dibuat"; R-01 muncul dengan nama, jenis, dan kapasitas di atas. Bila R-01 sudah ada, pesan kode sudah dipakai; lanjut ke uji berikut.

**Uji lain:**

- Tambah penyimpanan dengan Kode `R-01` lagi → ditolak (kode sudah dipakai).
- Kosongkan Kode → tidak bisa disimpan.
- Kapasitas `-5` → ditolak.
- Ubah R-01: Nama `Rak 1 depan` → tersimpan; kode tetap R-01.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Kapasitas | Diisi 100, tetapi tampil 100.000 | Tampilan kapasitas perlu diperbaiki; seharusnya 100 |
| Status rak di daftar | Tidak ada tombol aktif/nonaktif di daftar rak | Tambahkan tombol aktif/nonaktif di daftar supaya status rak mudah diubah |
| Kapasitas 0 | Kapasitas 0 tetap bisa disimpan | Perlu batas minimum dan maksimum kapasitas |
| | | |
| | | |
| | | |

### A11 ⚠️. Pembelian membuka halaman Produk

Login `purchasing_seed`, buka **Inventaris → Produk**.\
**Temuan yang diperkirakan:** muncul "Pengelolaan inventaris hanya tersedia untuk administrator aplikasi", padahal role Pembelian punya hak buat/ubah barang. Keputusan B3 di `bahan-keputusan.md`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## B. Pemasok (login `purchasing_seed`)

### B1. Buat pemasok (semua kolom)

Menu **Inventaris → Pengadaan → Pemasok** → tombol **Pemasok baru**.

| Isian                   | Isi dengan                                             |
| ----------------------- | ------------------------------------------------------ |
| Kode                    | **kosongkan** (dibuat otomatis)                        |
| Jenis *(cek pilihan)*   | Perusahaan / Instansi pemerintah; pilih **Perusahaan** |
| Nama                    | `PT Sumber Kabel UAT`                                  |
| Nama resmi              | `PT Sumber Kabel Nusantara`                            |
| NPWP                    | `0123456789012345`                                     |
| Situs web               | `https://sumberkabel.test`                             |
| Alamat email            | `sales@sumberkabel.test`                               |
| Telepon                 | `81234567890` (kode negara +62)                        |
| WhatsApp                | `81234567891`                                          |
| Tempo pembayaran (hari) | `30`                                                   |
| Baris pembayaran bawaan | `DP 50%, pelunasan sebelum kirim`                      |
| Bank                    | `BCA`                                                  |
| Nomor rekening          | `1234567890`                                           |
| Atas nama               | `PT Sumber Kabel UAT`                                  |
| Catatan                 | `Pemasok kabel utama`                                  |

**Uji salah** (sebelum menyimpan):

- Kosongkan Nama → tidak bisa disimpan.
- NPWP diisi huruf → ditolak atau tidak bisa diketik.
- Alamat email `salah-email` → ditolak.
- Tempo pembayaran `400` → ditolak (maksimal 365).
- Kode `a` (1 huruf) → ditolak (2–32 huruf/angka).

**Klik:** Simpan.\
**Harus terlihat:** "Pemasok disimpan"; kode terisi otomatis; di detail semua isian tampil, termasuk bagian Rekening bank.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| NPWP | Bisa diisi huruf | Seharusnya hanya angka |
| Telepon | Bisa diisi huruf dan tidak ada batas panjang | Seharusnya hanya angka, dengan batas panjang |
| WhatsApp | Bisa diisi huruf dan tidak ada batas panjang | Seharusnya hanya angka, dengan batas panjang |
| Tempo pembayaran (hari) | Bisa diisi huruf, dan tidak ada penjelasan arti angkanya | Seharusnya hanya angka, dengan keterangan yang jelas (misalnya "jumlah hari sampai jatuh tempo") |
| Bank | Tidak jelas wajib atau opsional; isiannya teks bebas | Sebaiknya berupa dropdown daftar bank, dengan tanda wajib/opsional yang jelas |
| Nomor rekening | Bisa diisi huruf | Seharusnya hanya angka, dengan batas panjang |
| | | |
| | | |
| | | |

### B2. Kode pemasok manual dan ganda

1. **Pemasok baru** → Kode `hit` (huruf kecil), Jenis **Instansi pemerintah**, Nama `Dinas Uji UAT` → Simpan. Kode tampil sebagai `HIT`.

2. **Pemasok baru** → Kode `HIT`, Nama `Duplikat UAT` → ditolak "Kode pemasok HIT sudah dipakai".

- [x] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Tambah kontak

Detail PT Sumber Kabel UAT → kartu **Kontak** → **Tambah kontak**.

| Isian                                         | Isi dengan              |
| --------------------------------------------- | ----------------------- |
| Kontak (PIC)                                  | `Budi Santoso`          |
| Jabatan PIC                                   | `Sales`                 |
| Telepon PIC                                   | `81298765432`           |
| Email PIC                                     | `budi@sumberkabel.test` |
| Kontak utama (dicetak pada pesanan pembelian) | dicentang               |

**Uji salah:** Kontak (PIC) kosong → Simpan tidak bisa diklik; Email PIC `budi@` → ditolak.

**Klik:** Simpan.\
**Harus terlihat:** "Kontak ditambahkan"; Budi Santoso tampil sebagai kontak utama. Tambah kontak kedua `Sari UAT` lalu **Hapus** → hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Telepon PIC | Tampilan kolom tidak rapi; bisa diisi huruf dan tanpa batas panjang | Buat kolomnya selebar form (satu kolom) supaya nomor terlihat utuh; hanya angka, dengan batas panjang |
| | | |
| | | |
| | | |

### B4. Ubah pemasok

Di detail PT Sumber Kabel UAT klik **Ubah**. Ubah Tempo pembayaran menjadi `45` dan Catatan menjadi `Pemasok kabel utama (diubah)` → Simpan.\
**Harus terlihat:** tersimpan; setelah F5 nilainya tetap. Kembalikan Tempo ke `30`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Kode pemasok saat Ubah | Kode bisa diubah dan menjadi wajib diisi | Kode seharusnya terkunci (tidak bisa diubah) setelah pemasok dibuat |
| | | |
| | | |
| | | |

### B5. Keuangan hanya melihat

Login `finance_seed`. Menu **Inventaris → Pengadaan → Pemasok** → klik PT Sumber Kabel UAT.\
**Harus terlihat:** semua data dan Rekening bank terlihat; **tidak ada** tombol Ubah, Aktifkan/Nonaktifkan, atau Tambah kontak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Petunjuk langkah | Tidak jelas di menu mana pemasok dibuka untuk akun Keuangan | Langkah perlu menyebut menunya dengan jelas (sudah diperbaiki di checklist) |
| | | |
| | | |
| | | |

***

## C. Permintaan Pembelian (PR)

### C1. Teknisi membuat PR (login `technician_seed`)

Menu **Inventaris → Pengadaan → Permintaan Pembelian** → **Permintaan pembelian baru**.

Kartu **Permintaan**:

| Isian              | Isi dengan                            |
| ------------------ | ------------------------------------- |
| Yang dibutuhkan    | `Material instalasi kantor klien UAT` |
| Alasan kebutuhan   | `Pemasangan 5 titik CCTV`             |
| Proyek             | `UAT Proyek A`                        |
| Tanggal permintaan | hari ini (bawaan)                     |
| Dibutuhkan tanggal | 7 hari dari hari ini                  |

Kartu **Barang yang diminta**:

Baris 1, dari kotak **Tambah barang dari inventaris** (ketik `UAT-KBL`, pilih Kabel UTP Cat6 UAT):

| Isian                             | Isi dengan                 |
| --------------------------------- | -------------------------- |
| Spesifikasi                       | `Warna abu-abu`            |
| Jumlah (unit)                     | `5`                        |
| Perkiraan harga satuan (Rp)       | terisi `1.000.000` sendiri |
| Perkiraan total                   | tampil Rp 5.000.000        |
| Catatan (dicetak di bawah syarat) | `Untuk 5 titik`            |

Baris 2, klik **Tambah barang yang belum ada di daftar**:

| Isian                       | Isi dengan      |
| --------------------------- | --------------- |
| Nama barang                 | `Konektor RJ45` |
| Satuan                      | `pcs`           |
| Spesifikasi                 | `Cat6, isi 2`   |
| Jumlah (unit)               | `2`             |
| Perkiraan harga satuan (Rp) | `50000`         |
| Catatan                     | kosongkan       |

**Uji salah:**

- Dibutuhkan tanggal lebih awal dari Tanggal permintaan → tidak bisa dipilih atau ditolak.
- Baris 2 dengan Nama barang kosong → ditolak.
- Jumlah `0` → ditolak.
- Hapus semua baris → Simpan tidak bisa diklik (lalu tambahkan lagi).

**Klik:** Simpan.\
**Harus terlihat:** "Permintaan pembelian disimpan"; status **Draf**, belum bernomor; Perkiraan total **Rp 5.100.000**; semua isian tampil di detail.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Spesifikasi barang dari inventaris | Tidak ada kolom Spesifikasi pada baris barang yang dipilih | Perlu kolom Spesifikasi |
| Satuan barang yang belum ada di daftar | Satuan berupa teks bebas | Seharusnya dropdown pilihan satuan |
| | | |
| | | |
| | | |

### C2. Ubah lalu ajukan

Di detail PR klik **Ubah**, ubah Alasan kebutuhan menjadi `Pemasangan 5 titik CCTV lantai 2` → Simpan. Lalu klik **Ajukan persetujuan**.\
**Harus terlihat:** perubahan tersimpan; nomor `…/PR/…` muncul; status **Menunggu persetujuan**; tombol Ubah hilang; tidak ada tombol Setujui, dan ada tulisan "Anda yang membuat permintaan ini, jadi orang lain yang harus menyetujuinya."

- [x] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Manajer menolak (login `operations_manager_seed`)

Buka PR → **Tolak**. Coba klik **Simpan** dengan **Alasan** kosong → ditolak. Isi Alasan `Tambahkan jumlah kabel cadangan` → **Simpan**.\
**Harus terlihat:** status kembali **Draf**; tampil "Alasan dikembalikan: Tambahkan jumlah kabel cadangan".

- [x] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Ajukan lagi dan setujui

`technician_seed`: buka PR → **Ajukan persetujuan**. `operations_manager_seed`: buka PR → **Setujui**.\
**Harus terlihat:** status **Disetujui**. Lalu login `purchasing_seed` dan buka PR yang sama: ada tombol **Buat purchase order** (tombol ini memang tidak tampil untuk Teknisi dan Manajer Operasional).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Tombol Buat purchase order | Tombol tidak terlihat; hanya status yang tampil | Tombol perlu ditampilkan. Perlu dicek ulang dengan akun `purchasing_seed` (lihat langkah C4) |
| | | |
| | | |
| | | |

### C5. Batalkan PR

`technician_seed`: buat PR baru `PR batal UAT` dengan 1 baris Kabel qty 1 → Simpan → **Batalkan permintaan** → isi Alasan `Tidak jadi` → Simpan.\
**Harus terlihat:** status **Dibatalkan**; PR ini tidak muncul sebagai baris yang bisa dipesan di PO.

- [x] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## D. Purchase Order dan Penerimaan Barang

### D1. Buat PO dari PR (login `purchasing_seed`, semua kolom)

Menu **Inventaris → Pengadaan → Pesanan Pembelian** → **Purchase order baru**.

Kartu **Pesanan**:

| Isian                                | Isi dengan                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Cari pemasok / Pemasok               | ketik `Sumber`, pilih *PT Sumber Kabel UAT*                                   |
| Kontak pemasok (PIC) *(cek pilihan)* | ada "Tanpa kontak" dan Budi Santoso; pilih **Budi Santoso**                   |
| Kategori *(cek pilihan)*             | Perangkat keras / Perangkat lunak / Jasa / Lainnya; pilih **Perangkat keras** |
| Perihal                              | `Pembelian material UAT Proyek A`                                             |
| Tanggal order                        | hari ini (bawaan)                                                             |
| Perkiraan kirim                      | 3 hari dari hari ini                                                          |
| No. penawaran pemasok                | `SQ-UAT-001`                                                                  |
| Tgl. penawaran pemasok               | kemarin                                                                       |
| Proyek                               | `UAT Proyek A`                                                                |
| PIC kami                             | `Andi Purchasing`                                                             |

Kartu **Barang**:

1. Klik **Pilih baris yang disetujui**, lalu klik baris *Kabel UTP Cat6 UAT* dan *Konektor RJ45* dari PR C4 (keduanya berlabel "Dari …"). PR C5 yang dibatalkan tidak ada.

2. Pada baris Konektor RJ45, kolom **Hubungkan baris ini ke barang di master**: ketik `UAT-MAT`, pilih *Konektor RJ45 UAT*.

3. Kotak **Tambah barang dari inventaris**: ketik `UAT-CAM`, pilih *Kamera IP UAT*. Jumlah (unit) `2`, Harga satuan `1800000`, Spesifikasi `2 MP, outdoor`.

Kartu **PPN dan syarat**:

| Isian                             | Isi dengan                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| PPN *(cek pilihan)*               | Tanpa PPN / Harga sudah termasuk PPN (bawaan) / PPN ditambahkan; pilih **PPN ditambahkan** |
| Tarif PPN (%)                     | `11`                                                                                       |
| Pembayaran                        | kosongkan (diambil dari pemasok)                                                           |
| Syarat pembelian lainnya          | dua baris: `Garansi 1 tahun` dan `Barang dikirim ke gudang WH-MAIN`                        |
| Catatan (dicetak di bawah syarat) | `Hubungi PIC sebelum kirim`                                                                |

**Cek perhitungan:**

- Pilih PPN **Tanpa PPN** → Total = Subtotal Rp 8.700.000.
- Pilih **Harga sudah termasuk PPN** → Total tetap Rp 8.700.000 (PPN dihitung di dalamnya).
- Pilih **PPN ditambahkan** → Subtotal **Rp 8.700.000**, PPN **Rp 957.000**, Total **Rp 9.657.000** (Kabel 5 × 1.000.000 + Konektor 2 × 50.000 + Kamera 2 × 1.800.000).

**Uji salah:**

- Selama baris Konektor belum dihubungkan → Simpan tidak bisa diklik, pesan "Hubungkan setiap baris ke barang sebelum menyimpan."
- Tanpa pemasok → Simpan tidak bisa diklik.
- Tarif PPN `150` → ditolak.

**Klik:** Simpan.\
**Harus terlihat:** "Purchase order disimpan"; status **Draf**, "Belum bernomor"; semua isian tampil di detail.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Kotak Cari pemasok | Tidak menampilkan data apa pun | Hapus kotak ini; cukup satu kolom Pemasok yang bisa dicari |
| Pilih pemasok | Pemasok sulit dicari bila jumlahnya banyak | Ganti dengan dropdown yang bisa dicari (search dropdown) |
| | | |
| | | |
| | | |

### D2. Ubah lalu ajukan

Klik **Ubah**, ganti Perkiraan kirim menjadi 4 hari dari hari ini → Simpan. Lalu **Ajukan persetujuan**.\
**Harus terlihat:** perubahan tersimpan; status **Menunggu persetujuan**; tidak ada tombol Setujui; ada tulisan "Anda yang membuat purchase order ini, jadi persetujuannya harus oleh orang lain."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Pemilihan pemasok | Sama seperti D1: kotak Cari pemasok kosong dan pemasok sulit dicari | Lihat D1 |
| | | |
| | | |
| | | |

### D3. Manajer menyetujui (login `operations_manager_seed`)

Buka PO → coba **Tolak** dengan Alasan kosong → ditolak; klik **Batal**. Lalu **Setujui**.\
**Harus terlihat:**

- Nomor `PO/…/…/MMYY/…`; status **Disetujui**.
- Petunjuk "Sudah disetujui. Tandai terkirim setelah PO dikirim ke pemasok…".
- Buka PR C4: status **Sudah dipesan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| Klik Setujui | Muncul error `Unexpected token 'F', "Failed que"... is not valid JSON`, dan PO tidak bisa disetujui | Perlu diperbaiki supaya PO bisa disetujui. Langkah D4 dan seterusnya tertahan |
| | | |
| | | |
| | | |

### D4. Gudang belum bisa menerima (login `warehouse_seed`)

Menu **Inventaris → Pengadaan → Penerimaan Barang** → **Terima barang** → buka pilihan **Nomor PO**.\
**Harus terlihat:** PO D3 **belum** ada, dengan teks "Tidak ada purchase order terkirim yang menunggu barang. PO yang sudah disetujui baru muncul di sini setelah bagian Pembelian menandainya terkirim." (Bila ada PO lain dari data contoh, cukup pastikan PO D3 tidak ada.)

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. Tandai terkirim dan cetak (login `purchasing_seed`)

Buka PO → **Tandai terkirim** → **Cetak**.\
**Harus terlihat:** status **Terkirim ke pemasok**; halaman cetak berisi pemasok, kontak Budi Santoso, No. dan Tgl. penawaran pemasok, Proyek, PIC kami, 3 barang dengan spesifikasinya, PPN, total Rp 9.657.000, syarat "DP 50%, pelunasan sebelum kirim", dua syarat lainnya, dan catatan. Tombol **Cetak** membuka dialog cetak browser; **Kembali ke purchase order** kembali ke detail.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6 🔧. Nomor seri wajib satu per unit (login `warehouse_seed`)

**Penerimaan Barang → Terima barang**.

Kartu **Penerimaan**:

| Isian                              | Isi dengan                                              |
| ---------------------------------- | ------------------------------------------------------- |
| Nomor PO                           | PO D3                                                   |
| Gudang                             | WH-MAIN                                                 |
| Lokasi penyimpanan *(cek pilihan)* | ada "Tanpa lokasi penyimpanan" dan R-01; pilih **R-01** |
| Tanggal terima                     | hari ini                                                |
| Surat jalan pemasok                | `SJ-SK-001`                                             |

Kartu **Barang yang datang**:

| Barang             | Jumlah diterima | Nomor seri                             | Catatan           |
| ------------------ | --------------- | -------------------------------------- | ----------------- |
| Kabel UTP Cat6 UAT | `3`             | —                                      | `Datang sebagian` |
| Konektor RJ45 UAT  | kosongkan       | —                                      |                   |
| Kamera IP UAT      | `2`             | `CAM-UAT-001` (**sengaja hanya satu**) |                   |

**Harus terlihat sebelum klik:** kolom Nomor seri **tidak** bertanda opsional, dengan petunjuk "Wajib: tepat satu nomor seri per unit yang diterima…".\
**Klik:** Posting penerimaan.\
**Harus terlihat:** ditolak dengan pesan "Baris N: isi satu nomor seri unik per unit". Tidak ada BPB yang tersimpan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D7. Terima sebagian

Di form yang sama, ubah Nomor seri kamera menjadi dua baris:

```javascript
CAM-UAT-001
CAM-UAT-002
```

Coba juga isi dua nomor yang sama (`CAM-UAT-001` dua kali) → ditolak. Kembalikan ke dua nomor berbeda.\
**Klik:** Posting penerimaan.\
**Harus terlihat:** "Penerimaan barang diposting"; nomor BPB `…/BPB/…`; PO **Diterima sebagian**; di detail BPB ada surat jalan pemasok SJ-SK-001 dan catatan "Datang sebagian".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D8. Terima sisanya (tanpa rak)

**Terima barang** lagi, Nomor PO = PO D3.

| Isian               | Isi dengan                                        |
| ------------------- | ------------------------------------------------- |
| Gudang              | WH-MAIN                                           |
| Lokasi penyimpanan  | **Tanpa lokasi penyimpanan** (dipakai lagi di F1) |
| Tanggal terima      | hari ini                                          |
| Surat jalan pemasok | `SJ-SK-002`                                       |
| Kabel UTP Cat6 UAT  | `2` (sisa 2)                                      |
| Konektor RJ45 UAT   | `2`                                               |
| Kamera IP UAT       | tidak bisa diisi (sudah lengkap)                  |

**Uji salah:** isi Kabel `3` → tidak diizinkan melebihi sisa. Kembalikan ke `2`.\
**Klik:** Posting penerimaan.\
**Harus terlihat:** PO berstatus **Diterima**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D9. Stok dan mutasi

Menu **Inventaris → Barang → Stok**, lalu **Mutasi Barang**.\
**Harus terlihat:**

- Stok WH-MAIN: Kabel 3 (R-01) + 2 (tanpa rak), Kamera 2 (R-01), Konektor 2 (tanpa rak).
- Mutasi: ada baris masuk dari kedua BPB.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D10 ⚠️. Pembelian membatalkan PO

`purchasing_seed`: buat PO baru (pemasok PT Sumber Kabel UAT, 1 barang), simpan sebagai Draf, lalu cari tombol **Batalkan order**.\
**Temuan yang diperkirakan:** tombol tidak ada; hanya Pemilik yang bisa membatalkan PO. Keputusan B2. Login `admin`, buka PO itu → **Batalkan order** → isi Alasan → status **Dibatalkan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D11 ⚠️. Gudang membuka PO dari BPB

`warehouse_seed`: buka detail BPB D7 → klik link nomor PO.\
**Temuan yang diperkirakan:** ditolak, karena Gudang tidak punya hak baca PO. Keputusan B4.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## E. Retur Pembelian

### E1. Buat retur (login `purchasing_seed`)

Menu **Inventaris → Pengadaan → Retur Pembelian** → **Retur barang**.

| Isian                               | Isi dengan                       |
| ----------------------------------- | -------------------------------- |
| Nomor penerimaan                    | BPB D7                           |
| Tanggal retur                       | hari ini                         |
| Alasan                              | `Lensa kamera retak saat datang` |
| Kamera IP UAT → Nomor seri          | centang **CAM-UAT-002** saja     |
| Kamera IP UAT → Catatan             | `Retak di lensa`                 |
| Kabel UTP Cat6 UAT → Jumlah diretur | kosongkan                        |

**Uji salah:**

- Alasan kosong → Simpan draf tidak bisa diklik.
- Kabel Jumlah diretur `5` (lebih dari yang bisa diretur) → ditolak. Kosongkan lagi.

**Klik:** Simpan draf.\
**Harus terlihat:** "Retur pembelian disimpan"; status **Draf**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2. Ubah, ajukan, setujui

`purchasing_seed`: **Ubah** → Alasan menjadi `Lensa kamera retak saat datang (foto terlampir di WA)` → Simpan → **Ajukan persetujuan**. Pastikan tidak ada tombol Setujui untuk pembuat. `operations_manager_seed`: buka retur → **Setujui**.\
**Harus terlihat:** nomor `…/RTB/…`; status **Disetujui**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3. Kirim ke pemasok (login `warehouse_seed`)

Buka retur → **Kirim ke pemasok** → dialog "Kirim ke pemasok": **Tanggal kirim** hari ini → klik **Kirim ke pemasok**.\
**Harus terlihat:**

- Status **Dikirim ke pemasok**, dengan tulisan "Sudah dikirim: barang keluar dari stok dan PO menunggu barang pengganti."
- Stok Kamera tinggal 1.
- PO D3 kembali **Diterima sebagian**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4. Terima barang pengganti

**Penerimaan Barang → Terima barang**. Nomor PO = PO D3, Gudang WH-MAIN, Lokasi R-01, Surat jalan pemasok `SJ-SK-003`, Kamera IP UAT jumlah `1`, Nomor seri `CAM-UAT-003`. Klik **Posting penerimaan**.\
**Harus terlihat:** PO kembali **Diterima**; stok Kamera 2.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E5. Batalkan retur

`purchasing_seed`: buat retur baru dari BPB D8 (Konektor jumlah `1`, Alasan `Uji batal`) → Simpan draf → **Batalkan retur** → isi Alasan → Simpan.\
**Harus terlihat:** status **Dibatalkan**; stok Konektor tidak berubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## F. Penyesuaian Stok dan nilai persediaan

### F1 🔧. Buat penyesuaian hitung ulang (login `warehouse_seed`, semua kolom)

Menu **Inventaris → Barang → Stok** → **Sesuaikan stok**.

Kartu **Detail penyesuaian**:

| Isian                  | Isi dengan                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| Gudang                 | WH-MAIN                                                                     |
| Alasan *(cek pilihan)* | Hitung ulang fisik / Penambahan / Pengurangan; pilih **Hitung ulang fisik** |
| Kode alasan            | ketik `hitung_bulanan` (ada saran "Stok awal" di daftar, jangan dipilih)    |
| Catatan                | `Hitung fisik akhir bulan UAT`                                              |

Kartu **Baris**, baris pertama (barang di rak):

| Isian                       | Isi dengan                                                                  |
| --------------------------- | --------------------------------------------------------------------------- |
| Barang                      | ketik `UAT-KBL` (dicari ke server), pilih *UAT-KBL-01 — Kabel UTP Cat6 UAT* |
| Penyimpanan *(cek pilihan)* | ada "Belum ditentukan" dan R-01; pilih **R-01**                             |
| Sistem                      | harus menunjukkan `3.000` (hasil D7)                                        |
| Hasil hitung                | `2` (jumlah total hasil hitung, **bukan** selisih)                          |
| Harga pokok per unit (Rp)   | tidak tampil untuk Gudang (hanya untuk yang boleh melihat HPP)              |
| Catatan                     | `1 roll rusak`                                                              |

Klik **Tambah baris**, lalu baris kedua (barang tanpa rak):

| Isian        | Isi dengan                                 |
| ------------ | ------------------------------------------ |
| Barang       | ketik `UAT-MAT`, pilih *Konektor RJ45 UAT* |
| Penyimpanan  | **Belum ditentukan** (bawaan)              |
| Sistem       | harus menunjukkan `2.000` (hasil D8)       |
| Hasil hitung | `1`                                        |
| Catatan      | `1 pcs hilang`                             |

Klik **Tambah baris** sekali lagi, lalu **Hapus** baris ketiga itu.

**Uji lain:**

- Ganti Gudang ke gudang lain lalu kembali ke WH-MAIN → Penyimpanan di semua baris kembali "Belum ditentukan"; pilih lagi R-01 di baris pertama.
- Dua baris dengan barang dan penyimpanan yang sama → ditolak saat disimpan.

**Harus terlihat sebelum klik:** Selisih **−1.000** di kedua baris.\
**Klik:** Buat penyesuaian (saat menyimpan tombol berbunyi "Membuat…").\
**Harus terlihat:** langsung pindah ke halaman detail dengan nomor `…/ADJ/…`, status **Draf**, Kode alasan hitung_bulanan, catatan, dan dua baris dengan Sistem 3 dan 2. *(diperbaiki 2026-11-25: Penyimpanan sekarang daftar rak, Sistem membaca saldo rak, Barang dicari ke server, nomor langsung terlihat)*

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Ajukan

Di detail penyesuaian F1 → **Ajukan persetujuan**.\
**Harus terlihat:** status **Diajukan**; tulisan "Anda yang mengajukan penyesuaian ini, jadi orang lain harus menyetujuinya."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Setujui dan catat (login `operations_manager_seed`)

Buka penyesuaian → **Setujui** → **Catat ke stok**.\
**Harus terlihat:** status **Tercatat**; di Stok, Kabel UTP Cat6 UAT di R-01 tinggal 2 dan Konektor RJ45 UAT tinggal 1; di Mutasi Barang ada dua baris keluar dari penyesuaian ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F4 ❓. Pemilik menyetujui penyesuaiannya sendiri (login `admin`)

Buat penyesuaian dengan Alasan **Penambahan**, Kode alasan pilih saran **Stok awal**, barang Konektor RJ45 UAT, Penyimpanan Belum ditentukan, Hasil hitung = Sistem + 1, **Harga pokok per unit (Rp)** `50000` (tampil untuk Pemilik). Lalu **Ajukan persetujuan** → **Setujui** → **Catat ke stok** sendiri.\
**Yang terjadi sekarang:** berhasil. Pemegang hak setuju boleh menyetujui miliknya sendiri. Ini disengaja di kode, tapi bertentangan dengan ADR-0006. Keputusan A1 di `bahan-keputusan.md`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F5. Tolak dan batalkan penyesuaian

1. `warehouse_seed`: buat penyesuaian (Alasan **Pengurangan**, Konektor, Hasil hitung = Sistem − 1) → **Ajukan persetujuan**. `operations_manager_seed`: **Tolak** → status **Ditolak**; stok tidak berubah.

2. `warehouse_seed`: buat penyesuaian lain → biarkan Draf → **Batalkan** → status **Dibatalkan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F6 🔧. Admin organisasi tidak melihat tombol penyesuaian (login `admin_seed`)

Buka **Penyesuaian Stok** (daftar dan salah satu detail), **Stok**, dan **Mutasi Barang**.\
**Harus terlihat:** tombol Penyesuaian baru, Ajukan persetujuan, Setujui, Catat ke stok, Sesuaikan stok, Hitung ulang, dan Balik **tidak tampil**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F7 🔧. Menu Nilai Persediaan

`warehouse_seed`: menu **Inventaris → Nilai Persediaan** harus **tidak tampil**. `finance_seed`: menu tampil dan datanya termuat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F8. Keuangan melihat harga pokok (login `finance_seed`)

Buka **Stok**, lalu detail BPB D7.\
**Harus terlihat:** HPP/harga pokok terlihat (Kabel Rp 1.000.000, Kamera Rp 1.800.000).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F9 🔧. Detail penyesuaian menampilkan nama (login `warehouse_seed`)

Buka detail penyesuaian F1.\
**Harus terlihat:** kolom Barang berisi nama + SKU (Kabel UTP Cat6 UAT, Konektor RJ45 UAT), bukan deretan kode acak; Diajukan oleh dan Disetujui oleh berisi nama orang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 46 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M05:** lulus / belum lulus (coret salah satu)

Catatan penguji:
