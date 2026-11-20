> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# UAT — M02 CRM and Sales

Scope: customers, leads, quotation (SPH) with approval and revisions, sales
order, invoice / down payment / receipt. User guide sections 4–5.
Plan acceptance: U01–U20 (CRM/SPH/invoice) and U21–U32 (gateway), see
[README](README.md).

> **Known issue before the run (found 2026-11-12, pre-existing on `main`):**
> the web billing card and invoice page call `GET /invoices/orders/:id/summary`,
> `POST /invoices` with a `term`, and `POST /invoices/:id/void`; the backend
> on `main` (Sales invoice controller since the PR #68 merge) has no summary
> or void route, and its create takes explicit items, so cases M02-09…11 are
> expected to fail until the web and the API are realigned. Run them anyway
> and record what happens. The backend only cancels **draft** invoices; an
> overpayment is refused (`sales.receiptExceeds`).

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M02-01 | Create customer with contact | | |
| UAT-M02-02 | Lead from the website form | | |
| UAT-M02-03 | Quotation draft with lines, VAT and terms | | |
| UAT-M02-04 | No self-approval; reject with reason | | |
| UAT-M02-05 | Approve, print, mark as sent | | |
| UAT-M02-06 | Revision -R1 keeps history | | |
| UAT-M02-07 | Lost quotation | | |
| UAT-M02-08 | Deal → sales order; cancel reopens quotation | | |
| UAT-M02-09 | DP invoice → partial payment → paid | | |
| UAT-M02-10 | Settlement invoice; billing totals | | |
| UAT-M02-11 | Reverse a receipt, overpayment, void / cancel invoice | | |
| UAT-M02-12 | Sales sees only own quotations | | |
| UAT-M02-13 | Payment gateway: replayed / bad-signature callback | N/T | |

---

### UAT-M02-01 Create customer with contact
- **Role:** sales
- **Steps:** 1. CRM → Customers → New customer. 2. Fill name, phone
  (WhatsApp), email, address down to village. 3. Save. 4. Add a contact
  person and mark it primary.
- **Expected:** customer gets a code; the address shows province → village;
  the contact has the primary badge. Saving with an invalid email is refused
  by the form.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-02 Lead from the website form
- **Role:** sales manager (website side: a developer or `curl` with the
  website API key)
- **Steps:** 1. Submit an RFQ / contact form from the website (or the public
  website API). 2. Open CRM → Leads.
- **Expected:** a lead with source *website*, the requested needs, no
  owner; the sales manager can assign it to a sales user; a follow-up can be
  added. Without the API key the website call is refused (401).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-03 Quotation draft with lines, VAT and terms
- **Role:** sales · **Needs:** M02-01, two items
- **Steps:** 1. Sales → Quotations → New quotation. 2. Customer, subject.
  3. One item line (price fills in) with a 10% line discount and one free
  line. 4. VAT on; terms DP 30 / ready to ship 40 / installed 30. 5. Save.
  6. Change the terms to 30/40/20 and save.
- **Expected:** step 5 → **Draft**, totals = Σ(qty × price − discount) +
  11% VAT (check by hand). Step 6 is refused: the terms must total 100%.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-04 No self-approval; reject with reason
- **Role:** sales manager (author) + admin · **Needs:** a draft by the sales manager
- **Steps:** 1. Author: Submit for approval. 2. Author tries Approve.
  3. Admin: Reject with a reason.
- **Expected:** step 2 refused (no Approve button or a server error — never
  approved). Step 3 → **Rejected**, the reason is visible on the quotation.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-05 Approve, print, mark as sent
- **Role:** sales + sales manager · **Needs:** M02-03
- **Steps:** 1. Sales: Submit. 2. Sales manager: Approve. 3. Print.
  4. Mark as sent.
- **Expected:** **Waiting for approval → Approved → Sent**; the print
  matches the company SPH layout (logo, signature, item photos, totals, VAT,
  terms, bank account). An approved quotation cannot be edited.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-06 Revision -R1 keeps history
- **Role:** sales · **Needs:** M02-05
- **Steps:** 1. Open the sent quotation → Make a revision. 2. Change a price,
  save, submit, approve (other user), mark as sent.
- **Expected:** new quotation `<number>-R1` as **Draft**; the original
  becomes **Revised** and offers no actions; both stay in the list.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-07 Lost quotation
- **Role:** sales · **Needs:** another sent quotation
- **Steps:** Mark as lost with a reason.
- **Expected:** **Lost** with the reason; no sales order can be created
  from it.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-08 Deal → sales order; cancel reopens quotation
- **Role:** sales manager · **Needs:** M02-06 (R1 sent)
- **Steps:** 1. Create sales order (customer PO number, dates). 2. Cancel
  the order. 3. Create the sales order again.
- **Expected:** step 1 → quotation **Deal**, order **Active** with the same
  lines and totals; step 2 → quotation back to Sent; step 3 works. An order
  with an invoice, delivery note or project cannot be cancelled.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-09 DP invoice → partial payment → paid
- **Role:** finance · **Needs:** M02-08
- **Steps:** 1. Order → Billing → Create invoice → next planned term (DP
  30%). 2. Issue invoice; print. 3. Record payment of half the DP.
  4. Record the rest.
- **Expected:** draft has no number; issued gets a number; amount = 30% of
  the order total. After step 3 **Partly paid**, after step 4 **Paid**; each
  payment has a numbered receipt; the DP appears under Down Payments.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-10 Settlement invoice; billing totals
- **Role:** finance · **Needs:** M02-09
- **Steps:** Bill the remaining terms (one by amount, the last as the rest).
- **Expected:** the Billing card shows invoiced = order total, not yet
  invoiced = 0; an invoice above the remaining amount is refused; revenue
  is never billed twice (Σ invoices = order total).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-11 Reverse a receipt, void an invoice
- **Role:** finance · **Needs:** M02-10
- **Steps:** 1. Reverse one receipt with a reason. 2. Record a payment
  larger than the outstanding amount. 3. Void an unpaid issued invoice with a
  reason. 4. Cancel a draft invoice.
- **Expected:** the reversed receipt stays listed as **Reversed** and the
  invoice outstanding goes back up; step 2 refused; step 3 shows the reason
  (see the known issue above); step 4 → cancelled. Nothing disappears from
  the lists.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-12 Sales sees only own quotations
- **Role:** two sales users (create a second one if needed) + sales manager
- **Steps:** Each sales user creates a quotation; open the list as each user
  and as the sales manager; as sales A, open sales B's quotation URL directly.
- **Expected:** each sales user sees only their own; the manager sees both;
  the direct URL is refused (not found / forbidden).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M02-13 Payment gateway: replayed / bad-signature callback, DP then final
- **Status:** **N/T** — payment gateway and checkout (T21/T22, ERP-0020) are
  not built. When built: a replayed callback must not create a second
  payment, a bad-signature callback is rejected, DP then final records
  revenue once.

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
