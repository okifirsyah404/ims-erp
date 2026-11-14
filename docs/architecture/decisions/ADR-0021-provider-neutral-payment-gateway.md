# ADR-0021 — Provider-Neutral Payment Gateway for Invoices

- **Status:** proposed (2026-11-14). Not accepted until the owner and the
  reviewer of ERP-0020 sign off. Renumbered 2026-11-15 from 0019: main took
  ADR-0018 / ADR-0019 in parallel (PR #101) and the customer portal record
  became ADR-0020; numbers are now checked against main, every remote branch
  and open PRs.
- **Context:** The owner wants online payment of invoices, with **Xendit or
  SingaPay** chosen later ("dinamis"). No sandbox account exists yet
  (2026-11-14). Customers pay **after staff confirmation**, so what is paid is
  an issued sales invoice. Receipts (kwitansi) are owned by Sales
  (`sales.receipts`). The money ledger `finance.payments` belongs to M09
  (programmer A) and is not wired to receipts yet, not even for manual
  receipts.
- **Decision:**
  1. **Sales owns online checkouts.** New table `sales.gateway_payments`:
     one row per hosted checkout of an invoice. Its id is the merchant
     reference sent to the provider (Xendit `external_id`, SingaPay
     `reff_no`), so a webhook finds its row without a tenant. Intra-module FKs
     to `sales.invoices` and `sales.receipts`. No cross-module reference
     except `requested_by` (auth user, logical).
  2. **Port and adapters.** `IPaymentGateway` (`createCheckout`,
     `parseWebhook`) in `sales/contracts`. The adapters live in
     `sales/adapters`: Xendit (Invoice API, `x-callback-token`), SingaPay
     (signed access token, Payment Link v2, HMAC-SHA512 webhook signature with
     a 5-minute window) and `fake` (local only, refused in production).
     `PAYMENT_GATEWAY_PROVIDER` picks where **new** checkouts open. Every
     provider with credentials keeps receiving webhooks, so a switch never
     strands a checkout that is already open.
  3. **Only a verified webhook changes state.** The redirect back from the
     checkout is never trusted. `POST /payments/gateway/:provider/webhook` is
     public; authenticity is the adapter's token or signature check (401
     otherwise). Once verified it always answers 200 with an outcome
     (`applied`, `unapplied`, `updated`, `duplicate`, `ignored`, `unknown`),
     so the provider stops retrying.
  4. **Exactly one receipt.** With the checkout row locked (`FOR UPDATE`), a
     paid event posts one receipt through the existing receipt write
     (`InvoiceRepository.addReceipt`, now able to join the caller's
     transaction). The receipt is capped at the invoice's outstanding amount,
     registered as a document (ERP-0044) and linked by `receipt_id` (partial
     unique index), all in that one transaction. Replays and concurrent
     deliveries find `receipt_id` and do nothing.
  5. **Money received is a fact.** A paid event on an expired or failed
     checkout still counts. If the invoice can no longer take it (void,
     already settled), the row is kept `paid` with no receipt and a
     `settlement_note`, and staff refund or apply it by hand. Refunds stay
     administrator-handled (v5.1).
  6. **Whole rupiah.** Gateways charge whole rupiah. The checkout amount is
     the outstanding amount rounded **up** to whole rupiah, and the receipt
     records at most what was owed. An excess of 1 rupiah or more is noted.
  7. **Opening a checkout is receiving a payment.** It takes the existing
     `receipt:create` permission; reading takes `invoice:read`. No catalog
     change. A pending checkout of the same provider and amount is reused
     while it stays open for at least 15 more minutes.
- **Consequences:**
  - The customer portal (ERP-0022 stage C) calls the same service to let a
    customer pay their own invoice. Nothing provider-specific leaks into it.
  - Gateway fees, gross/net settlement and reconciliation (T22), plus the
    `finance.payments` row behind each receipt, remain open. Both belong with
    M09.
  - The adapters follow the providers' public documentation
    (docs.xendit.co, docs.singapay.id, read 2026-11-14). Tests fake the HTTP.
    Two details are **unverified until a sandbox account exists**: the
    SingaPay `expired_at` format (ISO 8601 is sent), and whether SingaPay
    signs numbers in the body the way PHP serializes them.
