/**
 * Customer portal (ERP-0022, M07 T26 + the account part of M12 T25).
 *
 * Owner decisions 2026-11-14: one login per customer, staff invitation only,
 * the customer sets the password from the emailed link; tickets are the
 * after-sales service tickets with a message thread.
 *
 * Covers: invitations and their refusals, the portal sign-in (staff logins
 * refused, lockout), cross-customer denial for projects, tickets and devices,
 * internal notes and costs never reaching the portal, the customer's
 * messages and confirmation, and the `portal` guard on a real Elysia route.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type { TServiceTicketCommentSelect, TServiceTicketSelect, TWarrantyCertificateSelect } from '@drizzle/schemas/aftersales.schema';
import type { TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import type { TProjectEvidenceSelect, TProjectHandoverSelect, TProjectSelect, TProjectTaskSelect } from '@drizzle/schemas/projects.schema';
import { TicketNotFoundError, TicketStateError } from '../../src/app/aftersales/errors/service-ticket.errors';
import { ServiceTicketService } from '../../src/app/aftersales/services/service-ticket.service';
import type { IPortalSessionGateway, TPortalSession } from '../../src/app/portal/contracts/portal.contract';
import { PortalInvalidCredentialsError, PortalLockedError, PortalProductNotFoundError } from '../../src/app/portal/errors/portal.errors';
import { PortalAuthService } from '../../src/app/portal/services/portal-auth.service';
import { PortalService } from '../../src/app/portal/services/portal.service';
import { formPayload } from '../../src/app/portal/utils/form-payload';
import { PortalAttachmentsUnsupportedError } from '../../src/app/portal/errors/portal.errors';
import { projectDetail, ticketDetail, ticketSummary, type TPresenter } from '../../src/app/portal/utils/portal-presenter';
import { ProjectPortalService } from '../../src/app/projects/services/project-portal.service';
import type { IPortalAuthGateway, IPortalIdentityRepository, TPortalCustomerIdentity } from '../../src/app/user/contracts/portal-account.contract';
import {
	PortalAccountExistsError,
	PortalAccountNotFoundError,
	PortalBusinessSignupError,
	PortalContactUnavailableError,
	PortalCustomerUnavailableError,
	PortalEmailTakenError,
	PortalInvalidCodeError,
	PortalNotConfiguredError,
	PortalOwnerOnlyError,
	PortalRemoveSelfError,
} from '../../src/app/user/errors/portal-account.errors';
import { PortalAccountService } from '../../src/app/user/services/portal-account.service';
import { PORTAL_SESSION_RESOLVER_TOKEN, type PortalContext } from '../../src/authorization/portal-auth';

/** Test-only passwords, generated per run (no credential-like literals in the source). */
const FAKE_PASSWORD_1 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_2 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_3 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_4 = `fake-${crypto.randomUUID()}`;

const CUST_A = '0190a1b2-0000-7000-8000-0000000000a1';
const CUST_B = '0190a1b2-0000-7000-8000-0000000000b2';
const INACTIVE = '0190a1b2-0000-7000-8000-0000000000c3';

const contacts: { id: string; customerId: string; name: string; email: string | null }[] = [];
let createdCustomers: { id: string; name: string; email: string; phone: string | null }[];

const customers = {
	getActiveCustomer: async (id: string) =>
		id === CUST_A || id === CUST_B ? ({ id, name: id === CUST_A ? 'PT Alfa' : 'PT Beta', customerType: 'company', status: 'active' } as never) : null,
	getContact: async (customerId: string, contactId: string) => (contacts.find((row) => row.id === contactId && row.customerId === customerId) ?? null) as never,
	async addContact(customerId: string, input: { name: string; email: string | null }) {
		const row = { id: crypto.randomUUID(), customerId, name: input.name, email: input.email };
		contacts.push(row);
		return row as never;
	},
	async createFromPortalSignup(input: { name: string; email: string; phone: string | null }) {
		const customer = { id: crypto.randomUUID(), ...input };
		createdCustomers.push(customer);
		const contact = { id: crypto.randomUUID(), customerId: customer.id, name: input.name, email: input.email };
		contacts.push(contact);
		return { customer: { ...customer, customerType: 'individual', status: 'active' }, contact } as never;
	},
};

