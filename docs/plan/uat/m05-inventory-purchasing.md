> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# UAT — M05 Inventory and Purchasing

Scope: suppliers, purchase orders with approval, goods receipts (partial and
full, serials), stock, opening stock and adjustments, inventory value,
delivery notes. User guide sections 6–7.
Plan acceptance: PO with partial and full receipt (balance and payable
correct), an issue larger than the stock rejected, a serial captured on
receipt traceable to the issue (see [README](README.md)).

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M05-01 | Supplier; bank details hidden from other roles | | |
| UAT-M05-02 | PO draft, no self-approval, approve, print, send | | |
| UAT-M05-03 | Partial goods receipt with serials | | |
| UAT-M05-04 | Full receipt; over-receipt refused | | |
| UAT-M05-05 | Stock, moving-average cost, inventory value | | |
| UAT-M05-06 | Warehouse does not see unit cost | | |
| UAT-M05-07 | Opening stock through an approved adjustment | | |
| UAT-M05-08 | Delivery note: issue more than stock refused | | |
| UAT-M05-09 | Delivery note ships serials; serial traceable | | |
| UAT-M05-10 | Payable matches the received value | | |
| UAT-M05-11 | Cancel PO only while nothing received | | |

---

### UAT-M05-01 Supplier; bank details hidden from other roles
- **Role:** purchasing, then warehouse
- **Steps:** Procurement → Suppliers → new supplier with address and bank
  account. Open it as warehouse.
- **Expected:** supplier gets a code; the warehouse user does not see the
  bank details.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-02 PO draft, no self-approval, approve, print, send
- **Role:** purchasing + admin
- **Steps:** 1. New PO: supplier, category Hardware, VAT added, one
  serialized item × 3 at a known price, one non-serialized item × 10. Save.
  2. Submit; the author tries Approve. 3. Admin approves. 4. Print, Mark as
  sent.
- **Expected:** draft without number; step 2 refused; approval gives the PO
  number (category in the number); totals = Σ qty × price + 11% VAT (check
  by hand); print matches the company PO layout.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-03 Partial goods receipt with serials
- **Role:** warehouse · **Needs:** M05-02
- **Steps:** On the PO press Receive goods: warehouse, date, supplier's
  delivery note number; 2 of the 3 serialized units with two serial numbers;
  6 of 10 of the other item. Post receipt.
- **Expected:** PO **Partly received**; stock +2 and +6 in that warehouse;
  each serial appears as an **in stock** unit on the item page; entering 2
  units with only 1 serial is refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-04 Full receipt; over-receipt refused
- **Role:** warehouse · **Needs:** M05-03
- **Steps:** Receive again: try 5 of the non-serialized item (only 4 open);
  then receive the rest (1 serialized with serial, 4 others).
- **Expected:** 5 refused (more than is open); then PO **Received**; a
  posted receipt cannot be edited.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-05 Stock, moving-average cost, inventory value
- **Role:** finance / purchasing
- **Steps:** Inventory → Stock; item movements; Inventory → Inventory Value.
  Make a second PO for the same item at a different price, receive it.
- **Expected:** movements list both receipts; unit cost = PO price
  **without VAT**; the new average = (old qty × old cost + new qty × new
  cost) / total qty (check by hand); value per warehouse and grand total add
  up.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-06 Warehouse does not see unit cost
- **Role:** warehouse
- **Steps:** Open stock, movements, Inventory Value (URL), a goods receipt.
- **Expected:** no unit cost or value anywhere; Inventory Value refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-07 Opening stock through an approved adjustment
- **Role:** warehouse + admin
- **Steps:** Stock → Adjust stock: Increase, reason Opening stock, a new
  item, counted 5, unit cost 100.000. Create, submit; the author tries to
  approve; admin approves; Post to stock.
- **Expected:** stock does not move before **Post**; self-approval refused;
  after posting stock 5 at cost 100.000; value 500.000.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-08 Delivery note: issue more than stock refused
- **Role:** warehouse · **Needs:** a sales order (M02-08) for more units
  than are in stock
- **Steps:** Create a delivery note for more than the warehouse holds;
  prepare; Ship.
- **Expected:** shipping is refused (insufficient stock); nothing leaves
  stock; the note stays prepared.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-09 Delivery note ships serials; serial traceable
- **Role:** warehouse · **Needs:** M05-03, a sales order with the serialized item
- **Steps:** Create a delivery note, tick one serial received in M05-03,
  prepare (print), Ship, Mark delivered. Open the item page and the
  movements.
- **Expected:** stock −1 at the moving-average cost; the serial is **sold**
  to the customer; the movement history shows the receipt (GR number) and
  the issue (SJ number) for that serial; the order **In progress**. Shipping
  cannot be undone. (M07-05 continues the trace into a ticket.)
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M05-10 Payable matches the received value
- **Role:** finance · **Needs:** M05-04
- **Steps:** Record the supplier bill for the PO in Finance (M09 payables,
  when available) and compare with the received quantities × PO prices + VAT.
- **Expected:** payable = received value incl. VAT, once. **N/T** if the
  supplier bill flow is not available in the build under test — record it.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/T — evidence:

### UAT-M05-11 Cancel PO only while nothing received
- **Role:** purchasing
- **Steps:** Cancel a new approved PO; try to cancel the PO from M05-03.
- **Expected:** first → cancelled; second refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
