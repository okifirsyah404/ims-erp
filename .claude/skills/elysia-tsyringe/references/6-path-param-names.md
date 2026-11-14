# 2.6 One Path-Param Name per Position

**Impact: MEDIUM**

## The Rule

Within a plugin, each path position uses exactly one parameter name.
Child-collection routes use `/:id` (the parent's id), never a second name
like `/:parentCode` alongside a sibling `/:id` route.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts`:

```typescript
.get('/provinces/:id', /* ... */)
.get('/provinces/:id/regencies', /* ... */)   // same name at position 2
```

The rejected shape (real crash):

```typescript
.get('/provinces/:id', /* ... */)
.get('/provinces/:provinceCode/regencies', /* ... */)
// Error: Cannot create route "/locations/provinces/:provinceCode/regencies"
// with parameter "provinceCode" because a route already exists with a
// different parameter name ("id") in the same location
```

## Why

- Elysia's router (memoirist) compiles paths into a single radix tree;
  conflicting names at one position are unrepresentable.
- Consistent `/:id` keeps generated OpenAPI paths coherent.

## Workaround for code-based lookups

Expose code-based lookups at a distinct prefix (e.g. `/provinces/by-code/:code`)
or resolve id-or-code inside the handler — never by adding a second param
name at the same position.

## Anti-patterns

- `/:id` and `/:slug` on the same tree position in one plugin.
- Splitting one resource's routes across plugins to dodge the conflict.
