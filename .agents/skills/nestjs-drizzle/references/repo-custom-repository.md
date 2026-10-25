---
title: Keep a table's queries in a custom repository
impact: MEDIUM
impactDescription: improves testability — mock the repository, not the chainable query builder
tags: repo, repository, testing, unit-test
---

## Keep a table's queries in a custom repository

Drizzle has no built-in repository class. Keeping a table's queries in a dedicated `@Injectable()` repository (injected into services) gives a stable seam for testing: unit tests mock the repository object, which is trivial, instead of mocking the chainable query builder, which is painful because every method returns another builder that must be stubbed.

**Incorrect (what's wrong):**

```typescript
// Service talks to db directly — tests must mock the chainable builder
@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  findOne(id: number) {
    return this.db.select().from(users).where(eq(users.id, id));
  }
}

// Test: must stub select -> from -> where -> then chain
jest.spyOn(db, 'select').mockReturnValue({ from: jest.fn().mockReturnValue({ where: ... }) });
```

**Correct (what's right):**

```typescript
// users.repository.ts
import { InjectDrizzle } from '@nestjs/drizzle';

@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  findOne(id: number) {
    return this.db.select().from(users).where(eq(users.id, id));
  }

  create(user: NewUser) {
    return this.db.insert(users).values(user).returning();
  }
}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}
}

// Test: mock the repository, not the query builder
const moduleRef = await Test.createTestingModule({
  providers: [UsersService, { provide: UsersRepository, useValue: mockRepository }],
}).compile();
```

**When NOT to use this pattern:**
- For tiny CRUD apps where a repository adds ceremony without benefit, direct service queries are acceptable — accept the harder testing tradeoff.

Reference: [NestJS Drizzle — Custom repositories](https://docs.nestjs.com/data/drizzle)
