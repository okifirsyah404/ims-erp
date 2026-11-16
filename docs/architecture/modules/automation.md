# Automation Module (M04: n8n events, WhatsApp)

> Created 2026-11-15 from the M04 branch's `notification.md`, which was written
> before the `notification` module existed (ADR-0016). The in-app inbox is
> `notification.md`; this file covers `apps/backend/src/app/automation`.

## Purpose and boundary

Outbound business events and the WhatsApp assistant (M04, owner decisions of
2026-11-07 in `docs/plan/progress.md`, ADR-0020):

- **ERP events → n8n** (implemented): module `apps/backend/src/app/automation`
  owns the outbox (`automation.outbox_messages`). Business modules call
  `OutboxService.publish` (DI `OUTBOX_SERVICE_TOKEN`) after their change is
  saved; n8n is the workflow engine that turns an event into a WhatsApp
  (through WAHA) or email message. The ERP never sends those messages
  itself and stores no templates.
- **WhatsApp assistant** (implemented, M04 4d): WAHA posts customer chats
  straight to an ERP webhook; FAQ base, provider-neutral AI port, handoff
  queue, conversation log. The AI never grants discounts or transacts.
  Same module (`automation`), tables `faq_entries`,
  `whatsapp_conversations`, `whatsapp_messages`.
- Auth OTP/magic-link delivery is not here yet (still Better Auth's own
  senders).

The public website catalog is a separate module (`catalog.web_listings`);
the assistant reads it through `CatalogService.matchProducts`.

## The event contract (what n8n receives)

`POST <N8N_WEBHOOK_URL>` with a JSON body

```json
{ "id": "<uuid, event id>", "topic": "lead.created", "occurredAt": "<ISO>",
  "aggregate": { "type": "lead", "id": "<uuid>" }, "data": { … } }
```

Headers: `X-Erp-Event-Id`, `X-Erp-Event-Type`, `X-Erp-Timestamp` (unix ms),
`X-Erp-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with
N8N_WEBHOOK_SECRET>`. The receiver must verify the signature and dedupe on
the event id (a retry re-sends the same id). Any 2xx counts as delivered;
5xx / 408 / 429 / network errors are retried (5 attempts, backoff from 30 s);
other 4xx stop the retries. Every attempt is logged on the row and shown at
`/integrations/webhooks`, where an admin can send again.

Amounts are integer IDR minor units (divide by 100 for rupiah). Topics:

| Topic | Published by | `data` (main fields) |
| --- | --- | --- |
| `lead.created` | CRM: manual lead, website inquiry | `leadId`, `reference`, `name`, `companyName`, `phone`, `whatsapp`, `email`, `source`, `channel`, `needs`, `ownerUserId` |
| `invoice.issued` | Sales: invoice issued | `invoiceId`, `code`, `title`, `customer{id,code,name,email,phone,whatsapp}`, `salesOrderCode`, `issueDate`, `dueDate`, `grandTotal`, `outstandingTotal`, `currencyCode` |
| `receipt.recorded` | Sales: receipt recorded | `receiptId`, `code`, `receivedDate`, `amount`, `method`, `invoice{id,code,status,grandTotal,paidTotal,outstandingTotal}`, `customer{…}` |
| `service_ticket.updated` | After-sales: every ticket change | `ticketId`, `code`, `change` (`created / assigned / started / resolved / reopened / closed`), `status`, `customer{id,name,phone,whatsapp,email}`, `reporterName`, `reporterContact`, `assignee{userId,name}`, `resolution`, `serviceCost` |
| `whatsapp.handoff` | WhatsApp assistant: chat handed to an admin | `conversationId`, `phone`, `contactName`, `reason` (`no_provider / not_found / human_requested / restricted / error`), `question` |
| `license.due` | Licensing: daily job | `contractId`, `code`, `threshold` (30 / 7 / 0), `stage` (`ending / ended`), `daysLeft`, `endDate`, `graceEndsOn`, `application{code,name}`, `customer{…}` |
| `supplier_bill.recorded` | Finance: supplier bill recorded (ERP-0012) | `billId`, `organizationId`, `code`, `supplierInvoiceNumber`, `purchaseOrderId`, `status`, `billDate`, `dueDate`, `grandTotal`, `paidTotal`, `outstandingTotal`, `supplier{id,code,name,phone,email,picName,picPhone}` (never bank details), `recordedBy` |
| `supplier_bill.due` | Finance: daily job (ERP-0012) | same as `supplier_bill.recorded` plus `threshold` (7 / 0), `stage` (`upcoming / due / overdue`), `daysLeft` |

`license.due` runs from the BullMQ queue `licensing-due` (cron
`SCHEDULER_LICENSE_DUE_CRON`, default `0 8 * * *` Asia/Jakarta, only with
`SCHEDULER_ENABLED=true`). Each contract, end date and threshold is published
once (`outbox_messages.dedupe_key`), so a re-run or a missed day never
duplicates a reminder.

