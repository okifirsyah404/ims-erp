/**
 * Customer portal accounts and sign-in (ERP-0022, ADR-0024 Q5/Q28).
 *
 * Owner decisions 2026-11-14: one login per person, staff invitation for
 * businesses, individuals sign up themselves, the person sets the password
 * from the emailed link. Since ADR-0024 the login is a column set on
 * `customer.customers` (`user_id`, `portal_role`, `portal_status`), and users
 * and credentials come from `ExportedUserService`.
 *
 * Covers: invitations and their refusals, members managed by owners, the
 * individual sign-up, the portal sign-in (staff logins refused, lockout), and
 * the `portal` guard on a real Elysia route.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type { TCustomerCompanySelect, TCustomerSelect } from '@drizzle/schemas/customer.schema';
import type { IPortalSessionGateway, TPortalSession } from '../../src/app/customer/contracts/portal.contract';
import type { TPortalCustomerIdentity } from '../../src/app/customer/contracts/portal-account.contract';
import type { ICompanyRepository, ICustomerPersonRepository } from '../../src/app/customer/contracts/customer.repository.interface';
import {
	PortalAccountExistsError,
	PortalAccountNotFoundError,
	PortalBusinessSignupError,
	PortalContactUnavailableError,
	PortalCustomerUnavailableError,
	PortalEmailTakenError,
	PortalInvalidCodeError,
	PortalNoCompanyError,
	PortalNotConfiguredError,
	PortalOwnerOnlyError,
	PortalRemoveSelfError,
} from '../../src/app/customer/errors/portal-account.errors';
import { PortalAttachmentsUnsupportedError, PortalInvalidCredentialsError, PortalLockedError } from '../../src/app/customer/errors/portal.errors';
import { PortalAccountService } from '../../src/app/customer/services/portal-account.service';
import { PortalAuthService } from '../../src/app/customer/services/portal-auth.service';
import { formPayload } from '../../src/app/customer/utils/form-payload';
import { PORTAL_SESSION_RESOLVER_TOKEN, type PortalContext } from '../../src/authorization/portal-auth';

/** Test-only passwords, generated per run (no credential-like literals in the source). */
const FAKE_PASSWORD_1 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_2 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_3 = `fake-${crypto.randomUUID()}`;
const FAKE_PASSWORD_4 = `fake-${crypto.randomUUID()}`;

const COMPANY_A = '0190a1b2-0000-7000-8000-0000000000a1';
const COMPANY_B = '0190a1b2-0000-7000-8000-0000000000b2';
const INACTIVE_COMPANY = '0190a1b2-0000-7000-8000-0000000000c3';

let people: TCustomerSelect[];
let companies: TCustomerCompanySelect[];
let users: { id: string; name: string; email: string; emailVerified: boolean; member: boolean; password: string | null }[];
let mails: { kind: string; to: string; url?: string; code?: string }[];
let revokedSessions: string[];
let cache: Map<string, unknown>;
let accounts: PortalAccountService;

const company = (id: string, name: string, status = 'active') => ({ id, name, status, taxId: null }) as TCustomerCompanySelect;

function personRow(data: Partial<TCustomerSelect>): TCustomerSelect {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		code: `C-${people.length + 1}`,
		companyId: null,
		name: 'X',
		position: null,
		email: null,
		phone: null,
		whatsapp: null,
		isPrimary: false,
		customerType: 'individual',
		status: 'active',
		ownerUserId: null,
		userId: null,
		portalRole: null,
		portalStatus: null,
		portalInvitedBy: null,
		portalLastLoginAt: null,
		notes: null,
		createdBy: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...data,
	} as TCustomerSelect;
}

type TPeopleFake = Pick<ICustomerPersonRepository, 'findById' | 'findByUserId' | 'create' | 'listPortalAccounts' | 'grantPortalAccess' | 'revokePortalAccess' | 'touchPortalLogin'>;

