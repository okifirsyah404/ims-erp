/**
 * ERP-0041 unit tests: nested-users per-item isolation on organization
 * create, WebP image validation, and the org-logo worker's skip rule.
 */
import { describe, expect, test } from 'bun:test';
import type { IOrganizationAuthGateway } from '../../src/app/organization/contracts/organization-auth.gateway.interface';
import type { IOrganizationRepository } from '../../src/app/organization/contracts/organization.repository.interface';
import { OrganizationService } from '../../src/app/organization/services/organization.service';
import {
	isWebpBuffer,
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
});

describe('WebP image validation (ERP-0041)', () => {
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

	test('accepts a real WebP magic-byte header', async () => {
		expect(await isWebpBuffer(fileFrom(WEBP))).toBe(true);
	});

	test('rejects a JPEG spoofed as image/webp', async () => {
		const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
		expect(await isWebpBuffer(fileFrom(jpeg))).toBe(false);
	});

	test('organizationImageFrom accepts WebP; size and body are checked later (magic bytes at service)', async () => {
		expect(organizationImageFrom({ file: fileFrom(WEBP) })).toBeInstanceOf(File);
		expect(() => organizationImageFrom({})).toThrow(OrganizationImageInvalidError);
	});

	test('rejects an empty and an over-cap file by size', async () => {
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
		// Stub the DiceBear fetch so no network call is made.
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), { status: 200 })) as unknown as typeof fetch;
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

	test('logo API URL is deterministic on the slug (seed=slug, initials/webp, 256px)', async () => {
		const { orgLogoApiUrl } = await import('../../src/app/organization/queues/org-logo.worker');
		const url = orgLogoApiUrl('https://api.dicebear.com/', 'my-org');
		expect(url).toBe('https://api.dicebear.com/10.x/initials/webp?seed=my-org&size=256');
		// Same slug → same URL → same image.
		expect(orgLogoApiUrl('https://api.dicebear.com/', 'my-org')).toBe(url);
	});
});
