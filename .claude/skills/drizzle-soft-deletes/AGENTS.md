# Drizzle Soft Deletes

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Soft-delete convention for Drizzle ORM schemas in this project, built on the `drizzle-unix-timestamp` skill (depends on it for the datetime type). Rows are never hard-deleted by feature code; every deletable table carries a nullable `deleted_at` column — `unixTimestampNullable('deleted_at')`, bigint unix milliseconds. `NULL` = alive, a value = deleted at that instant; the timestamp doubles as the deletion audit, and there is no `isDeleted` boolean. Queries must filter `isNull(deletedAt)` (filtering will later be centralized by a repository pattern), unique constraints must be partial (`WHERE deleted_at IS NULL`) so deleted rows free their values, restore sets the column back to `NULL`, relational-query `with` has a known deleted-children leak, and scheduled purge jobs hard-delete past a retention window that must be defined per table. Contains 7 rules across 3 categories, prioritized by impact from critical (delete semantics) to incremental (purge).

---

## Table of Contents

1. [Column & Delete Semantics](references/_sections.md#1-column--delete-semantics) — **CRITICAL**
   - 1.1 [Every Deletable Table Gets a Nullable deleted_at](references/column-use-deleted-at.md) — CRITICAL (A boolean flag plus a timestamp is dual state that drifts; one column answers alive-or-deleted and when)
   - 1.2 [Every Query Filters isNull(deletedAt)](references/query-always-filter-deleted.md) — CRITICAL (Unfiltered selects, updates, and deletes silently resurrect deleted rows in lists, mutations, and uniqueness checks)
   - 1.3 [Feature Code Sets deletedAt — Hard DELETE Is Purge/Infra Only](references/delete-never-hard-delete.md) — CRITICAL (Hard deletes destroy history and orphan dependents; deletion is an update, recovery stays possible)
2. [Constraints & Recovery](references/_sections.md#2-constraints--recovery) — **HIGH**
   - 2.1 [Partial Unique Indexes](references/unique-constraint-partial.md) — HIGH (A full unique index turns a soft-deleted row into an invisible blocker — "email already exists" for a row nobody can see)
   - 2.2 [Restore Sets deletedAt Back to Null](references/restore-clears-timestamp.md) — HIGH (Companion restored/isRestored columns are redundant state that drifts; history belongs in an audit log)
3. [Leaks & Lifecycle](references/_sections.md#3-leaks--lifecycle) — **MEDIUM-HIGH**
   - 3.1 [Relational Query 'with' Leaks Deleted Children](references/relations-filter-deleted.md) — MEDIUM-HIGH (rqb-v2 `with` cannot filter per relation; nested deleted rows appear in payloads unless handled deliberately)
   - 3.2 [Purge Past a Per-Table Retention Window](references/purge-expired-rows.md) — MEDIUM (Soft-deleted rows accumulate forever without a purge; a global window is wrong for tables with different lifetimes)

---

## References

1. [drizzle-unix-timestamp skill](../drizzle-unix-timestamp/SKILL.md)
2. [https://orm.drizzle.team/docs/select](https://orm.drizzle.team/docs/select)
3. [https://orm.drizzle.team/docs/indexes-constraints](https://orm.drizzle.team/docs/indexes-constraints)
4. [https://orm.drizzle.team/docs/rqb-v2](https://orm.drizzle.team/docs/rqb-v2)
5. [https://orm.drizzle.team/docs/delete](https://orm.drizzle.team/docs/delete)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point (includes the convention column snippet) |
| [metadata.json](metadata.json) | Version and reference URLs |
