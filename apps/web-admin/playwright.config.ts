import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-level UAT automation for the web admin (docs/adjustment/uat-modul).
 *
 * @remarks
 * Runs against the **already running** dev stack (`bun run dev` from the repo
 * root): web admin on :5173, backend on :3001. Nothing is started or seeded
 * here, so a run writes real rows into the dev database; every spec names its
 * data with a per-run suffix so runs never collide. Files are `*.e2e.ts` so
 * `bun test` (unit tests) never picks them up.
 */
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	outputDir: './e2e/.results/artifacts',
	// Approved screenshots live next to the specs; the first run creates them
	// (`missing`), later runs compare against them.
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
	updateSnapshots: 'missing',
	// One flow builds on the previous step's data, so steps run in order.
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [
		['list'],
		['html', { outputFolder: './e2e/.results/report', open: 'never' }],
	],
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
		locale: 'id-ID',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		// `E2E_SLOWMO=500` slows every action down (ms) so a person can follow
		// the run in a visible browser (`test:e2e:headed`).
		launchOptions: { slowMo: Number(process.env.E2E_SLOWMO) || 0 },
	},
	projects: [
		{ name: 'setup', testMatch: '**/auth.setup.e2e.ts' },
		{
			name: 'm05',
			testMatch: '**/m05-*.e2e.ts',
			dependencies: ['setup'],
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
