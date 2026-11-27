# Alur lengkap ERP saat ini (end-to-end)

Disusun 2026-11-27. Kembali ke [diagram alur](README.md).

Satu dokumen untuk seluruh alur bisnis **sesuai kode hari ini** (`main`,
dicek 2026-11-27): dari barang masuk, gudang, aset, penjualan dan
surat-suratnya, proyek, kerja lapangan teknisi, purna jual, sampai jalur
pesanan dari website/portal dan input di web-admin. **Otomasi n8n tidak
digambar** (belum dijalankan); hanya disebut di titik event dikirim. Rancangan n8n
ada di [`../rancangan-n8n-whatsapp.md`](../rancangan-n8n-whatsapp.md).

**Ini kondisi sekarang, bukan sesudah perbaikan.** Perubahan yang sudah
diputuskan ada di [`sekarang-vs-sesudah.md`](sekarang-vs-sesudah.md); di
setiap bagian, titik yang akan berubah diberi nomor keputusannya.

**Tanda:** ✅ berjalan · ⚠️ setengah jadi / ada masalah · ❌ belum ada (hanya
tampilan atau belum dibangun).

**Aktor** ditulis "Role - orang" memakai **role yang ada di kode sekarang**
(sebelum K2 dikerjakan): Penjualan dan Manajer Penjualan masih terpisah,
Pembelian dan Manajer Operasional dipegang Aqim, Keuangan dan Akuntan
terpisah.

---

## 0. Peta besar

```mermaid
flowchart LR
  subgraph MASUK["Jalur masuk"]
    W1["Website: RFQ, kontak, demo"]
    W2["WhatsApp AI"]
    W3["Input staf di web-admin"]
    W4["Portal pelanggan: tiket"]
    W5["Website: keranjang dan checkout"]
  end
  subgraph JUAL["Penjualan"]
    L["Prospek"] --> C["Pelanggan"] --> Q["SPH"] --> SO["Sales order"]
    SO --> DN["Surat jalan"] --> INV["Faktur"] --> RC["Pembayaran dan kuitansi"]
  end
  subgraph BELI["Pengadaan dan gudang"]
    PR["Permintaan pembelian"] --> PO["Pesanan pembelian"] --> GR["Penerimaan barang"]
    GR --> STK["Stok dan nomor seri"]
  end
  subgraph PRJ["Proyek dan purna jual"]
    P["Proyek"] --> T["Tugas dan bukti"] --> B["BAST"] --> G["Sertifikat garansi"]
    TK["Tiket servis"]
  end
  subgraph AST["Aset"]
    A["Register aset"] --> BR["Peminjaman"]
    A --> DEP["Penyusutan dan penghapusan"]
  end
  subgraph KEU["Keuangan"]
    J["Jurnal otomatis"]
  end
  W1 --> L
  W2 --> L
  W3 --> L
  W3 --> Q
  W4 --> TK
  W5 -. "tidak tersambung" .-> Q
  STK --> DN
  SO --> P
  G --> TK
  DN --> J
  INV --> J
  RC --> J
  GR --> J
  DEP --> J
```

---

## 1. Data induk: barang, gudang, rak

```mermaid
sequenceDiagram
    actor W as Pemilik / admin aplikasi - Aqim
    actor PB as Pembelian - Aqim
    participant PRD as Barang (product)
    participant WH as Gudang (warehouse)

    W->>WH: Gudang baru, alamat, foto (khusus admin aplikasi)
    W->>WH: Rak/penyimpanan per gudang, penanggung jawab gudang (PIC)
    PB->>PRD: Kategori barang
    PB->>PRD: Barang baru: produk / komponen / material, harga jual dan beli, satuan, stok minimum, berseri
    PB->>PRD: Susunan komponen/material untuk produk rakitan
    Note over W,PRD: ⚠️ Halaman ubah barang dan gudang khusus admin aplikasi, padahal Pembelian punya hak (keputusan B3)
```

