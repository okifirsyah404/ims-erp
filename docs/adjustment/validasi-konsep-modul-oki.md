# Validasi konsep saat ini: role dan alur modul Oki (M01, M06, M09, M10, M11, M12, portal karyawan)

Kembali ke [catatan penyesuaian](README.md). Pasangan dari
[validasi-konsep-saat-ini.md](validasi-konsep-saat-ini.md) (modul programmer B),
dengan susunan dan cara isi yang sama, untuk modul yang dikerjakan **Oki**:
M01 Dasbor, M06 Aset & Peralatan, M09 Keuangan, M10 Pajak, M11 Bonus & Investor,
M12 Laporan & Hak Akses (login, pengguna, role, audit, profil perusahaan, nomor
kode), serta portal karyawan `apps/web-employee`.

Tujuannya memutuskan apakah **konsep dan hak yang berjalan sekarang** di modul
Oki tetap dipakai dengan tim nyata dan arah keputusan rapat (K1, K1a, K2, K2a,
K2d, K7a, K12, K13 di [lembar-keputusan-rapat.md](lembar-keputusan-rapat.md)).
Arah itu tidak diputuskan ulang di sini; dokumen ini hanya menerapkannya ke modul
Oki dan mencatat akibatnya.

Sumber, dibaca 2026-11-27 dari kode di branch ini:

* Hak per role: `packages/common/src/authorization/erp-permissions.ts` (blok `owner` baris 503, `admin` 520, `operations_manager` 576, `project_manager` 654, `technician` 677, `freelancer` 694, `warehouse` 720, `finance` 746, `accountant` 786, `hr` 815, `auditor` 876), dibaca lewat skrip sementara di folder temp OS.
* Guard route: `docs/role-permission.md` (bagian finance, tax, inventory, audit, company, organization, user, payment) dan `apps/backend/src/authorization/elysia-auth.ts`.
* Aturan persetujuan di service finance, tax, payment, inventory, human-resource (baris disebut di tiap temuan).
* Checklist dan "Catatan penyusun" di [uat-modul/modul-oki/](uat-modul/modul-oki/README.md), catatan [skema-database/](skema-database/README.md), [lintas-modul/autentikasi-dan-hak-akses.md](lintas-modul/autentikasi-dan-hak-akses.md), rencana `docs/plan/erp-module-plans/m01`, `m06`, `m09`, `m10`, `m11`, `m12`.

Status: **draf**, belum diperiksa Oki dan Pemilik. Semua butir bertanda ⚠️ adalah
hasil membaca kode dan belum dicoba di aplikasi.

Tanda: ✓ = boleh; kosong = tidak boleh; ✋ = kode menolak bila penyetuju sama dengan
pembuat/pengaju; ⚠️ = dugaan dari kode, perlu dipastikan saat UAT.

***

## Bagian 1 - Matriks role

### 1.1 Role yang berpengaruh di modul Oki

Kolom "Dipegang oleh" memakai data 2026-11-26, lalu usulan K2 setelah tanda "→".
Pemilik (`owner`) memegang semua hak; Admin aplikasi (tanda `admin` di
`auth.users.role`) adalah hal lain, lihat 3.9 dokumen programmer B.

| Role | Nama | Dipegang oleh | M01 Dasbor | M06 Aset & Peralatan | M09 Keuangan | M10 Pajak | M11 Investor | M12 Akses | Keputusan (tetap/ubah/hapus) |
|---|---|---|---|---|---|---|---|---|---|
| `owner` | Pemilik | Aqim → Aqim | Semua kartu | Semua, termasuk **satu-satunya** yang bisa mengusulkan, menyetujui, dan mengeksekusi penghapusan aset | Semua | Semua | Semua; **satu-satunya** pemegang bagi hasil (`profit_distribution`) dan modal investor | Semua, termasuk gateway pembayaran dan memberi role Pemilik |  (jawaban programmer B 27/11) |
| `admin` | Admin | Aqim → tidak dipakai | Kartu sesuai hak | Lihat aset; peminjaman penuh (ajukan, setujui, serahkan, kembalikan, hilang) | — | — | — | Anggota dan role (tanpa memberi Pemilik), profil perusahaan, nomor kode, baca audit (server) |  (jawaban programmer B 27/11) |
| `operations_manager` | Manajer Operasional | Aqim → tidak dipakai | Kartu sesuai hak | Kelola kategori dan register aset (tanpa penghapusan), peminjaman penuh, entri penyusutan manual | Setujui kasbon; verifikasi **dan** setujui pertanggungjawaban; anggaran (`budget`) | — | — | — |  (jawaban programmer B 27/11) |
| `project_manager` | Manajer Proyek | Agus, Jamil, Hatta | Kartu proyek | Lihat aset, ajukan dan **setujui** peminjaman | Buat dan ajukan pertanggungjawaban; lihat biaya proyek; lihat anggaran proyek | — | — | — |  (jawaban programmer B 27/11) |
| `technician` | Teknisi | Fahri, Jamil, Agus, Alex, Ade → Fahri, Jamil, Agus, Alex, Ade | (dasbor terbuka, lihat RO20) | Ajukan peminjaman (⚠️ form tidak bisa dipakai, RO7) | Ajukan kasbon dan pertanggungjawaban (⚠️ halamannya tertutup, RO6); lihat anggaran proyek | — | — | — |  (jawaban programmer B 27/11) |
| `freelancer` | Pekerja Lepas | Dafrin, Oki, Alex, Ade, Hatta → Dafrin, Oki | (dasbor terbuka) | — | Buat dan ajukan pertanggungjawaban (⚠️ halamannya tertutup) | — | — | — |  (jawaban programmer B 27/11) |
| `warehouse` | Gudang | Agus, Bilal | (dasbor terbuka) | Serahkan, kembalikan, perpanjang, tandai hilang, tutup peminjaman; **meminjamkan tanpa persetujuan**; tidak bisa membuka Register Aset | — | — | — | — |  (jawaban programmer B 27/11) |
| `finance` | Keuangan | Aqim → tidak dipakai, atau Bella (K2d) | Kartu keuangan | — | Faktur, kuitansi, nota kredit, ajukan penghapusan piutang, pembayaran (buat sampai eksekusi), tagihan pemasok, klaim biaya (buat dan setujui), kas/bank, rekonsiliasi, laporan, bayar gaji, data gaji (`payroll` read/create/update). **Tidak** bisa membaca daftar akun, jurnal, periode | Lihat dan ekspor (XML Coretax, CSV); setor pajak lewat kas/bank | Lihat data investor dan laporan investor | — |  (jawaban programmer B 27/11) |
| `accountant` | Akuntan | Bella → Bella | Kartu keuangan | — (tidak punya `asset:read`) | Daftar akun, pusat biaya, aturan posting, jurnal (buat sampai balik), saldo awal, tutup/kunci/buka periode, setujui penghapusan piutang dan klaim biaya, tagihan pemasok, rekonsiliasi, laporan; kapitalisasi dan penyusutan, anggaran proyek (server saja, RO3) | Semua: tarif, TER PPh 21, catatan pajak, koreksi, pemotongan, verifikasi, tutup PPN | Lihat investor; buat dan terbitkan laporan investor | — |  (jawaban programmer B 27/11) |
| `hr` | SDM | belum ditentukan → Aqim (K2a) | Kartu sesuai hak | — | Rekening gaji karyawan; siapkan dan hitung gaji (tanpa menyetujui) | Hitung ulang PPh 21 di gaji; unduh XML BP21 | — | Lihat anggota, undang (tanpa halaman, RO18) |  (jawaban programmer B 27/11) |
| `auditor` | Auditor | — → dihapus | Kartu baca | Lihat dan ekspor aset/peminjaman | Baca dan ekspor semua | Baca dan ekspor | — | Baca audit, profil perusahaan, nomor kode (server) |  (jawaban programmer B 27/11) |
| `member` | Anggota | Agus, Jamil, Fahri, Bilal, Dafrin, Oki → Dafrin, Oki (lembar: "Hapus") | Dasbor | — | — | — | — | — |  (jawaban programmer B 27/11) |
| Lainnya (`sales_manager`/Penjualan, `customer_service`, `marketing`) | | Agus MD, Bilal | Kartu sesuai hak | Ajukan peminjaman (⚠️ form tidak bisa dipakai) | — | — | — | — | Penjualan digabung (K2b, jawaban programmer B 27/11) |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: kolom Keputusan diisi dari lembar rapat bagian 0 (menunggu konfirmasi Pemilik dan Oki).

