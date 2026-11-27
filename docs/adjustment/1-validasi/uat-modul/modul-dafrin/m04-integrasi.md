# UAT M04 - Integrasi: n8n, WhatsApp, Katalog Website (sebagian T14, T15)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** event ERP ke n8n → FAQ dan chat WhatsApp AI → katalog website (admin ERP sampai tampil di website).

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, dan saringan daftar. Jalankan **setelah** M05 dan M02: event n8n berasal dari langkah UAT sebelumnya, dan katalog memakai barang dari M05. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan, 🔌 **butuh layanan luar** (lihat Persiapan; bila layanan belum tersedia, jangan centang dan tulis `Lewati` di kolom Yang terjadi).

**Keterbatasan lingkungan dev:**

- n8n, WAHA (WhatsApp), dan penyedia AI **tidak terpasang**.
- Event n8n tetap tersimpan dan bisa dicek di daftar. Tanpa n8n, statusnya tetap **Menunggu**.
- WhatsApp hanya bisa diuji sebagian. Chat masuk butuh WAHA. Seeder tidak membuat chat contoh, jadi tanpa WAHA daftar chat kosong.
- Yang terhubung ke ERP hanya WAHA. Jalur Meta Cloud API hanya ada di workflow n8n, belum untuk chat masuk ERP.
- Website di mode dev memakai **data contoh**, bukan data ERP, kecuali diatur seperti di bawah.
- Beberapa penolakan di bawah memakai pesan bawaan browser (misalnya "Nilai harus kurang dari atau sama dengan 10000" atau "Harap sesuaikan dengan format yang diminta"). Bunyinya tergantung bahasa browser; yang penting form tidak terkirim.

**Persiapan (diatur oleh programmer, penguji cukup tahu namanya).** Isi variabel tidak boleh ditulis di dokumen ini.

| Untuk langkah | File | Nama variabel |
|---|---|---|
| A3 (kirim ke n8n) | `apps/backend/.env` | `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` |
| B7–B9 (chat masuk dan balasan) | `apps/backend/.env` | `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `WAHA_WEBHOOK_SECRET` |
| B7 (asisten menjawab) | `apps/backend/.env` | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` |
| C6–C8 (website membaca ERP) | `apps/web-landing/.env` | `WEB_DATA_SOURCE` = `erp`, `ERP_API_BASE_URL`, `ERP_API_TOKEN` |

`ERP_API_TOKEN` adalah kunci API website. Dibuat sekali dengan `bun run scripts/create-website-api-key.ts <organization-slug>` di `apps/backend`. Setelah mengubah `.env`, jalankan ulang `bun run dev`.

**Status:**

| Data | Status |
|---|---|
| Event n8n | Menunggu → Terkirim (atau Gagal) |
| Chat WhatsApp | Asisten → Perlu admin → Selesai (Kembalikan ke asisten: kembali ke Asisten) |
| FAQ | Aktif / Nonaktif |
| Listing katalog | Tersembunyi → Tampil (Sembunyikan: kembali Tersembunyi; Hapus: hilang dari daftar) |

**Data contoh yang dibuat selama UAT:**

| Data | Nilai |
|---|---|
| FAQ 1 | Pertanyaan `Berapa lama garansi kamera CCTV?` |
| FAQ 2 (untuk dihapus) | Pertanyaan `Apakah bisa survei lokasi?` |
| Listing 1 | Kabel UTP Cat6 UAT (`UAT-KBL-01`, dari M05, harga jual Rp 1.500.000), slug `kabel-utp-cat6-uat` |
| Barang uji slug ganda | Kamera IP UAT (`UAT-CAM-01`, dari M05) |
| Barang uji tanpa harga jual | Konektor RJ45 UAT (`UAT-MAT-01`, dari M05, harga jual tidak diisi) |
| Balasan admin | `Halo, kami bantu cek stoknya ya.` |

---

## A. Event n8n

### A1. Daftar event (login `admin`)

Menu **Integrasi → Webhook (n8n)**.
**Harus terlihat:**

