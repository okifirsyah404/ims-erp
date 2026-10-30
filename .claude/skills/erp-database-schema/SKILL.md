---
name: erp-database-schema
description: Project database schema reader for IMS/Entragate ERP. Read BEFORE writing or reviewing any Drizzle schema file, migration, module boundary change, cross-module reference, tenant scoping, soft-delete handling, money/date column, auth/organization/warehouse/ticket table, or any task touching apps/backend/drizzle/schemas/ or docs/database/. Loads the 24-module ownership map, timestamp/money/id conventions, and the cross-module logical-reference contract from docs/database/.
license: MIT
metadata:
  author: project
  version: "1.0"
---

# ERP Database Schema Reader

You must load the project's database schema documentation **before** writing
or reviewing any database-touching code. The schema contract is large (251
tables, 24 modules); nobody holds it in their head, and inventing columns or
references is the most expensive mistake an agent can make here.

## When this skill applies

Stop and run the read protocol below before any of these:

- Creating or editing a file in `apps/backend/drizzle/schemas/`.
- Writing or reviewing a migration, or running drizzle-kit commands.
- Adding/changing any table, column, index, or constraint in plan or code.
- Deciding where a new table belongs, or how two modules interact.
- Writing a service that reads or writes another module's data.
- Touching tenant scoping (`organization_id`), soft delete (`deleted_at`),
  money, or datetime columns.

## Read protocol

Read in this order. Skip only the ones marked optional for the task, and say
so when you do.

1. **`docs/database/docs.dbml`** — the canonical persistence contract.
   ~7,300 lines. Do NOT read it linearly. Find your module fast:

   ```text
   grep -n "^// MODULE:" docs/database/docs.dbml
   ```

   then read the module header comment and the tables of the module(s) your
   task touches, plus the target module's tables if you reference them.
   Also read the Project header note (top of file) for the global rules.

2. **`docs/database/module-ownership.md`** — who owns which schema, the
   cross-module contract methods (`resolveX` / `assertXOwnedBy`), and the one
   two-schema exception (Inventory: `warehouse` + `inventory`).

3. **`docs/database/integrity-and-consistency.md`** — FK policy, composite
   tenant foreign keys, soft-delete rules, uniqueness, concurrency (numbering,
   stock, ledger), status vocabularies.

4. **`docs/database/data-dictionary.md`** — column conventions, lifecycle
   sections, glossary. Read the sections relevant to your columns
   (money, dates, status) at minimum.

5. **`docs/database/logical-references.md`** — **mandatory when your change
   crosses a module boundary.** It lists every approved cross-module target,
   the owning module's contract method, and the standard column-note wording.
   A cross-module id column without the standard note is a bug.

6. **`docs/database/implementation-phases.md`** — optional; only when the
   task is about migration sequencing, phase entry/exit, or the constraint
   inventory (85 / 197 / 45).

## Hard rules to retain (verified against docs.dbml 2026-10-30)

1. **Module isolation.** A `Ref:` may only connect tables of one module.
   Cross-module links are plain id columns + the standard logical-reference
   note. Never invent a cross-module foreign key. One documented exception:
   `inventory.*` ↔ `warehouse.*` (same module, two schemas).
2. **Tenant scope.** `organization_id text NOT NULL` on every tenant-scoped
   table, logical ref to `auth.organizations.id`. The organization master is
   Better Auth's `auth.organizations` — never create `organization.organizations`.
3. **Datetimes.** `bigint` unix milliseconds (created_at/updated_at NOT NULL,
   deleted_at nullable). Never `timestamp`/`timestamptz` in new tables.
   Documented exemptions exist (append-only ledgers, projections, Better Auth
   core tables) — check before "fixing" one.
4. **Money.** `bigint` exact integer IDR minor units + `currency_code`.
   Never float, never `integer` (overflows above ~Rp 21.4 million).
5. **Soft delete.** `deleted_at bigint` on every business table; feature code
   never hard-deletes. Reusable codes get a planned partial unique index
   `WHERE deleted_at IS NULL` (implemented in Drizzle schemas, per S7).
6. **No native enums.** Status is `text` guarded by `Checks` blocks.
7. **IDs.** `uuid` pk, `uuidv7()` default, in new tables (Better Auth core
   tables use their own text ids — leave them alone).
8. **`auth` schema is shared.** 9 Better Auth core tables (regenerated, never
   hand-edited) + 6 ERP extension tables declared in `identity.schema.ts`
   under `pgSchema('auth')`.
9. **`docs.dbml` wins.** If code and DBML disagree, either the code is wrong
   or the DBML is stale — resolve the disagreement, do not code around it.

## Write-back rule

A structural change is not done until the docs match:

1. Update `docs/database/docs.dbml` (tables, columns, refs, notes) in the
   same unit of work as the Drizzle schema change.
2. Update the affected companion MD if the change touches ownership,
   integrity rules, or adds a cross-module reference (regenerate
   `logical-references.md` with `bun docs/database/gen-logical-references.ts`).
3. Run `bun docs/database/validate-dbml.ts` — must print `OK` (251+ tables,
   0 cross-module refs, 0 timestamp gaps). Nonzero exit = not done.

## Anti-patterns (symptoms of skipping the read)

- A cross-module `Ref:` or a cross-module id column missing its note.
- A new `timestamp`/`timestamptz` column, or a `bigint` money column renamed
  to `numeric`.
- Duplicating organization master data instead of referencing
  `auth.organizations.id`.
- Citing `postgresql-constraints.sql` or `docs.generated.sql` — both deleted;
  constraints now live in the Drizzle schemas (see implementation-phases S7).
- Renaming/moving files under `apps/backend/database/` (only migrations,
  seeders, migrate-reset.ts live there; docs live in `docs/database/`).

## Relation to dbml-database-docs

`dbml-database-docs` is the **format** skill: how to write and repair DBML.
This skill is the **project reader**: what is in this database and which rules
apply. Use both when the task changes database structure.
