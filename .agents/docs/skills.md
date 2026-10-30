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
| tsyringe | present, not in lock | project DI convention: Symbol tokens, composition root, transient default, resolution at HTTP boundary (local) |
| dbml-database-docs | present, not in lock | DBML as canonical schema-doc format; `docs/database/docs.dbml` (local; format skill) |
| erp-database-schema | present, not in lock | project schema reader: read protocol over `docs/database/` before any DB-touching work (local) |
| elysia-layered-architecture | present, not in lock | controller/service/repository layering per Elysia domain (local) |
| elysia-module | present, not in lock | modular monolith boundaries, one schema per module (local) |
| elysia-tsyringe | present, not in lock | wiring Elysia controllers to tsyringe, plugin factories, DI tokens (local) |
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

## Gaps

- No skill installed for PostgreSQL/SQL review beyond the Drizzle ones;
  rely on `data-model.md` and the testing strategy for now.
- `skills-lock.json` does not track the three project-specific skills
  (`drizzle-unix-timestamp`, `drizzle-soft-deletes`, `tsyringe`); they are
  intentionally local. Update the lockfile
  via its supported mechanism only if their provenance should be pinned.

## Rules

- Before running any skill CLI: verify the repo/source, read its `SKILL.md`,
  inspect install scripts, and pin a version/commit. Install at repository
  scope following the existing layout (`.agents/skills/` + lockfile entry +
  `.claude/skills/` when a Claude-consumable copy is needed).
- If network or a suitable skill is unavailable, fall back to official docs and
  record the gap here instead of claiming an install happened.
