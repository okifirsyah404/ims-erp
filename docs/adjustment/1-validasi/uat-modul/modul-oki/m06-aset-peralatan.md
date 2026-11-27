# UAT M06 - Aset & Peralatan (programmer kedua: Oki)

Kembali ke [README](../README.md). Penguji: ________ Tanggal: ________

**Alur yang diuji:** kategori aset → register aset (daftar, tempatkan di gudang, pindahkan, ubah, nonaktifkan, hapus) → peminjaman (ajukan → setujui/tolak → pinjamkan → perpanjang → terlambat → kembalikan / hilang → tutup) → catatan servis → set peralatan → penghapusan aset → penyusutan → aset tetap di Keuangan.

Disusun 2026-11-26 dari form aslinya di kode (`apps/web-admin/src/components/assets/*`, `components/finance/fixed-assets-page.tsx`) dan hak akses di `packages/common/src/authorization/erp-permissions.ts`. Modul ini wilayah programmer kedua; temuan dicatat sebagai pertanyaan untuk Oki, tidak diperbaiki sendiri. **Setiap kolom di setiap form ikut dicoba**, termasuk kolom opsional, pilihan (dropdown), dan baris tambahan. Setiap langkah berisi:

- **Menu**: menu yang dibuka, dengan label persis seperti di sidebar.
- **Isi dengan**: semua kolom form, persis seperti namanya di layar, dengan nilai yang diketik. Kolom bertanda *(cek pilihan)* berarti buka dulu daftar pilihannya dan pastikan isinya sama dengan yang tertulis.
- **Klik**: tombol yang ditekan.
- **Harus terlihat**: hasil yang benar (pesan, status, isi daftar).
- **Uji salah**: isian yang sengaja salah; harus ditolak dengan pesan yang dimengerti.
- **Sesuai**: centang `[x] Sesuai` hanya bila **semua** yang tertulis cocok. Bila ada yang tidak cocok, jangan dicentang; isi tabel kecil di bawahnya (satu baris per hal).

**Tanda:** ⚠️ dugaan masalah (catat saja yang terlihat), 🔧 sudah diperbaiki (pastikan perbaikannya), ❓ disengaja tapi perlu keputusan.

**Akun uji** (password dev `<role>123456`; password `admin` ada di `apps/backend/.env`, `INITIAL_ADMIN_PASSWORD`, jangan ditulis di sini):

| Akun | Orang di tim (Bagian 3 validasi konsep) | Dipakai untuk |
|---|---|---|
| `admin` (Pemilik) | Aqim | Kategori, register aset, penghapusan aset (hanya Pemilik), kapitalisasi |
| `operations_manager_seed` | Aqim | Menyetujui peminjaman, penyusutan manual |
| `project_manager_seed` | Agus, Jamil, Hatta | Mengajukan dan menyetujui peminjaman |
| `technician_seed` | Fahri, Alex, Ade | Mengajukan peminjaman |
| `warehouse_seed` | Agus, Bilal | Meminjamkan (serah unit), perpanjang, kembalikan, tandai hilang, tutup |
| `sales_seed` | Bilal | Mengajukan peminjaman; tidak boleh melihat identitas tamu |
| `auditor_seed`, `accountant_seed`, `finance_seed` | Bella (akuntan) | Cek akses baca dan aset tetap |

**Status dokumen:**

| Dokumen | Status |
|---|---|
| Aset | Siap → Dipinjam → Siap; Perawatan; Nonaktif ↔ Siap; Hilang; Dihapus |
| Permintaan peminjaman | Draf → Diminta → Disetujui (atau Ditolak / Dibatalkan) |
| Peminjaman (setelah unit diserahkan) | Dipinjamkan → Kembali sebagian → Dikembalikan → Ditutup |
| Penghapusan aset | Draf → Disetujui → Tereksekusi (atau Dibatalkan) |

**Data contoh yang dibuat selama UAT:**

| Data | Nilai |
|---|---|
| Kategori aset | Kode `UAT-ALT`, nama Alat Instalasi UAT, jenis Perkakas, garis lurus, 48 bulan |
| Aset 1 | Bor listrik UAT, tipe Perkakas, seri `BOR-UAT-001`, Rp 2.500.000, 01/11/2026 |
| Aset 2 | Tang crimping UAT, tipe Perkakas, seri `TNG-UAT-001`, Rp 350.000 |
| Aset 3 | Tangga lipat UAT, tipe Peralatan, seri `TGA-UAT-001`, Rp 1.200.000 |
| Aset 4 | Proyektor lama UAT, tipe Perangkat TI, Rp 4.000.000 (untuk penghapusan) |
| Aset 5 | Hapus UAT, tipe Perabot, Rp 100.000 (untuk hapus) |
| Gudang | `WH-MAIN` (Main warehouse) dan satu rak, misalnya `R-01` dari UAT M05 |
| Set peralatan | Kit instalasi UAT |
| Tamu | Budi Tamu UAT, 081234567890, KTP `3201010101010001` |

Data seeder sudah berisi 6 aset `AST-SEED-001` sampai `AST-SEED-006` (Digital multimeter, Cordless drill, dan lain-lain), jadi daftar tidak kosong. Siapkan juga 1 file gambar (PNG/JPG/WebP) untuk foto aset.

***

## A. Kategori aset (login `admin`)

### A1. Buat kategori aset

Menu **Inventaris → Aset & Peralatan → Kategori Aset** → tombol **Kategori baru**.

| Isian | Isi dengan |
|---|---|
| Kode | `uat-alt` (harus otomatis tampil huruf besar `UAT-ALT`) |
| Nama | `Alat Instalasi UAT` |
| Jenis *(cek pilihan)* | Peralatan, Kendaraan, Perkakas, Perabot, Perangkat TI, Aset tak berwujud; pilih **Perkakas** |
| Penyusutan bawaan *(cek pilihan)* | Garis lurus, Saldo menurun, Tidak ada; biarkan **Garis lurus** |
| Umur ekonomis (bulan) (Opsional) | `48` |

**Uji salah** (sebelum disimpan):

- Kode atau Nama dikosongkan → tombol Simpan tidak bisa diklik.
- Umur ekonomis `0` atau `1.5` → petunjuk "Masukkan jumlah bulan dalam bilangan bulat." dan tombol Simpan tidak bisa diklik. Kembalikan ke 48.

**Klik:** Simpan.

**Harus terlihat:** pesan "Kategori dibuat."; baris UAT-ALT di daftar dengan Jenis Perkakas, Penyusutan bawaan Garis lurus, Umur ekonomis 48. Buat lagi kategori dengan Kode `UAT-ALT` → ditolak "Kategori aset dengan kode ini sudah ada".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### A2. Ubah kategori dan batal

Di baris UAT-ALT klik menu **Ubah kategori**.

**Harus terlihat dulu:** kolom **Kode** terkunci dengan petunjuk "Kode tidak dapat diubah setelah dibuat."; kolom lain berisi nilai A1.

| Isian | Ubah menjadi |
|---|---|
| Nama | `Alat Instalasi UAT 2` |
| Penyusutan bawaan | Saldo menurun |
| Umur ekonomis (bulan) | `60` |

**Klik:** Simpan.

**Harus terlihat:** "Kategori diperbarui."; daftar menampilkan nilai baru. Buka **Kategori baru** lagi, isi Kode `BATAL`, klik **Batal** → tidak ada kategori BATAL di daftar. ⚠️ Tidak ada tombol arsip/hapus kategori di layar, dan kategori tidak bisa dipilih di form aset (lihat B1).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## B. Register aset (login `admin`)

