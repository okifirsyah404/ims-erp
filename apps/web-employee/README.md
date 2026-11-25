# web-employee

Employee self-service portal (`@ims-erp/web-employee`). Same stack as
`apps/web-admin` (React 19 + Vite 8 + TanStack Router/Query/Table + Tailwind 4 +
`@ims-erp/ui`), mobile-first.

## Who may sign in

The portal serves **employees only**. A session is refused — and revoked — when:

- the account holds an app role `admin`, `investor` or `customer`
  (even with an employee record: an app admin belongs in web-admin); or
- the account has no live `hr.employees` row in any organization.

The backend `employeePortal` guard enforces the same rules on every `/me`
route, plus "employee record in the active organization".

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Home: today's attendance, today's shift, open tasks |
| `/attendance` | Self check-in/out and the month recap |
| `/schedule` | The caller's own shift cells, week by week |
| `/tasks` | Employee tasks from HR; open ones can be marked done |
| `/leave` | Request leave or log overtime (HR still decides) |
| `/projects` | Projects the caller is the PIC of or has a live task in |
| `/projects/$projectId` | Project detail: tasks (own-task status, PIC management), evidence, site visits |
| `/notifications` | Inbox (the header bell is the preview) |
| `/profile` | Editable nickname, phone, primary address; HR facts read-only |
| `/login` | Sign-in (Better Auth, same backend as web-admin) |

## Backend endpoints

All self-service routes live under `/human-resources/me/*` and resolve the
employee from the session — no request ever carries an `employeeId`:

```
GET    /human-resources/me/access          # session only: orgs with an employee record
GET    /human-resources/me/context
GET    /human-resources/me/profile
PATCH  /human-resources/me/profile         # nickname, phone, primary address
GET    /human-resources/me/attendance/today
POST   /human-resources/me/attendance/check-in
POST   /human-resources/me/attendance/check-out
GET    /human-resources/me/attendance
GET    /human-resources/me/attendance/month?period=YYYY-MM
GET    /human-resources/me/schedule?start=YYYY-MM-DD
GET    /human-resources/me/leave-types
GET    /human-resources/me/leave
GET    /human-resources/me/leave-balances
POST   /human-resources/me/leave
POST   /human-resources/me/leave/:id/cancel
GET    /human-resources/me/overtime
POST   /human-resources/me/overtime
GET    /human-resources/me/tasks
POST   /human-resources/me/tasks/:id/status
```

Project routes (Phase B, same guard; no `employeeId` either):

```
GET    /projects/me/staff                    # assignable members (PIC picker)
GET    /projects/me/projects                 # involved projects, `isPic` per row
GET    /projects/me/projects/:id             # detail: tasks, evidence, isPic
POST   /projects/me/projects/:id/tasks       # PIC only
PUT    /projects/me/projects/:id/tasks/:childId   # PIC only
POST   /projects/me/projects/:id/tasks/:childId/status  # own task or PIC
DELETE /projects/me/projects/:id/tasks/:childId   # PIC only
POST   /projects/me/projects/:id/evidence    # own task, or any as PIC
DELETE /projects/me/projects/:id/evidence/:childId
GET    /projects/me/site-attendance          # my site visits
GET    /projects/me/projects/:id/site-attendance  # PIC only
POST   /projects/me/site-attendance/check-in # selfie + GPS, PostGIS radius
POST   /projects/me/site-attendance/:id/check-out
```

### Field attendance

The phone sends its coordinates; **the server decides**. `project.addresses`
holds the site point, `project.settings` the radius
(`attendance/site_radius_meters`, default 100 m), and the backend measures with
PostGIS (`ST_Distance` / `ST_DWithin` on a `geography` cast). The verdict, the
distance and the radius in force are snapshotted on the row, so a later settings
change cannot rewrite history. Outside the radius the visit is still recorded as
`out_of_range`; without a selfie it is rejected.

## Development

```bash
cp .env.example .env          # VITE_API_URL, e.g. http://localhost:3001
bun run dev                   # http://localhost:5174 (web-admin keeps 5173)
```

## Checks

```bash
bun run lint
bun run test
bunx tsc --noEmit -p tsconfig.app.json
bun run build
```

## Deploy

Docker build context is the repository root:

```bash
docker build -f apps/web-employee/Dockerfile .
docker compose up -d web-employee   # host port WEB_EMPLOYEE_PORT (8081)
```

`VITE_API_URL` is baked in at build time (same as web-admin).

## Roadmap

Phase C adds documents, signature requests and payslips.

**PostGIS is required** for field attendance: `docker-compose.yml` runs
`postgis/postgis:18-3.6`; on another Postgres run `CREATE EXTENSION postgis`
once. The backend warns at boot when it is missing (only check-in fails).
