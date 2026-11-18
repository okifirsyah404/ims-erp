# payment - ERP-0081

Schema `payment` · folder `src/app/payment` · URL `/payments` · phase P5

## Current

Tables payments, payment_allocations, gateway_payments. Repositories
gateway-payment, payment. Controllers gateway-payment (`/payments/gateway`,
provider webhooks), payment-ledger. `ExportedPaymentService` exists. Gateway
credentials come from env. Consumers: web-admin `finance-api.ts` payment calls,
`invoice-api.ts` checkout link; web-customer-portal pay button.

## Target tables (Q18)

| Table | Notes |
|---|---|
| payments | ledger row; + `channel` (manual/gateway), `gateway_id` (FK -> gateways), provider columns from `gateway_payments` (provider_reference, payment_url, expires_at, paid_at, paid_amount, payment_channel, provider_transaction_id, last_event); status vocabulary = ledger statuses + gateway pending/expired/failed mapped explicitly; counterparty polymorph kept; `sales_invoice_id`/`supplier_bill_id`/`employee_advance_id` columns **removed** (allocations carry them) |
| payment_allocations | payment_id FK, `payable_type` (sale_invoice, supplier_bill, employee_advance, expense_claim, expense_settlement, employee_salary_record), `payable_id`, amount, allocated_at, deleted_at; one payment may settle several payables and one payable may receive several payments (staged settlement); `employee_salary_record` resolves through `ExportedEmployeeService` (human-resource, Q39) |
| gateways | provider (xendit/singapay/fake), code, name, is_active, is_default, mode (sandbox/live), `config` jsonb (non-secret), `secret_ciphertext`, `secret_iv`, `secret_tag`, `key_version`, `secret_last4`, `webhook_token_ciphertext` (+ iv/tag), rotated_at; secrets AES-256-GCM with `PAYMENT_SECRET_KEY` (env, never in DB); API never returns ciphertext or plaintext |
| settings | default gateway, rounding rules |
| code_numberings | payment codes |

## Steps

1. **dbml** - rewrite section; document the payable vocabulary and the
   encryption rule.
2. **Drizzle** - `payment.schema.ts`.
3. **Repositories** - payment, payment-allocation, gateway, setting,
   code-numbering.
4. **Services** - `PaymentService` (create/approve/execute, allocate),
   `GatewayCheckoutService` (provider adapters under `adapters/`, chosen per
   `gateways` row), `GatewayConfigService` (encrypt/rotate, write-only),
   payable resolver map -> `ExportedInvoiceService`, `ExportedFinanceService`.
   Settlement of a paid checkout: lock the payment row, allocate to the
   invoice, call sale to post the receipt (unchanged idempotency rule).
5. **Controllers** - `/payments`, `/payments/allocations`,
   `/admin/payments/gateways` (write-only secrets), `/payments/checkouts`.
   Provider webhooks leave this module: publish
   `ExportedPaymentWebhookService.handle(provider, headers, rawBody)` (token
   check against `gateways`, idempotent settlement) and let the `webhook`
   module own `/webhooks/<provider>` and the old-path alias (Q38,
   `modules/webhook.md`).
6. **Consumers** - web-admin payment screens (allocation editor for staged
   settlement), gateway settings page (new), invoice checkout link;
   web-customer-portal checkout call.

## Exit

Webhook replay idempotency, staged settlement (two payments -> one invoice,
one payment -> two invoices) and secret-never-returned tests green.
