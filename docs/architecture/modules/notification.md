> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Notification Module

## Purpose and boundary

All outbound communications: OTP/magic-link delivery (replacing the console
loggers in auth options), operational notifications, and later WhatsApp AI
flows + notifications/handoff (v5.1 M04 stage 2; tasks T27–T28). Owns
delivery adapters and delivery logs/retries; does **not** decide business
content beyond approved templates/knowledge.

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/notification/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.
- Related-but-external: BullMQ is configured (bootstrap) — delivery retries
  should use queues, not ad-hoc timers.

## Data ownership (planned)

- `erp.notifications` (or delivery log) — channel (email/wa/system), target,
  template id, payload refs (no secrets), status, attempts, last error,
  timestamps. Delivery failures are logged and followed up manually per S05.

## Behavior targets

- Stage 1 (T15): basic notifications for ERP events (one event to n8n with
  logging/manual trigger per v5.1 M04).
- Stage 2 (T27–T28): **one** WhatsApp number + **one** AI provider (limits);
  FAQ/catalog-based answers only; record leads; hand off to administrator;
  failures logged with manual retry. AI cannot grant discounts or perform
  financial transactions (hard limit; prompt-injection tests required).
- Auth OTP senders route here (sandbox/mock until provider approval —
  condition gate from v5.1).

## Dependencies and rules

- Consumers: authentication (OTP/magic link), sales/payment (status
  notifications), licensing (expiry/suspension notices). Consumes customer
  contact data via contracts. Sandbox/mock adapters until credentials exist;
  never send live messages without owner approval.

## Tests

- Existing stub specs to replace.
- Required: template/knowledge gating tests (unapproved content cannot send),
  retry/idempotency on delivery, injection-resistance tests for AI answers,
  redaction of personal data in logs.