### B1. Daftarkan aset (semua kolom)

Menu **Inventaris → Aset & Peralatan → Register Aset** → tombol **Daftarkan aset**. Form dialog berjudul "Daftarkan aset". Kolomnya tidak berlabel; nama kolom terlihat sebagai teks samar (placeholder) di dalam kotak.

| Isian | Isi dengan |
|---|---|
| Foto aset | pilih 1 file gambar |
| Nama | `Bor listrik UAT` |
| Tipe *(cek pilihan)* | Peralatan, Kendaraan, Perkakas, Perabot, Perangkat TI, Aset tak berwujud; pilih **Perkakas** |
| Nomor seri | `BOR-UAT-001` |
| Biaya perolehan | `2500000` (tampil Rp 2.500.000) |
| Tanggal perolehan (kotak `dd/mm/yyyy`) | `01/11/2026` |
| Lokasi | `Lemari alat kantor` |

⚠️ Tidak ada kolom **Kategori**, **Penanggung jawab (PIC)**, **Kondisi**, dan **Deskripsi**, padahal rencana M06 meminta kategori, PIC, dan kondisi.

**Uji salah** (sebelum disimpan):

- Nama dikosongkan → tombol Buat aset tidak bisa diklik.
- Biaya perolehan diisi huruf, angka negatif, atau `999999999999999` → harus ditolak atau dibatasi. Kembalikan ke 2500000.

**Klik:** Buat aset.

**Harus terlihat:** pesan "Aset terdaftar."; kartu Bor listrik UAT di daftar dengan kode otomatis, lencana **Siap**, Tipe Perkakas, Kondisi (catat nilainya), Nilai buku **Rp 2.500.000**, Lokasi: Lemari alat kantor, Nomor seri: BOR-UAT-001, dan foto. ⚠️ Nilai buku kemungkinan tampil **Rp 250.000.000** (100 kali lipat), lihat Catatan penyusun.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B2. Daftarkan aset lain

Dengan cara yang sama (tombol **Daftarkan aset**), daftarkan Aset 2 sampai Aset 5 dari tabel Data contoh. Kosongkan foto, tanggal, dan lokasi.

| Aset | Nama | Tipe | Nomor seri | Biaya perolehan |
|---|---|---|---|---|
| 2 | `Tang crimping UAT` | Perkakas | `TNG-UAT-001` | `350000` |
| 3 | `Tangga lipat UAT` | Peralatan | `TGA-UAT-001` | `1200000` |
| 4 | `Proyektor lama UAT` | Perangkat TI | kosong | `4000000` |
| 5 | `Hapus UAT` | Perabot | kosong | `100000` |

**Klik:** Buat aset (empat kali).

**Harus terlihat:** empat kali "Aset terdaftar."; keempat kartu berstatus Siap dengan kode berurutan. Coba daftarkan aset dengan Nomor seri `BOR-UAT-001` lagi → catat apakah ditolak (seharusnya nomor seri tidak boleh ganda).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B3. Batal daftarkan

Klik **Daftarkan aset** → isi Nama `Batal UAT` → klik **Batal**. Ulangi, lalu tutup dialog dengan tombol X atau Esc.

**Harus terlihat:** dialog tertutup tanpa pesan; tidak ada aset Batal UAT di daftar.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B4. Cari dan filter daftar

Di **Register Aset**:

| Filter | Isi dengan |
|---|---|
| Kotak cari ("Cari kode, nama, atau nomor seri…") | ketik `TNG-UAT`, tekan Enter; lalu `Bor listrik`, Enter; lalu kosongkan, Enter |
| Status *(cek pilihan)* | Semua status, Siap, Dipinjam, Perawatan, Nonaktif, Dihapus, Hilang; pilih **Hilang** |
| Tipe *(cek pilihan)* | Semua tipe, Peralatan, Kendaraan, Perkakas, Perabot, Perangkat TI, Aset tak berwujud; pilih **Perkakas** |
| Sertakan yang diarsipkan | centang, lalu hilangkan centang |

**Harus terlihat:** cari `TNG-UAT` hanya menampilkan Tang crimping UAT; cari nama menampilkan Bor listrik UAT. Status Hilang menampilkan AST-SEED-003 Cable tester. Tipe Perkakas tidak menampilkan Tangga lipat UAT. Filter tersimpan di alamat halaman (tetap sama setelah F5). Bila hasil kosong muncul "Belum ada apa pun di sini".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B5. Cek detail aset

Klik kartu Bor listrik UAT.

**Harus terlihat:**

- Judul Bor listrik UAT dan kodenya; tombol **Pinjamkan**, **Nonaktifkan**, **Penghapusan**.
- Kartu **Status** Siap, **Nilai buku** Rp 2.500.000, **Kondisi** (sama dengan di kartu daftar).
- Kartu **Lokasi**: "Belum ditempatkan di gudang", di bawahnya "Lemari alat kantor"; tombol **Tempatkan** aktif dan **Pindahkan** abu-abu (belum ada gudang).
- Bagian **Perpindahan**, **Pemeriksaan kondisi**, **Catatan servis**, **Penyusutan**, **Dokumen** masing-masing "Belum ada catatan." (atau satu baris Penerimaan di Perpindahan).

Tekan F5; semua tetap sama. ⚠️ Detail tidak menampilkan Nomor seri, Tipe, Tanggal dan Biaya perolehan, maupun foto, dan tidak ada tombol **Ubah** di halaman detail.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B6. Tempatkan aset di gudang

Di detail Bor listrik UAT, kartu **Lokasi** → tombol **Tempatkan**. Dialog berjudul "Tempatkan" dengan keterangan "Pilih gudang dan, bila perlu, bin penyimpanan tempat aset berada."

| Isian | Isi dengan |
|---|---|
| Gudang *(cek pilihan)* | "Pilih gudang" lalu daftar `kode · nama` gudang yang tertaut; pilih **WH-MAIN · Main warehouse** |
| Penyimpanan *(cek pilihan)* | "Pilih penyimpanan (opsional)" lalu rak gudang itu; pilih **R-01** |

**Uji salah:** biarkan Gudang di "Pilih gudang" → tombol Simpan perubahan tidak bisa diklik.

**Klik:** Simpan perubahan.

**Harus terlihat:** "Aset ditempatkan."; kartu Lokasi menampilkan Main warehouse · R-01 (nama, bukan kode acak); di Perpindahan muncul satu baris. Ulangi **Tempatkan** untuk Aset 2 dan Aset 3 ke WH-MAIN (wajib: aset yang belum di gudang tidak bisa dipinjam, lihat C3).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B7. Pindahkan aset

Di detail Bor listrik UAT → tombol **Pindahkan** (sekarang aktif).

| Isian | Isi dengan |
|---|---|
| Gudang | tetap **WH-MAIN** (atau gudang lain bila ada) |
| Penyimpanan | pilih rak lain, atau "Pilih penyimpanan (opsional)" |

**Klik:** Simpan perubahan. Lalu buka **Pindahkan** lagi dan klik **Batal**.

**Harus terlihat:** "Aset dipindahkan."; Lokasi berubah; Perpindahan bertambah baris "Perpindahan masuk" / "Perpindahan keluar". Batal menutup dialog tanpa perubahan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B8. Ubah aset