**Portal karyawan (`apps/web-employee`) tidak memakai role.** Syaratnya: punya data
karyawan hidup di `human_resource.employees` dan **bukan** pemegang role aplikasi
`admin`, `investor`, atau `customer` (`apps/backend/src/authorization/employee-portal-guard.ts`).
Hak `self_service` di role `member` dan `technician` tidak diperiksa route portal
(`portal-karyawan.md` catatan 12).

### 1.2 Hak per dokumen

Pemilik boleh semua, jadi tidak dimasukkan ke tabel kecuali disebut "hanya Pemilik".

#### Jurnal manual

| Aksi | accountant | finance | Lainnya (baca) |
|---|---|---|---|
| Buat dan ubah draf | ✓ | | |
| Ajukan | ✓ | | |
| **Setujui / tolak** ✋ | ✓ | | |
| Posting | ✓ | | |
| Balik (reverse) dan buang draf | ✓ | | |
| Saldo awal (buat, impor, posting) | ✓ | | |
| Lihat jurnal | ✓ | | auditor |

✋ `apps/backend/src/app/finance/services/manual-journal.service.ts:132-133` (`JournalSelfApprovalError`).

Keputusan: ______________________

#### Faktur dan kuitansi (sisi keuangan)

| Aksi | finance | accountant | Lainnya (baca) |
|---|---|---|---|
| Buat, ubah, batalkan draf faktur | ✓ | | |
| Terbitkan faktur (jurnal otomatis) | ✓ | | |
| Void faktur | ✓ | | |
| Catat kuitansi, link pembayaran online | ✓ | | |
| Batalkan (reverse) kuitansi | ✓ | | |
| Buat nota kredit | ✓ | | |
| Terapkan / batalkan nota kredit | ✓ | ✓ | |
| Ajukan / tarik penghapusan piutang | ✓ | | |
| **Setujui penghapusan piutang** ✋ | | ✓ | |
| Lihat faktur, kuitansi, umur piutang | ✓ | ✓ | auditor |

✋ `apps/backend/src/app/finance/services/receivable-adjustment.service.ts:205` (`WriteOffSelfApprovalError`).

Keputusan: ______________________

#### Tagihan pemasok, pembayaran, dan klaim biaya

| Aksi | finance | accountant | Lainnya |
|---|---|---|---|
| Buat tagihan (manual atau dari PO), batalkan draf | ✓ | ✓ | |
| Rekam tagihan (jurnal) | ✓ | ✓ | |
| Buat, ajukan, **setujui**, eksekusi pembayaran | ✓ | | |
| Void pembayaran (sebelum dan sesudah eksekusi) | ✓ | | |
| Lihat pembayaran | ✓ | ✓ | auditor |
| Buat dan ajukan klaim biaya | ✓ | | |
| **Setujui / tolak klaim biaya** | ✓ | ✓ | |
| Bayar tagihan pemasok dari layar | ⚠️ belum ada layarnya (M09 E4) | | |

Tidak ada ✋: pembayaran hanya mencatat `approvedBy` (`apps/backend/src/app/payment/services/payment.service.ts:150-155`), klaim biaya tidak mengecek pengaju (`apps/backend/src/app/finance/services/expense-claim.service.ts:291`), tagihan pemasok juga tidak.

Keputusan: ______________________

#### Kas/Bank dan rekonsiliasi

| Aksi | finance | accountant | Lainnya (baca) |
|---|---|---|---|
| Buat dan ubah akun kas/bank | ✓ | | |
| Catat mutasi (setoran, beban, setor pajak, settlement gateway) | ✓ | | |
| Bayar gaji / BPJS (`payroll_payment:execute`) | ✓ | | |
| Rekonsiliasi: impor rekening koran, cocokkan, tutup | ✓ | ✓ | |
| Baris manual proyeksi kas | ✓ | | |
| Lihat kas/bank | ✓ | ✓ | auditor |
| Pilih "Akun GL" di form (butuh daftar akun) | ⚠️ ditolak (RO2) | ✓ | |

Keputusan: ______________________

#### Kasbon (uang muka karyawan) dan pertanggungjawaban

| Aksi | technician | project_manager | freelancer | operations_manager | finance |
|---|---|---|---|---|---|
| Buat dan ajukan kasbon | ✓ | | | | |
| **Setujui / tolak kasbon** ✋ (bukan pengaju) | | | | ✓ | |
| Cairkan kasbon (lewat pembayaran) | | | | | ✓ |
| Buat dan ajukan pertanggungjawaban | ✓ | ✓ | ✓ | | |
| **Verifikasi** ✋ (bukan pengaju) | | | | ✓ | |
| **Setujui** ✋ (bukan verifikator) | | | | ✓ | |
| Lihat | ✓ | ✓ (pertanggungjawaban) | ✓ (pertanggungjawaban) | ✓ | |

✋ `apps/backend/src/app/finance/services/employee-advance.service.ts:126` (kasbon), `:217` (verifikasi), `:235` (persetujuan). Keuangan dan Akuntan tidak punya hak `advance`/`settlement` sama sekali.

Keputusan: ______________________

#### Aset tetap dan penyusutan (Keuangan)

| Aksi | accountant | operations_manager | project_manager | admin | Lainnya |
|---|---|---|---|---|---|
| Lihat daftar aset tetap, laporan fiskal | ⚠️ tidak bisa | ✓ | ✓ | ✓ | auditor |
| Kapitalisasi aset (jurnal) | ✓ (server) | | | | |
| Ubah kelompok fiskal | ✓ (server) | | | | |
| Jalankan penyusutan bulanan | ✓ (server) | | | | |
| Entri penyusutan manual (Inventaris → Penyusutan) | | ✓ | | | |
| Lihat penyusutan | | ✓ | ✓ | ✓ | auditor |

Keputusan: ______________________

#### Aset, peminjaman, dan penghapusan (M06)

| Aksi | operations_manager | project_manager | warehouse | technician / Penjualan / customer_service | admin |
|---|---|---|---|---|---|
| Kategori aset, daftarkan/ubah/nonaktifkan aset, tempatkan, pindahkan | ✓ | | | | |
| Lihat register aset | ✓ | ✓ | | | ✓ |
| Catatan servis, cek kondisi | ✓ | | | | |
| Ajukan peminjaman | ✓ | ✓ | | ✓ (⚠️ form butuh `asset:read`) | ✓ |
| **Setujui / tolak peminjaman** | ✓ | ✓ | | | ✓ |
| Serahkan unit (juga tanpa persetujuan) | ✓ | | ✓ | | ✓ |
| Kembalikan, perpanjang, tandai hilang, tutup | ✓ | | ✓ | | ✓ |
| Usul, setujui, eksekusi, batalkan penghapusan aset | | | | | hanya Pemilik |

Peminjaman **tidak** ✋ dalam praktik: lihat RO7. Penghapusan tidak mengecek pengusul (`apps/backend/src/app/inventory/services/disposal.service.ts:94-106`).

Keputusan: ______________________

#### Pajak: catatan pajak, pemotongan, setor dan tutup PPN, Coretax

