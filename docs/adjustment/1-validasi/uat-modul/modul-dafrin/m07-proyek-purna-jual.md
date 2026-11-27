# UAT M07 - Proyek & Purna Jual (T08)

Kembali ke [README](README.md). Penguji: ________ Tanggal: ________

**Prasyarat:** M02 bagian C selesai. Butuh:
- Sales order M02 C1 yang **belum punya proyek** dan sudah punya surat jalan **Dikirim** berisi Kamera IP UAT bernomor seri `CAM-UAT-001` (untuk cek garansi di tiket). Bila nomor seri yang terkirim di M02 lain, pakai nomor itu dan catat di Catatan penguji.
- Satu sales order lain yang juga belum punya proyek (untuk B11). Boleh dari data contoh atau buat lagi seperti M02 C1.
- Akun portal pelanggan dari M02 A6 (email ada di Mailpit).

**Alur yang diuji:** proyek dari sales order → checklist, bukti, dan biaya → BAST → surat garansi → tutup proyek → tiket servis → tiket di portal pelanggan.

Versi lengkap per form, disusun 2026-11-25 dari form aslinya di kode. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), centang, file lampiran, dan baris tambahan. Setiap langkah berisi:

- **Menu**: menu yang dibuka.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar.
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Status:**

| Hal | Nilai |
|---|---|
| Proyek | Aktif → Selesai / Dibatalkan |
| Tahapan proyek | Persiapan, Pengiriman, Instalasi, Uji fungsi, Training, Serah terima (BAST), Garansi |
| Status tugas checklist | Belum → Dikerjakan → Selesai |
| BAST | langsung terbit saat disimpan; bisa Dibatalkan selama proyek Aktif |
| Tiket | Baru → Dikerjakan → Selesai diperbaiki → Ditutup (bisa dibuka lagi dari Selesai diperbaiki) |

**Data contoh yang dipakai selama UAT:**

| Data | Nilai |
|---|---|
| Pelanggan | PT Maju Jaya UAT / Budi Hartono UAT (dibuat di M02 A6) |
| Sales order proyek | SO M02 C1 |
| Sales order untuk B11 | SO lain tanpa proyek |
| Lokasi proyek | `Kantor PT Maju Jaya UAT, Jl. Sudirman 1, Jakarta` |
| Tugas untuk teknisi | Instalasi perangkat dan Pasang tiang kamera parkir → `technician_seed` |
| File bukti | `uji-fungsi.pdf`, `training.jpg`, `foto-lokasi.jpg`, `bast-ttd.pdf` (masing-masing ≤ 15 MB), file salah `catatan.docx` |
| Biaya langsung | Transportasi Rp 350.000 dengan nota `nota-tol.jpg`; Material Rp 200.000 (dibatalkan) |
| Wakil pelanggan di BAST | `Budi Hartono`, jabatan `Manajer Umum` |
| Masa garansi | 12 bulan |
| Nomor seri tiket | `CAM-UAT-001` (Kamera IP UAT dari M05, dikirim di M02) |
| Pelapor tiket | `Budi Hartono`, `081234500001` |
| Biaya servis | Rp 150.000 |

---

## A. Proyek

### A1. Buat proyek dari sales order (login `project_manager_seed`, semua kolom)

Menu **Proyek → Proyek** → tombol **Buat Proyek**. Judul halaman "Buat Proyek" dengan petunjuk "Pilih deal yang dikerjakan dan PIC-nya. Pelanggan, judul, dan nilai kontrak diambil dari deal; checklist bawaan ditambahkan."

| Isian | Isi dengan |
|---|---|
| Cari deal | ketik nomor SO M02 C1 (pilihan Deal ikut tersaring) |
| Deal (Sales Order) *(cek pilihan)* | "Pilih deal" lalu daftar SO yang belum punya proyek, format *nomor SO — nomor SPH — nama pelanggan*; pilih **SO M02 C1 — … — PT Maju Jaya UAT** |
| PIC proyek *(cek pilihan)* | "Pilih PIC" lalu akun yang boleh mengelola proyek (Pemilik, Manajer Operasional, Manajer Proyek); pilih **`project_manager_seed`** |
| Lokasi proyek (Opsional) | `Kantor PT Maju Jaya UAT, Jl. Sudirman 1, Jakarta` |
| Target mulai (Opsional) | hari ini |
| Target selesai (Opsional) | 14 hari dari hari ini |
| Catatan (Opsional) | `Proyek UAT M07` |

**Harus terlihat sebelum simpan:** setelah deal dipilih muncul kotak abu-abu berisi judul deal, nama pelanggan, dan nilai deal (format Rp).

**Uji salah** (sebelum menyimpan):
- Deal (Sales Order) atau PIC proyek masih "Pilih deal" / "Pilih PIC" → tombol **Buat Proyek** tidak bisa diklik.
- Di kalender Target selesai, tanggal sebelum Target mulai tidak bisa dipilih.
- Ketik Lokasi proyek lebih dari 200 huruf → ketikan berhenti di 200.
- Cari deal `zzzz` → pilihan Deal hanya berisi "Pilih deal". Hapus lagi isinya.

**Klik:** Buat Proyek.
**Harus terlihat:** pesan "Proyek dibuat"; halaman detail proyek terbuka dengan nomor proyek, judul · PT Maju Jaya UAT, status **Aktif**, tahapan "1. Persiapan" disorot. Kartu **Checklist pekerjaan** berisi 6 tugas bawaan: Survei lokasi & jadwal pekerjaan, Pengiriman barang ke lokasi (surat jalan), Instalasi perangkat, Uji fungsi sistem, Training operator, BAST ditandatangani pelanggan; semua "Belum ditugaskan" dan berstatus Belum.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Batal buat proyek

**Buat Proyek** → pilih SO untuk B11, pilih PIC, isi Lokasi proyek `Batal UAT` → klik **Batal**.
**Harus terlihat:** kembali ke daftar proyek; tidak ada proyek baru. SO untuk B11 masih ada di pilihan Deal saat **Buat Proyek** dibuka lagi (lalu klik **Batal**).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A3. Sales order yang sudah punya proyek tidak bisa dipilih

**Buat Proyek** → ketik nomor SO M02 C1 di **Cari deal** → buka pilihan **Deal (Sales Order)**.
**Harus terlihat:** SO M02 C1 **tidak ada** di pilihan. Bila tidak ada deal lain yang cocok, tampil "Tidak ada deal yang belum punya proyek." Klik **Batal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A4. Cek daftar dan detail proyek

