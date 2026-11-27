# Diagram alur per role (konsep saat ini)

Kembali ke [README](README.md). Diagram Mermaid untuk modul programmer B,
dengan aktor = **role yang berlaku di kode sekarang**, ditulis
`Nama role - orang yang memegangnya`. Nama orang diambil dari data tim
2026-11-26 (`../validasi-konsep-saat-ini.md` Bagian 3); akun uji per role ada
di tabel bagian 0. Bisa dibuka di GitHub atau di VS Code (Markdown Preview
dengan dukungan Mermaid).

Sumber: hak akses di `packages/common/src/authorization/erp-permissions.ts`
dan tombol di web-admin, dibaca 2026-11-24. Versi ini menggantikan
`docs/user-guide/diagrams.md` (2026-11-06, sebagian usang) sampai
programmer kedua setuju memindahkannya ke folder bersama.

**Penulis:** disusun oleh Claude (asisten AI) atas permintaan programmer B
pada 2026-11-24, dari pembacaan kode. Tidak diturunkan dari ADR dan belum
ditinjau programmer kedua maupun Pemilik. Dokumen lain yang membahas role
tercantum di [catatan-skema-dan-alur.md](catatan-skema-dan-alur.md).

Aturan yang berlaku di semua diagram:
- **Pembuat dokumen tidak bisa menyetujui dokumennya sendiri**, termasuk
  Pemilik (ADR-0006 butir 6). Di kode, penyesuaian stok sengaja dikecualikan
  (pemegang hak setuju boleh menyetujui miliknya sendiri). Ini perlu
  keputusan (temuan M05 F4).
- **Pemilik (`admin`) boleh semua langkah.** Supaya diagram tidak ramai,
  Pemilik hanya digambar di langkah yang **hanya** bisa dilakukan Pemilik.

## 0. Siapa terlibat di modul apa

| Role (akun uji) | Dipegang oleh | M05 | M02 | M07 | M03 | M08 | M04 |
|---|---|---|---|---|---|---|---|
| Pemilik (`admin`) | Aqim | barang, gudang, batal PO | semua | semua | semua | setujui gaji | event n8n |
| Admin (`admin_seed`) | Aqim | lihat stok | - | buat/tugaskan tiket | lihat | catat absensi | FAQ, balas WA |
| Manajer Operasional (`operations_manager_seed`) | Aqim | setujui PR, PO, retur, penyesuaian | - | - | - | - | - |
| Pembelian (`purchasing_seed`) | Aqim | pemasok, PR, PO, retur | - | - | - | - | - |
| Gudang (`warehouse_seed`) | Agus, Bilal | terima barang, kirim retur, penyesuaian | surat jalan, terima retur | - | - | - | - |
| Penjualan (`sales_seed`) | Bilal | - | lead, pelanggan, SPH, SO, retur | - | kontrak, kunci, perpanjang | - | - |
| Manajer Penjualan (`sales_manager_seed`) | Agus MD, Bilal | - | setujui SPH, retur, batal SO, akun portal | - | semua lisensi | - | katalog |
| Keuangan (`finance_seed`) | Aqim | lihat HPP | invoice, pembayaran | lihat biaya | lihat | isi gaji | - |
| Manajer Proyek (`project_manager_seed`) | Agus, Jamil, Hatta | ajukan PR | - | proyek, BAST, garansi, tiket | - | - | - |
| Teknisi (`technician_seed`) | Fahri, Jamil, Agus, Alex, Ade | ajukan PR | - | kerjakan tiket | - | - | - |
| Layanan Pelanggan (`customer_service_seed`) | Bilal | - | - | tiket | lihat, salin kunci | - | balas WA* |
| Pemasaran (`marketing_seed`) | Bilal | - | - | - | - | - | katalog, FAQ |
| SDM (`hr_seed`) | usulan Aqim | - | - | - | - | karyawan, absensi, cuti, lembur, gaji | - |

