# 1.2 Services Orchestrate, Never Touch HTTP or Drizzle

**Impact: HIGH**

## The Rule

Services refine and combine repository results and translate domain
errors. They import no HTTP types and issue no Drizzle queries or cache
calls themselves.

## Canonical Example (from this repo)

`apps/backend/src/app/location/services/location.service.ts` — a
pass-through over four repositories, typed by repository contracts:

```typescript
@injectable()
export class LocationService {
	constructor(
		@inject(PROVINCE_REPOSITORY_TOKEN)
		private readonly provinceRepository: IProvinceRepository,
		@inject(REGENCY_REPOSITORY_TOKEN)
		private readonly regencyRepository: IRegencyRepository,
	) {}

	/**
	 * Fetches all non-deleted regencies of one province, by province id.
	 */
	getRegenciesByProvince(provinceId: string): Promise<TRegencySelect[]> {
		return this.regencyRepository.findByProvinceId(provinceId);
	}
}
```

## Why

- A pass-through service is fine; the layer exists so controllers can be
  swapped and repositories tested without HTTP.
- Services are where multi-repository rules live (e.g. "unique-violation
  race → 409" translation belongs here per api-conventions).
- Cache and SQL concerns in services duplicate repository behavior and
  break the single-writer rule for invalidation.

## External Systems Enter Through Ports

When a module must call an outside system — Better Auth's `auth.api`, an
email provider, a payment SDK — the calls live behind a contract
interface (a **port**) in `contracts/`, implemented in `adapters/`, and
injected via a DI token. The service orchestrates repository + adapter;
domain errors are translated at the adapter edge; the external SDK import
appears nowhere else. "Gateway" naming is reserved for websocket
gateways — external-system wrappers are adapters (no file suffix).

`apps/backend/src/app/user/services/user.service.ts` — orchestration over
a repository (owns `deletedAt`) and an adapter (owns every Better
Auth–owned column):

```typescript
@injectable()
export class UserService {
	constructor(
		@inject(USER_REPOSITORY_TOKEN)
		private readonly userRepository: IUserRepository,
		@inject(USER_AUTH_GATEWAY_TOKEN)
		private readonly authGateway: IUserAuthGateway,
	) {}

	/**
	 * Soft delete pairs both collaborators: the ban (Better Auth, which
	 * also revokes sessions) blocks logins; `deletedAt` marks the row.
	 */
	async softDeleteUser(userId: string, headers: Headers): Promise<void> {
		await this.ensureExists(userId);
		await this.authGateway.banUser(userId, { banReason: 'deleted' }, headers);
		await this.userRepository.delete(userId);
	}
}
```

The adapter implementation
(`adapters/better-auth-user.ts`) wraps `auth.api` and translates
`APIError`s into module domain errors (`UserEmailTakenError`,
`UserNotFoundError`, from `errors/user.errors.ts`) — the same translation
duty repositories delegate to their error mappers. Tests inject a mocked
adapter via the token (see `test/unit/user.service.test.ts`).

Module-owned background jobs (BullMQ) follow the same boundary: the
worker (`queues/avatar.worker.ts`) resolves the module **repository** via
its DI token at bootstrap and writes through it — never raw `drizzleDB`
inside a queue processor, or cache invalidation and soft-delete filtering
are lost.

The worker's *lifecycle* is module-owned too. `startAvatarWorker()` returns a
narrow handle — `{ onError, close }`, structurally the shared `QueueWorker`
contract — re-exported from the module's `index.ts`. `src/index.ts` hands every
module's handle to one `startWorkers([...])` array
(`@providers/queue/worker-registry`) and stops them all on `SIGTERM`, so the
composition root knows nothing about BullMQ event names or shutdown ordering
and a new queue costs one array entry. A worker's failure must stay non-fatal
to the HTTP app, which is why workers are not mounted on `src/app/app.ts`.
`stopWorkers()` uses `allSettled`: one worker hanging on `close()` must not
block the others or hold up exit. The registry aggregates, it never constructs
— building a worker inside it would hide the registration-order dependency.

## Anti-patterns

- `this.database.select()` inside a service.
- Building `TApiResponseMeta` (`requestId`, `timestamp`) inside a service.
- A service importing from `elysia` for `status()`/`error()` helpers.
- Calling `auth.api` inline from a service or controller without a port —
  untestable and the column-ownership boundary becomes invisible.
- A queue worker writing `drizzleDB` directly instead of going through
  the module repository.