Menu **Proyek → Proyek**.
**Harus terlihat di daftar:** kolom Nomor, Proyek (judul + nama pelanggan), PIC proyek, Tahapan (Persiapan), Target selesai, Status (Aktif). Pilihan status *(cek pilihan)*: Semua status, Aktif, Selesai, Dibatalkan; pilih Aktif → proyek A1 tetap tampil. Kotak "Cari nomor, judul, pelanggan, deal atau lokasi…" → ketik `Sudirman` → proyek A1 tampil.

Buka proyek A1 lalu tekan F5.
**Harus terlihat di kartu Data proyek:** Deal (Sales Order) = nomor SO M02 C1 (bisa diklik) dengan nomor SPH di bawahnya, PIC proyek, Lokasi proyek, Target mulai, Target selesai (tanggal panjang, misal "25 November 2026"), Nilai kontrak (Rp), Catatan "Proyek UAT M07". Semua sama dengan isian A1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A5. Ubah proyek

Di detail proyek A1 klik **Ubah**. Dialog "Ubah".

**Harus terlihat dulu:** Deal (Sales Order) tidak ada di dialog (tidak bisa diganti); kolom lain berisi nilai A1.

| Isian | Ubah menjadi |
|---|---|
| PIC proyek *(cek pilihan)* | akun yang boleh mengelola proyek; biarkan **`project_manager_seed`** |
| Tahapan *(cek pilihan)* | Persiapan, Pengiriman, Instalasi, Uji fungsi, Training, Serah terima (BAST) (tanpa Garansi); pilih **Pengiriman** |
| Lokasi proyek (Opsional) | `Kantor PT Maju Jaya UAT, Jl. Sudirman 1, Jakarta, Lantai 2` |
| Target mulai (Opsional) | tetap hari ini |
| Target selesai (Opsional) | 21 hari dari hari ini |
| Catatan (Opsional) | `Proyek UAT M07, jadwal mundur 1 minggu` |

**Uji salah** (sebelum menyimpan):
- Ubah Target mulai menjadi 30 hari dari hari ini (lebih lambat dari Target selesai) → **Simpan** → ditolak "Target selesai lebih awal dari target mulai". Kembalikan ke hari ini.
- Klik **Batal** di dialog setelah mengubah Catatan → dialog tertutup, data proyek tidak berubah. Buka **Ubah** lagi dan isi seperti tabel.

**Klik:** Simpan.
**Harus terlihat:** pesan "Proyek disimpan"; tahapan "2. Pengiriman" disorot (tahap 1 abu-abu); Data proyek menampilkan lokasi, target selesai, dan catatan baru. Tekan F5; tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A6. Tugaskan dan ubah status checklist

Kartu **Checklist pekerjaan** di proyek A1:
1. Tugas **Instalasi perangkat** → pilihan petugas *(cek pilihan)*: "Belum ditugaskan" lalu akun yang boleh mengerjakan tugas (Teknisi, Pekerja Lepas, dll.); pilih **`technician_seed`**.
2. Tugas **Survei lokasi & jadwal pekerjaan** → pilihan status *(cek pilihan)*: Belum, Dikerjakan, Selesai; ubah Belum → Dikerjakan, lalu → Selesai.
3. Tugas **Pengiriman barang ke lokasi (surat jalan)** → status Dikerjakan.

**Harus terlihat:** tidak ada pesan khusus, tapi perubahan tetap ada setelah F5. Tugas Selesai tampil dicoret. Nama teknisi tampil di tugas Instalasi perangkat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A7. Tambah dan hapus tugas

Form di bawah checklist:

| Isian | Isi dengan |
|---|---|
| Tugas baru | `Pasang tiang kamera parkir` |
| Tahapan *(cek pilihan)* | Persiapan, Pengiriman, Instalasi, Uji fungsi, Training, Serah terima (BAST); bawaan **Instalasi**, biarkan |
| Petugas *(cek pilihan)* | "Belum ditugaskan" lalu akun yang boleh mengerjakan tugas; pilih **`technician_seed`** |

**Uji salah:** Tugas baru kosong → tombol **Tambah tugas** tidak bisa diklik. Ketikan lebih dari 300 huruf berhenti di 300.

**Klik:** Tambah tugas. Lalu tambah tugas kedua `Tugas uji hapus` (Petugas Belum ditugaskan) → **Tambah tugas** → klik **Hapus** pada tugas itu.
**Harus terlihat:** pesan "Tugas ditambahkan" (dua kali); tugas Pasang tiang kamera parkir tampil dengan "Instalasi" dan nama teknisi. Setelah Hapus: pesan "Tugas dihapus" dan Tugas uji hapus hilang (tanpa konfirmasi).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A8. Tutup Proyek belum bisa sebelum ada bukti

Arahkan mouse ke tombol **Tutup Proyek**.
**Harus terlihat:** tombol abu-abu (tidak bisa diklik), dengan keterangan "Perlu bukti uji fungsi, training, dan BAST bertanda tangan." Di kartu **Bukti pekerjaan** label Uji fungsi, Training, BAST bertanda tangan belum bercentang, dan tertulis "Belum ada bukti."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A9. Unggah dan hapus bukti

Kartu **Bukti pekerjaan**. Form berisi Jenis bukti, File bukti (petunjuk "JPG, PNG, WebP atau PDF, maksimal 15 MB."), Keterangan bukti (Opsional).

| Isian | Bukti 1 | Bukti 2 | Bukti 3 |
|---|---|---|---|
| Jenis bukti *(cek pilihan)* | Uji fungsi, Training, BAST bertanda tangan, Foto, Lainnya (bawaan **Foto**); pilih **Uji fungsi** | **Training** | **Foto** |
| File bukti | `uji-fungsi.pdf` | `training.jpg` | `foto-lokasi.jpg` |
| Keterangan bukti (Opsional) | `Uji fungsi gate OK` | `Training operator 2 orang` | kosongkan |

**Uji salah** (sebelum mengunggah):
- Tanpa file → tombol **Unggah** tidak bisa diklik.
- Jenis bukti Lainnya, File bukti `catatan.docx` (di jendela pilih file ganti filter ke "Semua file") → **Unggah** → ditolak "Gunakan file JPG, PNG, WebP atau PDF".
- File lebih dari 15 MB (bila ada) → ditolak "Setiap file maksimal 15 MB".

