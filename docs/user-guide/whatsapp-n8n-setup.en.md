# WhatsApp (WAHA) and n8n setup guide (M04, T32)

For the person who connects the ERP to WAHA, n8n and an AI provider. The
technical contract is in `docs/architecture/modules/notification.md` and
ADR-0020; this guide is the step-by-step version. Indonesian version:
[whatsapp-n8n-setup.id.md](whatsapp-n8n-setup.id.md) (keep both in step).

> **Status (2026-11-12):** the ERP side is implemented and tested against a
> local fake receiver and signed test webhooks. It has **not yet been tried
> against a real WAHA, n8n or AI provider** — the first real run is part of
> UAT (`docs/plan/uat/`). Use a sandbox WhatsApp number first; WAHA is
> unofficial and a number can be banned.

> **WAHA is unofficial and numbers can be banned.** For production use the official WhatsApp
> Business (Meta Cloud API): [whatsapp-business-meta.en.md](whatsapp-business-meta.en.md).

## 1. What talks to what

```text
Customer WhatsApp ──► WAHA ──POST /integrations/whatsapp/webhook──► ERP
ERP ──POST /api/sendText──► WAHA ──► Customer WhatsApp      (replies)
ERP outbox ──POST N8N_WEBHOOK_URL──► n8n ──► WAHA / email   (notifications)
ERP ──POST <AI_BASE_URL>/chat/completions──► AI provider    (optional)
```

- Chats go WAHA → ERP directly (not through n8n).
- Business events (new lead, invoice, payment, ticket, license due,
  handoff) go ERP → n8n. n8n decides what message to send and to whom; the
  ERP stores no templates.

## 2. Before you start