- Judul halaman "Event n8n" dan keterangan "Event yang dikirim ERP ke webhook n8n…".
- Banner: "Webhook n8n belum diatur di server (N8N_WEBHOOK_URL dan N8N_WEBHOOK_SECRET). Event tetap disimpan dan bisa dikirim setelah diatur."
- Daftar event dari langkah UAT sebelumnya, misalnya **Lead baru**, **Invoice terbit**, **Pembayaran diterima**, **Tiket diperbarui**, **Retur pembelian diperbarui**. Kolom: Waktu, Event (nama event + kode di bawahnya), Data (nomor dokumen atau nama), Percobaan, Hasil terakhir.
- Hasil terakhir **Menunggu**. Yang terbaru di atas.
- Bila event lebih dari satu halaman, tombol halaman muncul di bawah tabel.

Bila n8n sudah diatur, yang tampil adalah tulisan "Terhubung ke webhook n8n", bukan banner.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Saring daftar

Di atas tabel ada dua pilihan.

| Isian | Isi dengan |
|---|---|
| Event *(cek pilihan)* | Semua event (bawaan), Lead baru, Invoice terbit, Pembayaran diterima, Lisensi segera berakhir, Tiket diperbarui, Chat WhatsApp diteruskan ke admin, Tindak lanjut lead jatuh tempo, Tindak lanjut penawaran jatuh tempo, Penawaran terkirim, Tagihan pemasok dicatat, Tagihan pemasok jatuh tempo, Retur pembelian diperbarui, Retur penjualan diperbarui; pilih **Lead baru** |
| Hasil terakhir *(cek pilihan)* | Semua status (bawaan), Menunggu, Terkirim, Gagal; pilih **Menunggu** |

**Harus terlihat:**

- Hanya event Lead baru yang Menunggu.
- Ganti Hasil terakhir ke **Terkirim**: tanpa n8n, daftar kosong dengan tulisan "Belum ada event.".
- Ganti Event ke **Retur pembelian diperbarui** dan Hasil terakhir ke **Semua status**: muncul event dari retur pembelian M05.
- Tekan F5: kedua saringan kembali ke "Semua event" dan "Semua status".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3 ⚠️. Kirim sekarang

Pada satu baris berstatus Menunggu, klik tombol titik tiga (⋮) di kolom paling kanan → **Kirim sekarang**.
**Harus terlihat:**

- Tanpa n8n: pesan merah "Belum terkirim: The n8n webhook is not configured". Status tetap **Menunggu**, angka Percobaan naik 1, dan alasan yang sama tampil kecil di bawah status.
- 🔌 Dengan n8n: pesan "Event terkirim", status **Terkirim**, dan menu ⋮ pada baris itu tidak lagi berisi Kirim sekarang.

**Temuan yang diperkirakan:** alasan tampil dalam bahasa Inggris di layar berbahasa Indonesia.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4 🔧. Admin organisasi dan Pemasaran membuka log

Login `admin_seed`, buka **Integrasi → Webhook (n8n)**. Lalu login `marketing_seed`, buka menu yang sama.
**Harus terlihat:**

- Untuk kedua akun, menu tampil dan daftar event terbaca *(diperbaiki 2026-11-24)*.
- `admin_seed`: menu ⋮ → **Kirim sekarang** ada.
- `marketing_seed`: **Kirim sekarang** tidak ada (hanya Admin/Pemilik).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. WhatsApp AI

### B1. Tambah FAQ, semua kolom (login `marketing_seed`)

Menu **Integrasi → WhatsApp AI (otomatisasi) → Basis Pengetahuan FAQ** → tombol **Tambah FAQ**. Judul form "Tambah FAQ".

| Isian | Isi dengan |
|---|---|
| Pertanyaan | `Berapa lama garansi kamera CCTV?` |
| Jawaban | `Garansi kamera CCTV 1 tahun untuk kerusakan pabrik. Klaim lewat admin kami.` (di bawahnya ada petunjuk "Tulis jawaban persis seperti yang boleh dibaca pelanggan…") |
| Kata kunci (opsional) | `garansi, jaminan, cctv` (petunjuk "Pisahkan dengan koma…") |
| Urutan (opsional) | `1` (bawaan `0`) |
| Aktif (boleh dipakai asisten) | dicentang (bawaan) |