**Klik:** Unggah (setiap bukti). Lalu klik **Hapus** pada bukti Foto.
**Harus terlihat:** pesan "Bukti diunggah"; gambar tampil sebagai foto, PDF sebagai kotak "PDF · uji-fungsi.pdf"; tiap bukti menampilkan jenis, keterangan, nama pengunggah, dan waktu; klik bukti membuka file di tab baru. Label **✓ Uji fungsi** dan **✓ Training** bercentang. Setelah Hapus: pesan "Bukti dihapus", bukti Foto hilang. Tombol Tutup Proyek masih abu-abu.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A10. Catat biaya langsung (semua kolom)

Kartu **Biaya Langsung** (di bawah kartu Dokumen serah terima). Bagian atas menampilkan Nilai kontrak, Biaya langsung, Material terkirim, Total biaya, Margin; bila sudah ada surat jalan, ada tulisan "Material dengan HPP rata-rata dari surat jalan …".

| Isian | Biaya 1 | Biaya 2 |
|---|---|---|
| Kategori biaya *(cek pilihan)* | Material, Transportasi, Akomodasi, Subkontraktor, Lainnya (bawaan **Transportasi**); biarkan **Transportasi** | **Material** |
| Tanggal | hari ini (bawaan) | hari ini |
| Jumlah biaya (Rp) | `350000` (tampil `350.000`) | `200000` |
| Keterangan biaya | `Bensin dan tol ke lokasi` | `Kabel tambahan` |
| Foto nota | `nota-tol.jpg` | kosongkan |

**Uji salah** (sebelum menyimpan):
- Jumlah biaya atau Keterangan biaya kosong → tombol **Catat Biaya** tidak bisa diklik.
- Jumlah biaya diketik huruf → tidak bisa diketik.
- Foto nota `catatan.docx` → **Catat Biaya** → ditolak "Gunakan file JPG, PNG, WebP atau PDF".

**Klik:** Catat Biaya (setiap biaya).
**Harus terlihat:** pesan "Biaya dicatat"; tabel berisi kolom Tanggal, Kategori biaya, Keterangan biaya, Jumlah: Transportasi **Rp 350.000** dan Material **Rp 200.000** (layar bisa menulis ",00"). Biaya langsung **Rp 550.000**; Total biaya dan Margin ikut berubah. Menu **Tindakan** pada baris Transportasi berisi **Lihat** (membuka nota) dan **Batalkan**; baris Material tanpa Lihat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A11. Batalkan biaya

Baris Material → **Tindakan** → **Batalkan**. Muncul kotak browser "Kenapa biaya ini dibatalkan?".
1. Biarkan kosong → **OK** → tidak terjadi apa-apa (biaya tetap aktif).
2. Ulangi, isi `Salah input, kabel dari stok` → **OK**.

**Harus terlihat:** pesan "Biaya dibatalkan"; baris Material dicoret dengan alasan di bawah keterangan; menu Tindakan baris itu tidak lagi berisi Batalkan. Biaya langsung kembali **Rp 350.000**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A12. Teknisi hanya melihat proyek tempat ia bertugas (login `technician_seed`)

Menu **Proyek → Proyek**.
**Harus terlihat:**
- Hanya proyek tempat `technician_seed` punya tugas (proyek A1). Proyek lain tidak tampil.
- Di detail proyek A1 **tidak ada** tombol Ubah, Batalkan Proyek, Tutup Proyek, dan Buat BAST; tidak ada form Tambah tugas; kartu Biaya Langsung dan Nilai kontrak tidak tampil.
- Teknisi **bisa** mengubah status tugas miliknya (Instalasi perangkat, Pasang tiang kamera parkir). Tugas lain hanya tampil sebagai teks.
- Form unggah di **Bukti pekerjaan** tampil (teknisi boleh mengunggah bukti); tombol Hapus hanya ada pada bukti yang ia unggah sendiri.

Ubah status Instalasi perangkat menjadi Dikerjakan, tekan F5, status tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A13. Keuangan melihat biaya, tidak bisa mengubah (login `finance_seed`)

Menu **Proyek → Proyek** → buka proyek A1.
**Harus terlihat:** semua proyek tampil di daftar. Di **Data proyek** ada **Nilai kontrak**. Kartu **Biaya Langsung** tampil dengan biaya A10/A11, tanpa form Catat Biaya dan tanpa Batalkan di menu Tindakan. Tidak ada tombol Ubah, Batalkan Proyek, Tutup Proyek, Buat BAST, form tugas, atau form unggah bukti.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A14 ⚠️. Admin organisasi membuka Proyek (login `admin_seed`)

Cari menu **Proyek → Proyek** dan **Proyek → Garansi**.
**Temuan yang diperkirakan:** kedua menu tidak tampil (hanya **Tiket**), karena role Admin tidak punya hak proyek sama sekali. Bila alamat `/projects` dibuka langsung, muncul pesan error. Sesuai keinginan?

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## B. BAST dan garansi (login `project_manager_seed`)

### B1. Isi form BAST (semua kolom)

Proyek A1 → kartu **Dokumen serah terima** (tertulis "Belum ada BAST.") → tombol **Buat BAST**. Petunjuk: "Terisi dari deal; semua isian bisa diubah. Satu proyek boleh punya beberapa BAST (per kontrak atau paket pekerjaan)."

Kartu **Detail BAST**:

| Isian | Isi dengan |
|---|---|
| Tanggal BAST | hari ini (bawaan) |
| Nomor kontrak / PO | terisi Nomor PO pelanggan dari SO M02 C1; ubah menjadi `PO-MJ-UAT-001` |
| Pekerjaan (tentang) | terisi judul deal; biarkan |
| Nama proyek | terisi lokasi proyek; ubah menjadi `Instalasi Kamera PT Maju Jaya UAT` |

Kartu **Pihak pertama (pelanggan)**:

| Isian | Isi dengan |
|---|---|
| Perusahaan | terisi PT Maju Jaya UAT; biarkan |
| Nama wakil | `Budi Hartono` |
| Jabatan | `Manajer Umum` |

Kartu **Pihak kedua (perusahaan)**:

| Isian | Isi dengan |
|---|---|
| Perusahaan | terisi dari profil perusahaan (bila kosong ketik nama perusahaan Anda) |
| Nama wakil | terisi nama PIC proyek; biarkan |
| Jabatan | terisi `Project Manager`; biarkan |

