# n8n workflow for ERP events (M04)

How to use the importable workflow
[`docs/integrations/n8n/erp-event-router.workflow.json`](../integrations/n8n/erp-event-router.workflow.json).
It receives business events from the ERP and sends WhatsApp messages through WAHA, plus email
when enabled.

- Indonesian version: [n8n-workflows.id.md](n8n-workflows.id.md).
- Both versions change together.
- WAHA and ERP `.env` set-up: [whatsapp-n8n-setup.en.md](whatsapp-n8n-setup.en.md).

> **Status (2026-11-16).** Tested on a real **n8n 2.47.7** in Docker, with a fake WAHA that
> records every message:
> - The CLI import succeeds.
> - All 10 topics (every `change`) are delivered and their texts were reviewed.
> - A bad signature gets 401; a duplicate is skipped.
> - A WAHA outage gives 500 and then succeeds when the ERP retries.
> - **Real ERP → n8n:** recording a supplier bill sent `supplier_bill.recorded`, and the ERP
>   outbox shows `published` after 1 attempt.
>
> **Not** tested yet: real WAHA and real WhatsApp numbers. That is part of UAT; use a sandbox
> number first.

## 1. Overview

```text
ERP (outbox) ──POST /webhook/erp-events (HMAC)──► n8n ──► WAHA ──► WhatsApp team / customers / suppliers
                                                     └──► (optional) SMTP ──► team email
```

- **The ERP decides when** something happened (the event).
- **n8n decides who is told and what the message says.** The ERP stores no templates
  (ADR-0020).
