import { describe, expect, mock, test } from 'bun:test';
import { EmployeeInviteService } from '../../src/app/hr/services/employee-invite.service';
import type { InvitationService, TActor } from '../../src/app/user/services/invitation.service';
import type { IEmployeeRepository } from '../../src/app/hr/contracts/employee.repository.interface';
import type { IUserPersonalFieldsPort } from '../../src/app/user/contracts/user-personal-fields.port';
import type { NumberingService } from '../../src/app/organization/services/numbering.service';
import { EmployeeEmailTakenError, EmployeeInviteError } from '../../src/app/hr/errors/hr.errors';

/**
 * Unit tests for the invite-creates-employee orchestration (ERP-0034).
 * Every dependency is a mock: no database, mailer, or Better Auth context.
 */

const ACTOR: TActor = { userId: 'actor-1', email: 'actor@example.com', ip: null, userAgent: 'bun-test' };

function makeDeps(overrides: {
	findByEmail?: IEmployeeRepository['findByEmail'];
	findByUserId?: IEmployeeRepository['findByUserId'];
	insert?: IEmployeeRepository['insert'];
} = {}) {
	const invitation = { id: 'inv-1' };
	const invitations = {
		invite: mock(async () => ({ invitation, userId: 'user-1', overwritten: false })),
		rollbackPending: mock(async () => undefined),
	};
	const employees = {
		findByEmail: mock(overrides.findByEmail ?? (async () => null)),
		findByUserId: mock(overrides.findByUserId ?? (async () => null)),
		codeTaken: mock(async () => false),
		insert: mock(
			overrides.insert ??
				(async (row: Record<string, unknown>) => ({ id: 'emp-1', ...row })),
		),
	};
	const numbering = { next: mock(async () => 'EMP-0001') };
	const personalFields = {
		get: mock(async () => null),
		update: mock(async () => undefined),
	};
	const service = new EmployeeInviteService(
		invitations as unknown as InvitationService,
		employees as unknown as IEmployeeRepository,
		numbering as unknown as NumberingService,
		personalFields as unknown as IUserPersonalFieldsPort,
	);
	return { service, invitations, employees, personalFields };
}

const row = { email: 'budi@example.com', name: 'Budi' };

describe('EmployeeInviteService', () => {
	test('success: invites, inserts employee with default profile, no rollback', async () => {
		const { service, invitations, employees } = makeDeps();
		const result = await service.invite(row, ACTOR);
		expect(result.ok).toBe(true);
		expect(invitations.invite).toHaveBeenCalledTimes(1);
		expect(employees.insert).toHaveBeenCalledTimes(1);
		const inserted = (employees.insert as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<string, unknown>;
		expect(inserted.fullName).toBe('Budi');
		expect(inserted.employmentStatus).toBe('active');
		expect(inserted.userId).toBe('user-1');
		expect(invitations.rollbackPending).not.toHaveBeenCalled();
	});

	test('email already an employee: rejected before any invite is sent', async () => {
		const { service, invitations } = makeDeps({
			findByEmail: async () => ({ id: 'emp-existing' }) as never,
		});
		await expect(service.invite(row, ACTOR)).rejects.toBeInstanceOf(EmployeeEmailTakenError);
		expect(invitations.invite).not.toHaveBeenCalled();
	});

	test('bulk: per-row email conflict is reported, other rows still run', async () => {
		const taken = 'taken@example.com';
		const { service } = makeDeps({
			findByEmail: async (email: string) => (email === taken ? ({ id: 'e' } as never) : null),
		});
		const result = await service.inviteBulk(
			[row, { email: taken, name: 'Taken' }, { email: 'ani@example.com', name: 'Ani' }],
			ACTOR,
		);
		expect(result.succeeded).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.results[1]).toMatchObject({ ok: false, email: taken });
	});

	test('employee insert fails after invite: rollbackPending runs and error is mapped', async () => {
		const { service, invitations } = makeDeps({
			insert: async () => {
				throw new EmployeeInviteError('insert failed');
			},
		});
		await expect(service.invite(row, ACTOR)).rejects.toBeInstanceOf(EmployeeInviteError);
		expect(invitations.rollbackPending).toHaveBeenCalledWith('inv-1', 'user-1', ACTOR);
	});

	test('retried invite reuses the employee row left by an earlier partial failure', async () => {
		const { service, employees, invitations } = makeDeps({
			findByUserId: async () => ({ id: 'emp-1', organizationId: null }) as never,
		});
		const result = await service.invite(row, ACTOR);
		expect(result.ok).toBe(true);
		expect(employees.insert).not.toHaveBeenCalled();
		expect(invitations.rollbackPending).not.toHaveBeenCalled();
	});
});