\* Menu WhatsApp AI sekarang tampil untuk role ini (diperbaiki 2026-11-24, temuan M04 B7).

---

## 1. M05 - Pembelian sampai stok

```mermaid
sequenceDiagram
    actor T as Teknisi / Manajer Proyek - Fahri, Jamil, Agus, Alex, Ade, Hatta
    actor P as Pembelian - Aqim
    actor O as Manajer Operasional - Aqim
    actor G as Gudang - Agus, Bilal
    actor W as Pemilik - Aqim
    participant ST as Stok (inventory)

    W->>W: buat barang dan rak gudang (khusus admin aplikasi)
    T->>P: Permintaan Pembelian (PR): buat, ajukan
    O->>P: setujui / tolak PR
    P->>P: Pemasok baru (bila belum ada)
    P->>P: PO: buat (ambil baris PR yang disetujui), ajukan
    O->>P: setujui PO (dapat nomor) / tolak
    Note over P,O: Aqim memegang Pembelian dan Manajer Operasional, jadi PO buatannya macet (R2). Usulan 3.8: Pemilik boleh menyetujui sendiri dengan audit
    P->>P: Tandai terkirim ke pemasok, cetak
    Note over P,G: PO baru muncul di Penerimaan Barang setelah Terkirim
    G->>ST: Penerimaan Barang (BPB): qty boleh sebagian, nomor seri per unit
    ST-->>P: PO Diterima sebagian / Diterima
    opt hanya Pemilik
        W->>P: Batalkan PO (sebelum ada barang diterima)
    end
```

## 2. M05 - Retur pembelian dan penyesuaian stok

```mermaid
sequenceDiagram
    actor P as Pembelian - Aqim
    actor O as Manajer Operasional - Aqim
    actor G as Gudang - Agus, Bilal
    participant ST as Stok (inventory)

    P->>P: Retur pembelian dari BPB: buat, ajukan
    O->>P: setujui (nomor RTB) / tolak
    Note over P,O: Retur buatan Aqim juga macet (R2), selesai dengan usulan yang sama
    G->>ST: Kirim ke pemasok: stok keluar, PO terbuka lagi
    G->>ST: barang pengganti diterima lewat BPB biasa

    G->>G: Penyesuaian stok: buat (hasil hitung), ajukan
    O->>G: setujui / tolak
    O->>ST: Catat ke stok: selisih dihitung dari saldo saat itu
```

## 3. M02 - Lead sampai kas masuk

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor M as Manajer Penjualan - Agus MD, Bilal
    actor G as Gudang - Agus, Bilal
    actor F as Keuangan - Aqim
    participant ST as Stok (inventory)

    S->>S: Lead baru, follow-up, ubah status
    S->>S: Jadikan Pelanggan: lead Menang, login portal dikirim ke email
    S->>S: SPH: buat (barang, PPN, rencana penagihan 100%), ajukan
    M->>S: setujui / tolak (tidak boleh SPH sendiri)
    Note over S,M: SPH Bilal disetujui Agus MD, SPH Agus MD disetujui Bilal
    opt pelanggan minta perubahan
        S->>S: Buat revisi, ajukan lagi
        M->>S: setujui revisi
    end
    S->>S: Tandai terkirim, cetak
    S->>S: Buat sales order: SPH menjadi Deal
    G->>ST: Surat jalan: siapkan (boleh sebagian), cetak, Kirim (stok keluar)
    G->>G: Tandai diterima (nama penerima)
    F->>F: Invoice dari SO: uang muka / termin / pelunasan, terbitkan
    F->>F: Catat pembayaran: kuitansi, invoice Dibayar sebagian / Lunas
    opt hanya Manajer Penjualan
        M->>S: Batalkan SO (belum ada invoice, surat jalan, atau proyek)
    end
