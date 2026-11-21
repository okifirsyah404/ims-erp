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
 *
 * ERP-0094 (ADR-0027): every portal login carries the global `customer`
 * role, the guard requires it, and the session travels as Better Auth's
 * session cookie (`Set-Cookie` on sign-in, cleared on logout; never a bearer
 * token). New passwords are 12-128 characters.
 *
 * ERP-0106 (port of branch ERP-0081): the login's settings on
 * `customer.customers` (port plan D3), two-step sign-in by an emailed code,
 * signed-in devices addressed by session id, and deleting one's own login.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { container } from 'tsyringe';
import type { TCustomerCompanySelect, TCustomerSelect } from '@drizzle/schemas/customer.schema';
import {
	type IPortalSessionGateway,
	portalChangePasswordSchema,
	portalPasswordConfirmSchema,
	type TPortalDeviceSession,
	type TPortalSession,
} from '../../src/app/customer/contracts/portal.contract';
import { portalSignupSchema, type TPortalCustomerIdentity } from '../../src/app/customer/contracts/portal-account.contract';
import { PORTAL_ACCOUNT_SERVICE_TOKEN, PORTAL_AUTH_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN } from '../../src/app/customer/constants/di';
import type { ICompanyRepository, ICustomerPersonRepository } from '../../src/app/customer/contracts/customer.repository.interface';
import {
	PortalAccountExistsError,
	PortalAccountNotFoundError,
	PortalBusinessSignupError,
	PortalContactUnavailableError,
	PortalCustomerUnavailableError,
	PortalEmailTakenError,
	PortalInvalidCodeError,
	PortalLastOwnerError,
	PortalNoCompanyError,
	PortalNotConfiguredError,
	PortalOwnerOnlyError,
	PortalRemoveSelfError,
} from '../../src/app/customer/errors/portal-account.errors';
import {
	PortalAttachmentsUnsupportedError,
	PortalDeviceNotFoundError,
	PortalInvalidCredentialsError,
	PortalInvalidTokenError,
	PortalLockedError,
	PortalWrongPasswordError,
} from '../../src/app/customer/errors/portal.errors';
import { PORTAL_LOGIN_CODE_TTL_SECONDS, PortalAccountService } from '../../src/app/customer/services/portal-account.service';
import { maskEmail, PortalAuthService, type TPortalSignIn, type TPortalTwoStep } from '../../src/app/customer/services/portal-auth.service';
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
let users: { id: string; name: string; email: string; emailVerified: boolean; member: boolean; password: string | null; roles?: string[] }[];
let mails: { kind: string; to: string; url?: string; code?: string; language?: string }[];
let revokedSessions: string[];
let cache: Map<string, unknown>;
let cacheTtls: Map<string, number | undefined>;
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
		portalLanguage: null,
		portalTwoStep: false,
		portalPush: false,
		notes: null,
		createdBy: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		...data,
	} as TCustomerSelect;
}

type TPeopleFake = Pick<
	ICustomerPersonRepository,
	'findById' | 'findByUserId' | 'create' | 'update' | 'listPortalAccounts' | 'grantPortalAccess' | 'revokePortalAccess' | 'touchPortalLogin'
>;

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
		async update(id, patch) {
			const row = people.find((item) => live(item) && item.id === id);
			return row ? Object.assign(row, patch) : null;
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
			Object.assign(row, { portalStatus: 'revoked', userId: null, portalLanguage: null, portalTwoStep: false, portalPush: false });
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
		async grantCustomerRole(userId: string) {
			const user = users.find((item) => item.id === userId)!;
			user.roles = [...new Set([...(user.roles ?? []).filter((role) => role !== 'user'), 'customer'])];
		},
	};
}

const fakeCache = () => ({
	get: async <T>(key: string) => cache.get(key) as T | undefined,
	set: async (key: string, value: unknown, ttl?: number) => {
		cache.set(key, value);
		cacheTtls.set(key, ttl);
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
	cacheTtls = new Map();
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
			sendLoginCode: async (input) => {
				mails.push({ kind: 'login', to: input.to, code: input.code, ...(input.language ? { language: input.language } : {}) });
			},
		},
		fakeCache(),
	);
	accounts.portalUrl = 'https://portal.example.com/';
});

const invite = (body: { companyId?: string; customerId?: string; name: string; email: string; role: 'owner' | 'approver' | 'finance' | 'viewer' }) =>
	accounts.invite('staff-1', body);
