# Panduan setup WhatsApp (WAHA) dan n8n (M04, T32)

Untuk orang yang menghubungkan ERP dengan WAHA, n8n, dan penyedia AI.
Kontrak teknisnya ada di `docs/architecture/modules/notification.md` dan
ADR-0020; panduan ini versi langkah demi langkahnya. Versi Inggris:
[whatsapp-n8n-setup.en.md](whatsapp-n8n-setup.en.md) (keduanya diubah
bersamaan).

> **Status (2026-11-12):** sisi ERP sudah dibangun dan diuji dengan penerima
> palsu lokal serta webhook uji yang ditandatangani. **Belum pernah dicoba
> dengan WAHA, n8n, atau penyedia AI sungguhan** — percobaan nyata pertama
> menjadi bagian UAT (`docs/plan/uat/`). Pakai nomor WhatsApp sandbox dulu;
> WAHA tidak resmi dan nomor bisa diblokir.

> **WAHA tidak resmi dan nomor bisa diblokir.** Untuk produksi, pakai WhatsApp Business resmi
> (Meta Cloud API): [whatsapp-business-meta.id.md](whatsapp-business-meta.id.md).

## 1. Alur

```text
WhatsApp pelanggan ──► WAHA ──POST /webhooks/whatsapp──► ERP
ERP ──POST /api/sendText──► WAHA ──► WhatsApp pelanggan     (balasan)
Outbox ERP ──POST N8N_WEBHOOK_URL──► n8n ──► WAHA / email  (notifikasi)
ERP ──POST <AI_BASE_URL>/chat/completions──► penyedia AI   (opsional)
```

- Chat masuk langsung WAHA → ERP (tidak lewat n8n).
- Event bisnis (lead baru, invoice, pembayaran, tiket, lisensi jatuh tempo,
  handoff) dikirim ERP → n8n. n8n yang menentukan pesan dan penerimanya; ERP
  tidak menyimpan template.

## 2. Persiapan

- **Nomor WhatsApp khusus** untuk asisten (sandbox dulu, jangan nomor pribadi
  owner).
- Instance WAHA (Docker) yang bisa dijangkau ERP dan bisa menjangkau URL
  publik ERP (`APP_URL`).
- Instance n8n dengan URL webhook publik (HTTPS).
- Opsional: penyedia AI yang kompatibel OpenAI (base URL, API key, nama
  model). Tanpa itu semua chat diserahkan ke admin — cara aman untuk mulai.
- Akses ke `.env` backend di server. Jangan menempelkan rahasia ke chat,
  tiket, atau screenshot.

Buat setiap rahasia minimal 16 karakter, misalnya `openssl rand -hex 32`, dan
simpan di password manager.

## 3. `.env` backend

| Variabel | Nilai | Catatan |
| --- | --- | --- |
| `WAHA_URL` | base URL WAHA, mis. `http://waha:3000` | Tanpa `/api` di belakang. |
| `WAHA_API_KEY` | API key WAHA | Dikirim sebagai `X-Api-Key`. |
| `WAHA_SESSION` | nama sesi WAHA | Default `default`. |
| `WAHA_WEBHOOK_SECRET` | acak, ≥ 16 karakter | Sama dengan HMAC key di WAHA (langkah 4). |
| `N8N_WEBHOOK_URL` | URL webhook produksi n8n | Langkah 5. |
| `N8N_WEBHOOK_SECRET` | acak, ≥ 16 karakter | Sama dengan nilai di langkah verifikasi n8n. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | nilai dari penyedia | Opsional. |
| `SCHEDULER_ENABLED` | `true` | Wajib untuk `license.due` harian. |
| `SCHEDULER_LICENSE_DUE_CRON` | mis. `0 8 * * *` | Jam Asia/Jakarta; default 08.00. |

Restart backend. Buka **WhatsApp AI (otomatisasi)**: peringatan menampilkan
apa yang belum diisi (kunci webhook, WAHA, penyedia AI); tanpa peringatan
berarti ketiganya sudah diisi. Nilainya tidak pernah ditampilkan. Tanpa
`N8N_*`, event tetap `pending` ("not configured") dan bisa dikirim dari
**Webhook (n8n)** setelah diisi.

## 4. WAHA → ERP (chat masuk)

1. Jalankan sesi WAHA dan scan QR dengan nomor khusus.
2. Di pengaturan webhook sesi:
   - URL: `<APP_URL>/webhooks/whatsapp`
   - Event: hanya `message`
   - HMAC key: nilai `WAHA_WEBHOOK_SECRET`
     (WAHA lalu mengirim `X-Webhook-Hmac`, HMAC-SHA512 dari body).
3. Kirim pesan uji dari HP lain ke nomor khusus.
4. Hasil yang diharapkan: chat muncul di **WhatsApp AI (otomatisasi)** dalam
   beberapa detik. Tanpa penyedia AI chat ditandai **Perlu admin**
   (`no_provider`) dan pelanggan menerima satu balasan penahan.

Pemecahan masalah:

| Gejala | Penyebab |
| --- | --- |
| Log WAHA `503` | `WAHA_WEBHOOK_SECRET` belum diisi di ERP. |
| Log WAHA `401` | HMAC key di WAHA berbeda dengan `WAHA_WEBHOOK_SECRET`. |
| `200` tapi chat tidak muncul | Grup, status, channel, atau pesan sendiri — memang diabaikan. |
| Chat muncul, balasan "gagal" | `WAHA_URL` / `WAHA_API_KEY` / `WAHA_SESSION` salah, atau sesi belum tersambung. Perbaiki lalu tekan **Kirim ulang**. |

## 5. ERP → n8n (notifikasi)

1. Di n8n buat workflow dengan trigger **Webhook**: method `POST`, response
   "Immediately", aktifkan opsi **Raw Body**. URL produksinya dipakai sebagai
   `N8N_WEBHOOK_URL`.
2. Tambahkan langkah verifikasi (node Code; izinkan modul `crypto` dengan
   `NODE_FUNCTION_ALLOW_BUILTIN=crypto` di server n8n):

   ```js
   const crypto = require('crypto');
   const h = $input.first().json.headers;
   const raw = Buffer.from($input.first().binary.data.data, 'base64').toString('utf8');
   const expected = 'sha256=' + crypto
     .createHmac('sha256', $env.ERP_WEBHOOK_SECRET)   // = N8N_WEBHOOK_SECRET
     .update(`${h['x-erp-timestamp']}.${raw}`).digest('hex');
   const given = h['x-erp-signature'] ?? '';
   if (given.length !== expected.length ||
       !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
     throw new Error('bad signature');
   }
   return [{ json: { ...JSON.parse(raw), eventId: h['x-erp-event-id'] } }];
   ```

   Tolak juga event dengan `x-erp-timestamp` lebih lama dari ±10 menit bila
   ingin perlindungan replay.
3. **Dedupe berdasarkan `X-Erp-Event-Id`**: retry atau "kirim ulang" manual
   mengirim id yang sama. Simpan id yang sudah diproses (data table n8n,
   Redis, atau sheet) dan berhenti bila id sudah pernah ditangani.
4. **Switch** berdasarkan `topic`, satu cabang per topik (tabel di bawah).
   Nominal berupa bilangan bulat satuan sen: bagi 100 untuk rupiah.
5. Kirim WhatsApp dari n8n lewat WAHA `POST /api/sendText`
   (`{ session, chatId: "<62…>@c.us", text }`, header `X-Api-Key`) dan email
   lewat node email.
6. Jawab `2xx` hanya bila event sudah ditangani. `5xx`, `408`, `429`, dan
   timeout dicoba ulang oleh ERP (5 kali, jeda mulai 30 detik); `4xx` lain
   menghentikan retry. Setiap percobaan terlihat di **Webhook (n8n)**.

| Topik | Saran alur |
| --- | --- |
| `lead.created` | Kabari sales manager (lead baru, sumber, kebutuhan). |
| `invoice.issued` | Kirim ke pelanggan nomor invoice, total, dan jatuh tempo. |
| `receipt.recorded` | Ucapkan terima kasih; tampilkan terbayar dan sisa. |
| `service_ticket.updated` | Kabari pelapor status baru (`change`). |
| `whatsapp.handoff` | Kabari admin jaga: chat perlu orang (`reason`, `question`). |
| `license.due` | Ingatkan pelanggan pada 30 / 7 / 0 hari (`threshold`, `stage`). Sekali per kontrak dan ambang. |
| `purchase_return.updated` | Retur pembelian: minta persetujuan, minta gudang mengirim, kabari PIC pemasok. |
| `sales_return.updated` | Retur penjualan: minta persetujuan, siapkan gudang, kabari pelanggan. |
| `supplier_bill.recorded` | Kabari finance tagihan pemasok yang dicatat. |
| `supplier_bill.due` | Ingatkan finance H-7, hari jatuh tempo, dan lewat jatuh tempo (`threshold`, `stage`). |

Daftar field per topik: `notification.md`, "The event contract".

Workflow siap import yang menangani semua topik ini: [n8n-workflows.id.md](n8n-workflows.id.md).

## 6. Penyedia AI (opsional)

Isi `AI_BASE_URL` (kompatibel OpenAI, ERP memanggil `/chat/completions`),
`AI_API_KEY`, `AI_MODEL`, lalu restart. Isi dulu **WhatsApp AI → FAQ
asisten**: asisten hanya menjawab dari FAQ aktif dan produk katalog yang
dipublikasikan. Pertanyaan diskon, harga khusus, pembayaran, pesanan, dan
refund selalu diserahkan ke admin, sebelum dan sesudah pemanggilan model.

## 7. Checklist go-live

- [ ] Nomor sandbox: chat masuk, balasan penahan, balasan admin, kembalikan ke asisten, tutup.
- [ ] HMAC key salah menghasilkan `401`; kiriman WAHA berulang tampil sebagai satu pesan.
- [ ] Setiap topik n8n diuji sekali dengan event nyata; tanda tangan salah ditolak.
- [ ] "Kirim ulang" manual atas event yang sudah terkirim tidak mengirim pesan kedua (dedupe).
- [ ] Permintaan diskon ditolak dan diserahkan ke admin.
- [ ] Owner menyetujui pesan live (ADR-0020), lalu pindah ke nomor live.
