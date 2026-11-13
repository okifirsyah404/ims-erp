# WebSocket Notification Plan — Notification Module (Phase 0–9)

> Status: approved plan (sharpened through a grilling session)
> Scope: in-app notification inbox + the single realtime socket (`/ws`) + one
> notification module with a cross-module producer contract.
> Affected apps: backend (Elysia API) + `apps/web-admin` + `docs/`.
> Contract owner: ADR-0016.

## Implementation Status

Honest record. Phases 0–3 are done; no REST route, seeder or UI yet.

| Phase | State | Delivered |
|---|---|---|
| 0 | ✅ done | `docs/`: `docs.dbml` (schema `notification`, tables moved out of Automation), `module-ownership.md` (module 27), `implementation-phases.md`, `data-dictionary.md`, `logical-references.md` (regenerated), `modules/notification.md` (rewritten), ADR-0016 + index, `api-conventions.md`, this file, `backlog.md` `ERP-0047`, `features.md` |
| 1 | ✅ done | `drizzle/schemas/notification.schema.ts` + hand-written migration `20261113150000_erp0047_notification_schema`; applied through `drizzle:migrate-reset` |
| 2 | ✅ done | `/ws` transport: envelope, in-process hub, gateway, DI + mount |
| 3 | ✅ done | module core: repository, `NotificationService`, `ExportedNotificationService`, queue (`send`, `prune`), worker, config keys, composition root |
| 4 | planned | REST surface (list, unread count, read, read-all) |
| 5 | planned | producers (organization service, invitation claim) |
| 6 | planned | seeders (4 templates + demo rows) |
| 7 | planned | web admin (zustand store, header bell, `NavUser` move, locales) |
| 8 | planned | full verification + WS smoke test + two-session walkthrough |
| 9 | planned | close-out docs (`progress.md`, `backlog.md`, `features.md`, user guide) |

## Grilling outcome — locked decisions

| # | Decision |
|---|---|
| D1 | Persisted in-app notifications in a **new** `notification` schema (own module), not `automation`. |
| D2 | App-scope: **no `organization_id`** column. Organization context travels as a **tag** (organization name). |
| D3 | Row shape: `user_id` (not `recipient_user_id`), `template_code`, `title`, `body`, `tags` jsonb, `variables` jsonb, `metadata` jsonb, `channel`, `status`, `sent_at`, `read_at`, `source_type`, `source_id`, timestamps. |
| D4 | Client renders copy from `template_code` + `variables` via i18n; the server also stores the rendered English `title`/`body` as a fallback for non-UI consumers. |
| D5 | Producer is a **BullMQ job**, not a synchronous insert. The worker creates the row as `sent` (no `queued` round-trip) and pushes to the socket. |
| D6 | Single realtime socket at **`/ws`** for all features (notification now, chat later). Envelope `{ type, status, sentAt, data }`; `status` is `success`/`error` for the frame, `data.status` carries the row status. |
| D7 | Cross-module entry point is `ExportedNotificationService` via DI token — **not** an event emitter. |
| D8 | `template_code` format `module.event`, snake_case: `org.member_added`, `org.org_created`, `sales.invoice_issued`, `document.signature_requested`. |
| D9 | Zustand holds only ephemeral realtime state (connection status, buffer, optimistic badge); TanStack Query stays the owner of server data. |
| D10 | Prune is a BullMQ repeat job: **hard delete** `status='read'` rows past the retention window. |
| D11 | UI: bell icon-only + unread badge in the **header** (`main-layout.tsx`), popover with a scrollable list; `NavUser` moves to the header; `SidebarFooter` is removed. |
| D12 | Web Push / Push API is **out of scope**, recorded as a follow-up. |
| D13 | Notification is app-scope, so the endpoints ride the session guard only (no `erp` macro, no `x-organization-id`). |
| D14 | Fresh database is acceptable: `drizzle:migrate-reset` is allowed for this feature (local/dev only, no production exists). |

## Facts established during exploration (do not re-discover)

- `docs.dbml` originally owned `notification_templates` + `notifications` inside
  the tenant-scoped `automation` schema; Phase 0 moved them to `notification`.
