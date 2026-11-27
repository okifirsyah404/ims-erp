# Trik prompt untuk AI (langsung ke file yang dituju, hemat token)

Disusun 2026-11-28. Kembali ke [aturan pengerjaan](README.md).

AI paling boros token saat harus **mencari**: membaca banyak file, menebak
letak kode, atau mengulang pemeriksaan. Prompt yang baik memberi **alamat
yang tepat**, **batas yang jelas**, dan **cara membuktikan selesai**.

## 1. Prinsip

| No | Prinsip | Contoh |
|---|---|---|
| T-1 | **Sebut ID tugas dan peta kode**, bukan menjelaskan ulang | "Kerjakan P7-3 sesuai `docs/adjustment/5-pengerjaan/peta-kode-dafrin.md#p7-3`" |
| T-2 | **Sebut path file + fungsi/baris** yang diubah | "`apps/backend/src/app/procurement/services/purchase-order.service.ts` fungsi `decide` sekitar baris 225" |
| T-3 | **Batasi lingkup** | "Hanya ubah file yang tercantum. Jangan menjelajah folder lain. Jangan refactor di luar tugas" |
| T-4 | **Beri kriteria selesai** | "Selesai bila test `purchase-order.service.test.ts` lulus dan langkah UAT 1–3 Valid" |
| T-5 | **Tempel kesalahan apa adanya** (pesan, stack, baris) daripada menceritakannya | Salin output test/terminal yang gagal |
| T-6 | **Minta test yang terarah** saat iterasi | "Jalankan hanya `bun test apps/backend/test/unit/purchase-order.service.test.ts`"; test penuh sekali sebelum push |
| T-7 | **Satu permintaan, satu tujuan**; gabungkan perubahan kecil yang saling terkait dalam satu prompt | "Perbaiki P7-3-F1 dan P7-3-F2 (dua-duanya di file yang sama)" |
| T-8 | **Jangan minta membaca ulang** yang sudah dibaca di sesi yang sama | "File itu sudah kamu baca; langsung edit" |
| T-9 | **Minta laporan singkat**: file yang diubah + hasil test, tanpa menempel ulang kode | "Laporkan path yang diubah dan hasil test saja" |
| T-10 | **Rujuk keputusan dengan ID** (K1, FU6, PP-5) daripada menyalin isi keputusan | "Ikuti FU6 untuk pesan salah harga" |
| T-11 | Bila letak kode belum diketahui, minta **pencarian terarah** dulu | "Cari dengan Grep `canSelfApprove` di `apps/backend/src/app/inventory`, lalu edit" (atau `graphify query` bila tersedia) |
| T-12 | **Mulai sesi baru per tugas** agar konteks lama tidak ikut terbawa; sebut ringkasan singkat bila perlu | "Lanjut P7-3; P7-1 dan P7-2 sudah di main" |

## 2. Templat prompt

**Paling cepat:** setiap tugas di `peta-kode-dafrin.md` dan `peta-kode-oki.md` sudah punya blok **Prompt AI (salin)** yang terisi (ID, file, test, UAT). Salin blok itu apa adanya; templat di bawah untuk keadaan lain.

### a. Mulai tugas baru
```text
Kerjakan <ID> <judul>.
Acuan: docs/adjustment/5-pengerjaan/peta-kode-<dafrin|oki>.md bagian <ID>.
Buka hanya file yang tercantum di bagian itu. Jangan menjelajah folder lain.
Ikuti AGENTS.md dan docs/adjustment/5-pengerjaan/README.md.
Tambahkan data seeder fitur ini (A-10) dan teks bantuan menu/tabel/form (RF-28–RF-34).
Branch: <nama branch> dari origin/main.
Selesai bila: <test yang harus lulus> dan langkah UAT <nomor> di peta kode terpenuhi.
Setelah selesai, buat docs/adjustment/5-pengerjaan/uat/<ID>-<slug>.md dari templat uat-pengerjaan.md.
Laporkan: daftar file yang diubah dan hasil test.
```

### b. Perbaikan dari UAT (paling hemat)
```text
Perbaiki <ID>-F<n> di docs/adjustment/5-pengerjaan/uat/<ID>-<slug>.md.
Temuan: <yang terlihat> ; seharusnya: <yang seharusnya>.
Lokasi: <path>:<baris> (fungsi <nama>).
Ubah hanya file itu (dan test-nya). Jalankan bun test <path test>.
Tandai baris perbaikan Selesai dengan tanggal; laporkan diff singkat dan hasil test.
```

### c. Kesalahan test / build
```text
Test ini gagal setelah perubahan <ID>:
<tempel output kesalahan>
Perbaiki penyebabnya di <path> tanpa mengubah perilaku lain. Jalankan ulang hanya test ini.
```

### d. Tinjauan sebelum push
```text
Jalankan checklist sebelum push di docs/adjustment/5-pengerjaan/README.md bagian 3 untuk branch ini.
Laporkan hanya butir yang belum terpenuhi beserta alasannya.
```

## 3. Yang membuat boros (hindari)

| Hindari | Gantinya |
|---|---|
| "Perbaiki semua bug di modul pembelian" | Satu ID perbaikan per prompt, dengan path |
| "Coba cek kenapa error" tanpa pesan kesalahan | Tempel pesan kesalahan lengkap |
| Meminta AI membaca seluruh `docs/adjustment/` | Sebut satu bagian (ID) yang relevan |
| Meminta menjalankan semua test setiap kali | Test file terkait saat iterasi; test penuh sekali di akhir |
| Menjelaskan ulang keputusan panjang lebar | Sebut ID keputusan |
| Melanjutkan satu sesi panjang untuk banyak tugas | Sesi baru per tugas |