| Hal | Kondisi |
|---|---|
| Jenis barang | `product`, `component`, `material`. **Aset bukan barang**: aset dicatat terpisah (bagian 5) |
| Stok minimum | ⚠️ tersimpan, tetapi tidak ada peringatan; daftar "stok menipis" di dasbor masih data contoh (KF-G3) |
| Katalog website | ✅ Penjualan/Pemasaran memilih barang yang tampil di website (Integrasi → Katalog Website) |

---

## 2. Pengadaan sampai stok masuk

```mermaid
sequenceDiagram
    actor TK as Teknisi / Manajer Proyek - Fahri, Jamil, Agus, Alex, Ade, Hatta
    actor PB as Pembelian - Aqim
    actor MO as Manajer Operasional - Aqim
    actor G as Gudang - Agus, Bilal
    actor F as Keuangan - Bella
    participant ST as Stok
    participant FN as Keuangan (jurnal)

    TK->>PB: PR: buat, ajukan (nama proyek teks bebas)
    MO->>PB: setujui / tolak PR
    PB->>PB: Pemasok baru bila belum ada
    PB->>PB: PO: buat dari baris PR yang disetujui, ajukan
    MO->>PB: setujui PO (nomor terbit) / tolak
    Note over PB,MO: ⚠️ Aqim memegang dua role, PO buatannya tidak bisa disetujui siapa pun (K1). ⚠️ Nomor PO bisa melebihi 32 karakter (K6)
    PB->>PB: Tandai terkirim, cetak PO
    Note over PB,G: PO baru muncul di Penerimaan Barang setelah Terkirim (akan dihapus, B1)
    G->>ST: BPB: jumlah boleh sebagian, satu nomor seri per unit, langsung terposting
    ST->>FN: jurnal persediaan / GR-IR
    ST-->>PB: PO Diterima sebagian / Diterima
    F->>FN: Tagihan dari PO (atau tagihan manual)
    Note over F,FN: ❌ Layar pembayaran pemasok belum ada (OB3). ❌ PO kurang kirim tidak bisa ditutup (KF-B1)
```

| Langkah | Dokumen keluar |
|---|---|
| PO | ✅ Halaman cetak (`purchase-orders/$id/print`) |
| BPB | ⚠️ Hanya tercatat di daftar dokumen, tidak ada halaman cetak |
| Tagihan pemasok | Tercatat di Keuangan → Utang |

---

## 3. Stok: retur pembelian, penyesuaian, keluar-masuk

```mermaid
sequenceDiagram
    actor PB as Pembelian - Aqim
    actor MO as Manajer Operasional - Aqim
    actor G as Gudang - Agus, Bilal
    participant ST as Stok

    PB->>PB: Retur pembelian dari BPB: buat, ajukan (hanya ganti barang)
    MO->>PB: setujui / tolak
    G->>ST: Kirim ke pemasok: stok keluar, PO terbuka lagi
    G->>ST: barang pengganti diterima lewat BPB biasa
    G->>G: Penyesuaian stok: tambah / kurang / hitung ulang, ajukan
    MO->>G: setujui (pembuat boleh menyetujui sendiri, pengecualian lama)
    MO->>ST: posting: selisih dari saldo saat itu
    Note over G,ST: ❌ Layar terima/keluarkan stok manual untuk bahan proyek belum ada, backend sudah ada (KF-G1)
```

| Hal | Kondisi |
|---|---|
| Nomor seri | ✅ status: pre_order, in_stock, sold, returned, damaged, lost, applied_warranty (yang terakhir belum dipakai) |
| Mutasi stok | ⚠️ daftar tanpa saringan, belum ada kartu stok per barang (KF-G2) |
| Nilai persediaan | ✅ untuk yang berhak melihat harga pokok |
| Pindah stok antar-gudang, reservasi | ❌ belum ada (B-18) |

---

## 4. Jalur masuk pesanan