Kembali ke **Register Aset** → menu titik tiga (Aksi) di kartu Bor listrik UAT → **Ubah**. Dialog berjudul "Ubah aset".

**Harus terlihat dulu:** **Tipe** terkunci (abu-abu); kolom lain berisi nilai B1, Biaya perolehan tampil 2.500.000 (bukan 250.000.000 atau 25.000).

| Isian | Ubah menjadi |
|---|---|
| Nomor seri | `BOR-UAT-001A` |
| Lokasi | `Rak alat lantai 2` |
| Biaya perolehan | `2600000` |

**Klik:** Simpan perubahan. Lalu buka **Ubah** lagi dan klik **Batal**.

**Harus terlihat:** "Aset diperbarui."; kartu menampilkan nomor seri dan nilai baru setelah F5. Batal tidak mengubah apa pun. Kembalikan Biaya perolehan ke `2500000`. ❓ Biaya perolehan masih bisa diubah setelah aset terdaftar; perlu keputusan apakah dikunci setelah dikapitalisasi (H1).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B9. Arsipkan (nonaktifkan) dan aktifkan lagi

Di **Register Aset**, menu titik tiga kartu Tangga lipat UAT → **Arsipkan**.

**Harus terlihat dulu:** konfirmasi berjudul `Arsipkan "Tangga lipat UAT"?` dengan teks "Ditandai nonaktif: tetap muncul di daftar dengan lencana nonaktif…" dan kotak "Alasan (wajib)".

**Uji salah:** biarkan Alasan kosong → tombol Arsipkan tidak bisa diklik.

| Isian | Isi dengan |
|---|---|
| Alasan (wajib) | `Engsel longgar, menunggu servis` |

**Klik:** Arsipkan. Lalu menu titik tiga kartu yang sama → **Aktifkan**.

**Harus terlihat:** "Aset dinonaktifkan."; kartu tetap di daftar dengan lencana **Nonaktif**; di detail, alasan tampil di bawah status. Setelah Aktifkan: "Aset diaktifkan kembali." dan lencana kembali **Siap**. ❓ Menu bertuliskan "Arsipkan" tetapi hasilnya "Nonaktif", sementara "Hapus" menghasilkan pesan "Aset diarsipkan." (B11); istilah ini membingungkan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B10 ⚠️. Tombol Nonaktifkan dan Penghapusan di detail

Buka detail Proyektor lama UAT → klik **Nonaktifkan**. Kembali, klik **Penghapusan**. Kembali, klik **Pinjamkan**.

**Harus terlihat (seharusnya):** Nonaktifkan membuka form alasan untuk aset ini; Penghapusan membuka form penghapusan untuk aset ini; Pinjamkan membuka form peminjaman dengan aset ini sudah terpilih. Dugaan: ketiganya hanya pindah ke halaman daftar (Register Aset, Penghapusan Aset, Peminjaman baru kosong) tanpa membawa aset.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B11. Hapus aset (tanpa riwayat)

Menu titik tiga kartu Hapus UAT → **Hapus**.

**Harus terlihat dulu:** konfirmasi `Hapus "Hapus UAT"?` dengan teks "Dihapus dari daftar. Catatan yang sudah memakainya tetap menyimpan riwayatnya…".

**Klik:** Hapus.

**Harus terlihat:** pesan "Aset diarsipkan."; Hapus UAT hilang dari daftar; centang **Sertakan yang diarsipkan** → Hapus UAT muncul lagi tanpa menu titik tiga. Data tidak benar-benar terhapus (hapus lunak).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### B12 ⚠️. Halaman induk Aset & Peralatan

Ketik langsung alamat `http://localhost:5173/assets` di browser (atau klik judul grup **Aset & Peralatan** bila bisa diklik).

**Harus terlihat:** halaman Register Aset tampil normal, atau dialihkan ke `/assets/register`. Dugaan: halaman error, karena rute `/assets` memakai daftar yang membaca filter milik rute `/assets/register`.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## C. Peminjaman

### C1. Menu per role

Login bergantian dan buka grup **Inventaris → Aset & Peralatan**.

| Akun | Menu yang harus tampil |
|---|---|
| `technician_seed` | hanya **Peminjaman** |
| `warehouse_seed` | hanya **Peminjaman** |
| `sales_seed` | hanya **Peminjaman** |
| `project_manager_seed` | Register Aset, Peminjaman, Catatan Servis, Kategori Aset, Set Peralatan, Penghapusan Aset, Penyusutan |
| `operations_manager_seed` | sama dengan Manajer Proyek |
| `auditor_seed` | sama dengan Manajer Proyek (hanya baca) |
| `accountant_seed`, `finance_seed` | grup Aset & Peralatan tidak tampil ⚠️ (lihat H4) |

**Harus terlihat:** sesuai tabel; membuka alamat menu yang tidak tampil (misalnya `/assets/register` sebagai `technician_seed`) menampilkan pesan akses ditolak, bukan data.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C2 ⚠️. Teknisi mengajukan peminjaman (login `technician_seed`)

Contoh nyata: Fahri meminjam bor untuk proyek. Menu **Inventaris → Aset & Peralatan → Peminjaman** → tombol **Peminjaman baru**.

| Isian | Isi dengan |
|---|---|
| Tipe peminjam | Pengguna terdaftar |
| Id pengguna | id akun `technician_seed` sendiri (lihat catatan di C3) |
| Tujuan | Pemakaian internal |
| Jatuh tempo | 7 hari dari hari ini |
| Nomor seri | buka daftar "Cari nomor seri" |

**Harus terlihat (seharusnya):** daftar unit berisi aset berstatus Siap (Bor listrik UAT, Tang crimping UAT, …) dan peminjaman bisa diajukan. Dugaan: daftar unit **kosong**, karena Teknisi punya hak peminjaman tetapi tidak punya hak baca register aset, sehingga teknisi tidak bisa mengajukan peminjaman sama sekali. Catat apa yang tampil, lalu lanjut ke C3.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C3. Manajer proyek mengajukan peminjaman untuk teknisi (login `project_manager_seed`)

Contoh nyata: Jamil mengajukan alat untuk Fahri. Menu **Inventaris → Aset & Peralatan → Peminjaman** → tombol **Peminjaman baru**. Halaman berjudul "Peminjaman baru" dengan keterangan "Pilih peminjam, lalu unitnya. Pengajuan tidak memindahkan stok — peminjamanlah yang melakukannya."

| Isian | Isi dengan |
|---|---|
| Tipe peminjam *(cek pilihan)* | Pengguna terdaftar, Pelanggan, Tamu; pilih **Pengguna terdaftar** |
| Id pengguna | id akun `technician_seed` ⚠️ (tidak ada pilihan nama; id harus diminta ke pengembang) |
| Tujuan *(cek pilihan)* | Sewa, Pemakaian internal, Pengujian, Servis garansi; pilih **Pemakaian internal** |
| Jatuh tempo (`dd/mm/yyyy`) | 7 hari dari hari ini |
| Catatan (Opsional) | `Untuk instalasi akses pintu proyek UAT` |
| Nomor seri *(cek pilihan)* | "Cari nomor seri" lalu `kode · nama` aset berstatus Siap; pilih **Bor listrik UAT**, klik **Tambah unit**; pilih **Tang crimping UAT**, klik **Tambah unit** |

