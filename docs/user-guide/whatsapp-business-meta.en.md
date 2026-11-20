# Official WhatsApp Business (Meta Cloud API) instead of WAHA

How to use Meta's **WhatsApp Business Platform (Cloud API)** for ERP notifications, and how to
register.

- Indonesian version (the fuller one): [whatsapp-business-meta.id.md](whatsapp-business-meta.id.md).
- The n8n workflow: [n8n-workflows.en.md](n8n-workflows.en.md).

> **Why switch?** WAHA drives WhatsApp Web (unofficial). A number sending many automated messages
> can be **banned** at any time, with no appeal. The Cloud API is Meta's official route: numbers
> are not banned for automation as long as template and quality rules are followed. In exchange
> there is a **per-message fee** and **templates need approval**.

> **Status (2026-11-16).**
> - **Built and tested:**
>   - The n8n workflow sends through Meta (`WHATSAPP_PROVIDER=meta`), tested on n8n 2.47.7
>     against a mock Graph API: 10 topics sent as template messages in the official format.
>   - The 20-template catalog is checked against the composed messages
>     (`check-meta-templates.ts`).
>   - The template submission script (`create-meta-templates.ts`) is tested against the mock.
> - **Not yet:**
>   - A real Meta account, a real number, and really approved templates.
>   - The **inbound chat assistant** (WAHA → ERP) has no Meta version yet (section 9).

## 1. WAHA vs Meta Cloud API

| | WAHA (today) | Meta Cloud API |
| --- | --- | --- |
| Number ban risk | **High** for automated/bulk messages | Low while message quality is good |
| Fee to Meta | Free | Per delivered message, by category |
| Business-initiated messages | Free text | **Approved template required** |
| Replying to a customer | Free text | Free text **within 24 h** of the customer's last message |
| Own server | Yes (WAHA Docker + QR session) | No, Meta hosts it |
| Number | Regular WhatsApp number | Dedicated number **not** active in the WhatsApp app |
| Sending limits | Unofficial | Official: 250 unique recipients / 24 h to start, more after verification |

Recommendation: Meta Cloud API for production; WAHA only for testing.

## 2. Before registering

- A personal Facebook account for the owner/admin, with 2FA on.
- **Company legal data** for business verification:
  - the legal name;
  - address and phone;
  - a website on the company domain, and an email on that domain.
- **Supporting documents** commonly accepted in Indonesia: NIB/deed, company NPWP, or a utility
  bill in the company name.
- **A dedicated phone number:**
  - it must receive an SMS or voice OTP;
  - it must **not** be registered in the WhatsApp/WhatsApp Business app (delete that account
    first if it is).
- **A payment method** in Meta's Billing Hub. Since 1 October 2026, service messages can be
  stopped without one.
- **A display name** matching the brand (e.g. "Entragate").

## 3. Registration steps (directly with Meta, no BSP)

1. **Create a Business Portfolio** at business.facebook.com, under the legal company name.
2. **Create a Meta app** at developers.facebook.com: *Create App* → use case **"Connect with
   customers through WhatsApp"** → link it to the portfolio.
3. Open **WhatsApp → API Setup → Start using the API**. Meta creates a **WhatsApp Business Account
   (WABA)** and a free **test number**. Send a test message to your own phone, then note the
   **WABA ID** and **Phone Number ID**.
4. **Add the real number:** *API Setup → Add phone number*.
   - Fill in the display name, category and description.
   - Verify the number with the SMS/voice OTP.
   - Note its **Phone Number ID**; n8n uses this value.
5. **Business verification:** *Business Settings → Security Center*.
   - Upload the documents.
   - It takes a few working days up to about 2 weeks.
   - You can start before it is done, with the 250 limit.
6. **Payment method:** *Billing & payments (Billing Hub)*.
7. **Permanent token (System User):**
   - *Business Settings → System users → Add* (Admin).
   - Assign the app (**Manage app**) and the WhatsApp account (**Manage WhatsApp Business
     accounts**).
   - Generate a token with `business_management`, `whatsapp_business_messaging` and
     `whatsapp_business_management`.
   - Keep it in a password manager. The temporary token on the API Setup page expires within
     hours; never use it in production.
8. **Submit the templates** (section 4) and wait for **APPROVED**.
9. **Configure n8n** (section 7) and test with team numbers.

A **BSP** (local providers, Twilio, 360dialog…) can help with verification and gives a dashboard,
for a subscription or a markup on Meta's rates. This workflow uses the Cloud API directly; with a
BSP only the URL and token of the sender node change.

## 4. Message templates

- Every business-initiated message (all ERP notifications) must use an **APPROVED** template.
- Free text is only allowed to **reply** within 24 hours of the customer's last message.
- **Categories:**
  - Utility: tied to the recipient's transaction;
  - Marketing: promotion;
  - Authentication: OTP.

  All ERP templates are **Utility**. Promotional content can get a template re-categorised as
  Marketing, which costs more.
- Variables are `{{1}}`, `{{2}}`… and may not contain new lines or tabs; the workflow flattens new
  lines to " / ".
- Review usually takes minutes and at most about 24 hours.