Kartu **Barang / pekerjaan yang diserahkan** (kolom No., Uraian, Vol, Keterangan): baris terisi dari baris SO, Keterangan "Telah selesai terpasang dan berfungsi dengan baik". Klik **Tambah baris** lalu isi:

| No. | Uraian | Vol | Keterangan |
|---|---|---|---|
| (baris baru) | `Jasa instalasi dan konfigurasi` | `1 Lot` | `Selesai` |

Kartu **Lingkup pekerjaan yang diserahterimakan** (petunjuk "Satu butir per baris; **teks** dicetak tebal."): 5 baris bawaan. Tambahkan baris `Pemasangan **kamera parkir**`.

**Uji salah** (sebelum menerbitkan):
- Kosongkan **Jabatan** pihak pertama → **Terbitkan BAST** → browser menolak dan menandai kolom wajib; tidak ada BAST tersimpan. Isi lagi `Manajer Umum`.
- Kosongkan **Uraian** baris baru → ditolak sama. Isi lagi.
- Hapus baris sampai tinggal satu → tombol **Hapus** pada baris terakhir abu-abu. Lalu kembalikan baris yang dihapus (klik **Batal** dan ulangi B1 bila perlu).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Terbitkan BAST

**Klik:** Terbitkan BAST.
**Harus terlihat:** pesan "BAST diterbitkan"; langsung terbuka halaman cetak "BERITA ACARA SERAH TERIMA (BAST)" berisi Nomor, kedua pihak dengan nama dan jabatan, Nomor Kontrak PO-MJ-UAT-001, tabel NO / Uraian / Vol / Keterangan termasuk baris Jasa instalasi, lingkup pekerjaan dengan "kamera parkir" tebal, dan kalimat penutup. Tombol **Cetak** membuka dialog cetak browser. Klik **Kembali ke proyek**: BAST tampil di Dokumen serah terima dengan tanggal · PO-MJ-UAT-001, link **Cetak**, **Ubah**, dan tombol **Batalkan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Batal buat BAST

**Buat BAST** → ubah Nama wakil pihak pertama menjadi `Batal UAT` → klik **Batal**.
**Harus terlihat:** kembali ke detail proyek; tidak ada BAST baru (tetap satu BAST dari B2).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Ubah BAST

Di baris BAST B2 klik **Ubah**. Judul halaman "Ubah {nomor BAST}"; semua kolom berisi nilai B1.

| Isian | Ubah menjadi |
|---|---|
| Jabatan (pihak pertama) | `General Manager` |
| Vol baris Jasa instalasi | `2 Lot` |

**Klik:** Simpan.
**Harus terlihat:** pesan "BAST disimpan"; halaman cetak terbuka dengan nomor yang **sama**, jabatan General Manager, Vol 2 Lot. Tekan F5; tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Batalkan BAST, lalu terbitkan lagi

Catat nomor BAST B2: ________. Di Dokumen serah terima klik **Batalkan** pada BAST itu. Muncul konfirmasi "Batalkan BAST {nomor}? Nomornya tidak dipakai lagi." dengan tombol **Batal** dan **Konfirmasi**.
1. Klik **Batal** → BAST tetap aktif.
2. Ulangi, klik **Konfirmasi**.
3. **Buat BAST** lagi, isi seperti B1, klik **Terbitkan BAST**.

**Harus terlihat:** pesan "BAST dibatalkan"; BAST lama berlabel **Dibatalkan** tanpa link Cetak dan Ubah. BAST baru mendapat **nomor baru** (nomor lama tidak dipakai ulang).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Buat surat keterangan garansi (semua kolom)

Dokumen serah terima → bagian **Surat keterangan garansi** (tertulis "Belum diterbitkan.") → tombol **Buat surat garansi**. Petunjuk: "Satu surat garansi per proyek. Perangkat terisi dari surat jalan yang sudah dikirim beserta nomor serinya."

Kartu **Detail sertifikat**:

| Isian | Isi dengan |
|---|---|
| Mulai dari BAST *(cek pilihan)* | "Pilih BAST" lalu hanya BAST yang terbit (BAST B5, *nomor — tanggal*); BAST yang dibatalkan **tidak** ada; terpilih otomatis **BAST B5**. Petunjuk "Masa garansi dihitung sejak tanggal BAST ini." |
| Tanggal surat | hari ini (bawaan) |
| Masa garansi (bulan) | `12` (bawaan) |
| Penyedia perangkat | terisi judul proyek; ubah menjadi `Kamera IP dan perangkat akses` |
| Nama proyek | terisi judul proyek; biarkan |
| Lokasi proyek (Opsional) | terisi lokasi dari A5; biarkan |
| Pemilik proyek | terisi PT Maju Jaya UAT; biarkan |

Kartu **Perangkat bergaransi** (kolom No., Uraian, Vol, Keterangan): terisi dari surat jalan yang sudah dikirim; baris Kamera IP UAT berketerangan `SN: CAM-UAT-001…`. Klik **Tambah baris**: Uraian `Adaptor daya 12V`, Vol `2 pcs`, Keterangan `Bawaan kamera`.

Kartu **Ketentuan garansi** (petunjuk "Satu butir per baris; baris yang diawali "o " adalah sub-butir; **teks** dicetak tebal. Isian awal dari profil perusahaan."):

| Isian | Isi dengan |
|---|---|
| Garansi mencakup | isian awal + baris baru `Penggantian unit bila rusak dari pabrik` |
| Garansi tidak berlaku apabila | isian awal + baris baru `o Kerusakan akibat banjir` |
| Ketentuan layanan garansi | isian awal; biarkan |

**Uji salah** (sebelum menyimpan):
- Masa garansi (bulan) `0` atau `121` → **Simpan dan cetak** → browser menolak (1 sampai 120). Kembalikan ke `12`.
- Kosongkan Penyedia perangkat atau Garansi mencakup → browser menolak (wajib). Isi lagi.
- Mulai dari BAST diganti "Pilih BAST" → tombol **Simpan dan cetak** tidak bisa diklik. Pilih lagi BAST B5.