```

## 4. M02 - Retur penjualan

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor M as Manajer Penjualan - Agus MD, Bilal
    actor G as Gudang - Agus, Bilal
    participant ST as Stok (inventory)

    S->>S: Retur barang dari surat jalan (Dikirim/Diterima), ajukan
    M->>S: setujui (nomor RTJ) / tolak
    G->>ST: Terima barang, kondisi per baris: Layak jual / Rusak
    ST-->>S: stok kembali, SO kembali Diproses
```

## 5. M07 - Proyek, BAST, garansi, tiket

```mermaid
sequenceDiagram
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor CS as Layanan Pelanggan - Bilal
    actor TK as Teknisi - Fahri, Jamil, Agus, Alex, Ade
    actor C as Pelanggan (portal)

    PM->>PM: Proyek dari sales order, checklist otomatis
    PM->>PM: Unggah bukti Uji fungsi dan Training
    PM->>PM: Buat BAST, Terbitkan (bernomor), cetak
    PM->>PM: Surat garansi dari BAST, cetak
    PM->>PM: Unggah scan BAST bertanda tangan, Tutup Proyek
    C->>CS: lapor keluhan (portal / WA / telepon)
    CS->>CS: Tiket baru: nomor seri, status garansi otomatis
    CS->>TK: tugaskan teknisi
    TK->>TK: Mulai kerjakan, Selesaikan (tindakan, biaya)
    CS->>C: konfirmasi ke pelanggan
    CS->>CS: Tutup Tiket
    C->>C: lihat proyek, tiket, garansi di portal
```

## 6. M03 - Lisensi

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor M as Manajer Penjualan - Agus MD, Bilal
    actor CS as Layanan Pelanggan - Bilal
    participant APP as Aplikasi pelanggan (API)

    M->>M: Aplikasi (sendiri / pihak ketiga), Kunci API
    S->>S: Kontrak baru (Draf), Tambah kunci
    M->>S: Aktifkan kontrak
    CS->>CS: lihat kontrak, salin kunci untuk pelanggan
    APP->>M: activate / validate dengan kunci API
    M->>M: Validasi & Aktivasi: log percobaan
    M->>S: Tangguhkan / Aktifkan kembali / Hentikan / Cabut kunci
    S->>S: Perpanjang: draf periode baru, Buat SPH
    Note over S,M: draf aktif sendiri setelah SO perpanjangan lunas
```

## 7. M08 - Karyawan, kehadiran, gaji

```mermaid
sequenceDiagram
    actor H as SDM - Aqim (usulan)
    actor W as Pemilik - Aqim
    actor A as Admin - Aqim
    actor F as Keuangan - Aqim
    actor K as Karyawan - semua (layanan mandiri)

    H->>K: Karyawan baru: undangan login lewat email
    H->>H: Absensi harian / impor Excel
    A->>A: boleh mencatat absensi juga
    H->>H: Cuti (kuota 12 hari) dan lembur: catat
    W->>H: setujui cuti / lembur (pencatat tidak boleh menyetujui)
    Note over H,W: cuti yang disetujui mengisi absensi otomatis
    H->>H: Rekap gaji bulan ini: pokok, tunjangan, lembur, bonus, potongan
    F->>F: boleh mengisi rekap gaji
    W->>H: Setujui bulan ini (hanya Pemilik), data terkunci
```

## 8. M04 - n8n, WhatsApp, katalog

```mermaid
sequenceDiagram
    actor MK as Pemasaran - Bilal
    actor A as Admin - Aqim
    actor W as Pemilik - Aqim
    participant N as n8n
    participant WA as WhatsApp (WAHA) + AI
    participant WEB as Website

    MK->>WEB: Katalog Website: pilih barang, Tampilkan / Sembunyikan
    MK->>MK: FAQ asisten
    WA->>A: chat masuk, asisten menjawab dari FAQ
    WA->>A: Perlu admin (handoff)
    A->>WA: Balas sebagai admin, Buat lead, Tutup chat
    Note over A,WA: Layanan Pelanggan dan Manajer Penjualan juga bisa membalas
    A->>N: Event n8n: lihat log, Kirim sekarang (Admin atau Pemilik, Pemasaran hanya lihat)
