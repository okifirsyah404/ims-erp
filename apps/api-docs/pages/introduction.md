---
title: Introduction
---

The Entragate ERP exposes two APIs to the website repo (`entragate-platform`):

| API | Prefix | Used by | Auth |
| --- | --- | --- | --- |
| Customer portal | `/portal/v1` | `apps/customer` | The customer's portal session (bearer) |
| Public website | `/public/v1` | `apps/web` (RFQ, contact, demo forms) | The website's ERP API key (bearer) |

Both are called **server to server** — from the Astro server, never from the
browser. The portal's ERP adapter passes responses straight to its screens, so
portal responses already have the portal's view shapes (`PortalSource` types in
`packages/api-client/src/services/portal.ts`).

## What is built (stage 1)

- **Account:** sign-in with lockout, individual sign-up with an emailed code,
  forgot / reset / change password, account and members (owners invite
  colleagues).
- **Projects:** list and detail with milestones, BASTs and files — never costs
  or internal notes.
- **Support:** service tickets — open, read the thread, write, confirm a fix.
- **Devices:** the lines of the customer's warranty certificates and their
  warranty.
- **Public website:** RFQ (with attachments), contact message, demo request.

Orders, quotations, invoices and payments, documents, notifications, bookings
and the account settings that are not listed above come in stage 2. Until then
the portal shows those screens as **Coming soon**.

## Customers and logins

- One login per **person** (a contact of a CRM customer) with a role:
  `owner`, `approver`, `finance` or `viewer`.
- **Individuals** sign up themselves; **businesses** are invited by ERP staff,
  then an owner invites colleagues from the portal.
- A portal login is never an ERP staff account: the ERP's own routes and the
  web admin refuse it.

Every read is scoped to the signed-in person's customer; another customer's
record answers `404`.
