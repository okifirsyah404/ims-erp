# ADR-0019 - Squashed per-Schema Migration Baseline

- **Status:** accepted (2026-11-14). Supersedes the migration *graph* introduced
  by the ERP-0011 merge and every hand-written append-only migration between
  2026-10-28 and 2026-11-14. Does not supersede any schema decision.
- **Context:** `drizzle-kit check` and `generate` were both broken, recorded as
  ERP-0052 and out of scope until now. The history had drifted away from a state
  drizzle-kit can reconstruct, for four independent reasons:
  1. **Eleven migrations carry no `snapshot.json`** (every hand-written one since
     `20261113150000`). `generate` only diffs against the *last* snapshot, so
     those changes were invisible to the graph.
  2. **`20261106170000_drop_merge_side_finance_receipts` has SQL but no snapshot.**
     It runs `DROP SCHEMA "finance" CASCADE`, so the deletion was never recorded.
     `20261106221731` then appears to *create* `finance.receipts` a second time,
     which is the "Two migrations gave one name to two different entities" error.
  3. **`drizzle-kit generate` emits a `base` snapshot, not a `diff`,** on this
     version (`1.0.0-rc.5`) whenever the out folder holds no snapshot yet, so a
     folder deleted before generation silently produces a full baseline.
  4. The chain accumulated 57 folders, 11 of them hand-written, and 52 migration
     names referenced by documentation that no longer describe the tree.

  The replay path (`bun run drizzle:migrate-reset`) kept working throughout, so
  the breakage was confined to snapshot generation and `check` - which is exactly
  what blocks authoring the *next* migration.

- **Decision:**
  1. **One migration per Postgres schema, 19 in total**, in dependency order:
     `auth` (with `role`, which extends `auth`), then `accounting`, `aftersales`,
     `assets`, `audit`, `code_number`, `company`, `crm`, `document`, `finance`,
     `hr`, `inventory`, `licensing`, `location`, `notification`, `organization`,
     `procurement`, `projects`, `sales`. Each folder adds exactly one schema, so a
     reader can still see where a table came from - the property the 57-folder
     chain had and a single squashed baseline would lose.
  2. **The baseline is generated from `drizzle/schemas`, not hand-assembled.**
     The first snapshot is a `base`; the following 18 are `diff` snapshots that
     chain through `prevIds`. `drizzle-kit check` and `generate` therefore agree
     with the schema folder by construction.
  3. **DDL the schema builder cannot express is appended to the migration that
     owns it**, never re-introduced as a separate hand-written folder. Two places
     need it today, both documented inline in the SQL:
     - `create_inventory_schema`: `NULLS NOT DISTINCT` on both `stock_balances`
       scope indexes, and the `deleted_at IS NULL` predicate on the two `items`
       code indexes.
     - `create_sales_schema`: the intra-module `sales.receipts` ->
       `sales.invoices` foreign key.
  4. **Cross-schema foreign keys are not recreated.** The chain carried
     `receipts_payment_id_payments_id_fkey` from `sales.receipts` to
     `finance.payments`, which violates `elysia-module` rule 3.2 and ADR-0014.
     `sales.schema.ts` already models `paymentId` as a plain id - the FK existed
     only because hand-written SQL added it. `payment_id` stays a nullable plain
     id validated through the Finance contract. This makes the database the first
     one in the project's history with **zero** cross-schema foreign keys.
  5. **`database/migrations` is replaced wholesale.** The 57 previous folders are
     removed from the tree; they remain reachable in git history. Historical
     entries in `docs/plan/progress.md` are append-only and keep the old names.
  6. **A database migrated by the old chain cannot be upgraded in place.** The
     first squashed migration starts with `CREATE SCHEMA`, which fails against an
     existing database. Such a database must be rebuilt with
     `bun run drizzle:migrate-reset`. This is acceptable because no production
     server exists yet.

- **Consequences:**
  - `bunx --bun drizzle-kit check` reports `Everything's fine` and
    `bunx --bun drizzle-kit generate` reports `No schema changes` against the
    repo's own `drizzle.config.ts` - the first time either has worked since the
    ERP-0011 merge.
  - Authoring the next migration is a normal `drizzle:generate` run again
    (ERP-0052 closed). Verified by probing: adding a column to
    `inventory.warehouses` produced exactly
    `ALTER TABLE "inventory"."warehouses" ADD COLUMN "probe_column" text;` and
    nothing else - `generate` diffs against the final snapshot, so the two
    hand-written index tails do **not** come back as spurious re-creations.
  - A fresh database still ends up with **116 tables (115 application + the
    `drizzle.__drizzle_migrations` journal), 19 schemas, 19 journal rows**. Table
    count matches the old chain exactly.
  - Two constraint *names* differ from the old chain: the `hr.employees` manager
    FK and the `notification.notifications` template FK now carry drizzle's
    auto-generated names instead of the hand-written ones. The constraints
    themselves are identical.
  - The `items` code indexes keep the stricter `deleted_at IS NULL` predicate the
    live database already had. `inventory.schema.ts`'s `scopedUnique()` helper
    still does not model it, so the *snapshot* understates the indexes - but
    because `generate` diffs against the snapshot rather than the live database,
    it will not try to drop them. Modelling the predicate in the helper is still
    worth doing so the two stay in sync if those indexes are ever edited; it is
    not urgent and it was not introduced here.
  - Documentation that referenced deleted migration folders now refers to the
    per-schema folder that owns the same objects; `progress.md` history is
    untouched.

- **Alternatives considered:**
  - **Fix only the snapshot graph** (re-derive `20261106221731`'s snapshot so the
    duplicate disappears). Rejected: with 11 migrations lacking snapshots the
    graph cannot be reconstructed, and `generate` asked for 40 interactive
    rename/create hints once the immediate conflict was removed.
  - **One single squashed baseline.** Rejected: loses which schema introduced
    which table, and the user explicitly asked for one migration per schema.
  - **Keep the old folders alongside the baseline** (`migrations_legacy`).
    Rejected: dead SQL that `check` would have to be told to ignore, and the
    upgrade path still cannot work.
