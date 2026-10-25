# Column & Delete Semantics

Section prefix: `column-` / `query-` / `delete-`

Category impact: CRITICAL

Rules:

1. Every deletable table gets a nullable deleted_at (ms), no boolean flag
2. Every query on a soft-delete table filters isNull(deletedAt)
3. Feature code sets deletedAt — hard DELETE is purge/infra only

# Constraints & Recovery

Section prefix: `unique-` / `restore-`

Category impact: HIGH

Rules:

1. Use partial unique indexes so deleted rows free their unique values
2. Restore sets deletedAt back to null

# Leaks & Lifecycle

Section prefix: `relations-` / `purge-`

Category impact: MEDIUM-HIGH

Rules:

1. Relational query 'with' cannot filter deleted nested rows — know the leak
2. Purge jobs hard-delete rows past a per-table retention window
