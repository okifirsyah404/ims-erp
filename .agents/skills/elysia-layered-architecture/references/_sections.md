# Sections — elysia-layered-architecture skill

Rule categories, ordered by impact.

## 1. Layer Boundaries — CRITICAL

What each layer may and may not do. Violations here leak HTTP into data
code or queries into controllers, making both untestable.

- 1.1 Controllers Own HTTP Only
- 1.4 Contracts in contracts/, DI Tokens in constants/di.ts

## 2. Service & Repository Scope — HIGH

Where orchestration and data access belong.

- 1.2 Services Orchestrate, Never Touch HTTP or Drizzle
- 1.3 Repositories Own Queries and Caching

## 3. Data Contracts — MEDIUM-HIGH

How data crosses the layers.

- 1.5 Response Envelope at the HTTP Layer Only
- 1.6 Zod Parse at the Boundary
