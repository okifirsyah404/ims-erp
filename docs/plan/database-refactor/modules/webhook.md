# webhook - ERP-0089

Schema **none** (Q38) · folder `src/app/webhook` · URL `/webhooks/<provider>` ·
phase P7 (after payment and automation)

## Why a module without a database

Inbound calls from external providers share concerns that are not business
logic: raw-body capture for signature checks, fast 2xx acknowledgement,
replay-safe responses, request logging, rate limiting and old-URL aliases
(Q34). Keeping them in one module stops every business module from growing its
own HTTP edge for providers. The module owns **no table** and no repository; all
state and all decisions stay in the owning module.

## Current

- Payment gateway webhooks in `payment/controllers/gateway-payment.controller.ts`
  (`/payments/gateway/*`, Xendit + SingaPay, token/signature check, settles a
  checkout).
- WhatsApp inbound in `automation/controllers/whatsapp-webhook.controller.ts`
  (`/integrations/whatsapp`, WAHA / Meta).
- No consumer in the three frontends; callers are external (provider
  dashboards, WAHA, n8n).

## Target

| Route | Hands off to | Owning module behaviour |
|---|---|---|
| `POST /webhooks/xendit` | `ExportedPaymentWebhookService.handle('xendit', headers, rawBody)` | payment verifies the callback token against `payment.gateways` (decrypted inside payment), maps the event, settles idempotently |
| `POST /webhooks/singapay` | `ExportedPaymentWebhookService.handle('singapay', ...)` | same |
| `POST /webhooks/whatsapp` (+ `GET` verify challenge for Meta) | `ExportedWhatsappWebhookService.handle(provider, headers, rawBody)` | automation verifies, dedupes on `(direction, external_id)`, runs the assistant |
| old paths (`/payments/gateway/*`, `/integrations/whatsapp/*`) | same handlers | alias, deprecated, logged (Q34) |

Rules:
- The `webhook` module never decrypts secrets, never reads a table and never
  decides a business outcome; it passes headers + raw body and maps the
  returned result (`accepted | duplicate | rejected`) to HTTP (200 / 200 / 401
  or 400).
- The exported webhook services are thin facades over each module's own
  service. They are allowed to call full services because `webhook` is a leaf
  (nothing depends on it), so no cycle can form.
- Signature verification stays in the owning module because the secret lives
  there (payment gateways, automation provider config).

## Steps

1. **dbml** - nothing (no schema); mention the module in the project note's
   module list as "no persistence".
2. **Drizzle** - nothing.
3. **Repositories** - none.
4. **Services** - in **payment**: `ExportedPaymentWebhookService`
   (`handle(provider, headers, rawBody)`); in **automation**:
   `ExportedWhatsappWebhookService`. `webhook` gets a `WebhookService` that
   selects the target by provider and wraps logging / timing.
5. **Controllers** - `webhook/controllers/webhook.controller.ts` with
   `domainPlugin({ name: 'webhook', prefix: '/webhooks', guards: 'none' })`,
   raw-body parsing, plus the alias mounts. Remove the webhook routes from
   `gateway-payment.controller.ts` and `whatsapp-webhook.controller.ts`.
   `container.ts` + `index.ts` (`webhookModule()`) like any module.
6. **Consumers** - none in-repo. Cutover checklist (`99-cutover.md`): update
   the Xendit / SingaPay dashboard URLs, the WAHA webhook and the Meta app
   callback.

## Exit

Tests: valid callback accepted, bad token 401, replay returns 200 without a
second settlement, WhatsApp duplicate ignored, old and new URLs behave the
same; `webhook` imports no `@drizzle/schemas/*`.
