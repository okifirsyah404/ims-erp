# UAT — M04 n8n, WhatsApp, Website

Scope: website catalog, ERP events to n8n, WhatsApp assistant with FAQ and
admin handoff, lead from a chat. User guide section 8.7; setup:
[`docs/user-guide/whatsapp-n8n-setup.en.md`](../../user-guide/whatsapp-n8n-setup.en.md).
Plan acceptance: a failed webhook logged then retried, an AI question outside
the FAQ handed off, a discount request refused (see [README](README.md)).

**Needs:** WAHA with a **sandbox** number, an n8n workflow that verifies the
signature (setup guide step 5), optionally an AI provider. Cases marked
*(no AI)* can run without a provider.

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M04-01 | Publish an item to the website catalog | | |
| UAT-M04-02 | Event delivered to n8n with a valid signature | | |
| UAT-M04-03 | n8n down → failed, retried, sent by hand once | | |
| UAT-M04-04 | Incoming chat without AI → handoff *(no AI)* | | |
| UAT-M04-05 | Discount request refused and handed off *(no AI)* | | |
| UAT-M04-06 | FAQ question answered by the assistant | | |
| UAT-M04-07 | Question outside the FAQ handed off | | |
| UAT-M04-08 | Admin reply, resume, close *(no AI)* | | |
| UAT-M04-09 | Create lead from a chat *(no AI)* | | |
| UAT-M04-10 | Webhook with a wrong key refused *(no AI)* | | |
| UAT-M04-11 | Roles: who can read, reply, edit FAQ | | |

---

### UAT-M04-01 Publish an item to the website catalog
- **Role:** marketing / admin
- **Steps:** Integrations → Website Catalog: add an item, choose "show price"
  and out-of-stock behaviour, Publish. Call the public catalog API with the
  website key (developer).
- **Expected:** the item appears with name, photo, price and stock from the
  item master (change the item price → the catalog follows). Unpublished
  items do not appear; without the key → 401.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-02 Event delivered to n8n with a valid signature
- **Role:** sales + admin
- **Steps:** Create a lead. Open Integrations → Webhooks (n8n) and the n8n
  execution.
- **Expected:** one `lead.created` event **Published**; n8n accepted the
  signature and received the lead fields; the n8n flow sends its alert once.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-03 n8n down → failed, retried, sent by hand once
- **Role:** admin
- **Steps:** 1. Deactivate the n8n workflow (or stop n8n). 2. Issue an
  invoice. 3. Watch the event for a few minutes. 4. Turn n8n back on;
  **Send now**. 5. Press Send now again on the published event (if offered).
- **Expected:** attempts logged with the error and growing delay; after
  step 4 **Published**; the customer receives one message — the n8n dedupe
  on event id stops a second one. The invoice itself was issued normally in
  step 2 (n8n outage never blocks the business action).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-04 Incoming chat without AI → handoff
- **Role:** customer service · **Setup:** no `AI_*` configured
- **Steps:** From a test phone send "Halo, mau tanya produk" to the sandbox
  number. Open Integrations → WhatsApp AI.
- **Expected:** chat listed as **Needs an admin** (reason no provider); the
  phone receives one holding reply; a `whatsapp.handoff` event goes to n8n.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-05 Discount request refused and handed off
- **Steps:** From a new test phone (or after **Close**) send "Bisa minta
  diskon 20%?".
- **Expected:** refusal reply (no discount promised), chat **Needs an admin**
  reason *restricted*; the AI is not asked (same with an AI provider).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-06 FAQ question answered by the assistant
- **Role:** marketing (FAQ) · **Setup:** AI provider configured
- **Steps:** Add an active FAQ entry (e.g. office hours). From a test phone
  ask that question in your own words.
- **Expected:** the assistant answers with the FAQ content; the chat stays
  **Assistant**; the reply is logged as sent by the assistant.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-07 Question outside the FAQ handed off
- **Setup:** AI provider configured
- **Steps:** Ask something not in the FAQ or catalog (e.g. "Kapan teknisi
  datang ke lokasi saya?").
- **Expected:** no invented answer; holding reply; **Needs an admin**
  (*not found*).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-08 Admin reply, resume, close
- **Role:** customer service · **Needs:** M04-04
- **Steps:** Open the chat, reply as admin; send another customer message;
  Hand back to the assistant; Close chat; send a new customer message.
- **Expected:** the reply reaches the phone; while the admin owns the chat
  the assistant stays silent; resume → **Assistant**; close → **Closed**;
  the next message reopens it with the assistant.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-09 Create lead from a chat
- **Role:** customer service, then sales manager
- **Steps:** On a chat press **Create lead**; press it again (or refresh and
  check). Sales manager opens CRM → Leads.
- **Expected:** one lead, source WhatsApp, unassigned, with name, number and
  the customer's questions; the chat shows **Open lead** (or "Lead created
  in CRM" without lead access); never a second lead from the same chat.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-10 Webhook with a wrong key refused
- **Role:** admin / developer
- **Steps:** Change the HMAC key in WAHA to a wrong value, send a message;
  restore it, send again.
- **Expected:** WAHA logs 401 and nothing appears in the ERP; after restoring
  the message appears once.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M04-11 Roles
- **Steps:** Log in as customer service, marketing, sales.
- **Expected:** customer service reads and replies, no FAQ editing;
  marketing reads and edits FAQ, cannot reply; sales sees no WhatsApp AI
  menu and the URL is refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
