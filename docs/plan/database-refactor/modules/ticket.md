# ticket - ERP-0083

Schema `ticket` · folder `src/app/ticket` (replaces `aftersales`) · URL `/tickets` · phase P6

## Current

`aftersales.service_tickets`, `service_ticket_comments` (+ warranty, moving
to project). Repositories service-ticket, service-ticket-comment, warranty.
Controllers `/service-tickets`, `/warranty-certificates`. Portal ticket
create/read/confirm through `/portal/v1`. Consumers: web-admin
`service-ticket-api.ts`; web-customer-portal ticket pages. Today's dbml
`ticket.*` tables are target-only and are replaced.

## Target tables (Q13, Q29)

| Table | Notes |
|---|---|
| tickets | from service_tickets; + `ticket_type` (installation/repair/maintenance/warranty_service/inspection/other), `parent_ticket_id` (self FK, sub-tickets), `ticket_template_id`, `priority`, `company_id`, `warranty_id` (-> project.warranties), `item_serial_id` (-> inventory.item_serials), `customer_id`, `project_id`; in-warranty snapshot kept |
| ticket_messages | from service_ticket_comments (author_type staff/customer, visibility internal/customer) |
| ticket_templates | name, ticket_type, default priority, SLA hours, checklist |
| sub_ticket_templates | ticket_template_id FK, title, sort_order, default assignee role |
| settings | key-value |
| code_numberings | ticket codes |

Creating a ticket from a template creates one child ticket per
`sub_ticket_templates` row in the same transaction; a parent closes only when
its children are closed.

## Steps

1. **dbml** - replace the ticket section; remove aftersales.
2. **Drizzle** - `ticket.schema.ts`; delete `aftersales.schema.ts`.
3. **Repositories** - ticket, ticket-message, ticket-template,
   sub-ticket-template, setting, code-numbering.
4. **Services** - TicketService (warranty check via `ExportedWarrantyService`
   + `ExportedInventoryService` serial lookup), TicketTemplateService.
   Publish `ExportedTicketService` for the customer portal.
5. **Controllers** - `/tickets`, `/tickets/:id/messages`, `/tickets/templates`.
6. **Consumers** - web-admin `service-ticket-api.ts` -> `ticket-api.ts`,
   routes `/service-tickets` -> `/tickets`, template admin page (new);
   web-customer-portal ticket calls via `/customers/portal/v1/tickets`.

## Exit

Template spawn, parent-close rule, warranty check and portal visibility tests
green.
