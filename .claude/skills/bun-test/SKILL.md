---
name: bun-test
description: Unit-test conventions for this project using bun:test — Bun's built-in test runner with mock() for functions and mock.module() for modules. Drizzle DB and Bun RedisClient are always mocked via constructor injection, never real connections. Use when writing or reviewing tests in apps/backend.
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: tsyringe
  canonicalExample: apps/backend/test/unit/province.repository.test.ts
---

# Bun Test Convention

This project uses Bun's built-in test runner (`bun test`) for unit tests in
`apps/backend`. Conventions: tests live in `test/`, `bun:test` primitives only
(no Jest/Vitest), and every external process — Drizzle `BunSQLDatabase`, Bun
`RedisClient` — is a mock injected through the constructor. Tests never open
network connections or read real connection strings.

## When to Apply

Reference these guidelines when:

- Writing a new test file under `apps/backend/test/`
- Testing a service (mock repositories), a repository (mock DB/Redis),
  or any class that receives DI tokens
- Reviewing tests that hit the network, a real database, or real Redis

## The 6 Rules (by impact)

### 1.1 DB and Redis are always mocked — CRITICAL

Unit tests construct repositories/services directly with mock dependencies;
they never instantiate a real `BunSQLDatabase` or `RedisClient` and never
resolve from the real container. No test reads `POSTGRES_URL` or any
connection string.

```typescript
// apps/backend/test/unit/province.repository.test.ts — the pattern
import { describe, test, expect, mock } from 'bun:test';
import { ProvinceRepository } from '../../src/app/location/repositories/province.repository';
import { mockDb } from '../helpers/mock-db';

const mockRedis = {
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
};

const repository = new ProvinceRepository(mockDb as never, mockRedis as never);
```

### 1.2 Use bun:test primitives — CRITICAL

`import { describe, test, expect, mock, beforeEach } from 'bun:test'`.
`mock()` is the function mock (`.mockReturnValueOnce()`,
`.mockResolvedValueOnce()`, `mock.mock.calls` for assertions);
`mock.module('...', () => ({ ... }))` mocks whole modules. Do not add jest,
vitest, or sinon.

### 2.1 Fluent Drizzle chains get a shared chainable mock — HIGH

`database.select().from().where().orderBy().limit().offset()` is a fluent
chain terminated by `await`. Build one chainable mock helper
(`test/helpers/mock-db.ts`) that returns a self-proxy and resolves configured
rows on `then`/query execution. Per test, configure the rows/counts the chain
resolves to, then assert on captured calls (e.g. that the `where` clause
excludes soft-deleted rows).

### 2.2 Redis mocks capture TTL and invalidation — HIGH

`RedisClient` surface is small (`get`, `set`, `del`, ...). Mock each method;
assert expiry/TTL values where caching semantics matter (e.g. 300-second TTL)
and `del` called with the expected cache keys on writes.

### 3.1 Test behavior, not wiring — MEDIUM-HIGH

Services: verify pass-through to the injected repository and null/empty
propagation. Repositories: verify filter construction (soft-delete exclusion
via `isNull(deletedAt)`), cache-aside flow (cache miss → DB → cache set), and
write invalidation. Do not test tsyringe registration or decorator presence.

### 3.2 Tests fail honestly — MEDIUM

No network, no real processes, no env-dependent skips that silently pass.
A test either runs fully offline against mocks or is not written. Coverage
claims in docs match what actually ran.

## References

1. [https://bun.com/docs/test](https://bun.com/docs/test)
