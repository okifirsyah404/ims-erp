# Ticket Module

> Created 2026-11-20 (ADR-0024). Absorbs the service-ticket part of the
> pre-refactor `aftersales` module; warranties moved to `project`.

Code: `apps/backend/src/app/ticket`. Schema: `ticket`. Profile:
`docs/database/module-ownership.md` (#13). Tables: `docs/database/docs.dbml`.

## Purpose and boundary

After-sales service tickets: a customer problem, a technician, a resolution
and the customer's confirmation. It does not own warranties (`project`),
customers (`customer`) or stock used (`inventory`).

## Owned tables (6)

`tickets`, `ticket_messages` (the thread), `ticket_templates`,
`sub_ticket_templates`, `settings`, `code_numberings`
(`TicketNumberingService`). Templates and sub-tickets (ADR-0024 Q29) are
target-only in `docs.dbml`: no service or endpoint uses them yet.

## HTTP

Prefix `/tickets` (`erp` guard): `GET /`, `GET /:id`, `POST /`,
`GET /warranty-check`, `GET /technicians`, `GET|POST /:id/comments`,
`POST /:id/assign|start|resolve|reopen|close`. The customer-facing ticket
routes are in `customer` under `/customers/portal/v1/tickets*`, calling this
module's service.

## Contract

No `Exported*` facade yet. `TicketService` is consumed by the portal controller
through DI; it itself reads customer (`CUSTOMER_SERVICE_TOKEN`), project
(`PROJECT_LOOKUP_SERVICE_TOKEN`), document, organization and user contracts.

## Permissions

Resource `service_ticket`: `read`, `create`, `update`, `assign`, `resolve`,
`close`. Closing needs the `close` action in addition to the customer's
confirmation.

## Key rules

- Opening a ticket checks the warranty (via the project contract) and stores
  the result on the ticket.
- Lifecycle actions: assign, start, resolve (records the resolution and
  service cost), reopen, close (with the customer's confirmation).
- Events (`ticket.*`) go out through the automation outbox
  (`OUTBOX_SERVICE_TOKEN`), never straight to n8n.
- Attachments are `document` files, not ticket columns.
