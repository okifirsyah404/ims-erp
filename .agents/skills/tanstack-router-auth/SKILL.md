---
name: tanstack-router-auth
description: Authenticated-routes pattern for TanStack Router in this project - _authed pathless layout guard with redirect preservation, router auth context, login-side redirect-param consumption, and session-user consumption via TanStack Query. Use when adding or editing routes in apps/web-admin, wiring auth guards, or consuming the session user in UI (sidebar, headers). Guide-derived from https://tanstack.com/router/latest/docs/guide/authenticated-routes. Does NOT cover router mechanics in general (use tanstack-router) or Better Auth server config (use better-auth-best-practices).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: tanstack-router
  source: https://tanstack.com/router/latest/docs/guide/authenticated-routes
  canonicalExample: apps/web-admin/src/routes/_authed.tsx
---

# TanStack Router Authenticated Routes (project pattern)

How protected routes, the login round-trip, and the session user work in
`apps/web-admin`. A route guard is **not** an authorization boundary: every
API endpoint must authorize itself server-side; `beforeLoad` only gates UI.

## The 6 Rules (by impact)

### 1. Guard in the `_authed` pathless layout — CRITICAL

All authenticated routes nest under `src/routes/_authed.tsx`. Its
`beforeLoad` resolves the session through Better Auth (`getSession()` from
`@/lib/auth-client`) and redirects to `/login` when absent. The layout
returns the session in its route context so children can read it:

```tsx
// src/routes/_authed.tsx — the pattern
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    try {
      const { data } = await getSession();
      if (!data) {
        throw redirect({ to: '/login', search: { redirect: location.href } });
      }
      return { session: data };
    } catch (error) {
      // Re-throw redirects; real errors (network) also go to login.
      if (isRedirect(error)) throw error;
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: Outlet,
});
```

`beforeLoad` of a route runs **before its children's** `beforeLoad`; a
thrown error prevents children from loading. Wrap fallible session checks
in try/catch and re-throw with `isRedirect(error)`.

### 2. Preserve the target on redirect; login sends the user back — CRITICAL

The guard always carries `search: { redirect: location.href }`. The login
route reads the `redirect` search param (validated with `validateSearch`)
and, after sign-in, navigates with `router.history.push(search.redirect)`
(full URL — `history.push`, not `navigate`) or `/` when absent. This keeps
deep links alive across session expiry.

```tsx
// routes/login/index.tsx — after successful sign-in
const search = Route.useSearch(); // validateSearch: z.object({ redirect: z.string().optional() })
router.history.push(search.redirect ?? '/');
```

### 3. Auth state lives in router context, not ad-hoc per route — HIGH

The root route is typed with `createRootRouteWithContext<{ auth }>()` and
the component wrapping `<RouterProvider>` injects the auth state (e.g.
`authClient.useSession()` result). Routes read it via
`useRouteContext({ from: ... })` or the `beforeLoad` `context` argument —
never call session hooks inside `beforeLoad` (hooks are React-only).

### 4. `beforeLoad` for guards, never components — HIGH

Do not gate on auth inside components (flash of protected content, no
preload protection). Guarding, redirecting, and context returns happen in
`beforeLoad`; components consume `Route.useLoaderData()` /
`useRouteContext()`.

### 5. Session-user data flows through TanStack Query — MEDIUM-HIGH

`QueryClientProvider` must be mounted in `main.tsx` (routes may use
`useQuery`). Self user data comes from the backend self route
(`GET /users/me` → `TApiResponse<TUserProfile>`, presigned `image`)
through a `queryOptions`-based hook (`['users', 'me']`), not from the
Better Auth session payload — the backend stays authoritative for profile
fields and avatar URLs.

### 6. Sidebar/user UI degrades, never blocks — MEDIUM

Components consuming the session user (e.g. `NavUser`) render skeleton
while pending and fallback initials on error. The sidebar must render
even when `/users/me` fails. Hardcode nothing: name, email, and avatar
come from the query; `AvatarFallback` derives from the real name.

## Anti-patterns (from this repo)

- Hardcoded sample user in `main-sidebar.tsx` (`shadcn / m@example.com`).
- Placeholder dropdown items ("Upgrade to Pro", "Billing") left in the
  user menu; logout not wired to `authClient.signOut()`.
- Unmounting-order bug class: using `useQuery` before
  `QueryClientProvider` is mounted — check `main.tsx` first.
- Dropping `search.redirect` when redirecting to login (deep link dies).
- Using `router.navigate` for the post-login return; use
  `router.history.push(redirect)` because the param is a full URL.

## References

- Guide: https://tanstack.com/router/latest/docs/guide/authenticated-routes
- `tanstack-router` skill — routing mechanics, file conventions.
- `tanstack-query` skill — query options, keys, provider setup.
- `better-auth-best-practices` skill — session/client configuration.