```mermaid
flowchart TB
  subgraph WEB["Website (web-landing)"]
    RFQ["Form RFQ, kontak, demo"]
    CART["Keranjang, checkout, bayar, lacak pesanan"]
  end
  subgraph WA["WhatsApp AI"]
    CHAT["Chat pelanggan"]
  end
  subgraph PORTAL["Portal pelanggan"]
    PT["Buat tiket, pesan tiket"]
    PQ["Terima SPH, lihat faktur, bayar"]
  end
  subgraph ADMIN["Web-admin"]
    LEAD["Prospek baru, status Baru, tanpa petugas"]
    STAFF["Staf membuat prospek / SPH sendiri"]
    TICKET["Tiket servis"]
  end
  RFQ -- "API website, lampiran ikut" --> LEAD
  CHAT -- "buat prospek dari chat" --> LEAD
  STAFF --> LEAD
  PT --> TICKET
  CART -. "tidak tersambung: Online checkout is not connected yet" .-> X1["(tidak ada)"]
  PQ -. "hanya tampilan, belum ada endpoint" .-> X2["(tidak ada)"]
```

| Jalur | Kondisi sekarang |
|---|---|
| Website RFQ / kontak / demo | ✅ Membuat **prospek** (sumber website, nomor referensi publik, lampiran), event `lead.created` dikirim. Staf mengambilnya di Penjualan → Prospek |
| Katalog website | ✅ Barang, harga, stok, pencarian dibaca dari ERP |
| Keranjang dan checkout website | ❌ Tampilan ada, tetapi belum ada endpoint ERP; pengunjung diarahkan meminta penawaran |
| WhatsApp | ✅ Chat bisa dijadikan prospek; balasan oleh Penjualan / Layanan Pelanggan |
| Portal pelanggan | ✅ Masuk, akun, proyek, tiket (buat dan pesan), perangkat dan garansi. ❌ Pesanan, SPH (terima/revisi), faktur, pembayaran, dokumen, lokasi: hanya tampilan/data contoh |
| Input staf | ✅ Prospek, pelanggan, SPH, SO dibuat di web-admin (bagian 5) |

---

## 5. Penjualan sampai uang masuk (input di web-admin)

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor M as Manajer Penjualan - Agus MD, Bilal
    actor G as Gudang - Agus, Bilal
    actor F as Keuangan - Bella
    actor C as Pelanggan
    participant ST as Stok
    participant PAY as Gateway Xendit / SingaPay
    participant FN as Keuangan (jurnal)

    S->>S: Prospek: follow-up, ubah status (Baru, Dihubungi, Survei)
    S->>S: SPH dari prospek: prospek jadi status Penawaran
    S->>S: Jadikan pelanggan: prospek Menang
    S->>S: SPH: barang, PPN, jadwal termin 100 persen, ajukan
    M->>S: setujui / tolak (tidak boleh SPH sendiri)
    opt pelanggan minta perubahan
        S->>S: Revisi: SPH lama Diganti, draf baru diajukan lagi
    end
    S->>C: Tandai terkirim: PDF dibuat otomatis, tautan berbagi 30 hari
    S->>S: Buat sales order: SPH jadi Deal
    G->>ST: Surat jalan: siapkan, cetak, Kirim (stok keluar, seri terjual, HPP)
    Note over G,ST: SO jadi Diproses. ⚠️ SO tidak pernah jadi Terkirim/Selesai (C1)
    G->>G: Tandai diterima (nama penerima)
    F->>F: Faktur dari SO: uang muka / termin / pelunasan, terbitkan
    F->>FN: piutang dan pendapatan
    alt bayar transfer
        F->>F: Catat pembayaran: kuitansi, faktur Dibayar sebagian / Lunas
    else bayar lewat gateway
        F->>PAY: buat tautan checkout dari faktur
        F->>C: kirim tautan secara manual
        C->>PAY: bayar
        PAY->>F: webhook: kuitansi tercatat otomatis
    end
    F->>FN: kas masuk
    opt hanya Manajer Penjualan
        M->>S: Batalkan SO (masih Dikonfirmasi)
    end