| Aksi | accountant | finance | hr | Lainnya |
|---|---|---|---|---|
| Jenis dan tarif pajak (tambah, ubah, hapus) | ✓ | | | |
| Impor tabel TER PPh 21 | ✓ | | | |
| Pengaturan PPh 21 dan BPJS | | | | hanya admin aplikasi (Aqim) |
| Catatan pajak: buat, ubah draf, koreksi | ✓ | | | |
| **Verifikasi / lapor catatan pajak** | ✓ | | | |
| Pemotongan: catat, isi data Coretax, verifikasi, bayar, batalkan | ✓ | | | |
| Ekspor XML Coretax (faktur, bupot), CSV, XLSX | ✓ | ✓ | | auditor |
| Tutup PPN bulanan (jurnal, `journal:post`) | ✓ | | | |
| Setor pajak (mutasi kas/bank) | | ✓ | | |
| Hitung ulang PPh 21 di rekap gaji | | | ✓ | |
| Unduh XML BP21 | | ✓ | ✓ | |
| Lihat catatan, rekap, pemotongan | ✓ | ✓ | | auditor |

Tidak ada ✋: verifikasi hanya mencatat `verifiedBy` (`apps/backend/src/app/tax/services/tax.service.ts:322-324`). Hak `tax:create` tidak dipakai route mana pun; semua route tulis memakai `tax:update` (`m10-pajak.md` catatan 8).

Keputusan: ______________________

#### Periode dan tutup buku

| Aksi | accountant | finance | Lainnya |
|---|---|---|---|
| **Siapkan periode** (buat periode bulan) | | | **tidak ada siapa pun, termasuk Pemilik** (RO1) |
| Daftar periksa tutup bulan | ✓ | | |
| Tutup periode (snapshot saldo) | ✓ | | |
| Kunci periode (jurnal manual harus sudah diposting) | ✓ | | |
| Buka kembali periode terkunci | ✓ (⚠️ seharusnya hanya Pemilik, RO4) | | |
| Arsipkan laporan bulanan | ✓ | | |
| Lihat periode | ✓ | | auditor |
| Lihat dan ekspor laporan keuangan | ✓ | ✓ | auditor |
| Simpan dan aktifkan anggaran proyek (`journal:approve`) | ✓ (server; halaman butuh `project.read`) | | |

Keputusan: ______________________

#### Pengguna, undangan, role, audit, nomor kode

| Aksi | admin | hr | auditor | Lainnya |
|---|---|---|---|---|
| Undang, kirim ulang, batalkan undangan (Administrasi → Pengguna) | | | | hanya admin aplikasi (Aqim); dicek di controller (`user/controllers/invitation.controller.ts:48-51`) |
| Nonaktifkan, pulihkan akun | ✓ (server) | | | halaman hanya admin aplikasi |
| Ubah role anggota (Administrasi → Organisasi → anggota) | ✓ (tidak bisa memberi Pemilik) | | | |
| Keluarkan anggota | ✓ | | | |
| Lihat anggota, undangan organisasi | ✓ | ✓ (tanpa halaman) | | |
| Baca log audit | ✓ (server) | | ✓ (server) | halaman `/admin/*` hanya admin aplikasi |
| Ubah profil perusahaan, kop, pengaturan nilai | ✓ | | baca | |
| Nomor kode: lihat, pratinjau, ubah | ✓ | | baca | admin aplikasi juga |
| Gateway pembayaran | | | | hanya Pemilik |
| Pengaturan penggajian | | | | hanya admin aplikasi |
| Ubah organisasi; hapus organisasi | ✓; — | | | hapus hanya Pemilik |

Keputusan: ______________________

#### Investor (M11)

| Aksi | finance | accountant | Lainnya |
|---|---|---|---|
| Lihat data investor | ✓ | ✓ | |
| Tambah/ubah investor, komitmen modal, setoran, alokasi dana | | | hanya Pemilik |
| Hitung, ajukan, setujui, bayar bagi hasil | | | hanya Pemilik |
| Buat dan terbitkan laporan investor | | ✓ | |
| Lihat laporan investor | ✓ | ✓ | |

Semua baris ini **baru kosakata hak**: halaman admin masih "Segera hadir", tidak ada
route backend, dan schema `investor` sudah dihapus (ADR-0024). Lihat K10.

Keputusan: ______________________

### 1.3 Hal yang perlu diputuskan

1. **Siapkan periode.** Tombol "Siapkan periode" memakai hak `accounting_period:create` yang tidak ada di kosakata, dan seeder tidak membuat periode. Posting jurnal mencari periode bulan itu dan gagal bila tidak ada. Beri hak ke Akuntan (dan Pemilik), atau periode dibuat otomatis?
2. **Buka kembali periode terkunci.** Rencana M09: hanya Pemilik, tercatat audit. Kode: Akuntan juga bisa (RO4). Pilih salah satu.
3. **Keuangan membaca daftar akun, jurnal, dan periode?** Tanpa itu form kas/bank dan klaim biaya untuk role Keuangan gagal (RO2).
4. **Akuntan membaca aset dan proyek?** Tanpa itu halaman Aset tetap dan Anggaran proyek hanya bisa dipakai Pemilik (RO3).
5. **Pertanggungjawaban butuh dua orang berbeda** (verifikator dan penyetuju), keduanya hanya Aqim. Sesuai K1a = (b), alur ini macet (RO5). Ubah aturannya, atau beri satu hak ke orang kedua?
6. **Akses kasbon dan pertanggungjawaban untuk teknisi, PM, dan Pekerja Lepas.** Halamannya ada di Keuangan → Beban yang tertutup bagi mereka; portal karyawan tidak punya halamannya (RO6). Di mana mereka mengajukan?
7. **Peminjaman aset:** perbaiki aturan menyetujui sendiri (K7a = perbaiki), dan putuskan apakah Gudang boleh meminjamkan tanpa persetujuan (M06 C13).
8. **Pembayaran, klaim biaya, verifikasi pajak, dan gaji tanpa pemeriksa kedua.** K7a menerima pembayaran dan gaji tanpa pemeriksa. Klaim biaya dan verifikasi pajak ikut diterima?
9. **Penghapusan aset hanya Pemilik** (usul sampai eksekusi). Sesuai?
10. **Siapa membaca log audit?** K1 bergantung pada audit, tetapi halamannya hanya untuk admin aplikasi (Aqim) dan perubahan role tidak tercatat (RO12). Perlukah Bella membacanya?
11. **Data gaji untuk Bella.** Bila Bella memegang Keuangan (K2d), ia melihat dan mengubah gaji serta rekening semua karyawan. Diterima?
12. **M11:** dibangun dengan ADR baru atau ditunda (K10). Bila dibangun, siapa selain Pemilik yang mengerjakan?
13. **Login portal karyawan** (K13 hanya menyebut web-admin dan portal pelanggan): tombol Google di portal karyawan tetap atau dihapus? Aqim (akun `admin`) tidak bisa masuk portal karyawan; perlu akun kedua atau tidak?

***

## Bagian 2 - Checklist UAT

Checklist UAT modul Oki ada di folder
[uat-modul/modul-oki/](uat-modul/modul-oki/README.md): M12, M01, M09 (transaksi
dan laporan), M10, M06, M11, dan portal karyawan, dengan urutan yang disarankan di
README-nya. Langkah hak akses per role ada di M01 bagian D–E, M09 transaksi A dan
laporan L, M06 C1 dan C20, M11 B, serta M12 E dan H3. Temuan di folder itu
adalah **pertanyaan untuk Oki**, bukan perbaikan yang langsung dikerjakan.

***

## Bagian 3 - Validasi dengan tim saat ini (2026-11-27)

