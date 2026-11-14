---
name: faker
description: Usage conventions for @faker-js/faker in this repository - deterministic seeding with faker.seed(), anchor-based idempotency for database seeders, choosing locales for Indonesian business data, mapping faker output to project column types (integer IDR money, unix-ms datetimes), and what must never be faker-generated (canonical reference data such as the Indonesian administrative location tree, status vocabularies, or currency codes). Use when writing or reviewing database seeders, generating demo or test data volume, or deciding whether a field should be random or fixed. Depends on erp-database-schema for the column conventions it maps to. Does NOT cover seeder orchestration order or the drizzle seeder entrypoint (see apps/backend/database/seeders/index.ts), test fixtures (tests use explicit fixtures, not faker - see bun-test skill), or faker usage in runtime application code (never allowed).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: erp-database-schema
---

# Faker Usage Conventions

`@faker-js/faker` generates fake data for **seeders only**. It is a
devDependency of `apps/backend`; runtime application code must never import
it, and tests use explicit fixtures/mocks (see the `bun-test` skill), not
faker.

## 1. Determinism is mandatory

Every faker-driven seeder calls `faker.seed(<constant>)` exactly once, before
generating:

```ts
const FAKER_SEED = 20261102; // change only together with a fresh database
faker.seed(FAKER_SEED);
```

Why: seeder idempotency is keyed on **anchor columns** (sku, slug, email,
serial number). If content changes between runs, existence guards miss and a
re-run inserts duplicates instead of no-ops. A fixed seed makes generated
content stable across runs on the same database.

Rules:

- One seed constant per seeder module; document it in a comment.
- Do not re-seed mid-generation unless you intend to reproduce a sub-sequence.
- Changing the seed constant invalidates idempotency for existing databases —
  call that out in the change.

## 2. Anchors carry identity; faker carries content

Faker randomizes **free-text content** (names, descriptions, prices within a
range). It never generates the **anchor** a seeder is idempotent on:

| Field role            | Source                                        |
| --------------------- | --------------------------------------------- |
| SKU / code / slug     | Deterministic pattern (`ITEM-001`, `WH-MAIN`) |
| Login email/username  | Deterministic (`admin.seed@entragate.local`)  |
| Serial numbers        | Deterministic (`ITEM-013-S001`)               |
| Item name, category   | `faker.commerce.*`                            |
| Person names, phones  | `faker.person.*`, `faker.phone.number`        |
| Amounts, quantities   | `faker.number.int` within business ranges     |

Anchors are also how other seeders reference generated rows (e.g. opening
stock referencing `ITEM-005`) — document index→kind mapping when a seeder
depends on positions in a generated list.

## 3. Never faker-generate canonical or reference data

Faker output is fictional. It must never populate:

- **The Indonesian administrative location tree** (provinces → regencies →
  districts → villages) — this is real reference data, seeded from its own
  source, not faker. `location.seeder.ts` is the standing exception.
- **Status vocabularies** — statuses come from the schema's vocabulary lists
  (`docs/database/data-dictionary.md` §3), chosen explicitly, not randomly.
- **Currency codes** — always `'IDR'` for ledger-adjacent rows.
- **Cross-module references** — ids come from the owning seeded rows, never
  invented.
- Anything a business rule validates against a real-world format that faker
  cannot guarantee for Indonesia (e.g. NPWP).

## 3.1 Encoding safety (WIN1252 dev databases)

The dev PostgreSQL database is WIN1252-encoded (typical of Windows installs);
it cannot store 4-byte UTF-8 characters, and faker text fields **do** emit
emoji occasionally. A raw `faker.person.bio()` insert fails with:
`character with byte sequence 0x… in encoding "UTF8" has no equivalent in
encoding "WIN1252"` (hit in practice 2026-11-03).

**Rule:** every faker-generated free-text value passed to the database goes
through `seedSafeText()` from `database/seeders/seed/faker-content.ts` — it
strips non-Latin-1 characters and collapses whitespace. Anchors (emails,
usernames, SKUs, phones) are ASCII by construction and need no sanitizing.

## 4. Map faker output to project column types

Per the `erp-database-schema` read protocol and the data dictionary:

- **Money (ADR-0002):** integer IDR minor units. Use
  `faker.number.int({ min, max })`. Never `faker.finance.amount()` or any
  float/decimal helper — they produce strings/floats that violate the money
  rule.
- **Datetimes:** project timestamps are unix milliseconds
  (`unix-timestamp` custom type). faker returns `Date` objects — convert with
  `.getTime()` when a column wants the number, or pass the `Date` where the
  Drizzle custom type accepts it. Business dates are Asia/Jakarta
  (`faker.date` is UTC-agnostic; do not pretend it is Jakarta-local).
- **Quantities:** numeric columns take fixed-precision strings —
  `faker.number.int({min, max}).toFixed(3)`, matching the `.000` scale
  convention.
- **Tenant scoping:** every generated business row carries the seeded
  `organization_id`; faker never decides tenancy.

## 5. Volume sizing

Default is a small demo set: **10–50 rows per module** (e.g.
`ITEMS_PER_KIND = 4` across 5 item kinds = 20 items). Enough to exercise list
UIs, pagination, and status matrices; slow enough seeds discourage running
them. If a task needs volume/perf data, generate it with an explicit,
separate, higher-count run — not by inflating the default seed.

## 6. Anti-patterns

- `import { faker } from '@faker-js/faker'` outside `database/seeders/`.
- Using faker in `bun test` — tests pin their own fixtures for determinism.
- Unseeded faker in a seeder (non-reproducible, breaks idempotent re-runs).
- Faker-generated SKUs/emails/slugs used as anchors.
- Faker money/decimal helpers for ledger amounts.
- Faker-generated rows in the `location` schema or any status column value.
