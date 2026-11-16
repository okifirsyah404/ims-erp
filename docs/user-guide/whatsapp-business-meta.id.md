# WhatsApp Business resmi (Meta Cloud API) sebagai pengganti WAHA

Panduan memakai **WhatsApp Business Platform (Cloud API) dari Meta** untuk notifikasi ERP, plus
cara mendaftarnya.

- Versi Inggris: [whatsapp-business-meta.en.md](whatsapp-business-meta.en.md).
- Workflow n8n-nya: [n8n-workflows.id.md](n8n-workflows.id.md).
- Setup WAHA lama: [whatsapp-n8n-setup.id.md](whatsapp-n8n-setup.id.md).

> **Kenapa pindah?** WAHA memakai WhatsApp Web (tidak resmi). Nomor yang mengirim banyak pesan
> otomatis bisa **diblokir** WhatsApp kapan saja, tanpa banding. Cloud API adalah jalur resmi
> Meta: nomor tidak diblokir karena otomatisasi selama aturan template dan kualitas dipatuhi.
> Gantinya ada **biaya per pesan** dan **template wajib disetujui**.

> **Status (2026-11-16).**
> - **Sudah dibangun dan diuji:**
>   - Workflow n8n bisa mengirim lewat Meta (`WHATSAPP_PROVIDER=meta`), diuji di n8n 2.47.7
>     terhadap Graph API tiruan: 10 topik terkirim sebagai pesan template dengan format resmi.
>   - Katalog 20 template sudah dicek cocok dengan pesan yang disusun (`check-meta-templates.ts`).
>   - Skrip pengajuan template (`create-meta-templates.ts`) sudah diuji ke API tiruan.
> - **Belum:**
>   - Akun Meta sungguhan, nomor sungguhan, dan template yang benar-benar disetujui.
>   - **Asisten chat masuk** (WAHA → ERP) belum punya versi Meta (lihat bagian 9).

## 1. WAHA vs Meta Cloud API

| | WAHA (sekarang) | Meta Cloud API (resmi) |
| --- | --- | --- |
| Risiko blokir nomor | **Tinggi** untuk pesan otomatis/massal | Rendah, selama kualitas pesan baik |
| Biaya ke Meta | Gratis | Per pesan terkirim, tergantung kategori (bagian 6) |
| Pesan yang dimulai bisnis | Teks bebas | **Wajib template yang disetujui** |
| Membalas chat pelanggan | Teks bebas | Teks bebas **dalam 24 jam** sejak pesan terakhir pelanggan |
| Server sendiri | Perlu (Docker WAHA + sesi QR) | Tidak, Meta yang menyimpan |
| Nomor | Nomor WA biasa (di-scan QR) | Nomor khusus yang **tidak** aktif di aplikasi WhatsApp |
| Centang hijau / nama bisnis | Tidak | Nama tampilan disetujui Meta; verifikasi bisnis membuka batas lebih tinggi |
| Batas kirim | Tidak resmi (makin banyak, makin rawan blokir) | Resmi: mulai 250 penerima unik/24 jam, naik setelah verifikasi (bagian 5) |

Rekomendasi:
- **Produksi:** pakai Meta Cloud API.
- **WAHA** cukup untuk uji coba dan pengembangan.

## 2. Yang perlu disiapkan sebelum mendaftar

- **Akun Facebook pribadi** pemilik/admin, untuk masuk ke Meta Business dan Meta for Developers.
  Pakai akun yang aman (2FA aktif).
- **Data legal perusahaan** untuk verifikasi bisnis:
  - nama sesuai akta;
  - alamat dan nomor telepon kantor;
  - situs web dengan domain perusahaan;
  - email di domain itu.
- **Dokumen pendukung** yang umum diterima di Indonesia: NIB/akta pendirian, NPWP badan, atau
  tagihan (listrik/telepon) atas nama perusahaan.
- **Nomor telepon khusus** untuk WhatsApp Business:
  - bisa menerima **SMS atau telepon** untuk kode OTP;
  - **tidak terdaftar** di aplikasi WhatsApp/WhatsApp Business. Kalau sudah, hapus dulu akunnya
    dari aplikasi;
  - jangan pakai nomor pribadi; nomor kantor/fixed line juga bisa (verifikasi lewat telepon).