Ganti sebentar Tipe peminjam ke **Pelanggan** → muncul kolom **Id pelanggan** (juga id mentah ⚠️); kembalikan ke Pengguna terdaftar.

**Uji salah** (sebelum diajukan):

- Belum ada unit → teks "Tambahkan minimal satu unit." dan tombol Ajukan peminjaman tidak bisa diklik.
- Jatuh tempo kosong → tombol tidak bisa diklik.
- Pilih unit yang sama dua kali → unit yang sudah ditambahkan tidak muncul lagi di daftar.
- Klik **Hapus** di baris Tang crimping UAT, lalu tambahkan lagi.
- Id pengguna diisi `abc` → harus ditolak dengan pesan yang dimengerti (catat pesannya).
- Tambahkan aset yang belum ditempatkan di gudang (misalnya Proyektor lama UAT) → ditolak "Aset tersebut tidak dapat dipinjamkan". Hapus barisnya.

**Klik:** Ajukan peminjaman.

**Harus terlihat:** pesan "Peminjaman diajukan"; daftar unit dan catatan kosong lagi. ⚠️ Halaman tetap di form (tidak pindah ke detail), dan form tidak punya tombol **Batal**. Buka **Peminjaman** → peminjaman baru berstatus **Diminta**.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C4. Peminjaman oleh tamu (login `project_manager_seed`)

**Peminjaman baru** lagi.

| Isian | Isi dengan |
|---|---|
| Tipe peminjam | **Tamu** |
| Nama tamu | `Budi Tamu UAT` |
| Telepon | kode negara Indonesia, `81234567890` |
| Dokumen identitas *(cek pilihan)* | —, KTP, SIM, PASSPORT, OTHER; pilih **KTP** |
| Nomor identitas | `3201010101010001` |
| Alamat | `Jl. Merdeka 1, Bandung` |
| Referensi dokumen | `Fotokopi KTP di map tamu` |
| Tujuan | **Pengujian** |
| Jatuh tempo | **kemarin** (sengaja, untuk uji terlambat di C14) |
| Catatan (Opsional) | kosong |
| Nomor seri | **Tangga lipat UAT** → Tambah unit |

**Harus terlihat dulu:** teks "Data identitas disimpan bersama peminjaman dan dihapus 24 bulan setelah peminjaman ditutup."

**Uji salah:** kosongkan Telepon atau Nomor identitas → tombol Ajukan peminjaman tidak bisa diklik. ❓ Jatuh tempo kemarin diterima; perlu keputusan apakah tanggal lampau boleh.

**Klik:** Ajukan peminjaman.

**Harus terlihat:** "Peminjaman diajukan"; di daftar Peminjam tertulis "Budi Tamu UAT", status Diminta.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C5. Daftar peminjaman

Menu **Peminjaman**. Halaman berjudul "Peminjaman" dengan tab **Permintaan** dan **Sudah dikeluarkan**.

**Harus terlihat:** tab Permintaan berisi peminjaman C3 dan C4 dengan kolom Kode, Peminjam, Tujuan, Jatuh tempo, Status peminjaman (Diminta) dan tombol Tindakan berisi Setujui, Pinjamkan, Tolak, Batalkan. Tab Sudah dikeluarkan: "Belum ada yang dikeluarkan." (bila belum ada data seeder). ⚠️ Kolom Peminjam untuk C3 kemungkinan berisi deretan kode acak (id pengguna), bukan nama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C6. Detail peminjaman

Klik kode peminjaman C3.

**Harus terlihat:**

- Kode, lencana **Diminta**, "Jatuh tempo: <tanggal C3>".
- Tombol **Setujui**, **Tolak**, **Pinjamkan**, **Perpanjang** tidak tampil (hanya untuk Disetujui ke atas), **Batalkan**.
- Kartu **Peminjam** ⚠️ (kemungkinan id mentah).
- Kartu **Unit** dengan keterangan "Satu baris per unit berseri…": dua baris dengan kolom Nomor seri, Asal, Dipinjamkan (—), Dikembalikan (—), Kondisi (—). ⚠️ Nomor seri dan Asal kemungkinan berisi id acak, bukan `BOR-UAT-001A` dan `Main warehouse`.
- Kartu **Riwayat**: satu entri "Diminta" dengan jam.

Tekan F5; semua tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C7 ⚠️. Pengaju tidak boleh menyetujui sendiri (login `project_manager_seed`)

Di detail peminjaman C3 (dibuat oleh akun ini) klik **Setujui**.

**Harus terlihat (seharusnya):** ditolak "Anda tidak dapat menyetujui peminjaman Anda sendiri"; status tetap Diminta. Dugaan: persetujuan **berhasil**, karena pemegang hak menyetujui selalu dikecualikan dari aturan ini. Bila berhasil, catat di tabel lalu lewati C8.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C8. Setujui peminjaman (login `operations_manager_seed`)

Contoh nyata: Agus menyetujui pengajuan Jamil. Menu **Peminjaman** → baris C3 → tombol Tindakan → **Setujui**.

**Harus terlihat:** pesan "Peminjaman disetujui"; status **Disetujui**. Di detail: tombol **Pinjamkan**, **Perpanjang**, **Batalkan**; Riwayat bertambah "Disetujui". ⚠️ Bila disetujui dari tombol di halaman detail, pesan "Peminjaman disetujui" kemungkinan tidak muncul (catat).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C9. Permintaan kedua untuk unit yang sama (login `project_manager_seed`)

**Peminjaman baru**: Tipe Pengguna terdaftar, Id pengguna sama dengan C3, Tujuan Pemakaian internal, Jatuh tempo 3 hari lagi, unit **Tang crimping UAT**.

**Klik:** Ajukan peminjaman.

**Harus terlihat:** "Peminjaman diajukan"; status Diminta. ❓ Permintaan tidak memesan unit, jadi unit yang sudah ada di permintaan lain yang disetujui tetap bisa diminta; perlu keputusan apakah boleh.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C10. Gudang menyerahkan unit (login `warehouse_seed`)

Contoh nyata: Agus (gudang) menyerahkan alat ke Fahri. Buka detail peminjaman C3 (status Disetujui) → **Pinjamkan**.

**Harus terlihat:**

- Pesan "Unit dipinjamkan" (⚠️ dari halaman detail mungkin tidak muncul; dari tombol Tindakan di daftar muncul).
- Lencana **Dipinjamkan**; kode berubah ke kode dokumen peminjaman.
- Baris Unit: kolom Dipinjamkan berisi tanggal hari ini.
- Riwayat: "Dipinjamkan" dengan "Pergerakan: <kode>".
- Tab **Sudah dikeluarkan** di daftar berisi peminjaman ini.
- Login `admin`: di **Register Aset**, Bor listrik UAT dan Tang crimping UAT berlencana **Dipinjam**, dengan "Dipinjam sejak" dan "Penanggung jawab" (⚠️ kemungkinan id mentah); di detail aset, Perpindahan bertambah "Dipinjamkan" dan tombol Pinjamkan/Tempatkan tidak tampil.

Tekan F5 di detail peminjaman; semua tetap sama.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C11. Pinjam ganda ditolak, lalu batalkan permintaan