**Uji salah** (sebelum menyimpan):

- Pertanyaan kosong, atau hanya spasi → tombol **Simpan** tidak bisa diklik. Sama bila Jawaban kosong.
- Urutan `-1` → browser menolak (nilai minimal 0).
- Urutan `10001` → browser menolak (nilai maksimal 10000).
- Urutan `1.5` → browser menolak (harus bilangan bulat).
- Pertanyaan lebih dari 300 huruf, Jawaban lebih dari 4000 huruf, Kata kunci lebih dari 500 huruf → tidak bisa diketik lebih panjang.

Kembalikan isian ke tabel di atas.
**Klik:** Simpan.
**Harus terlihat:** pesan "FAQ disimpan"; form tertutup; baris baru di daftar dengan Pertanyaan, Jawaban, dan Status **Aktif**.

Ulangi **Tambah FAQ** untuk FAQ 2: Pertanyaan `Apakah bisa survei lokasi?`, Jawaban `Bisa, survei lokasi gratis untuk area Jabodetabek.`, Kata kunci `survei, cek lokasi`, Urutan `2`, Aktif dicentang. Klik **Simpan** → "FAQ disimpan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Batal tidak menyimpan

Klik **Tambah FAQ**, isi Pertanyaan `FAQ batal UAT` dan Jawaban `Tidak boleh tersimpan`. Klik **Batal**. Ulangi, lalu tutup form dengan tombol silang (X) atau tombol Esc.
**Harus terlihat:** form tertutup tanpa pesan; tidak ada baris "FAQ batal UAT" di daftar, juga setelah F5.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Semua isian FAQ tersimpan (setelah F5)

Tekan F5 di halaman FAQ asisten. Lihat daftar, lalu baris FAQ 1 → ⋮ → **Ubah**.
**Harus terlihat:**

- Daftar memuat FAQ 1 dan FAQ 2 dengan kolom Pertanyaan, Jawaban (terpotong bila panjang), dan Status **Aktif**.
- Judul kolom bisa diklik untuk mengurutkan.
- Form Ubah FAQ 1 berisi persis: Pertanyaan, Jawaban, Kata kunci `garansi, jaminan, cctv`, Urutan `1`, Aktif dicentang. Klik **Batal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Ubah FAQ (dulu B2 bagian 1)

Baris FAQ 1 → ⋮ → **Ubah**. Judul form "Ubah". Semua kolom bisa diubah (tidak ada yang terkunci).

| Isian | Isi dengan |
|---|---|
| Pertanyaan | `Berapa lama garansi kamera CCTV dan NVR?` |
| Jawaban | `Garansi kamera CCTV dan NVR 1 tahun untuk kerusakan pabrik. Klaim lewat admin kami.` |
| Kata kunci (opsional) | `garansi, jaminan, cctv, nvr` |
| Urutan (opsional) | `3` |
| Aktif (boleh dipakai asisten) | **hilangkan centang** |

**Uji salah:** kosongkan Jawaban → **Simpan** tidak bisa diklik. Isi lagi.
**Klik:** Simpan.
**Harus terlihat:** "FAQ disimpan"; Pertanyaan dan Jawaban baru tampil; Status **Nonaktif**. Tekan F5, buka **Ubah** lagi: semua nilai baru tersimpan. Centang kembali **Aktif (boleh dipakai asisten)** → **Simpan** → Status **Aktif**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Hapus FAQ (dulu B2 bagian 2)

Baris FAQ 2 → ⋮ → **Hapus**.
**Harus terlihat:**

- Muncul pertanyaan "Hapus entri FAQ ini?" dengan tombol **Batal** dan **Konfirmasi**.
- Klik **Batal**: FAQ 2 tetap ada.
- Ulangi, klik **Konfirmasi**: pesan "FAQ dihapus"; FAQ 2 hilang dari daftar, juga setelah F5.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Daftar chat, banner, dan saringan (login `admin`)

