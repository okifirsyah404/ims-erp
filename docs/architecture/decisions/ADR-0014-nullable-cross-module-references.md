# ADR-0014 — Nullable Cross-Module References

- **Status:** accepted (2026-11-08). Applies to every logical reference that
  crosses a module boundary, including references into `auth`. Does not
  change intra-module foreign keys.
- **Context:** Cross-module integrity is enforced at the service layer by
  design (`elysia-module` rule 3.2: no FKs across schemas; reference by
  plain id). A logical-reference column that is `NOT NULL` nevertheless
  couples the writing module to the lifecycle of the referenced module: a
  soft delete, a merge, or a reference that cannot be resolved would block
  writes or force fake placeholder rows. The database currently carries 253
  `NOT NULL` logical-reference columns (214 of them `organization_id`),
  which makes that coupling the norm instead of the exception.

- **Decision:**
  1. **Every cross-module logical reference is nullable.** A column whose
     target lives in another module's Postgres schema (including
     `auth.users` and `auth.organizations`) is a plain, nullable id column.
  2. **Presence is a service-layer fact.** When a use case requires the
     reference, the service validates it (the owning module's `resolve*` /
     `assert*` contract method) before the write. `NOT NULL` moves from the
     database constraint to the contract.
  3. **Absence is a link state, not a scope.** `NULL` on an ordinary
     cross-module reference means "not (yet) linked" and nothing else. The
     modules that define their own scope reading (`organization_id IS NULL` =
     company-wide on `inventory.*` per ADR-0008 and `assets.*` per ERP-0036
     D11) keep it, and that reading is read on top of this rule.
  4. **Deletion across modules clears the link.** The owning module decides
     cleanup explicitly (soft delete, `SET NULL` semantics in the service),
     exactly as `elysia-module` rule 3.2 prescribes.

- **Consequences:**
  - `docs.dbml` migrates all cross-module reference columns to nullable, in
    append-only migrations; service contracts gain the presence checks that
    replace `NOT NULL`.
  - Partial unique indexes that include a nullable reference column use the
    ADR-0008 pair form so global rows stay constrained.
  - Uniqueness that spans a reference column keeps working: a `NULL`
    reference simply never collides, which is the intended behaviour for
    unlinked rows.
  - **A nullable tenant column weakens the intra-module composite tenant
    foreign key.** PostgreSQL's default match type is `MATCH SIMPLE`: when
    `organization_id` is `NULL`, the composite FK `(organization_id, id)` is
    satisfied without a check. Rows without an organization therefore lose the
    database-level tenant backstop and rely on the owning module's contract
    method, like every other unlinked row.
  - Scope semantics are unaffected by this ADR: `NULL` on `inventory.*` and
    `assets.*` still means company-wide (ADR-0008, ERP-0036 D11) and is read
    on top of this rule, not instead of it.

- **Alternatives considered:**
  - **Keep `NOT NULL` on logical references** - rejected: it couples write
    paths to another module's lifecycle and forces placeholder rows.
  - **Real cross-schema foreign keys with `ON DELETE SET NULL`** - rejected:
    violates `elysia-module` rule 3.2; module isolation forbids cross-schema
    FKs regardless of the delete action.
  - **Nullable only for `organization_id`, `NOT NULL` elsewhere** - rejected:
    the coupling argument applies to every cross-module reference, not just
    the tenant column.