Tim dan arah keputusan diambil dari [lembar-keputusan-rapat.md](lembar-keputusan-rapat.md):
10 karyawan + 2 pengembang; K1 = (b) Pemilik boleh menyetujui dokumennya sendiri
dengan audit; K1a tercatat "B" (jurnal, kasbon, dan pertanggungjawaban **tetap**
butuh orang kedua; perlu dikonfirmasi saat rapat karena rekomendasinya berbeda
untuk kasbon); K2 = (a); K2a = Aqim SDM; K2d belum diisi, rekomendasi (b) Bella
memegang Akuntan **dan** Keuangan.

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab (lembar rapat bagian 0, menunggu konfirmasi Pemilik dan Oki): K1a diganti, kasbon dan pertanggungjawaban ikut K1 dan Aqim tidak mengajukan kasbon, jurnal tetap orang kedua; RO5 satu langkah oleh Aqim; K2d **(a) gabung** (Bella memegang role Keuangan gabungan); Anggota dihapus (Dafrin dan Oki hanya Pekerja Lepas); role organisasi Admin dihapus; RO1 periode dibuat Pemilik dan Keuangan; RO4 buka kembali hanya Pemilik; OG1 absen di luar radius ditolak; K10 ditunda.

### 3.1 Tim dan haknya di modul Oki

Asumsi: susunan role usulan K2, ditambah K2d (b) untuk Bella. → diganti 27/11: K2d (a), Bella memegang satu role Keuangan gabungan; hak efektifnya sama dengan baris Bella pertama.

| Orang | Role (usulan) | Hak efektif di modul Oki |
|---|---|---|
| **Aqim** | Pemilik, SDM, tanda admin aplikasi di akun `admin` | Semua: semua dasbor, aset dan penghapusan, keuangan, pajak, investor, pengguna, audit, nomor kode, gateway, pengaturan penggajian. Tidak bisa masuk portal karyawan dengan akun `admin` |
| **Bella** | Akuntan, Keuangan (K2d b) → diganti: Keuangan gabungan (K2d a, 27/11) | Gabungan: faktur, kuitansi, pembayaran, tagihan, klaim, kas/bank, rekonsiliasi, bayar gaji, data gaji karyawan; daftar akun, jurnal, periode, laporan, semua pajak, laporan investor. **Tidak**: aset (halaman Aset tetap tertutup), anggaran proyek (halaman tertutup), kasbon/pertanggungjawaban, audit |
| **Bella** (bila K2d tidak diambil) | Akuntan saja (tidak berlaku setelah K2d gabung, 27/11) | Seperti di atas tanpa faktur, kuitansi, pembayaran, klaim (hanya setujui), kas/bank (hanya rekonsiliasi), gaji |
| **Agus** | Manajer Proyek, Teknisi, Gudang | Ajukan, **setujui**, serahkan, dan kembalikan peminjaman, termasuk miliknya sendiri; lihat register aset; kasbon dan pertanggungjawaban (lewat API, halamannya tertutup); biaya dan anggaran proyek (lihat) |
| **Jamil** | Manajer Proyek, Teknisi | Ajukan dan setujui peminjaman; lihat register aset; kasbon dan pertanggungjawaban (halamannya tertutup); biaya dan anggaran proyek (lihat) |
| **Hatta** | Manajer Proyek | Ajukan dan setujui peminjaman; lihat register aset; pertanggungjawaban (halamannya tertutup); tanpa kasbon |
| **Fahri, Alex, Ade** | Teknisi | Ajukan peminjaman (form tidak bisa dipakai); kasbon dan pertanggungjawaban (halamannya tertutup); lihat anggaran proyek |
| **Bilal** | Penjualan, Gudang, Layanan Pelanggan, Pemasaran | Serahkan dan kembalikan peminjaman, meminjamkan tanpa persetujuan; ajukan peminjaman (form tidak bisa dipakai); kartu dasbor penjualan dan stok |
| **Agus MD** | Penjualan | Kartu dasbor penjualan; tautan Stok di dasbor ditolak (M01); ajukan peminjaman (form tidak bisa dipakai) |
| **Dafrin, Oki** | Pekerja Lepas, Anggota → diganti: Pekerja Lepas saja (X4, 27/11) | Pertanggungjawaban (halamannya tertutup); dasbor; portal karyawan **bila** punya data karyawan; tanpa absensi dan slip gaji di aplikasi (27/11) |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: Penjualan digabung (Agus MD, Bilal), Keuangan digabung dengan Akuntan (Bella), Anggota dihapus (Dafrin, Oki hanya Pekerja Lepas), role organisasi Admin dihapus.

Semua orang di atas bisa membuka dasbor, karena hak `dashboard:read` tidak dipakai (RO20).

### 3.2 Temuan dari susunan ini

