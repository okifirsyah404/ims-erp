# Workflow n8n untuk event ERP (M04)

Panduan memakai workflow siap import
[`docs/integrations/n8n/erp-event-router.workflow.json`](erp-event-router.workflow.json).
Workflow ini menerima event bisnis dari ERP lalu mengirim pesan WhatsApp lewat WAHA, dan
email bila diaktifkan.

- Versi Inggris: [n8n-workflows.en.md](guide-workflows.en.md).
- Kedua versi diubah bersamaan.
- Setup WAHA dan `.env` ERP: [whatsapp-n8n-setup.id.md](../whatsapp/waha-n8n-setup.id.md).

> **Status (2026-11-16).** Workflow sudah diuji dengan **n8n 2.47.7** sungguhan di Docker,
> memakai WAHA palsu yang mencatat setiap pesan:
> - Import lewat CLI berhasil.
> - Ke-10 topik (dengan semua variasi `change`) terkirim, dan teksnya sudah diperiksa.
> - Tanda tangan salah dijawab 401; event ganda dilewati.
> - WAHA mati menghasilkan 500, lalu sukses saat ERP mencoba ulang.
> - **ERP sungguhan → n8n:** mencatat tagihan pemasok mengirim `supplier_bill.recorded`, dan
>   outbox ERP berstatus `published` dalam 1 percobaan.
>
> Yang **belum** diuji: WAHA asli dan nomor WhatsApp asli. Uji itu bagian UAT; pakai nomor
> sandbox dulu.

## 1. Gambaran

```text
ERP (outbox) ──POST /webhook/erp-events (HMAC)──► n8n ──► WAHA ──► WhatsApp tim / pelanggan / pemasok
                                                     └──► (opsional) SMTP ──► email tim
```

- **ERP yang memutuskan kapan** sesuatu terjadi (event).
- **n8n yang memutuskan siapa diberi tahu dan apa isi pesannya.** ERP tidak menyimpan template
  pesan (ADR-0020).