Menu **Integrasi → WhatsApp AI (otomatisasi) → Percakapan**.
**Harus terlihat:**

- Judul "WhatsApp AI" dan tombol **FAQ asisten** di kanan atas.
- Banner berisi tiga baris (tanpa layanan luar):
  - "Kunci webhook WAHA (WAHA_WEBHOOK_SECRET) belum diatur di server: chat masuk ditolak."
  - "WAHA (WAHA_URL dan WAHA_API_KEY) belum diatur di server: balasan tidak bisa dikirim."
  - "Belum ada penyedia AI: semua chat diteruskan ke admin."
- Tombol saring: **Semua**, **Perlu admin** (terpilih bawaan), **Asisten**, **Selesai**. Bila ada chat, angka jumlah tampil di belakang nama status, misal "Perlu admin (2)".
- Kotak cari "Cari nama atau nomor". Ketik `0812` lalu `Budi`: daftar menyaring (tanpa chat: tetap kosong).
- Tanpa chat: tulisan "Belum ada chat.".
- 🔌 Bila ada chat: kolom Kontak (nama atau nomor, lalu `+62…`), Pesan terakhir, Status (dengan alasan di bawah status Perlu admin), Aktivitas terakhir.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7 🔌. Chat masuk dan asisten menjawab (dulu B4)

Butuh WAHA **dan** penyedia AI (lihat Persiapan). Dari HP lain, kirim WA ke nomor uji: `Berapa lama garansi kamera?`
**Harus terlihat:**

- Di **WhatsApp AI (otomatisasi)** → saring **Asisten**: chat dari nomor itu muncul.
- Asisten membalas memakai jawaban FAQ 1 (yang Aktif). FAQ Nonaktif tidak dipakai.
- Kirim lagi `Saya mau minta diskon`: chat pindah ke **Perlu admin** dengan alasan "Minta diskon, pembayaran, atau pesanan".
- Kirim `Saya mau bicara dengan orang`: alasan "Minta bicara dengan orang" (bila chat sudah Perlu admin, alasan tidak berubah).

Bila WAHA ada tapi AI belum diatur: chat langsung **Perlu admin** dengan alasan "Belum ada penyedia AI".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8 🔌. Balas sebagai admin (login `admin_seed`, dulu B5)

Butuh chat dari B7. Buka chat tersebut dari daftar (klik nama/nomor).
**Harus terlihat sebelum membalas:** tautan "← WhatsApp AI", nama/nomor kontak, label status, riwayat pesan dengan label pengirim (Pelanggan, Asisten, Admin, Balasan otomatis) dan waktunya; di bawah ada kolom **Balas sebagai admin** dengan petunjuk "Membalas berarti chat diambil alih: asisten diam sampai Anda mengembalikannya."

| Isian | Isi dengan |
|---|---|
| Balas sebagai admin | `Halo, kami bantu cek stoknya ya.` |

**Uji salah:**

- Kolom kosong atau hanya spasi → tombol **Kirim** tidak bisa diklik.
- Lebih dari 4000 huruf → tidak bisa diketik lebih panjang.

**Klik:** Kirim.
**Harus terlihat:** pesan "Pesan terkirim"; kolom balasan kosong lagi; balasan muncul di kanan dengan label **Admin**; status **Perlu admin**. Bila WAHA gagal mengirim: pesan merah "Belum terkirim: …" dan di bawah balasan ada "Gagal terkirim: …" dengan tombol **Kirim ulang**; klik **Kirim ulang** setelah WAHA normal → "Pesan terkirim".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9 🔌. Buat lead, kembalikan ke asisten, tutup chat (dulu B6)

Masih di chat B8:

1. Klik **Buat lead** → pesan "Lead dibuat di CRM (belum ditugaskan, sumber WhatsApp)"; tombol berubah menjadi **Buka lead**. Klik **Buka lead**: halaman lead terbuka, sumber WhatsApp. Kembali ke chat.
2. Klik **Kembalikan ke asisten** → pesan "Asisten kembali menjawab chat ini"; status **Asisten**; tombol Kembalikan ke asisten hilang.
3. Klik **Tutup chat** → pesan "Chat ditutup"; status **Selesai**; tombol Tutup chat hilang. Tidak ada pertanyaan konfirmasi.
4. Tekan F5: status Selesai, tombol Buka lead, dan semua pesan tetap ada.
5. Buka menu **Integrasi → Webhook (n8n)**: ada event **Lead baru** dan **Chat WhatsApp diteruskan ke admin**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B10 🔧. Customer service dan Manajer penjualan (dulu B7)

