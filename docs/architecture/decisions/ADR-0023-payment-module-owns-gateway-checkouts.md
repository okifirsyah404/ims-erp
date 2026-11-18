# ADR-0023 — Payment Module Owns Gateway Checkouts

- **Status:** accepted (2026-11-18)
- **Supersedes:** the storage decision in [ADR-0021](ADR-0021-provider-neutral-payment-gateway.md) §1
- **Related:** ADR-0014 (nullable cross-module references), ERP-0020

## Context

ADR-0021 put online invoice checkout in the Sales module:
`sales.gateway_payments`, the `GatewayPaymentService`, the provider adapters
and the webhook controller. That was defensible while the gateway only served
one use case (pay a sales invoice), but it left the ERP without a `payment`
module even though `docs/architecture/modules/payment.md` and the M09 plan
describe one, and it put a provider integration (Xendit / SingaPay secrets,
signature verification, webhook replay handling) inside Sales' schema and DI
container.

The next payment work — gateway fees, gross/net settlement, the
`finance.payments` row behind each receipt, and a portal pay button — would
otherwise grow a second, unrelated concern inside Sales.

## Decision

1. **A `payment` module owns `payment.gateway_payments`.** The schema, the
   repository, the provider port and adapters, the webhook controller and the
   checkout controller all move there (`apps/backend/src/app/payment/`,
   `apps/backend/drizzle/schemas/payment.schema.ts`).
2. **Sales keeps invoices and receipts.** `sales.invoices` and
   `sales.receipts` are unchanged; the receipt (kwitansi) a paid checkout
   produces is still Sales' row.
3. **Cross-module references become logical and nullable** (ADR-0014):
   `payment.gateway_payments.sales_invoice_id` and `.receipt_id` lose their
   foreign keys, so the table has no FK to another schema. Presence is checked
   by Sales' contract before the write.
4. **Payment reaches Sales through one port.** `IInvoicePaymentPort`
   (`apps/backend/src/app/sales/contracts/invoice-payment.port.ts`, token
   `INVOICE_PAYMENT_PORT_TOKEN`) resolves an invoice, records a receipt with
   the outstanding cap, and publishes `receipt.recorded`. Payment never injects
   Sales' repository, and Sales keeps the event shape it owns.
5. **No data migration.** `sales.gateway_payments` had not reached `main` when
   this landed (it existed only on `feat/m02-payment-gateway`), so the migration
   is regenerated rather than copied: one step creates `payment` and its table.

## Consequences

- `payment` is module 28 in `docs/database/module-ownership.md`; it is a
  single-schema module like every other one.
- The gateway API paths stay the same (`/gateway-payments/status`,
  `/invoices/:id/gateway-payments`, `/payments/gateway/:provider/webhook`), so
  the web admin needs no change. `PaymentGatewayController` now declares its own
  `:id` param schema instead of importing Sales' contract.
- The payment service no longer injects the outbox: publishing
  `receipt.recorded` is Sales' business, done by the port after the payment
  transaction commits.
- Still open (unchanged): provider sandbox, gateway fee/settlement
  reconciliation, the `finance.payments` row behind a receipt (M09), and the
  portal pay button.
- **Deleting a module** would now include removing `payment` from `docs.dbml`,
  its schema file, container registration and mount.