Catalog: [`docs/integrations/n8n/meta-templates.json`](../integrations/n8n/meta-templates.json)
(20 Indonesian Utility templates; the table is in the Indonesian guide). There are two ways to
submit them:
- **With the script:**
  ```bash
  META_WABA_ID=<WABA ID> META_ACCESS_TOKEN=<system user token> \
  bun docs/integrations/n8n/create-meta-templates.ts       # --dry-run prints the payloads
  ```
- **By hand:** WhatsApp Manager → Message templates.

**Template with a PDF.** `erp_penawaran_terkirim` has a **Document** header: WhatsApp sends the
quotation PDF as an attachment and the body becomes its caption. The script **skips** it, because
Meta's API needs a sample PDF uploaded first. Create it by hand in WhatsApp Manager:
1. Category **Utility**, language **Indonesian**.
2. Header → **Document**, with any sample PDF.
3. Body and example from `meta-templates.json`.

n8n fills the header with the ERP's PDF link when it sends. The link is valid for 30 days and can
be revoked from the ERP's document screen.

After editing a template, update the matching parameters in "3. Compose messages" and run
`bun docs/integrations/n8n/check-meta-templates.ts`, which must print `OK`.

## 5. Limits and quality (Meta documentation)

- New portfolios start at **250** unique recipients per 24 hours, outside service windows. The
  tiers are 250 → 2,000 → 10,000 → 100,000 → unlimited.
- The limit is **per business portfolio**, shared by all its numbers.
- **To reach 2,000:** business verification, or 2,000 delivered messages to unique numbers in 30
  days with high-quality templates. Meta still reviews quality before raising the limit.
- **Above 2,000** the limit rises automatically with high quality and at least half the limit
  used in 7 days.

## 6. Cost (estimate; check the official rate card)

- **Model:** per **delivered message** since 1 July 2025, by category and recipient country.
- **Inbound** messages are free.
- **Service** (in-window free-text) messages: 1,000 free per number per month, then charged from
  1 October 2026.
- **Indonesian rates:** use the official calculator on whatsappbusiness.com (Platform pricing,
  Indonesia, IDR).
  - Third-party sources for the October 2026 card cite about **US$0.025 per utility** and
    **US$0.041 per marketing** message, plus **11% VAT**.
  - The sources disagree, so verify before deciding.

## 7. Turning Meta on in the n8n workflow

| Variable | Value |
| --- | --- |
| `WHATSAPP_PROVIDER` | `meta` (default `waha`) |
| `META_PHONE_NUMBER_ID` | The real number's Phone Number ID |
| `META_ACCESS_TOKEN` | The System User token |
| `META_GRAPH_VERSION` | Optional, default `v23.0` |
| `META_TEMPLATE_LANGUAGE` | Optional, default `id` |

- The sender posts template messages to
  `https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages`.
- A message with no template is skipped and reported (`skippedWithoutTemplate`), never sent as
  free text.
- A Meta error makes the webhook answer **500**, so the ERP retries.

## 8. Recipient opt-in

Meta requires recipients of template messages to have **opted in**:
- **Customers:** a consent line on quotes, contracts or forms.
- **Suppliers:** at onboarding.
- **Team:** when their number is added to `CONFIG.team`.

Keep `notifyCustomers` / `notifySuppliers` false until consent is collected and the texts are
approved.

## 9. Inbound chat assistant on Meta: not built yet

Today WAHA posts inbound chats directly to the ERP (`POST /webhooks/whatsapp`), and
the ERP replies through WAHA. For a Meta number, the ERP (module `automation`, M04) needs:
1. **A Meta webhook:**
   - `GET` verification (`hub.mode=subscribe`, `hub.verify_token`, echo `hub.challenge`);
   - `POST` signed with `X-Hub-Signature-256: sha256=<HMAC-SHA256 of the body with the App
     Secret>`;
   - the Meta payload (`entry[].changes[].value.messages[]`) mapped into the existing chat
     pipeline.
2. **A Meta sender** for the existing `IWhatsappGateway` port (today `WahaClient`). Free text is
   allowed inside 24 hours; templates outside it.
3. New config: `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_APP_SECRET`,
   `META_WEBHOOK_VERIFY_TOKEN`, and a provider switch.

A number registered on the Cloud API can no longer be used in WAHA or the app. Notifications (n8n)
and the assistant (ERP) must move together, or use two numbers during the switch.

## 10. Suggested migration

1. Register and verify the business while WAHA stays for testing.
2. Submit the 20 templates and wait for APPROVED.
3. Build section 9 so the assistant moves too.
4. Test with Meta's **test number** and team numbers: `send-test-event.ts all` with
   `WHATSAPP_PROVIDER=meta`, then one real ERP event.
5. Switch to the real number, collect customer opt-in, and turn on `notifyCustomers` /
   `notifySuppliers`.
6. Turn WAHA off.

Official sources: [Pricing](https://developers.facebook.com/docs/whatsapp/pricing),
[Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits),
[Cloud API get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started),
[Message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates),
[Webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
Meta can change rules and rates every quarter; re-check before go-live.
