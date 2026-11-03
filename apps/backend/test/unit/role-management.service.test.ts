import { describe, expect, mock, test } from 'bun:test';
import type { TRoleSelect } from '../../drizzle/schemas/role.schema';
import type { IRoleRepository } from '../../src/app/user/contracts/role.repository.interface';
import type { AuditService } from '../../src/app/audit/services/audit.service';
import {
	InvalidPermissionGrantError,
	RankGuardError,
	RoleInUseError,
	RoleNameTakenError,
	RoleNotFoundError,
} from '../../src/app/user/errors/invitation.errors';
import { RoleManagementService } from '../../src/app/user/services/role-management.service';
import type { TActor } from '../../src/app/user/services/invitation.service';

/**
 * Unit tests for the phase-4 role service. Every dependency is a mock — no
 * database connection is ever opened, per the project's test contract.
 */

const ORG = 'org-1';
const ACTOR: TActor = {
	userId: 'actor-1',
	email: 'actor@example.com',
	ip: '127.0.0.1',
	userAgent: 'bun-test',
};

function makeRole(overrides: Partial<TRoleSelect> = {}): TRoleSelect {
	return {
		id: 'role-1',
		organizationId: ORG,
		name: 'sales_lead',
		rank: 50,
		permissions: { quotation: ['read'] },
		isSystem: false,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeService(options: {
	role?: TRoleSelect | null;
	existingName?: TRoleSelect | null;
	deletedName?: TRoleSelect | null;
	memberCount?: number;
} = {}) {
	const roleRepository = {
		list: mock(() => Promise.resolve([])),
		findById: mock(() => Promise.resolve(options.role ?? null)),
		findByName: mock(() => Promise.resolve(options.existingName ?? null)),
		findByNameIncludingDeleted: mock(() =>
			Promise.resolve(options.deletedName ?? null),
		),
		create: mock((input: unknown) =>
			Promise.resolve(makeRole({ ...(input as object) })),
		),
		update: mock((id: string, patch: object) =>
			Promise.resolve(makeRole({ ...patch, id })),
		),
		softDelete: mock(() => Promise.resolve()),
		undelete: mock(() => Promise.resolve()),
		countMembers: mock(() => Promise.resolve(options.memberCount ?? 0)),
	};
	const audit = { record: mock(() => Promise.resolve()) };
	const service = new RoleManagementService(
		roleRepository as unknown as IRoleRepository,
		audit as unknown as AuditService,
	);
	return { service, roleRepository, audit };
}

describe('RoleManagementService.create', () => {
	test('creates a role below the caller rank and writes an audit entry', async () => {
		const { service, roleRepository, audit } = makeService();

		const role = await service.create(
			{
				organizationId: ORG,
				name: 'sales_lead',
				rank: 50,
				permissions: { quotation: ['read', 'read'] },
			},
			80,
			ACTOR,
		);

		expect(role.name).toBe('sales_lead');
		expect(roleRepository.create).toHaveBeenCalledTimes(1);
		// Duplicate actions are collapsed, so the DB never stores dupes.
		const input = roleRepository.create.mock.calls[0]?.[0] as {
			permissions: Record<string, string[]>;
			isSystem: boolean;
		};
		expect(input.permissions).toEqual({ quotation: ['read'] });
		expect(input.isSystem).toBe(false);
		expect(audit.record).toHaveBeenCalledTimes(1);
	});

	test('rejects a rank at or above the caller rank (escalation guard)', async () => {
		const { service } = makeService();

		await expect(
			service.create(
				{
					organizationId: ORG,
					name: 'sneaky',
					rank: 80,
					permissions: { quotation: ['read'] },
				},
				80,
				ACTOR,
			),
		).rejects.toBeInstanceOf(RankGuardError);
	});

	test('rejects a duplicate live role name', async () => {
		const { service } = makeService({ existingName: makeRole() });

		await expect(
			service.create(
				{
					organizationId: ORG,
					name: 'sales_lead',
					rank: 40,
					permissions: {},
				},
				80,
				ACTOR,
			),
		).rejects.toBeInstanceOf(RoleNameTakenError);
	});

	test('revives a soft-deleted role with the same name', async () => {
		const deleted = makeRole({ id: 'role-dead', deletedAt: new Date() });
		const { service, roleRepository } = makeService({ deletedName: deleted });

		const role = await service.create(
			{
				organizationId: ORG,
				name: 'sales_lead',
				rank: 40,
				permissions: {},
			},
			80,
			ACTOR,
		);

		expect(roleRepository.undelete).toHaveBeenCalledWith('role-dead');
		expect(roleRepository.create).not.toHaveBeenCalled();
		expect(role.id).toBe('role-dead');
		// The revive *updates* the soft-deleted row, so the repository's
		// update must not filter on `deletedAt` — doing so matched zero rows
		// and made `role.id` throw. Pin the id the update targets.
		expect(roleRepository.update).toHaveBeenCalledWith(
			'role-dead',
			expect.objectContaining({ rank: 40 }),
		);
	});

	test('rejects a grant outside the shared catalog vocabulary', async () => {
		const { service } = makeService();

		await expect(
			service.create(
				{
					organizationId: ORG,
					name: 'typo_role',
					rank: 40,
					permissions: { quotation: ['reed'] },
				},
				80,
				ACTOR,
			),
		).rejects.toBeInstanceOf(InvalidPermissionGrantError);

		await expect(
			service.create(
				{
					organizationId: ORG,
					name: 'typo_role',
					rank: 40,
					permissions: { not_a_resource: ['read'] },
				},
				80,
				ACTOR,
			),
		).rejects.toBeInstanceOf(InvalidPermissionGrantError);
	});
});

describe('RoleManagementService.update', () => {
	test('rejects editing a role at or above the caller rank', async () => {
		const { service } = makeService({ role: makeRole({ rank: 80 }) });

		await expect(
			service.update('role-1', ORG, { name: 'renamed' }, 80, ACTOR),
		).rejects.toBeInstanceOf(RankGuardError);
	});

	test('rejects a patch that raises the role to the caller rank', async () => {
		const { service } = makeService({ role: makeRole({ rank: 40 }) });

		await expect(
			service.update('role-1', ORG, { rank: 80 }, 80, ACTOR),
		).rejects.toBeInstanceOf(RankGuardError);
	});

	test('rejects a role belonging to another organization', async () => {
		const { service } = makeService({
			role: makeRole({ organizationId: 'other-org' }),
		});

		await expect(
			service.update('role-1', ORG, { rank: 20 }, 80, ACTOR),
		).rejects.toBeInstanceOf(RoleNotFoundError);
	});
});

describe('RoleManagementService.remove', () => {
	test('refuses to delete a system role', async () => {
		const { service, roleRepository } = makeService({
			role: makeRole({ isSystem: true, rank: 10 }),
		});

		await expect(
			service.remove('role-1', ORG, 80, ACTOR),
		).rejects.toBeInstanceOf(RoleInUseError);
		expect(roleRepository.softDelete).not.toHaveBeenCalled();
	});

	test('refuses to delete a role still held by members', async () => {
		const { service, roleRepository } = makeService({
			role: makeRole({ rank: 10 }),
			memberCount: 3,
		});

		await expect(
			service.remove('role-1', ORG, 80, ACTOR),
		).rejects.toBeInstanceOf(RoleInUseError);
		expect(roleRepository.softDelete).not.toHaveBeenCalled();
	});

	test('soft-deletes an unused custom role below the caller rank', async () => {
		const { service, roleRepository, audit } = makeService({
			role: makeRole({ rank: 10 }),
			memberCount: 0,
		});

		await service.remove('role-1', ORG, 80, ACTOR);

		expect(roleRepository.softDelete).toHaveBeenCalledWith('role-1');
		expect(audit.record).toHaveBeenCalledTimes(1);
	});

	test('rejects deleting a role at or above the caller rank', async () => {
		const { service } = makeService({ role: makeRole({ rank: 99 }) });

		await expect(
			service.remove('role-1', ORG, 80, ACTOR),
		).rejects.toBeInstanceOf(RankGuardError);
	});
});
