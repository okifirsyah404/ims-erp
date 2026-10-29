<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# IMS / Entragate ERP — Agent Instructions

ERP for an Indonesian access-control business (hardware, software, installation,
maintenance, projects, subscriptions). Monorepo: Bun workspaces + Turborepo,
Elysia backend (`apps/backend`), React/TanStack web admin, Better Auth,
Drizzle ORM (Relational v2) on PostgreSQL.

This file is short on purpose. Detailed, evidence-based answers live in
`.agents/docs/`. Read in this order:

1. `.agents/docs/README.md` — navigation and resume reading order
2. `.agents/docs/project-audit.md` — what actually exists and what works
3. `.agents/docs/progress.md` — where work stopped; the next executable task
4. `.agents/docs/architecture.md` — boundaries you must not violate
5. `.agents/docs/runbook.md` — commands before you invent any

Read by need: `domain-map.md` (business ownership), `data-model.md` (schema),
`api-conventions.md`, `security-and-access.md`, `testing-strategy.md`,
`backlog.md` + `phases/` (planning), `decisions/` (ADR history),
`skills.md` (skill inventory).

## Starting work

- Base every session on `progress.md`'s **"Next executable task"**, claim it
  against `backlog.md` (stable `ERP-*` IDs), and respect the phase entry/exit
  criteria in `.agents/docs/phases/`. Do not jump forward over failing gates.
- Keep work small and verticals complete: a slice isn't done until backend,
  UI, migration, seed, and tests all reflect the same reality.

## Command status (learned the honest way)

**Verified** = actually executed here and the outcome recorded. Everything
else is *proposed*: verify before claiming it works. Full list with outcomes:
`runbook.md`.

| Command | Where | Status |
|---|---|---|
| `bun run dev` | repo root | ⚠️ proposed — runs turbo `start:dev` across workspaces |
| `bun install` / turbo tasks for build/dev | repo root | ⚠️ proposed — never run in this repo yet |
| `bunx drizzle-kit generate --config ./drizzle.config.ts` | `apps/backend` | ⚠️ proposed - migration journal state unverified; see `runbook.md` |
| `bun run drizzle:migrate` / `drizzle:seed` (scripts use `bunx --bun drizzle-kit`) | `apps/backend` | ✅ verified 2026-10-29 - migrations applied; seed idempotent (run twice); the `--bun` flag is required because the DB driver is `drizzle-orm/bun-sql` |

> The previous NestJS backend (`apps/backend-nest`, package `backend`) was
> deleted 2026-10-28; its verified-command history is superseded. Commands
> above are unverified against `apps/backend` until re-run and recorded
> in `runbook.md`.

## Hard rules

- **Stack is fixed.** Bun workspaces, Elysia backend (`apps/backend`),
  Better Auth (direct integration into the Elysia plugin chain), Drizzle ORM
  with the `node-postgres` driver, PostgreSQL, Bun `RedisClient` cache.
  Do not add a second ORM, auth system, or package manager. Do not fall back
  from Relational v2 (drizzle-orm 1.0.0-rc.5 channel) to v1 relations.
- **Domain boundaries.** `apps/backend/src/app/<domain>/` owns its
  domain. Routes/controllers do HTTP only; services own use cases;
  repositories own Drizzle queries. HTTP layer never imports Drizzle directly.
  Cross-domain access goes through exported service/contract APIs only —
  never another domain's repository.
- **Auth and ownership are server-side facts.** Every endpoint enforces
  role permissions and record ownership, including exports. Frontend permission
  checks are UX only.
- **Migrations are append-only.** Preserve historical migrations/snapshots.
  Generate new migrations with the script above, inspect the SQL, test against a
  disposable database (`drizzle-kit push` is for disposable DBs only). Never
  migrate a production database or run destructive operations against unknown
  `POSTGRES_URL` values.
- **Soft deletes.** Rows are never hard-deleted by feature code; master data
  referenced by financial transactions cannot be hard-deleted at all
  (`drizzle-soft-deletes` skill).
- **Datetimes.** All timestamps are unix milliseconds (`unix-timestamp.ts`
  custom types). Business dates are Asia/Jakarta; operational timestamps are UTC.
- **Money.** Ledger-grade amounts are exact integer IDR minor units
  (rupiah cents) — never floats (ADR-0002).
- **Timestamps in Better Auth options are seconds; Redis cache TTLs are
  milliseconds.** Do not mix units.
- **Secrets never committed or printed.** Inspect variable *names* only;
  redact connection strings and tokens in logs, docs, and reports.
- **Language.** All code comments, docs, and identifiers in English. Business
  UI copy defaults to Indonesian (preserve any established convention).
- **Honesty.** Never mark work implemented, verified, or accepted without
  evidence. Distinguish `planned / in-progress / implemented / verified /
  accepted / blocked`. Automated tests passing is not business acceptance.
- **Statuses live in `.agents/docs/progress.md` and `backlog.md`.** Update
  them (and `progress.md`'s "next task") when you stop working.

## Definition of done (per slice or task)

1. Code follows the boundaries above; TypeScript type checks pass.
2. `bun run lint` and workspace tests pass, or remaining failures are
   documented as pre-existing in `project-audit.md` with causes.
3. New schema changes have a generated, human-inspected migration applied
   to a disposable database.
4. Unit + integration coverage for authorization, ownership, and validation;
   any slice touching DB shape seeds idempotently (verify by running twice).
5. `progress.md` updated with exact commands and results; `backlog.md`
   statuses moved with evidence (and only to `accepted` on real reviewer
   approval).
6. The phase exit criteria in `.agents/docs/phases/<current-phase>.md` that
   apply to the task are all met, or the task is left explicitly partial.
7. No secrets printed or committed.

## How to update these docs

Update the existing file that owns the topic — do not create contradictory
duplicates. Keep documents short and synchronized with verified code. Meaningful
architectural choices get a short ADR in `.agents/docs/decisions/`. When a doc
and the code disagree, fix whichever is wrong and note it in `progress.md`.
Changes to the skill set go through the existing skill manager and must be
recorded in `skills.md` (source, version, hash) alongside `skills-lock.json`.
Nested `AGENTS.md` files are only added when directory-specific rules genuinely
help; keep this root file authoritative.
