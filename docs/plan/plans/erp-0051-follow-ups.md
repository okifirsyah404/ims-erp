# ERP-0051 Follow-ups After PR #101

> Status: **open**, written 2026-11-14. Nothing here blocks the merge of
> [#101](https://github.com/okifirsyah404/ims-erp/pull/101); one item (F1) is a
> real behaviour bug, the rest are documentation drift.
> Source: the delivery review of `refactor/app-roles-investor-customer`
> (14 commits, ERP-0051 + ERP-0048 + ERP-0052) and the first green CI run on
> that branch.
> Scope: `apps/web-admin` route guard, plus the documents that ADR-0017,
> ADR-0018 and ADR-0019 left behind.
> Backlog: **ERP-0053 … ERP-0058** (rows not yet added to `backlog.md`; see
> "Ledger status" at the end).

## Why this file exists

ERP-0051 is functionally complete and CI-verified: 1005 backend tests, 100
web-admin tests, 47/47 PIC smoke, 8/8 login-gate smoke, 7/7 browser scenarios,
migration replay from empty at 19 journal rows / 116 tables / 0 cross-schema
foreign keys. The gaps below are what the delivery left behind, not missing
features. They are recorded separately so `side-nav-role-based.md` can stay
closed instead of accumulating a "still open" tail.

## Summary

| ID | Item | Kind | Severity | Status |
|---|---|---|---|---|
| ERP-0053 | Route guard fails open for paths with no nav leaf | code | **real bug** | open |
| ERP-0054 | ADR-0018 status still `proposed` | docs | medium | open |
| ERP-0055 | Plan decision 6 contradicts the shipped Administration section | docs | low | open |
| ERP-0056 | `module-ownership.md` schema inventory stale | docs | medium | open |
| ERP-0057 | `progress.md` dev-database organization id stale | docs | low | open |
| ERP-0058 | `scopedUnique()` does not model `deleted_at IS NULL` | code | low | open |

ERP-0054 … ERP-0057 are one documentation commit. ERP-0053 and ERP-0058 are
code and should not ride along with it.

---

## ERP-0053 — Route guard fails open for paths with no nav leaf

**What.** `canOpenPath` allows any pathname that no nav leaf covers.

**Evidence.**

```ts
// apps/web-admin/src/lib/route-guard.ts:44-45
const leaf: SidebarItem | null = findNavLeaf(navSections, pathname);
if (!leaf || leaf.url === '/') return true;
```

`findNavLeaf` (`apps/web-admin/src/components/sidebar/filter-nav.ts:59-73`)
matches only an exact url or a `${url}/` prefix, so a route that no leaf
declares resolves to `null` and is allowed. Enumerated against the shipped
tree (80 nav urls, 131 routes under `routes/_authed`):

```
/admin/code-numbers          <- beforeLoad redirects to /settings/code-numbers
/admin/company               <- beforeLoad redirects to /settings/company
/inventory/items/$itemId     <- real page, no gate
/inventory/items/$itemId.edit <- real page, no gate
```

The first two are redirect stubs, so they are harmless. The item detail and
edit pages are not: the only nav leaf under `/inventory/items` is
`/inventory/items/new` with `permission: 'product.create'`
(`apps/web-admin/src/components/sidebar/nav-config.ts:149`), which does not
cover either path. `$itemId.tsx` gates only its edit button
(`usePermission('product.update')`, line 67); the page itself renders for any
signed-in user who types the URL. `$itemId.edit.tsx` has no gate at all.

**Why it matters.** Plan decision 8 says the route guard "checks the same
permission map as the nav". It does not, for these two routes. The backend
still refuses the data, so this is UX exposure, not a data leak — but it is
the one item here that changes behaviour.

**Fix.** Flip the default for paths under a section that has leaves. Two
options, in order of preference:

1. Give the detail and edit routes their own nav-declared rule. Either declare
   a hidden leaf (`url: '/inventory/items'`, `permission: 'product.read'`,
   `hidden: true`) so prefix matching covers both children, or add an explicit
   `pathRules` map in `route-guard.ts` next to the two existing special cases
   (`/organizations/new`, `/inventory/warehouses/new`).
2. If option 1 is not taken, make the fallback deny for `/inventory/*` and
   `/admin/*` only, leaving genuinely unmapped surfaces (future modules)
   allowed.

Do **not** simply change the fallback to `return false`: routes added before
their nav entry would start bouncing users, which is the failure mode decision
7 ("never hide everything during load") exists to prevent.

**Done when.** `apps/web-admin/test/unit/route-guard.test.ts` has a case for
`/inventory/items/<id>` and `/inventory/items/<id>/edit` — allowed with
`product.read`, redirected without it — and the redirect stubs
(`/documents`, `/admin`, `/admin/company`, `/admin/code-numbers`) still pass.

---

## ERP-0054 — ADR-0018 status still `proposed`

**What.** The record that introduced the app-role split and the login gate is
still marked proposed, while its code is shipped, tested and merged into this
PR.

**Evidence.**

```
docs/architecture/decisions/ADR-0018-investor-customer-app-roles.md:3
- **Status:** proposed (2026-11-14). Depends on ADR-0017 acceptance for the
  login-gate amendment in this record.
```

Its dependency is satisfied: ADR-0017 reads `accepted (2026-11-14),
implemented and verified (2026-11-14)`. `docs/plan/plans/features.md` already
lists the work as `verified`. Three documents, two answers.

**Fix.** Set the status to `accepted (2026-11-14), implemented and verified
(2026-11-14)` with the same evidence paragraph shape ADR-0017 uses, and drop
the "depends on acceptance" clause. `accepted` needs real reviewer sign-off per
`features.md`'s own rule — if that sign-off has not happened, the honest status
is `implemented` and `features.md` must be lowered to match, not the ADR
raised.

**Done when.** ADR-0018, `features.md` and `backlog.md` agree on one status.

---

## ERP-0055 — Plan decision 6 contradicts the shipped Administration section

**What.** The plan says the Administration section is app-admin only. The
shipped section is not.

**Evidence.**

```
docs/plan/plans/side-nav-role-based.md:41
| 6 | **Administration** section: app admins only (`appAdminOnly`), as today. |
```

```ts
// apps/web-admin/src/components/sidebar/nav-config.ts:280-286
labelKey: 'section.administration',
items: [
  { url: '/organizations', permission: 'organization.read' },
  { url: '/admin/users',    appAdminOnly: true },
  { url: '/admin/audit',    appAdminOnly: true },
],
```

The implementation looks deliberate rather than accidental:

- `GET /organizations` rides `erpSession` (session only), so any internal user
  may list; `GET /organizations/:id` requires `organization:read`
  (`apps/backend/src/app/organization/controllers/organization.controller.ts:74,145,159`).
- Organization `owner` and `admin` hold `organization: ['read', …]`
  (`packages/common/src/authorization/erp-permissions.ts:358,366`).
- The page gates only the create button (`hasRole(session.user.role, 'admin')`,
  `organizations/index.tsx:79`).

So the shipped behaviour matches the backend; decision 6 is the stale text,
written before the Settings/Administration reorganisation (ERP-0045c) moved
`/organizations` into this section.

**Fix.** Amend decision 6 rather than the code: "Administration section:
`/admin/users` and `/admin/audit` are app-admin-only; `/organizations` requires
`organization.read` in the active organization." Record the amendment in the
plan, not silently.

**Done when.** Decision 6 describes the tree that ships, and
`filter-nav.test.ts` covers all three items.

---

## ERP-0056 — `module-ownership.md` schema inventory stale

**What.** The document tells the reader the database has three schemas. It has
nineteen.

**Evidence.**

```
docs/database/module-ownership.md:402-408
The only schemas in the database today are `auth`, `location`
and `sales` (see `database/migrations/`). `audit.audit_logs` replaces the
planned `erp.audit_logs`; `crm.customers` replaces the planned
`erp.customers`; `investor.investors` replaces the planned `erp.investors`.
```

Measured against `ims_erp_local` and the squashed baseline:

```
accounting, aftersales, assets, audit, auth, code_number, company, crm,
document, drizzle, finance, hr, inventory, licensing, location,
notification, organization, procurement, projects, sales
```

There is also no `investor` schema at all, so `investor.investors` is wrong
twice over — the sentence both understates the schema count and points at a
schema that does not exist.

**Fix.** Replace the paragraph with the real inventory and keep the point it
was making (there is no `erp` schema): name the 19 application schemas, or
point at `docs/database/docs.dbml` as canonical and list only the ones the
`erp`-schema note is about. `bun docs/database/validate-dbml.ts` already
reports `269 tables, 232 refs`, which is the number to trust.

**Done when.** The sentence agrees with `docs.dbml` and with
`information_schema.schemata` on a freshly migrated database.

---

## ERP-0057 — `progress.md` dev-database organization id stale

**What.** The Phase 5 evidence quotes an organization id that no longer exists.

**Evidence.**

```
docs/plan/progress.md:207  `Entragate` = `LwhLYWKg7I9qkzTSHXPqQColX3To0u5r`.
docs/plan/progress.md:210  bun run scripts/smoke-warehouse-pic.ts LwhLYWKg7I9qkzTSHXPqQColX3To0u5r
```

Current `ims_erp_local`: `h7fUe07E5C4vzig3hE6yXzh73sM87EHs`. The id is random
per seed, so the recorded value was true when written and is misleading now —
anyone re-running the quoted command gets a 404-shaped failure and cannot tell
whether the script or the id is wrong.

**Fix.** Add a one-line note to that entry stating the id is per-build and must
be read from `auth.organizations` before running the smoke script; keep the
historical value as written (append-only, per the file's own rule) but make the
reader's next step unambiguous.

**Done when.** No entry in `progress.md` presents a seeded id as if it were
stable.

---

## ERP-0058 — `scopedUnique()` does not model `deleted_at IS NULL`

**What.** The schema helper emits two partial indexes; the live database has a
stricter predicate on the same two indexes. The snapshot therefore understates
them.

**Evidence.**

```ts
// apps/backend/drizzle/schemas/inventory.schema.ts:188-202
uniqueIndex(names.orgScoped).on(orgColumn, scopedColumn)
  .where(sql`organization_id IS NOT NULL`),
uniqueIndex(names.global).on(scopedColumn)
  .where(sql`organization_id IS NULL`),
```

Live indexes on `inventory.items`:

```
inventory_items_org_code_uq    :: (organization_id, code) WHERE ((deleted_at IS NULL) AND (organization_id IS NOT NULL))
inventory_items_global_code_uq :: (code)                  WHERE ((deleted_at IS NULL) AND (organization_id IS NULL))
```

**Why it matters.** Not an active bug, and ADR-0019 already records it as known
and not introduced there: `generate` diffs against the snapshot rather than the
live database, so it will not try to drop the predicate, and a probe
`drizzle:generate` against the squashed chain emitted only the probe's own
`ALTER TABLE`. The risk is future-facing — the day someone edits those indexes,
the snapshot and the database disagree about what the index means.

**Fix.** Add an optional `deletedAtColumn` argument to `scopedUnique` and
include `deleted_at IS NULL` in the `where` for the tables that carry it, then
`drizzle:generate` and confirm the emitted SQL is empty apart from any real
change. Keep the hand-written SQL in `create_inventory_schema` untouched
(migrations are append-only).

**Done when.** `generate` produces no diff, and a fresh `drizzle:migrate-reset`
still yields the same index definitions as the current database.

---

## Verified as intentional — do not re-open

Recorded so the next reader does not re-report them as guard holes:

| Surface | Why it is allowed |
|---|---|
| `/documents` | `beforeLoad` redirects to `/documents/files`; the leaf lives there. |
| `/admin` | Layout route with its own in-place 403 card (`admin.tsx`), not a page. |
| `/admin/company`, `/admin/code-numbers` | Redirect stubs to `/settings/*` (ERP-0045c move). |
| `/` | Always allowed on purpose — the Dashboard renders empty for a user without an internal role, so redirecting there would loop. |

## Ledger status

`backlog.md` does **not** have ERP-0053 … ERP-0058 rows yet. This file is the
recorded design; the rows and the `features.md` rollup move when work on them
starts, per the AGENTS.md rule that statuses live in `backlog.md`,
`progress.md` and `features.md`. If the ids above are reused for something else
first, renumber here rather than in `backlog.md`.

## Suggested order

1. **ERP-0053** — the only behaviour bug, and small: one guard branch plus two
   tests.
2. **ERP-0054 … ERP-0057** — one documentation commit; they are independent of
   each other and of the code.
3. **ERP-0058** — opportunistic; touch it when the item indexes are next
   edited, as ADR-0019 already allows.