```

### 5a. Penagihan per termin (dari SPH yang Deal)

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor F as Keuangan - Bella
    actor C as Pelanggan
    participant SO as Sales order
    participant INV as Faktur

    S->>S: SPH: jadwal termin, misal DP 30 persen, progres 40 persen, pelunasan 30 persen (total 100)
    S->>SO: Buat SO: jadwal termin ikut tersalin dari SPH
    F->>SO: Detail SO, kartu Penagihan: lihat sudah ditagih dan sisa
    F->>INV: Buat faktur: pilih termin berikutnya (otomatis), sisa tagihan, atau persen/jumlah bebas
    F->>INV: Terbitkan faktur (nomor tetap, piutang tercatat)
    C->>F: bayar (transfer atau tautan gateway)
    F->>INV: Catat pembayaran: Dibayar sebagian / Lunas, kuitansi
    F->>INV: ulangi untuk termin berikutnya sampai seluruh SO tertagih
```

| Pertanyaan | Jawaban (kode saat ini) |
|---|---|
| Di mana jadwal termin dibuat? | Di **form SPH** (bagian Pembayaran: label + persen, total harus 100%) |
| Di mana faktur per termin dibuat? | **Detail SO → kartu Penagihan → Buat faktur**. Kartu menampilkan termin berikutnya dari jadwal SPH, bagian yang sudah ditagih, dan sisa |
| Di mana daftar tagihan per pelanggan? | **Penjualan → Faktur** (semua faktur), **Uang Muka** (faktur termin DP), **Kuitansi** (pembayaran), dan **Keuangan → Piutang** (umur piutang per pelanggan) |
| Bagaimana pembayaran tercatat? | Detail faktur → **Catat pembayaran** (manual), atau tautan gateway dari faktur (kuitansi otomatis lewat webhook) |
| Jenis termin | Uang muka (`down_payment`), angsuran/progres (`installment`), pelunasan (`settlement`) |
| Yang belum ada | Faktur tidak dibuat otomatis per termin (selalu diklik Bella); jatuh tempo belum wajib (FU9); pengingat piutang jatuh tempo (KF-K7); pelanggan belum bisa melihat/membayar faktur di portal (B-38); kuitansi belum bisa dicetak (B-37); PPh 23 dipotong pelanggan (KF-K3) |

**Retur penjualan:**

```mermaid
sequenceDiagram
    actor S as Penjualan - Bilal
    actor M as Manajer Penjualan - Agus MD, Bilal
    actor G as Gudang - Agus, Bilal
    participant ST as Stok

    S->>S: Retur dari surat jalan (Dikirim / Diterima), ajukan
    M->>S: setujui / tolak
    G->>ST: Terima: kondisi per baris Layak jual / Rusak, pilih rak
    ST-->>S: stok kembali, SO kembali Diproses
    Note over G,ST: ⚠️ Barang tanpa seri yang Rusak tetap masuk stok jual (B-13)
```

---

## 6. Surat-surat yang dihasilkan

| Dokumen | Cetak / PDF | Tercatat di daftar dokumen |
|---|---|---|
| SPH | ✅ Halaman cetak; **PDF otomatis saat Tandai terkirim** + tautan berbagi | ✅ |
| Sales order | ❌ Tidak ada cetak/PDF | ✅ |
| Surat jalan | ✅ Halaman cetak | ✅ |
| Faktur | ✅ Halaman cetak | ✅ |
| Kuitansi | ❌ Tidak ada cetak/PDF | ✅ |
| PO | ✅ Halaman cetak | ✅ |
| BPB, retur pembelian, retur penjualan | ❌ Tidak ada cetak | ✅ |
| BAST | ✅ Halaman cetak | ✅ |
| Sertifikat garansi | ✅ Halaman cetak | ✅ |
| Slip gaji | ✅ **PDF otomatis** saat gaji bulan disetujui; unduh di portal karyawan | ✅ |
| Perjanjian kerja | ✅ PDF | ✅ |
| Dokumen bertanda tangan | ✅ PDF bertanda tangan | ✅ |

Setiap dokumen di daftar bisa dibagikan lewat **tautan publik** manual
(Dokumen → Berkas → Buat tautan). PDF di server butuh Chromium; bila belum
diatur, PDF dilewati (catatan X-5).

---

## 7. Proyek

