# IMS / Entragate ERP — Agent Instructions

ERP for an Indonesian access-control business (hardware, software, installation,
maintenance, projects, subscriptions). Monorepo: Bun workspaces + Turborepo,
Elysia backend (`apps/backend`), React/TanStack web admin, Better Auth,
Drizzle ORM (Relational v2) on PostgreSQL.

This file is short on purpose. Detailed, evidence-based answers live in
`.agents/docs/`. Read in this order:

1. `.agents/docs/README.md` — navigation and resume reading order
2. `.agents/docs/project-audit.md` — what actually exists and what works
3. `.agents/docs/stack-compatibility.md` — exact resolved versions and risks
4. `.agents/docs/progress.md` — where work stopped; the next executable task
5. `.agents/docs/architecture.md` — boundaries you must not violate
6. `.agents/docs/runbook.md` — commands before you invent any

Read by need: `domain-map.md` (business ownership), `data-model.md` (schema),
`api-conventions.md`, `security-and-access.md`, `testing-strategy.md`,
`backlog.md` + `phases/` (planning), `modules/` (per-module boundaries and
state), `decisions/` (ADR history), `skills.md` (skill inventory).

## Starting work

- Base every session on `progress.md`'s **"Next executable task"**, claim it
  against `backlog.md` (stable `ERP-*` IDs), and respect the phase entry/exit
  criteria in `.agents/docs/phases/`. Do not jump forward over failing gates.
- Keep work small and verticals complete: a slice isn't done until backend,
  UI, migration, seed, and tests all reflect the same reality.

## Command status (learned the honest way)

**Verified** = actually executed here and the outcome recorded. Everything
else is _proposed_: verify before claiming it works. Full list with outcomes:
`runbook.md`.

| Command                                                         | Where                             | Status                                                                                                                                                                                     |
| --------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun install`                                                   | repo root                         | ✅ verified 2026-10-28/29 — clean installs (nest removal, dicebear add)                                                                                                                    |
| `bun run dev`                                                   | repo root                         | ✅ verified 2026-10-29 — `turbo run dev`; live HTTP bring-up (auth 200, Redis, 401 envelope)                                                                                               |
| `bun run lint` / `test` / `typecheck`                           | repo root, fans out per workspace | ✅ verified 2026-10-28→30 — backend 78/78 tests, typecheck clean                                                                                                                           |
| `bun run drizzle:generate` / `drizzle:migrate` / `drizzle:seed` | `apps/backend`                    | ✅ verified 2026-10-29/30 — migrations applied; seed idempotent (run twice). All use `bunx --bun drizzle-kit`; the `--bun` flag is required because the DB driver is `drizzle-orm/bun-sql` |

> The previous NestJS backend (`apps/backend-nest`, package `backend`) was
> deleted 2026-10-28; its verified-command history is superseded. Docker
> images/CI exist for deploy; local backend Dockerfile is still open work
> (see `runbook.md`, `backlog.md`).

## Hard rules

- **Stack is fixed.** Bun workspaces, Elysia backend (`apps/backend`),
  Better Auth (direct integration into the Elysia plugin chain), Drizzle ORM
  with the `bun-sql` driver (`drizzle-orm/bun-sql`), PostgreSQL, Bun
  `RedisClient` cache.
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
- **Never run `auth:generate`.** The `@better-auth/cli` 1.4.x generator
  regresses `apps/backend/drizzle/schemas/auth.schema.ts` (drops
  `pgSchema('auth')`, pluralized table names, and relations — verified
  2026-10-30). The script path is stale too. Change the auth schema via
  hand-written, append-only edits to that file instead, and keep
  `auth.schema.ts` aligned with the Better Auth core tables it mirrors.
- **Soft deletes.** Rows are never hard-deleted by feature code; master data
  referenced by financial transactions cannot be hard-deleted at all
  (`drizzle-soft-deletes` skill).
- **Datetimes.** All timestamps are unix milliseconds (`unix-timestamp.ts`
  custom types). Business dates are Asia/Jakarta; operational timestamps are UTC.
- **Money.** Ledger-grade amounts are exact integer IDR minor units
  (rupiah cents) — never floats (ADR-0002).
- **Timestamps in Better Auth options are seconds; Redis cache TTLs are
  milliseconds.** Do not mix units.
- **Secrets never committed or printed.** Inspect variable _names_ only;
  redact connection strings and tokens in logs, docs, and reports.
- **Language.** All code comments, docs, and identifiers in English. Business
  UI copy defaults to Indonesian (preserve any established convention).
- **User-facing text is translated, never hardcoded.** Every string shown in
  `apps/web-admin` must exist in **both** English (`en`) and Indonesian (`id`).
  See "Internationalization" below.
- **Honesty.** Never mark work implemented, verified, or accepted without
  evidence. Distinguish `planned / in-progress / implemented / verified /
