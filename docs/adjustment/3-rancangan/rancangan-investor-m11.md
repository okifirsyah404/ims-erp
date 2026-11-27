# Rancangan investor dan suntikan dana (M11)

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: keputusan programmer B lewat tanya-jawab 2026-11-28, langsung
berlaku. Mengubah K10** (rapat 27/11: "M11 ditunda") **menjadi: M11 dibangun
lengkap sekarang, prioritas Tinggi**; perhitungan bagi hasil menunggu aturan
dari Aqim. Belum ada kode. M11 wilayah **Oki** (kontrak T13, T29, T30).

**Kondisi sekarang:** tiga halaman "Segera hadir" di Keuangan → Bonus &
Investor; schema `investor` sudah dihapus (ADR-0024, ADR-0030); izin
investor masih ada di `erp-permissions.ts`; `apps/web-investor` templat
kosong; kontrak laba periode terkunci (`ExportedProfitService`) sudah ada
di finance. Daftar akun punya **Modal Disetor (3-1000)** dan **Prive dan
Dividen (3-4000)**.

## 1. Keputusan

| No | Keputusan |
|---|---|
| IV-1 | **M11 dibangun lengkap sekarang** (mengganti K10, OE1–OE4, MN5); prioritas **Tinggi** di langkah 8 |
| IV-2 | **Tiga bentuk dana:** (a) **modal** (masuk Modal Disetor, ikut bagi hasil); (b) **pinjaman** (masuk utang, dibayar kembali + imbal); (c) **dana per proyek** (membiayai proyek tertentu, mendapat bagian dari hasil proyek itu) |
| IV-3 | **Aqim sendiri** yang mencatat setoran dan perjanjian investor (tercatat di audit) |
| IV-4 | **Pinjaman:** pokok, **imbal/bunga tetap** (persen atau nominal), **jadwal angsuran**, pengingat jatuh tempo, pembayaran lewat Keuangan |
| IV-5 | **Bagi hasil menunggu aturan dari Aqim:** periode (tahunan?), dasar laba (sebelum/sesudah pajak), porsi (rasio modal atau persen tetap), cadangan; untuk dana per proyek: dasar hasil proyek (margin proyek) dan porsi |
| IV-6 | **Portal investor** (`apps/web-investor`): investor melihat **setoran dan saldo modal/pinjaman miliknya** (riwayat, sisa pinjaman, jadwal angsuran), **bagi hasil dan pembayarannya**, **laporan ringkas perusahaan** yang dipublikasikan Aqim (bukan buku besar), dan **hasil proyek yang ia danai** (nilai kontrak, biaya, margin, bagiannya) |

## 2. Alur

```mermaid
sequenceDiagram
    actor W as Pemilik - Aqim
    actor F as Keuangan - Bella
    actor I as Investor (portal investor)
    participant ERP as ERP

    W->>ERP: data investor + perjanjian (modal / pinjaman / dana per proyek)
    I->>W: transfer dana
    W->>ERP: catat setoran: tanggal, jumlah, rekening, bukti transfer
    ERP->>ERP: jurnal otomatis: Kas/Bank vs Modal Disetor / Utang investor / dana proyek
    alt pinjaman
        ERP->>W: jadwal angsuran, pengingat jatuh tempo
        F->>ERP: bayar angsuran + imbal
    else dana per proyek
        ERP->>ERP: hasil proyek (margin) setelah proyek ditutup
    end
    W->>ERP: hitung bagi hasil periode (aturan dari Aqim, IV-5)
    W->>ERP: setujui dan publikasikan
    F->>ERP: bayar bagi hasil (jurnal Prive/Dividen atau beban imbal)
    I->>ERP: lihat setoran, saldo, angsuran, bagi hasil, laporan ringkas, hasil proyek
```

## 3. Tampilan

| Layar | Isi |
|---|---|
| Web-admin: Investor → Daftar Investor | Data investor (nama, kontak, NPWP, rekening), login portal, ringkasan dana |
| Web-admin: Investor → Dana | Setoran per investor dan bentuknya; pinjaman dengan jadwal angsuran; dana per proyek dengan proyeknya; bukti transfer |
| Web-admin: Investor → Bagi Hasil | Periode, dasar perhitungan, porsi per investor, status (draf / disetujui / dibayar), publikasi ke portal |
| Web-admin: Investor → Laporan | Laporan ringkas yang dipublikasikan (misal laba rugi tahunan) |
| Portal investor | Beranda saldo; riwayat setoran; pinjaman dan angsuran; bagi hasil; laporan; proyek yang didanai |
| Dasbor Aqim | Kartu total dana investor per bentuk; angsuran jatuh tempo |

## 4. Yang perlu diperhatikan saat desain

| Hal | Catatan |
|---|---|
| ADR dan skema | Butuh **ADR baru** dan schema baru (letak tabel, misal schema `investor` baru atau di `finance`); `docs.dbml` dulu (Gate 1); jumlah schema di AGENTS.md dan `docs/database/` ikut berubah |
| Wilayah | Oki (M11, finance, portal investor); dana per proyek membaca margin proyek dari modul `project` (Dafrin) lewat kontrak antarmodul |
| Akun | Utang investor (pinjaman), beban imbal/bunga, Prive dan Dividen (3-4000) untuk bagi hasil modal; dicek dengan Bella |
| Persetujuan | Setoran dicatat Aqim (IV-3); bagi hasil disetujui Aqim; pembayaran oleh Bella |
| Pertanyaan untuk Aqim | Aturan bagi hasil (IV-5); siapa investor saat ini dan bentuk dananya; laporan apa yang boleh dilihat investor |