- **Corrected:** there was no `apps/backend/src/app/notification/` module and no
  `notification.schema.ts` at exploration time; Phases 1 and 3 created both.
  Module count in the docs was 26, now 27.
- There is **no** WebSocket anywhere in the repo. **Corrected during Phase 2:**
  `elysia@1.4.31` needs no `websocket()` plugin (its `elysia/ws` module exports
  a handler *object*, and the Bun adapter installs its own handler in
  `Bun.serve`), and authentication cannot ride `beforeHandle` — a value
  returned there never reaches `ws.data`. `resolve({ as: 'local' })` is the
  hook that can. See the Phase 2 notes.
- `Bun.RedisClient` + BullMQ are already wired: `queueConnection` in
  `src/providers/queue/queue.connection.ts`, one-shot jobs follow
  `app/user/queues/avatar.queue.ts`, repeat jobs follow
  `providers/queue/inventory-scheduler.queue.ts` (`upsertJobScheduler` + a
  `SCHEDULER_*` cron in `config/schemas/config.schema.ts`).
- Workers run in the **same process** as the HTTP server (`src/index.ts` →
  `startWorkers(...)`), so an in-process hub can publish from the worker.
- `OrganizationService.addMember` creates membership directly for an existing
  active user (no invitation), so "added to an organization" is an immediate
  membership fact for that path.
- The web admin has `@tanstack/react-query` but **no** state library; `zustand`
  is not installed. `packages/ui` already ships `popover`, `badge` and
  `scroll-area`, so no new UI dependency is needed.
- The Bell menu item already exists in
  `apps/web-admin/src/components/sidebar/nav-user.tsx` with its navigation
  commented out, and `user.notifications` already exists in both locale
  bundles.
- Locales are TS objects in `packages/locales/src/{en,id}/` with parity and
  dead-key tests; `NAMESPACES` is a closed list and `DYNAMIC_PREFIXES` must
  learn any composed key prefix.

---

## Phase 0 — Docs & contract

**Work**

1. This file.
2. `docs/database/docs.dbml` — new `// MODULE: Notification (schema: notification)`
   section; both tables moved out of Automation; columns per D2/D3 (no
   `organization_id`, `recipient_type`, `recipient_value`, `subject`,
   `scheduled_at`, `error_message`; `recipient_user_id` → `user_id`; added
   `template_code`, `title`, `tags`, `variables`, `metadata`; template `code`
   unique without a tenant).
3. `docs/database/module-ownership.md` — module 27 row, Automation profile
   updated, Notification profile added, counts re-derived.
4. `docs/database/implementation-phases.md` — S6 loses the two tables, records
   that the module lands in this plan's Phase 1.
5. `docs/database/data-dictionary.md` — `jsonb` exception for notification
   payloads, app-scope carve-out, Notification glossary.
6. `docs/database/logical-references.md` — regenerated by script.
7. `docs/architecture/modules/notification.md` — rewritten (the old content was
   the deleted NestJS audit).
8. `docs/architecture/decisions/ADR-0016-notification-module-and-single-realtime-socket.md`
   + index row in `docs/architecture/README.md`.
9. `docs/architecture/api-conventions.md` — notification endpoint family and the
   socket envelope.
10. `docs/plan/backlog.md` — `ERP-0047`.
11. `docs/plan/plans/features.md` — notification feature entry.

**Exit criteria**

- `bun docs/database/validate-dbml.ts` → `parsed: 268 tables, 231 refs`,
  `cross-module refs: 0`, `timestamp gaps: 0`, `OK`.
- `bun docs/database/gen-logical-references.ts` → `524 refs across 41 targets`,
  and re-running it produces no further diff.
- No doc still places notification tables in `automation`.

---

## Phase 1 — Schema, migration, reset

**Work**

1. `apps/backend/drizzle/schemas/notification.schema.ts` — `notification`
   pgSchema; `notification_templates` + `notifications` exactly as `docs.dbml`;
   intra-schema FK `notifications.notification_template_id →
   notification_templates.id` (`on delete set null`); indexes on `user_id`,
   `(user_id, status)`, `created_at`, `status`,
   `notification_template_id`; checks for `channel` and `status`; unix-ms
   timestamps through the shared custom types.
