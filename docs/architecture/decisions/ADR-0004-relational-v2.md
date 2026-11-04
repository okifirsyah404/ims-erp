# ADR-0004 — Drizzle Relational v2 (rc channel), Not v1 Relations

- **Status:** accepted (verified against installed version, 2026-10-25)
- **Context:** `drizzle-orm` is pinned at `1.0.0-rc.4` with Relational v2
  (`defineRelationsPart`, `r.one`) in active use in
  `src/providers/drizzle/schemas/*` and `drizzle.ts`. Better Auth's Drizzle
  adapter at 1.7.12 explicitly supports `>=1.0.0-rc.1 <2` and the code imports
  its `relations-v2` entrypoint (`schemaName: 'auth'`, `usePlural: true`).
- **Decision:** Relational v2 is the project's only relational API. New tables
  and relationships extend the existing v2 blocks; v1 `relations()` calls are
  prohibited anywhere in the schema sources.
- **Consequences:**
  - Relations complement (not replace) PostgreSQL FKs/unique/index DDL; both
    are authored deliberately in migrations.
  - rc-channel churn risk is tracked in `stack-compatibility.md`; upgrades
    require re-verifying queries and the adapter import path, plus a fresh
    disposable-DB migration run.
  - Never mix v1-era API usage (`.query` schema maps built differently) —
    code review checklist item.
- **Alternatives considered:**
  - Stay on 0.x stable with v1 relations (rejected: would discover/rework the
    existing verified v2 usage and mismatch the Better Auth adapter path the
    repository already depends on).
