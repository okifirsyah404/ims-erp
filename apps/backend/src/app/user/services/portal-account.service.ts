import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { appConfig } from '@config/providers/config';
import type { TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import { inject, injectable } from 'tsyringe';
import { PORTAL_AUTH_GATEWAY_TOKEN, PORTAL_IDENTITY_REPOSITORY_TOKEN, PORTAL_MAILER_TOKEN } from '../constants/di';
import type {
	IPortalAuthGateway,
	IPortalIdentityRepository,
	IPortalMailer,
	TInviteCustomerPortalRequest,
	TPortalAccountView,
	TPortalCustomerIdentity,
} from '../contracts/portal-account.contract';
import {
	PortalAccountExistsError,
	PortalAccountNotFoundError,
	PortalCustomerUnavailableError,
	PortalEmailTakenError,
	PortalNotConfiguredError,
} from '../errors/portal-account.errors';

/** The invitation link lives 3 days; a reset link 1 hour (Better Auth's own reset expiry). */
export const PORTAL_INVITE_TTL_SECONDS = 3 * 24 * 60 * 60;
export const PORTAL_RESET_TTL_SECONDS = 60 * 60;

/**
 * Customer-portal logins (ERP-0022), owned by Identity.
 *
 * Owner decisions 2026-11-14: one login per customer; staff invite it (no
 * open sign-up); the customer sets the password from the emailed link on the
 * portal's `/reset-password` page. A portal user is never an organization
 * member, so it can never pass the `erp` guard; the email of a staff login is
 * refused.
 *
 * Contract for the portal module: {@link resolveCustomer} (active identity →
 * customer id) and {@link requestPasswordReset}.
 */
@injectable()
export class PortalAccountService {
	constructor(
		@inject(PORTAL_IDENTITY_REPOSITORY_TOKEN) private readonly identities: IPortalIdentityRepository,
		@inject(PORTAL_AUTH_GATEWAY_TOKEN) private readonly authGateway: IPortalAuthGateway,
		@inject(PORTAL_MAILER_TOKEN) private readonly mailer: IPortalMailer,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
	) {}

	/** Base URL of the customer portal (`PORTAL_URL`); a field so tests can set it. */
	portalUrl: string | null = appConfig.app.portalUrl ?? null;

	/** The customer's live portal login, or `null`. */
	async getForCustomer(customerId: string): Promise<TPortalAccountView | null> {
		const identity = await this.identities.findLiveByEntity('customer', customerId);
		return identity ? this.view(identity) : null;
	}

	async invite(actorUserId: string, body: TInviteCustomerPortalRequest): Promise<TPortalAccountView> {
		const link = this.linkBase();
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new PortalCustomerUnavailableError();
		if (await this.identities.findLiveByEntity('customer', customer.id)) throw new PortalAccountExistsError();

		// An existing user may be reused only when it is a former portal login of
		// nobody else: never a staff account (organization member) and never a
		// live portal identity of another customer.
		let user = await this.authGateway.findUserByEmail(body.email);
		if (user) {
			if (await this.authGateway.isOrganizationMember(user.id)) throw new PortalEmailTakenError();
			if (await this.identities.findLiveByUser(user.id)) throw new PortalEmailTakenError();
		} else {
			user = await this.authGateway.createUser({ name: body.name, email: body.email });
		}

		let identity: TPortalIdentitySelect;
		try {
			identity = await this.identities.create({ userId: user.id, portalType: 'customer', linkedEntityId: customer.id, createdBy: actorUserId });
		} catch (error) {
			// The partial unique indexes catch a concurrent invite for the same customer or user.
			if ((error as { code?: string } | null)?.code === '23505') throw new PortalAccountExistsError();
			throw error;
		}
		await this.sendInvitation(user, link);
		return this.view(identity);
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

	/**
	 * Contract for the portal guard: the customer behind an active portal
	 * login, or `null` (no identity, revoked, suspended, or no customer).
	 */
	async resolveCustomer(userId: string): Promise<TPortalCustomerIdentity | null> {
		const identity = await this.identities.findLiveByUser(userId);
		if (!identity || identity.status !== 'active' || identity.portalType !== 'customer' || !identity.linkedEntityId) return null;
		const user = await this.authGateway.findUserById(userId);
		if (!user) return null;
		return { identityId: identity.id, userId, customerId: identity.linkedEntityId, user };
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

	private linkBase(): string {
		if (!this.portalUrl) throw new PortalNotConfiguredError();
		return `${this.portalUrl.replace(/\/+$/, '')}/reset-password`;
	}

	private async sendInvitation(user: { id: string; name: string; email: string }, link: string): Promise<void> {
		const token = await this.authGateway.issuePasswordToken(user.id, PORTAL_INVITE_TTL_SECONDS);
		await this.mailer.sendInvitation({ to: user.email, name: user.name, url: `${link}?token=${encodeURIComponent(token)}` });
	}

	private async view(identity: TPortalIdentitySelect): Promise<TPortalAccountView> {
		const user = await this.authGateway.findUserById(identity.userId);
		return {
			id: identity.id,
			customerId: identity.linkedEntityId ?? '',
			status: identity.status,
			user: user ?? { id: identity.userId, name: '', email: '' },
			passwordSet: user ? await this.authGateway.hasPassword(user.id) : false,
			lastLoginAt: identity.lastLoginAt,
			createdAt: identity.createdAt,
		};
	}
}
