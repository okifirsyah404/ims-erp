import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { EXPORTED_USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { TAuthUser } from '@app/user/contracts/user-account.gateway.interface';
import type { ExportedUserService } from '@app/user/services/exported-user.service';
import type { ICacheClient } from '@cache/cache.client';
import { appConfig } from '@config/providers/config';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import type { PortalRole, TCustomerSelect } from '@drizzle/schemas/customer.schema';
import { inject, injectable } from 'tsyringe';
import { COMPANY_REPOSITORY_TOKEN, CUSTOMER_PERSON_REPOSITORY_TOKEN, PORTAL_MAILER_TOKEN } from '../constants/di';
import type {
	IPortalMailer,
	TInviteCustomerPortalRequest,
	TPortalAccountView,
	TPortalCustomerIdentity,
	TPortalLoginSettings,
	TPortalMemberInvite,
	TPortalSignup,
} from '../contracts/portal-account.contract';
import type { ICompanyRepository, ICustomerPersonRepository } from '../contracts/customer.repository.interface';
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
} from '../errors/portal-account.errors';

/** The invitation link lives 3 days; a reset link 1 hour (Better Auth's own reset expiry). */
export const PORTAL_INVITE_TTL_SECONDS = 3 * 24 * 60 * 60;
export const PORTAL_RESET_TTL_SECONDS = 60 * 60;
/** A sign-up code lives 10 minutes and allows 5 attempts. */
export const PORTAL_SIGNUP_CODE_TTL_SECONDS = 10 * 60;
export const PORTAL_SIGNUP_MAX_ATTEMPTS = 5;

/** A two-step sign-in code lives 10 minutes and allows 5 attempts (ERP-0106). */
export const PORTAL_LOGIN_CODE_TTL_SECONDS = 10 * 60;
export const PORTAL_LOGIN_CODE_MAX_ATTEMPTS = 5;

type TPendingSignup = { userId: string; name: string; phone: string | null; codeHash: string; attempts: number };
type TPendingLogin = { userId: string; name: string; email: string; language: 'en' | 'id' | null; codeHash: string; attempts: number };

const hashCode = (email: string, code: string) => createHash('sha256').update(`${email}:${code}`).digest('hex');

