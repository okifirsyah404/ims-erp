# Diagram alur (sekarang dan sesudah perbaikan)

Kembali ke [catatan penyesuaian](../../README.md). Satu tempat untuk semua
diagram alur (UML/Mermaid) konsep saat ini, dengan aktor ditulis
"Role - nama orang". Bisa dibuka di GitHub atau di VS Code (Markdown Preview
dengan dukungan Mermaid).

Semua diagram dicek dengan pemeriksa Mermaid (`mermaid.parse` + jsdom)
supaya tidak ada yang rusak saat ditampilkan.

## Kondisi sekarang

| Wilayah | File | Isi |
|---|---|---|
| **Seluruh alur (end-to-end)** | [`alur-lengkap-saat-ini.md`](alur-lengkap-saat-ini.md) | **Mulai dari sini.** Satu dokumen: peta besar, data induk, pengadaan, stok, jalur masuk pesanan (website, WhatsApp, portal, input staf), penjualan sampai uang masuk, surat-surat, proyek, kerja lapangan, aset, purna jual, status dokumen, titik putus. Tanpa n8n |
| Modul programmer B (Dafrin) | [`../uat-modul/diagram-alur-per-role.md`](../../1-validasi/uat-modul/diagram-alur-per-role.md) | 8 diagram urutan (pembelian, retur/penyesuaian, penjualan, retur penjualan, proyek, lisensi, karyawan/gaji, integrasi) + 4 diagram status dokumen |
| Modul Oki | [`sekarang-modul-oki.md`](sekarang-modul-oki.md) | Login/undangan/role, faktur sampai kas, tagihan dan pembayaran, kasbon dan pertanggungjawaban, jurnal dan tutup periode, gaji dan pajak, aset dan peminjaman, absensi portal karyawan, diagram status |
| Relasi tabel (ERD) | [`../skema-database/`](../skema-database/README.md) | 20 diagram, satu per schema |
| Lintas modul | [`../lintas-modul/`](../lintas-modul/README.md) | 7 diagram: login, penomoran, dokumen/file, notifikasi, portal, infrastruktur, di luar scope |

## Sekarang vs sesudah perbaikan

| File | Isi |
|---|---|
| [`sekarang-vs-sesudah.md`](sekarang-vs-sesudah.md) | Untuk setiap alur yang berubah: diagram **Sekarang** (dengan titik macet/bermasalah) dan **Sesudah (usulan)**, beserta nomor keputusan dan bagian kode yang terdampak. Ditutup peta bentrok sesudah perbaikan |

**Status:** diagram "Sesudah" sudah **disetujui Pemilik pada rapat 2026-11-27** (semua keputusan sesuai usulan di [`../lembar-keputusan-rapat.md`](../../2-keputusan/lembar-keputusan-rapat.md)). Oki masih meninjau lewat PR #171.

`docs/user-guide/diagrams.md` (2026-11-06) adalah versi lama dan sebagian
sudah usang; pakai diagram di folder ini.