```

---

## 9. Status dokumen

### PR, PO, retur pembelian

```mermaid
stateDiagram-v2
    state "Permintaan Pembelian" as PR {
        [*] --> pr_draf: Draf
        pr_draf --> pr_menunggu: Ajukan (Pembelian/Teknisi/PM)
        pr_menunggu --> pr_draf: Tolak (Manajer Operasional)
        pr_menunggu --> pr_disetujui: Setujui (Manajer Operasional)
        pr_disetujui --> pr_dipesan: semua baris masuk PO
        pr_dipesan --> pr_disetujui: PO dibatalkan
        pr_draf --> pr_batal: Batalkan
        pr_menunggu --> pr_batal
        pr_disetujui --> pr_batal: belum dipesan
    }
    state "Purchase Order" as PO {
        [*] --> po_draf: Draf (Pembelian)
        po_draf --> po_menunggu: Ajukan
        po_menunggu --> po_draf: Tolak (Manajer Operasional)
        po_menunggu --> po_disetujui: Setujui, bernomor (Manajer Operasional)
        po_disetujui --> po_terkirim: Tandai terkirim (Pembelian)
        po_terkirim --> po_sebagian: BPB sebagian (Gudang)
        po_sebagian --> po_diterima: sisa diterima
        po_terkirim --> po_diterima: semua diterima
        po_draf --> po_batal: Batalkan (Pemilik)
        po_disetujui --> po_batal
        po_terkirim --> po_batal: belum ada barang diterima
    }
    state "Retur Pembelian" as RB {
        [*] --> rb_draf: Draf (Pembelian)
        rb_draf --> rb_menunggu: Ajukan
        rb_menunggu --> rb_draf: Tolak
        rb_menunggu --> rb_disetujui: Setujui, nomor RTB (Manajer Operasional)
        rb_disetujui --> rb_dikirim: Kirim ke pemasok (Gudang)
        rb_draf --> rb_batal: Batalkan
        rb_menunggu --> rb_batal
        rb_disetujui --> rb_batal
    }
```

### Penyesuaian stok dan unit berseri

```mermaid
stateDiagram-v2
    state "Penyesuaian stok" as ADJ {
        [*] --> adj_draf: Draf (Gudang/Pembelian)
        adj_draf --> adj_diajukan: Ajukan
        adj_diajukan --> adj_disetujui: Setujui (Manajer Operasional)
        adj_diajukan --> adj_ditolak: Tolak
        adj_disetujui --> adj_tercatat: Catat ke stok (Manajer Operasional)
        adj_draf --> adj_batal: Batalkan
    }
    state "Unit berseri" as SER {
        [*] --> ada: BPB (Gudang)
        ada --> terjual: surat jalan dikirim (Gudang)
        ada --> dikembalikan: retur pembelian dikirim
        terjual --> ada: retur penjualan, Layak jual
        terjual --> rusak: retur penjualan, Rusak
    }