| No | Temuan | Dampak | Usulan |
|---|---|---|---|
| **RO1** | **Tidak ada yang bisa menyiapkan periode akuntansi.** `POST /finance/periods` meminta `accounting_period:create` (`apps/backend/src/app/finance/controllers/ledger.controller.ts:191`), padahal kosakata hanya `read`, `close`, `reopen` (`erp-permissions.ts:120`); guard tidak punya jalan pintas untuk Pemilik (`apps/backend/src/authorization/elysia-auth.ts:202-221`). Seeder tidak membuat periode. Posting mencari periode bulan itu dan melempar `PeriodNotFoundError` bila tidak ada (`apps/backend/src/app/finance/services/posting.service.ts:436-438`) | 🔴 ⚠️ Di database baru, terbit faktur, kuitansi, tagihan, dan jurnal apa pun diduga gagal sampai periode ada. Perlu dicek di database dev apakah tabel periode sudah berisi | Tambah aksi `create` ke `accounting_period` dan beri ke Akuntan (dan Pemilik), atau buat periode otomatis saat posting pertama di bulan itu |
| **RO2** | Role **Keuangan** tidak punya `chart_of_account:read`, `journal:read`, `accounting_period:read` (`erp-permissions.ts:746-784`), padahal form Akun GL kas/bank, akun lawan, akun beban klaim, dan pilihan akun Buku Besar memuat daftar akun (`/finance/ledger/accounts`) | Untuk akun yang **hanya** Keuangan, form itu gagal (M09 C1, C3, G1; laporan L1). Bila Bella memegang Keuangan + Akuntan, haknya tergabung dan masalah ini tidak terasa | Beri Keuangan `chart_of_account:read` (minimal) agar role tetap utuh untuk staf keuangan baru |
| **RO3** | Role **Akuntan** tidak punya `asset:read` dan `project:read` (`erp-permissions.ts:786-813`). Server mengizinkan Akuntan kapitalisasi dan penyusutan (`journal:post`) serta menyimpan anggaran proyek (`journal:approve`), tetapi daftar aset tetap butuh `asset:read` dan menu Aset tetap/Anggaran proyek butuh `asset.read`/`project.read` | Bella tidak bisa membuka Aset tetap dan Anggaran proyek; hanya Aqim | Beri Akuntan `asset:read` dan `project:read` |
| **RO4** | **Buka kembali periode terkunci tidak terbatas pada Pemilik.** Route transisi memasang `ownership: { reopen: 'owner' }` (`ledger.controller.ts:210-213`), tetapi macro `erp` hanya membaca `permission` dan `policy` (`elysia-auth.ts:165-170`, `:258-262`), jadi opsi itu diabaikan. Akuntan punya `accounting_period:reopen` (`erp-permissions.ts:792`) | ⚠️ Bella bisa membuka periode yang sudah dikunci, berbeda dari rencana M09 ("A reopen is owner-only and audited"). Pembukaan tetap tercatat (`reopened_by`, audit `accounting_period.reopened`) | Putuskan (1.3 no. 2); bila hanya Pemilik, ganti dengan `policy` atau cabut `reopen` dari Akuntan |
| **RO5** | **Pertanggungjawaban macet.** Verifikator harus beda dari pengaju, penyetuju harus beda dari verifikator (`employee-advance.service.ts:217`, `:235`). Hak verifikasi dan setuju hanya `owner` dan `operations_manager`; dengan K2 keduanya hanya Aqim | 🔴 Aqim memverifikasi, lalu tidak ada orang lain untuk menyetujui. Ini **membetulkan** tabel 3.7 dokumen programmer B yang menulis "Kasbon dan pertanggungjawaban: aman" | Pilih: (a) satu langkah saja (verifikasi digabung dengan persetujuan); (b) Bella diberi hak verifikasi; (c) K1a untuk pertanggungjawaban = (a), dengan pengecualian Pemilik di kode |
| **RO6** | **Halaman kasbon dan pertanggungjawaban tertutup bagi pengaju.** Panel ada di Keuangan → Beban (`apps/web-admin/src/routes/_authed/finance/expenses/index.tsx`), menu itu butuh `expense_claim.read`, dan route guard web-admin memakai aturan menu yang sama (`apps/web-admin/src/lib/route-guard.ts:31`). Teknisi, PM, dan Pekerja Lepas tidak punya hak itu. Portal karyawan tidak punya halaman kasbon. Teknisi juga tidak punya `employee:read` untuk pemilih karyawan, dan seeder tidak membuat data karyawan untuk teknisi | ⚠️ Dalam praktik hanya Aqim yang bisa membuat kasbon dan pertanggungjawaban | Tentukan tempatnya: menu sendiri di web-admin dengan hak `advance.read`/`settlement.read`, atau halaman di portal karyawan |
| **RO7** | **Peminjaman aset tanpa pemeriksa.** `canApprove` diisi dari hak `approve` (`apps/backend/src/app/inventory/controllers/borrowing.controller.ts:38`), padahal route approve sudah mewajibkan hak itu, jadi larangan di `borrowing-request.service.ts:259-265` tidak pernah berlaku. Gudang boleh menyerahkan unit yang belum disetujui (`borrowing.service.ts:160`, M06 C13). Form pengajuan memuat unit dari `/inventory/items` (`asset:read`), yang tidak dimiliki Teknisi, Penjualan, Layanan Pelanggan, dan Gudang | 🟡 Agus (PM + Gudang) bisa mengajukan, menyetujui, dan menyerahkan pinjamannya sendiri. Fahri, Alex, Ade, Bilal, Agus MD tidak bisa mengisi form | Sesuai K7a: perbaiki. Usulan: pembuat tidak boleh menyetujui, kecuali Pemilik (K1). Beri `asset:read` ke pengaju, atau form memakai daftar unit khusus peminjaman |
| **RO8** | **Gaji tanpa cek pembuat.** Persetujuan periode gaji hanya butuh `payroll:approve` (Pemilik saja) dan tidak membandingkan dengan penyiap (`apps/backend/src/app/human-resource/services/salary.service.ts:197-198`) | 🟡 Aqim (SDM) menyiapkan dan Aqim (Pemilik) menyetujui; sesuai K1 tetapi tanpa catatan "disetujui pembuat". Bila Bella memegang Keuangan, **pembayaran** gaji dilakukan Bella, jadi ada orang kedua di langkah bayar | Tambah catatan audit sesuai K1; pembayaran gaji oleh Bella |
| **RO9** | **Pembayaran dan klaim biaya tanpa maker-checker** (`payment.service.ts:150-155`, `expense-claim.service.ts:291`). Tagihan pemasok juga tidak | 🟡 Pemegang Keuangan membuat, menyetujui, dan mengeksekusi sendiri. Dengan K2d (b) itu Bella; tanpa K2d, Aqim | K7a sudah menerima untuk pembayaran. Pemeriksa: Aqim lewat laporan dan rekonsiliasi |
| **RO10** | **Bella dan Aqim satu-satunya pasangan keuangan.** Jurnal manual ✋ dan penghapusan piutang ✋ butuh dua orang; pemegang `journal:approve` dan `ar_write_off:approve` hanya Pemilik dan Akuntan | 🟢 selama keduanya ada. Jurnal Bella menunggu Aqim; bila Aqim tidak sempat, jurnal tertahan dan periode tidak bisa dikunci (kunci menolak jurnal yang belum diposting) | Diterima; atur jadwal persetujuan bulanan sebelum tutup buku |
| **RO11** | **Penghapusan aset hanya Pemilik** dan tanpa cek pengusul (`disposal.service.ts:94-106`) | 🟡 Aqim mengusulkan, menyetujui, dan mengeksekusi sendiri. Sesuai K1 | Tambah catatan audit "disetujui pembuat"; sudah ada audit `asset.disposal_approved` |
| **RO12** | **Audit belum cukup untuk K1.** Perubahan role dan pengeluaran anggota tidak diaudit (`apps/backend/src/app/organization/services/organization.service.ts`, M12 catatan); audit ditulis fire-and-forget (`skema-database/audit.md`); halaman Log Audit hanya untuk admin aplikasi (`nav-config.ts`, item Log Audit `appAdminOnly`) dan filternya hanya tindakan modul user | Persetujuan sendiri Pemilik bisa tidak tercatat, dan hanya Aqim yang bisa membaca log, sehingga tidak ada pemeriksa | L-1 di `rencana-perubahan.md` (audit ikut transaksi) sebelum K1; audit perubahan role; putuskan apakah Bella membaca audit |
| **RO13** | **Pajak di satu tangan.** Catatan pajak dibuat dan diverifikasi oleh orang yang sama tanpa penolakan (`tax.service.ts:322-324`); semua hak tulis pajak hanya Pemilik dan Akuntan | 🟡 Bella membuat, memverifikasi, melaporkan, dan menutup PPN; setor pajak oleh Keuangan (Bella bila K2d) | Diterima untuk tim kecil; Aqim memeriksa rekap pajak bulanan |
| **RO14** | **M11 belum dibangun.** Halaman admin "Segera hadir"; tidak ada route backend; `/finance/investors` terbuka untuk semua yang login karena bukan daun menu (`apps/web-admin/src/lib/route-guard.ts:31-32`); `apps/web-investor` masih template | Tidak ada yang perlu disetujui sekarang. Hak bagi hasil hanya Pemilik | K10 |
| **RO15** | **Portal karyawan tidak bergantung role.** Aksesnya ditentukan data karyawan dan penolakan role aplikasi `admin`/`investor`/`customer` | Menghapus Anggota (isian lembar) **tidak** menutup portal untuk Dafrin dan Oki selama mereka punya data karyawan. Aqim tidak bisa masuk dengan akun `admin`. Akun teknisi seeder tidak punya data karyawan | Catat; putuskan 1.3 no. 13 |
| **RO16** | **Dampak K2 di modul Oki.** Manajer Operasional tidak dipakai, padahal ia satu-satunya pemegang non-Pemilik untuk register aset, entri penyusutan manual, persetujuan kasbon, dan verifikasi/persetujuan pertanggungjawaban. Admin dan Auditor tidak dipakai, jadi `audit_log:read` tinggal Pemilik | Semua pekerjaan itu jatuh ke Aqim; pertanggungjawaban macet (RO5) | Terima, atau beri Manajer Operasional ke Agus (PM) bila Aqim ingin melepas urusan aset dan kasbon |
| **RO17** | **Dampak K2d.** (a) gabung = ubah `erpRoleGrants` (wilayah Oki) dan `docs/role-permission.md`; (b) dua role = data saja. Dengan (b), Bella mendapat `employee:read_private` dan `payroll` read/create/update dari Keuangan | Bella melihat gaji dan rekening semua karyawan; pemisahan bayar gaji (RO8) jadi mungkin | Rekomendasi tetap (b); Pemilik menjawab 1.3 no. 11 |
| **RO18** | **Dampak K12 (hapus lapisan organisasi)** di modul Oki: ganti organisasi di dasbor (M01 C4) dan sidebar; seluruh M12 bagian E (organisasi, anggota, role per organisasi); undangan per organisasi; kolom `organization_id` di tabel finance dan tax; header `x-organization-id` di guard; cara portal karyawan mengenali karyawan; role SDM yang punya `invitation:create` tanpa `organization:read` jadi tidak relevan | Perubahan terbesar ada di wilayah Oki (M12, guard, ADR-0006/ADR-0031) | Bertahap, dengan ADR baru, `docs.dbml`, dan migrasi (rekomendasi lembar: (b)) |
| **RO19** | **Dampak K13 (login).** Web-admin memakai `signIn.social` di `apps/web-admin/src/components/form/login-form.tsx`; Google di server tetap `disableSignUp: true`. Portal karyawan juga punya tombol Google (`apps/web-employee/src/components/form/login-form.tsx`), yang tidak disebut K13 | UAT M12 A1/A2 (nama pengguna dan email) tetap berlaku; uji Google di web-admin dihapus | Putuskan portal karyawan (1.3 no. 13) |
| **RO20** | Hak `dashboard:read` tidak dipakai: dasbor terbuka bagi semua role internal, kartunya mengikuti hak masing-masing. Tautan Stok di dasbor ditolak untuk Penjualan dan Pemasaran tanpa Gudang (M01 catatan) | Agus MD melihat tautan yang ditolak; Bilal tidak (punya Gudang) | Sembunyikan tautan bila tidak ada `stock.read` |

