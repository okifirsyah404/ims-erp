# ADR-0016 - Notification Module and the Single Realtime Socket

- **Status:** accepted (2026-11-13). Supersedes the Automation ownership of
  `notification_templates` / `notifications` in `docs.dbml`. Does not change
  any other Automation table.
- **Context:** `docs/database/docs.dbml` placed notification templates and
  notifications inside the `automation` schema, which is tenant scoped
  (`organization_id NOT NULL` on every table). The feature that needs in-app
  notifications first is not tenant shaped: a user belongs to several
  organizations (ADR-0007/ADR-0012), the bell menu must show one list across
  all of them, and a notification produced by adding the user to organization
  B must still be visible after switching to organization A. A tenant column
  would either hide notifications on the wrong organization's context or force
  a fan-out row per organization for one event.
  Separately, the web admin had no realtime channel at all, and the obvious
  short-term shape - a socket per feature - would mean one connection per
  feature in the browser, multiplying handshakes, auth checks and reconnect
  logic for every feature added later (chat is already anticipated).

- **Decision:**
  1. **Notification is its own module, schema `notification`.** It owns
     `notification.notification_templates` and `notification.notifications`;
     the `automation` schema keeps integrations, credentials, workflows,
     scheduled jobs and the outbox. Module count becomes 27.
  2. **The module is app-scope.** No `organization_id` column. A notification
     belongs to one user (`user_id`, a logical reference to `auth.users.id`) and
     the list endpoint filters on `user_id` only. The organization context is
     carried as a display **tag** (the organization name). Scope reading rules
     of ADR-0008/ADR-0014 do not apply: there is no tenant column to read.
  3. **Copy is data, not code.** A row stores `template_code`
     (`module.event`, snake_case, prefix = owning module) plus `variables`;
     the client renders the localized copy from those, and the server stores
     the rendered English `title`/`body` as a fallback for consumers without a
     locale (email later, API clients).
  4. **One realtime socket for the whole application: `/ws`.** Every message is
     the envelope `{ type, status, sentAt, data }`, where `type` names the
     event (`notification.created`, later `chat.message`). A new realtime
     feature adds a `type` and a client-side handler; it never adds a socket,
     an auth path, or a reconnect loop.
  5. **Fanout starts in-process.** The hub keeps a `Map<userId, socket>` inside
     the API process, which is correct because the BullMQ worker runs in that
     same process. Redis pub/sub is the documented next step, required only when
     the API runs as more than one instance.
  6. **Delivery is queued, not inline.** Producers call
     `ExportedNotificationService.notify(...)`, which enqueues a BullMQ job and
     never throws into the caller's request. The worker creates the row as
     `status='sent'` and publishes to the hub; there is no `queued` round-trip
     for an in-app message.

- **Consequences:**
  - Cross-module notification is a single exported service with a DI token;
    no module may import another module's repository or reach for the queue
    directly.
  - Producers must pass display-ready tags; a recipient whose organization
    membership changes keeps the historical tag on old rows, which is correct -
    the notification records what happened, not the current state.
  - The `notification.*` tables are the first ERP tables exempt from the
    `organization_id` convention without being global master data (compare the
    scope carve-out in `data-dictionary.md`).
  - Web Push, email and WhatsApp channels are not covered; they attach to the
    same template/row model later.
  - The socket is unauthenticated at the protocol level and relies on the
    Better Auth session cookie presented at upgrade; a rejected upgrade is the
    only failure mode and it never reaches message handling.
