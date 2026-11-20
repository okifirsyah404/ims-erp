import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import type { ICacheClient } from '@cache/cache.client';
import { appConfig } from '@config/providers/config';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import type { PortalRole, TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import { inject, injectable } from 'tsyringe';
import { PORTAL_AUTH_GATEWAY_TOKEN, PORTAL_IDENTITY_REPOSITORY_TOKEN, PORTAL_MAILER_TOKEN } from '../constants/di';
import type {
	IPortalAuthGateway,
	IPortalIdentityRepository,
	IPortalMailer,
	TAuthUser,
	TInviteCustomerPortalRequest,
	TPortalAccountView,
	TPortalCustomerIdentity,
	TPortalMemberInvite,
	TPortalSignup,
} from '../contracts/portal-account.contract';
import {
	PortalAccountExistsError,
	PortalAccountNotFoundError,
	PortalBusinessSignupError,
	PortalContactUnavailableError,
	PortalCustomerUnavailableError,
	PortalEmailTakenError,
	PortalInvalidCodeError,
	PortalLastOwnerError,
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

/** A two-step sign-in code lives 10 minutes and allows 5 attempts (ERP-0081). */
export const PORTAL_LOGIN_CODE_TTL_SECONDS = 10 * 60;

type TPendingSignup = { userId: string; name: string; phone: string | null; codeHash: string; attempts: number };
type TPendingLogin = { userId: string; name: string; email: string; codeHash: string; attempts: number };

const hashCode = (email: string, code: string) => createHash('sha256').update(`${email}:${code}`).digest('hex');

/**
 * Customer-portal logins (ERP-0022), owned by Identity.
 *
 * Owner decisions 2026-11-14:
 * - **D1** individuals sign up themselves (verified by an emailed code; the
 *   customer, its contact and an owner login are created on verification);
 *   businesses are invited by staff.
 * - **D2** one login per person (customer contact) with a role
 *   `owner | approver | finance | viewer`; an owner invites and removes
 *   colleagues from the portal.
 *
 * A portal user is never an organization member, so it never passes the
 * `erp` guard and the web admin refuses its sessions; a staff email is refused.
 *
 * Contract for the portal module: {@link resolveCustomer},
 * {@link requestPasswordReset}, the sign-up and member methods.
 */
@injectable()
export class PortalAccountService {
	constructor(
		@inject(PORTAL_IDENTITY_REPOSITORY_TOKEN) private readonly identities: IPortalIdentityRepository,
		@inject(PORTAL_AUTH_GATEWAY_TOKEN) private readonly authGateway: IPortalAuthGateway,
		@inject(PORTAL_MAILER_TOKEN) private readonly mailer: IPortalMailer,
		@inject(CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<CustomerService, 'getActiveCustomer' | 'getContact' | 'addContact' | 'createFromPortalSignup'>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	/** Base URL of the customer portal (`PORTAL_URL`); a field so tests can set it. */
	portalUrl: string | null = appConfig.app.portalUrl ?? null;

	/* -------------------------------------------------------------------- *
	 * Staff side (`/admin/portal-accounts`)
	 * -------------------------------------------------------------------- */

	/** Every live portal login of a customer. */
	async listForCustomer(customerId: string): Promise<TPortalAccountView[]> {
		return Promise.all((await this.identities.listLiveByCustomer(customerId)).map((identity) => this.view(identity)));
	}

	/** Invites one person of a customer; a new contact is created when none is given. */
	async invite(actorUserId: string, body: TInviteCustomerPortalRequest): Promise<TPortalAccountView> {
		const link = this.linkBase();
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new PortalCustomerUnavailableError();
		return this.inviteContact({ customerId: customer.id, contactId: body.contactId ?? null, name: body.name, email: body.email, role: body.role }, actorUserId, link);
	}

	/** Sends a fresh "set your password" link (the old one stays valid until it expires). */
	async resend(id: string): Promise<TPortalAccountView> {
		const link = this.linkBase();
		const identity = await this.identities.findLiveById(id);
		if (!identity) throw new PortalAccountNotFoundError();
		const user = await this.authGateway.findUserById(identity.userId);
		if (!user) throw new PortalAccountNotFoundError();
		await this.sendInvitation(user, link);
		return this.view(identity);
	}

	/** Revokes the login: identity revoked, sessions ended. The Better Auth user stays (history). */
	async revoke(id: string): Promise<void> {
		const identity = await this.identities.revoke(id);
		if (!identity) throw new PortalAccountNotFoundError();
		await this.authGateway.revokeSessions(identity.userId);
	}

	/* -------------------------------------------------------------------- *
	 * Members, from the portal (D2)
	 * -------------------------------------------------------------------- */

	/** The customer's logins, for any member of that customer. */
	members(caller: TPortalCustomerIdentity): Promise<TPortalAccountView[]> {
		return this.listForCustomer(caller.customerId);
	}

	/** An owner invites a colleague (approver, finance or viewer). */
	async inviteMember(caller: TPortalCustomerIdentity, body: TPortalMemberInvite): Promise<TPortalAccountView> {
		if (caller.role !== 'owner') throw new PortalOwnerOnlyError();
		const link = this.linkBase();
		return this.inviteContact(
			{ customerId: caller.customerId, contactId: null, name: body.name ?? body.email.split('@')[0]!, email: body.email, role: body.role },
			caller.userId,
			link,
		);
	}

	/** An owner removes a colleague of the same customer (never themselves). */
	async removeMember(caller: TPortalCustomerIdentity, id: string): Promise<void> {
		if (caller.role !== 'owner') throw new PortalOwnerOnlyError();
		if (id === caller.identityId) throw new PortalRemoveSelfError();
		const identity = await this.identities.findLiveById(id);
		if (!identity || identity.linkedEntityId !== caller.customerId) throw new PortalAccountNotFoundError();
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
		let user = await this.authGateway.findUserByEmail(body.email);
		if (user && (user.emailVerified || (await this.authGateway.isOrganizationMember(user.id)) || (await this.identities.findLiveByUser(user.id)))) {
			return { email: body.email };
		}
		user ??= await this.authGateway.createUser({ name: body.name, email: body.email, emailVerified: false });
		await this.authGateway.setPassword(user.id, body.password);
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
	 * customer (individual), its primary contact and an owner login.
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
		await this.authGateway.markEmailVerified(pending.userId);
		const { customer, contact } = await this.customers.createFromPortalSignup({ name: pending.name, email, phone: pending.phone }, pending.userId);
		const identity = await this.identities.create({
			userId: pending.userId,
			portalType: 'customer',
			linkedEntityId: customer.id,
			contactId: contact.id,
			portalRole: 'owner',
			createdBy: null,
		});
		await this.authGateway.grantCustomerRole(identity.userId);
		await this.cache.del(key);
		const resolved = await this.resolveCustomer(identity.userId);
		if (!resolved) throw new PortalInvalidCodeError();
		return resolved;
	}

	/* -------------------------------------------------------------------- *
	 * Two-step sign-in and closing one's own login (ERP-0081)
	 * -------------------------------------------------------------------- */

	/**
	 * Emails a 6-digit sign-in code and answers an opaque challenge the portal
	 * sends back with the code. The password was already checked.
	 */
	async startLoginCode(user: { id: string; name: string; email: string }): Promise<string> {
		const challenge = randomBytes(24).toString('base64url');
		await this.sendLoginCode(challenge, { userId: user.id, name: user.name, email: user.email });
		return challenge;
	}

	/** A new code for a pending sign-in; silent when the challenge is gone. */
	async resendLoginCode(challenge: string): Promise<void> {
		const pending = await this.cache.get<TPendingLogin>(this.loginKey(challenge));
		if (pending) await this.sendLoginCode(challenge, pending);
	}

	/**
	 * The user behind a right code; the challenge is used up.
	 * @throws {PortalInvalidCodeError} wrong, expired or used (5 attempts)
	 */
	async verifyLoginCode(challenge: string, code: string): Promise<string> {
		const key = this.loginKey(challenge);
		const pending = await this.cache.get<TPendingLogin>(key);
		if (!pending) throw new PortalInvalidCodeError();
		const expected = Buffer.from(pending.codeHash);
		const given = Buffer.from(hashCode(challenge, code.trim()));
		if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
			const attempts = pending.attempts + 1;
			if (attempts >= PORTAL_SIGNUP_MAX_ATTEMPTS) await this.cache.del(key);
			else await this.cache.set<TPendingLogin>(key, { ...pending, attempts }, PORTAL_LOGIN_CODE_TTL_SECONDS);
			throw new PortalInvalidCodeError();
		}
		await this.cache.del(key);
		return pending.userId;
	}

	/**
	 * The person closes their own login (owner decision 2026-11-20): the login
	 * is revoked and its sessions end; the customer, its documents and history
	 * stay. The only owner of a business account cannot leave it ownerless.
	 * @throws {PortalLastOwnerError}
	 */
	async closeOwnLogin(caller: TPortalCustomerIdentity): Promise<void> {
		if (caller.role === 'owner') {
			const customer = await this.customers.getActiveCustomer(caller.customerId);
			const business = customer ? customer.customerType !== 'individual' : true;
			if (business) {
				const otherOwners = (await this.identities.listLiveByCustomer(caller.customerId)).filter(
					(identity) => identity.id !== caller.identityId && identity.portalRole === 'owner' && identity.status === 'active',
				);
				if (otherOwners.length === 0) throw new PortalLastOwnerError();
			}
		}
		await this.revoke(caller.identityId);
	}

	/* -------------------------------------------------------------------- *
	 * Contract for the portal guard and sign-in
	 * -------------------------------------------------------------------- */

	/** The person and customer behind an active portal login, or `null`. */
	async resolveCustomer(userId: string): Promise<TPortalCustomerIdentity | null> {
		const identity = await this.identities.findLiveByUser(userId);
		if (!identity || identity.status !== 'active' || identity.portalType !== 'customer' || !identity.linkedEntityId) return null;
		const user = await this.authGateway.findUserById(userId);
		if (!user) return null;
		return {
			identityId: identity.id,
			userId,
			customerId: identity.linkedEntityId,
			contactId: identity.contactId,
			role: identity.portalRole,
			user: { id: user.id, name: user.name, email: user.email },
		};
	}

	async recordLogin(identityId: string): Promise<void> {
		await this.identities.touchLogin(identityId);
	}

	/**
	 * Portal "forgot password": emails a reset link only to an active portal
	 * login. Answers the same way whether or not the email exists.
	 */
	async requestPasswordReset(email: string): Promise<void> {
		const link = this.linkBase();
		const user = await this.authGateway.findUserByEmail(email.trim().toLowerCase());
		if (!user) return;
		const identity = await this.identities.findLiveByUser(user.id);
		if (!identity || identity.status !== 'active') return;
		const token = await this.authGateway.issuePasswordToken(user.id, PORTAL_RESET_TTL_SECONDS);
		await this.mailer.sendPasswordReset({ to: user.email, name: user.name, url: `${link}?token=${encodeURIComponent(token)}` });
	}

	/* -------------------------------------------------------------------- */

	private async inviteContact(
		input: { customerId: string; contactId: string | null; name: string; email: string; role: PortalRole },
		actorUserId: string,
		link: string,
	): Promise<TPortalAccountView> {
		// An existing user may be reused only when it is nobody else's: never a
		// staff account and never a live portal login.
		let user = await this.authGateway.findUserByEmail(input.email);
		if (user) {
			if (await this.authGateway.isOrganizationMember(user.id)) throw new PortalEmailTakenError();
			if (await this.identities.findLiveByUser(user.id)) throw new PortalEmailTakenError();
		}

		let contactId = input.contactId;
		if (contactId) {
			const contact = await this.customers.getContact(input.customerId, contactId);
			if (!contact) throw new PortalContactUnavailableError();
			if (await this.identities.findLiveByContact(contact.id)) throw new PortalAccountExistsError();
		} else {
			contactId = (await this.customers.addContact(input.customerId, { name: input.name, email: input.email, phone: null, whatsapp: null, position: null, isPrimary: false })).id;
		}

		user ??= await this.authGateway.createUser({ name: input.name, email: input.email, emailVerified: true });
		let identity: TPortalIdentitySelect;
		try {
			identity = await this.identities.create({
				userId: user.id,
				portalType: 'customer',
				linkedEntityId: input.customerId,
				contactId,
				portalRole: input.role,
				createdBy: actorUserId,
			});
		} catch (error) {
			// The partial unique indexes catch a concurrent invite for the same contact or user.
			if ((error as { code?: string } | null)?.code === '23505') throw new PortalAccountExistsError();
			throw error;
		}
		await this.authGateway.grantCustomerRole(user.id);
		await this.sendInvitation(user, link);
		return this.view(identity);
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

	private async sendLoginCode(challenge: string, pending: Pick<TPendingLogin, 'userId' | 'name' | 'email'>): Promise<void> {
		const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		await this.cache.set<TPendingLogin>(this.loginKey(challenge), { ...pending, codeHash: hashCode(challenge, code), attempts: 0 }, PORTAL_LOGIN_CODE_TTL_SECONDS);
		await this.mailer.sendLoginCode({ to: pending.email, name: pending.name, code });
	}

	private async sendInvitation(user: Pick<TAuthUser, 'id' | 'name' | 'email'>, link: string): Promise<void> {
		const token = await this.authGateway.issuePasswordToken(user.id, PORTAL_INVITE_TTL_SECONDS);
		await this.mailer.sendInvitation({ to: user.email, name: user.name, url: `${link}?token=${encodeURIComponent(token)}` });
	}

	private async view(identity: TPortalIdentitySelect): Promise<TPortalAccountView> {
		const user = await this.authGateway.findUserById(identity.userId);
		return {
			id: identity.id,
			customerId: identity.linkedEntityId ?? '',
			contactId: identity.contactId,
			role: identity.portalRole,
			status: identity.status,
			user: user ? { id: user.id, name: user.name, email: user.email } : { id: identity.userId, name: '', email: '' },
			passwordSet: user ? await this.authGateway.hasPassword(user.id) : false,
			lastLoginAt: identity.lastLoginAt,
			createdAt: identity.createdAt,
		};
	}
}