/* ------------------------------------------------------------------------ *
 * Portal accounts (Identity)
 * ------------------------------------------------------------------------ */

let identities: TPortalIdentitySelect[];
let users: { id: string; name: string; email: string; emailVerified: boolean; member: boolean; password: string | null }[];
let mails: { kind: string; to: string; url?: string; code?: string }[];
let revokedSessions: string[];
let cache: Map<string, unknown>;
let accounts: PortalAccountService;

function fakeIdentities(): IPortalIdentityRepository {
	const live = (row: TPortalIdentitySelect) => !row.deletedAt;
	return {
		findLiveByContact: async (contactId) => identities.find((row) => live(row) && row.contactId === contactId) ?? null,
		findLiveByUser: async (userId) => identities.find((row) => live(row) && row.userId === userId) ?? null,
		findLiveById: async (id) => identities.find((row) => live(row) && row.id === id) ?? null,
		listLiveByCustomer: async (customerId) => identities.filter((row) => live(row) && row.linkedEntityId === customerId),
		async create(data) {
			const now = new Date();
			const row = { ...data, id: crypto.randomUUID(), status: 'active', lastLoginAt: null, createdAt: now, updatedAt: now, deletedAt: null } as TPortalIdentitySelect;
			identities.push(row);
			return row;
		},
		async revoke(id) {
			const row = identities.find((item) => live(item) && item.id === id && item.status !== 'revoked');
			if (!row) return null;
			return Object.assign(row, { status: 'revoked', deletedAt: new Date() });
		},
		async touchLogin(id) {
			const row = identities.find((item) => item.id === id);
			if (row) row.lastLoginAt = new Date();
		},
	};
}

function fakeAuthGateway(): IPortalAuthGateway {
	const pick = (user: (typeof users)[number] | undefined) =>
		user ? { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified } : null;
	return {
		findUserByEmail: async (email) => pick(users.find((user) => user.email === email)),
		findUserById: async (id) => pick(users.find((user) => user.id === id)),
		async createUser(input) {
			const user = { id: `u-${users.length + 1}`, ...input, member: false, password: null };
			users.push(user);
			return pick(user)!;
		},
		async setPassword(userId, password) {
			users.find((user) => user.id === userId)!.password = password;
		},
		async markEmailVerified(userId) {
			users.find((user) => user.id === userId)!.emailVerified = true;
		},
		hasPassword: async (id) => Boolean(users.find((user) => user.id === id)?.password),
		issuePasswordToken: async (userId) => `token-for-${userId}-0123456789`,
		revokeSessions: async (userId) => {
			revokedSessions.push(userId);
		},
		isOrganizationMember: async (userId) => users.find((user) => user.id === userId)?.member ?? false,
	};
}

const fakeCache = () => ({
	get: async <T>(key: string) => cache.get(key) as T | undefined,
	set: async (key: string, value: unknown) => {
		cache.set(key, value);
	},
	del: async (...keys: string[]) => {
		for (const key of keys) cache.delete(key);
	},
});

beforeEach(() => {
	identities = [];
	contacts.length = 0;
	createdCustomers = [];
	users = [{ id: 'staff-1', name: 'Staff', email: 'staff@entragate.local', emailVerified: true, member: true, password: FAKE_PASSWORD_4 }];
	mails = [];
	revokedSessions = [];
	cache = new Map();
	accounts = new PortalAccountService(
		fakeIdentities(),
		fakeAuthGateway(),
		{
			sendInvitation: async (input) => {
				mails.push({ kind: 'invite', to: input.to, url: input.url });
			},
			sendPasswordReset: async (input) => {
				mails.push({ kind: 'reset', to: input.to, url: input.url });
			},
			sendSignupCode: async (input) => {
				mails.push({ kind: 'code', to: input.to, code: input.code });
			},
		},
		customers,
		fakeCache(),
	);
	accounts.portalUrl = 'https://portal.example.com/';
});

