import { beforeEach, describe, expect, test } from 'bun:test';

import {
	getActiveOrganizationId,
	organizationHeaders,
	useOrganizationStore,
} from '../../src/lib/organization-store';

describe('organization store', () => {
	beforeEach(() => {
		useOrganizationStore.getState().reset();
	});

	test('starts with no active organization', () => {
		expect(getActiveOrganizationId()).toBeNull();
		expect(organizationHeaders()).toEqual({});
	});

	test('an optimistic set survives a session sync that repeats the same value', () => {
		const { setActive } = useOrganizationStore.getState();
		setActive('org-b');
		// The sync effect writes the session value; same value must not change it.
		useOrganizationStore.getState().setActive('org-b');
		expect(getActiveOrganizationId()).toBe('org-b');
	});

	test('a session sync replaces an optimistic value once the server catches up', () => {
		const { setActive } = useOrganizationStore.getState();
		setActive('org-b');
		setActive('org-a');
		expect(getActiveOrganizationId()).toBe('org-a');
	});

	test('organizationHeaders carries the active organization', () => {
		useOrganizationStore.getState().setActive('org-b');
		expect(organizationHeaders()).toEqual({ 'x-organization-id': 'org-b' });
	});

	test('reset clears the active organization', () => {
		useOrganizationStore.getState().setActive('org-b');
		useOrganizationStore.getState().reset();
		expect(getActiveOrganizationId()).toBeNull();
		expect(organizationHeaders()).toEqual({});
	});
});
