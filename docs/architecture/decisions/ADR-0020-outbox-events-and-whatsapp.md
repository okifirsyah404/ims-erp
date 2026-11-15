# ADR-0020 - ERP Events Through an Outbox to n8n; WhatsApp Through WAHA

- **Status:** proposed (2026-11-12). Records the M04 owner decisions of
  2026-11-07; becomes accepted with the owner's review of the M04 PR.
- **Context:** M04 needs (1) business events (new lead, invoice issued,
  payment received, ticket updated, license ending) to reach WhatsApp/email
  notifications, and (2) a WhatsApp assistant that answers customers from
  approved knowledge and hands off to an admin. Phase 6 requires external
  effects after commit only, webhook authenticity, idempotency and retries,
  and sandbox use until the business approves live messaging. No n8n
  instance, WhatsApp number or AI provider exists yet.
- **Decision:**
  1. **Business events go through a transactional-style outbox**
     (`automation.outbox_messages`). The publishing module calls
     `OutboxService.publish` after its change is saved (for invoices: after
     the issue transaction commits); publish never fails the business
     action. A BullMQ job POSTs the event to the n8n webhook with an event id
     (the receiver's dedupe key) and an HMAC-SHA256 signature of
     `timestamp.body`, retries 5xx/408/429/network errors with backoff, and
     stops on other 4xx. Every attempt is logged; an admin can send again.
     Once-per-fact events (daily `license.due`) carry a unique `dedupe_key`.
     A published event is never overwritten (conditional update).
  2. **n8n is the workflow engine**, not the ERP: the ERP stores no message
     templates and sends no notification itself. The `automation` workflow
     tables in `docs.dbml` stay target-only.
  3. **WhatsApp chats go WAHA → ERP directly**, not through n8n: the webhook
     is verified (HMAC-SHA512, refused when no key is configured), deduped on
     the WhatsApp message id, answered at once and processed on a queue;
     replies go out through a WAHA adapter.
  4. **The AI logic lives in the ERP behind a provider-neutral port.** The
     model gets only active FAQ entries and published catalog products, has
     no tools, and its answer is checked again before sending. Requests for
     discounts, special prices, payments or orders are refused and handed
     off before any model call. With no provider configured, every chat is
     handed off.
  5. **Conversation state changes are conditional updates** (one handoff,
     one holding reply, one `whatsapp.handoff` event per chat).
- **Consequences:** a notification may arrive late (queue, retries) but is
  never lost silently and never sent for an action that was rolled back.
  n8n flows must verify the signature and dedupe on the event id. Live use
  waits for a WAHA instance, a dedicated number (sandbox first), n8n flows
  and an AI provider. Lead capture is an admin action ("Create lead" on a
  chat): CRM's `LeadService.captureFromChat` makes an unassigned
  `whatsapp` lead and the chat keeps a nullable `lead_id` link.
- **Alternatives considered:**
  - **Calling n8n inline from the service** — rejected: the effect could
    happen for a transaction that later rolls back, and an n8n outage would
    fail business actions.
  - **WhatsApp through n8n into the ERP** — rejected: one more hop for every
    chat message, and the signature/dedupe rules would live in a flow
    outside the code base.
  - **The official WhatsApp Business API** — not chosen by the owner for
    now (template approval); WAHA carries a number-ban risk, mitigated by a
    dedicated and a sandbox number.
