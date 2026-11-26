# Web admin UAT automation (Playwright)

Browser tests that replay the UAT checklists in `docs/adjustment/uat-modul/`.
They drive the real UI against the **running dev stack**; nothing is started
or seeded by the tests.

## Run

1. Start the stack from the repo root: `bun run dev` (web admin :5173,
   backend :3001), with Postgres, Redis and the S3 store (`ims-erp-s3-1`) up.
2. Once per machine: `bunx playwright install chromium` (from `apps/web-admin`).
3. From `apps/web-admin`:
   - `bun run test:e2e` runs everything;
   - `bun run test:e2e -- --project=m05` runs one module;
   - `bun run test:e2e:ui` opens Playwright's UI mode: a window listing every
     test, with a live browser view, a step timeline, and a Run button per test;
   - `bun run test:e2e:headed` runs in a visible browser window. Both visual
     scripts wait 800 ms between actions (`E2E_SLOWMO=800`) so a person can
     follow them; for another speed run Playwright directly, e.g. PowerShell
     `$env:E2E_SLOWMO=1500; bunx playwright test --headed`;
   - `bun run test:e2e:report` opens the HTML report (screenshots, video and
     trace of failed steps).

## How it works

- `auth.setup.e2e.ts` signs every UAT role in through `/api/auth` once and
  caches the cookie in `e2e/.state/` (git-ignored). The owner password is read
  from `apps/backend/.env` (`INITIAL_ADMIN_PASSWORD`) at run time.
- Each spec names its data with a per-run suffix (`RUN_ID`), so runs never
  collide; the rows stay in the dev database.
- Files end in `.e2e.ts` so `bun test` never runs them.
- Test titles carry the checklist step IDs (`A1`, `F7`, …) so a failure points
  at the matching UAT row.

## Coverage

| Module | Spec | Steps |
|---|---|---|
| M05 | `m05-a-barang.e2e.ts` | A1, A2, A3, A4 (with 2 photos), A5, A8 |
| M05 | `m05-akses.e2e.ts` | A11, F6, F7 |
| M05 | `m05-ui.e2e.ts` | UI of 6 forms (product, category, storage, supplier, purchase request, purchase order): field rules, axe accessibility, 390 px phone layout, screenshots; toast above dialog |

## UI checks (`m05-ui.e2e.ts`)

- **Field rules** (`support/ui-checks.ts`, soft assertions so one run lists
  every broken field): letters refused in numeric fields, a declared maximum
  length, huge numbers refused or capped, choice lists where the UAT asked for
  a dropdown, and no control without a label. Each rule names the UAT finding
  it encodes. The full field inventory (type, inputmode, maxlength, min/max,
  required, "(Opsional)") is attached to the report.
- **Accessibility**: `@axe-core/playwright` on the open form; serious and
  critical violations fail, all are attached.
- **Layout**: nothing spills past a 390 px phone viewport.
- **Toast on top**: the toast must be the topmost element at its centre and
  not hidden by the dialog's `aria-hidden`/`inert`.
- **Screenshots**: `toHaveScreenshot` per form (desktop). The first run writes
  the baseline to `e2e/__screenshots__/`; review those images, and from then on
  a visual change fails the run. Accept an intended change with
  `bunx playwright test --update-snapshots`. Desktop and phone screenshots are
  also attached to every run's report for review.

Judgement calls (layout, wording, whether a field should be a dropdown) stay
manual in the UAT checklist.