### 3.3 Jawaban sementara untuk 1.3 berdasarkan tim

| No 1.3 | Pertanyaan | Jawaban sementara | Masih perlu keputusan |
|---|---|---|---|
| 1 | Siapkan periode | Harus diperbaiki sebelum keuangan dipakai; usulan: hak `create` untuk Akuntan dan Pemilik, atau periode otomatis | Ya (Oki, RO1) |
| 2 | Buka kembali periode | Ikuti rencana M09: hanya Pemilik (Aqim), dengan alasan dan audit; Bella cukup tutup dan kunci | Ya (Pemilik + Oki) |
| 3 | Keuangan membaca daftar akun | Tidak terasa bila Bella memegang dua role; tetap diperbaiki agar role Keuangan utuh | Tidak, cukup diperbaiki (Oki) |
| 4 | Akuntan membaca aset dan proyek | Ya; Bella yang mengerjakan kapitalisasi dan penyusutan | Tidak, cukup diperbaiki (Oki) |
| 5 | Pertanggungjawaban dua orang | Macet dengan K1a = (b). Usulan: (a) satu langkah verifikasi-setuju oleh Aqim, atau Bella memverifikasi | Ya (Pemilik, terkait K1a) |
| 6 | Akses kasbon untuk pengaju | Usulan: halaman di portal karyawan, karena teknisi sudah absen dan melapor di sana | Ya (Oki) |
| 7 | Peminjaman aset | Perbaiki sesuai K7a; Gudang meminjamkan tanpa persetujuan hanya untuk Pemilik | Ya, untuk C13 |
| 8 | Tanpa pemeriksa kedua | Pembayaran dan gaji: diterima (K7a). Klaim biaya dan verifikasi pajak: usul diterima, diawasi lewat laporan | Ya, untuk klaim dan pajak |
| 9 | Penghapusan aset hanya Pemilik | Sesuai: Aqim pemilik aset; dengan audit (K1) | Tidak |
| 10 | Pembaca audit | Aqim; Bella perlu bila ia pemeriksa persetujuan sendiri Aqim | Ya |
| 11 | Data gaji untuk Bella | Bergantung K2d; bila (b), Bella melihat gaji | Ya (Pemilik) |
| 12 | M11 | Belum ada yang bisa diuji; K10 | Ya (K10) |
| 13 | Login portal karyawan, akun Aqim | Belum dibahas di K13; Aqim tidak cuti (A3a), jadi akun kedua belum perlu | Ya |

### 3.4 Alur kerja per role

Menu ditulis seperti di aplikasi (`packages/locales/src/id/nav.ts`). "→" berarti dokumen pindah ke orang lain.

**Pemilik (Aqim).**
1. Administrasi → Pengguna: undang, nonaktifkan, pulihkan akun; Administrasi → Organisasi → anggota: atur role. Administrasi → Log Audit.
2. Pengaturan → Perusahaan, Nomor Kode, Gateway pembayaran, Penggajian.
3. Keuangan → Jurnal: menyetujui jurnal buatan Bella. Keuangan → Piutang: menyetujui penghapusan piutang yang diajukan Bella. Keuangan → Tutup Periode: membuka kembali periode bila perlu.
4. Inventaris → Aset & Peralatan → Register Aset, Kategori Aset, Penghapusan Aset, Penyusutan. Peminjaman: menyetujui bila PM tidak ada.
5. Keuangan → Beban: menyetujui kasbon, memverifikasi pertanggungjawaban (persetujuannya macet, RO5).
6. Sumber Daya Manusia → Penggajian: siapkan dan setujui gaji (sebagai SDM dan Pemilik).
7. Bonus & Investor: belum ada isinya.

**Akuntan + Keuangan (Bella, K2d b).**
1. CRM & Penjualan → Faktur: terbitkan faktur dari SO → Kuitansi: catat pembayaran pelanggan.
2. Keuangan → Utang: rekam tagihan pemasok (manual atau dari PO) → pembayaran (layar bayar tagihan belum ada, M09 E4).
3. Keuangan → Kas & Bank: mutasi, setor pajak, bayar gaji. Keuangan → Rekonsiliasi: impor rekening koran, cocokkan, tutup.
4. Keuangan → Jurnal: jurnal penyesuaian → Ajukan → (Aqim menyetujui) → Posting. Keuangan → Saldo Awal, Daftar Akun, Aturan Posting, Pusat Biaya.
5. Keuangan → Aset tetap: kapitalisasi dan jalankan penyusutan (halaman tertutup sampai RO3 diperbaiki).
6. Pajak → Catatan Pajak, Pemotongan Pajak, Koreksi & Bukti, Rekap Pajak, Tabel PPh 21, Jenis & Tarif Pajak; ekspor XML Coretax; tutup PPN bulanan.
7. Keuangan → Tutup Periode: daftar periksa → Tutup → Kunci. Laporan → Arsip Bulanan. Keuangan → Laporan Keuangan.

**SDM (Aqim).** Sumber Daya Manusia → Penggajian: siapkan gaji bulan → hitung ulang PPh 21 → (Aqim sebagai Pemilik menyetujui) → slip gaji terbit → Bella membayar lewat Kas & Bank → unduh XML BP21.

**Manajer Proyek (Agus, Jamil, Hatta).** Inventaris → Aset & Peralatan → Peminjaman: ajukan untuk teknisi atau tamu → setujui pinjaman orang lain (aturannya belum mencegah pinjaman sendiri, RO7). Register Aset: lihat. Keuangan → Anggaran proyek: lihat (simpan oleh Bella/Aqim). Pertanggungjawaban: haknya ada, halamannya tertutup (RO6).

**Teknisi (Fahri, Jamil, Agus, Alex, Ade).** Peminjaman: haknya ada, form tidak bisa dipakai (RO7). Kasbon → (Aqim menyetujui) → Bella mencairkan → pertanggungjawaban → (macet, RO5); halamannya tertutup (RO6). Portal karyawan: absen, lokasi proyek, cuti, slip gaji (bila punya data karyawan).

**Gudang (Agus, Bilal).** Inventaris → Aset & Peralatan → Peminjaman: serahkan unit yang disetujui (atau langsung, C13) → kembalikan → tutup; perpanjang dan tandai hilang. Tidak bisa membuka Register Aset.

**Pekerja Lepas (Dafrin, Oki).** Pertanggungjawaban (halamannya tertutup). Portal karyawan bila punya data karyawan.

**Penjualan, Layanan Pelanggan, Pemasaran (Agus MD, Bilal).** Dasbor: kartu penjualan, katalog, tiket sesuai hak. Peminjaman: haknya ada, form tidak bisa dipakai.

### 3.5 Alur lintas orang (contoh nyata)

