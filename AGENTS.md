# IMS / Entragate ERP — Agent Instructions

ERP for an Indonesian access-control business (hardware, software, installation,
maintenance, projects, subscriptions). Monorepo: Bun workspaces + Turborepo,
Elysia backend (`apps/backend`), React/TanStack web admin, Better Auth,
Drizzle ORM (Relational v2) on PostgreSQL.

This file is short on purpose. Detailed, evidence-based answers live in
`docs/architecture/` (tech) and `docs/plan/` (planning/status). Read in this order:

1. `docs/architecture/README.md` — navigation and resume reading order (index)
2. `docs/architecture/project-audit.md` — what actually exists and what works
3. `docs/architecture/stack-compatibility.md` — exact resolved versions and risks
4. `docs/plan/progress.md` — where work stopped; the next executable task
5. `docs/architecture/architecture.md` — boundaries you must not violate
6. `docs/architecture/runbook.md` — commands before you invent any

Read by need: `docs/architecture/domain-map.md` (business ownership),
`docs/architecture/data-model.md` (schema), `docs/architecture/api-conventions.md`,
`docs/architecture/security-and-access.md`, `docs/architecture/testing-strategy.md`,
`docs/plan/backlog.md` + `docs/plan/phases/` (planning),
`docs/architecture/modules/` (per-module boundaries and
state), `docs/architecture/decisions/` (ADR history),
`.agents/docs/skills.md` (skill inventory).

## Starting work

