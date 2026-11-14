# Column Types

Section prefix: `column-`

Category impact: CRITICAL

Rules:

1. Use the shared unixTimestamp custom type for every datetime column
2. Forbid timestamp(), datetime(), date() and raw bigint datetime columns

# Boundaries & Defaults

Section prefix: `convert-` / `default-`

Category impact: HIGH

Rules:

1. Accept ISO 8601 at the API boundary, Date inside the app
2. Set defaults with .$defaultFn(() => new Date()), never .defaultNow()

# Queries & Indexing

Section prefix: `query-` / `index-` / `extend-`

Category impact: MEDIUM-HIGH

Rules:

1. Compare times with Date objects — never mix seconds and ms literals
2. Index time columns used in range scans or cursor pagination
3. Extend the shared custom types for new dialects