Login `customer_service_seed`, lalu `sales_manager_seed`. Buka **Integrasi → WhatsApp AI (otomatisasi) → Percakapan**.
**Harus terlihat:**

- Menu tampil; daftar chat terbaca *(diperbaiki 2026-11-24)*.
- Tombol **FAQ asisten** membuka daftar FAQ, tapi **tidak ada** tombol Tambah FAQ, dan menu ⋮ tidak berisi Ubah atau Hapus.
- 🔌 Bila ada chat: bisa membuka chat, mengisi **Balas sebagai admin**, dan melihat tombol Buat lead / Kembalikan ke asisten / Tutup chat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B11. Pemasaran tidak bisa membalas chat (login `marketing_seed`)

Buka **Integrasi → WhatsApp AI (otomatisasi) → Percakapan**.
**Harus terlihat:**

- Daftar chat dan banner terbaca; tombol **FAQ asisten** membuka FAQ dengan tombol **Tambah FAQ**.
- 🔌 Bila ada chat: detail chat terbuka, tapi **tidak ada** kolom Balas sebagai admin, tombol Kirim, Buat lead, Kembalikan ke asisten, maupun Tutup chat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Katalog Website

### C1. Tambah listing, semua kolom (login `marketing_seed`)

Menu **Integrasi → Katalog Website** → tombol **Tampilkan barang**. Judul form "Tampilkan barang". (Tombol ini hanya membuka form; listing baru belum tampil di website.) Foto, nama, kategori, harga, dan stok tidak diisi di sini: semuanya diambil dari data barang.

| Isian | Isi dengan |
|---|---|
| Barang: kotak "Cari dan pilih barang" | ketik `UAT-KBL` |
| Barang: pilihan di bawahnya *(cek pilihan)* | "—" (bawaan) lalu barang aktif yang cocok, format `SKU — Nama`; pilih **UAT-KBL-01 — Kabel UTP Cat6 UAT** |
| Alamat di website (slug) | terisi sendiri `kabel-utp-cat6-uat`; biarkan (petunjuk "Huruf kecil, angka, dan tanda strip…") |
| Spesifikasi di kartu produk (opsional) | `Cat6, 305 m per roll` (petunjuk "Satu baris singkat; kosong memakai spesifikasi barang.") |
| Harga di website *(cek pilihan)* | Tampilkan harga jual (bawaan), Minta penawaran (tanpa harga); pilih **Tampilkan harga jual** |
| Keterangan harga (opsional) | `Harga per roll` |
| Saat stok habis *(cek pilihan)* | Tampilkan "stok habis", Boleh pre-order, Tersedia atas permintaan (bawaan); pilih **Tampilkan "stok habis"** |
| Label waktu tunggu (opsional) | `3-5 hari kerja` |
| Kegunaan (opsional) | `Perkantoran, Perumahan` (petunjuk "Pisahkan dengan koma…") |
| Bobot popularitas (opsional) | `10` (bawaan `0`) |

**Uji salah** (sebelum menyimpan; kembalikan nilai setelah tiap uji):

- Barang "—" atau slug kosong → tombol **Simpan** tidak bisa diklik.
- Slug `Kabel UTP`: huruf besar langsung jadi kecil; spasi membuat browser menolak (format tidak sesuai). Slug `kabel--utp` atau `-kabel` → browser menolak.
- Slug `k` (satu huruf) → lolos browser, ditolak server. ⚠️ Pesan yang diperkirakan berbahasa Inggris, misal "Too small: …".
- Bobot popularitas `-1` → browser menolak. `2000000` → ditolak server (maksimal 1.000.000). ⚠️ Pesan berbahasa Inggris, misal "Too big: …".
- Kegunaan berisi satu kata lebih dari 80 huruf → ditolak server, pesan berbahasa Inggris (⚠️).
- Spesifikasi lebih dari 400 huruf, Keterangan harga lebih dari 120, Label waktu tunggu lebih dari 60, slug lebih dari 120 → tidak bisa diketik lebih panjang.

