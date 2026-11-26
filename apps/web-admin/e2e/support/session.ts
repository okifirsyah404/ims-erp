import type { Browser, Page } from '@playwright/test';

import { API_URL, statePath, type TRole } from './accounts';

/** Opens a page signed in as `role` (cached by `auth.setup.e2e.ts`). */
export async function pageAs(browser: Browser, role: TRole): Promise<Page> {
	const context = await browser.newContext({ storageState: statePath(role), locale: 'id-ID' });
	return context.newPage();
}

/**
 * The notification (toast) carrying `text`.
 *
 * @remarks
 * Matched by text anywhere on the page rather than by the toast library's
 * markup, so a library change does not break every spec.
 */
export function toast(page: Page, text: string | RegExp) {
	return page.getByText(text).first();
}

/**
 * Reads the backend as the page's user (same cookies).
 *
 * @remarks
 * Used to confirm a save without depending on list pagination: after many runs
 * a new row may sit on a later page of the table.
 */
export async function apiData<T>(page: Page, path: string): Promise<T> {
	const response = await page.request.get(`${API_URL}${path}`, { headers: { Origin: 'http://localhost:5173' } });
	if (!response.ok()) throw new Error(`GET ${path} → ${response.status()}`);
	return ((await response.json()) as { data: T }).data;
}