function fakePeople(): ICustomerPersonRepository {
	const live = (row: TCustomerSelect) => !row.deletedAt;
	const fake: TPeopleFake = {
		findById: async (id) => people.find((row) => live(row) && row.id === id) ?? null,
		findByUserId: async (userId) => people.find((row) => live(row) && row.userId === userId) ?? null,
		async create(data) {
			const row = personRow(data as Partial<TCustomerSelect>);
			people.push(row);
			return row;
		},
		async listPortalAccounts(scope) {
			return people.filter(
				(row) =>
					live(row) &&
					row.userId &&
					row.portalStatus !== 'revoked' &&
					(scope.companyId ? row.companyId === scope.companyId : row.id === scope.customerId),
			);
		},
		async grantPortalAccess(id, data) {
			const row = people.find((item) => live(item) && item.id === id);
			if (!row) return null;
			return Object.assign(row, { userId: data.userId, portalRole: data.portalRole, portalStatus: 'active', portalInvitedBy: data.portalInvitedBy });
		},
		async revokePortalAccess(id) {
			const row = people.find((item) => live(item) && item.id === id && item.userId && item.portalStatus !== 'revoked');
			if (!row) return null;
			const before = { ...row };
			Object.assign(row, { portalStatus: 'revoked', userId: null });
			return before;
		},
		async touchPortalLogin(id) {
			const row = people.find((item) => item.id === id);
			if (row) row.portalLastLoginAt = new Date();
		},
	};
	return fake as ICustomerPersonRepository;
}

const fakeCompanies = (): Pick<ICompanyRepository, 'findById'> => ({
	findById: async (id) => companies.find((row) => row.id === id) ?? null,
});

function fakeUsers() {
	const pick = (user: (typeof users)[number] | undefined) =>
		user ? { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified } : null;
	return {
		findByEmail: async (email: string) => pick(users.find((user) => user.email === email)),
		findById: async (id: string) => pick(users.find((user) => user.id === id)),
		async createPortalLogin(input: { name: string; email: string; emailVerified: boolean }) {
			const user = { id: `u-${users.length + 1}`, ...input, member: false, password: null };
			users.push(user);
			return pick(user)!;
		},
		isStaff: async (userId: string) => users.find((user) => user.id === userId)?.member ?? false,
		async setPassword(userId: string, password: string) {
			users.find((user) => user.id === userId)!.password = password;
		},
		async markEmailVerified(userId: string) {
			users.find((user) => user.id === userId)!.emailVerified = true;
		},
		hasPassword: async (id: string) => Boolean(users.find((user) => user.id === id)?.password),
		issuePasswordToken: async (userId: string) => `token-for-${userId}-0123456789`,
		revokeSessions: async (userId: string) => {
			revokedSessions.push(userId);
		},
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
	people = [];
	companies = [company(COMPANY_A, 'PT Alfa'), company(COMPANY_B, 'PT Beta'), company(INACTIVE_COMPANY, 'PT Mati', 'inactive')];
	users = [{ id: 'staff-1', name: 'Staff', email: 'staff@entragate.local', emailVerified: true, member: true, password: FAKE_PASSWORD_4 }];
	mails = [];
	revokedSessions = [];
	cache = new Map();
	accounts = new PortalAccountService(
		fakePeople(),
		fakeCompanies() as ICompanyRepository,
		fakeUsers(),
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
		fakeCache(),
	);
	accounts.portalUrl = 'https://portal.example.com/';
});

const invite = (body: { companyId?: string; customerId?: string; name: string; email: string; role: 'owner' | 'approver' | 'finance' | 'viewer' }) =>
	accounts.invite('staff-1', body);
const asCaller = (identity: TPortalCustomerIdentity | null) => identity!;

