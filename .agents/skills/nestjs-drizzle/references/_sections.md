# Setup & Registration

Section prefix: `setup-`

Category impact: CRITICAL

Rules:

1. Import drizzle from the Matching Driver Entrypoint
2. Use DrizzleModule.forRoot with drizzle and connection Options
3. Configure Asynchronously with forRootAsync

# Injection

Section prefix: `inject-`

Category impact: CRITICAL

Rules:

1. Inject the Database with @InjectDrizzle

# Schema & Types

Section prefix: `schema-`

Category impact: HIGH

Rules:

1. Derive Row Types with $inferSelect/$inferInsert and a Shared Database Alias
2. Declare Relations Once with defineRelations

# Queries & Transactions

Section prefix: `query-`

Category impact: HIGH

Rules:

1. Run All Queries of a Transaction through tx
2. Use Relational Queries for Nested Reads

# Migrations & Multi-DB

Section prefix: `migrate-` / `multidb-`

Category impact: MEDIUM-HIGH

Rules:

1. Manage Schema Changes with drizzle-kit
2. Register Multiple Databases with Unique Named Tokens

# Repositories

Section prefix: `repo-`

Category impact: MEDIUM

Rules:

1. Keep a Table's Queries in a Custom Repository