1. Login `operations_manager_seed`: setujui permintaan C9.
2. Login `warehouse_seed`: di detail C9 klik **Pinjamkan** → ditolak "Aset tersebut tidak dapat dipinjamkan" (Tang crimping UAT sedang dipinjam di C3).
3. Masih `warehouse_seed`: klik **Batalkan** di C9 → harus ditolak karena hanya pengaju yang boleh membatalkan. ⚠️ Pesannya kemungkinan "Anda tidak dapat menyetujui peminjaman Anda sendiri", yang tidak cocok dengan tindakannya.
4. Login `project_manager_seed` (pengaju): klik **Batalkan** di C9.
5. Buka **Peminjaman baru**: Tang crimping UAT dan Bor listrik UAT **tidak** ada di daftar Nomor seri.

**Harus terlihat:** langkah 4 menampilkan "Peminjaman dibatalkan" dan status **Dibatalkan** tanpa tombol tindakan; Riwayat "Dibatalkan".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C12. Tolak peminjaman

1. Login `project_manager_seed`: **Peminjaman baru**, Tipe Tamu, Nama tamu `Tamu Ditolak UAT`, Telepon `81200000000`, Nomor identitas `123`, Tujuan Sewa, Jatuh tempo besok, unit **AST-SEED-004 Crimping tool**. Ajukan.
2. Login `operations_manager_seed`: baris itu → Tindakan → **Tolak**.

**Harus terlihat:** "Peminjaman ditolak"; status **Ditolak**, tidak ada tombol tindakan lagi; Crimping tool tetap Siap. ❓ Tidak ada kolom alasan penolakan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C13 ❓. Gudang meminjamkan tanpa persetujuan (login `warehouse_seed`)

Buka detail peminjaman tamu C4 (status masih **Diminta**) → **Pinjamkan**.

**Harus terlihat:** unit dipinjamkan; status **Dipinjamkan**; Riwayat menunjukkan persetujuan otomatis oleh akun gudang. ❓ Pemegang hak serah unit boleh melewati persetujuan; perlu keputusan Pemilik apakah Gudang (Agus, Bilal) boleh melakukan ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C14. Perpanjang jatuh tempo (login `warehouse_seed`)

Di detail peminjaman C3 klik **Perpanjang**. Muncul kotak isian bawaan browser berjudul "Jatuh tempo".

| Isian | Isi dengan |
|---|---|
| Jatuh tempo (kotak browser) | `2026-12-31` |

**Uji salah:** klik Perpanjang, ketik `besok` → seharusnya ada pesan salah; dugaan ⚠️ tidak terjadi apa-apa tanpa pesan. Klik Perpanjang lalu Cancel → tidak ada perubahan.

**Klik:** OK.

**Harus terlihat:** "Jatuh tempo diperpanjang"; "Jatuh tempo: 31/12/2026"; Riwayat "Jatuh tempo diperpanjang". ⚠️ Kotak isian browser tanpa pemilih tanggal dan tanpa contoh format.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C15. Tanda terlambat otomatis

Tunggu paling lama 15 menit setelah C13, lalu buka detail peminjaman tamu C4 dan tekan F5.

**Harus terlihat:** baris Tangga lipat UAT berlencana merah **Terlambat**; Riwayat "Ditandai terlambat" dengan lencana **Otomatis**. ❓ Tidak ada notifikasi ke peminjam atau Manajer Proyek, dan daftar Peminjaman tidak menandai yang terlambat.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C16. Kembalikan unit (login `warehouse_seed`)

Di detail peminjaman C3:

1. Pastikan tombol **Kembalikan semua** tampil (ada 2 unit terbuka).
2. Baris Bor listrik UAT → Tindakan → **Kembalikan**.
3. Baris Tang crimping UAT → Tindakan → **Kembalikan**.

**Harus terlihat:** dua kali "Unit dikembalikan". Setelah langkah 2: status **Kembali sebagian**, kolom Dikembalikan terisi, Kondisi "Baik". Setelah langkah 3: status **Dikembalikan**, tombol **Tutup** tampil. Riwayat: dua entri "Dikembalikan" dengan Pergerakan. Di Register Aset (login `admin`) kedua aset kembali **Siap** di gudang asal; Perpindahan "Pengembalian pinjaman". ⚠️ Tidak ada pilihan kondisi saat kembali (Baik / Rusak / Tidak lengkap) dan tidak ada catatan; semua tercatat Baik, padahal rencana M06 menguji pengembalian dengan kondisi rusak.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C17. Tutup peminjaman (login `warehouse_seed`)

Menu **Peminjaman** → tab **Sudah dikeluarkan** → baris C3 (Dikembalikan) → Tindakan → **Tutup**.

**Harus terlihat:** "Peminjaman ditutup"; status **Ditutup**; tidak ada tombol tindakan di detail; Riwayat "Ditutup". Tekan F5; tetap Ditutup.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C18. Tandai unit hilang (login `warehouse_seed`)

Di detail peminjaman tamu C4 → baris Tangga lipat UAT → Tindakan → **Tandai hilang**.

**Harus terlihat:** seharusnya ada konfirmasi dulu (⚠️ dugaan: langsung diproses tanpa konfirmasi dan tanpa kolom keterangan). Pesan "Unit ditandai hilang"; lencana **Hilang** di baris unit; Riwayat "Ditandai hilang" dengan Pergerakan; di Register Aset Tangga lipat UAT berstatus **Hilang**. ⚠️ Status peminjaman kemungkinan tetap **Dipinjamkan** dan tidak bisa ditutup karena tidak ada unit yang bisa dikembalikan (catat status dan tombol yang tampil).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C19. Identitas tamu disembunyikan

Buka detail peminjaman tamu C4 dengan tiga akun.

| Akun | Kartu Peminjam harus menampilkan |
|---|---|
| `warehouse_seed` | Budi Tamu UAT, telepon, `KTP 3201010101010001`, alamat, referensi dokumen |
| `sales_seed` | Budi Tamu UAT dan telepon saja, plus kotak "Identitas disembunyikan" dan "Nomor identitas, alamat, dan referensi dokumen hanya terlihat oleh pengguna yang dapat menandai unit hilang." |
| `project_manager_seed` | sama dengan `sales_seed` (Manajer Proyek tidak punya hak tandai hilang) |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C20. Tombol yang tidak sesuai hak (per role)

| Akun | Coba | Harus terlihat |
|---|---|---|
| `technician_seed` | buka detail peminjaman Diminta (bila ada), klik **Setujui** | ditolak "Akses ditolak"; ⚠️ seharusnya tombol tidak tampil sama sekali |
| `project_manager_seed` | di peminjaman Disetujui klik **Pinjamkan** | ditolak (Manajer Proyek tidak boleh serah unit); ⚠️ tombol tetap tampil |
| `warehouse_seed` | **Peminjaman baru** → isi lengkap → Ajukan peminjaman | ditolak "Akses ditolak" (Gudang tidak boleh mengajukan); ⚠️ tombol tetap tampil |
| `auditor_seed` | buka daftar dan detail | bisa melihat; setiap tombol tindakan ditolak |

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### C21. Aset dengan riwayat tidak bisa dihapus (login `admin`)

**Register Aset** → menu titik tiga kartu Bor listrik UAT → **Hapus** → konfirmasi **Hapus**.

**Harus terlihat:** ditolak "Tidak dapat mengarsipkan aset dengan riwayat peminjaman atau pemeliharaan"; aset tetap di daftar.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## D. Catatan servis (login `admin`)

### D1 ⚠️. Halaman Catatan Servis

Menu **Inventaris → Aset & Peralatan → Catatan Servis**.

