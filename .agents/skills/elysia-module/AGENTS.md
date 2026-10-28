# Elysia Module Boundaries (Modular Monolith)

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Modular monolith boundary convention for `apps/backend`. Each module under
`src/app/<module>/` owns exactly one Postgres schema declared in
`drizzle/schemas/<module>.schema.ts` (`pgSchema("<module>")`); foreign keys
exist only within a module's own schema — cross-module references are plain
id columns validated at the service layer. Modules import each other only
via type-only schema row types and public DI tokens
(`constants/di.ts`), and compose cross-module data by calling the owning
module's service, never by joining its tables. Exception: the `user` and
`organization` modules have no schema of their own — Better Auth generates
and owns the `auth` schema's identity/tenant tables, and those modules
project over them through their own repositories. Contains 6 rules across
3 categories, prioritized by impact from critical (schema ownership, FK
policy, the auth exception) to incremental (new-module checklist).

---

## Table of Contents

1. [Persistence Boundaries](references/_sections.md#1-persistence-boundaries) — **CRITICAL**
   - 3.1 [One Module = One Postgres Schema = One Schema File](references/1-one-schema-per-module.md) — CRITICAL (Shared schemas couple migrations and block module extraction)
   - 3.2 [No FKs Across Schemas](references/2-no-cross-schema-fks.md) — CRITICAL (Cross-schema FKs make deletion semantics invisible and migrations coordinated)
   - 3.3 [Identity Tables Belong to Auth; User & Organization Project](references/3-auth-identity-exception.md) — CRITICAL (Shadow copies of auth tables fork the source of truth)
2. [Cross-Module Access](references/_sections.md#2-cross-module-access) — **HIGH**
   - 3.4 [Cross-Module Imports: Schema Types and DI Tokens Only](references/4-cross-module-imports.md) — HIGH (Internal imports fork owners and crash Bun on type-only exports)
   - 3.5 [Cross-Module Data Access Goes Through the Owning Module](references/5-access-through-owner.md) — HIGH (Cross-schema joins re-couple modules at the query level)
3. [Lifecycle](references/_sections.md#3-lifecycle) — **MEDIUM**
   - 3.6 [New Module Checklist](references/6-new-module-checklist.md) — MEDIUM (Half-created modules and cross-module edits entangle early)

---

## References

1. [https://orm.drizzle.team/docs/postgresql-schema](https://orm.drizzle.team/docs/postgresql-schema)
2. [https://www.better-auth.com](https://www.better-auth.com)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version, dependencies, and reference URLs |