```mermaid
sequenceDiagram
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor TK as Teknisi - Fahri, Jamil, Agus, Alex, Ade
    actor F as Keuangan - Bella
    actor C as Pelanggan (portal)
    participant EP as Portal karyawan
    participant FN as Keuangan (jurnal)

    PM->>PM: Proyek baru: pilih SO yang belum punya proyek, PIC, lokasi, target
    Note over PM: 6 tugas bawaan dibuat, satu per tahap. Satu SO satu proyek aktif
    PM->>PM: Tugas: tambah, tugaskan ke teknisi (web-admin atau portal PIC)
    Note over PM,TK: ⚠️ Teknisi tidak diberi notifikasi saat ditugaskan, ia melihatnya di daftar proyek
    TK->>EP: Proyek saya: ubah status tugas sendiri (todo, dikerjakan, selesai)
    TK->>EP: Check-in lokasi: swafoto, GPS
    Note over TK,EP: ⚠️ Di luar radius tetap tersimpan sebagai out_of_range (akan ditolak, OG1)
    TK->>EP: Unggah bukti: uji fungsi, training, foto
    PM->>PM: Tahap: persiapan, pengiriman, instalasi, uji, training, serah terima (manual)
    PM->>FN: Catat biaya proyek: material, transport, akomodasi, subkon (jurnal)
    PM->>PM: Bahan dari surat jalan SO tampil di proyek
    Note over PM,FN: ⚠️ PO yang ditandai proyek tidak masuk biaya proyek (KF-P7)
    PM->>PM: BAST: buat, terbitkan, cetak
    PM->>PM: Tutup proyek: wajib bukti uji, training, BAST. Tahap jadi Garansi
    PM->>PM: Sertifikat garansi dari BAST: mulai = tanggal BAST, 1 sampai 120 bulan
    C->>C: Portal: lihat proyek, perangkat, garansi
```

---

## 8. Kerja lapangan dan mobilitas karyawan

```mermaid
sequenceDiagram
    actor K as Karyawan / Teknisi
    actor H as SDM - Aqim
    actor W as Pemilik - Aqim
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor G as Gudang - Agus, Bilal
    participant EP as Portal karyawan
    participant AD as Web-admin

    K->>EP: Absen masuk / pulang (cap waktu, tanpa GPS)
    K->>EP: Lihat jadwal kerja
    H->>AD: Jadwal mingguan, isi dari pola
    K->>EP: Ajukan cuti / catat lembur
    H->>AD: atau SDM mencatat cuti / lembur
    W->>AD: setujui / tolak (pencatat tidak boleh menyetujui)
    Note over W,AD: cuti disetujui mengisi absensi otomatis, notifikasi ke karyawan
    H->>AD: Tugas SDM (di luar proyek): notifikasi ke karyawan
    K->>EP: Tugas saya: tandai selesai
    K->>EP: Proyek saya: tugas, bukti, check-in lokasi (bagian 7)
    K->>AD: Peminjaman alat: ajukan (web-admin)
    PM->>AD: setujui peminjaman
    G->>AD: serahkan, terima kembali
    Note over K,AD: ⚠️ Teknisi tidak bisa memilih unit tanpa hak lihat aset (OD1). ❌ Kasbon belum ada di portal (OB13)
    H->>AD: Rekap gaji bulan ini: buat, ubah, impor
    W->>AD: Setujui bulan ini
    AD->>EP: Slip gaji PDF, notifikasi ke karyawan
    K->>EP: Dokumen saya, tanda tangan dokumen
```

| Hal | Kondisi |
|---|---|
| Dua jenis tugas | **Tugas proyek** (per tahap, tanpa notifikasi) dan **tugas SDM** (tanpa proyek, ada notifikasi). Keduanya tampil di portal karyawan |
| Absen kantor | ✅ cap waktu tanpa GPS/swafoto |
| Absen lokasi proyek | ✅ swafoto + GPS, jarak dihitung PostGIS (radius bawaan 100 m); ⚠️ di luar radius tetap diterima |
| Kasbon | ⚠️ ada di web-admin Keuangan, teknisi tidak bisa membuka menunya (OB13) |

