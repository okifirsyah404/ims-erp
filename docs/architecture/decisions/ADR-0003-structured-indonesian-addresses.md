# ADR-0003 — Structured Customer Addresses with Indonesian Reference Data

- **Status:** accepted (business decision, 2026-10-25)
- **Context:** The existing seeders already carry Indonesian administrative
  data (`database/seeders/raw/addresses/{provinces,regencies,districts,
villages}.json`) but the `customers` table has no address fields at all.
Option was free-text-only address as a faster slice versus leveraging the
existing references now.
- **Decision:** Customers get a structured address: free-text street detail
  plus references to `province`, `regency`, `district`, `village` rows seeded
  from the raw JSON through the idempotent seed runner. The hierarchy
  (province → regency → district → village) is enforced by FK chain using the
  official Indonesian hierarchy codes from the seeded data — codes are never
  guessed. Form UI cascades selects from a cached, paginated address-lookup
  API; the JSON files are never shipped into the browser bundle.
- **Consequences:**
  - Phase-2 customer slice grows modestly: address reference tables + seeders
    + one lookup endpoint + cascading selects.
  - Lookups are cache-friendly (administrative data is immutable in
    practice); list endpoints for address options can be `accepted` quickly.
  Reference rows must be re-seeded only when official data updates; do not
    hand-edit reference tables in application code.
- **Alternatives considered:**
  - Free-text only (rejected: loses structured reporting/territory value and
    ignores data we already hold; can be added later as display fallback).
  - Frontend-bundled address list (rejected: bundle bloat and duplication).