- **Metode pembayaran** (kartu kredit/debit) untuk Billing Hub Meta. Sejak 1 Oktober 2026 pesan
  layanan bisa dihentikan bila belum ada metode pembayaran.
- **Nama tampilan** (display name) yang sesuai merek, mis. "Entragate". Nama yang tidak cocok
  dengan bisnis/situs bisa ditolak.

## 3. Langkah pendaftaran (langsung ke Meta, tanpa BSP)

1. **Buat Business Portfolio** di [business.facebook.com](https://business.facebook.com).
   Pakai nama legal perusahaan.
2. **Buat aplikasi Meta** di [developers.facebook.com](https://developers.facebook.com) → *Create
   App* → pilih use case **"Connect with customers through WhatsApp"** → hubungkan ke portfolio
   tadi.
3. Di aplikasi, buka **WhatsApp → API Setup → Start using the API**. Meta membuat **WhatsApp
   Business Account (WABA)** dan **nomor uji** gratis.
   - Kirim pesan uji ke nomor HP Anda sendiri untuk memastikan semuanya jalan.
   - Catat **WABA ID** dan **Phone Number ID**.
4. **Tambahkan nomor asli:** *WhatsApp → API Setup → Add phone number*.
   - Isi nama tampilan, kategori bisnis, dan deskripsi.
   - Verifikasi nomor dengan kode OTP lewat SMS/telepon.
   - Catat **Phone Number ID** nomor asli; nilai ini yang dipakai di n8n.
5. **Verifikasi bisnis:** *Business Settings → Security Center → Start verification*.
   - Unggah dokumen dan konfirmasi lewat email/telepon/domain.
   - Lama proses beragam, dari beberapa hari kerja sampai sekitar 2 minggu.
   - Tanpa verifikasi Anda tetap bisa mulai, dengan batas 250 penerima per 24 jam.
6. **Metode pembayaran:** *Business Settings → Billing & payments (Billing Hub)* → tambahkan
   kartu untuk akun WhatsApp.
7. **Token permanen (System User):**
   - *Business Settings → Users → System users → Add* (peran Admin).
   - Assign aset: aplikasi (**Manage app**) dan akun WhatsApp (**Manage WhatsApp Business
     accounts**).
   - *Generate token* dengan izin `business_management`, `whatsapp_business_messaging` dan
     `whatsapp_business_management`.
   - Simpan token di password manager. Token sementara dari halaman API Setup kedaluwarsa dalam
     beberapa jam; jangan dipakai di produksi.
8. **Ajukan template** (bagian 4), lalu tunggu status **APPROVED**.
9. **Atur n8n** (bagian 7) dan uji dengan nomor tim sendiri.

> **Alternatif lewat BSP** (Business Solution Provider, mis. penyedia lokal seperti Qontak/Mekari,
> atau Twilio, 360dialog). BSP membantu verifikasi dan menyediakan dasbor, tetapi ada biaya
> langganan atau markup per pesan di atas tarif Meta. Workflow ini memakai Cloud API langsung,
> jadi tidak butuh BSP. Kalau suatu saat pakai BSP, yang berubah hanya URL dan token di node
> pengirim.

## 4. Template pesan

Aturan Meta untuk pesan yang **dimulai bisnis** (semua notifikasi ERP termasuk di sini):
- **Harus memakai template** yang sudah berstatus **APPROVED**.
- Teks bebas hanya boleh untuk **membalas** pelanggan **dalam 24 jam** sejak pesan terakhirnya.
- Kategori template menentukan harga:
  - **Utility:** terkait transaksi penerima (invoice, pembayaran, tiket, retur, lisensi);
  - **Marketing:** promosi;
  - **Authentication:** OTP.

  Semua template ERP adalah **Utility**. Kalau Meta menilai isinya promosi, template bisa
  dikategorikan ulang menjadi Marketing (lebih mahal), jadi jangan sisipkan promosi di template
  notifikasi.
- Variabel ditulis `{{1}}`, `{{2}}`, … Nilainya **tidak boleh berisi baris baru/tab**. Workflow
  sudah mengubah baris baru menjadi " / ".
- Review biasanya cepat, paling lama sekitar 24 jam. Template yang isinya hampir semua variabel
  cenderung ditolak.

Katalog siap ajukan: [`docs/integrations/n8n/meta-templates.json`](../integrations/n8n/meta-templates.json)
(20 template, bahasa `id`, Utility):

| Template | Untuk | Isi |
| --- | --- | --- |
| `erp_lead_baru` | sales manager | Lead baru {{1}} dari {{2}}. Kontak: {{3}}. Kebutuhan: {{4}}. |
| `erp_invoice_terbit` | pelanggan | Yth. {{1}}, invoice {{2}} sebesar {{3}} telah terbit dengan jatuh tempo {{4}}. Terima kasih. |
| `erp_invoice_terbit_internal` | finance | Invoice {{1}} terbit untuk {{2}} sebesar {{3}}, jatuh tempo {{4}}. |
| `erp_pembayaran_diterima` | pelanggan | Terima kasih, pembayaran {{1}} untuk invoice {{2}} sudah kami terima. Sisa tagihan: {{3}}. |
| `erp_tiket_servis_update` | pelanggan | Update tiket servis {{1}}: {{2}}. |
| `erp_tiket_servis_baru_internal` | support | Tiket servis baru {{1}} dari {{2}}: {{3}}. |
| `erp_chat_perlu_admin` | admin jaga | Chat WhatsApp dari {{1}} perlu ditangani admin (alasan: {{2}}). Pertanyaan: {{3}}. |
| `erp_lisensi_berakhir` | pelanggan | Yth. {{1}}, lisensi {{2}} ({{3}}) berakhir pada {{4}}. Hubungi kami untuk perpanjangan. |
| `erp_lisensi_berakhir_internal` | sales manager | Lisensi {{1}} ({{2}}) milik {{3}} berakhir pada {{4}}. |
| `erp_retur_pembelian_internal` | ops manager, purchasing, gudang | Retur pembelian {{1}} ke {{2}}: {{3}}. Barang: {{4}}. |
| `erp_retur_pembelian_pemasok` | PIC pemasok | Yth. {{1}}, {{2}} mengirim kembali barang untuk diganti (retur {{3}}, PO {{4}}): {{5}}. Alasan: {{6}}. |
| `erp_retur_penjualan_internal` | sales manager, sales, gudang | Retur penjualan {{1}} dari {{2}}: {{3}}. Barang: {{4}}. |
| `erp_retur_disetujui` | pelanggan | Yth. {{1}}, pengajuan retur {{2}} disetujui. Tim kami akan mengatur pengambilan atau pengiriman barang. |
| `erp_retur_diterima` | pelanggan | Yth. {{1}}, barang retur {{2}} sudah kami terima. Barang pengganti akan segera kami kirim. |
| `erp_tagihan_pemasok_internal` | finance, owner | Tagihan pemasok {{1}} (faktur {{2}}) dari {{3}} sebesar {{4}}: {{5}}. |
| `erp_followup_lead` | sales pemilik lead | Pengingat follow-up lead {{1}}: {{2}}. Kontak: {{3}}. Kebutuhan: {{4}}. |
| `erp_followup_lead_terlambat` | sales manager | Lead {{1}} milik {{2}} belum di-follow-up, {{3}}. |
| `erp_followup_penawaran` | sales pembuat penawaran | Pengingat follow-up penawaran {{1}} untuk {{2}} sebesar {{3}}: {{4}}. |
| `erp_penawaran_terkirim` | pelanggan | [PDF] Yth. {{1}}, berikut penawaran {{2}} ({{3}}) sebesar {{4}}, berlaku sampai {{5}}. Terima kasih. |
| `erp_penawaran_tanpa_pdf` | sales pembuat penawaran | Penawaran {{1}} untuk {{2}} sudah terkirim, tetapi PDF-nya tidak dibuat otomatis. Kirim PDF dari halaman cetak. |

Ada dua cara mengajukan:
- **Otomatis:**
  ```bash
  META_WABA_ID=<WABA ID> META_ACCESS_TOKEN=<token system user> \
  bun docs/integrations/n8n/create-meta-templates.ts       # --dry-run untuk melihat payload saja
  ```
- **Manual:** WhatsApp Manager → *Message templates → Create template* → kategori Utility,
  bahasa Indonesian, salin isi dan contoh dari tabel/JSON.

**Template dengan PDF.** `erp_penawaran_terkirim` (ditandai [PDF]) punya *header* **Document**:
WhatsApp mengirim PDF penawaran sebagai lampiran, dan isi pesan menjadi keterangannya. Template ini
**tidak bisa** diajukan lewat skrip (API Meta minta contoh PDF diunggah dulu), jadi skrip
melewatinya. Buat manual di WhatsApp Manager:
1. *Create template* → kategori **Utility**, bahasa **Indonesian**, nama `erp_penawaran_terkirim`.
2. *Header* → **Document**, lalu unggah PDF contoh apa saja (misalnya hasil cetak satu penawaran).
3. *Body* → salin isi dan contoh dari `meta-templates.json`.

Saat dikirim, n8n mengisi header dengan link PDF dari ERP. Link berlaku 30 hari dan bisa dicabut
dari halaman dokumen ERP.

Kalau teks template diubah: ubah `meta-templates.json` **dan** parameter di node "3. Compose
messages", lalu jalankan `bun docs/integrations/n8n/check-meta-templates.ts`. Hasilnya harus
`OK` (jumlah variabel cocok).

## 5. Batas kirim dan kualitas

Menurut dokumentasi resmi Meta:
- **Batas awal portfolio baru: 250** penerima unik per 24 jam (di luar jendela 24 jam layanan).
  Tingkatnya 250 → 2.000 → 10.000 → 100.000 → tanpa batas.
- Batas berlaku **per business portfolio**, dipakai bersama semua nomor di dalamnya.
- **Naik ke 2.000** lewat salah satu jalan:
  - verifikasi bisnis;
  - 2.000 pesan terkirim ke nomor unik dalam 30 hari dengan template berkualitas tinggi.

  Meta tetap meninjau kualitas pesan sebelum menaikkan batas.
- **Di atas 2.000** batas naik otomatis bila kualitas tinggi dan sedikitnya separuh batas
  terpakai dalam 7 hari.
- Jaga kualitas: kirim hanya ke orang yang memang berkaitan dengan transaksinya (pelanggan,
  pemasok, tim), dan jangan kirim promosi lewat template utility. Penerima yang sering
  memblokir/melaporkan menurunkan rating kualitas.

Kebutuhan ERP saat ini (notifikasi tim + pelanggan aktif) biasanya jauh di bawah 250/hari.

## 6. Biaya (perkiraan, cek tarif resmi sebelum memutuskan)

- **Model:** sejak 1 Juli 2025 Meta menagih **per pesan terkirim**, menurut kategori dan negara
  penerima.
- **Pesan masuk** dari pelanggan gratis.
- **Pesan layanan** (balasan bebas dalam 24 jam): gratis 1.000 per nomor per bulan, lalu ditagih
  sejak 1 Oktober 2026.
- **Tarif Indonesia:** cek kalkulator resmi di
  [whatsappbusiness.com → Platform pricing](https://whatsappbusiness.com/id/products/platform-pricing/)
  (pilih Indonesia, IDR).
  - Sumber pihak ketiga untuk tarif Oktober 2026 menyebut sekitar **US$0,025/pesan utility** dan
    **US$0,041/pesan marketing**, ditambah **PPN 11%**.
  - Angka antar sumber berbeda, jadi **jangan pakai tanpa cek ulang**.
  - Tarif utility bisa turun dengan volume (volume tier).
- **Contoh kasar:** 100 notifikasi utility per hari ≈ 3.000/bulan × ~US$0,025 ≈ **US$75/bulan**
  sebelum PPN.

## 7. Mengaktifkan Meta di workflow n8n

Workflow yang sama mendukung keduanya. Environment di server n8n:

| Variabel | Nilai |
| --- | --- |
| `WHATSAPP_PROVIDER` | `meta` (default `waha`) |
| `META_PHONE_NUMBER_ID` | Phone Number ID nomor asli (langkah 3.4) |
| `META_ACCESS_TOKEN` | Token permanen System User (langkah 3.7) |
| `META_GRAPH_VERSION` | Opsional, default `v23.0` |
| `META_TEMPLATE_LANGUAGE` | Opsional, default `id` |

Restart n8n. Node "4. Send WhatsApp (WAHA / Meta)" lalu mengirim
`POST https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages` berbentuk pesan template:

```json
{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "6281234567890",
  "type": "template",
  "template": { "name": "erp_retur_diterima", "language": { "code": "id" },
    "components": [ { "type": "body", "parameters": [
      { "type": "text", "text": "PT Contoh Pelanggan" }, { "type": "text", "text": "0001/RTJ/IMS/XI/26" } ] } ] } }
```

Perilakunya:
- Pesan tanpa template dilewati dan dicatat (`skippedWithoutTemplate`), tidak dikirim sebagai
  teks bebas.
- Error dari Meta membuat workflow menjawab **500**, sehingga ERP mencoba ulang. Ini sama seperti
  WAHA.

## 8. Opt-in penerima

Meta mensyaratkan penerima pesan template sudah **setuju (opt-in)** menerima pesan WhatsApp dari
bisnis.
- **Pelanggan:** tambahkan kalimat persetujuan di formulir/penawaran/kontrak, mis. "Bersedia
  menerima notifikasi invoice, tiket servis dan pengiriman melalui WhatsApp". Catat persetujuan
  itu.
- **Pemasok:** persetujuan PIC saat onboarding pemasok.
- **Tim internal:** cukup persetujuan saat nomor didaftarkan di `CONFIG.team`.

Karena itu `notifyCustomers` / `notifySuppliers` di workflow tetap `false` sampai opt-in dan teks
disetujui owner.

## 9. Asisten chat masuk (ERP) dengan Meta: belum dibangun

Saat ini chat pelanggan masuk dari **WAHA langsung ke ERP** (`POST
/integrations/whatsapp/webhook`), dan ERP membalas lewat WAHA. Untuk nomor Meta, yang perlu
ditambahkan di ERP (modul `automation`, M04):
1. **Webhook Meta di ERP:**
   - `GET` untuk verifikasi (`hub.mode=subscribe`, `hub.verify_token`, membalas `hub.challenge`);
   - `POST` dengan tanda tangan `X-Hub-Signature-256: sha256=<HMAC-SHA256 body dengan App
     Secret>`;
   - payload Meta (`entry[].changes[].value.messages[]`) diubah ke pipeline chat yang sama.
2. **Adapter pengirim Meta** untuk port `IWhatsappGateway` (sudah ada, saat ini diisi
   `WahaClient`).
   - Balasan asisten dalam 24 jam boleh teks bebas.
   - Di luar 24 jam harus template.
3. Konfigurasi baru: `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_APP_SECRET`,
   `META_WEBHOOK_VERIFY_TOKEN`, plus pilihan provider.

Satu nomor hanya bisa dipakai di satu tempat: nomor yang didaftarkan ke Cloud API tidak bisa
dipakai di WAHA/aplikasi WhatsApp. Kalau pindah ke Meta, **notifikasi (n8n) dan asisten (ERP)
harus pindah bersama**, atau pakai dua nomor berbeda selama transisi.

## 10. Rencana pindah yang disarankan

1. Daftar dan verifikasi bisnis (bagian 2–3) sambil tetap memakai WAHA untuk uji.
2. Ajukan 20 template, lalu tunggu APPROVED.
3. Bangun bagian 9 (adapter Meta di ERP) supaya asisten chat ikut pindah.
4. Uji dengan **nomor uji Meta** dan nomor tim:
   - `send-test-event.ts all` dengan `WHATSAPP_PROVIDER=meta`;
   - satu event nyata dari ERP.
5. Ganti ke nomor asli, isi opt-in pelanggan, lalu aktifkan `notifyCustomers` / `notifySuppliers`.
6. Matikan WAHA.

Sumber resmi:
[Pricing](https://developers.facebook.com/docs/whatsapp/pricing),
[Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits),
[Cloud API get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started),
[Message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates),
[Webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
Aturan dan tarif Meta bisa berubah tiap kuartal; cek ulang sebelum go-live.
