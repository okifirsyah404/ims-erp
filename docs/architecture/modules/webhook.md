# Webhook Module

> Created 2026-11-20 (ADR-0024 Q38). Split out of the payment and automation
> modules, which used to expose their own provider callback URLs.

Code: `apps/backend/src/app/webhook`. **No schema and no tables.**
Profile: `docs/database/module-ownership.md` ("Not a schema: webhook").

## Purpose and boundary

The single inbound HTTP edge for external providers. It captures the raw body
(`parse: 'text'`, because Xendit, SingaPay and WAHA sign exactly what they
sent), picks the provider and hands the delivery to the owning module. It
verifies nothing itself and stores nothing.

## HTTP

`POST /webhooks/:provider` with `provider` in `xendit`, `singapay`,
`whatsapp`. Public: no session; authenticity is the owner's signature or token
check. One URL per provider, no aliases (nothing is deployed, ADR-0024 Q34).
Replaces `/payments/gateway/*` and `/integrations/whatsapp/webhook`.

| Outcome | HTTP | Meaning |
|---|---|---|
| `accepted` | 200 | verified and applied |
| `duplicate` | 200 | replay, acknowledged without a second effect |
| `ignored` | 200 | authentic event this deployment does not handle |
| `rejected` | 401 | bad signature or token |
| unknown provider | 404 | not in the provider list |

## Contract (consumed, not exported)

- `ExportedPaymentWebhookService` (`payment`): `xendit`, `singapay`.
- `ExportedWhatsappWebhookService` (`automation`): `whatsapp`.

## Permissions

None (public endpoint). Secrets stay with the owners: gateway secrets in
`payment.gateways` (sealed with `PAYMENT_SECRET_KEY`); the WhatsApp check is in
`automation`.

## Key rules

- Adding a provider means a new entry in `WEBHOOK_PROVIDERS`, a handler in
  `WebhookService` and an exported webhook service on the owning module.
- Idempotency is the owner's job: a replay is reported as `duplicate`.
