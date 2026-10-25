---
name: nestjs-layered-architecture
description: Layered module architecture for this NestJS backend — contracts/, controllers/, dto/, repositories/, services/ per domain module. Covers file naming, DI wiring, repository contracts (IBaseRepository), soft-delete + cache patterns in repositories, service use cases, controller HTTP-only rule, and cross-domain access via contracts (no forwardRef, no cross-repository imports). Use when creating or refactoring a domain module or reviewing module boundaries.
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
---

# NestJS Layered Architecture (IMS/ERP backend)

Reference implementation: `apps/backend/src/modules/user/`.

## Module layout

Each domain module lives at `apps/backend/src/modules/<domain>/`:

```
<domain>/
├── contracts/
│   └── <domain>.repository.contract.ts   # interfaces, I-prefixed
├── controllers/
│   └── <domain>.controller.ts
├── dto/
│   └── <domain>.dto.ts
├── repositories/
│   └── <domain>.repository.ts
├── services/
│   └── <domain>.service.ts
└── <domain>.module.ts
```

- Kebab-case filenames, domain-prefixed. Imports use `.js` extensions (ESM/NodeNext).
- Don't invent extra folders (helpers/, utils/, types/) unless the module actually grows one.

## Layers and dependency direction

Dependency direction is one-way:

```
Controller → Service → Repository → Drizzle
```

- **Controller** — HTTP only: routes, status codes, guards, validation pipes. Never imports Drizzle, never holds business logic.
- **Service** — use cases. Owns server-side role-permission and record-ownership checks (frontend checks are UX only). Injects the repository **through the contract**, not the concrete class.
- **Repository** — Drizzle queries only. No HTTP concepts, no use-case orchestration.
- **contracts/** — interfaces shared across layers and (for cross-domain access) across modules.
- **dto/** — types derived straight from the Drizzle schema; no hand-mirrored shapes.

## DTOs — derive from schema

```ts
export type TUserInputDTO = typeof users.$inferInsert;
export type TUserResultDTO = typeof users.$inferSelect;
```

- `T` prefix for type aliases. Zero drift from schema — never restate columns manually.

## Contracts

```ts
export interface IUserRepository extends IBaseRepository<TUserInputDTO, TUserResultDTO> {
  paginate(request: TUserPaginationRequest): Promise<TPaginationResult<TUserResultDTO>>;
  update(id: string | number, item: TUserInputDTO): Promise<TUserResultDTO | null>;
}
```

- `I` prefix. Extend `IBaseRepository` and reuse `TPaginationRequest/Result` from `@ims/erp/common`.
- JSDoc `@returns` (and `@throws` where relevant) on overrides.

## Repository patterns

```ts
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
}
```

- **Soft deletes (mandatory):** every list/find query filters `isNull(table.deletedAt)`. Deleted reads are explicit opt-ins (`findAllWithDeleted`, `findSoftDeletedById`). `softDelete` stamps `deletedAt`; `restore` clears it; `forceDelete` is real DELETE, only for rare cascade cases. Never hard-delete master data referenced by financial transactions.
- **Read-through cache:** single-entity reads cache under `<domain>:<id>` (keyspace handled by CacheModule). Every id-targeted write deletes the key. List queries bypass cache. JSON-revive date fields on cache hits (Redis returns strings) — e.g. `reviveUser` re-wraps `createdAt/updatedAt/deletedAt`.
- **Pagination:** separate `count()` + paged select, `Math.ceil(total / limit)`, explicit `orderBy`, filters via `ilike('%term%')`.
- Guard empty id-list inputs with no-op returns.
- Private helpers stay private (`softDelete`, `hardDelete`, cache-key helpers).

## Service

```ts
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}
```

- Constructor injection. Enforce role permissions and ownership **here** (server-side fact), not in the controller alone.
- No Drizzle imports. Cross-domain data comes from the other module's exported service/contract API.

## Controller

```ts
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
}
```

- Route path is the singular domain name. Class-based DI tokens; no string tokens unless interfacing a non-class provider.

## Module wiring

```ts
@Module({
  controllers: [UserController],
  providers: [UserRepository, UserService],
})
export class UserModule {}
```

- No `forwardRef`, ever. If two modules need each other, extract a shared contract/service.
- Export only what other modules legitimately consume (service, contract) — never a repository.

## Cross-feature isolation (modular monolith)

A **feature module** = a business capability under `modules/` (customer, sales,
inventory, ...), which owns its own Postgres schema. Rule: a feature never
touches another feature's data at the DB level.

1. **Schema per feature.** Each feature owns one Postgres schema named after the
   domain (`customer.customers`, `sales.orders`, ...). All its tables live there.
   (Current reality: one shared `erp` schema — migrate feature tables into
   per-feature schemas as each feature is built; don't grow `erp` further.)
2. **No cross-feature FK.** FK constraints only within a feature's own schema.
   Cross-feature references are loose ID columns (`text`, no `.references()`).
   Integrity and orphan cleanup are enforced in the owning service.
3. **No cross-feature SQL.** No joins, no Drizzle `with:` relations across
   feature schemas, no importing another feature's table objects into a query.
4. **External facade only.** Consumer features call `External<X>Service`,
   exported by the owning module:
   ```ts
   @Injectable()
   export class ExternalUserService {
     constructor(private readonly userService: UserService) {}
     findById(id: string) { return this.userService.findById(id); }
     // only methods other features legitimately need
   }

   @Module({
     controllers: [UserController],
     providers: [UserRepository, UserService, ExternalUserService],
     exports: [ExternalUserService],
   })
   export class UserModule {}
   ```
   Consumers inject `ExternalUserService` — never `UserService` or
   `UserRepository` directly. The facade is the stable API surface; internals
   can change freely behind it.
5. **Aggregation in the app layer.** Cross-feature "joins" = the consuming
   service composing facade results, not SQL.
6. **Exception: Better Auth.** `auth-schema.ts` tables (`users`, sessions, ...)
   are shared infrastructure managed by Better Auth — not a feature. The one
   existing cross-FK (`erp.audit_logs.actor_id → auth users.id`) is allowed for
   audit integrity; don't add more cross-schema FKs.


## Do / Don't

| Do | Don't |
|---|---|
| Controller → Service → Repository, one direction | Controller importing Drizzle or repositories |
| Cross-module access via exported service/contract | Importing another module's repository, `forwardRef` |
| Soft delete with `deletedAt` filters everywhere | Hard delete in feature code |
| Cache single reads, delete key on write | Cache list queries without invalidation discipline |
| Derive DTOs with `$inferInsert/$inferSelect` | Hand-mirror table columns |
| Better Auth timestamps in **seconds**; CacheModule TTL in **ms** | Mixing time units |
| Money as integer IDR minor units | Floats for ledger amounts |
| Server-side permission/ownership checks on every endpoint (incl. exports) | Trusting frontend checks |