**Klik:** Simpan dan cetak.
**Harus terlihat:** pesan "Surat garansi disimpan"; halaman cetak "SURAT KETERANGAN GARANSI PERANGKAT" berisi nomor, tanggal, "penyedia perangkat Kamera IP dan perangkat akses", Nama/Lokasi/Pemilik Proyek, daftar perangkat (termasuk Adaptor daya 12V), "Masa garansi: 12 (dua belas) bulan", dan bagian C/D dengan baris tambahan. Di detail proyek bagian garansi menampilkan nomor dan rentang tanggal (mulai tanggal BAST, berakhir sehari sebelum tanggal yang sama 12 bulan kemudian) dengan link Cetak dan tombol **Ubah**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7. Ubah surat garansi

Bagian garansi → **Ubah**. Judul halaman = nomor surat garansi; semua kolom berisi nilai B6.

| Isian | Ubah menjadi |
|---|---|
| Masa garansi (bulan) | `24` |

**Klik:** Simpan dan cetak.
**Harus terlihat:** pesan "Surat garansi disimpan"; nomor surat tetap sama; dokumen menulis "Masa garansi: 24 (dua puluh empat) bulan"; rentang tanggal di detail proyek berakhir 24 bulan setelah tanggal BAST. Ubah lagi ke `12` dan simpan (dipakai di bagian C dan D). Tekan F5; tetap 12.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8. Menu Garansi

Menu **Proyek → Garansi**.
**Harus terlihat:** surat garansi B6 tampil dengan Nomor, Proyek (nama + pelanggan), Tanggal surat, rentang tanggal, dan status **Bergaransi**. Hanya baca: tidak ada tombol ubah. Kotak cari dengan nama pelanggan menemukan surat ini. Klik nomornya membuka detail proyek A1.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9. Tutup Proyek masih belum bisa

Buka proyek A1, lihat tombol **Tutup Proyek**.
**Harus terlihat:** masih abu-abu. Label **BAST bertanda tangan** di Bukti pekerjaan belum bercentang: BAST yang diterbitkan belum dihitung, yang dihitung adalah scan BAST bertanda tangan yang diunggah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B10. Unggah scan BAST bertanda tangan, lalu Tutup Proyek

Kartu **Bukti pekerjaan**:

| Isian | Isi dengan |
|---|---|
| Jenis bukti *(cek pilihan)* | Uji fungsi, Training, BAST bertanda tangan, Foto, Lainnya; pilih **BAST bertanda tangan** |
| File bukti | `bast-ttd.pdf` |
| Keterangan bukti (Opsional) | `BAST ditandatangani Budi Hartono` |

**Klik:** Unggah. Label **✓ BAST bertanda tangan** bercentang dan tombol Tutup Proyek aktif. Klik **Tutup Proyek** → dialog "Tutup Proyek" dengan tulisan "Proyek ditutup dan masuk tahap garansi. Tugas, bukti, dan biaya tidak bisa diubah lagi."
1. Klik **Batal** → proyek tetap Aktif.
2. Ulangi, klik **Tutup Proyek** di dialog.

**Harus terlihat:** pesan "Bukti diunggah", lalu "Proyek ditutup". Status **Selesai**; tahapan "7. Garansi" disorot. Tombol Ubah, Batalkan Proyek, Tutup Proyek, Buat BAST, link Ubah/Batalkan BAST, form tugas, form unggah, dan form Catat Biaya hilang. Checklist hanya teks. Bagian garansi masih punya tombol **Ubah**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B11. Batalkan proyek lain

Buat proyek dari **SO untuk B11** seperti A1 (cukup Deal dan PIC proyek). Di detail proyek baru klik **Batalkan Proyek**. Dialog "Batalkan Proyek" berisi "Deal-nya bisa dibuatkan proyek baru setelah ini."

**Uji salah:** selama **Alasan** kosong (atau hanya spasi), tombol **Batalkan Proyek** di dialog tidak bisa diklik. Klik **Batal** → proyek tetap Aktif.

| Isian | Isi dengan |
|---|---|
| Alasan | `Pelanggan menunda pekerjaan` |

**Klik:** Batalkan Proyek.
**Harus terlihat:** pesan "Proyek dibatalkan"; status **Dibatalkan**; tampil "Alasan: Pelanggan menunda pekerjaan"; semua tombol ubah hilang dan tidak ada tombol untuk membuat surat garansi. Di **Buat Proyek**, SO untuk B11 muncul lagi di pilihan Deal (Sales Order). Klik **Batal**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## C. Tiket servis

### C1. Nomor seri mengisi garansi otomatis (login `customer_service_seed`)

Menu **Proyek → Tiket** → tombol **Buat Tiket**. Petunjuk: "Isi nomor seri dulu: perangkat, pelanggan, proyek, dan garansinya dicari dari surat jalan."

| Isian | Isi dengan |
|---|---|
| Nomor seri (Opsional) | `CAM-UAT-001`, lalu klik kolom lain (petunjuk "Garansi dicek begitu isian ini ditinggalkan.") |

**Harus terlihat:** di sebelah kolom muncul label **Bergaransi** dan "{nomor surat garansi} · sampai {tanggal akhir garansi}". **Pelanggan** terisi PT Maju Jaya UAT, **Proyek** terisi proyek A1, **Perangkat (Opsional)** terisi nama Kamera IP UAT.

**Cek tambahan:** ganti nomor seri menjadi `SN-TIDAK-ADA`, pindah kolom → label **Di luar garansi**, tanpa tanggal. Kembalikan ke `CAM-UAT-001` dan pindah kolom lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2. Lengkapi dan buat tiket (semua kolom)

Masih di form yang sama.

| Isian | Isi dengan |
|---|---|
| Nomor seri (Opsional) | `CAM-UAT-001` (dari C1) |
| Pelanggan *(cek pilihan)* | "Pilih pelanggan" lalu pelanggan aktif dengan format *kode — nama*; terpilih **PT Maju Jaya UAT** |
| Proyek *(cek pilihan)* | "Tanpa proyek" lalu proyek milik pelanggan terpilih (*nomor — judul*); terpilih **proyek A1** |
| Perangkat (Opsional) | terisi Kamera IP UAT; ubah menjadi `Kamera IP UAT pintu masuk` |
| Pelapor | `Budi Hartono` |
| Kontak pelapor (Opsional) | `081234500001` |
| Saluran *(cek pilihan)* | Telepon, WhatsApp, Email, Situs web, Di lokasi, Lainnya (tanpa Portal pelanggan); bawaan **WhatsApp**, biarkan |
| Keluhan | `Kamera pintu masuk tidak menampilkan gambar sejak pagi` |

