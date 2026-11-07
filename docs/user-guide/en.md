# User Guide — Sales, Procurement, Warehouse, Projects

Version: 2026-11-06 · applies to branch `merge/main-sync` (ADR-0011 port,
not yet merged into `main`). Bahasa Indonesia: [id.md](id.md). Flow
diagrams (UML): [diagrams.md](diagrams.md).

This guide explains how to use modules M02 (CRM & Sales), M05 (Procurement
& Warehouse) and M07 (Projects & After-sales) in the web admin. The
**Notes** section at the end lists the important rules and the known
limitations. Screen names are given as shown in English; the Indonesian
interface uses the names in [id.md](id.md).

## Contents

1. [Getting started](#1-getting-started)
2. [Roles and access](#2-roles-and-access)
3. [First-time setup](#3-first-time-setup)
4. [Sales: quotation → revision → Deal → sales order](#4-sales-quotation--revision--deal--sales-order)
5. [Billing: invoices, down payments, receipts](#5-billing-invoices-down-payments-receipts)
6. [Procurement: PO → goods receipt → stock](#6-procurement-po--goods-receipt--stock)
7. [Warehouse: stock, opening stock, inventory value, delivery notes](#7-warehouse-stock-opening-stock-inventory-value-delivery-notes)
8. [Projects, BAST, warranty, service tickets](#8-projects-bast-warranty-service-tickets)
9. [Printed documents and numbering](#9-printed-documents-and-numbering)
10. [Notes](#10-notes)

The whole flow at a glance:
[end-to-end diagram](diagrams.md#1-end-to-end-flow-activity).

## 1. Getting started

1. From the repository root run `bun run dev` (backend on
   `http://localhost:3000`, web admin on `http://localhost:5173`).
2. Open `http://localhost:5173` and sign in.
   - Admin/owner: email and password from `apps/backend/.env`
     (`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`).
   - Sample accounts per role (development database only):
     `<role>.seed@entragate.local` with password `<role>123456`, e.g.
     `sales.seed@entragate.local` / `sales123456`.
3. The interface language can be switched (Indonesian / English); printed
   documents are always in Indonesian.

## 2. Roles and access

Menus and buttons follow the role's permissions. The real check runs on the
server, so a visible button can still be refused.

| Role | Main work |
|---|---|
| Owner / admin | Everything; approves quotations, POs, stock adjustments; master data; settings |
| Sales | Customers, leads, quotations (create, submit, send, revise) |
| Sales manager | Approves quotations, sees every quotation and order |
| Finance | Invoices, down payments, receipts; sees unit cost and project costs |
| Purchasing | Suppliers, POs; sees unit cost |
| Warehouse | Goods receipts, delivery notes, stock; does **not** see unit cost |
| Project manager | Projects, tasks, costs, BAST, warranty, tickets |
| Technician | Only the projects/tickets assigned to them; no costs |
| Customer service | Service tickets (open, assign, close) |

General rule: **nobody approves their own document** (quotations, POs,
stock adjustments).

## 3. First-time setup

Done once by the admin/owner.

1. **Settings → Company profile**: legal name, address, phone, email, logo,
   signature, signatory name and title, bank accounts (VAT and non-VAT),
   default quotation/invoice terms, warranty texts (coverage, exclusions,
   service terms). Every printed document uses this data.
2. **Settings → Document numbering**: check the number pattern of each
   document (see [section 9](#9-printed-documents-and-numbering)).
3. **Master data**:
   - **CRM → Customers** (the customer code appears in the warranty number).
   - **Inventory → Items**: SKU, name, kind, unit, category, selling price,
     photo for quotations, tick *serialized* when every unit has a serial.
   - **Procurement → Suppliers** (bank details only for allowed roles).
   - **Inventory → Warehouses** and storages (application admin only).
4. **Opening stock** when goods are already in the warehouse: see
   [section 7.2](#72-opening-stock-and-adjustments).

## 4. Sales: quotation → revision → Deal → sales order

Menu **Sales**. Diagrams:
[quotation states](diagrams.md#sph-quotation),
[sales sequence](diagrams.md#2-sales-quotation-to-cash-sequence).

### 4.1 Create a quotation (SPH)

1. **Sales → Quotations → New quotation**.
2. Pick the customer (contact/attention optional), the subject, and a print
   heading if needed (empty = "QUOTATION").
3. Add lines: pick an item (name, unit, price and photo fill in) or a free
   line (name, unit and price typed in). Per-line discounts are allowed.
4. Set VAT on/off, validity, payment method and the planned terms (e.g. DP
   30% / ready to ship 40% / installed 30% — must total 100%), guarantee,
   terms.
5. **Save** → status **Draft**. A draft can be edited.

### 4.2 Approval and sending

1. The author presses **Submit for approval** → **Waiting for approval**.
2. Another approver presses **Approve** (→ **Approved**) or **Reject**
   (→ **Rejected**, with a reason).
3. **Print** the quotation (the company's sample layout), send it, then
   **Mark as sent** → **Sent**.

### 4.3 Revise a quotation

When the customer asks for different prices or items after the quotation
was submitted, approved, rejected, sent or lost:

1. Open it → **Make a revision**.
2. A new quotation with the same number plus **-R1** (then -R2, -R3 …) is
   created as a **Draft**, copying the old one.
3. The old one becomes **Revised** and can no longer be used; its history
   stays.
4. Edit the revision, then **Submit → Approve → Print → Mark as sent**
   again.

A draft is not revised (just edit it). A dead quotation: **Mark as lost**
with a reason → **Lost**.

### 4.4 Deal → sales order

1. On an **Approved** or **Sent** quotation press **Create sales order**
   (customer PO number if any, order date, planned delivery).
2. The quotation becomes **Deal**; the order is **Active** with a copy of
   the customer, lines and amounts.
3. Cancelling the order (only without invoices, delivery notes or a
   project) reopens the quotation as Sent/Approved.

## 5. Billing: invoices, down payments, receipts

Diagram: [invoice states](diagrams.md#sales-order-and-invoice).

1. Open the **sales order** → **Billing** card (invoiced, paid, outstanding,
   not yet invoiced).
2. **Create invoice** → choose what to bill:
   - the next planned term (e.g. DP 30%),
   - a percentage of the order, or
   - an amount.
   It becomes a **Draft** (no number yet). The first term is the down
   payment; the one that settles the order is the settlement.
3. **Issue invoice** → numbered → **Print** (the sample invoice layout).
4. Payments: open the invoice → **Record payment** (date, method,
   reference, amount) → a numbered receipt. The invoice becomes **Partly
   paid**, then **Paid**.
5. Corrections: a wrong receipt is **Reversed** (never deleted); an unpaid
   invoice can be **Voided** with a reason.

**Sales → Invoices / Down Payments / Receipts** list all of them.

## 6. Procurement: PO → goods receipt → stock

Menu **Procurement**. Diagrams:
[PO states](diagrams.md#purchase-order-and-stock-adjustment),
[purchasing sequence](diagrams.md#3-purchasing-to-stock-sequence).

### 6.1 Purchase order

1. **Procurement → Purchase Orders → New purchase order**.
2. Pick the supplier, the category (Hardware/Software/Service/Other — part
   of the PO number), the VAT mode (**none**, **prices include VAT**,
   **VAT added**), the supplier's quotation reference, project, terms.
3. Add item lines, quantities, prices → **Save** (Draft).
4. **Submit for approval** → another approver **Approves** (the PO gets its
   number) or **Rejects** (back to Draft with the reason).
5. **Print** (the sample PO layout) → send to the supplier → **Mark as
   sent**.
6. A PO can be **cancelled** while nothing has been received.

### 6.2 Goods receipt (BPB)

By the warehouse when goods arrive:

1. On the PO press **Receive goods** (or **Procurement → Goods Receipts →
   Receive goods** and pick the PO).
2. Pick the warehouse (storage optional), the receipt date, the supplier's
   delivery note number.
3. Enter what arrived per line (partial is fine, never more than is open).
   Serialized items: **one serial number per unit** (comma or new line).
4. **Post receipt**. At once:
   - stock goes up in that warehouse;
   - unit cost = PO price **without VAT**; the moving-average cost is
     recomputed;
   - each serial becomes an **in stock** unit;
   - the PO becomes **Partly received** or **Received**.
5. A receipt cannot be edited; corrections go through stock adjustments.

## 7. Warehouse: stock, opening stock, inventory value, delivery notes

### 7.1 Viewing stock

- **Inventory → Stock**: quantity per item, warehouse and storage.
- **Inventory → Items → Item Movements** (or **Movements** on the Stock
  page): the movement history (receipts, issues, adjustments).
- **Inventory → Inventory Value**: average cost and value per item and
  warehouse, per-warehouse and grand totals (only roles allowed to see unit
  cost).

### 7.2 Opening stock and adjustments

1. **Inventory → Stock → Adjust stock**.
2. Pick the warehouse, the type (**Increase** for opening stock,
   **Decrease**, or **Recount**), the reason (`opening_stock` / "Opening
   stock" for opening stock).
3. Per line: item, the counted quantity (the total, not the difference),
   and the **unit cost** for increases (empty = moving average).
4. **Create adjustment** → **Submit for approval** → approved by someone
   else (**Approve**) → **Post to stock** (stock moves only now).

### 7.3 Delivery notes (shipping to the customer)

Diagram: [delivery note sequence](diagrams.md#4-delivery-note-sequence).

1. On the sales order press **Create delivery note** (or **Sales → Delivery
   Notes → New delivery note**).
2. Pick the warehouse, date, the recipient (prefilled from the order: name,
   address, PIC, phone), driver, vehicle number, notes (default: the
   warranty sentence).
3. Enter quantities per line (partial is fine). Serialized items: tick the
   serials in stock in that warehouse.
4. **Prepare delivery note** → numbered (SJ) → **Print** for the driver.
5. **Ship**: stock goes out at the moving-average cost, serialized units
   become **sold** to the customer, the order becomes **In progress**. This
   cannot be undone.
6. When received: **Mark delivered** (receiver's name).
7. A note that is still *prepared* can be **cancelled**; its quantities go
   back to the order.

## 8. Projects, BAST, warranty, service tickets

Menu **Projects**. Diagram:
[project, BAST, ticket states](diagrams.md#delivery-note-project-bast-ticket).

### 8.1 Projects

1. **Projects → New project** → search and pick the deal (sales order), the
   PIC, location, target start/end. One deal has one live project.
2. The default checklist is created: survey, delivery, installation,
   function test, training, BAST.
3. Assign each task. Technicians only see the projects they work on and
   only move their own tasks.
4. **Evidence**: upload photos/PDFs (max 15 MB) as function test, training,
   signed BAST, photo, other.
5. **Direct costs** (PM/finance only): category, date, amount, description,
   receipt photo. Shown with the materials already shipped (delivery-note
   cost), the total cost and the margin against the contract value.
6. **Close project** only once function-test, training and signed-BAST
   evidence exist → stage **Warranty**. **Cancel project** (with a reason)
   frees the deal for a new project.

### 8.2 BAST (handover certificate)

1. On the project page, **Hand-over documents** card → **New BAST**.
2. Prefilled from the deal: contract number (= customer PO), first party
   (customer), second party (the company, the PIC as Project Manager), items
   with "Telah selesai terpasang dan berfungsi dengan baik", the work scope.
   Everything can be changed.
3. **Issue BAST** → numbered → print (the date is written in words).
4. A project may have **several BASTs** (e.g. one per contract). A BAST can
   be edited or cancelled while the project is active.
5. **Projects → BAST (Handover)** lists every BAST.

### 8.3 Warranty certificate

1. In the **Hand-over documents** card → **Issue warranty** (needs at least
   one BAST).
2. Pick the BAST the warranty starts at, the letter date, the period
   (months, default 12). Devices are prefilled from the shipped delivery
   notes with their serials; the terms come from the company profile.
3. Term text format: one item per line; a line starting with `o ` is a
   sub-item; `**text**` prints bold.
4. **Save and print**. Period: from the BAST date to the day before the same
   date N months later (2025-12-24 + 12 months → 2026-12-23). One
   certificate per project; it can still be edited after the project is
   closed.

### 8.4 Service tickets

1. **Projects → Tickets & Warranty → New ticket**.
2. Type the **serial number** first: customer, project, device and the
   **Under warranty / Out of warranty** label fill in from the delivery
   notes and the warranty certificate.
3. Enter the reporter, contact, channel (WhatsApp, phone, …), complaint →
   **Open ticket**. The warranty check is stored on the ticket.
4. Customer service/PM picks the **Technician**. The technician: **Start
   work** → **Resolve** (resolution, service cost) — can **Reopen**.
5. **Close ticket** only with the customer's confirmation (name and
   channel).

### 8.5 Licenses and subscriptions (M03)

1. **Subscription & Licensing → Applications**: register each application
   you license — a **third-party** product (the vendor issues the key) or
   the company's **own application** (the ERP generates the key).
2. Sell it through the normal flow (SPH → Deal → sales order → invoice).
3. **Subscription & Licensing → New contract**: customer, application,
   package, the sales order (optional), start and end date (empty end =
   perpetual), billing cycle and value → **Save draft**.
4. On the contract: **Add key** (type the vendor's key; for an own
   application leave it empty to generate one), then **Activate**.
5. **Due for renewal (30 days)** on the list shows active contracts that end
   soon or have ended; the dashboard shows the same counts.
6. To renew: **Create SPH** for the customer and bill it as usual, then
   **Renew** on the contract (a draft for the next period with the same
   terms) and **Activate** it — the old contract becomes **Renewed**.
7. **Suspend / Reactivate**, **Terminate** (with a reason) and **Revoke** a
   key (with a reason) as needed. Finance sees keys masked (last 4
   characters).
8. **Own application (license API)**: under **API Keys** create a key for
   the application (copy it at once — it is shown only once) and give it to
   the application's developer with the integration note
   (`docs/architecture/modules/licensing-subscription.md`). The application
   activates each installation (a seat), validates on start-up, and keeps
   working for **7 days after the end date** with a warning, then stops.
   Seats and every call appear on the contract and under **Validation &
   Activation**; a seat can be **Released** (for example a replaced PC).
9. **Renewal paid**: link the new sales order to the draft renewal. Once
   finance records full payment, the draft activates by itself and the keys
   continue on the new period.

### 8.6 Employees, attendance, leave and pay (M08)

1. **HR & Attendance → Employees → New employee**: name, position, NIK,
   hire date, contact and base salary (HR / finance / owner only). The code
   `EMP-####` is given by the system. On the employee page add the salary
   **bank account**; an employee who leaves is **Marked as left** (history
   stays). Other roles see NIK and account numbers partly hidden and no
   salary.
2. **Attendance**: pick the date, set each employee's status (present,
   permit, sick, leave, absent, holiday) and optional in / out times, then
   **Save day** ("Mark empty rows present" speeds this up). Or **Import**:
   download the template, fill it in Excel, upload it. If any row is wrong
   nothing is imported and the wrong rows are listed. **Monthly recap**
   counts the statuses per employee.
3. **Leave**: HR **records leave** for an employee (type, from, until);
   Sundays are not counted and annual leave cannot go over the 12 days a
   year (waiting requests count too). Someone other than the recorder
   (manager / owner) **Approves** or **Rejects**; approved days appear in the
   attendance automatically. **Cancel** gives the days back.
4. **Overtime**: HR records the date and hours; someone else approves.
   Approved hours show next to the employee in the salary summary.
5. **Tasks**: simple tasks for an employee with a due date; mark them
   **Done** or **Cancel**.
6. **Payroll (salary summary)**: pick the month, **Fill from base
   salaries**, then edit rows (allowances, overtime pay, bonus, deductions;
   net pay is computed) or **Import** a sheet. The owner **Approves the
   month**, which locks it. There is no automatic payroll calculation,
   payslip or journal yet (stage 2 needs the payroll rules from finance).

## 9. Printed documents and numbering

| Document | Example number | Numbered when | Print |
|---|---|---|---|
| Quotation (SPH) | `0001/QT/IMS/XI/26` (revision `-R1`) | created | sample SPH layout |
| Sales order | `0001/SO/IMS/XI/26` | created | — |
| Invoice | `0001/INV/IMS/XI/26` | issued | sample invoice layout |
| Receipt (kuitansi) | `0001/KW/IMS/XI/26` | recorded | no sample yet |
| Purchase order | `PO/IMS-HIT/HW/1126/001` | approved | sample PO layout |
| Goods receipt | `0001/BPB/IMS/XI/26` | posted | — |
| Delivery note | `0001/SJ/IMS/XI/26` | prepared | sample delivery note (Letter) |
| Project | `0001/PRJ/IMS/XI/26` | created | — |
| BAST | `001/BAST/IMS/XII/2025` | issued | sample BAST (Letter) |
| Warranty certificate | `001/SG-GARANSI/IMS-APP/2025` | first saved | sample warranty (Letter) |
| Service ticket | `0001/TKT/IMS/XI/26` | opened | — |

Print with the **Print** button on the document page, then the browser's
print / save-as-PDF. Patterns are set in **Settings → Document numbering**.

## 10. Notes

### Important rules

- **Nothing is deleted.** Wrong documents are cancelled/voided with a
  reason; history stays.
- **Approval by someone else**: quotations, POs and stock adjustments
  cannot be approved by their author.
- **Company-wide data**: customers, quotations, orders, invoices, POs and
  projects belong to the one company (not to a department).
- **Unit cost (HPP)** is a moving average: receipts enter at the PO price
  without VAT, deliveries and decreases leave at the average. Only owner,
  finance and purchasing (`product:read_cost`) see it.
- **Money** is stored as exact rupiah amounts; **business dates** are in
  WIB (Asia/Jakarta).
- **Printed documents** are always Indonesian and follow the company's
  samples; the delivery-note and BAST numbers are added under the title
  because the original samples have no number line.

### Required order

- A sales order only from an **Approved/Sent** quotation.
- Invoices and delivery notes from a sales order (Active/In progress).
- Goods receipts only for **Sent/Partly received** POs.
- A warranty certificate needs a BAST; a service ticket needs an active
  customer.
- A sales order cannot be cancelled once it has invoices, delivery notes or
  a project — cancel those first.

### Known limitations (2026-11-06)

- All of this lives on branch `merge/main-sync`, **not yet merged into
  main** and not yet formally accepted by the owner.
- The **stock adjustment** form loads the application-admin-only warehouse
  list, so the warehouse and purchasing roles cannot raise adjustments or
  opening stock from the screen yet (reported to programmer A). Meanwhile:
  use the admin account.
- Seeded sample balances have no unit cost (valued at Rp0) until opening
  stock is entered.
- Not available yet: receipt (kuitansi) print (no sample), accounting
  journals (M09), supplier payables, sales/purchase returns, ticket SLA.
- The network topology page of the warranty sample is not built into the
  system (owner decision 2026-11-06).