---

## 9. Aset dan peralatan

```mermaid
sequenceDiagram
    actor W as Pemilik - Aqim
    actor MO as Manajer Operasional - Aqim
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor G as Gudang - Agus, Bilal
    actor F as Akuntan - Bella
    participant IT as Aset (inventory items)
    participant FN as Keuangan (jurnal)

    W->>IT: Register aset manual: nama, jenis, seri, harga dan tanggal perolehan, foto
    Note over W,IT: Aset tidak berasal dari BPB atau barang, selalu diketik manual
    W->>IT: Tempatkan / pindahkan ke gudang dan rak
    PM->>IT: Peminjaman: ajukan (peminjam diketik sebagai ID, OD4)
    PM->>IT: setujui (pembuat bisa menyetujui sendiri, OD2)
    G->>IT: serahkan (aset jadi Dipinjam), kembalikan, tandai hilang
    Note over G,IT: ⚠️ Gudang bisa menyerahkan tanpa persetujuan (C13). Pengembalian selalu kondisi baik (OD7)
    W->>IT: Catatan servis (backend ada, layar belum, OD5)
    F->>FN: Kapitalisasi aset ke buku aset tetap, golongan fiskal
    F->>FN: Jalankan penyusutan bulanan (jurnal)
    W->>IT: Penyusutan manual (tanpa jurnal)
    Note over F,IT: ⚠️ Entri manual membuat penyusutan otomatis melewati aset itu (KF-A1)
    W->>IT: Penghapusan aset: ajukan, setujui, eksekusi (jurnal pelepasan, nilai buku 0)
```

---

## 10. Purna jual: tiket servis dan garansi

```mermaid
sequenceDiagram
    actor C as Pelanggan
    actor CS as Layanan Pelanggan - Bilal
    actor PM as Manajer Proyek - Agus, Jamil, Hatta
    actor TK as Teknisi - Fahri, Jamil, Agus, Alex, Ade
    participant WR as Cek garansi

    alt lewat portal
        C->>CS: Tiket dari portal: pilih perangkat (baris sertifikat garansi), keluhan
    else lewat WA / telepon
        CS->>CS: Tiket baru: nomor seri, pelanggan, keluhan
    end
    CS->>WR: cek garansi
    WR-->>CS: seri, surat jalan, SO, proyek, sertifikat: dalam / di luar garansi
    Note over CS,WR: ⚠️ Barang yang dijual tanpa proyek selalu di luar garansi (KF-P2)
    CS->>TK: tugaskan teknisi (CS atau PM)
    TK->>TK: Mulai kerjakan, Selesaikan: tindakan, biaya servis
    Note over TK: ❌ Biaya servis tidak bisa ditagih jadi SPH/faktur (KF-P1)
    CS->>C: minta konfirmasi
    C->>CS: konfirmasi di portal (backend ada, belum tersambung di portal)
    CS->>CS: Tutup tiket: dikonfirmasi oleh, saluran
```

---

## 11. Status dokumen

```mermaid
stateDiagram-v2
    [*] --> draft: SPH dibuat
    draft --> submitted: ajukan
    submitted --> approved: setujui
    submitted --> rejected: tolak
    rejected --> draft: ubah
    approved --> sent: tandai terkirim, PDF
    approved --> won: buat SO
    sent --> won: buat SO
    approved --> superseded: revisi
    sent --> superseded: revisi
    draft --> lost: batal
    submitted --> lost: batal
    sent --> lost: batal
```

```mermaid
stateDiagram-v2
    [*] --> confirmed: SO dari SPH
    confirmed --> in_progress: surat jalan dikirim
    confirmed --> cancelled: batal
    in_progress --> delivered: belum pernah ditulis kode
    delivered --> completed: belum pernah ditulis kode
    note right of in_progress
        SO berhenti di sini (C1)
    end note
```

```mermaid
stateDiagram-v2
    [*] --> prepared: surat jalan disiapkan
    prepared --> shipped: kirim, stok keluar
    prepared --> cancelled: batal
    shipped --> delivered: tandai diterima
```