- A **dedicated WhatsApp number** for the assistant (sandbox first, never the
  owner's personal number).
- A WAHA instance (Docker) reachable from the ERP, and able to reach the ERP's
  public URL (`APP_URL`).
- An n8n instance with a public webhook URL (HTTPS).
- Optional: an OpenAI-compatible AI provider (base URL, API key, model name).
  Without it every chat is handed to an admin — a safe way to start.
- Access to the backend `.env` on the server. Never paste secrets into chat,
  tickets or screenshots.

Generate each secret with at least 16 characters, for example
`openssl rand -hex 32`, and keep it in a password manager.

## 3. Backend `.env`

| Variable | Value | Notes |
| --- | --- | --- |
| `WAHA_URL` | WAHA base URL, e.g. `http://waha:3000` | No trailing `/api`. |
| `WAHA_API_KEY` | WAHA API key | Sent as `X-Api-Key`. |
| `WAHA_SESSION` | WAHA session name | Default `default`. |
| `WAHA_WEBHOOK_SECRET` | random, ≥ 16 chars | Same value as the HMAC key in WAHA (step 4). |
| `N8N_WEBHOOK_URL` | n8n production webhook URL | Step 5. |
| `N8N_WEBHOOK_SECRET` | random, ≥ 16 chars | Same value in the n8n verify step. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | provider values | Optional. |
| `SCHEDULER_ENABLED` | `true` | Needed for daily `license.due`. |
| `SCHEDULER_LICENSE_DUE_CRON` | e.g. `0 8 * * *` | Asia/Jakarta clock; default 08:00. |

Restart the backend. Open **WhatsApp AI**: a warning lists whatever is
still missing (webhook key, WAHA, AI provider); no warning means all three are
set. Values are never shown. Without `N8N_*`, events stay `pending` ("not
configured") and can be sent from **Webhooks (n8n)** once set.

## 4. WAHA → ERP (incoming chats)

1. Start the WAHA session and scan the QR code with the dedicated number.
2. In the session's webhook settings:
   - URL: `<APP_URL>/integrations/whatsapp/webhook`
   - Events: `message` only
   - HMAC key: the value of `WAHA_WEBHOOK_SECRET`
     (WAHA then sends `X-Webhook-Hmac`, HMAC-SHA512 of the body).
3. Send a test message from another phone to the dedicated number.
4. Expected: the chat appears under **WhatsApp AI** within a
   few seconds. With no AI provider it is marked **handoff** (`no_provider`)
   and the customer gets one holding reply.

Troubleshooting:

| Symptom | Cause |
| --- | --- |
| WAHA log shows `503` | `WAHA_WEBHOOK_SECRET` not set on the ERP. |
| WAHA log shows `401` | HMAC key in WAHA differs from `WAHA_WEBHOOK_SECRET`. |
| `200` but no chat | Group, status, channel or own message — ignored by design. |
| Chat appears, reply shows "failed" | `WAHA_URL` / `WAHA_API_KEY` / `WAHA_SESSION` wrong, or session not connected. Fix and press **Send again**. |

## 5. ERP → n8n (notifications)

1. In n8n create a workflow with a **Webhook** trigger: method `POST`,
   response "Immediately", and enable the **Raw Body** option. Use the
   production URL as `N8N_WEBHOOK_URL`.
2. Add a verify step (Code node; allow the `crypto` built-in with
   `NODE_FUNCTION_ALLOW_BUILTIN=crypto` on the n8n server):

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

   Also reject events whose `x-erp-timestamp` is older than ~10 minutes if
   you want replay protection.
3. **Dedupe on `X-Erp-Event-Id`**: a retry or a manual "send again" re-sends
   the same id. Keep sent ids (n8n data table, Redis or a sheet) and stop
   when the id was already handled.
4. **Switch** on `topic` and build one branch per topic (table below).
   Amounts are integer minor units: divide by 100 for rupiah.
5. Send WhatsApp messages from n8n through WAHA `POST /api/sendText`
   (`{ session, chatId: "<62…>@c.us", text }`, header `X-Api-Key`) and email
   through your mail node.
6. Answer `2xx` only when the event was handled. `5xx`, `408`, `429` and
   timeouts are retried by the ERP (5 attempts, backoff from 30 s); other
   `4xx` stop retries. Every attempt is visible under **Webhooks (n8n)**.

| Topic | Suggested flow |
| --- | --- |
| `lead.created` | Alert the sales manager (new lead, source, needs). |
| `invoice.issued` | Send the customer the invoice number, total and due date. |
| `receipt.recorded` | Thank the customer; show paid and outstanding. |
| `service_ticket.updated` | Tell the reporter the new status (`change`). |
| `whatsapp.handoff` | Alert the admin on duty: a chat needs a person (`reason`, `question`). |
| `license.due` | Remind the customer at 30 / 7 / 0 days (`threshold`, `stage`). Sent once per contract and threshold. |
| `purchase_return.updated` | Purchase returns: ask for approval, tell the warehouse to ship, tell the supplier PIC. |
| `sales_return.updated` | Sales returns: ask for approval, prepare the warehouse, tell the customer. |
| `supplier_bill.recorded` | Tell finance a supplier bill was recorded. |
| `supplier_bill.due` | Remind finance 7 days ahead, on the due date and when overdue (`threshold`, `stage`). |

Field lists per topic: `notification.md`, "The event contract".

An importable workflow that handles all of these topics: [n8n-workflows.en.md](n8n-workflows.en.md).

## 6. AI provider (optional)

Set `AI_BASE_URL` (OpenAI-compatible, the ERP calls `/chat/completions`),
`AI_API_KEY`, `AI_MODEL`, restart. Fill **WhatsApp AI → Assistant FAQ**
first: the assistant answers only from active FAQ entries and published
catalog products. Discount, price, payment, order and refund questions are
always handed to an admin, before and after the model call.

## 7. Go-live checklist

- [ ] Sandbox number: incoming chat, holding reply, admin reply, resume, close.
- [ ] Wrong HMAC key gives `401`; repeated WAHA delivery shows one message.
- [ ] Each n8n topic tested once with a real event; a bad signature is rejected.
- [ ] Manual "send again" of a delivered event does not send a second message (dedupe).
- [ ] Discount request is refused and handed off.
- [ ] Owner approves live messaging (ADR-0020), then switch to the live number.