**Uji salah** (sebelum menyimpan):
- Pelapor atau Keluhan kosong → tombol **Buat Tiket** tidak bisa diklik.
- Pelanggan "Pilih pelanggan" → Proyek abu-abu dan **Buat Tiket** tidak bisa diklik.
- Ganti Pelanggan ke pelanggan lain (Proyek kembali "Tanpa proyek"), lengkapi kolom lain, klik **Buat Tiket** → ditolak "Nomor seri ini dikirim ke pelanggan lain". Kembalikan Pelanggan ke PT Maju Jaya UAT dan Proyek ke proyek A1.

**Klik:** Buat Tiket.
**Harus terlihat:** pesan "Tiket dibuat"; detail tiket terbuka dengan nomor tiket, nama pelanggan, status **Baru**, label **Bergaransi**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Batal buat tiket

**Proyek → Tiket** → **Buat Tiket** → isi Pelanggan PT Maju Jaya UAT, Pelapor `Batal UAT`, Keluhan `Batal UAT` → klik **Batal**.
**Harus terlihat:** kembali ke daftar tiket; tidak ada tiket baru dengan pelapor Batal UAT.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Cek daftar dan detail tiket

Menu **Proyek → Tiket**.
**Harus terlihat di daftar:** kolom Nomor, Pelanggan, Keluhan, Garansi (Bergaransi), Teknisi, Status (Baru). Pilihan status *(cek pilihan)*: Semua status, Baru, Dikerjakan, Selesai diperbaiki, Ditutup. Kotak "Cari nomor, pelanggan, nomor seri atau keluhan…" → ketik `CAM-UAT-001` → tiket C2 tampil.

Buka tiket C2, tekan F5.
**Harus terlihat:** kartu **Laporan**: Dilaporkan pada (tanggal dan jam), Saluran WhatsApp, Pelapor "Budi Hartono · 081234500001", Teknisi "—", Keluhan sesuai. Kartu **Perangkat**: Nomor seri CAM-UAT-001, Perangkat "Kamera IP UAT pintu masuk", Proyek berupa link **Buka proyek** (membuka proyek A1), Garansi "{nomor surat garansi} · sampai {tanggal}". Tiket servis tidak punya tombol Ubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Tugaskan ke teknisi

Kanan atas detail tiket, pilihan **Teknisi** *(cek pilihan)*: "Belum ditugaskan" lalu akun yang boleh mengerjakan tiket; pilih **`technician_seed`**.
**Harus terlihat:** pesan "Teknisi ditugaskan"; di kartu Laporan, Teknisi berisi nama teknisi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6. Tulis catatan internal di tiket

Kartu **Pesan** (tertulis "Belum ada pesan.").

| Isian | Isi dengan |
|---|---|
| Pesan | `Teknisi dijadwalkan besok pagi` |
| Terlihat oleh pelanggan di portal | **tidak** dicentang (bawaan) |

**Uji salah:** Pesan kosong → tombol **Kirim** tidak bisa diklik.

**Klik:** Kirim.
**Harus terlihat:** pesan "Pesan tersimpan"; pesan tampil dengan nama pengirim, label **Catatan internal**, dan waktu; kotak Pesan kosong lagi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7. Teknisi mulai kerjakan (login `technician_seed`)

Menu **Proyek → Tiket** → buka tiket C2 → klik **Mulai kerjakan**.
**Harus terlihat:** pesan "Tiket mulai dikerjakan"; status **Dikerjakan**; tombol Mulai kerjakan hilang, tombol **Selesaikan** tampil. Teknisi tidak melihat pilihan Teknisi dan tombol Tutup Tiket.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8. Teknisi menyelesaikan

Klik **Selesaikan**. Dialog "Selesaikan".

| Isian | Isi dengan |
|---|---|
| Tindakan perbaikan | `Ganti adaptor daya kamera` |
| Biaya servis (Rp) (Opsional) | `150000` (tampil `150.000`) |

**Uji salah:**
- Tindakan perbaikan kosong → tombol **Selesaikan** di dialog tidak bisa diklik.
- Biaya servis diketik huruf → tidak bisa diketik.
- Klik **Batal** → dialog tertutup, status tetap Dikerjakan. Buka **Selesaikan** lagi.

**Klik:** Selesaikan.
**Harus terlihat:** pesan "Tiket diselesaikan"; status **Selesai diperbaiki**. Muncul kartu **Hasil**: Tindakan perbaikan "Ganti adaptor daya kamera", Biaya servis **Rp 150.000** (layar bisa menulis ",00"), Dikonfirmasi pelanggan "—". Tekan F5; tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9. Teknisi membuka tiket yang bukan miliknya

`customer_service_seed`: buat tiket kedua (Pelanggan PT Maju Jaya UAT, Pelapor `Budi Hartono`, Keluhan `Tes tiket tanpa teknisi`), jangan ditugaskan. Salin alamat halaman detailnya.
`technician_seed`: buka **Proyek → Tiket**, lalu tempel alamat tadi.
**Harus terlihat:** tiket kedua tidak ada di daftar teknisi. Lewat alamat langsung muncul pesan "Tiket servis tidak ditemukan". Teknisi tidak bisa mengubahnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10. Buka lagi, lalu diselesaikan lagi

`customer_service_seed`: buka tiket C2 → **Buka lagi**.
`technician_seed`: buka tiket C2 → **Selesaikan** → Tindakan perbaikan `Ganti adaptor dan kencangkan konektor`, Biaya servis `150000` → **Selesaikan**.
**Harus terlihat:** pesan "Tiket dibuka lagi" dan status kembali **Dikerjakan**; lalu "Tiket diselesaikan" dan status **Selesai diperbaiki** dengan tindakan perbaikan yang baru.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C11. Tutup tiket (login `customer_service_seed`)

Buka tiket C2 → **Tutup Tiket**. Dialog "Tutup Tiket" berisi "Tutup hanya setelah pelanggan mengonfirmasi perbaikannya."

| Isian | Isi dengan |
|---|---|
| Dikonfirmasi pelanggan | `Budi Hartono` (nama orang yang mengonfirmasi, bukan centang) |
| Saluran *(cek pilihan)* | Telepon, WhatsApp, Email, Situs web, Di lokasi, Lainnya; bawaan **Telepon**, pilih **WhatsApp** |

**Uji salah:** Dikonfirmasi pelanggan kosong → tombol **Tutup Tiket** di dialog tidak bisa diklik. Klik **Batal** → status tetap Selesai diperbaiki. Buka lagi dialognya.