const owner = (identity: TPortalCustomerIdentity | null) => identity!;

describe('portal accounts (staff invitations, D2)', () => {
	test('an invitation creates a contact, an owner login and emails a link to the portal reset page', async () => {
		const account = await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect(account.customerId).toBe(CUST_A);
		expect(account.role).toBe('owner');
		expect(account.passwordSet).toBe(false);
		expect(contacts).toHaveLength(1);
		expect(account.contactId).toBe(contacts[0]!.id);
		expect(identities[0]!.createdBy).toBe('staff-1');
		expect(mails).toEqual([{ kind: 'invite', to: 'budi@alfa.co.id', url: expect.stringMatching(/^https:\/\/portal\.example\.com\/reset-password\?token=/) }]);
	});

	test('several people per customer, one login per contact; staff emails, foreign contacts and inactive customers are refused', async () => {
		await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		await accounts.invite('staff-1', { customerId: CUST_A, name: 'Sari', email: 'sari@alfa.co.id', role: 'finance' });
		expect((await accounts.listForCustomer(CUST_A)).map((row) => row.role)).toEqual(['owner', 'finance']);
		const budiContact = contacts[0]!.id;
		await expect(accounts.invite('staff-1', { customerId: CUST_A, contactId: budiContact, name: 'B', email: 'b2@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalAccountExistsError);
		await expect(accounts.invite('staff-1', { customerId: CUST_B, contactId: budiContact, name: 'B', email: 'b3@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalContactUnavailableError);
		await expect(accounts.invite('staff-1', { customerId: CUST_B, name: 'Staff', email: 'staff@entragate.local', role: 'owner' })).rejects.toBeInstanceOf(PortalEmailTakenError);
		await expect(accounts.invite('staff-1', { customerId: CUST_B, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' })).rejects.toBeInstanceOf(PortalEmailTakenError);
		await expect(accounts.invite('staff-1', { customerId: INACTIVE, name: 'X', email: 'x@y.id', role: 'owner' })).rejects.toBeInstanceOf(PortalCustomerUnavailableError);
	});

	test('without PORTAL_URL nothing is created', async () => {
		accounts.portalUrl = null;
		await expect(accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' })).rejects.toBeInstanceOf(PortalNotConfiguredError);
		expect(identities).toHaveLength(0);
	});

	test('revoking ends the sessions; the login no longer resolves; a new invitation is possible', async () => {
		const account = await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect((await accounts.resolveCustomer(account.user.id))?.role).toBe('owner');
		await accounts.revoke(account.id);
		expect(revokedSessions).toEqual([account.user.id]);
		expect(await accounts.resolveCustomer(account.user.id)).toBeNull();
		const again = await accounts.invite('staff-1', { customerId: CUST_A, contactId: account.contactId!, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect(again.user.id).toBe(account.user.id);
	});

	test('a reset link goes only to an active portal login', async () => {
		await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		mails = [];
		await accounts.requestPasswordReset('nobody@x.id');
		await accounts.requestPasswordReset('staff@entragate.local');
		expect(mails).toHaveLength(0);
		await accounts.requestPasswordReset('BUDI@alfa.co.id');
		expect(mails.map((mail) => mail.kind)).toEqual(['reset']);
	});
});

describe('portal members (owners manage colleagues, D2)', () => {
	test('an owner invites and removes colleagues of their own customer only', async () => {
		const budi = await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		const caller = owner(await accounts.resolveCustomer(budi.user.id));
		const sari = await accounts.inviteMember(caller, { email: 'sari@alfa.co.id', role: 'approver' });
		expect(sari.role).toBe('approver');
		expect(sari.customerId).toBe(CUST_A);
		expect(identities.find((row) => row.id === sari.id)!.createdBy).toBe(budi.user.id);
		const rina = await accounts.invite('staff-1', { customerId: CUST_B, name: 'Rina', email: 'rina@beta.co.id', role: 'owner' });
		await expect(accounts.removeMember(caller, rina.id)).rejects.toBeInstanceOf(PortalAccountNotFoundError);
		await expect(accounts.removeMember(caller, budi.id)).rejects.toBeInstanceOf(PortalRemoveSelfError);
		await accounts.removeMember(caller, sari.id);
		expect((await accounts.members(caller)).map((row) => row.user.email)).toEqual(['budi@alfa.co.id']);
	});

	test('only an owner manages members', async () => {
		await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		const viewer = await accounts.invite('staff-1', { customerId: CUST_A, name: 'Vina', email: 'vina@alfa.co.id', role: 'viewer' });
		const caller = owner(await accounts.resolveCustomer(viewer.user.id));
		await expect(accounts.inviteMember(caller, { email: 'x@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalOwnerOnlyError);
		await expect(accounts.removeMember(caller, identities[0]!.id)).rejects.toBeInstanceOf(PortalOwnerOnlyError);
	});
});

describe('portal sign-up of individuals (D1)', () => {
	const signup = { accountType: 'individual' as const, name: 'Dewi', email: 'dewi@mail.id', phone: '0812 3456', password: FAKE_PASSWORD_1 };

	test('a code by email; the right code creates the customer, its contact and an owner login', async () => {
		expect(await accounts.startSignup(signup)).toEqual({ email: 'dewi@mail.id' });
		const code = mails.find((mail) => mail.kind === 'code')!.code!;
		expect(code).toMatch(/^\d{6}$/);
		expect(users.find((user) => user.email === 'dewi@mail.id')).toMatchObject({ emailVerified: false, password: FAKE_PASSWORD_1 });
		const identity = await accounts.verifySignup('dewi@mail.id', code);
		expect(identity.role).toBe('owner');
		expect(createdCustomers).toEqual([{ id: identity.customerId, name: 'Dewi', email: 'dewi@mail.id', phone: '0812 3456' }]);
		expect(identity.contactId).toBe(contacts[0]!.id);
		expect(users.find((user) => user.email === 'dewi@mail.id')!.emailVerified).toBe(true);
		await expect(accounts.verifySignup('dewi@mail.id', code)).rejects.toBeInstanceOf(PortalInvalidCodeError);
	});

	test('businesses are refused; a known email gets the same answer and no email', async () => {
		await expect(accounts.startSignup({ ...signup, accountType: 'business' })).rejects.toBeInstanceOf(PortalBusinessSignupError);
		expect(await accounts.startSignup({ ...signup, email: 'staff@entragate.local' })).toEqual({ email: 'staff@entragate.local' });
		expect(mails).toHaveLength(0);
		expect(users.find((user) => user.id === 'staff-1')!.password).toBe(FAKE_PASSWORD_4);
	});

	test('five wrong codes kill the sign-up; a resend gives a new code', async () => {
		await accounts.startSignup(signup);
		for (let attempt = 0; attempt < 5; attempt += 1) {
			await expect(accounts.verifySignup('dewi@mail.id', '000000')).rejects.toBeInstanceOf(PortalInvalidCodeError);
		}
		const first = mails.find((mail) => mail.kind === 'code')!.code!;
		await expect(accounts.verifySignup('dewi@mail.id', first)).rejects.toBeInstanceOf(PortalInvalidCodeError);
		await accounts.startSignup(signup);
		await accounts.resendSignupCode('dewi@mail.id');
		const codes = mails.filter((mail) => mail.kind === 'code');
		const latest = codes[codes.length - 1]!.code!;
		expect((await accounts.verifySignup('dewi@mail.id', latest)).role).toBe('owner');
		expect(createdCustomers).toHaveLength(1);
	});
});

/* ------------------------------------------------------------------------ *
 * Sign-in
 * ------------------------------------------------------------------------ */

describe('portal sign-in', () => {
	let signedOut: string[];
	let auth: PortalAuthService;

	beforeEach(async () => {
		await accounts.invite('staff-1', { customerId: CUST_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		users.find((user) => user.email === 'budi@alfa.co.id')!.password = FAKE_PASSWORD_2;
		signedOut = [];
		const sessions: IPortalSessionGateway = {
			async signIn(email, password) {
				const user = users.find((item) => item.email === email);
				if (!user || user.password !== password) return null;
				return { token: `session-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } satisfies TPortalSession;
			},
			createSession: async (userId) => ({ token: `session-${userId}`, userId, expiresAt: new Date(Date.now() + 3600_000) }),
			getSession: async (token) => (token.startsWith('session-') ? { token, userId: token.slice(8), expiresAt: new Date(Date.now() + 3600_000) } : null),
			signOut: async (token) => {
				signedOut.push(token);
			},
			changePassword: async () => true,
			resetPassword: async () => true,
		};
		auth = new PortalAuthService(sessions, accounts, fakeCache());
	});

	test('the customer signs in and the token resolves to their customer and role', async () => {
		const { context } = await auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers());
		expect(context.customerId).toBe(CUST_A);
		expect(context.role).toBe('owner');
		expect((await auth.resolve(context.accessToken))?.customerId).toBe(CUST_A);
		expect(identities[0]!.lastLoginAt).not.toBeNull();
	});

	test('a staff login gets the same 401 and keeps no session', async () => {
		await expect(auth.login({ email: 'staff@entragate.local', password: FAKE_PASSWORD_4 }, new Headers())).rejects.toBeInstanceOf(PortalInvalidCredentialsError);
		expect(signedOut).toEqual(['session-staff-1']);
		expect(await auth.resolve('session-staff-1')).toBeNull();
	});

	test('five wrong passwords lock the email, even for the right password', async () => {
		for (let attempt = 1; attempt < 5; attempt += 1) {
			await expect(auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_3 }, new Headers())).rejects.toBeInstanceOf(PortalInvalidCredentialsError);
		}
		await expect(auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_3 }, new Headers())).rejects.toBeInstanceOf(PortalLockedError);
		await expect(auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers())).rejects.toBeInstanceOf(PortalLockedError);
	});

	test('a verified sign-up is signed in at once', async () => {
		await accounts.startSignup({ accountType: 'individual', name: 'Dewi', email: 'dewi@mail.id', phone: null, password: FAKE_PASSWORD_1 });
		const code = mails.find((mail) => mail.kind === 'code')!.code!;
		const { context } = await auth.verifySignup('dewi@mail.id', code);
		expect(context.role).toBe('owner');
		expect((await auth.resolve(context.accessToken))?.customerId).toBe(context.customerId);
	});
});

/* ------------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------------ */

let tickets: TServiceTicketSelect[];
let comments: TServiceTicketCommentSelect[];

function ticketService(): ServiceTicketService {
	return new ServiceTicketService(
		{
			paginate: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
			findById: async (id) => tickets.find((row) => row.id === id) ?? null,
			listByCustomer: async (customerId) => tickets.filter((row) => row.customerId === customerId),
			async create(data) {
				const row = { ...data, id: crypto.randomUUID(), status: 'new', assigneeUserId: null, resolvedAt: null, closedAt: null, resolution: null } as TServiceTicketSelect;
				tickets.push(row);
				return row;
			},
			async transition(id, from, data) {
				const row = tickets.find((ticket) => ticket.id === id);
				return row && from.includes(row.status) ? Object.assign(row, data) : null;
			},
		},
		{
			check: async () => ({ customerId: null, projectId: null, projectCode: null, deviceDescription: null, inWarranty: false, warrantyEndsOn: null, warrantyCode: null }),
		},
		customers,
		{ getProject: async () => null },
		{ getMemberRole: async () => 'customer_service', listMembers: async () => ({ meta: { page: 1, limit: 100, total: 0, totalPages: 0 }, data: [] }) as never },
		{ hasPermission: async () => true },
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
		{ next: async () => '0001/TKT/IMS/XI/26' },
		// M04: ticket events go to the outbox; not under test here.
		{ publish: async () => {} } as never,
		{ register: async () => ({}) as never },
		{
			list: async (ticketId, visibility) => comments.filter((row) => row.serviceTicketId === ticketId && (!visibility || row.visibility === visibility)),
			async latestCustomerVisible(ticketIds) {
				const result = new Map<string, { latest: TServiceTicketCommentSelect; count: number }>();
				for (const row of comments.filter((item) => ticketIds.includes(item.serviceTicketId) && item.visibility === 'customer')) {
					result.set(row.serviceTicketId, { latest: row, count: (result.get(row.serviceTicketId)?.count ?? 0) + 1 });
				}
				return result;
			},
			async create(data) {
				const now = new Date();
				const row = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null } as TServiceTicketCommentSelect;
				comments.push(row);
				return row;
			},
		},
	);
}

const actorA = { userId: 'u-a', name: 'Budi', email: 'budi@alfa.co.id', customerId: CUST_A };
const actorB = { userId: 'u-b', name: 'Rina', email: 'rina@beta.co.id', customerId: CUST_B };
const staff = { organizationId: 'org', actorUserId: 'cs-1', canManage: true };
const p: TPresenter = { t: (key) => key, language: 'id', today: '2026-11-14', now: new Date('2026-11-14T03:00:00Z') };

describe('portal tickets', () => {
	beforeEach(() => {
		tickets = [];
		comments = [];
	});

	test('opened from the portal: channel portal, the login as reporter', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'Gate macet', description: 'Tidak membuka sejak pagi', projectId: null, serialNumber: null, deviceDescription: null });
		const row = tickets[0]!;
		expect(row.channel).toBe('portal');
		expect(row.reporterName).toBe('Budi');
		expect(row.reporterContact).toBe('budi@alfa.co.id');
		expect(row.createdBy).toBe('u-a');
		expect(row.customerId).toBe(CUST_A);
		expect(ticket.code).toBe('0001/TKT/IMS/XI/26');
	});

	test("customer B never sees, reads or writes customer A's ticket", async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		expect(await service.listForCustomer(CUST_B)).toEqual([]);
		await expect(service.getForCustomer(CUST_B, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
		await expect(service.addCustomerMessage(actorB, ticket.id, 'halo')).rejects.toBeInstanceOf(TicketNotFoundError);
		await expect(service.confirmFromPortal(actorB, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
	});

	test('internal notes and the service cost never reach the portal', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		await service.addComment(staff, ticket.id, { body: 'Suku cadang mahal, tagih Rp 2 jt', visibility: 'internal' });
		await service.addComment(staff, ticket.id, { body: 'Teknisi datang besok', visibility: 'customer' });
		await service.addCustomerMessage(actorA, ticket.id, 'Terima kasih');
		const detail = await service.getForCustomer(CUST_A, ticket.id);
		expect(detail.messages.map((message) => message.body)).toEqual(['Teknisi datang besok', 'Terima kasih']);
		expect(JSON.stringify(detail)).not.toContain('Suku cadang');
		expect('serviceCost' in detail).toBe(false);
		expect(await service.listComments(staff, ticket.id)).toHaveLength(3);
		const presented = ticketDetail(p, detail);
		expect(JSON.stringify(presented)).not.toContain('Suku cadang');
		expect(presented.messages.filter((message) => message.kind === 'message')).toHaveLength(3);
	});

	test('a staff reply puts the ticket on "awaiting you"', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		expect(ticketSummary(p, (await service.listForCustomer(CUST_A))[0]!).status).toBe('new');
		await service.addComment(staff, ticket.id, { body: 'Boleh kirim foto?', visibility: 'customer' });
		expect(ticketSummary(p, (await service.listForCustomer(CUST_A))[0]!).status).toBe('awaiting_you');
	});

	test('the customer confirms only a resolved ticket; a closed ticket takes no messages', async () => {
		const service = ticketService();
		const ticket = await service.createFromPortal(actorA, { subject: 'A', description: 'A', projectId: null, serialNumber: null, deviceDescription: null });
		await expect(service.confirmFromPortal(actorA, ticket.id)).rejects.toBeInstanceOf(TicketStateError);
		await service.resolve(staff, ticket.id, { resolution: 'Motor diganti', serviceCost: 0 });
		const closed = await service.confirmFromPortal(actorA, ticket.id);
		expect(closed.status).toBe('closed');
		expect(tickets[0]!.confirmationChannel).toBe('portal');
		expect(tickets[0]!.confirmedByName).toBe('Budi');
		expect(tickets[0]!.closedBy).toBe('u-a');
		await expect(service.addCustomerMessage(actorA, ticket.id, 'lagi')).rejects.toBeInstanceOf(TicketStateError);
	});
});

/* ------------------------------------------------------------------------ *
 * Projects and devices
 * ------------------------------------------------------------------------ */

const project = (id: string, customerId: string, status: TProjectSelect['status'] = 'active') =>
	({
		id,
		code: `PRJ-${id}`,
		customerId,
		title: `Proyek ${id}`,
		siteName: 'Lobi',
		stage: 'installation',
		status,
		contractValue: 11_100_000_000,
		picUserId: 'pm-1',
		targetStartDate: '2026-11-01',
		targetEndDate: '2026-11-30',
		closedAt: null,
		notes: 'catatan internal',
		deletedAt: null,
	}) as unknown as TProjectSelect;

describe('portal projects', () => {
	const projects = [project('p1', CUST_A), project('p2', CUST_B), project('p3', CUST_A, 'cancelled')];
	const evidence = [
		{ id: 'e1', projectId: 'p1', kind: 'bast', storageKey: 'k1', fileName: 'bast.pdf', contentType: 'application/pdf', sizeBytes: 10, createdAt: new Date() },
		{ id: 'e2', projectId: 'p1', kind: 'other', storageKey: 'k2', fileName: 'internal.xlsx', contentType: 'application/vnd.ms-excel', sizeBytes: 10, createdAt: new Date() },
	] as TProjectEvidenceSelect[];
	const tasks = [
		{ projectId: 'p1', title: 'Survey', stage: 'preparation', status: 'done', dueDate: '2026-11-02', doneAt: new Date() },
		{ projectId: 'p1', title: 'Pasang', stage: 'installation', status: 'in_progress', dueDate: '2026-11-20', doneAt: null },
	] as TProjectTaskSelect[];
	const service = new ProjectPortalService(
		{
			listByCustomer: async (customerId: string) => projects.filter((row) => row.customerId === customerId && row.status !== 'cancelled'),
			findById: async (id: string) => projects.find((row) => row.id === id) ?? null,
			listTasks: async (projectId: string) => tasks.filter((task) => task.projectId === projectId),
			listEvidence: async (projectId: string) => evidence.filter((file) => file.projectId === projectId),
		} as never,
		{ list: async () => [{ id: 'b1', code: 'BAST-1', bastDate: '2026-11-25', workTitle: 'Swing gate', status: 'issued' }, { id: 'b2', code: 'BAST-2', bastDate: '2026-11-26', workTitle: 'X', status: 'cancelled' }] as TProjectHandoverSelect[] },
		{ getUser: async (id: string) => ({ id, name: 'Andi PM' }) as never },
		{ presignGet: (key: string) => `https://files/${key}?signed` },
	);

	test("only the customer's live projects; another customer's or a cancelled one answers null", async () => {
		expect((await service.listForCustomer(CUST_A)).map((row) => row.id)).toEqual(['p1']);
		expect(await service.getForCustomer(CUST_B, 'p1')).toBeNull();
		expect(await service.getForCustomer(CUST_A, 'p3')).toBeNull();
	});

	test('no contract value, notes or internal files; issued BASTs only', async () => {
		const detail = (await service.getForCustomer(CUST_A, 'p1'))!;
		const text = JSON.stringify(detail);
		expect(text).not.toContain('11100000000');
		expect(text).not.toContain('catatan internal');
		expect(detail.files.map((file) => file.fileName)).toEqual(['bast.pdf']);
		expect(detail.handovers.map((bast) => bast.code)).toEqual(['BAST-1']);
		const presented = projectDetail(p, detail);
		expect(presented.stage).toBe(3);
		expect(presented.progress).toBe(0.5);
		expect(presented.daysLeft).toBe(16);
		expect(presented.milestones.map((milestone) => milestone.state).slice(0, 4)).toEqual(['done', 'done', 'current', 'upcoming']);
	});
});

describe('portal devices', () => {
	const certificate = {
		id: '0190a1b2-0000-7000-8000-00000000ce01',
		code: 'SG-GARANSI-1',
		projectId: 'p1',
		customerId: CUST_A,
		items: [{ description: 'Swing gate', volume: '2 unit', remarks: 'SN-1, SN-2' }],
	} as unknown as TWarrantyCertificateSelect;
	const portal = (customerId: string) => ({ customerId }) as PortalContext;
	const service = new PortalService(
		{} as never,
		{} as never,
		{
			listForCustomer: async (customerId: string) => (customerId === CUST_A ? [certificate] : []),
			getForCustomer: async (customerId: string, id: string) => (customerId === CUST_A && id === certificate.id ? certificate : null),
		},
		customers,
		{} as never,
	);

	test("a device is a certificate line; another customer's or a missing line is 404", async () => {
		expect((await service.listDevices(portal(CUST_A))).map((device) => device.id)).toEqual([`${certificate.id}:0`]);
		await expect(service.getDevice(portal(CUST_B), `${certificate.id}:0`)).rejects.toBeInstanceOf(PortalProductNotFoundError);
		await expect(service.getDevice(portal(CUST_A), `${certificate.id}:1`)).rejects.toBeInstanceOf(PortalProductNotFoundError);
	});
});

/* ------------------------------------------------------------------------ *
 * The guard on a real route
 * ------------------------------------------------------------------------ */

describe('portal guard', () => {
	test('no token or an unknown token is 401; a known token reaches the handler with its customer', async () => {
		container.register(PORTAL_SESSION_RESOLVER_TOKEN, {
			useValue: {
				resolve: async (token: string) =>
					token === 'good-token' ? ({ userId: 'u-a', identityId: 'i', customerId: CUST_A, user: { id: 'u-a', name: 'Budi', email: 'b@a.id' }, accessToken: token } as PortalContext) : null,
			},
		});
		const { domainPlugin } = await import('../../src/http/plugin');
		const app = domainPlugin({ name: 'portal-test', prefix: '/portal/v1', guards: 'portal' }).get('/whoami', (ctx: unknown) => ({ customerId: (ctx as { portal: PortalContext }).portal.customerId }), {
			portal: true,
		});
		const call = (headers: Record<string, string> = {}) => app.handle(new Request('http://localhost/portal/v1/whoami', { headers }));
		expect((await call()).status).toBe(401);
		expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401);
		expect((await call({ authorization: 'Basic good-token' })).status).toBe(401);
		const ok = await call({ authorization: 'Bearer good-token' });
		expect(ok.status).toBe(200);
		expect(await ok.json()).toEqual({ customerId: CUST_A });
	});
});

describe('portal form payload', () => {
	test('JSON body, multipart payload as a string or already parsed; files refused in stage 1', () => {
		const input = { subject: 'Gate', description: 'Tidak membuka' };
		expect(formPayload(input)).toEqual(input);
		expect(formPayload({ payload: JSON.stringify(input) })).toEqual(input);
		expect(formPayload({ payload: input })).toEqual(input);
		expect(formPayload({ payload: input, photos: new File([], 'empty.jpg') })).toEqual(input);
		expect(() => formPayload({ payload: input, photos: [new File(['x'], 'a.jpg')] })).toThrow(PortalAttachmentsUnsupportedError);
	});
});