2. One migration, **hand-written** like every migration since
   2026-11-13: the repo carries no drizzle-kit journal or snapshot, so
   `drizzle:generate` refuses with a pre-existing branch conflict and
   `drizzle:generate --fix-conflicts` would delete 14 existing migrations.
   Convention is `database/migrations/<timestamp>_<name>/migration.sql`,
   append-only, `CREATE ... IF NOT EXISTS`.
3. `bun run drizzle:migrate-reset` (D14).

**Exit criteria**

- The migration SQL contains only `CREATE SCHEMA "notification"`, the two
  tables, their indexes, checks and the one intra-schema FK. No `ALTER`
  against another schema.
- `migrate-reset` output recorded: schemas dropped, migrations applied, seed run.

**Done (2026-11-13).** `20261113150000_erp0047_notification_schema/migration.sql`.
Verified on the local database after `drizzle:migrate-reset`: tables
`notification_templates`, `notifications`; 9 indexes (including
`notification_templates_code_uq` partial on `deleted_at IS NULL`); 3 checks;
1 FK (`notifications_notification_template_id_fk`, `ON DELETE SET NULL`);
`bunx tsc -b --noEmit` clean.

---

## Phase 2 — Realtime transport (`/ws`)

**Work**

1. `src/providers/realtime/realtime.message.ts` — envelope type
   `{ type: string; status: 'success' | 'error'; sentAt: number; data: unknown }`
   plus a `realtimeMessage()` builder that stamps `sentAt`.
2. `src/providers/realtime/realtime.hub.ts` — `IRealtimeHub`
   (`register(wsId, userId, socket)`, `unregister(wsId)`,
   `publish(userId, message)`, `connectionCount(userId?)`),
   `REALTIME_HUB_TOKEN`, in-process `Map` implementation. Redis pub/sub is
   documented as required only when the API runs as more than one instance.
3. `src/providers/realtime/realtime.gateway.ts` — `.ws('/ws')`, session
   resolved in `resolve({ as: 'local' })` so the user id lands on `ws.data`,
   `open`/`close` register/unregister.
4. Register the hub in `src/di/provider.ts` (`useValue`, so it is one map);
   mount the gateway in `src/app/app.ts` before the feature modules.
5. `docs/architecture/runbook.md` — the nginx `Upgrade`/`Connection` headers a
   reverse proxy needs.

**Exit criteria**

- Upgrade with a valid session opens the socket; an upgrade without a cookie is
  rejected.
- Unit test: publishing to a fake socket yields the exact envelope shape.

**Done (2026-11-13).** Three files under `src/providers/realtime/`, hub
registered in `registerProvider`, gateway mounted in `createApp()`.
Two deviations from the plan text, both forced by Elysia 1.4.31:

- **No `websocket()` plugin.** `elysia/ws` exports a handler *object*, not a
  factory — `websocket()` throws `websocket is not a function`. The Bun adapter
  already passes its own handler to `Bun.serve`, so `.ws()` alone is correct.
- **Auth in `resolve({ as: 'local' })`, not `beforeHandle`.** Verified by probe:
  a value returned from `beforeHandle` does not reach `ws.data`, while a
  `resolve` return value does (`ws.data.realtimeUserId`).

Verified against a real listening server: upgrade without a session returns
`401` with the standard envelope; with a seeded admin session the socket opens;
`hub.publish` reaches the client with
`{ type, status, sentAt, data }`. `bun test` 883 pass / 0 fail (11 new),
`bunx tsc -b --noEmit` clean, `oxlint` clean.

---

## Phase 3 — Notification module core

**Work** (`apps/backend/src/app/notification/`)

1. `container.ts` (`registerNotification`), `index.ts` (`notificationModule()`,
   re-export `ExportedNotificationService` + `NOTIFICATION_SERVICE_TOKEN`).
2. `contracts/` — repository interface, service interface, zod schemas for the
   REST surface, `TNotification` row type.