`supplier_bill.due` works the same way from the BullMQ queue
`supplier-bill-due` (cron `SCHEDULER_BILL_DUE_CRON`, default `0 8 * * *`
Asia/Jakarta, only with `SCHEDULER_ENABLED=true`): open bills (recorded, not
fully paid) due within 7 days get threshold 7, due or overdue ones threshold 0,
once per bill, due date and threshold.

## WhatsApp assistant

Flow: WAHA → `POST /integrations/whatsapp/webhook` (no session; WAHA's
`X-Webhook-Hmac` = hex HMAC-SHA512 of the raw body with
`WAHA_WEBHOOK_SECRET`, compared in constant time; refused with 503 when the
key is not configured, 401 when wrong). Only `message` events from personal
chats are used (our own messages, groups, status and channels are ignored).
The message is stored once — unique `(direction, external_id)` on the
WhatsApp message id — and queued on BullMQ `whatsapp-inbound` (3 attempts);
WAHA gets 200 at once.

`AssistantService.process`, in this order:

1. Chat with an admin (`handoff`) → the assistant stays silent.
2. Empty or media-only message → handoff `not_found`.
3. Discount, special price, payment, order or refund words
   (`utils/assistant.ts` `isRestricted`) → handoff `restricted` with a
   refusal reply; the AI is not called.
4. Asking for a person → handoff `human_requested`.
5. No AI provider configured → handoff `no_provider`.
6. The model gets a fixed system prompt with only the matching active FAQ
   entries (word overlap) and published catalog products
   (`CatalogService.matchProducts`), plus the last turns. It answers or
   says it is unsure (→ handoff `not_found`); an answer that itself
   mentions discounts/payments is not sent (→ handoff `restricted`); a
   provider error → handoff `error`.

A handoff sends one holding reply, marks the chat `handoff` and publishes
`whatsapp.handoff` to n8n so someone is alerted. An admin reply takes the
chat over (assigned to the admin); **resume** gives it back to the
assistant; **close** ends it and the next customer message reopens it with
the assistant. Every inbound and outbound message is logged with its
status; a failed send can be resent.

The model port (`IAssistantModel`) is provider-neutral; the one adapter is
an OpenAI-compatible `POST <AI_BASE_URL>/chat/completions` (text only, no
tools) — not yet tried against a real provider. The model cannot change
ERP data whatever the prompt says: it has no tools, and its text is checked
again before sending.

Lead capture (ERP-0021): **Create lead** on a chat
(`POST …/conversations/:id/lead`, `whatsapp:reply`) calls CRM's contract
`LeadService.captureFromChat` — an unassigned `whatsapp` lead with the
contact name, number and the customer's last messages, published as
`lead.created` — and links it in `whatsapp_conversations.lead_id` (once per
chat, conditional update).

Endpoints: `/automation/whatsapp/status | conversations | conversations/:id
| …/reply | …/lead | …/resume | …/close | messages/:id/retry` and `/automation/faq`.
Permissions `whatsapp:read | reply | manage_faq` (admin all; sales manager
and customer service read + reply; marketing read + FAQ). Web:
`/integrations/whatsapp-ai`, `…/$conversationId`, `…/faq`.

## Configuration

Step-by-step setup: `docs/user-guide/whatsapp-n8n-setup.en.md` (and `.id.md`).

`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (min 16 chars) — both optional;
without them events stay `pending` with "not configured" and can be sent
from the log once set. `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` (default
`default`), `WAHA_WEBHOOK_SECRET` (min 16) for WhatsApp; `AI_BASE_URL`,
`AI_API_KEY`, `AI_MODEL` for the optional AI provider. In WAHA, point the
session's webhook at `<APP_URL>/integrations/whatsapp/webhook`, event
`message`, with the HMAC key = `WAHA_WEBHOOK_SECRET`. None of these is ever
logged; adapters never echo URLs or keys.

## Rules

- `publish` never throws into the business action; a queue outage leaves the
  event `pending` for a manual send.
- Permissions: `automation:read_log` (log), `automation:execute` (send);
  admin role.
- Company-wide (ADR-0012); `outbox_messages.organization_id` is a nullable
  plain id (ADR-0014) that the M04 publishers leave unset; unix-ms
  timestamps; soft delete.

## Tests

`whatsapp-assistant.test.ts` (signature, parsing, dedupe, guards incl.
injection attempts, no provider, unsure / failing / risky answers, admin
takeover, resend); `outbox.service.test.ts` (publish/queue, dedupe key, delivery outcomes,
signature and headers, no URL leak); event assertions in
`lead.service.test.ts`, `invoice.service.test.ts`,
`service-ticket.service.test.ts`, `licensing.service.test.ts` (thresholds,
once per threshold). E2E against a local fake receiver: see `progress.md`
(M04 4b, 4c, 4d).
