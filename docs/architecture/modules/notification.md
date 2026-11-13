# Notification Module

## Purpose and boundary

Owns the in-app notification inbox: the message a user sees in the bell menu,
its unread badge, and the templates that produce it. It is the **first consumer
of the single realtime socket** (`/ws`), not the owner of that socket — the
transport lives in `apps/backend/src/providers/realtime/` so later features
(chat, live counters) reuse it without opening a second connection.

The module does **not** decide business content. A caller names a template code
and supplies variables; the module renders, stores and pushes.

Planned later scope (unchanged from the original v5.1 targets, not built here):
email/WhatsApp delivery channels, notification preferences, Web Push, and the
WhatsApp AI handoff of M04 stage 2.

## Current state (2026-11-13)

**Schema landed, no behaviour yet.** Phase 0 of
`docs/plan/plans/ws-notification.md` produced the contract; Phase 1 produced the
database:

- `docs/database/docs.dbml` — `notification.notification_templates` and
  `notification.notifications` moved out of the `automation` schema.
- `docs/database/module-ownership.md` — module 27.
- ADR-0016 — why the module is app-scope and why there is one socket.
- `apps/backend/drizzle/schemas/notification.schema.ts` — the two tables,
  their indexes, checks and the one intra-module FK.
- `apps/backend/database/migrations/20261113150000_erp0047_notification_schema/`
  — applied to the local database through `drizzle:migrate-reset`.

No module folder in `apps/backend/src/app/notification/` yet, no `/ws`
transport, no REST routes, no UI. Phase 2 adds the transport, Phase 3 the
module.

## Data ownership

Schema `notification`, app-scope (no `organization_id`):

| Table | Holds |
|---|---|
| `notification.notification_templates` | copy per `module.event` code, its channel and declared variables |
| `notification.notifications` | one row per recipient: `user_id`, `template_code`, `title`, `body`, `tags`, `variables`, `metadata`, `status`, `sent_at`, `read_at`, `source_type`/`source_id` |

Rules:

- The tenant is **not** in the row. A notification is per user and is readable
  from every organization that user belongs to; the organization context is a
  display **tag** (the organization name), never a filter.
- Rows are created by the module's BullMQ worker as `status='sent'` and turned
  `read` by the recipient. There is no `queued` round-trip: the job is the
  queue.
- Prune is a repeat job that **hard deletes** `status='read'` rows past the
  retention window. They are delivery records, not business data, so the
  soft-delete rule does not apply to them.
- `template_code` is denormalized onto the row, so a later template edit never
  rewrites what a user already received.

## Contract

`ExportedNotificationService` — the **only** cross-module entry point:

```ts
notify({
  userIds: string[];
  templateCode: string;          // 'module.event'
  variables: Record<string, string>;
  tags: string[];                // display labels, e.g. [organizationName]
  sourceType?: string;
  sourceId?: string;
}): Promise<void>;
```

It enqueues one BullMQ job per recipient and never throws into the caller's
request path: a queue outage is logged, the business write still succeeds (same
contract as the avatar queue hook).

Read-side guards: `resolveNotificationRecipient(userId)` and
`assertNotificationOwnedBy(notificationId, userId)`. A notification id that
belongs to another user returns **404**, never 403 — probing must not reveal
existence.

## Realtime envelope

The socket is shared, so every message is wrapped:

```ts
{ type: string; status: 'success' | 'error'; sentAt: number; data: unknown }
```

`status` is the delivery result of the message itself; `data.status` carries the
domain status (`sent`, `read`). Notification types are `notification.created`,
`notification.updated` and `notification.unread_count`. Chat later adds
`chat.message` on the same socket.

## Consumers

- Organization: member added, organization created, invitation claimed.
- Planned: sales invoice issued, document signature requested, licensing expiry.

## Tests

`apps/backend/test/notification/`:

- `notification.service.test.ts` — enqueue payload, template code, tags,
  deterministic job id.
- `notification.worker.test.ts` — row created as `sent`, hub publish, prune
  selection.
- `notification.gateway.test.ts` — envelope shape, upgrade rejected without a
  session.
- `realtime.smoke.test.ts` — connect with a session cookie, trigger a producer,
  receive the message.