3. `constants/di.ts`, `constants/tags.ts` (`NOTIFICATION_TAGS`).
4. `repositories/notification.repository.ts` — insert, find by id+user,
   paginated list by user, unread count, mark read, mark all read, prune.
5. `services/notification.service.ts` — use cases over repository + hub.
6. `services/exported-notification.service.ts` — `notify({ userIds, templateCode,
   variables, tags, sourceType?, sourceId? })`, enqueue-only, the single
   cross-module entry point; a queue failure is logged, never thrown into the
   caller.
7. `queues/notification.queue.ts` — queue `notification`, job names `send` and
   `prune`, deterministic `jobId`; `upsertJobScheduler` for `prune` driven by
   `SCHEDULER_NOTIFICATION_RETENTION_CRON` (default daily) and
   `NOTIFICATION_RETENTION_DAYS` (default 90) added to
   `config/schemas/config.schema.ts`.
8. `queues/notification.worker.ts` — `send`: resolve the template, render the
   English `title`/`body` from `variables`, insert the row as `sent` with
   `sent_at`, publish to the hub. `prune`: hard delete `read` rows past
   retention.
9. `errors/notification.errors.ts`.

**Exit criteria**

- Unit tests: enqueue payload, `jobId` dedupe, template render, prune
  selection — all with a mocked database.
- Worker started from `src/index.ts` through `startWorkers(...)`.

**Done (2026-11-13).** Files: `container.ts`, `index.ts`, `constants/di.ts`,
`contracts/{notification.repository.interface,notification.contract}.ts`,
`errors/notification.errors.ts`, `repositories/notification.repository.ts`,
`services/{notification,exported-notification}.service.ts`,
`queues/{notification.queue,notification.worker}.ts`.

Deviations from the plan text, all deliberate:

- **No `constants/tags.ts`.** `tags` is a free-form `string[]` produced by the
  caller (today: the organization name); a closed `NOTIFICATION_TAGS` list would
  have to be edited for every new tenant name, which is not a vocabulary.
- **No `notificationModule()` yet.** Phase 4 owns the controllers, and mounting
  an empty plugin would make `createApp()` claim a surface that does not exist.
- **`ExportedNotificationService` takes its dispatcher as a constructor
  parameter** (defaulting to the real queue). `mock.module` on the queue leaked
  into other test files in the same `bun test` run and silently replaced
  `notificationJobId` for the worker test; a seam is the honest fix.
- **The prune schedule rides `scheduler.enabled`**, like the inventory sweeps,
  so tests and one-off scripts never open a repeatable-job connection.
- **`jobId` suffix**: `sourceId` when the producer has one, else a djb2 hash of
  the sorted variables — a replayed producer call dedupes without colliding two
  organizations that share a template.