```mermaid
stateDiagram-v2
    [*] --> draft_inv: faktur dibuat
    draft_inv --> issued: terbitkan
    draft_inv --> cancelled_inv: batal
    issued --> partially_paid: bayar sebagian
    issued --> paid: lunas
    partially_paid --> paid: lunas
    issued --> void: void
    issued --> written_off: hapus piutang
    partially_paid --> written_off: hapus piutang
```

```mermaid
stateDiagram-v2
    [*] --> po_draft: PO dibuat
    po_draft --> po_submitted: ajukan
    po_submitted --> po_draft: tolak
    po_submitted --> po_approved: setujui
    po_approved --> po_sent: tandai terkirim
    po_sent --> partially_received: BPB sebagian
    po_sent --> received: BPB penuh
    partially_received --> received: BPB sisa
    po_draft --> po_cancelled: batal
    po_approved --> po_cancelled: batal
    po_sent --> po_cancelled: batal, sebelum ada BPB
```

```mermaid
stateDiagram-v2
    [*] --> active: proyek dibuat dari SO
    state active {
        preparation --> delivery
        delivery --> installation
        installation --> testing
        testing --> training
        training --> handover
    }
    active --> closed: tutup, wajib bukti uji, training, BAST
    active --> cancelled_p: batal dengan alasan
    closed --> [*]: tahap Garansi
```

```mermaid
stateDiagram-v2
    [*] --> new_t: tiket dibuat
    new_t --> in_progress_t: mulai kerjakan
    in_progress_t --> resolved: selesaikan
    resolved --> in_progress_t: buka lagi
    resolved --> closed_t: tutup, konfirmasi pelanggan
```

```mermaid
stateDiagram-v2
    [*] --> requested: peminjaman diajukan
    requested --> approved_b: setujui
    requested --> rejected_b: tolak
    approved_b --> issued_b: serahkan
    requested --> issued_b: serahkan langsung (C13)
    issued_b --> partially_returned: kembali sebagian
    issued_b --> returned: kembali semua
    partially_returned --> returned
    returned --> closed_b
```

---

## 12. Titik putus saat ini (ringkas)

| No | Titik | Bagian | Keputusan / rencana |
|---|---|---|---|
| 1 | PO, PR, retur buatan Aqim tidak bisa disetujui | 2, 3 | K1 |
| 2 | Nomor PO bisa melebihi 32 karakter | 2 | K6, L-2 |
| 3 | "Tandai terkirim" menahan PO dari gudang | 2 | B1 |
| 4 | Pembayaran pemasok belum ada; PO kurang kirim tidak bisa ditutup | 2 | OB3, KF-B1 |
| 5 | Bahan proyek tidak bisa dikeluarkan dari stok secara manual | 3, 7 | KF-G1 |
| 6 | Checkout website dan pesanan/SPH/faktur di portal belum tersambung | 4 | B-38 (T21, T25) |
| 7 | SO tidak pernah Terkirim/Selesai | 5 | C1 |
| 8 | Retur rusak masuk stok jual | 5 | B-13 |
| 9 | Kuitansi, SO, BPB, retur tanpa cetak | 6 | B-37 |
| 10 | Teknisi tidak diberi notifikasi tugas proyek | 7 | B-35, RM3 |
| 11 | Absen lokasi di luar radius tetap diterima | 7, 8 | OG1, PK-1 |
| 12 | Biaya proyek tanpa PO proyek | 7 | KF-P7 |
| 13 | Kasbon tidak terjangkau teknisi | 8 | OB13 |
| 14 | Peminjaman: ID mentah, serah tanpa persetujuan, kondisi kembali | 9 | OD1, OD4, C13, OD7 |
| 15 | Penyusutan manual vs otomatis bentrok | 9 | KF-A1 |
| 16 | Garansi barang tanpa proyek; tiket berbayar tidak bisa ditagih | 10 | KF-P2, KF-P1 |
| 17 | Konfirmasi tiket di portal belum tersambung | 10 | B-36 |
