# Teks pesan WhatsApp untuk pelanggan dan pemasok

Disusun 2026-11-28. Kembali ke [catatan penyesuaian](../README.md).

**Status: usulan, menunggu persetujuan Pak Aqim.** Setiap pesan baru
dikirim bila **sakelarnya dihidupkan** di Pengaturan → Notifikasi WhatsApp
(N8-5); semua sakelar mati sampai teks disetujui. Teks tetap disimpan di
workflow n8n (ADR-0020), jadi bisa diubah tanpa mengubah kode ERP.

Sumber teks sekarang:
`docs/integrations/n8n/src/3-compose-messages.js`. Usulan di bawah
merapikan teks itu: sapaan seragam, nama perusahaan, tautan portal (PP-5),
dan penutup yang sama.

**Tanda isian:** `{pelanggan}` nama pelanggan, `{perusahaan}` nama
perusahaan (pengaturan workflow, sekarang "Entragate"), `{nomor}` nomor
dokumen, `{jumlah}` rupiah, `{tanggal}`, `{tautan}` tautan portal.

---

## 1. SPH terkirim (dengan lampiran PDF)

**Sekarang:** "Yth. {pelanggan}, Berikut penawaran {nomor} ({judul}) dari
{perusahaan} sebesar {jumlah}. Masa berlaku: {tanggal}. Terima kasih."

**Usulan:**
```
Yth. {pelanggan},

Terlampir penawaran harga {nomor} – {judul} dari {perusahaan} sebesar {jumlah}, berlaku sampai {tanggal}.

Penawaran juga bisa dilihat dan disetujui di portal pelanggan: {tautan}

Bila ada pertanyaan, silakan balas pesan ini. Terima kasih.
```
☐ Setuju ☐ Ubah: ____________________

## 2. Faktur terbit

**Sekarang:** "Yth. {pelanggan}, Invoice {nomor} dari {perusahaan} sebesar
{jumlah} jatuh tempo {tanggal}. Terima kasih."

**Usulan:**
```
Yth. {pelanggan},

Faktur {nomor} dari {perusahaan} sebesar {jumlah} telah terbit, jatuh tempo {tanggal}.

Lihat dan bayar faktur di portal pelanggan: {tautan}

Terima kasih atas kepercayaan Anda.
```
☐ Setuju ☐ Ubah: ____________________

## 3. Pembayaran diterima

**Sekarang:** "Terima kasih, pembayaran {jumlah} untuk invoice {nomor}
sudah kami terima. Sisa tagihan: {sisa}." / "... Invoice sudah lunas."

**Usulan:**
```
Yth. {pelanggan},

Terima kasih, pembayaran {jumlah} untuk faktur {nomor} sudah kami terima pada {tanggal}.
{Sisa tagihan: {sisa}. | Faktur sudah lunas.}

Kuitansi dapat diunduh di portal pelanggan: {tautan}
```
☐ Setuju ☐ Ubah: ____________________

## 4. Pesanan dikirim / selesai (baru, N8-6)

**Sekarang:** belum ada.

**Usulan (terkirim):**
```
Yth. {pelanggan},

Pesanan {nomor_SO} sudah kami kirim dengan surat jalan {nomor_SJ} pada {tanggal}.
Pantau status pesanan di portal pelanggan: {tautan}
```
**Usulan (selesai):**
```
Yth. {pelanggan},

Pesanan {nomor_SO} telah selesai. Terima kasih telah mempercayakan kebutuhan Anda kepada {perusahaan}.
```
☐ Setuju ☐ Ubah: ____________________

## 5. Tiket servis

**Sekarang:** satu kalimat per perubahan (diterima, ditugaskan, mulai
ditangani, selesai, dibuka kembali, ditutup).

**Usulan:**

| Keadaan | Teks |
|---|---|
| Diterima | `Yth. {pelanggan}, laporan Anda sudah kami terima dengan nomor tiket {nomor}: {keluhan}. Teknisi kami akan segera menghubungi Anda.` |
| Ditugaskan | `Tiket {nomor} ditangani oleh teknisi {nama_teknisi}.` |
| Mulai ditangani | `Teknisi kami mulai menangani tiket {nomor}.` |
| Selesai | `Tiket {nomor} telah selesai ditangani: {penyelesaian}. Mohon konfirmasi di portal pelanggan bila sudah sesuai: {tautan}` |
| Dibuka kembali | `Tiket {nomor} kami buka kembali dan akan segera ditindaklanjuti.` |
| Ditutup | `Tiket {nomor} telah ditutup. Terima kasih atas kepercayaan Anda.` |

☐ Setuju ☐ Ubah: ____________________

## 6. Lisensi akan habis / berakhir

**Sekarang:** "Yth. {pelanggan}, Lisensi {aplikasi} ({nomor}) berakhir
{tanggal} ({sisa_hari} hari lagi). Hubungi kami untuk perpanjangan." /
"... sudah berakhir {tanggal}. Masa tenggang sampai {tanggal_tenggang}."

**Usulan:**
```
Yth. {pelanggan},

Lisensi {aplikasi} ({nomor}) akan berakhir pada {tanggal} ({sisa_hari} hari lagi).
Agar layanan tidak terhenti, silakan hubungi kami untuk perpanjangan dengan membalas pesan ini.
```
**Usulan (sudah berakhir):**
```
Yth. {pelanggan},

Lisensi {aplikasi} ({nomor}) telah berakhir pada {tanggal}. Masa tenggang berlaku sampai {tanggal_tenggang}.
Silakan balas pesan ini untuk perpanjangan.
```
☐ Setuju ☐ Ubah: ____________________

## 7. Retur penjualan

**Sekarang / usulan** (teks sekarang sudah baik, hanya diseragamkan):

| Keadaan | Teks |
|---|---|
| Disetujui | `Yth. {pelanggan}, pengajuan retur {nomor} telah disetujui. Tim kami akan menghubungi Anda untuk pengambilan atau pengiriman barang.` |
| Barang diterima | `Yth. {pelanggan}, barang retur {nomor} sudah kami terima. Barang pengganti akan segera kami kirim.` |

☐ Setuju ☐ Ubah: ____________________

## 8. Pemasok: barang retur dikirim

**Sekarang / usulan:**
```
Yth. {nama_PIC_pemasok},

{perusahaan} mengirim kembali barang berikut untuk diganti (retur {nomor}, PO {nomor_PO}):
{daftar_barang}
Alasan: {alasan}

Mohon konfirmasi penerimaan dan jadwal penggantian. Terima kasih.
```
☐ Setuju ☐ Ubah: ____________________

---

## Catatan

| Hal | Keterangan |
|---|---|
| Nama perusahaan | Sekarang "Entragate" di pengaturan workflow; ganti bila ingin "CV Inti Multi Solusi" atau gabungan |
| Tautan portal | Bergantung pada portal pelanggan (B-38); sebelum portal siap, kalimat tautan dihilangkan |
| Meta Cloud API | Saat pindah ke Meta (B-47), teks yang disetujui menjadi **template** yang diajukan ke Meta (`docs/integrations/n8n/meta-templates.json`) |
| Pesan staf | Tidak perlu persetujuan Aqim; daftar penerima di `rancangan-n8n-whatsapp.md` bagian 3 |

| Disetujui oleh | Tanggal | Catatan |
|---|---|---|
| Pak Aqim | | |
