# M04 — n8n, WhatsApp, and Website

## Purpose

The public storefront and the messaging channel. Stage 1 publishes the
Entragate catalog and the CV IMS profile, adds a requirements form and a
WhatsApp button, and sends one ERP event to n8n. Stage 2 adds checkout, a
FAQ/catalog WhatsApp AI, notifications and handoff to an admin.

## Stage 1 scope (baseline)

- Entragate product catalog (public).
- CV IMS company page.
- Requirements form (it creates a lead in M02).
- WhatsApp button (a `wa.me` link to the official number).
- **One** ERP event sent to n8n, with logging and a manual trigger.

_Interpretation, needs owner confirmation:_

- Catalog: published items from the master data (T03) with name, photo,
  short description and an optional public price. Unpublished items stay
  hidden.
- Requirements form: name, phone, email, company, need. On submit it creates
  a `new` lead (M02) and shows a thank-you page. It has a spam guard
  (honeypot or rate limit).
- The one event: _proposed_ `lead.created`. n8n can then notify the sales
  admin. The event is chosen at kickoff (T01).
- Delivery: the ERP writes the event to an outbox log row, then POSTs it to
  one n8n webhook URL from server config. The result is logged (`sent` /
  `failed` + response). An admin can re-send a failed row (manual trigger).

## Stage 2 scope (baseline) — add-on: WhatsApp AI (IDR 1,250,000)

- Checkout through one gateway (the website side of M02/T21).
- WhatsApp AI based on FAQ/catalog.
- Notifications.
- Handoff to an administrator.
- n8n logs, with manual retry.
- One official WhatsApp number and one AI provider.

_Interpretation, needs owner confirmation:_

- Flow (S05): a customer message arrives on the WA number, goes to n8n, and
  the AI answers from the FAQ knowledge base and the published catalog only.
  If confidence is low or the customer asks for a human, the conversation is
  handed off to an admin (flagged, with notification).
- Notifications are template messages for a fixed list of events. _Proposed:_
  invoice issued, payment received, license expiring, ticket updated. Final
  list at kickoff. Templates must be approved by the WA provider beforehand.
- Logs record each inbound/outbound message, AI answer, handoff and failure,
  and an admin can retry a failed send.

## Explicit limits (out of scope)

- One gateway, one WhatsApp number and one AI provider.
- No marketplace (Tokopedia, Shopee and similar).
- **AI cannot grant discounts or conduct financial transactions.** It only
  answers from the FAQ/catalog and hands off.
- No multi-number or multi-agent inbox, and no chatbot builder UI.
- No CMS beyond the catalog and the profile page.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T14 | Dashboard and one basic webhook | A | S1 14–15 | 337,500 (webhook half; dashboard in M01) |
| T15 | Entragate catalog and IMS profile | B | S1 14–15 | 337,500 |
| T27 | AI FAQ and n8n integration | A | S2 19–23 | 850,000 |
| T28 | Notifications, handoff, and WhatsApp logs | A | S2 24–26 | 400,000 |

The checkout pages are built inside T21 (M02).

## SOPs

- **S05 Digital integration:** catalog/WhatsApp, FAQ or administrator,
  checkout, notification. Failures are logged and followed up.

## Controls

- Webhook URLs, WA tokens and AI keys are kept in server config only. They
  are never sent to the browser or logged.
- Inbound webhooks from n8n/WA are verified (shared secret or signature)
  before they are processed.
- The AI has no tool or endpoint that can create discounts, invoices or
  payments. This is enforced by what n8n is wired to call, not by the prompt.
- Public form endpoints are rate-limited and validate input. No lead is
  created on invalid input.
- No live messages are sent without business authorization. Use a sandbox
  number until then (`docs/plan/phases/README.md`).

## Acceptance

- UAT: catalog/form/webhook scenarios in U01–U20 and WA AI/notification/
  handoff scenarios in U21–U32, per Excel. Scenario text is not in the repo.
- _Interpretation:_ the tests cover a failed webhook (logged, then retried
  successfully), an AI question outside the FAQ (handed off), and a discount
  request to the AI (refused and handed off).

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Outbox/log rows exist for every event attempt. A manual retry is tested
  and idempotent: the receiver dedupes on event id.
- Public pages are responsive, have accessible labels and use Indonesian
  copy. Catalog content comes from the master data, not hardcoded.
- The WA/n8n guide is delivered for T32 (v5.1 handover deliverable).
- Prerequisites are recorded: official WA number verified, templates
  approved, AI provider account ready. Without them T27/T28 are `blocked`.

## Dependencies

- Needs: T03 items (catalog), M02 leads (form) and checkout (T21), M03/M07/M09
  events (notifications).
- External: n8n instance, official WA Business API number, AI provider. All
  are provided by the company, and their costs are excluded from the budget.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Public catalog | `commerce.catalog_publications`, `catalog_publication_items` + `catalog` (12 tables) | none (inventory `items` exist in admin only) |
| Profile page | `commerce.web_pages`, `web_menus`, `web_menu_items` | none |
| Webhook / outbox / log | `automation.outbox_messages`, `integrations`, `integration_credentials` | none |
| n8n workflows / runs | `automation.workflows`, `workflow_steps`, `workflow_runs`, `workflow_step_runs` | none |
| Notifications | `automation.notification_templates`, `notifications` | none |

- Status: **planned**. No public site exists.
- `beyond-baseline`: the `automation` workflow engine tables (`workflows`,
  `workflow_steps`, `workflow_runs`, `workflow_step_runs`, `scheduled_jobs`,
  `job_executions`). In v5.1, n8n is the workflow engine, so a second engine
  inside the ERP is extra. CMS menus (`web_menus`, `web_menu_items`) and
  `promotions` go beyond "catalog + profile page".