describe('portal accounts (staff invitations, D2)', () => {
	test('an invitation creates a contact person with an owner login and emails a link to the portal reset page', async () => {
		const account = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect(account.companyId).toBe(COMPANY_A);
		expect(account.role).toBe('owner');
		expect(account.passwordSet).toBe(false);
		expect(people).toHaveLength(1);
		expect(people[0]).toMatchObject({ customerType: 'contact', companyId: COMPANY_A, portalStatus: 'active', portalInvitedBy: 'staff-1' });
		expect(account.id).toBe(people[0]!.id);
		expect(mails).toEqual([{ kind: 'invite', to: 'budi@alfa.co.id', url: expect.stringMatching(/^https:\/\/portal\.example\.com\/reset-password\?token=/) }]);
	});

	test('an existing person can be invited; one login per person; staff emails, foreign people and inactive companies are refused', async () => {
		const budi = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		await invite({ companyId: COMPANY_A, name: 'Sari', email: 'sari@alfa.co.id', role: 'finance' });
		expect((await accounts.listForScope({ companyId: COMPANY_A })).map((row) => row.role)).toEqual(['owner', 'finance']);
		const dewi = personRow({ companyId: COMPANY_A, name: 'Dewi', customerType: 'contact' });
		people.push(dewi);
		const granted = await invite({ customerId: dewi.id, name: 'Dewi', email: 'dewi@alfa.co.id', role: 'viewer' });
		expect(granted.id).toBe(dewi.id);
		await expect(invite({ customerId: budi.id, name: 'B', email: 'b2@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalAccountExistsError);
		await expect(invite({ customerId: budi.id, companyId: COMPANY_B, name: 'B', email: 'b3@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalContactUnavailableError);
		await expect(invite({ companyId: COMPANY_B, name: 'Staff', email: 'staff@entragate.local', role: 'owner' })).rejects.toBeInstanceOf(PortalEmailTakenError);
		await expect(invite({ companyId: COMPANY_B, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' })).rejects.toBeInstanceOf(PortalEmailTakenError);
		await expect(invite({ companyId: INACTIVE_COMPANY, name: 'X', email: 'x@y.id', role: 'owner' })).rejects.toBeInstanceOf(PortalCustomerUnavailableError);
	});

	test('without PORTAL_URL nothing is created', async () => {
		accounts.portalUrl = null;
		await expect(invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' })).rejects.toBeInstanceOf(PortalNotConfiguredError);
		expect(people).toHaveLength(0);
	});

	test('revoking ends the sessions and frees the user; the login no longer resolves; the person can be invited again', async () => {
		const account = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect((await accounts.resolveCustomer(account.user.id))?.role).toBe('owner');
		await accounts.revoke(account.id);
		expect(revokedSessions).toEqual([account.user.id]);
		expect(people[0]).toMatchObject({ userId: null, portalStatus: 'revoked' });
		expect(await accounts.resolveCustomer(account.user.id)).toBeNull();
		await expect(accounts.revoke(account.id)).rejects.toBeInstanceOf(PortalAccountNotFoundError);
		const again = await invite({ customerId: account.id, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect(again.user.id).toBe(account.user.id);
	});

	test('a reset link goes only to an active portal login', async () => {
		await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		mails = [];
		await accounts.requestPasswordReset('nobody@x.id');
		await accounts.requestPasswordReset('staff@entragate.local');
		expect(mails).toHaveLength(0);
		await accounts.requestPasswordReset('BUDI@alfa.co.id');
		expect(mails.map((mail) => mail.kind)).toEqual(['reset']);
	});
});

describe('portal members (owners manage colleagues, D2)', () => {
	test('an owner invites and removes colleagues of their own company only', async () => {
		const budi = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		const caller = asCaller(await accounts.resolveCustomer(budi.user.id));
		const sari = await accounts.inviteMember(caller, { email: 'sari@alfa.co.id', role: 'approver' });
		expect(sari.role).toBe('approver');
		expect(sari.companyId).toBe(COMPANY_A);
		expect(people.find((row) => row.id === sari.id)!.portalInvitedBy).toBe(budi.user.id);
		const rina = await invite({ companyId: COMPANY_B, name: 'Rina', email: 'rina@beta.co.id', role: 'owner' });
		await expect(accounts.removeMember(caller, rina.id)).rejects.toBeInstanceOf(PortalAccountNotFoundError);
		await expect(accounts.removeMember(caller, budi.id)).rejects.toBeInstanceOf(PortalRemoveSelfError);
		await accounts.removeMember(caller, sari.id);
		expect((await accounts.members(caller)).map((row) => row.user.email)).toEqual(['budi@alfa.co.id']);
	});

	test('only an owner manages members', async () => {
		const budi = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		const viewer = await invite({ companyId: COMPANY_A, name: 'Vina', email: 'vina@alfa.co.id', role: 'viewer' });
		const caller = asCaller(await accounts.resolveCustomer(viewer.user.id));
		await expect(accounts.inviteMember(caller, { email: 'x@alfa.co.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalOwnerOnlyError);
		await expect(accounts.removeMember(caller, budi.id)).rejects.toBeInstanceOf(PortalOwnerOnlyError);
	});

	test('an individual customer has no company to invite members to', async () => {
		await accounts.startSignup({ accountType: 'individual', name: 'Dewi', email: 'dewi@mail.id', phone: null, password: FAKE_PASSWORD_1 });
		const code = mails.find((mail) => mail.kind === 'code')!.code!;
		const caller = await accounts.verifySignup('dewi@mail.id', code);
		await expect(accounts.inviteMember(caller, { email: 'x@mail.id', role: 'viewer' })).rejects.toBeInstanceOf(PortalNoCompanyError);
	});
});

describe('portal sign-up of individuals (D1)', () => {
	const signup = { accountType: 'individual' as const, name: 'Dewi', email: 'dewi@mail.id', phone: '0812 3456', password: FAKE_PASSWORD_1 };

	test('a code by email; the right code creates the individual customer and an owner login', async () => {
		expect(await accounts.startSignup(signup)).toEqual({ email: 'dewi@mail.id' });
		const code = mails.find((mail) => mail.kind === 'code')!.code!;
		expect(code).toMatch(/^\d{6}$/);
		expect(users.find((user) => user.email === 'dewi@mail.id')).toMatchObject({ emailVerified: false, password: FAKE_PASSWORD_1 });
		const identity = await accounts.verifySignup('dewi@mail.id', code);
		expect(identity.role).toBe('owner');
		expect(identity.companyId).toBeNull();
		expect(people).toHaveLength(1);
		expect(people[0]).toMatchObject({ id: identity.customerId, name: 'Dewi', email: 'dewi@mail.id', phone: '0812 3456', customerType: 'individual', portalStatus: 'active' });
		expect(people[0]!.code).toMatch(/^PRT-/);
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
		expect(people).toHaveLength(1);
	});
});

describe('portal sign-in', () => {
	let signedOut: string[];
	let auth: PortalAuthService;

	beforeEach(async () => {
		await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
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

	test('the person signs in and the token resolves to their company and role', async () => {
		const { context } = await auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers());
		expect(context.companyId).toBe(COMPANY_A);
		expect(context.role).toBe('owner');
		expect((await auth.resolve(context.accessToken))?.customerId).toBe(people[0]!.id);
		expect(people[0]!.portalLastLoginAt).not.toBeNull();
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

	test('a revoked login no longer resolves', async () => {
		const { context } = await auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers());
		await accounts.revoke(context.customerId);
		expect(await auth.resolve(context.accessToken)).toBeNull();
	});
});

describe('portal guard', () => {
	test('no token or an unknown token is 401; a known token reaches the handler with its customer', async () => {
		container.register(PORTAL_SESSION_RESOLVER_TOKEN, {
			useValue: {
				resolve: async (token: string) =>
					token === 'good-token'
						? ({ userId: 'u-a', customerId: 'p-a', companyId: COMPANY_A, role: 'owner', user: { id: 'u-a', name: 'Budi', email: 'b@a.id' }, accessToken: token } as PortalContext)
						: null,
			},
		});
		const { domainPlugin } = await import('../../src/http/plugin');
		const app = domainPlugin({ name: 'portal-test', prefix: '/customers/portal/v1', guards: 'portal' }).get(
			'/whoami',
			(ctx: unknown) => ({ companyId: (ctx as { portal: PortalContext }).portal.companyId }),
			{ portal: true },
		);
		const call = (headers: Record<string, string> = {}) => app.handle(new Request('http://localhost/customers/portal/v1/whoami', { headers }));
		expect((await call()).status).toBe(401);
		expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401);
		expect((await call({ authorization: 'Basic good-token' })).status).toBe(401);
		const ok = await call({ authorization: 'Bearer good-token' });
		expect(ok.status).toBe(200);
		expect(await ok.json()).toEqual({ companyId: COMPANY_A });
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