**Harus terlihat:** judul "Catatan Servis", keterangan "Riwayat pemeliharaan per aset."; satu tabel per aset (nama dan kode) dengan kolom Kode, Jenis, Tanggal, Biaya, Status, atau "Belum ada catatan.". Cari tombol untuk **menambah catatan servis** (tanggal, uraian, biaya, vendor) dan **pemeriksaan kondisi**. Dugaan: tidak ada tombol tambah di halaman ini maupun di detail aset, jadi servis dan perubahan kondisi tidak bisa dicatat dari layar, padahal "catatan servis" termasuk lingkup M06.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## E. Set peralatan (login `admin`)

### E1. Buat set peralatan

Menu **Inventaris → Aset & Peralatan → Set Peralatan** → tombol **Set perkakas baru**. Judul halaman "Set Perkakas" (⚠️ menu tertulis "Set Peralatan").

| Isian | Isi dengan |
|---|---|
| Nama | `Kit instalasi UAT` |

**Uji salah:** Nama kosong → tombol Set perkakas baru di dialog tidak bisa diklik. Klik **Batal** sekali → dialog tertutup tanpa set baru.

**Klik:** Set perkakas baru (tombol di dialog).

**Harus terlihat:** "Set perkakas dibuat."; kartu Kit instalasi UAT dengan kode otomatis dan status **Tersedia**, tombol **Tambah item** dan **Hapus**. ⚠️ Tidak ada kolom deskripsi.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E2 ⚠️. Tambah aset ke set

Buka detail Tang crimping UAT, salin id dari alamat halaman (`/assets/register/<id>`). Kembali ke **Set Peralatan** → kartu Kit instalasi UAT → **Tambah item**.

| Isian | Isi dengan |
|---|---|
| Id aset | id yang disalin |

**Klik:** Tambah item.

**Harus terlihat:** "Item ditambahkan ke set perkakas.". Cek di mana isi set terlihat. Dugaan: isi set tidak ditampilkan di mana pun, dan penambahan memakai id mentah, bukan pilihan nama aset.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E3 ⚠️. Hapus aset dari set

Kartu Kit instalasi UAT → **Hapus**. Dialog berisi satu kotak dengan teks samar `item id` (bahasa Inggris).

**Harus terlihat (seharusnya):** daftar isi set untuk dipilih. Dugaan: harus mengetik id baris yang tidak pernah ditampilkan di layar, sehingga item tidak bisa dihapus. Isi id aset dari E2 dan klik **Hapus**; catat hasilnya (bila berhasil: "Item dihapus dari set perkakas.").

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### E4 ⚠️. Meminjam satu set sekaligus

Buka **Peminjaman baru** (login `project_manager_seed`). Cari pilihan untuk meminjam **Kit instalasi UAT** sebagai satu paket.

**Harus terlihat (seharusnya):** pilihan set peralatan (keterangan halaman: "Kit yang dipinjamkan ke teknisi sebagai satu unit"). Dugaan: tidak ada pilihan set di form; hanya unit satu per satu.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## F. Penghapusan aset (login `admin`; hanya Pemilik)

### F1. Ajukan penghapusan

Menu **Inventaris → Aset & Peralatan → Penghapusan Aset** → tombol **Penghapusan** (kanan atas). Dialog "Ajukan penghapusan" dengan keterangan "Penghapusan dibuat sebagai draf; persetujuan dan eksekusi menyusul."

| Isian | Isi dengan |
|---|---|
| Aset *(cek pilihan)* (teks samar "Id aset") | `kode — nama` aset (50 pertama); pilih **Proyektor lama UAT** |
| Metode *(cek pilihan)* | Dijual, Dibusukkan, Donasi, Transfer, Tukar tambah; pilih **Dijual**. ⚠️ "Dibusukkan" salah kata; seharusnya "Dimusnahkan" atau "Dibuang" |
| Hasil penjualan | `500000` (tampil Rp 500.000) |

**Uji salah:** belum memilih aset → tombol Buat penghapusan tidak bisa diklik. Klik **Batal** sekali → tidak ada baris baru.

**Klik:** Buat penghapusan.

**Harus terlihat:** "Penghapusan diajukan."; baris baru dengan kode otomatis, Status **Draf**, Metode Dijual, Hasil penjualan **Rp 500.000**. ⚠️ Tabel tidak menampilkan aset mana yang dihapus. Simpan nilai yang tampil; dugaan nilai tersimpan 100 kali lebih kecil (lihat H1 dan Catatan penyusun).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F2. Batalkan penghapusan

Ajukan lagi penghapusan untuk **Proyektor lama UAT**, Metode **Donasi**, Hasil penjualan `0`. Di baris baru → Tindakan → **Batalkan**.

**Harus terlihat:** "Penghapusan dibatalkan."; status **Dibatalkan**; menu Tindakan kosong. ❓ Satu aset bisa punya beberapa penghapusan aktif sekaligus.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F3. Setujui penghapusan

Baris Draf dari F1 → Tindakan → **Setujui**.

**Harus terlihat:** "Penghapusan disetujui."; status **Disetujui**; Tindakan sekarang **Eksekusi** dan **Batalkan**. ❓ Pemilik mengajukan dan menyetujui sendiri tanpa orang kedua.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F4. Eksekusi penghapusan

Baris Disetujui → Tindakan → **Eksekusi**.

**Harus terlihat:** "Penghapusan dieksekusi; aset dipensiunkan."; status **Tereksekusi**. Di **Register Aset**, Proyektor lama UAT berstatus **Dihapus**, Nilai buku Rp 0; di detailnya tombol Pinjamkan, Nonaktifkan, dan Penghapusan tidak tampil. Coba **Ubah** dari menu kartu dan simpan → ditolak (status Dihapus tidak bisa diubah). Tekan F5; status tetap.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### F5. Penghapusan per role

| Akun | Buka **Penghapusan Aset** | Harus terlihat |
|---|---|---|
| `operations_manager_seed` | daftar | bisa melihat; tombol Penghapusan dan menu Tindakan tidak tampil |
| `project_manager_seed` | daftar | sama |
| `auditor_seed` | daftar | sama |
| `technician_seed` | ketik alamat `/assets/disposals` | akses ditolak |

❓ Uji juga (login `admin`): ajukan penghapusan untuk aset yang sedang **Dipinjam** (misalnya AST-SEED-001 Digital multimeter). Seharusnya ditolak; dugaan diterima.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## G. Penyusutan manual

### G1. Catat entri penyusutan (login `operations_manager_seed`)

Menu **Inventaris → Aset & Peralatan → Penyusutan**. Tabel aset dengan kolom Kode, Nama, Nilai buku. Baris Bor listrik UAT → Tindakan → **Catat entri**. Dialog "Catat entri" dengan keterangan "Entri penyusutan bulanan manual (log gaya keuangan)."

| Isian | Isi dengan |
|---|---|
| Tahun | `2026` (bawaan tahun ini) |
| Bulan | `11` (bawaan bulan ini) |
| Jumlah penyusutan | `50000` (tampil Rp 50.000) |

**Uji salah:**

- Jumlah penyusutan `0` → tombol Catat entri tidak bisa diklik.
- Bulan `13` atau Tahun `20266` → harus ditolak dengan pesan yang dimengerti.
- Jumlah lebih besar dari nilai buku (misalnya `999999999`) → ditolak "Penyusutan tidak boleh melebihi nilai buku tersisa".
- Klik **Batal** sekali → tidak ada entri.