accepted / blocked`. Automated tests passing is not business acceptance.
- **Statuses live in `.agents/docs/progress.md` and `backlog.md`.** Update
  them (and `progress.md`'s "next task") when you stop working.

## Internationalization

Web admin text is translated at runtime with `react-i18next`. English and
Indonesian are the only supported languages — a string that exists in only one
of them is a bug, not a partial state.

**Layout.** Translations live in the `@ims-erp/locales` workspace package
(`packages/locales`), not inside the app:

- `packages/locales/src/en/<ns>.ts` — English bundles, **the source of truth**.
  Authored as flat dot-keys in an `as const` object:
  `'notFound.title': 'Page not found'`.
- `packages/locales/src/id/<ns>.ts` — Indonesian bundles, typed as
  `Record<keyof typeof en, string>` so the key set must match `en` exactly.
  **Never type an `id` bundle as `typeof en`** — that makes values literal
  types and breaks translation.
- Namespaces: `common`, `nav`, `auth`, `account`, `admin`.

**Adding or changing a key.** Edit the `en` bundle, then the `id` bundle. Both
are required. `packages/locales/src/locale-parity.test.ts` enforces key-set
parity, no empty values, matching `{{placeholder}}` sets, and a
no-untranslated-copy guard (`ALLOWED_IDENTICAL` lists keys legitimately
identical in both languages, e.g. "Email").

**Removing a key.** `packages/locales/src/locale-dead-keys.test.ts` scans
`apps/web-admin/src` for key usage and fails on keys present in the bundles but
never referenced. Composed keys (e.g. `` `common:status.${status}` ``) are
declared in its `DYNAMIC_PREFIXES` list.

**Type safety.** Key strings are typed, with no codegen:
`packages/locales/src/i18next.d.ts` augments i18next's `ResourceNamespaceMap`
with `typeof en.<ns>`, so a typo in a key, or a key used under the wrong
namespace, is a compile error. `strictInterpolationChecks` makes a key
containing `{{vars}}` require those options at the call site.

Three things in that file are load-bearing and were learned the hard way —
do not "fix" them without re-verifying:

- `keySeparator: false` — bundles use flat dot-keys. With `'.'`, i18next walks
  `sessions` → `revokeAll`, finds nothing, and every `t()` return type silently
  degrades to `string`, disabling key and interpolation checks.
- `defaultNS: Namespace` — a single literal makes `t('x')` under
  `useTranslation('account')` resolve against that one namespace instead of the
  hook's scope, wrongly rejecting valid keys.
- The augmentation is delivered by a type-only import in
  `apps/web-admin/src/i18n/index.ts`
  (`import type {} from '@ims-erp/locales/i18next'`). A runtime side-effect
  import breaks `bun test` — a `.d.ts` has no runtime module.

**Conventions.**

- Module-level constant arrays cannot call `useTranslation`; store a typed key
  instead (`titleKey: NavKey`, `labelKey: AccountKey`) and resolve at render.
- Namespace-qualify only when the hook scope does not already cover it
  (`t('nav:organization.required')` from a hook scoped to
  `['admin', 'common']`).
- **Never** add a second `i18n.init()` — `i18n/index.ts` holds a single `ready`
  promise.
- Dates still use the browser default via `toLocaleString()`; they are not
  localised by `i18n`. Known, accepted gap.
- `apps/web-admin/src/components/sidebar.tsx` is dead code (unimported) and
  deliberately left untranslated.

**Verifying.** `bun run test` runs the locale guards (`packages/locales` has its
own `test` script). Green means parity across `en`/`id`, no dead keys, and typed
call sites.

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

<!-- BEGIN:turborepo-agent-rules -->

## This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