| Alur | Urutan orang |
|---|---|
| Faktur → kuitansi → jurnal → rekonsiliasi | Bilal buat SO → Bella terbitkan faktur (jurnal piutang otomatis) → pelanggan bayar → Bella catat kuitansi (jurnal kas otomatis) → Bella rekonsiliasi rekening koran → Aqim memeriksa lewat laporan (🟡, satu orang dari faktur sampai rekonsiliasi bila K2d b) |
| Pembelian aset → kapitalisasi → penyusutan | Aqim buat dan setujui PO (K1) → Agus/Bilal terima barang → Bella rekam tagihan → Bella bayar (layar belum ada) → Aqim daftarkan aset di Register Aset → Bella kapitalisasi (⚠️ halaman tertutup, RO3; sekarang Aqim) → Bella jalankan penyusutan tiap akhir bulan → penghapusan kelak oleh Aqim saja |
| Tutup bulan | Bella posting semua jurnal → Aqim menyetujui jurnal Bella yang tertunda (RO10) → Bella rekonsiliasi kas/bank → Bella jalankan penyusutan → Bella tutup periode (snapshot) → Bella kunci → Bella arsipkan laporan → Aqim baca paket manajemen. **Syarat:** periode bulan itu sudah ada (🔴 RO1) |
| Gaji | Aqim (SDM) siapkan dan hitung PPh 21 → Aqim (Pemilik) setujui (🟡, K1) → slip gaji terbit di portal karyawan → Bella bayar gaji lewat Kas & Bank (orang kedua di langkah bayar) → Bella periksa jurnal → Bella/Aqim unduh XML BP21 |
| Pajak bulanan | Bella catat dan verifikasi catatan pajak serta pemotongan (🟡) → Bella ekspor XML Coretax dan unggah di Coretax → Bella tutup PPN (jurnal) → Bella setor pajak lewat Kas & Bank → Bella tandai pemotongan dibayar → Aqim memeriksa rekap |
| Kasbon teknisi | Fahri ajukan kasbon (⚠️ halaman tertutup) → Aqim setujui ✋ → Bella cairkan lewat pembayaran → Fahri buat pertanggungjawaban → Aqim verifikasi ✋ → **tidak ada penyetuju kedua (🔴 RO5)** |
| Peminjaman alat | Jamil ajukan untuk Fahri → Agus atau Hatta setujui (Jamil juga bisa menyetujui sendiri, RO7) → Agus/Bilal serahkan unit → Fahri pakai → Agus/Bilal terima kembali dan tutup |
| Penghapusan piutang | Bella (Keuangan) ajukan → Bella tidak bisa menyetujui ✋ → Aqim setujui → jurnal ke cadangan kerugian piutang (catatan M09: cadangan belum dibentuk) |

### 3.6 Yang perlu dijawab Pemilik dan Oki

1. **RO1:** periode dibuat Akuntan atau otomatis? (Oki) *(27/11: Pemilik dan Keuangan, hak `accounting_period:create`)*
2. **RO4:** buka kembali periode hanya Pemilik? (Pemilik) *(27/11: ya, hanya Pemilik)*
3. **RO5:** pertanggungjawaban satu langkah, Bella memverifikasi, atau K1a diubah untuk pertanggungjawaban? (Pemilik) *(27/11: satu langkah oleh Aqim)*
4. **RO6:** pengaju kasbon dan pertanggungjawaban memakai web-admin atau portal karyawan? (Oki)
5. **RO7 / C13:** aturan baru peminjaman, dan Gudang boleh meminjamkan tanpa persetujuan? (Pemilik + Oki) *(27/11: teknisi mengajukan dari daftar unit khusus, OD1; persetujuan sendiri diperbaiki, OD2)*
6. **RO12:** audit ikut transaksi dan perubahan role diaudit sebelum K1 dijalankan? Bella boleh membaca Log Audit? (Oki + Pemilik) *(27/11: audit wajib ikut transaksi, sebelum K1)*
7. **RO16:** semua urusan aset dan kasbon tetap di Aqim, atau Manajer Operasional diberikan ke orang kedua? (Pemilik)
8. **RO17 / K2d:** Bella memegang Keuangan dan melihat data gaji? (Pemilik) *(27/11: ya, Akuntan digabung ke Keuangan)*
9. **RO19:** tombol Google di portal karyawan? (Pemilik + Oki) *(27/11: dihapus; karyawan diundang, login dengan kata sandi)*
10. **K10:** M11 dibangun atau ditunda? (Pemilik + Oki) *(27/11: ditunda, halaman investor hanya Pemilik)*

### 3.7 Peta bentrok persetujuan

Pembuat dan penyetuju memakai susunan role usulan K2 dan K2d (b). Diperbarui 27/11: K2d (a), Bella memegang role Keuangan gabungan; kolom Status menulis kondisi sesudah keputusan bila berbeda. ✋ = kode menolak
penyetuju yang sama dengan pembuat, termasuk Pemilik.

| Dokumen | Pembuat | Penyetuju | Status |
|---|---|---|---|
| Jurnal manual ✋ (`manual-journal.service.ts:132`) | Bella, Aqim | Bella, Aqim | 🟢 Aman: saling menyetujui. Tertahan bila salah satu tidak ada (RO10) |
| Penghapusan piutang ✋ (`receivable-adjustment.service.ts:205`) | Bella (Keuangan), Aqim | Bella (Akuntan), Aqim | 🟢 Aman: ajuan Bella disetujui Aqim, dan sebaliknya |
| Kasbon ✋ (`employee-advance.service.ts:126`) | Teknisi (Fahri, Jamil, Agus, Alex, Ade); Aqim tidak mengajukan kasbon (27/11) | Aqim | 🟢 Aman: Aqim tidak mengajukan kasbon (K1a/X1, 27/11), jadi tidak ada titik macet. Sebelumnya: 🟢 Aman bila diajukan teknisi (⚠️ halamannya tertutup, RO6). 🔴 Macet bila diajukan Aqim |
| Pertanggungjawaban: verifikasi ✋ (`:217`) | Teknisi, PM, Pekerja Lepas | Aqim | 🟢 Aman. Sesudah RO5 (27/11) verifikasi dan persetujuan digabung menjadi satu langkah oleh Aqim |
| Pertanggungjawaban: persetujuan ✋ (`:235`) | (setelah verifikasi Aqim) | Aqim | 🟢 **Sesudah RO5 (27/11): satu langkah oleh Aqim**, aturan verifikator ≠ penyetuju dihapus. Kode sekarang: 🔴 selalu macet sampai diubah Oki |
| Periode akuntansi: siapkan | Aqim, Bella (sesudah RO1) | — | 🟡 **Sesudah RO1 (27/11): Pemilik dan Keuangan bisa membuat periode** (`accounting_period:create`), tanpa persetujuan kedua. Kode sekarang: 🔴 tidak ada pemegang hak |
| Periode: tutup, kunci | Bella | — | 🟡 Tanpa pemeriksa (tidak butuh persetujuan) |
| Periode: buka kembali | Bella, Aqim | — | 🟡 Tanpa pemeriksa; ⚠️ Bella bisa walau rencananya hanya Pemilik (RO4). Sesudah RO4 (27/11): hanya Aqim, route memeriksa `reopen` |
| Pembayaran | Bella, Aqim | Bella, Aqim | 🟡 Tanpa pemeriksa (RO9; diterima K7a) |
| Klaim biaya | Bella, Aqim | Bella, Aqim | 🟡 Tanpa pemeriksa (RO9); diterima (OB8, 27/11) |
| Tagihan pemasok (rekam) | Bella, Aqim | — | 🟡 Tanpa pemeriksa |
| Gaji (periode) | Aqim (SDM) | Aqim (Pemilik) | 🟡 Tanpa pemeriksa (RO8; sesuai K1, belum ada catatan audit khusus). Pembayaran oleh Bella |
| Catatan pajak dan pemotongan (verifikasi) | Bella | Bella | 🟡 Tanpa pemeriksa (RO13) |
| Penghapusan aset | Aqim | Aqim | 🟡 Tanpa pemeriksa (RO11; sesuai K1) |
| Peminjaman aset | PM (Agus, Jamil, Hatta), Aqim; teknisi dan Penjualan (⚠️ form) | PM, Aqim | 🟡 Tanpa pemeriksa: PM menyetujui pinjamannya sendiri (`borrowing.controller.ts:38`); Gudang bisa menyerahkan tanpa persetujuan (`borrowing.service.ts:160`). Sesudah OD1/OD2 (27/11): teknisi mengajukan dari daftar unit khusus; pembuat ≠ penyetuju kecuali Pemilik |
| Entri penyusutan manual, kapitalisasi | Aqim (Bella setelah RO3) | — | 🟡 Tanpa pemeriksa (tidak butuh persetujuan) |
| Bagi hasil investor | Aqim | Aqim | ⚪ Belum dibangun (K10); ditunda, halaman investor hanya Pemilik (27/11) |
| Perubahan role anggota | Aqim | — | 🟡 Tanpa pemeriksa dan **tidak diaudit** (RO12). Sesudah OA5–OA7 (27/11): wajib diaudit, sebelum K1 |
| Absen lokasi (portal karyawan) | Karyawan | — | Sesudah OG1 (27/11): absen di luar radius **ditolak**. Kode sekarang: tersimpan dengan tanda `out_of_range` |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: kasbon, pertanggungjawaban, dan siapkan periode tidak lagi 🔴; baris absen lokasi ditambahkan (OG1).