- Base every session on `progress.md`'s **"Next executable task"**, claim it
  against `backlog.md` (stable `ERP-*` IDs), and respect the phase entry/exit
  criteria in `docs/plan/phases/`. Do not jump forward over failing gates.
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
| `bun run lint` / `test` / `typecheck`                           | repo root, fans out per workspace | ✅ verified 2026-11-02 — backend 131/131, web-admin 21/21, typecheck clean                                                                                                                 |
| `bun run drizzle:generate` / `drizzle:migrate` / `drizzle:seed` | `apps/backend`                    | ✅ verified 2026-10-29/30 — migrations applied; seed idempotent (run twice). All use `bunx --bun drizzle-kit`; the `--bun` flag is required because the DB driver is `drizzle-orm/bun-sql`. Seed content is faker-generated (deterministic, `faker.seed`) since 2026-11-03; re-verified 2026-11-03 with `@faker-js/faker@10.6.0` |

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
- **Domain boundaries.** `apps/backend/src/app/<module>/` owns its module.
  Controllers do HTTP only; services own use cases; repositories own Drizzle
  queries. No controller or service may inject `DRIZZLE_TOKEN` — if a service
  needs data it does not have, add a repository method, not a query.
  Cross-module access goes through the owning module's exported contract or
  service via DI token, never another module's repository.
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
- **Statuses live in `docs/plan/progress.md` and `docs/plan/backlog.md`.** Update
  them (and `progress.md`'s "next task") when you stop working.

## Backend (`apps/backend`)

Boundary changes are reviewed against four skills. Read the relevant one
**before** editing a module, not after:

| Skill                       | Governs                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `elysia-module`             | module folder set, one Postgres schema per module, what may cross a boundary |
| `elysia-layered-architecture` | controller/service/repository split, `errors/`, `adapters/` (external-system ports), queues, optional `middleware/` and `utils/` |
| `elysia-tsyringe`           | module containers, composition root, resolve at the HTTP boundary            |
| `tsyringe`                  | `InjectionToken<T>` typing, constructor injection, lifetimes                 |
| `faker`                     | `@faker-js/faker` in database seeders: determinism (`faker.seed`), anchor-based idempotency, column-type mapping, what must never be faker-generated |

**Module shape.** `app/<module>/` = `container.ts` exporting
`register<Module>(container)`, optional `index.ts` public entry, `contracts/`
(interfaces + zod), `constants/di.ts`, `repositories/`, `services/`
(`*.service.ts` files only), `controllers/`, `errors/`
(`*.errors.ts`, domain errors extending `AppError`), optional `adapters/`
(external-system port implementations, no file suffix — "gateway" naming
is reserved for websocket gateways), optional `utils/` (pure helpers),
optional `middleware/` (module middleware/hooks; reserved — create only
when needed), optional `queues/`. Controllers only — there is **no
`routes/` directory**.

**Registration and mounting are split across two files.** `src/index.ts`
calls each `register<Module>(container)` and applies the cross-cutting
plugins (i18n, CORS, logger) before `.listen()`. `src/app/app.ts` owns every
`.use(<Module>Controller.plugin())` inside a `createApp()` **factory** — not
a module-level `const app`. Controllers resolve inside `plugin()`, so the
container must be populated first; an eagerly-built instance would make
correctness depend on hoisted import order between the two files. Adding an
endpoint means registering in `index.ts`, mounting in `app/app.ts`.

**Shared layers — never re-implement per module:**

- `src/http/response.ts` — `ok` / `created` / `noContent` / `okPaginated` /
  `errorEnvelope`. Success envelopes omit `errors`; `errorEnvelope` always
  carries it. `noContent()` returns **200**, not 204, so existing clients keep
  parsing.
- `src/http/errors.ts` — `AppError` base, `DomainHttpError`,
  `NotGlobalAdminError`, `toErrorResponse`. New domain errors extend `AppError`.
- `src/http/plugin.ts` — `domainPlugin({ name, prefix, tags, guards })`. Never
  hand-roll `new Elysia()` plus guard wiring. Guards:
  `none | session | erp | erp+session`.
- `src/di/tokens.ts` — `DRIZZLE_TOKEN` / `REDIS_TOKEN`, re-exported by
  `di/provider.ts`. Token types come from the real contract; a bare `Symbol()`
  without `InjectionToken<T>` is a defect.

**URL layout.** Admin surfaces live under `/admin/*` (`/admin/users`,
`/admin/roles`, `/admin/audit`, `/admin/invitations`). Self-service `/users/me*`
and the public `/invitations/claim/:token`, `/username-availability` stay
un-prefixed — they must not inherit the admin guard. Route moves change the
backend **and** `apps/web-admin` (typed calls, sidebars, `routeTree.gen.ts` in
the same change); a backend-only move is an incomplete change.

## Feature module lifecycle

Creating, updating, or deleting a feature module — and any backend feature
work that adds or changes endpoints, services, repositories, Drizzle schemas,
or migrations — passes through two gates **before** code and one **after** it.
The schema contract is 253 tables across 24 modules; nobody holds it in their
head, and inventing a column or a cross-module link is the most expensive
mistake available here.

**Gate 1 — read `docs/database/` first.** The read protocol is owned by the
`erp-database-schema` skill; follow its order:

1. `docs/database/docs.dbml` — canonical persistence contract. Never read its
   ~7,300 lines linearly: `grep -n "^// MODULE:" docs/database/docs.dbml`,
   then read the header note and the tables of your module plus the tables of
   any module you reference.
2. `docs/database/module-ownership.md` — who owns which schema, the cross-module
   contract methods (`resolveX` / `assertXOwnedBy`), the one two-schema
   exception (Inventory: `warehouse` + `inventory`).
3. `docs/database/integrity-and-consistency.md` — FK policy, soft delete,
   uniqueness, concurrency, status vocabularies.
4. `docs/database/data-dictionary.md` — column conventions (uuid pk, tenant
   column, datetimes, money, quantity, codes).
5. `docs/database/logical-references.md` — mandatory when the change crosses a
   module boundary.
6. `docs/database/implementation-phases.md` — only when the task depends on a
   step that has not landed yet.

Say which of these you skipped and why. `docs/database/docs.dbml` is canonical:
when a Drizzle schema file and `docs.dbml` disagree, `docs.dbml` wins and the
Drizzle file is the bug.

**Gate 2 — grill the design with the `grill-me` skill.** Run
`.agents/skills/grill-me` on the plan before writing code: a relentless
interview to sharpen a design, not a rubber stamp. Its frontmatter sets
`disable-model-invocation: true`, so it must be invoked explicitly — that is
what this rule is for.

- Its `SKILL.md` delegates to a `grilling` skill that is **not installed in
  this repo**. If `grilling` is unavailable, run the same relentless-question
  pass manually over: module ownership, tenant scoping (`organization_id`),
  soft delete (`deleted_at`), money/datetime/bigint column types, cross-module
  contract methods for every logical reference, and status vocabulary. Record
  the resolved answers before implementing.

**After implementation — `docs/database/` is updated when required.** "May" is
not permission to skip; it is the condition below. A docs update is **required**
when the change:

- adds, changes, or removes a table, column, index, or constraint, or moves a
  table between schemas;
- adds a cross-module link — a plain id column carrying the standard logical
  reference note and a contract method on the owning side;
- changes a status vocabulary, a money/quantity/date column type, or a
  lifecycle rule.

When none of those changed, record one line in `progress.md` stating
`docs/database/` was reviewed and is unchanged. **Deleting a module** also
means removing its tables from `docs.dbml`, re-running both generators, and
deleting its locale keys — an orphaned table or logical reference left behind
is an incomplete deletion.

**Sync-back order — always this order:**

```text
edit docs/database/docs.dbml   # canonical; edit before Drizzle
bun docs/database/gen-logical-references.ts
bun docs/database/validate-dbml.ts   # must print OK: 0 cross-module refs, 0 timestamp gaps
```

A non-zero exit from `validate-dbml.ts` means the module work is not done.
Migrations remain append-only (see **Hard rules** above); `docs.dbml` describes
the target, and each migration step lands its module in one append-only step.

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
6. The phase exit criteria in `docs/plan/phases/<current-phase>.md` that
   apply to the task are all met, or the task is left explicitly partial.
7. No secrets printed or committed.
8. The **Feature module lifecycle** gates were respected: `docs/database/` was
   read and the `grill-me` pass (or its documented manual fallback) completed
   before coding, with its answers recorded.
9. `docs/database/docs.dbml` is updated, or `progress.md` records that it was
   reviewed and needed no change — and `bun docs/database/validate-dbml.ts`
   printed `OK`.
10. A deleted module leaves no orphaned tables, logical references, locale
    keys, container registrations, or mounts.

## How to update these docs

Update the existing file that owns the topic — do not create contradictory
duplicates. Keep documents short and synchronized with verified code. Meaningful
architectural choices get a short ADR in `docs/architecture/decisions/`. When a doc
and the code disagree, fix whichever is wrong and note it in `progress.md`.

`docs/database/` is the persistence contract and is updated in the **same**
change as any structural change to a module — never in a follow-up commit.
Edit `docs.dbml` before the Drizzle schemas, because it is canonical, then run
`gen-logical-references.ts` and `validate-dbml.ts` (see **Feature module
lifecycle**).

Changes to the skill set go through the existing skill manager and must be
recorded in `skills.md` (source, version, hash) alongside `skills-lock.json`.
The backend skills are `elysia-module`, `elysia-layered-architecture`,
`elysia-tsyringe` and `tsyringe`; read the matching one before changing a
module's boundaries. Nested `AGENTS.md` files are only added when
directory-specific rules genuinely help; keep this root file authoritative.

## Git and GitHub

- `conventional-commit` — use when the user asks for a conventional commit:
  writes `type(scope): description` messages per the Conventional Commits spec.
- `git-commit` — use when the user asks to commit or says "/commit": examines
  the diff, stages related files, writes the commit message, and runs
  `git commit`. Do not use it to push, open pull requests, rebase, or rewrite
  history.
- `github-issues` — use for any GitHub issue management: create/update issues,
  labels, assignees, milestones, issue types, and dependencies
  ("blocked by" / "blocking").

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
