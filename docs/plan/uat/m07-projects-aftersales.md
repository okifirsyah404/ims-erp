# UAT — M07 Projects and After-Sales

Scope: projects from a deal, checklist and evidence, direct costs and
margin, BAST, warranty certificate, service tickets with the warranty check.
User guide section 8.1–8.4.
Plan acceptance: a project run to BAST that starts the warranty, an
in-warranty and an out-of-warranty ticket, customer A trying to open
customer B's ticket (see [README](README.md)).

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M07-01 | Project from a deal; one live project per deal | | |
| UAT-M07-02 | Checklist; technician sees only own work | | |
| UAT-M07-03 | Direct costs and margin, hidden from technicians | | |
| UAT-M07-04 | Close only with test, training and BAST evidence | | |
| UAT-M07-05 | BAST issued, warranty starts at the BAST date | | |
| UAT-M07-06 | Ticket in warranty (by serial) | | |
| UAT-M07-07 | Ticket out of warranty | | |
| UAT-M07-08 | Ticket lifecycle; close needs customer confirmation | | |
| UAT-M07-09 | Customer A cannot open customer B's ticket (portal) | N/T | |

---

### UAT-M07-01 Project from a deal; one live project per deal
- **Role:** project manager · **Needs:** a sales order (M02-08) with a
  shipped delivery note (M05-09)
- **Steps:** Projects → New project: pick the deal, PIC, location, target
  dates. Try a second project for the same deal.
- **Expected:** project created with the default checklist (survey,
  delivery, installation, function test, training, BAST); the second one is
  refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-02 Checklist; technician sees only own work
- **Role:** project manager + two technicians
- **Steps:** Assign installation to technician A. Log in as A, then as B.
- **Expected:** A sees the project and can move only own tasks; B does not
  see the project (direct URL refused).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-03 Direct costs and margin, hidden from technicians
- **Role:** project manager / finance, then technician A
- **Steps:** Add a direct cost with a receipt photo (≤ 15 MB). Read the cost
  panel; open the project as technician A.
- **Expected:** total cost = direct costs + shipped material value (from
  the delivery note); margin = contract value − total cost (check by hand);
  technician sees no costs.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-04 Close only with test, training and BAST evidence
- **Role:** project manager
- **Steps:** Close project with no evidence; upload function test and
  training evidence, close again; upload signed BAST evidence, close.
- **Expected:** the first two are refused with the missing evidence named;
  the third → stage **Warranty**.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-05 BAST issued, warranty starts at the BAST date
- **Role:** project manager
- **Steps:** Hand-over documents → New BAST (check the prefilled parties,
  items, scope), Issue, print. Issue warranty: from that BAST, 12 months.
  Print.
- **Expected:** BAST numbered, date in words; warranty lists the shipped
  serials; period = BAST date → the day before the same date 12 months later
  (e.g. 2025-12-24 → 2026-12-23); one certificate per project.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-06 Ticket in warranty (by serial)
- **Role:** customer service · **Needs:** M07-05
- **Steps:** Projects → Tickets & Warranty → New ticket: type the shipped
  serial; reporter, channel WhatsApp, complaint; Open ticket.
- **Expected:** customer, project and device fill in; label **Under
  warranty**; the check is stored on the ticket (it does not change if the
  certificate is edited later).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-07 Ticket out of warranty
- **Role:** customer service
- **Steps:** New ticket for a serial whose warranty ended (a certificate with
  a past BAST date), and for a serial never shipped.
- **Expected:** **Out of warranty** for the first; the second has no
  warranty and no project (the ticket can still be opened manually).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-08 Ticket lifecycle; close needs customer confirmation
- **Role:** customer service + technician
- **Steps:** Assign technician; technician Start work → Resolve
  (resolution, service cost); Reopen; Resolve; customer service Close with
  the customer's name and channel; try closing without them.
- **Expected:** statuses follow the steps; closing without confirmation is
  refused; each change emits `service_ticket.updated` (visible under
  Webhooks (n8n) when M04 is in the build).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M07-09 Customer A cannot open customer B's ticket
- **Status:** **N/T** — the customer portal (T26, ERP-0022) is not built.
  Staff-side ownership is covered by M07-02. When the portal lands: customer
  A's login must get "not found" for customer B's ticket and project.

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
