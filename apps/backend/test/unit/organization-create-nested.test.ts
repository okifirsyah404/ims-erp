/**
 * ERP-0041 unit tests: nested-users per-item isolation on organization
 * create, WebP image validation, and the org-logo worker's skip rule.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationService } from '../../src/app/organization/services/organization.service';
import {
	organizationImageFrom,
	OrganizationImageInvalidError,
} from '../../src/app/organization/utils/organization-image';
import { processOrgLogoJob } from '../../src/app/organization/queues/org-logo.worker';

const ACTOR = { userId: 'u-admin', email: 'admin@example.com' };

type Repos = {
	repository: IOrganizationRepository;
	gateway: IOrganizationAuthGateway;
	invitations: {
		invite: (input: Record<string, unknown>, actor: unknown, deliver?: boolean) => Promise<{
			invitation: { id: string };
		}>;
	};
	users: {
		findActiveByEmail: (email: string) => Promise<{ id: string } | null>;
	};
	storage: { put: (key: string, data: Blob, type: string) => Promise<void> };
	addedMembers: Array<{ organizationId: string; userId: string; roles: string[] }>;
	inviteInputs: Array<{ email: string; organizationRoles?: string[] }>;
	deliverFlags: boolean[];
};

function makeService(overrides: Partial<Repos> = {}) {
	const addedMembers: Repos['addedMembers'] = [];
	const inviteInputs: Repos['inviteInputs'] = [];
	const deliverFlags: boolean[] = [];
	const repository = {
		findById: async (id: string) =>
			({ id, name: 'Org', slug: 'org', logo: null, deletedAt: null }),
	} as unknown as IOrganizationRepository;
	const gateway = {
		createOrganization: async () => ({ id: 'org-1' }),
		addMember: async (input: { organizationId: string; userId: string; roles: string[] }) => {
			addedMembers.push(input);
			return { id: `member-${input.userId}` };
		},
	} as unknown as IOrganizationAuthGateway;
	const invitations = {
		invite: async (input: Record<string, unknown>, _actor: unknown, deliver = true) => {
			inviteInputs.push(input as never);
			deliverFlags.push(deliver);
			return { invitation: { id: `inv-${inviteInputs.length}` } };
		},
	} as never;
	const users = {
		findActiveByEmail: async () => null,
	} as never;
	const storage = { put: async () => undefined } as never;
	const service = new OrganizationService(
		overrides.repository ?? repository,
		overrides.gateway ?? gateway,
		(overrides.invitations ?? invitations) as never,
		(overrides.users ?? users) as never,
		(overrides.storage ?? storage) as never,
	);
	return { service, addedMembers, inviteInputs, deliverFlags };
}

describe('nested users on organization create (ERP-0041)', () => {
	test('creator email is skipped', async () => {
		const { service } = makeService();
		const result = await service.createOrganization(
			new Headers(),
			{
				name: 'Org',
				slug: 'org',
				users: [{ email: 'creator@example.com', name: 'Creator', roles: ['admin'] }],
			} as never,
			ACTOR,
			'creator@example.com',
		);
		expect(result.members).toEqual([
			{ email: 'creator@example.com', status: 'skipped', reason: 'creator' },
		]);
	});

	test('active user joins directly via addMember', async () => {
		const { service, addedMembers, inviteInputs } = makeService({
			users: { findActiveByEmail: async () => ({ id: 'u-1' }) } as never,
		});
		const result = await service.createOrganization(
			new Headers(),
			{
				name: 'Org',
				slug: 'org',
				users: [{ email: 'budi@example.com', name: 'Budi', roles: ['admin', 'finance'] }],
			} as never,
			ACTOR,
		);
		expect(result.members).toEqual([
			{ email: 'budi@example.com', status: 'added', memberId: 'member-u-1' },
		]);
		expect(addedMembers[0]?.roles).toEqual(['admin', 'finance']);
		expect(inviteInputs).toHaveLength(0);
	});

	test('unknown email runs the invitation pipeline; sendInvites=false skips delivery', async () => {
		const { service, inviteInputs, deliverFlags, addedMembers } = makeService();
		const result = await service.createOrganization(
			new Headers(),
			{
				name: 'Org',
				slug: 'org',
				sendInvites: false,
				users: [{ email: 'ani@example.com', name: 'Ani', roles: ['member'] }],
			} as never,
			ACTOR,
		);
		expect(result.members).toEqual([
			{ email: 'ani@example.com', status: 'invited', invitationId: 'inv-1' },
		]);
		expect(inviteInputs[0]?.organizationRoles).toEqual(['member']);
		expect(deliverFlags).toEqual([false]);
		expect(addedMembers).toHaveLength(0);
	});

	test('per-item isolation: one failed row does not stop the rest', async () => {
		const { service, inviteInputs } = makeService({
			invitations: {
				invite: async (input: Record<string, unknown>) => {
					if ((input as { email: string }).email === 'bad@example.com') {
						throw new Error('boom');
					}
					return { invitation: { id: 'inv-1' } };
				},
			} as never,
		});
		const result = await service.createOrganization(
			new Headers(),
			{
				name: 'Org',
				slug: 'org',
				users: [
					{ email: 'bad@example.com', name: 'Bad', roles: ['member'] },
					{ email: 'good@example.com', name: 'Good', roles: ['member'] },
				],
			} as never,
			ACTOR,
		);
		expect(result.members[0]).toMatchObject({
			email: 'bad@example.com',
			status: 'failed',
		});
		expect(result.members[1]).toMatchObject({
			email: 'good@example.com',
			status: 'invited',
		});
		// inviteInputs type unused after dropping the count assert.
		void inviteInputs;
	});

	test('duplicate emails in the request are rejected (zod refine)', async () => {
		const { createOrganizationSchema } = await import(
			'../../src/app/organization/contracts/organization.contract'
		);
		const parsed = createOrganizationSchema.safeParse({
			name: 'Org',
			slug: 'org',
			users: [
				{ email: 'x@example.com', name: 'X', roles: ['member'] },
				{ email: 'X@example.com', name: 'X2', roles: ['member'] },
			],
		});
		expect(parsed.success).toBe(false);
	});

	test('description is forwarded to the gateway and echoed in the response', async () => {
		const createInputs: Array<{ description?: string }> = [];
		const { service } = makeService({
			repository: {
				findById: async (id: string) => ({
					id,
					name: 'Org',
					slug: 'org',
					logo: null,
					description: 'Access control for offices.',
					deletedAt: null,
				}),
			} as unknown as IOrganizationRepository,
			gateway: {
				createOrganization: async (input: { description?: string }) => {
					createInputs.push(input);
					return { id: 'org-1' };
				},
			} as unknown as IOrganizationAuthGateway,
		});
		const result = await service.createOrganization(
			new Headers(),
			{ name: 'Org', slug: 'org', description: 'Access control for offices.' } as never,
			ACTOR,
		);
		expect(createInputs[0]?.description).toBe('Access control for offices.');
		expect(result.organization.description).toBe('Access control for offices.');
	});

	test('update forwards description and evicts the cached row', async () => {
		const updates: Array<{ description?: string | null }> = [];
		const invalidated: string[] = [];
		let stored: { description: string | null } = { description: null };
		const { service } = makeService({
			repository: {
				findById: async (id: string) => ({
					id,
					name: 'Org',
					slug: 'org',
					logo: null,
					description: stored.description,
					deletedAt: null,
				}),
				invalidateCache: async (id: string) => {
					invalidated.push(id);
				},
			} as unknown as IOrganizationRepository,
			gateway: {
				// Stands in for Better Auth: it writes the row itself.
				updateOrganization: async (
					_headers: Headers,
					input: { data: { description?: string | null } },
				) => {
					updates.push(input.data);
					stored = { description: input.data.description ?? null };
					return { id: 'org-1' };
				},
			} as unknown as IOrganizationAuthGateway,
		});

		const row = await service.updateOrganization(new Headers(), 'org-1', {
			description: 'Access control for offices.',
		} as never);

		expect(updates[0]?.description).toBe('Access control for offices.');
		// Without the eviction the cached pre-update row would be returned.
		expect(invalidated).toEqual(['org-1']);
		expect(row.description).toBe('Access control for offices.');
	});

	test('description is trimmed, blank becomes null, and 2000 chars is the cap', async () => {
		const { createOrganizationSchema } = await import(
			'../../src/app/organization/contracts/organization.contract'
		);
		const base = { name: 'Org', slug: 'org' };
		const trimmed = createOrganizationSchema.parse({
			...base,
			description: '  hello  ',
		});
		expect(trimmed.description).toBe('hello');
		// Whitespace-only is stored as null, never an empty string.
		const blank = createOrganizationSchema.parse({
			...base,
			description: '   ',
		});
		expect(blank.description).toBeNull();
		expect(
			createOrganizationSchema.safeParse({
				...base,
				description: 'x'.repeat(2001),
			}).success,
		).toBe(false);
		expect(
			createOrganizationSchema.safeParse({
				...base,
				description: 'x'.repeat(2000),
			}).success,
		).toBe(true);
	});
});

describe('organization image upload (ERP-0041)', () => {
	function fileFrom(bytes: number[], size?: number): File {
		const data = new Uint8Array(bytes);
		const file = new File([data], 'logo.webp', { type: 'image/webp' });
		if (size !== undefined && size !== data.length) {
			// Duck-type the size so the cap test does not allocate 2 MB+.
			Object.defineProperty(file, 'size', { value: size });
		}
		return file;
	}

	const WEBP = [
		0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
	];

	test('organizationImageFrom accepts any non-empty file; format is decided server-side', () => {
		expect(organizationImageFrom({ file: fileFrom(WEBP) })).toBeInstanceOf(File);
		// A JPEG is accepted here too: `toWebp` re-encodes it in the service.
		expect(
			organizationImageFrom({ file: fileFrom([0xff, 0xd8, 0xff, 0xe0]) }),
		).toBeInstanceOf(File);
		expect(() => organizationImageFrom({})).toThrow(OrganizationImageInvalidError);
	});

	test('rejects an empty and an over-cap file by size', () => {
		expect(() =>
			organizationImageFrom({ file: fileFrom(WEBP, 0) }),
		).toThrow(OrganizationImageInvalidError);
		expect(() =>
			organizationImageFrom({ file: fileFrom(WEBP, 2 * 1024 * 1024 + 1) }),
		).toThrow(OrganizationImageInvalidError);
	});
});

describe('org-logo worker (ERP-0041)', () => {
	function orgRow(overrides: Partial<{ deletedAt: Date | null; logo: string | null }> = {}) {
		return { id: 'org-1', slug: 'org', logo: null, deletedAt: null, ...overrides };
	}

	test('skips when a logo is already set (real upload wins)', async () => {
		const setLogoCalls: Array<[string, string]> = [];
		const repository = {
			findById: async () => orgRow({ logo: 'organizations/org-1/logo.webp' }),
			setLogoIfEmpty: async (id: string, logo: string) => {
				setLogoCalls.push([id, logo]);
				return true;
			},
		} as unknown as IOrganizationRepository;
		await processOrgLogoJob(repository, { data: { organizationId: 'org-1', slug: 'org' } });
		expect(setLogoCalls).toHaveLength(0);
	});

	test('skips when the organization is deleted or missing', async () => {
		const setLogoCalls: Array<unknown> = [];
		const repository = {
			findById: async () => orgRow({ deletedAt: new Date() }),
			setLogoIfEmpty: async () => {
				setLogoCalls.push(1);
				return true;
			},
		} as unknown as IOrganizationRepository;
		await processOrgLogoJob(repository, { data: { organizationId: 'org-1', slug: 'org' } });
		const missing = {
			findById: async () => null,
			setLogoIfEmpty: async () => {
				setLogoCalls.push(1);
				return true;
			},
		} as unknown as IOrganizationRepository;
		await processOrgLogoJob(missing, { data: { organizationId: 'org-1', slug: 'org' } });
		expect(setLogoCalls).toHaveLength(0);
	});

	test('writes the generated logo under its own key, never the upload key', async () => {
		const written: string[] = [];
		const setLogoIfEmptyCalls: Array<[string, string]> = [];
		const repository = {
			findById: async () => orgRow(),
			setLogoIfEmpty: async (id: string, logo: string) => {
				setLogoIfEmptyCalls.push([id, logo]);
				return true;
			},
		} as unknown as IOrganizationRepository;
		// Stub the DiceBear fetch with a real 1x1 WebP so the worker's
		// re-encode step has something decodable (no network call).
		const generated = Buffer.from(
			'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=',
			'base64',
		);
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(generated, { status: 200 })) as unknown as typeof fetch;
		const s3 = await import('@providers/s3/s3');
		const originalWrite = s3.s3Client.write.bind(s3.s3Client);
		(s3.s3Client as unknown as { write: (key: string) => Promise<void> }).write = async (key: string) => {
			written.push(key);
		};
		try {
			await processOrgLogoJob(repository, { data: { organizationId: 'org-1', slug: 'org' } });
		} finally {
			globalThis.fetch = originalFetch;
			(s3.s3Client as unknown as { write: typeof originalWrite }).write = originalWrite;
		}
		expect(written).toEqual(['organizations/org-1/logo-generated.webp']);
		expect(setLogoIfEmptyCalls).toEqual([
			['org-1', 'organizations/org-1/logo-generated.webp'],
		]);
	});

	test('listOrganizations presigns the stored logo key, not the raw key', async () => {
		const row = (logo: string | null) => ({
			id: 'org-1',
			name: 'Org',
			slug: 'org',
			logo,
			deletedAt: null,
		});
		const { service } = makeService({
			repository: {
				paginate: async () => ({
					data: [row('organizations/org-1/logo.webp'), row(null)],
					meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
				}),
			} as unknown as IOrganizationRepository,
		});
		const page = await service.listOrganizations({ page: 1, limit: 20 });
		// The browser cannot sign, so a raw key would render as a broken image.
		expect(page.data[0]?.logo).toMatch(
			/organizations\/org-1\/logo\.webp\?.*X-Amz-Signature=/,
		);
		expect(page.data[1]?.logo).toBeNull();
	});

	test('logo API URL is deterministic on the slug (seed=slug, initials/webp, 256px)', async () => {
		const { orgLogoApiUrl } = await import('../../src/app/organization/queues/org-logo.worker');
		const url = orgLogoApiUrl('https://api.dicebear.com/', 'my-org');
		expect(url).toBe('https://api.dicebear.com/10.x/initials/webp?seed=my-org&size=256');
		// Same slug → same URL → same image.
		expect(orgLogoApiUrl('https://api.dicebear.com/', 'my-org')).toBe(url);
	});
});