- One workflow handles every topic. Recipients and texts live in **one node** ("3. Compose
  messages").
- Amounts arrive as integer cents; the workflow formats them as `Rp 1.443.000`.

## 2. Requirements

| Need | Notes |
| --- | --- |
| n8n ≥ 2.x | Self-hosted (Docker) recommended, with a **public HTTPS** URL the ERP server can reach. |
| WhatsApp | **WAHA** (unofficial, numbers can be banned) **or the Meta Cloud API** (official, templates required; registration in [whatsapp-business-meta.en.md](whatsapp-business-meta.en.md)). A dedicated number. |
| Team WhatsApp numbers per role | owner, sales manager, sales, operations manager, purchasing, warehouse, finance, support/technician, admin on duty. |
| SMTP (optional) | Only for email; today used for supplier bill notices to finance. |
| Owner approval | Of the texts to **customers and suppliers**, before switching them on. |

### Environment on the n8n server

| Variable | Value |
| --- | --- |
| `ERP_WEBHOOK_SECRET` | **Exactly** the ERP's `N8N_WEBHOOK_SECRET` (≥ 16 characters). |
| `WAHA_URL` | WAHA base URL, e.g. `http://waha:3000` (no `/api`). |
| `WAHA_API_KEY` | WAHA API key. |
| `WAHA_SESSION` | WAHA session name (default `default`). |
| `WHATSAPP_PROVIDER` | `waha` (default) or `meta`; for Meta also `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN` (see [whatsapp-business-meta.en.md](whatsapp-business-meta.en.md)). |
| `NODE_FUNCTION_ALLOW_BUILTIN` | `crypto` (the signature check). |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` (the Code nodes read the variables above). |
| `GENERIC_TIMEZONE` | `Asia/Jakarta`. |
| `ERP_NOTIFY_FROM_EMAIL` | Optional sender address for email. |

The Indonesian guide has a Docker Compose example.

### ERP side (backend `.env`)

| Variable | Value |
| --- | --- |
| `N8N_WEBHOOK_URL` | `https://<n8n-host>/webhook/erp-events` (the **production** URL, not `webhook-test`). |
| `N8N_WEBHOOK_SECRET` | The same secret as `ERP_WEBHOOK_SECRET` on n8n. |
| `SCHEDULER_ENABLED` | `true`, required for the daily `license.due` and `supplier_bill.due` events. |
| `SCHEDULER_LICENSE_DUE_CRON`, `SCHEDULER_BILL_DUE_CRON` | Optional; default `0 8 * * *` (08:00 WIB). |

Restart the backend after changing `.env`.

## 3. Import and activate

1. In n8n: **Workflows → Import from File** and pick `erp-event-router.workflow.json`. The CLI
   also works: `n8n import:workflow --input=erp-event-router.workflow.json`.
2. Open node **"3. Compose messages"** and fill in `CONFIG` (section 5).
3. **Activate / Publish** the workflow. With the CLI: `n8n publish:workflow --id=<id>`, then
   restart n8n.
4. Copy the node "ERP webhook" **Production URL** (`…/webhook/erp-events`) into the ERP's
   `N8N_WEBHOOK_URL`.
5. Test without the ERP using the test script (section 7), then with a real ERP event.

> Handled event ids live in the n8n **data table** `erp_processed_events` (*Overview → Data
> tables*), created by node "2a. Ensure table". It grows one row per event; clear it now and then.
> Workflow static data is deliberately not used: in testing, an event re-sent right away got
> through, because static data is saved only after the ERP got its answer.

## 4. The nodes

| # | Node | Job | On failure |
| --- | --- | --- | --- |
| – | **ERP webhook** | Receives the ERP's `POST` (path `erp-events`). The last node answers. | – |
| 1 | **Verify ERP signature** | Recomputes `sha256=HMAC(ERP_WEBHOOK_SECRET, "<X-Erp-Timestamp>.<body>")`, compares it to `X-Erp-Signature` in constant time, and refuses timestamps older than ±10 minutes (replay). | Bad or expired signature → **401** (the ERP stops retrying); not an event → **400**; secret missing → **500** (the ERP retries). |
| 2a–2c | **Ensure table → Look up event → Skip duplicates** | The ERP re-sends the same event id on retries and on "send again". Handled ids live in the **n8n data table `erp_processed_events`** (created automatically on the first event). | Duplicate → **200**, no message. |
| 3 | **Compose messages** | Builds the messages from `topic` and `data`, recipients from `CONFIG`; 0 to n messages per event. | – |
| 4 | **Send WhatsApp (WAHA / Meta)** | `WHATSAPP_PROVIDER=waha`: `POST <WAHA_URL>/api/sendText` per message (free text). `WHATSAPP_PROVIDER=meta`: Cloud API with **approved templates** (see [whatsapp-business-meta.en.md](whatsapp-business-meta.en.md)). | Error → execution fails → **500** → the ERP retries (5 attempts, backoff from 30 s). The event was not recorded yet, so the retry really sends. |
| 5a–5b | **Record event → Finish** | Stores the event id in `erp_processed_events`, **only after** WhatsApp succeeded, and sets the answer. | – |
| – | **Answer the ERP** | Answers `{ result, messages }` with the status from the previous steps. | – |
| 6 | **Email messages** → **Send email** | Optional branch: email to the roles in `CONFIG.teamEmail`. **Send email is disabled** after import. | Runs after the ERP was answered, so a failed email is **not** retried by the ERP (WhatsApp is the primary channel). |

| Status | Meaning | ERP behaviour |
| --- | --- | --- |
| 200 | Handled, duplicate, or a topic with no recipient | Done (`published`) |
| 400 / 401 | Not an event / bad signature | Stops retrying (`failed`) |
| 500 | WAHA or n8n trouble | Retries; visible under **Integrations → Webhooks (n8n)** |

## 5. Recipients (`CONFIG`)

Edit the `CONFIG` block at the top of "3. Compose messages":
- `team`: WhatsApp numbers per role. `0812…`, `62812…` and `+62 812…` are all accepted. An
  empty role means nobody in that role is told.
- `teamEmail`: optional email per role.
- `notifyCustomers` / `notifySuppliers`: keep `false` until the owner approved those texts.
  Internal messages always go out.
- `erpUrl`: the ERP address used for links in messages; `''` means no links.

To change a text, edit that topic's function in the `handlers` object of the same node.

## 6. Topics and default recipients

| Topic | When | Default recipients |
| --- | --- | --- |
| `lead.created` | New lead | sales manager |
| `invoice.issued` | Invoice issued | customer*, finance |
| `receipt.recorded` | Customer payment recorded | customer* |
| `service_ticket.updated` | Ticket created / assigned / started / resolved / reopened / closed | customer*; new ticket → support |
| `whatsapp.handoff` | Assistant chat needs a person | admin on duty |
| `license.due` | Daily: license 30 / 7 days / ended | customer*, sales manager |
| `purchase_return.updated` | submitted → operations manager; approved → warehouse + purchasing; rejected → purchasing; shipped → purchasing + supplier PIC**; cancelled → purchasing + warehouse | see left |
| `sales_return.updated` | submitted → sales manager; approved → warehouse + customer*; rejected → sales; received → sales + customer*; cancelled → sales | see left |
| `supplier_bill.recorded` | Supplier bill recorded | finance (WhatsApp, and email when enabled) |
| `supplier_bill.due` | Daily: 7 days ahead, due today, overdue | finance; overdue → also owner |
| `lead.follow_up_due` | Weekdays 08:00: a lead's follow-up date arrived or passed | **the lead's owner** (phone from the ERP user profile; no owner → sales manager); more than 3 days late → also the sales manager |
| `quotation.follow_up_due` | Weekdays 08:00: a sent quotation without an answer after 3 / 7 days, and 2 days before it expires | **the salesperson who made it** (fallback sales manager). Never the customer |
| `quotation.sent` | A quotation is marked sent; the ERP has made its PDF (identical to the print page) | customer*: a message **with the PDF attached** (WAHA `sendFile` / Meta template with a Document header; the link lasts 30 days). No PDF → **the salesperson who made it** is asked to send it by hand |

\* only with `notifyCustomers: true`; \*\* only with `notifySuppliers: true`.
Field lists: `docs/architecture/modules/automation.md`, "The event contract".

## 7. Testing without the ERP

```bash
N8N_WEBHOOK_URL=https://<n8n-host>/webhook/erp-events N8N_WEBHOOK_SECRET=<same secret> \
bun docs/integrations/n8n/send-test-event.ts all
bun docs/integrations/n8n/send-test-event.ts sales_return.updated --change=received
bun docs/integrations/n8n/send-test-event.ts lead.created --bad-signature   # must be 401
bun docs/integrations/n8n/send-test-event.ts whatsapp.handoff --repeat      # 2nd must be "duplicate"
```

The sample contacts are fake. While testing, put team numbers in `CONFIG.team` and keep
`notifyCustomers` false.

## 8. Go-live checklist

- [ ] The secrets match; `--bad-signature` gets 401.
- [ ] `send-test-event.ts all` → all 200, and the messages reach the team numbers.
- [ ] `--repeat` → the second event is "duplicate" and WhatsApp is sent once.
- [ ] A real ERP event reaches WhatsApp and shows `published` under **Integrations → Webhooks
      (n8n)**.
- [ ] WAHA stopped briefly → the event fails, then is delivered on retry.
- [ ] `SCHEDULER_ENABLED=true`; the next morning `license.due` / `supplier_bill.due` arrive when
      something is due.
- [ ] The owner approved the customer and supplier texts → switch `notifyCustomers` /
      `notifySuppliers` on.
- [ ] Move from the sandbox number to the live number.

## 9. Changing the workflow

- Each node's code lives in `docs/integrations/n8n/src/`.
- After a change, run `bun docs/integrations/n8n/build-workflow.ts` to rebuild the JSON, and
  commit both.
- `CONFIG` edits made in the n8n editor stay out of the repo, which is fine: team numbers are
  operational data, not code.
- Never commit personal numbers or secrets.