**Klik:** Tutup Tiket.
**Harus terlihat:** pesan "Tiket ditutup"; status **Ditutup**. Kartu Hasil: Dikonfirmasi pelanggan "Budi Hartono · WhatsApp · {waktu}". Form pesan di kartu **Pesan** dan semua tombol aksi hilang.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C12 ⚠️. Admin organisasi membuat dan menugaskan tiket (login `admin_seed`)

Menu **Proyek → Tiket** → **Buat Tiket**. Buka pilihan **Pelanggan**.
**Temuan yang diperkirakan:** daftar Pelanggan **kosong**, karena Admin tidak punya hak baca pelanggan dan proyek. Tanpa pelanggan, tombol Buat Tiket tidak bisa diklik. Coba isi **Nomor seri** `CAM-UAT-001` lalu pindah kolom: pelanggan mungkin terisi dari surat jalan tapi tampil kosong/aneh di pilihan. Bila tiket berhasil dibuat: tugaskan ke `technician_seed` (harus bisa, pesan "Teknisi ditugaskan"). Tombol **Selesaikan** dan **Tutup Tiket** **tidak tampil** untuk Admin (Mulai kerjakan dan Buka lagi tetap tampil).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## D. Portal pelanggan

Portal di http://localhost:4322. Tulisan di portal berbahasa Inggris (bawaan portal). Akun portal dibuat di M02 A6 (email ada di Mailpit) atau lewat daftar individu.

### D1. Proyek milik pelanggan (login portal pelanggan)

Halaman **Sign in** ("Welcome back"):

| Isian | Isi dengan |
|---|---|
| Account type *(cek pilihan)* | tab **individual** dan **business**; pilih **business** |
| Business email | email akun portal M02 A6 |
| Password | password akun portal |
| Keep me signed in (centang) | biarkan tercentang |

**Uji salah:** password salah → ditolak "Incorrect email or password" (bisa ditambah sisa percobaan sebelum akun dikunci 15 menit); tetap di halaman Sign in.

**Klik:** Sign in. Di Home buka **Projects** (menu layanan, atau desktop: kartu Projects).
**Harus terlihat:** halaman **My Projects** dengan tab **Active**, **Handed over**, **All**. Proyek A1 ada di tab **Handed over** (sudah ditutup). Proyek B11 yang dibatalkan **tidak** tampil. Proyek milik pelanggan lain tidak tampil. Buka proyek A1: **Milestones** berisi tahapan dan tugas checklist; **Project documents** berisi BAST B5 dan file bukti (Uji fungsi, Training, BAST bertanda tangan).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D2. Buat tiket dari portal (semua kolom)

Tab **Support** → **New ticket**.

| Isian | Isi dengan |
|---|---|
| What do you need help with? *(cek pilihan)* | Hardware, Software, Installation, Billing, Warranty, Other; bawaan **Hardware**, pilih **Warranty** |
| Related product *(cek pilihan)* | perangkat dari surat garansi (Kamera IP UAT, Adaptor daya 12V, …) dan "No specific product"; pilih **Kamera IP UAT** |
| Priority *(cek pilihan)* | Low, Normal, Urgent; bawaan **Normal**, pilih **Urgent** |
| Subject | `Kamera parkir buram` |
| Describe the issue | `Gambar kamera parkir buram sejak kemarin sore` (penghitung "…/ 1000") |
| Photos & videos | **Add** → 1 file gambar `foto-kamera.jpg` (maksimal 5 file, 25 MB) |

**Harus terlihat sebelum kirim:** "Expected first reply" berubah mengikuti Priority (Urgent tampil merah).

**Uji salah** (sebelum mengirim):
- Subject `abc` → **Submit ticket** → "Add a short subject".
- Describe the issue `rusak` (kurang dari 10 huruf) → "Describe the issue".
- Photos & videos: file lebih dari 25 MB → "Each file must be 25 MB or smaller"; lebih dari 5 file → "Attach up to 5 files".
Kembalikan ke isian tabel.

**Klik:** Submit ticket.
**Harus terlihat:** halaman "Ticket submitted" dengan nomor tiket, tombol **Back to support** dan **Open ticket**. **Open ticket** → judul nomor tiket, Subject, Priority, langkah "Created" disorot, keluhan tampil sebagai pesan pertama. Tekan F5; tetap sama. Di admin (`customer_service_seed`, **Proyek → Tiket**) tiket ini tampil dengan Saluran **Portal pelanggan**, Pelapor = nama login portal · email, dan Keluhan berisi subject + uraian.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D3. Kirim pesan dari portal

Di tiket D2 (portal), kotak pesan "Message …".

| Isian | Isi dengan |
|---|---|
| Message | `Mohon dicek hari ini` |
| Attach photo or PDF | kosongkan |

**Uji salah:**
- Kotak pesan kosong tanpa lampiran → tombol **Send message** tidak bisa diklik.
- Hanya lampiran (1 gambar) tanpa teks → **Send message** → harus terkirim atau ditolak dengan pesan yang jelas (catat yang terjadi).

**Klik:** Send message.
**Harus terlihat:** halaman dimuat ulang dan pesan muncul di percakapan. Di admin, pesan tampil di kartu **Pesan** dengan label **Pelanggan**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D4. Balasan dan status dari admin terlihat di portal

`customer_service_seed`: buka tiket D2.
1. Kartu **Pesan** → Pesan `Teknisi kami datang besok pukul 10.00` → centang **Terlihat oleh pelanggan di portal** → **Kirim**.
2. Kirim pesan `Catatan internal UAT` **tanpa** centang.
3. Tugaskan ke `technician_seed`, lalu klik **Mulai kerjakan**.

**Harus terlihat di admin:** pesan "Pesan tersimpan"; pesan pertama berlabel **Dikirim ke pelanggan**, pesan kedua **Catatan internal**.
**Harus terlihat di portal** (muat ulang tiket D2): balasan pertama tampil, catatan internal **tidak** tampil; status tiket berubah (misalnya **Awaiting you** setelah ada balasan staf); langkah progres maju ke "Diagnosed".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D5. Produk dan garansi

Di Home buka **My Products** (atau **Warranty**).
**Harus terlihat:** halaman **My Products** berisi perangkat dari surat garansi B6 (Kamera IP UAT dengan keterangan `SN: CAM-UAT-001…`, Adaptor daya 12V) dan status **Warranty active**. Buka perangkatnya: masa garansi 12 bulan, tanggal, dan ketentuan (termasuk "Penggantian unit bila rusak dari pabrik") tampil.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### D6 ⚠️. Fitur portal yang belum tersambung

