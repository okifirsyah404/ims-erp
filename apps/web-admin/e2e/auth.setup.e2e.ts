import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, test as setup } from '@playwright/test';

import { API_URL, passwordOf, ROLES, statePath } from './support/accounts';

/**
 * Logs every UAT role in once through the Better Auth API and caches the
 * session cookie, so specs open pages already signed in instead of typing the
 * login form for every step.
 */
for (const role of ROLES) {
	setup(`login ${role}`, async ({ playwright }) => {
		const request = await playwright.request.newContext();
		const response = await request.post(`${API_URL}/api/auth/sign-in/username`, {
			headers: { Origin: 'http://localhost:5173' },
			data: { username: role, password: passwordOf(role) },
		});
		expect(response.status(), `login ${role}`).toBe(200);
		mkdirSync(dirname(statePath(role)), { recursive: true });
		await request.storageState({ path: statePath(role) });
		await request.dispose();
	});
}
