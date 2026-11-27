# Ringkasan aturan arsitektur (untuk modul programmer B)

Ringkasan satu halaman dari dokumen yang paling berpengaruh ke modul M02,
M03, M04, M05, M07, dan M08. Semua dokumen sumber ditulis programmer kedua
(lihat `catatan-progres.md`). Disusun 2026-11-24 oleh Claude atas
permintaan programmer B. Ini ringkasan, bukan pengganti: bila ragu, dokumen
aslinya yang berlaku.

| Sumber | Status |
|---|---|
| `docs/architecture/architecture.md` | aturan umum |
| `docs/architecture/security-and-access.md` | aturan umum |
| ADR-0006 Otorisasi dua lapis | accepted, 2026-10-29 |
| ADR-0014 Referensi antar-modul nullable | accepted, 2026-11-08 |
| ADR-0024 Normalisasi database v2 | tertulis "proposed" 2026-11-19, tapi sudah dijalankan |
| ADR-0026 Modul product dan warehouse | accepted, 2026-11-23 |

---

## 1. Lapisan kode backend (architecture.md)

Setiap modul ada di `apps/backend/src/app/<modul>/` dan dibagi tiga lapis:

| Lapis | Boleh | Tidak boleh |
|---|---|---|
| **Controller** | Terima request HTTP, cek login/hak, kirim respons | Query database, aturan bisnis |
| **Service** | Aturan bisnis, cek kepemilikan, transaksi | Query Drizzle langsung |
| **Repository** | Query Drizzle | Aturan bisnis |

- **Butuh data modul lain?** Panggil service yang diekspor modul itu. Jangan
  memakai repository atau tabel modul lain.
- **Transaksi dipegang service.** Efek ke luar (WhatsApp, n8n, sinkron
  lisensi) dijalankan setelah transaksi selesai.
- **Cache** hanya untuk bacaan yang aman. Keputusan hak akses dan keuangan
  tidak boleh bergantung pada cache.
- **Frontend:** cek hak di layar hanya untuk tampilan; yang memutuskan
  tetap backend. Teks layar default bahasa Indonesia.

## 2. Satu modul = satu schema database (ADR-0024, ADR-0026)

- Database dibagi per modul: **20 schema**. Di modul Anda: `customer`,
  `supplier`, `product`, `warehouse`, `inventory`, `sale`, `procurement`,
  `project`, `ticket`, `human_resource`, `automation`.
- **ADR-0026** memisahkan `product` (barang, kategori, data katalog
  website) dan `warehouse` (gudang, rak, penanggung jawab) dari `inventory`.
  `inventory` sekarang hanya menyimpan stok: mutasi, saldo, nomor seri,
  penyesuaian, peminjaman.
- **Penomoran per modul:** setiap schema punya tabel `code_numberings`
  sendiri. Tidak ada modul penomoran pusat lagi.
- **ADR-0024 juga menghapus beberapa schema:** `payroll`, `approval`,
  `budgeting`, `investor`, dan `commerce`. Kalau mau dibangun lagi, harus
  lewat ADR baru. Ini berpengaruh ke payroll otomatis (T19/T20, sekarang
  tugas Anda) dan bagi hasil investor (T13).
- Database yang dibuat sebelum ADR-0024 harus dibuat ulang. Ini hanya boleh
  karena belum ada server produksi.

## 3. Hubungan antar-modul tanpa foreign key (ADR-0014)

- Kolom yang menunjuk tabel modul lain, misalnya `sale.quotations.customer_id`
  → `customer.customers`, adalah **kolom id biasa yang boleh kosong**, tanpa
  foreign key.
- **Keberadaan datanya dicek di service** lewat metode `resolve*` /
  `assert*` milik modul pemilik, sebelum menyimpan.
- Kosong (`NULL`) artinya "belum ditautkan". Pengecualian: di `inventory`,
  `organization_id` kosong berarti berlaku untuk seluruh perusahaan.
- Kalau data di modul lain dihapus (soft delete), modul pemilik yang
  memutuskan cara membersihkan tautannya.
- Hubungan **di dalam satu modul** tetap memakai foreign key sungguhan,
  misalnya `quotation_items` → `quotations`.

## 4. Otorisasi dua lapis (ADR-0006, security-and-access.md)

| Lapis | Disimpan di | Fungsi |
|---|---|---|
| **Role aplikasi** (`admin` / `user`) | `auth.users.role` | Hanya administrasi akun. Admin aplikasi **tanpa** keanggotaan organisasi tidak punya akses ERP |
| **Role organisasi** (17 role: owner, sales, purchasing, …) | `auth.members.role` | Semua hak bisnis, per organisasi |