Buka **Documents**, **Payments** / **Invoices**, **Quotations**, tab **Orders**, dan **Support → Book** (pesan kunjungan servis).
**Temuan yang diperkirakan:** semua menampilkan halaman **Coming soon** ("This part of the portal isn't available for your account yet…"), belum tersambung ke ERP (rencana Tahap 2: T25). Di **My Products** → daftarkan perangkat baru: muncul "This feature isn't connected yet. Please contact support."

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

---

## Ringkasan

Sesuai: ___ dari 43 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M07:** lulus / belum lulus (coret salah satu)

Catatan penguji:

---

## Catatan penyusun

**Nomor langkah lama → baru** (2026-11-25, versi semua kolom):

| Lama | Baru | Lama | Baru |
|---|---|---|---|
| A1 | A1 | B5 | B8 |
| A2 | A3 | B6 | B9 |
| A3 | A6 | B7 | B10 |
| A4 | A8 | B8 | B11 |
| A5 | A9 | C1, C2 | C1, C2 |
| A6 | A12 | C3 | C5 |
| A7 | A13 | C4 | C7 |
| A8 | A14 | C5 | C8 |
| B1, B2 | B1, B2 | C6 | C9 |
| B3 | B5 | C7 | C10 |
| B4 | B6 | C8 | C11 |
| D1 | D1 | C9 | C12 |
| D2 | D2 + D3 | D3 | D4 |
| D4 | D5 | D5 | D6 |

Langkah baru: A2, A4, A5, A7, A10, A11, B3, B4, B7, C3, C4, C6, D3.

**Perbedaan dengan versi lama dan kode:**

1. **B1/B2: BAST tidak punya tahap simpan lalu terbit.** Satu tombol **Terbitkan BAST** langsung menyimpan, memberi nomor, dan membuka halaman cetak (`apps/web-admin/src/routes/_authed/projects/$projectId/bast/new.tsx:36-45`).
2. **C11 (dulu C8): "Dikonfirmasi pelanggan" berupa kolom nama, bukan centang** (`apps/web-admin/src/routes/_authed/tickets/$ticketId.tsx:272-274`). Saluran konfirmasi bawaannya Telepon (`$ticketId.tsx:73`).
3. **A12 (dulu A6): teknisi bisa mengubah sebagian.** Teknisi boleh mengubah status tugas miliknya dan mengunggah bukti (`apps/web-admin/src/components/projects/project-tasks-card.tsx:118`, `project-evidence-card.tsx:31`), tapi tidak bisa mengubah data proyek.
4. **A12 butuh tugas untuk teknisi**; A6 dan A7 sekarang menugaskan teknisi.
5. **C9 (dulu C6): tiket orang lain tidak terlihat sama sekali** (`apps/backend/src/app/ticket/services/ticket.service.ts:105,121`).
6. **C12 (dulu C9): Admin kemungkinan tidak bisa membuat tiket.** Form memuat pelanggan dari `/customers/people` (butuh `customer:read`) dan proyek dari `/projects` (butuh `project:read`); Admin tidak punya keduanya (`apps/web-admin/src/routes/_authed/tickets/new.tsx:29-30`, `docs/architecture/role-permission.md:682,1167`). Admin masih bisa Mulai kerjakan dan Buka lagi (`$ticketId.tsx:89,156,161`).
7. **B11 butuh sales order kedua**; sekarang ada di Prasyarat.

**Temuan baru:**

8. **Portal: foto, kategori, dan prioritas tiket tidak disimpan.** Endpoint portal menyatakan "photos not stored yet" (`apps/backend/src/app/customer/controllers/portal.controller.ts:301`); prioritas selalu dikirim balik `normal` (`apps/backend/src/app/customer/utils/portal-presenter.ts:226`), jadi Priority Urgent di D2 akan tampil Normal.
9. **Portal: pesan hanya-lampiran kemungkinan ditolak.** Portal mengizinkan kirim lampiran tanpa teks (`apps/web-customer-portal/src/actions/index.ts:345`), tapi ERP mewajibkan teks minimal 1 huruf (`apps/backend/src/app/customer/contracts/portal.contract.ts:43`).
10. **Tugas checklist tidak punya kolom tenggat**: daftar bisa menampilkan "tenggat", tapi form tambah tugas selalu mengirim tanpa tenggat dan tidak ada cara mengisinya (`apps/web-admin/src/components/projects/project-tasks-card.tsx:163`).
11. **Hapus tugas dan hapus bukti tanpa konfirmasi** (`project-tasks-card.tsx:141`, `project-evidence-card.tsx:96`).
12. **Batalkan biaya memakai kotak prompt browser**, bukan dialog aplikasi; alasan kosong diam saja tanpa pesan (`apps/web-admin/src/components/projects/project-costs-card.tsx:127-133`).
13. **Kolom opsional tidak bertanda "(Opsional)"** di form BAST (Nomor kontrak / PO, Nama proyek) dan biaya (Foto nota), karena memakai `FieldLabel` bawaan UI (`components/projects/bast-form.tsx:7`, `project-costs-card.tsx:9`).
14. **Tiket servis tidak bisa diubah** setelah dibuat (tidak ada tombol Ubah), padahal nomor seri, pelapor, atau keluhan bisa salah ketik (`apps/web-admin/src/routes/_authed/tickets/$ticketId.tsx`).
15. **Menu Garansi**: kolom berjudul "Masa garansi (bulan)" berisi rentang tanggal, dan bila kosong tertulis "Proyek ini belum punya surat garansi." padahal halaman ini daftar semua proyek (`apps/web-admin/src/routes/_authed/warranties/index.tsx:63,115`).
16. **Tidak ada pesan setelah ubah status atau petugas tugas checklist** (`project-tasks-card.tsx:93,123`).
17. **Portal berbahasa Inggris**: label ditulis langsung dalam bahasa Inggris (`apps/web-customer-portal/src/components/navigation/TabBar.astro:16-21`, `features/support/NewTicketForm.tsx`).
18. D6 tetap benar: Orders, Payments, Quotations, Documents, Book service masih dialihkan ke Coming soon (`apps/web-customer-portal/src/middleware.ts:91-103`, `services/portal/erp-routes.ts:22-26`).
