# Notification Module (M04: n8n events, WhatsApp)

> Rewritten 2026-11-07 for the Elysia backend. The earlier text described the
> deleted NestJS stub (`modules/notification/**`); it is superseded.

## Purpose and boundary

Outbound business notifications and, next, the WhatsApp assistant (M04,
owner decisions of 2026-11-07 in `docs/plan/progress.md`):

- **ERP events → n8n** (implemented): module `apps/backend/src/app/automation`
  owns the outbox (`automation.outbox_messages`). Business modules call
  `OutboxService.publish` (DI `OUTBOX_SERVICE_TOKEN`) after their change is
  saved; n8n is the workflow engine that turns an event into a WhatsApp
  (through WAHA) or email message. The ERP never sends those messages
  itself and stores no templates.
- **WhatsApp assistant** (planned, M04 4d): WAHA posts customer chats
  straight to an ERP webhook; FAQ base, provider-neutral AI port, handoff
  queue, conversation log. The AI never grants discounts or transacts.
- Auth OTP/magic-link delivery is not here yet (still Better Auth's own
  senders).

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
| `invoice.issued` | Finance: invoice issued | `invoiceId`, `code`, `title`, `customer{id,code,name,email,phone,whatsapp}`, `salesOrderCode`, `issueDate`, `dueDate`, `grandTotal`, `outstandingTotal`, `currencyCode` |
| `receipt.recorded` | Finance: receipt recorded | `receiptId`, `code`, `receivedDate`, `amount`, `method`, `invoice{id,code,status,grandTotal,paidTotal,outstandingTotal}`, `customer{…}` |
| `service_ticket.updated` | After-sales: every ticket change | `ticketId`, `code`, `change` (`created / assigned / started / resolved / reopened / closed`), `status`, `customer{id,name,phone,whatsapp,email}`, `reporterName`, `reporterContact`, `assignee{userId,name}`, `resolution`, `serviceCost` |
| `license.due` | Licensing: daily job | `contractId`, `code`, `threshold` (30 / 7 / 0), `stage` (`ending / ended`), `daysLeft`, `endDate`, `graceEndsOn`, `application{code,name}`, `customer{…}` |

`license.due` runs from the BullMQ queue `licensing-due` (cron
`SCHEDULER_LICENSE_DUE_CRON`, default `0 8 * * *` Asia/Jakarta, only with
`SCHEDULER_ENABLED=true`). Each contract, end date and threshold is published
once (`outbox_messages.dedupe_key`), so a re-run or a missed day never
duplicates a reminder.

## Configuration

`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (min 16 chars) — both optional;
without them events stay `pending` with "not configured" and can be sent
from the log once set. Never logged; the adapter never echoes the URL.

## Rules

- `publish` never throws into the business action; a queue outage leaves the
  event `pending` for a manual send.
- Permissions: `automation:read_log` (log), `automation:execute` (send);
  admin role.
- Company-wide (ADR-0012); unix-ms timestamps; soft delete.

## Tests

`outbox.service.test.ts` (publish/queue, dedupe key, delivery outcomes,
signature and headers, no URL leak); event assertions in
`lead.service.test.ts`, `invoice.service.test.ts`,
`service-ticket.service.test.ts`, `licensing.service.test.ts` (thresholds,
once per threshold). E2E against a local fake receiver: see `progress.md`
(M04 4b, 4c).