**Klik:** Catat entri. Lalu catat lagi untuk 2026 bulan 11.

**Harus terlihat:** "Penyusutan dicatat."; Nilai buku berkurang Rp 50.000 (Rp 2.450.000). Catatan kedua untuk periode yang sama ditolak "Aset ini sudah memiliki entri penyusutan untuk 2026-11". Di detail aset bagian **Penyusutan**: baris `2026-11` dengan Rp 50.000. ⚠️ Dugaan: nilai buku hanya berkurang Rp 500 karena jumlah dikirim tanpa dikali 100, atau tampilan berbeda dengan Aset tetap (H1); catat angka persisnya.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### G2. Penyusutan per role

| Akun | Harus terlihat |
|---|---|
| `admin` | Catat entri tampil |
| `project_manager_seed`, `auditor_seed` | daftar tampil, Catat entri tidak tampil |
| `accountant_seed` (Bella) | ⚠️ menu Penyusutan tidak tampil, padahal penyusutan adalah pekerjaan keuangan |

❓ Ada dua jalur penyusutan: entri manual di sini dan **Jalankan penyusutan** di Keuangan (H3). Perlu keputusan mana yang dipakai agar tidak tercatat dua kali.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## H. Aset tetap di Keuangan (ERP-0145)

### H1. Kapitalisasi barang (login `admin`)

Menu **Keuangan → Keuangan → Aset tetap** → tombol **Kapitalisasi barang**. Dialog dengan keterangan "Memposting Dr aset tetap (sesuai jenis barang) / Cr akun tempat harga perolehan berada saat ini…".

| Isian | Isi dengan |
|---|---|
| Barang *(cek pilihan)* | "—" lalu aset dengan biaya lebih dari 0, format `kode — nama (Rp nilai)`; pilih **Bor listrik UAT** dan cek nilainya Rp 2.500.000 |
| Akun kredit *(cek pilihan)* | "—" lalu akun aktif yang bisa diposting, `kode — nama`; pilih akun ekuitas saldo awal atau kas (tanyakan Bella) |
| Tanggal kapitalisasi | hari ini (bawaan) |
| Kelompok fiskal *(cek pilihan)* | Belum diisi, Kelompok 1 (4 tahun), Kelompok 2 (8 tahun), Kelompok 3 (16 tahun), Kelompok 4 (20 tahun), Bangunan permanen (20 tahun), Bangunan tidak permanen (10 tahun); pilih **Kelompok 1 (4 tahun)** |

**Uji salah:** Barang atau Akun kredit di "—" → tombol Kapitalisasi barang tidak bisa diklik. Setelah berhasil, kapitalisasi Bor listrik UAT sekali lagi → harus ditolak.

**Klik:** Kapitalisasi barang.

**Harus terlihat:** "Barang dikapitalisasi"; baris baru dengan Kode, Barang, Tanggal kapitalisasi, Harga perolehan (Rp) 2.500.000, Akumulasi (Rp) sesuai entri G1, Nilai buku (Rp), Kelompok fiskal Kelompok 1, Keadaan **Aktif**. Bandingkan dengan Register Aset: nilai harus sama. ⚠️ Halaman ini membagi nilai dengan 100 sedangkan Register Aset tidak; salah satunya pasti keliru. Cek juga di **Jurnal** ada jurnal Dr aset tetap / Cr akun kredit.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H2. Ubah kelompok fiskal

Di baris Bor listrik UAT, ubah pilihan Kelompok fiskal ke **Kelompok 2 (8 tahun)**, tekan F5.

**Harus terlihat:** pilihan tersimpan setelah F5. ⚠️ Tidak ada pesan berhasil setelah mengubah.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H3. Jalankan penyusutan dan laporan fiskal

Di kanan atas isi kotak Tahun `2026`, Bulan `11` → **Jalankan penyusutan**. Lalu ulangi untuk bulan yang sama.

**Harus terlihat:** pesan "<jumlah> aset disusutkan, Rp <total>"; Akumulasi (Rp) bertambah dan Nilai buku (Rp) berkurang. Pengulangan untuk bulan yang sama tidak menyusutkan dua kali (0 aset, atau ditolak). Bagian **Penyusutan fiskal (UU PPh Pasal 11)**: isi Tahun `2026` → kolom Fiskal (Rp), Komersial (Rp), Selisih (Rp) terisi untuk Bor listrik UAT. Uji salah: Bulan `13` atau huruf → harus ditolak dengan pesan.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### H4 ⚠️. Aset tetap per role

| Akun | Harus terlihat (seharusnya) |
|---|---|
| `accountant_seed` (Bella) | menu Aset tetap tampil, bisa kapitalisasi dan jalankan penyusutan (hak posting jurnal dimiliki Akuntan) |
| `finance_seed` | menu tampil (hanya baca) |
| `operations_manager_seed`, `auditor_seed` | daftar tampil; tombol Jalankan penyusutan dan Kapitalisasi barang tidak tampil |

Dugaan: untuk `accountant_seed` dan `finance_seed` menu **Aset tetap** tidak tampil (atau halaman ditolak), karena keduanya tidak punya hak baca aset. Akibatnya hanya Pemilik yang bisa memakai halaman ini.

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## I. Akses baca register per role

### I1. Manajer Proyek hanya membaca register (login `project_manager_seed`)

Buka **Register Aset**, **Kategori Aset**, **Set Peralatan**.

**Harus terlihat:** daftar tampil; tombol **Daftarkan aset**, **Kategori baru**, **Set perkakas baru**, menu titik tiga di kartu aset, **Tambah item**/**Hapus** di set, serta **Tempatkan**/**Pindahkan** di detail aset **tidak tampil**. Tombol **Pinjamkan** di detail aset juga tidak tampil (⚠️ padahal Manajer Proyek boleh mengajukan peminjaman).

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

### I2. Manajer Operasional mengelola register (login `operations_manager_seed`)

Daftarkan aset `Ops UAT` (Tipe Perkakas, Biaya `100000`), ubah lokasinya, lalu buka **Penghapusan Aset**.

**Harus terlihat:** "Aset terdaftar." dan "Aset diperbarui."; di Penghapusan Aset tombol Penghapusan tidak tampil (hanya Pemilik). Hapus aset Ops UAT lewat menu kartu **Hapus** → "Aset diarsipkan.".

- [ ] Sesuai

| Bagian yang tidak sesuai | Yang terjadi | Catatan |
|---|---|---|
| | | |
| | | |
| | | |

***

## Ringkasan

Sesuai: ___ dari 53 langkah

Langkah yang tidak sesuai (salin nomornya): ______

**Kesimpulan M06:** lulus / belum lulus (coret salah satu)

Catatan penguji:

***

## Catatan penyusun

