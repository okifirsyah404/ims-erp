# ADR-0022 - Customer Portal: Portal Identities and the `/portal/v1` API

- **Status:** proposed (2026-11-14). Records the owner decisions of 2026-11-14
  (ERP-0022 stage 1); becomes accepted with the owner's review of the PR.
  Renumbered twice on 2026-11-15: from 0018, because main took ADR-0018
  (investor and customer app roles) and ADR-0019 (migration baseline) in
  parallel (PR #101); then from 0020, because the M04 outbox record took
  ADR-0020 when it was merged. ADR-0021 is the payment gateway (PR #99).
- **Context:** M07 T26 (project status and own tickets) and the account part
  of M12 T25 need customers to sign in. The portal UI already exists in the
  website repo (`entragate-platform`, `apps/customer`, Astro SSR): its server
  holds the session and calls the ERP through a `PortalSource` contract with
  configurable routes and no mapping layer. The permission catalog has an
  unused `customer` organization role. Customers must only ever see their own
  records, never costs or internal notes (M07 controls).
- **Decision:**
  1. **A portal login is a Better Auth user plus an `auth.portal_identities`
     row** (`portal_type = 'customer'`, `linked_entity_id` = the CRM customer,
     nullable per ADR-0014). It is **never an organization member**, so the
     `erp` guard refuses it on every ERP route; the `customer` role stays
     unused.
  2. **One login per person, with a role; individuals sign up, businesses
     are invited** (owner decisions D1/D2 of 2026-11-14, taken after the
     website gap analysis `docs/plan/plans/website-integration.md`; the first
     choice the same morning — one login per customer, invitation only —
     would have blocked online retail and the website's member screens). The
     identity points at the CRM contact (`contact_id`, unique per contact)
     with `portal_role` `owner | approver | finance | viewer`. Staff invite
     from the customer page (`/admin/portal-accounts`, `portal_account:*`);
     an owner invites and removes colleagues from the portal. Invitation
     emails link to the portal's `/reset-password?token=…`; the token is
     Better Auth's own reset-password verification value (3 days for an
     invitation, 1 hour for "forgot password"), so passwords stay Better
     Auth's. An `individual` signs up with a password and confirms a 6-digit
     emailed code (10 minutes, 5 attempts, kept hashed in Redis); the
     verification creates the CRM customer (`PRT-…` code), its primary
     contact and an owner login, and signs in. A `business` sign-up is
     refused. A staff email is refused; an already verified email gets the
     same answer and no email. Revoking marks the identity revoked and
     deletes the user's sessions.
  2a. **The web admin refuses customer logins**: `session.create.before`
     refuses a session for a user with a portal identity unless the request
     carries the portal sign-in marker (`x-erp-portal-signin` with a random
     per-process nonce, sent only by the portal module's server-side calls).
  3. **The portal API is `/portal/v1`, owned by a `portal` module with no
     tables** (a backend-for-frontend). Sign-in returns Better Auth's signed
     session token as the portal's `accessToken`; the `portal` guard
     (`domainPlugin({ guards: 'portal' })`) turns `Authorization: Bearer` back
     into the session cookie, checks the session and an active customer
     identity, and scopes every read to that customer id. Better Auth's
     `bearer` plugin is **not** installed: it would expose `set-auth-token` on
     every staff login and make the token valid on ERP routes.
  4. **Sign-in throttling in the portal module**: server-side `auth.api` calls
     bypass Better Auth's rate limiter, so failed sign-ins are counted per email
     in Redis; 5 failures lock the email for 15 minutes (423). A staff login,
     an unknown email and a wrong password all answer the same 401.
  5. **Data through the owning modules' contracts, separate portal DTOs**:
     `ProjectPortalService` (no contract value, costs, notes, internal files),
     `ServiceTicketService.*ForCustomer / *FromPortal` (no service cost, only
     customer-visible comments), `WarrantyService.*ForCustomer`. Another
     customer's record answers 404.
  6. **Responses use the portal's view shapes** (`PortalSource` types:
     labels in the caller's `Accept-Language`, Jakarta dates), produced by a
     pure presenter in the portal module, because the portal's adapter passes
     responses straight to its screens. No money is returned in stage 1.
  7. **Portal tickets are the after-sales service tickets** (owner), channel
     `portal`, with a new message thread `aftersales.service_ticket_comments`
     (`internal` notes vs `customer` replies). The customer may confirm a
     resolved ticket (confirmation channel `portal`). The target `ticket.*`
     module in `docs.dbml` stays target-only.
- **Consequences:** the portal works without any Better Auth plugin change;
  the website team configures `PortalRoutes` from
  `docs/architecture/modules/customer-portal.md`. Roles gate only member
  management today (owner); approver/finance gates arrive with quotations
  and invoices. A pending sign-up leaves an unverified user without an
  identity (it can never sign in). Ticket photos/attachments, orders,
  quotations, invoices, documents and notifications are stage 2. The UI copy
  lives partly in the API (`api` locale namespace), so label changes need a
  backend release.
- **Alternatives considered:**
  - **Organization membership with the `customer` role** — rejected: the
    member would pass the `erp` guard and every ERP route would need record
    scoping; a mistake leaks company data.
  - **Better Auth `bearer` plugin** — rejected (see decision 3).
  - **Plain data API, mapping in the website** — rejected for now: the
    portal adapter has no mapping layer and the money/label conventions would
    be re-implemented there.
  - **Building the `ticket.*` module** — deferred by the owner.