const asCaller = (identity: TPortalCustomerIdentity | null) => identity!;
/** A sign-in that must have yielded a session (two-step off). */
function signedIn(result: TPortalSignIn | TPortalTwoStep): TPortalSignIn {
	if ('twoStep' in result) throw new Error('expected a session, got a two-step challenge');
	return result;
}

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

	test('an invitation grants the global customer role (ADR-0027)', async () => {
		const account = await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		expect(users.find((user) => user.id === account.user.id)!.roles).toEqual(['customer']);
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
		expect(users.find((user) => user.email === 'dewi@mail.id')!.roles).toEqual(['customer']);
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

/** Better Auth sessions of the fake gateway: what `listSessions` sees. */
let liveSessions: (TPortalDeviceSession & { userId: string })[];
let createdFrom: (Headers | undefined)[];

describe('portal sign-in', () => {
	let signedOut: string[];
	let auth: PortalAuthService;
	let sessions: IPortalSessionGateway;

	beforeEach(async () => {
		await invite({ companyId: COMPANY_A, name: 'Budi', email: 'budi@alfa.co.id', role: 'owner' });
		users.find((user) => user.email === 'budi@alfa.co.id')!.password = FAKE_PASSWORD_2;
		signedOut = [];
		liveSessions = [];
		createdFrom = [];
		const track = (userId: string, from?: Headers) => {
			const now = new Date();
			if (!liveSessions.some((item) => item.token === `session-${userId}`)) {
				liveSessions.push({
					id: `sid-${liveSessions.length + 1}`,
					token: `session-${userId}`,
					userId,
					userAgent: from?.get('user-agent') ?? null,
					ipAddress: null,
					createdAt: now,
					updatedAt: now,
				});
			}
		};
		const userOf = (token: string) => token.split('.')[0]!.slice('session-'.length);
		const session = (userId: string): TPortalSession => ({
			token: `session-${userId}`,
			userId,
			roles: users.find((user) => user.id === userId)?.roles ?? [],
			expiresAt: new Date(Date.now() + 3600_000),
		});
		sessions = {
			async signIn(email, password) {
				const user = users.find((item) => item.email === email);
				if (!user || user.password !== password) return null;
				track(user.id);
				return session(user.id);
			},
			createSession: async (userId, from) => {
				createdFrom.push(from);
				track(userId, from);
				return session(userId);
			},
			getSession: async (token) => (token.startsWith('session-') ? session(token.slice(8)) : null),
			tokenFromHeaders: async (headers) => /(?:^|;\s*)sid=([^;]+)/.exec(headers.get('cookie') ?? '')?.[1] ?? null,
			sessionCookie: async (value) => `sid=${value.token}; Path=/; HttpOnly`,
			clearedSessionCookie: async () => 'sid=; Path=/; Max-Age=0',
			signOut: async (token) => {
				signedOut.push(token);
				liveSessions = liveSessions.filter((item) => item.token !== token);
			},
			changePassword: async () => true,
			resetPassword: async () => true,
			verifyPassword: async (token, password) => users.find((user) => user.id === userOf(token))?.password === password,
			listSessions: async (token) => liveSessions.filter((item) => item.userId === userOf(token)).map(({ userId: _userId, ...device }) => device),
			revokeSession: async (token, sessionToken) => {
				liveSessions = liveSessions.filter((item) => !(item.token === sessionToken && item.userId === userOf(token)));
			},
			revokeOtherSessions: async (token) => {
				const raw = token.split('.')[0]!;
				liveSessions = liveSessions.filter((item) => item.userId !== userOf(token) || item.token === raw);
			},
		};
		auth = new PortalAuthService(sessions, accounts, fakeCache());
	});

	test('the person signs in and the session cookie resolves to their company and role', async () => {
		const { context, session } = signedIn(await auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers()));
		expect(context.companyId).toBe(COMPANY_A);
		expect(context.role).toBe('owner');
		expect(session.roles).toContain('customer');
		const setCookie = await auth.sessionCookie(session);
		const cookie = new Headers({ cookie: setCookie.split(';')[0]! });
		expect((await auth.resolve(cookie))?.customerId).toBe(people[0]!.id);
		expect(people[0]!.portalLastLoginAt).not.toBeNull();
	});

	test('no cookie, an unknown cookie or a bearer header resolves to nothing', async () => {
		expect(await auth.resolve(new Headers())).toBeNull();
		expect(await auth.resolve(new Headers({ cookie: 'sid=nope' }))).toBeNull();
		const budi = users.find((user) => user.email === 'budi@alfa.co.id')!;
		expect(await auth.resolve(new Headers({ authorization: `Bearer session-${budi.id}` }))).toBeNull();
	});

	test('a staff login gets the same 401 and keeps no session', async () => {
		await expect(auth.login({ email: 'staff@entragate.local', password: FAKE_PASSWORD_4 }, new Headers())).rejects.toBeInstanceOf(PortalInvalidCredentialsError);
		expect(signedOut).toEqual(['session-staff-1']);
		expect(await auth.resolve(new Headers({ cookie: 'sid=session-staff-1' }))).toBeNull();
	});

	test('a login without the customer role gets the same 401 and does not resolve, even with an active portal login', async () => {
		const budi = users.find((user) => user.email === 'budi@alfa.co.id')!;
		budi.roles = ['user'];
		await expect(auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers())).rejects.toBeInstanceOf(PortalInvalidCredentialsError);
		expect(signedOut).toEqual([`session-${budi.id}`]);
		expect(await auth.resolve(new Headers({ cookie: `sid=session-${budi.id}` }))).toBeNull();
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
		expect((await auth.resolve(new Headers({ cookie: `sid=${context.sessionToken}` })))?.customerId).toBe(context.customerId);
	});

	test('a verified sign-up without the customer role is not signed in', async () => {
		await accounts.startSignup({ accountType: 'individual', name: 'Dewi', email: 'dewi@mail.id', phone: null, password: FAKE_PASSWORD_1 });
		const code = mails.find((mail) => mail.kind === 'code')!.code!;
		const plain = new PortalAuthService(
			{
				...sessions,
				createSession: async (userId) => ({ token: `session-${userId}`, userId, roles: ['user'], expiresAt: new Date(Date.now() + 3600_000) }),
			},
			accounts,
			fakeCache(),
		);
		await expect(plain.verifySignup('dewi@mail.id', code)).rejects.toBeInstanceOf(PortalInvalidTokenError);
	});

	test('a revoked login no longer resolves', async () => {
		const { context } = signedIn(await auth.login({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }, new Headers()));
		await accounts.revoke(context.customerId);
		expect(await auth.resolve(new Headers({ cookie: `sid=${context.sessionToken}` }))).toBeNull();
	});

	test('HTTP: sign-in answers Set-Cookie and no token in the body; logout clears the cookie; bearer is refused', async () => {
		container.register(PORTAL_AUTH_SERVICE_TOKEN, { useValue: auth });
		container.register(PORTAL_ACCOUNT_SERVICE_TOKEN, { useValue: accounts });
		container.register(PORTAL_SERVICE_TOKEN, { useValue: { customer: async () => null } as never });
		container.register(PORTAL_SESSION_RESOLVER_TOKEN, { useValue: auth });
		const { PortalAuthController, PortalController } = await import('../../src/app/customer/controllers/portal.controller');
		const signIn = await PortalAuthController.plugin().handle(
			new Request('http://localhost/customers/portal/v1/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }),
			}),
		);
		expect(signIn.status).toBe(200);
		const setCookie = signIn.headers.get('set-cookie')!;
		expect(setCookie).toMatch(/^sid=session-/);
		const body = (await signIn.json()) as { data: Record<string, unknown> };
		expect(body.data.tokens).toBeUndefined();
		expect(JSON.stringify(body)).not.toContain('session-u-');
		expect(body.data.session).toEqual({ expiresAt: expect.any(String) });

		const portal = PortalController.plugin();
		const cookie = setCookie.split(';')[0]!;
		const token = cookie.slice('sid='.length);
		const bearer = await portal.handle(new Request('http://localhost/customers/portal/v1/me', { headers: { authorization: `Bearer ${token}` } }));
		expect(bearer.status).toBe(401);
		const me = await portal.handle(new Request('http://localhost/customers/portal/v1/me', { headers: { cookie } }));
		expect(me.status).toBe(200);
		const logout = await portal.handle(new Request('http://localhost/customers/portal/v1/auth/logout', { method: 'POST', headers: { cookie } }));
		expect(logout.status).toBe(200);
		expect(logout.headers.get('set-cookie')).toBe('sid=; Path=/; Max-Age=0');
		expect(signedOut).toEqual([token]);
		// The first import of the controller graph (Better Auth, mailer, i18n) is slow on a cold run.
	}, 60_000);

	/* ERP-0106: settings, two-step sign-in, devices, deleting one's own login */

	const budiOf = () => people.find((row) => row.email === 'budi@alfa.co.id')!;
	const budiUser = () => users.find((user) => user.email === 'budi@alfa.co.id')!;
	const loginBudi = (password = FAKE_PASSWORD_2, headers = new Headers()) => auth.login({ email: 'budi@alfa.co.id', password }, headers);
	const twoStepOn = async () => {
		const caller = asCaller(await accounts.resolveCustomer(budiUser().id));
		await accounts.updateSettings(caller, { twoStep: true });
	};
	const last = <T>(items: T[]) => items[items.length - 1];
	const lastCode = () => last(mails.filter((mail) => mail.kind === 'login'))!.code!;

	test('settings default off/null, change one at a time and are reset when the login is revoked', async () => {
		const caller = asCaller(await accounts.resolveCustomer(budiUser().id));
		expect(await accounts.settings(caller)).toEqual({ language: null, twoStep: false, push: false });
		expect(await accounts.updateSettings(caller, { push: true })).toEqual({ language: null, twoStep: false, push: true });
		expect(await accounts.updateSettings(caller, { language: 'id', twoStep: true })).toEqual({ language: 'id', twoStep: true, push: true });
		expect(budiOf()).toMatchObject({ portalLanguage: 'id', portalTwoStep: true, portalPush: true });
		await accounts.revoke(caller.customerId);
		expect(budiOf()).toMatchObject({ portalLanguage: null, portalTwoStep: false, portalPush: false });
	});

	test('two-step on: the right password gives no session, the password session is dropped and a code is emailed', async () => {
		await twoStepOn();
		mails = [];
		const result = await loginBudi();
		expect(result).toEqual({ twoStep: true, challenge: expect.any(String), email: 'b***@alfa.co.id' });
		expect('context' in result).toBe(false);
		expect(signedOut).toEqual([`session-${budiUser().id}`]);
		expect(liveSessions).toHaveLength(0);
		expect(mails).toEqual([{ kind: 'login', to: 'budi@alfa.co.id', code: expect.stringMatching(/^\d{6}$/) }]);
		expect(budiOf().portalLastLoginAt).toBeNull();
		const key = [...cache.keys()].find((item) => item.startsWith('portal:login-code:'))!;
		expect(cacheTtls.get(key)).toBe(PORTAL_LOGIN_CODE_TTL_SECONDS);
		expect(JSON.stringify(cache.get(key))).not.toContain(lastCode());
		expect(maskEmail('dewi@mail.id')).toBe('d***@mail.id');
	});

	test('two-step: the code goes out in the language the login chose', async () => {
		const caller = asCaller(await accounts.resolveCustomer(budiUser().id));
		await accounts.updateSettings(caller, { twoStep: true, language: 'id' });
		await loginBudi();
		expect(last(mails.filter((mail) => mail.kind === 'login'))!.language).toBe('id');
	});

	test('two-step: the right code signs in on this device, once', async () => {
		await twoStepOn();
		const { challenge } = (await loginBudi()) as TPortalTwoStep;
		const device = new Headers({ 'user-agent': 'Firefox/1' });
		const { context, session } = await auth.verifyLoginCode(challenge, lastCode(), device);
		expect(context.customerId).toBe(budiOf().id);
		expect(session.roles).toContain('customer');
		expect(last(createdFrom)?.get('user-agent')).toBe('Firefox/1');
		expect(budiOf().portalLastLoginAt).not.toBeNull();
		expect((await auth.resolve(new Headers({ cookie: `sid=${session.token}` })))?.customerId).toBe(budiOf().id);
		await expect(auth.verifyLoginCode(challenge, lastCode(), device)).rejects.toBeInstanceOf(PortalInvalidCodeError);
	});

	test('two-step: wrong codes count; the fifth ends the challenge, even for the right code', async () => {
		await twoStepOn();
		const { challenge } = (await loginBudi()) as TPortalTwoStep;
		const right = lastCode();
		const wrong = right === '000000' ? '111111' : '000000';
		for (let attempt = 1; attempt < 5; attempt += 1) {
			await expect(auth.verifyLoginCode(challenge, wrong, new Headers())).rejects.toBeInstanceOf(PortalInvalidCodeError);
			expect((cache.get(`portal:login-code:${challenge}`) as { attempts: number }).attempts).toBe(attempt);
		}
		await expect(auth.verifyLoginCode(challenge, wrong, new Headers())).rejects.toBeInstanceOf(PortalInvalidCodeError);
		await expect(auth.verifyLoginCode(challenge, right, new Headers())).rejects.toBeInstanceOf(PortalInvalidCodeError);
		expect(liveSessions).toHaveLength(0);
	});

	test('two-step: an expired code (gone from Redis) fails; a resend gives a new working code', async () => {
		await twoStepOn();
		const { challenge } = (await loginBudi()) as TPortalTwoStep;
		const first = lastCode();
		await auth.resendLoginCode(challenge);
		const second = lastCode();
		if (first !== second) await expect(auth.verifyLoginCode(challenge, first, new Headers())).rejects.toBeInstanceOf(PortalInvalidCodeError);
		cache.delete(`portal:login-code:${challenge}`);
		await expect(auth.verifyLoginCode(challenge, second, new Headers())).rejects.toBeInstanceOf(PortalInvalidCodeError);
		await auth.resendLoginCode(challenge);
		expect(mails.filter((mail) => mail.kind === 'login')).toHaveLength(2);
	});

	test('two-step: wrong passwords still lock the email', async () => {
		await twoStepOn();
		for (let attempt = 1; attempt < 5; attempt += 1) {
			await expect(loginBudi(FAKE_PASSWORD_3)).rejects.toBeInstanceOf(PortalInvalidCredentialsError);
		}
		await expect(loginBudi(FAKE_PASSWORD_3)).rejects.toBeInstanceOf(PortalLockedError);
		await expect(loginBudi()).rejects.toBeInstanceOf(PortalLockedError);
		expect(mails.filter((mail) => mail.kind === 'login')).toHaveLength(0);
	});

	test('devices: listed without tokens, the current one first; sign out one by id or all others', async () => {
		const { context } = signedIn(await loginBudi());
		const userId = budiUser().id;
		const old = new Date(Date.now() - 86_400_000);
		liveSessions.push(
			{ id: 'sid-phone', token: 'tok-phone', userId, userAgent: 'iPhone', ipAddress: '10.0.0.8', createdAt: old, updatedAt: old },
			{ id: 'sid-tab', token: 'tok-tab', userId, userAgent: 'iPad', ipAddress: null, createdAt: old, updatedAt: new Date(Date.now() - 1000) },
			{ id: 'sid-other', token: 'tok-other', userId: 'someone-else', userAgent: null, ipAddress: null, createdAt: old, updatedAt: old },
		);
		const signedCookie = { ...context, sessionToken: `${context.sessionToken}.signature` };
		const devices = await auth.devices(signedCookie);
		expect(devices.map((device) => [device.id, device.current])).toEqual([
			['sid-1', true],
			['sid-tab', false],
			['sid-phone', false],
		]);
		expect(JSON.stringify(devices)).not.toContain('tok-');
		expect(JSON.stringify(devices)).not.toContain('session-');
		await expect(auth.revokeDevice(signedCookie, 'sid-other')).rejects.toBeInstanceOf(PortalDeviceNotFoundError);
		await expect(auth.revokeDevice(signedCookie, 'nope')).rejects.toBeInstanceOf(PortalDeviceNotFoundError);
		await auth.revokeDevice(signedCookie, 'sid-phone');
		expect((await auth.devices(signedCookie)).map((device) => device.id)).toEqual(['sid-1', 'sid-tab']);
		await auth.revokeOtherDevices(signedCookie);
		expect((await auth.devices(signedCookie)).map((device) => device.id)).toEqual(['sid-1']);
		expect(liveSessions.map((item) => item.id)).toContain('sid-other');
	});

	test('delete own login: the password is required; the login is revoked, sessions end, the person stays', async () => {
		const sari = await invite({ companyId: COMPANY_A, name: 'Sari', email: 'sari@alfa.co.id', role: 'finance' });
		users.find((user) => user.id === sari.user.id)!.password = FAKE_PASSWORD_1;
		const { context } = signedIn(await auth.login({ email: 'sari@alfa.co.id', password: FAKE_PASSWORD_1 }, new Headers()));
		await expect(auth.closeAccount(context, FAKE_PASSWORD_3)).rejects.toBeInstanceOf(PortalWrongPasswordError);
		expect(revokedSessions).toEqual([]);
		await auth.closeAccount(context, FAKE_PASSWORD_1);
		expect(revokedSessions).toEqual([sari.user.id]);
		const row = people.find((item) => item.id === sari.id)!;
		expect(row).toMatchObject({ userId: null, portalStatus: 'revoked', deletedAt: null, name: 'Sari', companyId: COMPANY_A });
		expect(await auth.resolve(new Headers({ cookie: `sid=${context.sessionToken}` }))).toBeNull();
	});

	test('delete own login: the only active owner of a company is refused; with a second owner it works', async () => {
		const { context } = signedIn(await loginBudi());
		await expect(auth.closeAccount(context, FAKE_PASSWORD_2)).rejects.toBeInstanceOf(PortalLastOwnerError);
		expect(budiOf()).toMatchObject({ portalStatus: 'active' });
		const suspended = await invite({ companyId: COMPANY_A, name: 'Wati', email: 'wati@alfa.co.id', role: 'owner' });
		people.find((row) => row.id === suspended.id)!.portalStatus = 'suspended';
		await expect(auth.closeAccount(context, FAKE_PASSWORD_2)).rejects.toBeInstanceOf(PortalLastOwnerError);
		await invite({ companyId: COMPANY_A, name: 'Joko', email: 'joko@alfa.co.id', role: 'owner' });
		await auth.closeAccount(context, FAKE_PASSWORD_2);
		expect(budiOf()).toMatchObject({ portalStatus: 'revoked', userId: null });
	});

	test('delete own login: an individual customer (their own account) may', async () => {
		await accounts.startSignup({ accountType: 'individual', name: 'Dewi', email: 'dewi@mail.id', phone: null, password: FAKE_PASSWORD_1 });
		const { context } = await auth.verifySignup('dewi@mail.id', mails.find((mail) => mail.kind === 'code')!.code!);
		await auth.closeAccount(context, FAKE_PASSWORD_1);
		expect(people.find((row) => row.id === context.customerId)).toMatchObject({ portalStatus: 'revoked', userId: null, customerType: 'individual' });
	});

	test('HTTP: two-step login sets no cookie and returns no token; verify answers Set-Cookie; devices hide tokens; close clears the cookie', async () => {
		await twoStepOn();
		container.register(PORTAL_AUTH_SERVICE_TOKEN, { useValue: auth });
		container.register(PORTAL_ACCOUNT_SERVICE_TOKEN, { useValue: accounts });
		container.register(PORTAL_SERVICE_TOKEN, { useValue: { customer: async () => null, members: async () => [] } as never });
		container.register(PORTAL_SESSION_RESOLVER_TOKEN, { useValue: auth });
		const { PortalAuthController, PortalController } = await import('../../src/app/customer/controllers/portal.controller');
		const authApp = PortalAuthController.plugin();
		const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
			new Request(`http://localhost/customers/portal/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

		const first = await authApp.handle(post('/auth/login', { email: 'budi@alfa.co.id', password: FAKE_PASSWORD_2 }));
		expect(first.status).toBe(200);
		expect(first.headers.get('set-cookie')).toBeNull();
		const step = ((await first.json()) as { data: { ok: boolean; twoStep: boolean; challenge: string; email: string } }).data;
		expect(step).toEqual({ ok: false, twoStep: true, challenge: expect.any(String), email: 'b***@alfa.co.id' });

		const wrong = await authApp.handle(post('/auth/login/verify', { challenge: step.challenge, code: lastCode() === '000000' ? '111111' : '000000' }));
		expect(wrong.status).toBe(400);
		const verified = await authApp.handle(post('/auth/login/verify', { challenge: step.challenge, code: lastCode() }, { 'user-agent': 'Firefox/1' }));
		expect(verified.status).toBe(200);
		const cookie = verified.headers.get('set-cookie')!.split(';')[0]!;
		expect(cookie).toMatch(/^sid=session-/);
		const verifiedBody = JSON.stringify(await verified.json());
		expect(verifiedBody).not.toContain('session-u-');

		const portal = PortalController.plugin();
		liveSessions.push({ id: 'sid-phone', token: 'tok-phone', userId: budiUser().id, userAgent: 'iPhone', ipAddress: null, createdAt: new Date(), updatedAt: new Date() });
		const devices = await portal.handle(new Request('http://localhost/customers/portal/v1/account/devices', { headers: { cookie } }));
		expect(devices.status).toBe(200);
		const deviceJson = (await devices.json()) as { data: { id: string; current: boolean; token?: string }[] };
		expect(deviceJson.data.map((device) => [device.id, device.current])).toEqual([
			['sid-1', true],
			['sid-phone', false],
		]);
		expect(JSON.stringify(deviceJson)).not.toMatch(/tok-phone|session-u-/);
		const gone = await portal.handle(new Request('http://localhost/customers/portal/v1/account/devices/nope', { method: 'DELETE', headers: { cookie } }));
		expect(gone.status).toBe(404);
		const out = await portal.handle(new Request('http://localhost/customers/portal/v1/account/devices/sid-phone', { method: 'DELETE', headers: { cookie } }));
		expect(out.status).toBe(200);

		const account = await portal.handle(new Request('http://localhost/customers/portal/v1/account', { headers: { cookie } }));
		const accountJson = (await account.json()) as { data: { security: unknown; preferences: unknown; notifications: unknown } };
		expect(accountJson.data.security).toEqual({ twoStep: true, passwordChangedLabel: '', activeDevices: 1 });
		const patch = await portal.handle(
			new Request('http://localhost/customers/portal/v1/account/settings', {
				method: 'PATCH',
				headers: { cookie, 'content-type': 'application/json' },
				body: JSON.stringify({ notifications: { push: true }, security: { twoStep: false }, preferences: { language: 'id' } }),
			}),
		);
		expect(patch.status).toBe(200);
		expect(budiOf()).toMatchObject({ portalPush: true, portalTwoStep: false, portalLanguage: 'id' });

		const refused = await portal.handle(post('/account/close', { password: FAKE_PASSWORD_2 }, { cookie }));
		expect(refused.status).toBe(409);
		const wrongPassword = await portal.handle(post('/account/close', { password: FAKE_PASSWORD_3 }, { cookie }));
		expect(wrongPassword.status).toBe(400);
		await invite({ companyId: COMPANY_A, name: 'Joko', email: 'joko@alfa.co.id', role: 'owner' });
		const closed = await portal.handle(post('/account/close', { password: FAKE_PASSWORD_2 }, { cookie }));
		expect(closed.status).toBe(200);
		expect(closed.headers.get('set-cookie')).toBe('sid=; Path=/; Max-Age=0');
		expect((await portal.handle(new Request('http://localhost/customers/portal/v1/me', { headers: { cookie } }))).status).toBe(401);
	}, 60_000);
});

describe('portal passwords (ERP-0094)', () => {
	test('new passwords are 12 to 128 characters on sign-up, reset and change', () => {
		const signup = { accountType: 'individual', name: 'Dewi', email: 'dewi@mail.id' };
		expect(portalSignupSchema.safeParse({ ...signup, password: 'a'.repeat(11) }).success).toBe(false);
		expect(portalSignupSchema.safeParse({ ...signup, password: 'a'.repeat(12) }).success).toBe(true);
		expect(portalSignupSchema.safeParse({ ...signup, password: 'a'.repeat(129) }).success).toBe(false);
		const token = 'x'.repeat(16);
		expect(portalPasswordConfirmSchema.safeParse({ token, password: 'a'.repeat(11) }).success).toBe(false);
		expect(portalPasswordConfirmSchema.safeParse({ token, password: 'a'.repeat(12) }).success).toBe(true);
		expect(portalChangePasswordSchema.safeParse({ current: 'old', next: 'a'.repeat(11) }).success).toBe(false);
		expect(portalChangePasswordSchema.safeParse({ current: 'old', next: 'a'.repeat(128) }).success).toBe(true);
	});
});

describe('portal guard', () => {
	test('no cookie, an unknown cookie or a bearer header is 401; a known session cookie reaches the handler with its customer', async () => {
		container.register(PORTAL_SESSION_RESOLVER_TOKEN, {
			useValue: {
				resolve: async (headers: Headers) =>
					headers.get('cookie') === 'sid=good-session'
						? ({ userId: 'u-a', customerId: 'p-a', companyId: COMPANY_A, role: 'owner', user: { id: 'u-a', name: 'Budi', email: 'b@a.id' }, sessionToken: 'good-session' } as PortalContext)
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
		expect((await call({ cookie: 'sid=wrong' })).status).toBe(401);
		expect((await call({ authorization: 'Bearer good-session' })).status).toBe(401);
		const ok = await call({ cookie: 'sid=good-session' });
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