/** A person code for logins created by the portal (`PRT-…`), unique among live codes in practice. */
const portalPersonCode = () => `PRT-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505';

/**
 * Customer-portal logins (ERP-0022), owned by `customer` since ADR-0024 Q5.
 *
 * Owner decisions 2026-11-14:
 * - **D1** individuals sign up themselves (verified by an emailed code; the
 *   individual customer and an owner login are created on verification);
 *   businesses are invited by staff.
 * - **D2** one login per person (`customer.customers` row) with a role
 *   `owner | approver | finance | viewer`; an owner invites and removes
 *   colleagues of the same company from the portal.
 *
 * The login state lives on the person (`user_id`, `portal_role`,
 * `portal_status`); users and credentials are created through
 * `ExportedUserService`. A portal user is never an organization member, so it
 * never passes the `erp` guard and the web admin refuses its sessions; a staff
 * email is refused.
 */
@injectable()
export class PortalAccountService {
	constructor(
		@inject(CUSTOMER_PERSON_REPOSITORY_TOKEN) private readonly people: ICustomerPersonRepository,
		@inject(COMPANY_REPOSITORY_TOKEN) private readonly companies: ICompanyRepository,
		@inject(EXPORTED_USER_SERVICE_TOKEN)
		private readonly users: Pick<
			ExportedUserService,
			| 'findByEmail'
			| 'findById'
			| 'createPortalLogin'
			| 'isStaff'
			| 'setPassword'
			| 'markEmailVerified'
			| 'hasPassword'
			| 'issuePasswordToken'
			| 'revokeSessions'
			| 'grantCustomerRole'
		>,
		@inject(PORTAL_MAILER_TOKEN) private readonly mailer: IPortalMailer,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	/** Base URL of the customer portal (`PORTAL_URL`); a field so tests can set it. */
	portalUrl: string | null = appConfig.app.portalUrl ?? null;

	/* -------------------------------------------------------------------- *
	 * Staff side (`/admin/customers/portal-accounts`)
	 * -------------------------------------------------------------------- */

	/** Every live portal login of a company (or of one individual customer). */
	async listForScope(scope: { customerId?: string; companyId?: string }): Promise<TPortalAccountView[]> {
		const people = await this.people.listPortalAccounts({
			customerId: scope.customerId ?? '',
			companyId: scope.companyId ?? null,
		});
		return Promise.all(people.map((person) => this.view(person)));
	}

	/** Invites one person; a new contact person is created under the company when no `customerId` is given. */
	async invite(actorUserId: string, body: TInviteCustomerPortalRequest): Promise<TPortalAccountView> {
		const link = this.linkBase();
		let person: TCustomerSelect | null = null;

		if (body.customerId) {
			person = await this.people.findById(body.customerId);
			if (!person || person.status !== 'active') throw new PortalCustomerUnavailableError();
			if (body.companyId && person.companyId !== body.companyId) throw new PortalContactUnavailableError();
			if (person.userId) throw new PortalAccountExistsError();
		} else {
			await this.assertActiveCompany(body.companyId);
		}

		return this.grantLogin(
			{ person, companyId: body.companyId ?? person?.companyId ?? null, name: body.name, email: body.email, role: body.role },
			actorUserId,
			link,
		);
	}

	/** Sends a fresh "set your password" link (the old one stays valid until it expires). */
	async resend(id: string): Promise<TPortalAccountView> {
		const link = this.linkBase();
		const person = await this.people.findById(id);
		if (!person?.userId) throw new PortalAccountNotFoundError();
		const user = await this.users.findById(person.userId);
		if (!user) throw new PortalAccountNotFoundError();
		await this.sendInvitation(user, link);
		return this.view(person);
	}

	/** Revokes the login: status revoked, `user_id` freed, sessions ended. The Better Auth user stays (history). */
	async revoke(id: string): Promise<void> {
		const person = await this.people.revokePortalAccess(id);
		if (!person?.userId) throw new PortalAccountNotFoundError();
		await this.users.revokeSessions(person.userId);
	}

	/* -------------------------------------------------------------------- *
	 * Members, from the portal (D2)
	 * -------------------------------------------------------------------- */

	/** The company's logins, for any member of that company. */
	members(caller: TPortalCustomerIdentity): Promise<TPortalAccountView[]> {
		return this.listForScope({
			customerId: caller.customerId,
			...(caller.companyId ? { companyId: caller.companyId } : {}),
		});
	}

	/** An owner invites a colleague (approver, finance or viewer) of their own company. */
	async inviteMember(caller: TPortalCustomerIdentity, body: TPortalMemberInvite): Promise<TPortalAccountView> {
		if (caller.role !== 'owner') throw new PortalOwnerOnlyError();
		if (!caller.companyId) throw new PortalNoCompanyError();
		const link = this.linkBase();
		return this.grantLogin(
			{ person: null, companyId: caller.companyId, name: body.name ?? body.email.split('@')[0]!, email: body.email, role: body.role },
			caller.userId,
			link,
		);
	}

	/** An owner removes a colleague of the same company (never themselves). */
	async removeMember(caller: TPortalCustomerIdentity, id: string): Promise<void> {
		if (caller.role !== 'owner') throw new PortalOwnerOnlyError();
		if (id === caller.customerId) throw new PortalRemoveSelfError();
		const person = await this.people.findById(id);
		if (!person?.userId || !caller.companyId || person.companyId !== caller.companyId) {
			throw new PortalAccountNotFoundError();
		}
		await this.revoke(id);
	}

	/* -------------------------------------------------------------------- *
	 * Sign-up of individuals (D1)
	 * -------------------------------------------------------------------- */

	/**
	 * Starts an individual sign-up: an unverified user with the chosen
	 * password and a 6-digit code by email. An email that already belongs to
	 * a verified, staff or portal login gets the same answer and no email, so
	 * the form never reveals who has an account.
	 */
	async startSignup(body: TPortalSignup): Promise<{ email: string }> {
		if (body.accountType !== 'individual') throw new PortalBusinessSignupError();
		let user = await this.users.findByEmail(body.email);
		if (user && (user.emailVerified || (await this.users.isStaff(user.id)) || (await this.people.findByUserId(user.id)))) {
			return { email: body.email };
		}
		user ??= await this.users.createPortalLogin({ name: body.name, email: body.email, emailVerified: false });
		await this.users.setPassword(user.id, body.password);
		await this.sendSignupCode(body.email, { userId: user.id, name: body.name, phone: body.phone });
		return { email: body.email };
	}

	/** A new code for a pending sign-up; silent when there is none. */
	async resendSignupCode(email: string): Promise<void> {
		const pending = await this.cache.get<TPendingSignup>(this.signupKey(email));
		if (pending) await this.sendSignupCode(email, pending);
	}

	/**
	 * Checks the code; on success marks the email verified and creates the
	 * individual customer with an owner login.
	 */
	async verifySignup(email: string, code: string): Promise<TPortalCustomerIdentity> {
		const key = this.signupKey(email);
		const pending = await this.cache.get<TPendingSignup>(key);
		if (!pending) throw new PortalInvalidCodeError();
		const expected = Buffer.from(pending.codeHash);
		const given = Buffer.from(hashCode(email, code.trim()));
		if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
			const attempts = pending.attempts + 1;
			if (attempts >= PORTAL_SIGNUP_MAX_ATTEMPTS) await this.cache.del(key);
			else await this.cache.set<TPendingSignup>(key, { ...pending, attempts }, PORTAL_SIGNUP_CODE_TTL_SECONDS);
			throw new PortalInvalidCodeError();
		}
		await this.users.markEmailVerified(pending.userId);
		const person = await this.people.create({
			code: portalPersonCode(),
			name: pending.name,
			email,
			phone: pending.phone,
			customerType: 'individual',
			status: 'active',
			userId: pending.userId,
			portalRole: 'owner',
			portalStatus: 'active',
			portalInvitedBy: null,
			createdBy: pending.userId,
		});
		await this.users.grantCustomerRole(pending.userId);
		await this.cache.del(key);
		const resolved = await this.resolveCustomer(person.userId ?? pending.userId);
		if (!resolved) throw new PortalInvalidCodeError();
		return resolved;
	}

	/* -------------------------------------------------------------------- *
	 * Login settings, two-step sign-in and deleting one's own login (ERP-0106)
	 * -------------------------------------------------------------------- */

	/** The login's settings (port plan D3: columns on the person's row). */
	async settings(caller: Pick<TPortalCustomerIdentity, 'customerId'>): Promise<TPortalLoginSettings> {
		const person = await this.people.findById(caller.customerId);
		return settingsOf(person);
	}

	/** Saves the given settings only; the others keep their value. */
	async updateSettings(
		caller: Pick<TPortalCustomerIdentity, 'customerId'>,
		patch: Partial<TPortalLoginSettings>,
	): Promise<TPortalLoginSettings> {
		const update: Partial<Pick<TCustomerSelect, 'portalLanguage' | 'portalTwoStep' | 'portalPush'>> = {};
		if (patch.language) update.portalLanguage = patch.language;
		if (patch.twoStep !== undefined) update.portalTwoStep = patch.twoStep;
		if (patch.push !== undefined) update.portalPush = patch.push;
		if (Object.keys(update).length === 0) return this.settings(caller);
		const person = await this.people.update(caller.customerId, update);
		if (!person) throw new PortalAccountNotFoundError();
		return settingsOf(person);
	}

	/**
	 * Emails a 6-digit sign-in code and answers an opaque challenge the portal
	 * sends back with the code. The password was already checked; no session
	 * exists yet.
	 */
	async startLoginCode(caller: TPortalCustomerIdentity): Promise<string> {
		const challenge = randomBytes(24).toString('base64url');
		const { language } = await this.settings(caller);
		await this.sendLoginCode(challenge, { userId: caller.userId, name: caller.user.name, email: caller.user.email, language });
		return challenge;
	}

	/** A new code for a pending sign-in; silent when the challenge is gone. */
	async resendLoginCode(challenge: string): Promise<void> {
		const pending = await this.cache.get<TPendingLogin>(this.loginKey(challenge));
		if (pending) await this.sendLoginCode(challenge, pending);
	}

	/**
	 * The user behind a right code; the challenge is used up. Each wrong code
	 * counts; the fifth drops the challenge.
	 * @throws {PortalInvalidCodeError} wrong, expired or used up
	 */
	async verifyLoginCode(challenge: string, code: string): Promise<string> {
		const key = this.loginKey(challenge);
		const pending = await this.cache.get<TPendingLogin>(key);
		if (!pending) throw new PortalInvalidCodeError();
		const expected = Buffer.from(pending.codeHash);
		const given = Buffer.from(hashCode(challenge, code.trim()));
		if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
			const attempts = pending.attempts + 1;
			if (attempts >= PORTAL_LOGIN_CODE_MAX_ATTEMPTS) await this.cache.del(key);
			else await this.cache.set<TPendingLogin>(key, { ...pending, attempts }, PORTAL_LOGIN_CODE_TTL_SECONDS);
			throw new PortalInvalidCodeError();
		}
		await this.cache.del(key);
		return pending.userId;
	}

	/**
	 * The person deletes their own login (branch owner decision 2026-11-20):
	 * the login is revoked like a staff revoke (`user_id` freed, sessions
	 * ended); the person, the company, documents and history stay. The only
	 * active owner of a company account cannot leave it ownerless; an
	 * individual customer is their own account and may.
	 * @throws {PortalLastOwnerError}
	 */
	async closeOwnLogin(caller: TPortalCustomerIdentity): Promise<void> {
		if (caller.role === 'owner' && caller.companyId) {
			const logins = await this.people.listPortalAccounts({ customerId: caller.customerId, companyId: caller.companyId });
			const otherOwners = logins.filter(
				(person) => person.id !== caller.customerId && person.portalRole === 'owner' && person.portalStatus === 'active',
			);
			if (otherOwners.length === 0) throw new PortalLastOwnerError();
		}
		await this.revoke(caller.customerId);
	}

	/* -------------------------------------------------------------------- *
	 * Contract for the portal guard and sign-in
	 * -------------------------------------------------------------------- */

	/** The person and company behind an active portal login, or `null`. */
	async resolveCustomer(userId: string): Promise<TPortalCustomerIdentity | null> {
		const person = await this.people.findByUserId(userId);
		if (!person || person.portalStatus !== 'active' || !person.portalRole) return null;
		const user = await this.users.findById(userId);
		if (!user) return null;
		return {
			userId,
			customerId: person.id,
			companyId: person.companyId,
			role: person.portalRole as PortalRole,
			user: { id: user.id, name: user.name, email: user.email },
		};
	}

	async recordLogin(customerId: string): Promise<void> {
		await this.people.touchPortalLogin(customerId);
	}

	/**
	 * Portal "forgot password": emails a reset link only to an active portal
	 * login. Answers the same way whether or not the email exists.
	 */
	async requestPasswordReset(email: string): Promise<void> {
		const link = this.linkBase();
		const user = await this.users.findByEmail(email.trim().toLowerCase());
		if (!user) return;
		const person = await this.people.findByUserId(user.id);
		if (!person || person.portalStatus !== 'active') return;
		const token = await this.users.issuePasswordToken(user.id, PORTAL_RESET_TTL_SECONDS);
		await this.mailer.sendPasswordReset({ to: user.email, name: user.name, url: `${link}?token=${encodeURIComponent(token)}` });
	}

	/* -------------------------------------------------------------------- */

	private async assertActiveCompany(companyId: string | undefined): Promise<void> {
		const company = companyId ? await this.companies.findById(companyId) : null;
		if (!company || company.status !== 'active') throw new PortalCustomerUnavailableError();
	}

	/**
	 * Gives a person a login: reuses `person` or creates a contact under
	 * `companyId`, finds or creates the user, then emails the password link.
	 */
	private async grantLogin(
		input: { person: TCustomerSelect | null; companyId: string | null; name: string; email: string; role: PortalRole },
		actorUserId: string,
		link: string,
	): Promise<TPortalAccountView> {
		// An existing user may be reused only when it is nobody else's: never a
		// staff account and never a live portal login.
		let user = await this.users.findByEmail(input.email);
		if (user) {
			if (await this.users.isStaff(user.id)) throw new PortalEmailTakenError();
			if (await this.people.findByUserId(user.id)) throw new PortalEmailTakenError();
		}

		user ??= await this.users.createPortalLogin({ name: input.name, email: input.email, emailVerified: true });
		try {
			// A new contact is inserted with its login in one statement, so a
			// failed grant never leaves a login-less orphan behind.
			const granted = input.person
				? await this.people.grantPortalAccess(input.person.id, {
						userId: user.id,
						portalRole: input.role,
						portalInvitedBy: actorUserId,
					})
				: await this.people.create({
						code: portalPersonCode(),
						companyId: input.companyId,
						name: input.name,
						email: input.email,
						customerType: 'contact',
						status: 'active',
						userId: user.id,
						portalRole: input.role,
						portalStatus: 'active',
						portalInvitedBy: actorUserId,
						createdBy: actorUserId,
					});
			if (!granted) throw new PortalAccountNotFoundError();
			await this.users.grantCustomerRole(user.id);
			await this.sendInvitation(user, link);
			return this.view(granted);
		} catch (error) {
			// The partial unique index catches a concurrent invite for the same user.
			if (isUniqueViolation(error)) throw new PortalAccountExistsError();
			throw error;
		}
	}

	private linkBase(): string {
		if (!this.portalUrl) throw new PortalNotConfiguredError();
		return `${this.portalUrl.replace(/\/+$/, '')}/reset-password`;
	}

	private signupKey(email: string): string {
		return `portal:signup:${email.trim().toLowerCase()}`;
	}

	private async sendSignupCode(email: string, pending: Pick<TPendingSignup, 'userId' | 'name' | 'phone'>): Promise<void> {
		const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		await this.cache.set<TPendingSignup>(this.signupKey(email), { ...pending, codeHash: hashCode(email, code), attempts: 0 }, PORTAL_SIGNUP_CODE_TTL_SECONDS);
		await this.mailer.sendSignupCode({ to: email, name: pending.name, code });
	}

	private loginKey(challenge: string): string {
		return `portal:login-code:${challenge}`;
	}

	private async sendLoginCode(challenge: string, pending: Pick<TPendingLogin, 'userId' | 'name' | 'email' | 'language'>): Promise<void> {
		const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		await this.cache.set<TPendingLogin>(
			this.loginKey(challenge),
			{ userId: pending.userId, name: pending.name, email: pending.email, language: pending.language, codeHash: hashCode(challenge, code), attempts: 0 },
			PORTAL_LOGIN_CODE_TTL_SECONDS,
		);
		await this.mailer.sendLoginCode({ to: pending.email, name: pending.name, code, ...(pending.language ? { language: pending.language } : {}) });
	}

	private async sendInvitation(user: Pick<TAuthUser, 'id' | 'name' | 'email'>, link: string): Promise<void> {
		const token = await this.users.issuePasswordToken(user.id, PORTAL_INVITE_TTL_SECONDS);
		await this.mailer.sendInvitation({ to: user.email, name: user.name, url: `${link}?token=${encodeURIComponent(token)}` });
	}

	private async view(person: TCustomerSelect): Promise<TPortalAccountView> {
		const user = person.userId ? await this.users.findById(person.userId) : null;
		return {
			id: person.id,
			customerId: person.id,
			companyId: person.companyId,
			role: (person.portalRole ?? 'viewer') as PortalRole,
			status: (person.portalStatus ?? 'revoked') as TPortalAccountView['status'],
			user: user
				? { id: user.id, name: user.name, email: user.email }
				: { id: person.userId ?? '', name: '', email: '' },
			passwordSet: user ? await this.users.hasPassword(user.id) : false,
			lastLoginAt: person.portalLastLoginAt,
			createdAt: person.createdAt,
		};
	}
}

/** A person's portal settings; a missing person reads as the defaults. */
function settingsOf(person: TCustomerSelect | null): TPortalLoginSettings {
	const language = person?.portalLanguage;
	return {
		language: language === 'en' || language === 'id' ? language : null,
		twoStep: person?.portalTwoStep ?? false,
		push: person?.portalPush ?? false,
	};
}