Keterangan:

* 🔴 **macet**: aplikasi menolak, pekerjaan berhenti.
* 🟡 **tanpa pemeriksa**: berjalan, tapi tidak ada orang kedua yang memeriksa.
* 🟢 **aman**: ada orang kedua.
* ⚪ **belum ada**: fiturnya belum dibangun.

**Yang harus diselesaikan sebelum dipakai:** RO1 (periode) dan RO5 (persetujuan
pertanggungjawaban), ditambah RO6 bila kasbon memang dipakai teknisi. Berbeda dengan
modul programmer B, keduanya **tidak** selesai dengan K1 saja: RO1 adalah hak yang
tidak ada, dan RO5 tetap macet karena K1a tercatat (b). Diperbarui 27/11: RO1 diputuskan (hak `create` untuk Pemilik dan Keuangan) dan RO5 diputuskan (satu langkah oleh Aqim); keduanya masih harus dikerjakan Oki.

**Yang cukup diterima atau diawasi:** semua 🟡, lewat laporan, rekonsiliasi, dan
Log Audit, dengan syarat RO12 diperbaiki supaya audit benar-benar lengkap.

### 3.8 Rekomendasi susunan role dan aturan persetujuan modul Oki

Mengikuti K1 (b), K2 (a), K2a, K2b, dan rekomendasi K2d (b). Statusnya **usulan**,
menunggu Oki (pemilik `erp-permissions.ts`, ADR-0006, dan service finance) dan Pemilik. Diperbarui 2026-11-27 sesuai keputusan tanya-jawab: K2d (a) gabung, RO5 satu langkah oleh Aqim, OG1 tolak, Anggota dan Admin dihapus.

#### Role per orang di modul Oki

| Orang | Role | Tugas di modul Oki |
|---|---|---|
| Aqim | Pemilik, SDM (+ tanda admin aplikasi) | Pengguna dan role, pengaturan, aset dan penghapusan, persetujuan jurnal/penghapusan piutang/kasbon, gaji, buka kembali periode |
| Bella | Akuntan, Keuangan → diganti: Keuangan gabungan (K2d a, 27/11) | Semua transaksi keuangan, jurnal, pajak, tutup buku, kapitalisasi dan penyusutan |
| Agus, Jamil, Hatta | Manajer Proyek (+ Teknisi/Gudang sesuai K2) | Menyetujui peminjaman orang lain, lihat aset |
| Agus, Bilal | Gudang | Menyerahkan dan menerima unit pinjaman |
| Fahri, Alex, Ade, Jamil, Agus | Teknisi | Mengajukan peminjaman, kasbon, pertanggungjawaban |
| Dafrin, Oki | Pekerja Lepas | Pertanggungjawaban; portal karyawan bila punya data karyawan |

Manajer Operasional, Admin, dan Auditor tidak dipakai; role tetap ada di aplikasi. Diperbarui 27/11: role organisasi Admin dan Anggota **dihapus** (tanda admin aplikasi Aqim tetap); Manajer Operasional tidak dipakai.

#### Aturan persetujuan yang direkomendasikan

1. **Pemilik boleh menyetujui dokumennya sendiri** (K1) untuk dokumen modul Oki yang dibuat Aqim: kasbon, penghapusan aset, gaji, peminjaman aset. Setiap kejadian dicatat di audit dengan tanda "disetujui oleh pembuat (Pemilik)".
2. **Jurnal manual dan penghapusan piutang tetap dua orang** (K1a b): Bella dan Aqim saling menyetujui. Tidak perlu perubahan kode.
3. **Pertanggungjawaban:** verifikasi dan persetujuan digabung menjadi **satu langkah oleh Aqim** (RO5, diputuskan programmer B 27/11; opsi Bella memverifikasi tidak dipakai). Aqim tidak mengajukan kasbon.
4. **Peminjaman aset:** pembuat tidak boleh menyetujui, kecuali Pemilik (sama dengan penyesuaian stok di 3.8 dokumen programmer B). Menyerahkan tanpa persetujuan hanya untuk Pemilik.
5. **Buka kembali periode hanya Pemilik**, ditegakkan di kode (RO4).
6. Pembayaran, klaim biaya, tagihan, verifikasi pajak, tutup periode: **tanpa persetujuan kedua**, diawasi Aqim lewat laporan bulanan (K7a).
7. Audit ikut transaksi bisnis, dan perubahan role ikut diaudit, **sebelum** aturan 1 dijalankan (L-1).
8. **Absen lokasi di luar radius ditolak** (OG1, diputuskan programmer B 27/11; berbeda dari rekomendasi simpan dan tandai).

#### Yang perlu dikerjakan bila disetujui

| Pekerjaan | Siapa | Perkiraan kasar |
|---|---|---|
| Hak siapkan periode untuk Pemilik dan Keuangan (RO1, 27/11), test | Oki | kecil |
| `chart_of_account:read` untuk Keuangan; `asset:read` dan `project:read` untuk Akuntan; jalankan `bun docs/gen-role-permission.ts` | Oki | kecil |
| Buka kembali periode hanya Pemilik (ganti opsi `ownership` dengan `policy` atau cabut `reopen` dari Akuntan) | Oki | kecil |
| Pertanggungjawaban satu langkah oleh Aqim; hapus aturan verifikator ≠ penyetuju (RO5, 27/11) | Oki | kecil |
| Halaman kasbon dan pertanggungjawaban untuk pengaju (web-admin atau portal karyawan) | Oki | sedang |
| Aturan peminjaman (pembuat ≠ penyetuju kecuali Pemilik; serah tanpa persetujuan hanya Pemilik); form pengajuan tanpa `asset:read` | Oki | sedang |
| Audit ikut transaksi; audit perubahan role dan pengeluaran anggota; catatan "disetujui pembuat" | Oki (bersama programmer B untuk service miliknya) | sedang |
| Atur role Bella (Keuangan gabungan, K2d) di Administrasi → Organisasi → anggota | Aqim | 5 menit |
| Gabung Akuntan ke Keuangan di `erp-permissions.ts`; hapus role Anggota dan role organisasi Admin (tanda admin aplikasi tetap) | Oki | kecil sampai sedang |
| Tolak absen lokasi di luar radius (OG1) | Oki | kecil |
| Tutup `/finance/investors` untuk selain Pemilik (OE1) | Oki | kecil |

Diperbarui 2026-11-27 sesuai keputusan tanya-jawab.

***

## Hasil validasi

| Bagian | Lulus | Gagal | Disetujui oleh | Tanggal |
|---|---|---|---|---|
| Matriks role modul Oki (1.1–1.2) | | | | |
| Keputusan 1.3 | | | | |
| Temuan RO1–RO20 diterima Oki untuk diperiksa | | | | |
| UAT modul Oki (lihat rekap di `uat-modul/modul-oki/README.md`) | | | | |

Kesimpulan: hak dan alur modul Oki **dipakai / diubah / diganti** (coret yang tidak perlu).