**Klik:** Simpan.
**Harus terlihat:** pesan "Listing disimpan"; form tertutup; baris Kabel UTP Cat6 UAT (SKU di bawah nama), slug `kabel-utp-cat6-uat`, Harga **Rp 1.500.000**, Saat stok habis "Tampilkan "stok habis"", Di website **Tersembunyi**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Batal tidak menyimpan

Klik **Tampilkan barang**, pilih *UAT-CAM-01 — Kamera IP UAT* (slug terisi `kamera-ip-uat`). Klik **Batal**. Ulangi lalu tutup dengan Esc.
**Harus terlihat:** form tertutup tanpa pesan; Kamera IP UAT **tidak** muncul di daftar Katalog Website, juga setelah F5.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3 ⚠️. Uji salah setelah tersimpan: slug ganda dan barang tanpa harga jual

1. **Tampilkan barang** → pilih *UAT-CAM-01 — Kamera IP UAT* → ganti slug menjadi `kabel-utp-cat6-uat` → **Simpan**. Harus ditolak dengan pesan "Slug ini sudah dipakai listing lain". Klik **Batal**.
2. **Tampilkan barang** → ketik `UAT-MAT` → pilih *UAT-MAT-01 — Konektor RJ45 UAT* → Harga di website **Tampilkan harga jual** → **Simpan**. Harus ditolak dengan pesan "Barang belum punya harga jual; gunakan harga lewat penawaran". Klik **Batal**.

**Temuan yang diperkirakan:** di pilihan Barang ikut muncul bahan dan komponen (misal Konektor RJ45 UAT, Modul relay UAT), bukan hanya produk. Barang yang sudah punya listing (Kabel UTP Cat6 UAT) juga masih bisa dipilih; menyimpannya menimpa listing lama tanpa peringatan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Semua isian listing tersimpan, lalu Ubah (setelah F5)

Tekan F5. Baris Kabel UTP Cat6 UAT → ⋮ → **Ubah listing**.
**Harus terlihat:**

- Judul form "Ubah listing". Kolom **Barang** terkunci: hanya tulisan `UAT-KBL-01 — Kabel UTP Cat6 UAT`, tanpa kotak cari.
- Isian sama persis dengan C1: slug, Spesifikasi, Tampilkan harga jual, Harga per roll, Tampilkan "stok habis", 3-5 hari kerja, `Perkantoran, Perumahan`, 10.

Ubah lalu simpan:

| Isian | Isi dengan |
|---|---|
| Alamat di website (slug) | `kabel-utp-cat6-uat-305m` |
| Spesifikasi di kartu produk (opsional) | `Cat6 23 AWG, 305 m per roll` |
| Saat stok habis | **Boleh pre-order** |
| Label waktu tunggu (opsional) | `7 hari kerja` |
| Kegunaan (opsional) | `Perkantoran, Perumahan, Gudang` |
| Bobot popularitas (opsional) | `20` |

**Klik:** Simpan.
**Harus terlihat:** "Listing disimpan"; slug baru dan Saat stok habis "Boleh pre-order" tampil di daftar. F5 → **Ubah listing**: semua nilai baru tersimpan. Kembalikan slug ke `kabel-utp-cat6-uat` dan Saat stok habis ke **Tampilkan "stok habis"**, lalu **Simpan** (dipakai di C6).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Tampilkan di website (dulu C2)

Baris Kabel UTP Cat6 UAT → ⋮ → **Tampilkan**.
**Harus terlihat:** pesan "Listing tampil di website"; Di website **Tampil**; di menu ⋮ tombolnya berubah menjadi **Sembunyikan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6 🔌. Barang tampil di website (dulu C3)

