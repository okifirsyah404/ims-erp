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

## Current state (2026-11-14)

**Backend module landed with its REST surface and producers; no seeder or UI
yet.** Phases 0–5 of `docs/plan/plans/ws-notification.md`:

- `docs/database/docs.dbml` — `notification.notification_templates` and
  `notification.notifications` moved out of the `automation` schema.
- `docs/database/module-ownership.md` — module 27.
- ADR-0016 — why the module is app-scope and why there is one socket.
- `apps/backend/drizzle/schemas/notification.schema.ts` — the two tables,
  their indexes, checks and the one intra-module FK.
- `apps/backend/database/migrations/20261113150000_erp0047_notification_schema/`
  — applied to the local database through `drizzle:migrate-reset`.
- `apps/backend/src/providers/realtime/` — the shared `/ws` transport
  (envelope, in-process hub, gateway). It is not notification-specific and
  later features reuse it.
- `apps/backend/src/app/notification/` — the module: repository over both
  tables, `NotificationService` (list, unread count, mark read, mark all read),
  `ExportedNotificationService` (the only cross-module entry point), the
  `send`/`prune` BullMQ queue and its worker, and the controller mounting the
  inbox routes.

Phase 6 adds the seeders, Phase 7 the bell.

## Producers (landed)

`OrganizationService` is the first producer, through
`EXPORTED_NOTIFICATION_SERVICE_TOKEN` only:

| Path | Template | Variables | Tag |
|---|---|---|---|
| `addMember` | `org.member_added` | `organizationName`, `role` | organization name |
| `createOrganization` (creator) | `org.org_created` | `organizationName` | organization name |
| `createOrganization` (nested **active** user) | `org.member_added` | `organizationName`, `role` | organization name |
| `InvitationService.claim` (org path, after the membership exists) | `org.member_added` | `organizationName`, `role` | organization name |

Rules that keep this honest:

- A nested **invited** user is notified once, at claim — never at create. One
  membership yields one notification, and an invite email is not an in-app
  notification.
- `role` is the Better Auth comma-joined list rendered for humans
  (`admin, sales`).
- `sourceId` is the member row id where one exists, else the organization id,
  so the enqueued job id is deterministic and a replay cannot double-notify.
- `ExportedNotificationService` takes its dispatcher through
  `NOTIFICATION_DISPATCHER_TOKEN`. A defaulted constructor parameter emits no
  design type, and tsyringe then fails the entire graph at boot with
  `TypeInfo not known for "Object"`.

## HTTP surface

App-scope, so the plugin rides the **session guard only** (no `erp` macro, no
`x-organization-id`): a user reads their inbox from every organization they
belong to, and a fresh login has no active organization yet. The caller's id
always comes from the resolved session — never from a path or body field.

| Method | Path | Behaviour |
|---|---|---|
| GET | `/notifications` | paginated list for the caller, newest first; `unreadOnly=true` filters |
| GET | `/notifications/unread-count` | `{ count }` |
| PATCH | `/notifications/:id/read` | 404 when the row is not the caller's; a non-uuid id is a 400 |
| POST | `/notifications/read-all` | marks every unread row of the caller, returns `{ changed }` |

## How a notification is produced

1. A producer (e.g. `OrganizationService.addMember`) injects
   `EXPORTED_NOTIFICATION_SERVICE_TOKEN` and calls
   `notify({ userIds, templateCode, variables, tags, sourceId })`.
2. That service enqueues one BullMQ `send` job per recipient and returns. A
   queue failure is logged, never thrown — the business write has already
   succeeded by then.
3. The worker resolves the template by `template_code`, renders
   `{{variable}}` placeholders into the English `title`/`body`, inserts the row
   as `status='sent'` with `sent_at`, and publishes
   `notification.created` to the recipient's open sockets.
4. A missing or inactive template **skips** the job rather than retrying: a
   retry cannot create a template, and a poison job would block the queue.

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