Verified: `bun test` 902 pass / 0 fail (19 new), `bunx tsc -b --noEmit` clean,
`oxlint` clean, locales 86 pass. Against the local database with the real
repository and hub: `send` inserted the row as `sent`, the recording socket got
`notification.created` with the rendered view, `listForUser` returned it,
`markRead` flipped it to `read` (another user's id returned `null`),
`countUnread` went 1 → 0, `prune(0 days)` removed exactly the read row.
`registerNotificationSchedules` produced one scheduler (`prune`, `0 4 * * *`)
and a second call left it at one.

---

## Phase 4 — REST surface

| Method | Path | Behaviour |
|---|---|---|
| GET | `/notifications` | paginated list for the caller, newest first |
| GET | `/notifications/unread-count` | `{ count }` |
| PATCH | `/notifications/:id/read` | 404 when the row is not the caller's |
| POST | `/notifications/read-all` | marks every unread row of the caller |

**Exit criteria**

- Cross-user access returns 404, not 403.
- Unauthenticated calls return the standard 401 envelope.
- Pagination and ordering covered by tests.

---

## Phase 5 — Producers

**Work**

1. `OrganizationService.addMember` → `org.member_added` (`variables`:
   `organizationName`, `role`; tag `[organizationName]`).
2. `OrganizationService.createOrganization` → nested attached users get
   `org.member_added`; the creator gets `org.org_created`.
3. Invitation claim success (membership actually created) → `org.member_added`.
   Never on invite send, never on a rejected or expired invitation.
4. All three go through `ExportedNotificationService` only.

**Exit criteria**

- Each path has a test asserting one enqueue with the right `templateCode`,
  recipient ids and tag.
- A queue outage does not fail the originating HTTP request.

---

## Phase 6 — Seeders

**Work**

1. `database/seeders/seed/notification-templates.ts` — four templates
   (`org.member_added`, `org.org_created`, `sales.invoice_issued`,
   `document.signature_requested`), English copy, anchor-based idempotency.
2. `database/seeders/seed/notification-demo.ts` — 2-3 demo rows for one fixed
   seed user (not every user, so unread badges stay meaningful).
3. Both wired into `database/seeders/index.ts` in dependency order.

**Exit criteria**

- Seeding twice produces identical row counts and no duplicate templates.

---

## Phase 7 — Web admin

**Work**

1. Add `zustand` to `apps/web-admin/package.json`.
2. `src/lib/realtime/{realtime-client.ts,realtime-store.ts,use-realtime.ts}` —
   one socket to `/ws`, exponential backoff reconnect, `type` → handler
   registry; the store holds connection status, buffered events and the
   optimistic badge. Mounted once in the `_authed` layout.
3. `src/lib/notification-api.ts` — query options + mutations, `setQueryData` /
   invalidate on socket events.
4. `src/components/notification/notification-bell.tsx` — icon-only `Button` +
   unread badge + `Popover` with a header, "mark all as read" and a scrollable
   item list; clicking an item marks it read and navigates from
   `source_type`/`source_id`.
5. `main-layout.tsx` — header becomes
   `[SidebarTrigger][Separator][Breadcrumb] .... [NotificationBell][NavUser]`.
6. `nav-user.tsx` — trigger becomes `Button variant='ghost'` (avatar + name
   `hidden md:block`), `ChevronsUpDown` and the "Notifications" item removed.
7. `main-sidebar.tsx` — `SidebarFooter` / `NavUser` removed.
8. Locales: new `notifications` namespace (`en` + `id`), registered in
   `NAMESPACES`, `en/index.ts`, `id/index.ts`; the now-dead
   `user.notifications` key removed from both `nav` bundles; `notifications:`
   added to `DYNAMIC_PREFIXES` in `locale-dead-keys.test.ts`.

**Exit criteria**

- Locale parity and dead-key tests green.
- The badge updates without polling and the socket reconnects after a drop.
- The popover is keyboard reachable and dismissible; no nested-button markup.

---

## Phase 8 — Verification

- `bunx tsc -b --noEmit` in `apps/backend` and `apps/web-admin`.
- `bun run test` (backend, web-admin, locales).
- `bun run lint`.
- `bun docs/database/validate-dbml.ts` → `OK`.
- `bun run drizzle:migrate-reset`, then seeding twice.
- `apps/backend/test/notification/realtime.smoke.test.ts` — connect with a
  session cookie, trigger a producer, receive
  `{ type: 'notification.created', status: 'success', sentAt, data }`.
- Manual two-session walkthrough: an admin adds a registered user to an
  organization → that user logs in → unread badge and popover item present;
  a second notification arrives live while the browser is open.

---

## Phase 9 — Close-out docs

- `docs/plan/progress.md` — dated entry per phase with exact commands.
- `docs/plan/backlog.md` — `ERP-0047` statuses moved with evidence.
- `docs/plan/plans/features.md` — rollup entry moved only at `verified`.
- `docs/user-guide/en.md` + `id.md` — how to read and mark notifications.

---

## Out of scope (recorded as follow-ups)

- Web Push / Notification API: needs VAPID keys, a service worker and a
  `push_subscriptions` table before it can reuse this inbox.
- Notification preferences per user; email / WhatsApp channels; template editor.
- Chat: the envelope reserves a `type` for it, but no chat plan exists yet.
- Redis pub/sub fanout: only required when the API runs as more than one
  instance.