Butuh website membaca data ERP (`WEB_DATA_SOURCE`, lihat Persiapan). Tanpa itu, website menampilkan data contoh dan langkah ini diisi `Lewati`.

Buka http://localhost:4321/products, cari `Kabel UTP`.
**Harus terlihat:** kartu Kabel UTP Cat6 UAT dengan kategori Kabel UAT, spesifikasi "Cat6 23 AWG, 305 m per roll", keterangan "Harga per roll", harga **Rp 1.500.000**, label stok **Ready Stock** (stok dari M05 masih ada), dan tombol **Add to Cart**. Halaman detail ada di http://localhost:4321/products/kabel-utp-cat6-uat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7 🔌. Ubah ke Minta penawaran (dulu C4)

Admin ERP: baris Kabel UTP Cat6 UAT → ⋮ → **Ubah listing**.

| Isian | Isi dengan |
|---|---|
| Harga di website | **Minta penawaran (tanpa harga)** |

**Klik:** Simpan.
**Harus terlihat di ERP:** "Listing disimpan"; kolom Harga berisi **Penawaran**; Di website tetap **Tampil**.
**Harus terlihat di website** (muat ulang halaman C6): harga diganti tulisan **Request Price** dan tombol **Request Quote**, bukan Add to Cart.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8 ⚠️. Sembunyikan, lalu Hapus (dulu C5)

1. ⋮ → **Sembunyikan** → pesan "Listing disembunyikan dari website"; Di website **Tersembunyi**; tombol kembali menjadi **Tampilkan**. 🔌 Di website, barang hilang dari katalog.
2. ⋮ → **Hapus** → pesan "Listing dihapus"; baris hilang dari daftar Katalog Website, juga setelah F5. Barangnya sendiri tetap ada di **Inventaris → Produk**.

**Temuan yang diperkirakan:** **Hapus** langsung jalan tanpa pertanyaan konfirmasi (hapus FAQ punya konfirmasi, katalog tidak).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9 ⚠️. Halaman konten website (dulu C6)

Login `marketing_seed`, cari halaman untuk konten website (testimoni, gambar, berita) di semua menu.
**Temuan:** tidak ada halaman admin untuk konten website, padahal hak "konten website" ada di role Pemasaran.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10 ❓. Siapa yang melihat menu Katalog Website

Login berturut-turut `sales_manager_seed`, `admin_seed`, `sales_seed`, dan cari **Integrasi → Katalog Website**.
**Yang terjadi sekarang menurut kode:**

- `sales_manager_seed`: menu tampil, bisa Tampilkan barang, Ubah listing, Tampilkan/Sembunyikan, Hapus.
- `admin_seed` (Admin organisasi) dan `sales_seed`: menu **tidak tampil**.

Perlu keputusan apakah Admin organisasi memang tidak boleh mengelola katalog website.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 25 langkah

Langkah yang dilewati karena layanan luar belum ada (salin nomornya): ______

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M04:** lulus / belum lulus (coret salah satu)

Catatan penguji:

---

## Catatan penyusun

**Penomoran ulang 2026-11-25** (versi semua kolom):

| Lama | Baru |
|---|---|
| A1–A4 | A1–A4 (tetap) |
| B1 | B1 |
| (baru) | B2 Batal FAQ, B3 cek FAQ setelah F5 |
| B2 | B4 (ubah) dan B5 (hapus) |
| B3 | B6 |
| B4 | B7 |
| B5 | B8 |
| B6 | B9 |
| B7 | B10 |
| (baru) | B11 Pemasaran tidak bisa membalas |
| C1 | C1 |
| (baru) | C2 Batal listing, C3 slug ganda dan tanpa harga jual, C4 cek dan Ubah listing |
| C2 | C5 |
| C3 | C6 |
| C4 | C7 |
| C5 | C8 |
| C6 | C9 |
| (baru) | C10 hak akses menu katalog |

Perbedaan dokumen lama dengan kode, dan temuan:

1. **A3, pesan tanpa n8n.** Dokumen lama: "tetap Menunggu/Gagal dengan pesan jelas". Kode: status tetap Menunggu, alasan berbahasa Inggris "The n8n webhook is not configured" (`apps/backend/src/app/automation/services/outbox.service.ts:77`), ditampilkan apa adanya di toast `Belum terkirim: {{reason}}` (`apps/web-admin/src/routes/_authed/integrations/webhooks/index.tsx:61`).
2. **B6, banner.** Bukan satu banner "WAHA/AI belum diatur", tapi tiga baris terpisah (`apps/web-admin/src/routes/_authed/integrations/whatsapp-ai/index.tsx:40`, teks di `packages/locales/src/id/integrations.ts:73-75`). Daftar chat bawaannya tersaring **Perlu admin** (`whatsapp-ai/index.tsx:34`).
3. **B7, asisten menjawab dari FAQ** butuh penyedia AI (`AI_*`), bukan hanya WAHA (`packages/locales/src/id/integrations.ts:75`).
4. **B8, "Balas sebagai admin"** adalah label kolom; tombolnya **Kirim** (`whatsapp-ai/$conversationId.tsx:154-160`).
5. **B9, Tutup chat** tanpa konfirmasi (`whatsapp-ai/$conversationId.tsx:109`).
6. **C1, "Tampilkan harga jual"** adalah pilihan bawaan kolom **Harga di website**; bawaan **Saat stok habis** "Tersedia atas permintaan" (`apps/web-admin/src/routes/_authed/integrations/website-catalog/index.tsx:231-233`). Pilihan barang hanya memuat 20 barang aktif pertama hasil pencarian (`website-catalog/index.tsx:227`).
7. **Pesan validasi server berbahasa Inggris.** Error zod dikirim apa adanya sebagai pesan (`apps/backend/src/http/plugin.ts:141-150`), dan form menampilkan `errors[0].message` (`apps/web-admin/src/lib/catalog-api.ts:67`). Contoh: slug 1 huruf (min 2, `apps/backend/src/app/product/contracts/product-listing.contract.ts:22`), Bobot popularitas di atas 1.000.000 (baris 31; form tanpa batas atas, `website-catalog/index.tsx:374-382`), Kegunaan per kata lebih dari 80 huruf (baris 30; form tanpa batas, `website-catalog/index.tsx:369`).
8. **Pilihan barang di katalog ikut memuat bahan dan komponen**: daftar barang diminta tanpa saringan jenis (`website-catalog/index.tsx:227`), dan barang yang sudah punya listing masih bisa dipilih; menyimpannya menimpa listing lama tanpa peringatan (`apps/backend/src/app/product/services/product-listing.service.ts:119-139`).
9. **C3 lama, website di dev memakai data contoh.** Tanpa `WEB_DATA_SOURCE=erp`, website tidak membaca ERP (`apps/web-landing/src/lib/server/website/index.ts:8`).
10. **C7, teks website berbahasa Inggris:** "Request Price" dan "Request Quote" (`apps/web-landing/src/components/product/ProductCard.astro:58,74`).
11. **C8, Hapus listing tanpa konfirmasi** (`website-catalog/index.tsx:162-170`), padahal hapus FAQ memakai konfirmasi (`whatsapp-ai/faq.tsx:102`).
12. **C9 terkonfirmasi.** Hak `web_content` diberikan ke role Pemasaran (`packages/common/src/authorization/erp-permissions.ts:829`), tapi tidak ada route backend maupun halaman admin yang memakainya.
13. **C10, Admin organisasi tanpa hak katalog.** Role `admin` mendapat `automation` dan `whatsapp` tapi tidak `catalog` (`packages/common/src/authorization/erp-permissions.ts:504-550`); menu dijaga `catalog.read` (`apps/web-admin/src/components/sidebar/nav-config.ts:218`).
14. **Komentar `.env.example` website salah rute.** Tertulis `/inventory/public/v1/catalog/*` (`apps/web-landing/.env.example:18`), padahal rute yang dipakai `/products/public/v1/catalog/*` (`apps/web-landing/src/lib/server/catalog/routes.ts:10`).
15. **Tidak ada chat WhatsApp contoh di seeder**, jadi B7–B9 dan bagian chat B10–B11 tidak bisa diuji tanpa WAHA.