```

### SPH, sales order, surat jalan, invoice, retur penjualan

```mermaid
stateDiagram-v2
    state "SPH" as Q {
        [*] --> q_draf: Draf (Penjualan)
        q_draf --> q_menunggu: Ajukan
        q_menunggu --> q_disetujui: Setujui (Manajer Penjualan)
        q_menunggu --> q_ditolak: Tolak (Manajer Penjualan)
        q_disetujui --> q_terkirim: Tandai terkirim
        q_disetujui --> q_deal: Buat sales order
        q_terkirim --> q_deal: Buat sales order
        q_deal --> q_terkirim: SO dibatalkan
        q_menunggu --> q_direvisi: Buat revisi
        q_disetujui --> q_direvisi
        q_ditolak --> q_direvisi
        q_terkirim --> q_direvisi
        q_draf --> q_batal: Tandai batal
        q_terkirim --> q_batal
    }
    state "Sales order" as SO {
        [*] --> so_aktif: dari SPH
        so_aktif --> so_diproses: surat jalan pertama dikirim
        so_aktif --> so_batal: Batalkan (Manajer Penjualan)
    }
    state "Surat jalan" as SJ {
        [*] --> sj_disiapkan: Siapkan, nomor SJ (Gudang)
        sj_disiapkan --> sj_dikirim: Kirim, stok keluar
        sj_dikirim --> sj_diterima: Tandai diterima
        sj_disiapkan --> sj_batal: Batalkan
    }
    state "Invoice" as INV {
        [*] --> inv_draf: Buat, langsung bernomor (Keuangan)
        inv_draf --> inv_terbit: Terbitkan
        inv_terbit --> inv_sebagian: Catat pembayaran
        inv_sebagian --> inv_lunas: lunas
        inv_terbit --> inv_lunas: dibayar penuh
        inv_draf --> inv_void: Void
        inv_terbit --> inv_void: belum ada pembayaran
    }
    state "Retur penjualan" as RJ {
        [*] --> rj_draf: Draf (Penjualan)
        rj_draf --> rj_menunggu: Ajukan
        rj_menunggu --> rj_draf: Tolak
        rj_menunggu --> rj_disetujui: Setujui, nomor RTJ (Manajer Penjualan)
        rj_disetujui --> rj_diterima: Terima barang (Gudang)
        rj_draf --> rj_batal: Batalkan
        rj_menunggu --> rj_batal
        rj_disetujui --> rj_batal
    }
```

Catatan: "Tandai batal" pada SPH tersedia di semua status yang masih
terbuka. Di diagram hanya digambar dua supaya tidak ramai. SO tidak pernah
menjadi Selesai (temuan M02 C8).

### Proyek, BAST, tiket, kontrak lisensi, cuti

```mermaid
stateDiagram-v2
    state "Proyek" as PRJ {
        [*] --> prj_aktif: dari sales order (Manajer Proyek)
        prj_aktif --> prj_selesai: Tutup Proyek, butuh bukti Uji fungsi + Training + BAST bertanda tangan
        prj_aktif --> prj_batal: Batalkan Proyek
    }
    state "BAST" as B {
        [*] --> b_draf: Buat BAST
        b_draf --> b_terbit: Terbitkan, bernomor
        b_terbit --> b_batal: Batalkan, nomor tidak dipakai ulang
    }
    state "Tiket" as T {
        [*] --> t_baru: Layanan Pelanggan / Admin
        t_baru --> t_dikerjakan: Mulai kerjakan (Teknisi)
        t_baru --> t_selesai: Selesaikan
        t_dikerjakan --> t_selesai: Selesaikan (Teknisi)
        t_selesai --> t_dikerjakan: Buka lagi
        t_selesai --> t_ditutup: Tutup Tiket (Layanan Pelanggan)
    }
    state "Kontrak lisensi" as L {
        [*] --> l_draf: Penjualan
        l_draf --> l_aktif: Aktifkan (Manajer Penjualan)
        l_aktif --> l_tangguh: Tangguhkan
        l_tangguh --> l_aktif: Aktifkan kembali
        l_aktif --> l_diperpanjang: perpanjangan aktif (SO lunas)
        l_draf --> l_henti: Hentikan
        l_aktif --> l_henti
        l_tangguh --> l_henti
    }
    state "Cuti / lembur" as CT {
        [*] --> c_menunggu: dicatat SDM
        c_menunggu --> c_disetujui: Setujui (SDM lain / Pemilik)
        c_menunggu --> c_ditolak: Tolak
        c_menunggu --> c_batal: Batalkan
        c_disetujui --> c_batal: Batalkan, absensi cuti dihapus
    }
```
