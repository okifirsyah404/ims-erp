> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# UAT — M03 Subscription and Licensing

Scope: application register, license contracts and keys, renewal through
SPH/SO/invoice, due list, license API for own applications. User guide
section 8.5; API: `docs/architecture/modules/licensing-subscription.md`.
Plan acceptance: full lifecycle on the pilot app, invalid key, another
customer's key (see [README](README.md)).

The API cases (M03-07…10) need someone who can call the API (`curl`/Postman,
or the pilot application). To test dates without waiting, create contracts
whose period is already in the past.

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M03-01 | Register third-party and own application | | |
| UAT-M03-02 | Contract draft → key → activate | | |
| UAT-M03-03 | Key masking for finance | | |
| UAT-M03-04 | Due list and dashboard counts | | |
| UAT-M03-05 | Renewal: SPH → paid → draft renewal activates | | |
| UAT-M03-06 | Suspend, reactivate, terminate, revoke key | | |
| UAT-M03-07 | API: activate and validate (ok) | | |
| UAT-M03-08 | API: grace, then expired | | |
| UAT-M03-09 | API: suspended blocked, reactivated works | | |
| UAT-M03-10 | API: invalid key, other application's key, bad API key | | |
| UAT-M03-11 | API: seat limit and release | | |

---

### UAT-M03-01 Register third-party and own application
- **Role:** sales manager
- **Steps:** Subscription & Licensing → Applications: add one **third-party**
  application and one **own** application.
- **Expected:** both listed with their kind; only the own application offers
  API keys.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-02 Contract draft → key → activate
- **Role:** sales · **Needs:** M03-01, a customer
- **Steps:** 1. New contract: customer, own application, package, start
  today, end in 1 year, cycle yearly, value. Save draft. 2. Add key, leave it
  empty. 3. Activate. 4. Repeat for the third-party application typing the
  vendor's key.
- **Expected:** contract numbered `LIC…`, **Draft → Active**; the own
  application gets a generated key; the third-party one keeps the typed key.
  A third-party key left empty is refused; a key already registered on
  another contract is refused.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-03 Key masking for finance
- **Role:** finance
- **Steps:** Open the contract from M03-02.
- **Expected:** key shown masked (last 4 characters); no create / activate
  buttons.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-04 Due list and dashboard counts
- **Role:** sales manager
- **Steps:** Create and activate contracts ending in 20 days and ended 3 days
  ago. Open **Due for renewal (30 days)** and the dashboard.
- **Expected:** both appear in the due list (ending soon / ended, days left);
  the dashboard shows the same counts; the 1-year contract from M03-02 does
  not appear.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-05 Renewal: SPH → paid → draft renewal activates
- **Role:** sales + finance · **Needs:** the "ending in 20 days" contract
- **Steps:** 1. Create SPH → approve → sales order → invoice for the
  renewal. 2. On the contract press **Renew** (draft for the next period),
  link the new sales order. 3. Finance records full payment. 4. Open the
  contract register.
- **Expected:** after step 3 the draft renewal becomes **Active** by itself
  and the old contract **Renewed**; the keys continue on the new period; a
  second payment record does not renew twice. Partial payment does not
  activate it.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-06 Suspend, reactivate, terminate, revoke key
- **Role:** sales manager
- **Steps:** Suspend → Reactivate a contract; revoke one key with a reason;
  terminate another contract with a reason.
- **Expected:** statuses change as pressed; reasons stored; every action
  appears in the contract's event log with the user.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-07 API: activate and validate (ok)
- **Role:** sales manager (API key) + developer
- **Steps:** 1. API Keys → create a key for the own application (copy it).
  2. `POST /licensing/v1/activate` `{licenseKey, instanceId: "pc-1"}`.
  3. `POST /licensing/v1/validate` `{licenseKey, instanceId: "pc-1"}`.
- **Expected:** the API key is shown once; activate → 200, a seat appears on
  the contract (Validation & Activation); validate → `valid: true`,
  `status: ok`, `daysLeft`. Calling activate again for `pc-1` does not take
  a second seat.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-08 API: grace, then expired
- **Steps:** Validate the keys of: a contract that ended yesterday; one that
  ended 8 days ago.
- **Expected:** ended yesterday → `valid: true`, `status: grace`,
  `graceEndsOn` = end + 7 days; ended 8 days ago → `valid: false`,
  `status: expired`.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-09 API: suspended blocked, reactivated works
- **Steps:** Suspend the M03-07 contract, validate; reactivate, validate.
- **Expected:** `valid: false, status: suspended`, then `valid: true, ok`.
  (With M03-05 this covers the lifecycle active → ended → grace → blocked →
  paid → renewed.)
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-10 API: invalid key, other application's key, bad API key
- **Steps:** Validate a made-up license key; validate the third-party
  contract's key with the own application's API key; call with a wrong
  `Authorization` header.
- **Expected:** made-up and foreign keys → `valid: false, status: unknown`
  (nothing about the other customer leaks); wrong API key → 401.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M03-11 API: seat limit and release
- **Steps:** With the key's max activations = 1 (default): activate `pc-2` → refused; release the
  `pc-1` seat on the contract page; activate `pc-2` again.
- **Expected:** first `pc-2` → 409 (no seat left); after **Release** → 200.
  The release is logged with the user.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