`ExportedNotificationService` — the **only** cross-module entry point, resolved
through `EXPORTED_NOTIFICATION_SERVICE_TOKEN`:

```ts
notify({
  userIds: string[];
  templateCode: NotificationTemplateCode;  // 'module.event'
  variables?: Record<string, string>;
  tags?: string[];                // display labels, e.g. [organizationName]
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;  // deep-link extras; never authorization
}): Promise<void>;
```

It enqueues one BullMQ job per recipient (duplicates and blanks collapsed) and
never throws into the caller's request path: a queue outage is logged, the
business write still succeeds (same contract as the avatar queue hook).

Read-side guards live on `NotificationService` (token
`NOTIFICATION_SERVICE_TOKEN`, used by the Phase 4 controllers):
`list(userId, query)`, `unreadCount(userId)`, `markRead(id, userId)`,
`markAllRead(userId)`, `assertOwnedBy(id, userId)`. Every one takes the caller's
`userId`; there is no "any user" variant. A notification id that belongs to
another user returns **404**, never 403 — probing must not reveal existence,
and the repository's WHERE clause makes the two cases identical.

## Realtime envelope

The socket is shared, so every message is wrapped:

```ts
{ type: string; status: 'success' | 'error'; sentAt: number; data: unknown }
```

`status` is the delivery result of the message itself; `data.status` carries the
domain status (`sent`, `read`). Notification types are `notification.created`,
`notification.updated` and `notification.unread_count`. Chat later adds
`chat.message` on the same socket.

The transport lives in `apps/backend/src/providers/realtime/` (envelope builder,
in-process hub, gateway), not in this module: the module only calls
`IRealtimeHub.publish(userId, realtimeMessage(type, data))`.

## Retention

`prune` is a BullMQ repeat job (`upsertJobScheduler`, key `prune`), declared at
boot when `SCHEDULER_ENABLED` is on. Each run **hard-deletes** rows with
`status='read'` and `read_at` older than `NOTIFICATION_RETENTION_DAYS`
(default 90); the cron is `SCHEDULER_NOTIFICATION_RETENTION_CRON` (default
`0 4 * * *`). Unread rows are never pruned — an unread notification is
undelivered information, not stale storage.

## Consumers

- Organization: member added, organization created, invitation claimed (landed
  2026-11-14, Phase 5).
- Planned: sales invoice issued, document signature requested, licensing expiry.

## Tests

`apps/backend/test/unit/` (unit, no Postgres/Redis):

- `notification.exported-service.test.ts` — one job per recipient, duplicates
  collapsed, defaults filled, a queue outage swallowed, one failing recipient
  not dropping the others.
- `notification.worker.test.ts` — placeholder render (incl. a missing variable
  and a null template), deterministic `jobId` with no `:`, row created as
  `sent` with the rendered copy and tags, `notification.created` published, a
  missing template skipped, prune cutoff arithmetic.
- `notification.service.test.ts` — list scoped to the caller and mapped to the
  wire shape, `markRead` publishing `notification.updated` + the new unread
  count, another user's row rejected as 404 with nothing published.
- `notification.controller.test.ts` — the HTTP surface end to end through the
  real guard and service over a repository double: 401 envelope, caller-scoped
  list and ordering, `unreadOnly`, malformed page, unread count, mark read,
  another user's row → 404, non-uuid id → 400, `read-all`, plus the same 400
  asserted against a **listening** server (`.listen()` serves the compiled
  route, which is where the shared validation handler used to throw).
- `notification.producers.test.ts` — the three producer paths: `addMember`,
  `createOrganization` (creator vs nested active user), the invitation claim,
  and the outage contract exercised with the **real**
  `ExportedNotificationService` over a throwing dispatcher.

`apps/backend/test/unit/realtime.{hub,gateway}.test.ts` cover the transport the
worker publishes through (envelope, upgrade rejected without a session).