- **Satu sumber hak akses:** `packages/common/src/authorization/erp-permissions.ts`.
  Backend, frontend, dan seeder memakai file yang sama.
- **Ditolak kecuali diberi** (deny by default). Hak yang tidak tertulis
  berarti tidak boleh.
- **Daftar role tetap di kode.** Tidak ada tabel role yang bisa diubah dari
  aplikasi. Menambah role atau hak berarti mengubah satu file itu.
- Pengguna dengan beberapa role mendapat **gabungan** haknya.
- **Pencegahan eskalasi:** hanya owner yang bisa memberi role owner; owner
  terakhir tidak bisa dihapus.
- **Login hanya lewat undangan** (ADR-0029). Akun nonaktif tidak bisa masuk.

## 5. Aturan persetujuan (ADR-0006 butir 6, security-and-access.md)

Hak akses saja **tidak cukup** untuk menyetujui. Service wajib mengecek:

1. Status dokumen benar, dan perubahan status dilakukan dengan cara yang
   aman dari tabrakan (`WHERE status = …`).
2. **Pembuat tidak boleh menyetujui dokumennya sendiri, apa pun role-nya**,
   termasuk Pemilik.
3. Batas nominal/diskon diambil dari konfigurasi. Bila konfigurasinya tidak
   ada, aksi ditolak.
4. Eksekusi hanya dari status disetujui, dan tidak bisa terjadi dua kali.

## 6. Pemakaian query (security-and-access.md)

- Setiap query difilter dengan `organization_id` dari sesi yang sudah
  divalidasi, **bukan** dari isian request.
- Jangan menerima `organizationId`, `status`, `createdBy`, atau kolom
  persetujuan dari body request.
- Ekspor, hitungan, pencarian, dan dashboard juga lewat filter yang sama.
- Teknisi hanya melihat yang ditugaskan; portal pelanggan hanya melihat data
  miliknya.

---

## 7. Bagian dokumen yang sudah tidak cocok dengan kode

Ditemukan saat meringkas. Perlu dikonfirmasi ke programmer kedua sebelum
dokumennya diperbaiki.

| No | Dokumen | Tertulis | Kenyataan di kode |
|---|---|---|---|
| D1 | ADR-0024 | Status "proposed" | Sudah dijalankan (baseline migrasi per schema, 20 schema) |
| D2 | architecture.md | "18 schemas, 188 tables"; gudang ada di `inventory` | ADR-0026 memisah `product` dan `warehouse`: 20 schema |
| D3 | security-and-access.md | 19 role organisasi, termasuk `investor` dan `customer` | ADR-0018 memindah keduanya menjadi role aplikasi (`appRoleNames`); role organisasi tinggal 17 |
| D4 | security-and-access.md | Persetujuan penjualan ditolak bila belum ada konfigurasi `approval_rule` (`DEFAULT_APPROVAL_LIMIT`) | Tidak ada `DEFAULT_APPROVAL_LIMIT` atau `approval_rule` di backend. SPH bisa disetujui Manajer Penjualan tanpa konfigurasi batas |
| D5 | ADR-0006 butir 6 | Larangan menyetujui sendiri berlaku untuk semua | Penyesuaian stok sengaja dikecualikan di kode (bypass terdokumentasi, 2026-11-03). Bertentangan dengan ADR; perlu keputusan |
| D6 | security-and-access.md | Satu anggota bisa punya beberapa role (dipisah koma) | **Cocok** (dicek 2026-11-26): halaman ubah anggota memakai centang per role dan impor undangan menerima beberapa role. Hanya form tambah pengguna yang memilih satu role |

## 8. Yang perlu Anda ingat saat mengerjakan modul sendiri

1. Baca `docs/database/docs.dbml` bagian modul Anda **sebelum** mengubah
   tabel. Bila berbeda dengan Drizzle, `docs.dbml` yang benar.
2. Tautan ke modul lain = kolom id nullable + cek di service pemilik.
3. Hak baru = ubah `erp-permissions.ts` (wilayah programmer kedua, M12),
   lalu jalankan ulang `bun docs/gen-role-permission.ts`.
4. Setiap persetujuan: cek status, larang menyetujui sendiri, dan buat
   perubahan status yang aman dari tabrakan.
5. Migrasi hanya boleh ditambah (append-only); jangan mengubah migrasi lama.
