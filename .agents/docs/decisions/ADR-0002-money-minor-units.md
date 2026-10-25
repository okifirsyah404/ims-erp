# ADR-0002 — Money Representation: Integer IDR Minor Units

- **Status:** accepted (business decision, 2026-10-25)
- **Context:** Nothing in the current schema stores money yet
  (existing numeric-looking fields are text placeholders). Financial modules
  (ledger, tax, payroll, profit sharing, payables) are upcoming; the model
  decision must be pinned before a single financial column exists.
- **Decision:** All ledger-grade monetary amounts are stored as **exact
  integers in IDR minor units (rupiah cents)**: `bigint` columns, application
  code treats them as integers — never floats/decimals arithmetic in JS for
  money vals. JSON over the wire is a plain integer at the API surface.
  Presentation formatting happens at the UI edge. If a future corner of the
  system genuinely needs foreign currency or decimal precision, a separate
  column convention gets its own ADR — không global switch.
- **Consequences:**
  - Money columns: `bigint`, named `amount_minor` by convention; column docs
    state the unit. Aggregate arithmetic stays in PostgreSQL (`SUM(bigint)`)
    or safe-integer JS arithmetic; overflow-safe within IDR magnitude.
  - Financial invariant tests (balance, idempotency) compare integers.
  - Documentation wording: amounts in code/docs say "minor units" unless
    explicitly printed as rupiah display strings.
- **Alternatives considered:**
  - `numeric(precise scale)` string serialization (rejected: adds string
    round-trips and JS decimal library dependence for no gain at IDR
    magnitudes; integers are simpler and exact).
  - Floats (rejected outright — unbounded error is unacceptable for ledger).
