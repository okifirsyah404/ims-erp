# Cutover - ERP-0088

Phase P8. Runs once every module phase (P1-P7) is green on the branch
`refactor(db)/schema-and-table-normalization`.

## 1. Baseline migrations (Q2, ADR-0024)

1. Move `apps/backend/database/migrations/*` to
   `apps/backend/database/migrations-archive/v1/` (kept for history, no longer
   applied). Remove the branching snapshot chain that blocks
   `drizzle:generate` today (`runbook.md` "BLOCKED on main since 2026-11-09").
2. Generate one baseline per schema with
   `bunx --bun drizzle-kit generate` (ADR-0019 per-schema naming), in the
   order location, auth, company, customer, supplier, inventory, sale,
   procurement, finance, tax, payment, project, ticket, human_resource,
   document, notification, audit, automation.
3. Inspect the SQL by hand: partial unique indexes, CHECKs,
   `NULLS NOT DISTINCT`, no cross-schema `REFERENCES` (grep
   `REFERENCES "(?!<same schema>)"`).
4. Apply to a **disposable** database (`database/migrate-reset.ts`), then
   `drizzle:generate` again must report no changes.

## 2. Seeders

- Rewrite `database/seeders/` per new module; deterministic faker
  (`faker.seed`), anchor-based idempotency (`faker` skill).
- Reference data (location tree, leave types, ticket types, status
  vocabularies, default `code_numberings` rows per schema) is fixed, never
  faker-generated.
- Run `bun run drizzle:seed` twice; second run inserts nothing.

## 3. URL aliases (Q34)

| Old URL | New URL | Caller |
|---|---|---|
| `/payments/gateway/*` webhooks | `/payments/webhooks/<provider>` | Xendit / SingaPay dashboards |
| `/licensing/v1/*` | `/projects/api/v1/licenses/*` | customer applications |
| `/public/v1/*` inquiries, catalog, render, documents | `/projects/public/v1/inquiries`, `/inventory/public/v1/catalog`, `/sales/public/v1/render/quotations`, `/documents/public/v1/shares` | web-landing deployments, sent links, n8n |
| `/integrations/whatsapp/*` | `/automation/webhooks/whatsapp` | WAHA / Meta / n8n |

Each alias mounts the same handler, is marked deprecated in OpenAPI and logs a
warning with the caller. Removal task: new backlog row after providers and
apps are reconfigured (checklist: update Xendit/SingaPay webhook URL, publish
license-client update, redeploy web-landing, update n8n HTTP nodes and WAHA
webhook).

## 4. Verification commands

```text
bun install --frozen-lockfile
bun run lint
bun run test
bun run typecheck
bun docs/database/gen-logical-references.ts
bun docs/database/validate-dbml.ts          # must print OK
cd apps/backend && bun run drizzle:migrate  # disposable DB
cd apps/backend && bun run drizzle:seed     # twice
```

Boundary checks (must return nothing):

```text
# a repository importing another module's schema file
rg -n "@drizzle/schemas/" apps/backend/src/app --glob "**/repositories/**" \
  | (per module: filter imports whose schema != module schema)
# leftovers of removed modules
rg -n "schemas/(accounting|aftersales|asset|catalog|code-number|crm|licensing|organization|portal|role|hr|sales|projects)\.schema" apps/backend
rg -n "/(service-tickets|warranty-certificates|leads|licenses|assets|borrowings|receipts|sales-returns|delivery-notes|purchase-orders|hr/)" apps/web-admin/src apps/web-customer-portal/src apps/web-landing/src
```

## 5. Documentation sync (same change as the code)

- `docs/database/docs.dbml` (canonical), `module-ownership.md`,
  `logical-references.md` (generated), `integrity-and-consistency.md`,
  `data-dictionary.md`, `implementation-phases.md`.
- `docs/architecture/architecture.md`, `domain-map.md`, `api-conventions.md`
  (URL layout), `modules/*` (rename/delete), `runbook.md` (generate unblocked),
  ADR-0024 status `accepted` on owner approval; ADR-0013 and ADR-0019 marked
  superseded in part.
- `.agents/skills/erp-database-schema` (module map) and `elysia-module`
  examples that name removed modules.
- `docs/plan/progress.md`, `backlog.md` (ERP-0070..0088), `plans/features.md`.
- `graphify update .` after code changes.

## 6. Merge

PR from the branch to `main` with the epic checklist; reviewer acceptance is
the only path to `accepted`.
