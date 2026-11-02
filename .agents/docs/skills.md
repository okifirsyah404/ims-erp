# Agent Skills — Inventory and Verification

Reused the installed skill manager setup (`skills-lock.json`, `.agents/skills/`,
`.claude/skills/`) rather than installing a new one. No unreviewed remote scripts
were executed; no skills were installed during this docs phase.

## Lockfile

`skills-lock.json` (version 1) pins 12 skills by `source@sourceType: github`,
`skillPath`, and `computedHash`. Repositories referenced there:
`better-auth/skills`, `shadcn-ui/ui`,
`tanstack-skills/tanstack-skills`, `bm629/agent-skills`, `pproenca/dot-skills`.

## Inventory

Status legend: **installed** (present on disk, hash-tracked in lock), **present,
not in lock** (local/project-specific additions), **n/a** (not installed).

| Skill | Status | Purpose / source |
|---|---|---|
| better-auth-best-practices | installed | Better Auth config, plugins, sessions (better-auth/skills) |
| better-auth-security-best-practices | installed | rate limiting, secrets, CSRF, cookies, audit (better-auth/skills) |
| email-and-password-best-practices | installed | verification, reset flows, password policy (better-auth/skills) |
| organization-best-practices | installed | Better Auth organization plugin, RBAC (better-auth/skills) |
| drizzle-unix-timestamp | present, not in lock | project datetime convention (bigint ms, `unix-timestamp.ts`) |
| drizzle-soft-deletes | present, not in lock | `deleted_at` never-hard-delete convention |
| bun-test | present, not in lock | `bun test` conventions: mocked DB/Redis via constructor injection, no network (local, https://bun.com/docs/test) |
| tsyringe | present, not in lock | project DI convention: Symbol tokens, composition root, transient default, resolution at HTTP boundary (local) — v1.1.0 (2026-11-02): rule 2.1 corrected — the `reflect-metadata` polyfill **is** required on Bun (tsyringe throws at load without `Reflect.getMetadata`); the earlier "Bun needs no polyfill" claim was wrong and broke boot when removed |
| dbml-database-docs | present, not in lock | DBML as canonical schema-doc format; `docs/database/docs.dbml` (local; format skill) |
| erp-database-schema | present, not in lock | project schema reader: read protocol over `docs/database/` before any DB-touching work (local) |
| grill-me | present, not in lock | planning aid: a relentless interview to sharpen a plan before implementation; `disable-model-invocation: true`, so agents must be told to run it (requirement in root `AGENTS.md`, **Feature module lifecycle**). Its `SKILL.md` delegates to a `grilling` skill that is **not installed in this repo** — until it is, the interview must be run manually |
| elysia-layered-architecture | present, not in lock | controller/service/repository layering per Elysia domain (local) — v1.1.0 (2026-10-30): external-system ports in contracts/, module-owned queues/, `/me`-before-`/:id` ordering + `erp: {}` macro typing quirk; user module as secondary example. v1.2.0 (2026-11-02): background-job lifecycle is module-owned (worker handle `{ onError, close }` exported from the module, not mounted on `app/app.ts`). v1.3.0 (2026-11-02): handles aggregate through `@providers/queue/worker-registry` (`startWorkers`/`stopWorkers`, `allSettled`) |
| elysia-module | present, not in lock | modular monolith boundaries, one schema per module (local) — v1.1.0 (2026-10-30): write-surface invariant for auth-projecting repos (user = `deletedAt`-only, rest via Better Auth gateway), `@better-auth/cli` 1.4.x regression caveat, `queues/` in checklist; user module as secondary example. v1.2.0 (2026-11-02): new-module checklist §3.6 splits registration (`src/index.ts`) from mounting (`src/app/app.ts`). v1.3.0 (2026-11-02): module owns background-job lifecycle — export a worker handle (`{ onError, close }`) from `index.ts`; workers are never mounted on `src/app/app.ts`. v1.4.0 (2026-11-02): handles are registered in one `startWorkers([...])` array from `@providers/queue/worker-registry`; adding a queue is one array entry |
| elysia-tsyringe | present, not in lock | wiring Elysia controllers to tsyringe, plugin factories, DI tokens (local) — v1.1.0 (2026-11-02): controllers mount in `src/app/app.ts` via a `createApp()` factory, not in `src/index.ts`; rule 2.5 corrected — `reflect-metadata` is required on Bun because tsyringe's CJS entry checks `Reflect.getMetadata` at load |
| tanstack-router-auth | present, not in lock | web-admin authenticated-routes pattern: `_authed` guard + redirect preservation + `/users/me` session-user flow (local; derived from tanstack.com/router authenticated-routes guide, 2026-10-30) |
| elysiajs | env-provided | Elysia v2 routes/plugins/typed clients (not on disk) |
| zod | installed | schema validation, error handling (pproenca/dot-skills) |
| shadcn | installed | `packages/ui` component authoring (shadcn-ui/ui) |
| tanstack-router / -query / -form / -table / -devtools | installed (5 skills) | TanStack stack patterns (tanstack-skills/tanstack-skills) |
| tsdoc | installed | doc-comment conventions (bm629/agent-skills) |

## Coverage assessment for this project

- Monorepo maintenance: covered by repo conventions + Turborepo bundled docs
  (`AGENTS.md` managed block); no extra skill needed.
- Elysia, Drizzle (relations-v2, migrations), Better Auth (incl.
  organization plugin), React/TanStack, shadcn UI, zod: covered.
- **Removed with backend-nest:** NestJS skills
  (`nestjs-best-practices`, `nestjs-better-auth`, `nestjs-drizzle`,
  `nestjs-layered-architecture`) deleted alongside `apps/backend-nest`.
- **Intentionally omitted:** dedicated monorepo skill, dedicated
  testing-strategy skill, dedicated security-review skill. Testing/security
  rules live in `testing-strategy.md` and `security-and-access.md`; adding a
  redundant package would only add index noise. Revisit if a later phase
  (e.g., payroll/financial posting) needs a specialized skill.

## Phase-4 lessons (learned in the user-management build)

Recorded here so they are not re-learned. The Elysia skills were left at
v1.1.0 by decision — this section is the canonical record.

- **One owner per resource.** Two handlers for the same path do not "collide"
  and cannot be fixed by mount order. A plugin registered as
  `prefix: '/users'` + `.get('/')` creates the route `/users/`, which is a
  *distinct* route from `/users` — and Elysia serves `/users/` for a bare
  `/users` request, silently shadowing the literal one. Symptom: an endpoint
  answered by the wrong controller (the admin users table crashed on
  `user.organizations` being `undefined`). Fix by giving each resource a single
  owning controller, not by reordering `.use()` calls. A regression test should
  pin the response *shape* the consumer depends on.
- **Repository `update()` must not filter `deletedAt` when the service owns the
  revive decision.** Adding `deleted_at IS NULL` to an update predicate made the
  soft-delete revive path throw (`undefined is not an object ('role.id')`). Who
  may edit is a service-layer question (rank guard, system-role rules); the
  repository must not silently narrow the row set.
- **Schema validation is not the authorization boundary.** `rank` deliberately
  accepts 1–100 in the Zod schema so the escalation guard — not input
  validation — decides who may grant owner-level ranks. Never "harden" a schema
  by capping it below the guard, or privileged callers lose legitimate paths.


## Gaps

- No skill installed for PostgreSQL/SQL review beyond the Drizzle ones;
  rely on `data-model.md` and the testing strategy for now.
- `skills-lock.json` does not track the project-specific skills
  (`drizzle-unix-timestamp`, `drizzle-soft-deletes`, `bun-test`, `tsyringe`,
  `elysia-layered-architecture`, `elysia-module`, `elysia-tsyringe`,
  `tanstack-router-auth`, `dbml-database-docs`, `erp-database-schema`); they
  are intentionally local. Update the lockfile via its supported mechanism
  only if their provenance should be pinned.

## Rules

- Before running any skill CLI: verify the repo/source, read its `SKILL.md`,
  inspect install scripts, and pin a version/commit. Install at repository
  scope following the existing layout (`.agents/skills/` + lockfile entry +
  `.claude/skills/` when a Claude-consumable copy is needed).
- If network or a suitable skill is unavailable, fall back to official docs and
  record the gap here instead of claiming an install happened.
