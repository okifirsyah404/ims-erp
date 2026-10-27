# Progress

Latest verified state. Update this file every working session, including
exact commands and outcomes. `progress.md` lies are worse than missing code.

## Completed (this session — docs phase only, 2026-10-25)

- New local skill `nestjs-layered-architecture` (`.agents/skills/` +
  `.claude/skills/` mirror, recorded in `skills.md`): module layout, layer
  rules, DTO/contract patterns, soft-delete + cache repository patterns from
  `modules/user/`.
- Cross-feature isolation rule (modular monolith) added to that skill,
  `architecture.md` (module rules + ERP schema ownership), and root
  `AGENTS.md` hard rules: each feature module owns a Postgres schema
  (`customer.*`, `sales.*`, ...), no cross-feature FKs/joins/table imports,
  cross-module access only via exported `External<X>Service` facade; Better
  Auth `auth-schema` tables are the explicit shared-infrastructure exception
  (existing `erp.audit_logs.actor_id → auth users.id` FK allowed). Stop
  growing the shared `erp` schema; migrate existing feature tables as each
  feature is built.
- Audit evidence: only cross-boundary DB references found are
  `erp-schema.ts` → `auth-schema.ts` (`auditLogs.actorId` FK +
  `erpRelations`); module repositories each import only their own domain's
  schema. No violations beyond the documented exceptions.
- No code was changed; no database touched.

- Audited the repository (see `project-audit.md`) — evidence-based
  classification of all modules, with baseline commands executed.
- Wrote this documentation set: `README.md`, `project-audit.md`,
  `stack-compatibility.md`, `skills.md`, `architecture.md`, `domain-map.md`,
  `data-model.md`, `api-conventions.md`, `security-and-access.md`,
  `plan.md`, `backlog.md`, `testing-strategy.md`, `runbook.md`,
  `decisions/ADR-0001..0005`, `phases/phase-1..7` — plus rewrote root
  `AGENTS.md` (Turborepo managed block preserved).
- Pin decisions recorded: ADR-0001 (one company, internal multi-organization),
  ADR-0002 (money = integer IDR minor units), ADR-0003 (structured Indonesian
  address references), ADR-0004 (Relational v2), ADR-0005 (drizzle client DI).
- No code was changed; no skills installed; no database touched.

## Partially done (pre-existing, not touched this session)

- `user` domain: repository is complete and documented; controller/service are
  stubs; 2 specs failing.
- `customer` domain: schema/migration real; code scaffold-level.
- Auth: configuration complete; runtime unverified.

## Blocked

- ERP-0003 runtime sign-off needs a real dev server + DB (available locally —
  unblocked for next session, pending execution).

## Latest checks (exact commands, 2026-10-25)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, 6 warnings (empty `role-permission.ts`, unused imports/params) |
| `bunx vitest run` (apps/backend) | 7 failed / 25 passed files; 2 failed / 25 passed tests — all pre-existing; causes in `project-audit.md` |
| `bun run test` (repo root) | fail (backend red) |

## Latest checks (exact commands, 2026-10-27)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, warnings (empty files, unused vars — pre-existing set) |
| `bunx vitest run` (apps/backend) | **no spec files found** — all `src/**/*.spec.ts` gone from tree since 2026-10-25 baseline (only `test/app.e2e-spec.ts` remains, needs e2e config). Not caused by Dockerfile work. |
| `bunx tsc -p tsconfig.build.json` (apps/backend) | pass; grep of fresh `dist/` shows zero `@providers/@config/@modules` alias imports |
| `docker build -f apps/backend/Dockerfile .` (repo root) | **blocked** — Docker daemon not running during session; image build unverified |

### Dockerfile slice (2026-10-27)

- Wrote `apps/backend/Dockerfile` (bun 1.4-alpine multi-stage: deps →
  `nest build` → prod-only runtime, non-root `USER bun`, port 3000) +
  `apps/backend/Dockerfile.dockerignore`.
- Replaced 3 `@providers/...` alias imports with relative paths
  (`bootstrap.module.ts`, `mail-queue.service.ts`, `mail.processor.ts`) so
  compiled `dist/` resolves at runtime.
- `config.loader.ts`: missing `.env` (ENOENT) no longer throws — compose
  injects env vars; avoids hard dependency on a `.env` file in containers.
- Image build + container boot **verified** (2026-10-27):
  `docker build -f apps/backend/Dockerfile .` succeeds; running the image
  with env-only config bootstraps all Nest modules (no `.env`, no aliases in
  `dist/`, decorator DI works under Bun). Full compose boot against real
  Postgres/Redis still unverified. Dockerfile gotchas fixed during build:
  `!apps/web-admin/package.json` needed in dockerignore (lockfile lists all
  workspaces), `--ignore-scripts` needed (root `prepare: husky` fails in
  prod-only install), runtime must `COPY --from=build` (not host `dist/`).

## Next executable task

**ERP-0002 → ERP-0003 → ERP-0004/0005**: implement
`src/core/authorization/{permissions.ts, authorization.service.ts}` to make
the pre-written specs pass, build the `modules/auth` skeleton until the two
auth suites pass, then start the customer slice (backend first, per backlog
owners). Do not branch off to other domains before the slice completes.
Note: spec files disappeared from the tree since the 2026-10-25 baseline —
restore/clarify before resuming this task. Remaining for Dockerfile slice:
compose boot against real Postgres/Redis; HEALTHCHECK once a health
endpoint exists.