Ditulis 2026-11-26 dari kode di `main` (setelah PR #169). Belum ada langkah yang diuji di browser; tanda ⚠️ adalah dugaan dari membaca kode.

**Rencana vs kode (perlu keputusan Pemilik/Oki):**

| Hal | Rencana M06 (`docs/plan/kontrak/modul/m06-assets-equipment.md`) | Kode sekarang |
|---|---|---|
| Status aset | `active → in_service → active` / `inactive` | `ready`, `borrowed`, `maintenance`, `inactive`, `disposed`, `lost` (`apps/web-admin/src/lib/asset-api.ts:26`) |
| Kondisi | `good`, `needs_service`, `damaged`, `lost` | `new`, `good`, `fair`, `poor`, `damaged` (`asset-api.ts:50`); tidak bisa diisi atau diubah dari layar |
| Peminjam | karyawan | pengguna, pelanggan, atau tamu, dengan id mentah (`borrowing-form.tsx:196-219`) |
| PIC aset | wajib | tidak ada kolom PIC; hanya "Penanggung jawab" saat dipinjam, berupa id (`asset-register-list.tsx:357-365`) |
| Catatan servis | dicatat di register | hanya tampilan; fungsi `logMaintenance` dan `recordConditionCheck` di `asset-api.ts:466-505` tidak dipakai di layar mana pun |
| Penyusutan | jurnal manual oleh keuangan, tanpa mesin otomatis | dua jalur: entri manual (`asset-depreciation-list.tsx`) dan "Jalankan penyusutan" otomatis di Keuangan (ERP-0145, ADR-0030 mencabut batasan ini) |
| Ekspor untuk kertas kerja penyusutan | diminta di DoD | tidak ada tombol ekspor di Register Aset |
| Set peralatan, penghapusan | di luar baseline (`beyond-baseline`) | ada di menu, tetapi setengah jadi (E2-E4) |

**Temuan dari kode:**

1. Teknisi tidak bisa mengajukan peminjaman: form memuat unit dari `/inventory/items` yang dijaga `asset:read` (`borrowing-form.tsx:83-85`), sedangkan `technician` hanya punya `asset_borrowing: ['read', 'create']` (`packages/common/src/authorization/erp-permissions.ts:679`). Hal yang sama untuk `sales` dan `customer_service`. Gudang juga tidak punya `asset:read` (`erp-permissions.ts:720-740`).
2. Aturan "tidak boleh menyetujui sendiri" tidak pernah berlaku: `canApprove` diisi dari hak `approve` (`apps/backend/src/app/inventory/controllers/borrowing.controller.ts:38`), sedangkan rute approve memang mewajibkan hak itu, jadi pengecualian di `apps/backend/src/app/inventory/services/borrowing-request.service.ts:259-265` selalu lolos (C7).
3. Pembatalan oleh orang selain pengaju memakai pesan "Anda tidak dapat menyetujui peminjaman Anda sendiri" (`borrowing-request.service.ts:286-287`), yang tidak cocok (C11).
4. Pengembalian selalu berkondisi `good` (`apps/web-admin/src/components/assets/borrowing-detail.tsx:133`); tidak ada pilihan Rusak/Tidak lengkap atau catatan (C16).
5. Tandai hilang tidak mengubah status peminjaman (`apps/backend/src/app/inventory/services/borrowing.service.ts:313-370`), dan transisi hanya `issued → partially_returned → returned → closed` (`borrowing.service.ts:55-60`), jadi peminjaman yang semua unitnya hilang tidak bisa ditutup (C18). Tandai hilang juga tanpa konfirmasi (`borrowing-detail.tsx:332`).
6. Pesan sukses Setujui/Tolak/Pinjamkan/Batalkan tidak muncul bila dilakukan dari halaman detail; hanya "submit" yang diberi pesan (`borrowing-detail.tsx:86`).
7. Perpanjang memakai `window.prompt` tanpa validasi yang terlihat (`borrowing-detail.tsx:195`).
8. Id mentah di layar: Peminjam (`borrowing-list.tsx:285`, `borrowing-detail.tsx:458`), Nomor seri unit (`borrowing-detail.tsx:494`), Asal gudang (`borrowing-detail.tsx:512`), Penanggung jawab (`asset-register-list.tsx:363`).
9. Satuan uang tidak konsisten: form aset mengalikan 100 (`apps/web-admin/src/components/assets/asset-form.tsx:86`, `lib/format.ts:73-75`), tetapi `formatMoney` tidak membagi 100 (`apps/web-admin/src/lib/asset-api.ts:605-611`), sedangkan halaman Aset tetap membaginya (`components/finance/fixed-assets-page.tsx`, fungsi `money`). Hasil penjualan penghapusan (`asset-disposal-list.tsx:253`) dan jumlah penyusutan (`asset-depreciation-list.tsx:221`) dikirim tanpa dikali 100. Seeder menulis `acquisitionCost: 2_500_000` untuk alat seharga Rp 2.500.000 (`apps/backend/database/seeders/seed/inventory.seeder.ts`), yang menurut aturan rupiah-sen (ADR-0002) berarti Rp 25.000. Perlu satu aturan dan perbaikan menyeluruh (B1, F1, G1, H1).
10. Tombol detail aset hanya tautan: Nonaktifkan ke `/assets/register`, Penghapusan ke `/assets/disposals`, Pinjamkan ke form kosong (`asset-detail.tsx:87-104`); `DeactivateAssetDialog` (`asset-form.tsx:224`) tidak dipakai (B10).
11. Rute `/assets` memakai `AssetRegisterList` yang membaca `getRouteApi('/_authed/assets/register/')` (`asset-register-list.tsx:49`; `routes/_authed/assets/index.tsx:30`); dugaan error saat dibuka (B12).
12. Set peralatan: tambah item memakai id aset mentah (`asset-tool-set-list.tsx:239`), hapus item meminta id baris dengan placeholder bahasa Inggris `item id` yang tidak diterjemahkan (`asset-tool-set-list.tsx:292`), isi set tidak pernah ditampilkan, dan peminjaman per set (`toolSetId` di `lib/borrowing-api.ts`) tidak ada di form (E2-E4).
13. Tombol Peminjaman baru dan tombol tindakan peminjaman tidak disaring hak (`borrowing-list.tsx`, `borrowing-detail.tsx`); penolakan baru terlihat dari server (C20).
14. Akuntan dan Keuangan tidak punya `asset:read`, padahal `/finance/fixed-assets` dan `/finance/depreciations` dijaga `asset:read` (`docs/architecture/role-permission.md:827,841`), sedangkan kapitalisasi dan jalankan penyusutan dijaga `journal:post` yang dimiliki Akuntan (`docs/architecture/role-permission.md:842-844`) (H4, G2).
15. Penghapusan hanya menolak aset yang sudah `disposed` (`apps/backend/src/app/inventory/services/disposal.service.ts:62`); aset yang sedang dipinjam dugaan tetap bisa dihapus (F5). Transisi aset juga mengizinkan `borrowed → inactive` (`apps/backend/src/app/inventory/services/item.service.ts:44`).
16. Istilah: "Dibusukkan" untuk `scrap` (`packages/locales/src/id/assets.ts:172`); menu "Set Peralatan" vs judul "Set Perkakas" (`id/nav.ts:59`, `id/assets.ts:122`); menu "Penghapusan Aset" vs judul "Penghapusan" (`id/assets.ts:82`); "Arsipkan" menghasilkan Nonaktif sedangkan "Hapus" menghasilkan "Aset diarsipkan." (`asset-register-list.tsx:124-148`, `448`).
17. Form aset tidak berlabel (hanya placeholder) dan tidak punya kolom Kategori, Deskripsi, Kode batang, meski kontrak backend menerimanya (`asset-api.ts:308-318`, `asset-form.tsx:111-155`).
18. Tanda terlambat dijalankan penjadwal setiap 15 menit (`SCHEDULER_LATE_SWEEP_CRON`, bawaan `*/15 * * * *`); tanpa notifikasi ke siapa pun (C15).