- Satu workflow menangani semua topik. Penerima dan teks diatur di **satu node** ("3. Compose
  messages").
- Nominal di event berupa bilangan bulat dalam sen, dan workflow sudah mengubahnya ke format
  `Rp 1.443.000`.

## 2. Kebutuhan

| Kebutuhan | Keterangan |
| --- | --- |
| Server n8n ≥ 2.x | Self-host (Docker) disarankan. Butuh URL **HTTPS publik** yang bisa dijangkau server ERP. |
| WhatsApp | **WAHA** (URL, API key, sesi; tidak resmi, nomor rawan diblokir) **atau Meta Cloud API** (resmi, template wajib; pendaftaran di [whatsapp-business-meta.id.md](../whatsapp/meta-cloud-api.id.md)). Nomor khusus, jangan nomor pribadi. |
| Nomor WhatsApp tim per peran | owner, sales manager, sales, operations manager, purchasing, gudang, finance, support/teknisi, admin jaga. |
| SMTP (opsional) | Hanya bila ingin email. Saat ini email dipakai untuk notifikasi tagihan pemasok ke finance. |
| Persetujuan owner | Atas teks pesan ke **pelanggan dan pemasok** sebelum diaktifkan. |

### Environment variable di server n8n

| Variabel | Nilai |
| --- | --- |
| `ERP_WEBHOOK_SECRET` | **Sama persis** dengan `N8N_WEBHOOK_SECRET` di `.env` ERP (≥ 16 karakter). |
| `WAHA_URL` | Base URL WAHA, mis. `http://waha:3000` (tanpa `/api`). |
| `WAHA_API_KEY` | API key WAHA. |
| `WAHA_SESSION` | Nama sesi WAHA (default `default`). |
| `WHATSAPP_PROVIDER` | `waha` (default) atau `meta`. Untuk Meta isi juga `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN` (lihat [whatsapp-business-meta.id.md](../whatsapp/meta-cloud-api.id.md)). |
| `NODE_FUNCTION_ALLOW_BUILTIN` | `crypto` (dipakai node verifikasi tanda tangan). |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` (node Code membaca variabel di atas). |
| `GENERIC_TIMEZONE` | `Asia/Jakarta`. |
| `ERP_NOTIFY_FROM_EMAIL` | Opsional: alamat pengirim email. |

Contoh Docker Compose untuk n8n:

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - GENERIC_TIMEZONE=Asia/Jakarta
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      - NODE_FUNCTION_ALLOW_BUILTIN=crypto
      - ERP_WEBHOOK_SECRET=${ERP_WEBHOOK_SECRET}
      - WAHA_URL=http://waha:3000
      - WAHA_API_KEY=${WAHA_API_KEY}
      - WAHA_SESSION=default
      - WEBHOOK_URL=https://n8n.contoh-perusahaan.com/
    volumes: ["n8n_data:/home/node/.n8n"]
volumes:
  n8n_data:
```

### Di sisi ERP (`.env` backend)

| Variabel | Nilai |
| --- | --- |
| `N8N_WEBHOOK_URL` | `https://<host-n8n>/webhook/erp-events` (URL **production**, bukan `webhook-test`). |
| `N8N_WEBHOOK_SECRET` | Rahasia yang sama dengan `ERP_WEBHOOK_SECRET` di n8n. |
| `SCHEDULER_ENABLED` | `true`, wajib untuk event harian `license.due` dan `supplier_bill.due`. |
| `SCHEDULER_LICENSE_DUE_CRON`, `SCHEDULER_BILL_DUE_CRON` | Opsional, default `0 8 * * *` (08.00 WIB). |

Restart backend setelah mengubah `.env`.

## 3. Import dan aktifkan

1. Di n8n: **Workflows → Import from File**, lalu pilih `erp-event-router.workflow.json`. Lewat
   CLI juga bisa: `n8n import:workflow --input=erp-event-router.workflow.json`.
2. Buka node **"3. Compose messages"** dan isi blok `CONFIG` (bagian 5).
3. **Aktifkan / Publish** workflow. Lewat CLI: `n8n publish:workflow --id=<id>`, lalu restart n8n.
4. Salin **Production URL** dari node "ERP webhook" (`…/webhook/erp-events`) ke
   `N8N_WEBHOOK_URL` di ERP.
5. Uji tanpa ERP memakai skrip uji (bagian 7), lalu uji dengan event nyata dari ERP.

> Id event yang sudah diproses disimpan di **data table** n8n `erp_processed_events` (menu
> *Overview → Data tables*), yang dibuat otomatis oleh node "2a. Ensure table". Tabel ini bertambah
> satu baris per event; kosongkan sesekali (mis. tiap beberapa bulan) lewat menu Data tables.
>
> Static data workflow sengaja **tidak** dipakai. Dalam uji, event yang dikirim ulang langsung
> lolos, karena static data baru disimpan setelah ERP menerima jawaban.

## 4. Alur node satu per satu

| # | Node | Tugas | Kalau gagal |
| --- | --- | --- | --- |
| – | **ERP webhook** | Menerima `POST` dari ERP (path `erp-events`). Jawaban dikirim oleh node terakhir. | – |
| 1 | **Verify ERP signature** | Menghitung ulang `sha256=HMAC(ERP_WEBHOOK_SECRET, "<X-Erp-Timestamp>.<body>")` dan membandingkannya secara aman dengan `X-Erp-Signature`. Menolak timestamp lebih lama dari ±10 menit (anti replay). | Tanda tangan salah / kedaluwarsa → **401**: ERP berhenti mencoba. Body bukan event → **400**. Secret belum diisi → **500**: ERP mencoba ulang. |
| 2a–2c | **Ensure table → Look up event → Skip duplicates** | ERP mengirim ulang event yang sama (id sama) saat retry atau "Kirim ulang". Id yang sudah ditangani disimpan di **data table n8n `erp_processed_events`** (dibuat otomatis saat event pertama). | Duplikat → **200** tanpa mengirim pesan. |
| 3 | **Compose messages** | Menyusun pesan dari `topic` dan `data`, lalu menentukan penerima dari `CONFIG`. Satu event bisa menghasilkan 0 sampai beberapa pesan. | – |
| 4 | **Send WhatsApp (WAHA / Meta)** | `WHATSAPP_PROVIDER=waha`: `POST <WAHA_URL>/api/sendText` per pesan (teks bebas). `WHATSAPP_PROVIDER=meta`: Cloud API dengan **template yang disetujui** (lihat [whatsapp-business-meta.id.md](../whatsapp/meta-cloud-api.id.md)). | Error → eksekusi gagal → **500** → ERP mencoba ulang (5 kali, jeda mulai 30 detik). Event belum dicatat, jadi percobaan ulang benar-benar mengirim. |
| 5a–5b | **Record event → Finish** | Mencatat id event ke `erp_processed_events`, **hanya setelah** WhatsApp sukses, lalu menyiapkan kode jawaban. | – |
| – | **Answer the ERP** | Menjawab `{ result, messages }` dengan kode HTTP dari langkah sebelumnya. | – |
| 6 | **Email messages** → **Send email** | Cabang opsional: email untuk peran di `CONFIG.teamEmail`. Node **Send email nonaktif** setelah import. | Berjalan setelah ERP dijawab: email yang gagal **tidak** dicoba ulang oleh ERP (WhatsApp adalah kanal utama). |

Ringkasan kode jawaban ke ERP:

| Kode | Arti | Sikap ERP |
| --- | --- | --- |
| 200 | Event ditangani, duplikat, atau topik tanpa penerima | Selesai (`published`) |
| 400 / 401 | Bukan event / tanda tangan salah | Berhenti mencoba (`failed`) |
| 500 | WAHA atau server n8n bermasalah | Coba ulang otomatis; terlihat di **Integrasi → Webhook (n8n)** |

## 5. Mengatur penerima (`CONFIG`)

Di node "3. Compose messages":

```js
const CONFIG = {
	companyName: 'Entragate',
	team: {
		owner: ['0812…'],
		salesManager: ['0813…'],
		sales: [],
		operationsManager: [],
		purchasing: [],
		warehouse: [],
		finance: [],
		support: [],      // teknisi / CS untuk tiket servis
		adminOnDuty: [],  // admin jaga chat WhatsApp
	},
	teamEmail: { finance: [], purchasing: [] },
	notifyCustomers: false, // true setelah owner menyetujui teks ke pelanggan
	notifySuppliers: false, // true setelah owner menyetujui teks ke pemasok
	erpUrl: 'https://erp.contoh-perusahaan.com', // untuk link di pesan; '' = tanpa link
};
```

- **Format nomor:** `0812…`, `62812…`, dan `+62 812…` semuanya diterima, lalu diubah ke `62812…@c.us`.
- **Peran yang kosong** berarti tidak ada yang diberi tahu.
- **Mulai aman:** biarkan `notifyCustomers` dan `notifySuppliers` tetap `false`. Pesan internal
  tetap jalan, dan pelanggan/pemasok belum menerima apa pun.
- **Mengubah teks pesan:** edit fungsi per topik di objek `handlers` pada node yang sama. Setiap
  topik punya satu fungsi.

## 6. Topik dan pesan yang dikirim

| Topik (event ERP) | Kapan | Penerima default |
| --- | --- | --- |
| `lead.created` | Lead baru (manual / website) | sales manager |
| `invoice.issued` | Invoice terbit | pelanggan*, finance |
| `receipt.recorded` | Pembayaran pelanggan dicatat | pelanggan* |
| `service_ticket.updated` | Tiket dibuat / ditugaskan / dikerjakan / selesai / dibuka lagi / ditutup | pelanggan*; tiket baru → support |
| `whatsapp.handoff` | Chat asisten WA perlu orang | admin jaga |
| `license.due` | Harian: lisensi H-30 / H-7 / berakhir | pelanggan*, sales manager |
| `purchase_return.updated` | Retur pembelian diajukan → operations manager; disetujui → gudang + purchasing; ditolak → purchasing; dikirim → purchasing + PIC pemasok**; dibatalkan → purchasing + gudang | lihat kolom kiri |
| `sales_return.updated` | Retur penjualan diajukan → sales manager; disetujui → gudang + pelanggan*; ditolak → sales; diterima → sales + pelanggan*; dibatalkan → sales | lihat kolom kiri |
| `supplier_bill.recorded` | Tagihan pemasok dicatat | finance (WA, dan email bila aktif) |
| `supplier_bill.due` | Harian: tagihan H-7, jatuh tempo hari ini, atau lewat jatuh tempo | finance; lewat jatuh tempo → juga owner |
| `lead.follow_up_due` | Hari kerja 08.00: jadwal follow-up lead tiba/lewat | **sales pemilik lead** (nomor HP dari profil user ERP; tanpa pemilik → sales manager); terlambat > 3 hari → juga sales manager |
| `quotation.follow_up_due` | Hari kerja 08.00: penawaran terkirim belum dijawab H+3 / H+7, dan H-2 sebelum masa berlaku habis | **sales pembuat penawaran** (cadangan: sales manager). Tidak ke pelanggan |
| `quotation.sent` | Penawaran ditandai terkirim; ERP sudah membuat PDF-nya (sama persis dengan halaman cetak) | pelanggan*: pesan **dengan lampiran PDF** (WAHA `sendFile` / template Meta dengan header Document; link PDF berlaku 30 hari). Kalau PDF gagal dibuat → **sales pembuat penawaran** diminta kirim manual |

\* hanya bila `notifyCustomers: true`; \*\* hanya bila `notifySuppliers: true`.

Contoh pesan (dari uji nyata):

```text
Retur pembelian (belum bernomor) ke PT Contoh Pemasok menunggu persetujuan Anda.
BPB 0001/BPB/IMS/XI/26 / PO PO/IMS-HIT/HW/1126/001
Alasan: Reader mati saat dites
- Card reader 1 pcs (SN SN-0001)
https://erp.contoh-perusahaan.com/procurement/purchase-returns/…
```

```text
Tagihan pemasok SB-0001 (INV/HIT/0099) ke PT Contoh Pemasok LEWAT jatuh tempo sejak 23 November 2026. Sisa: Rp 1.443.000.
```

Daftar lengkap field per topik ada di `apps/backend/src/app/automation/contracts/outbox.contract.ts` dan pembuat event di setiap service.

## 7. Menguji tanpa ERP

Skrip [`send-test-event.ts`](send-test-event.ts) mengirim event contoh yang
ditandatangani persis seperti ERP:

```bash
N8N_WEBHOOK_URL=https://<host-n8n>/webhook/erp-events \
N8N_WEBHOOK_SECRET=<rahasia yang sama> \
bun docs/integrations/n8n/send-test-event.ts all                          # semua topik
bun docs/integrations/n8n/send-test-event.ts sales_return.updated --change=received
bun docs/integrations/n8n/send-test-event.ts lead.created --bad-signature   # harus 401
bun docs/integrations/n8n/send-test-event.ts whatsapp.handoff --repeat      # kedua harus "duplicate"
```

Kontak di event contoh **palsu**. Selama uji, isi `CONFIG.team` dengan nomor tim sendiri dan
biarkan `notifyCustomers` tetap `false`.

## 8. Checklist go-live

- [ ] Secret di ERP dan n8n sama; `--bad-signature` dijawab 401.
- [ ] `send-test-event.ts all` → semua 200, pesan sampai ke nomor tim.
- [ ] `--repeat` → event kedua "duplicate", WhatsApp hanya terkirim sekali.
- [ ] Event nyata dari ERP (mis. catat tagihan pemasok) muncul di WA finance, dan statusnya
      `published` di **Integrasi → Webhook (n8n)**.
- [ ] WAHA dimatikan sebentar → event `failed` lalu terkirim saat dicoba ulang.
- [ ] `SCHEDULER_ENABLED=true`, lalu esok paginya `license.due` / `supplier_bill.due` muncul bila
      ada yang jatuh tempo.
- [ ] Owner menyetujui teks pelanggan/pemasok, lalu `notifyCustomers` / `notifySuppliers` diubah
      ke `true`.
- [ ] Pindah dari nomor sandbox ke nomor live.

## 9. Mengubah workflow

- Kode tiap node disimpan sebagai file di `docs/integrations/n8n/src/`.
- Setelah mengubahnya, jalankan `bun docs/integrations/n8n/build-workflow.ts` untuk membuat ulang
  JSON, lalu commit keduanya.
- Perubahan yang dibuat langsung di editor n8n (mis. `CONFIG`) tidak masuk repo. Itu wajar,
  karena nomor tim adalah data operasional, bukan kode.
- Jangan meng-commit nomor pribadi atau rahasia.
