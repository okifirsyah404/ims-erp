import { EXPORTED_USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { TAuthUser } from '@app/user/contracts/user-account.gateway.interface';
import type { ExportedUserService } from '@app/user/services/exported-user.service';
import { appConfig } from '@config/providers/config';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { PORTAL_MAILER_TOKEN } from '../constants/di';
import type { IPortalMailer } from '../contracts/portal-account.contract';
import { CustomerEmailTakenError, CustomerUsernameUnavailableError } from '../errors/customer.errors';

/** Better Auth username plugin limits (library defaults: 3-30, `[a-z0-9_.]`). */
const USERNAME_MAX = 30;
/** `_` + 6 digits of the unix timestamp in milliseconds. */
const SUFFIX_LENGTH = 7;
const BASE_MAX = USERNAME_MAX - SUFFIX_LENGTH;
const BASE_MIN = 3;
/** Attempts before giving up on a free username (each takes a fresh timestamp). */
const USERNAME_ATTEMPTS = 3;
/** Owner decision ERP-0114: the default password is `{username}12345678`. */
const DEFAULT_PASSWORD_SUFFIX = '12345678';

/** What a create returns once: shown to staff and emailed to the customer. */
export type TCustomerCredentials = { username: string; password: string };

/**
 * Turns a person's name into a username base: lower-case ASCII, diacritics
 * dropped, every other run of characters collapsed to `_`, at most 23
 * characters; a base shorter than 3 characters gets a `cust_` prefix.
 *
 * @example usernameBase('Budi Santoso') === 'budi_santoso'
 */
export function usernameBase(name: string): string {
	const ascii = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	const base = ascii.length >= BASE_MIN ? ascii : `cust_${ascii}`.replace(/_+$/, '');
	return base.slice(0, BASE_MAX).replace(/_+$/, '');
}

/** `{base}_{last 6 digits of the unix timestamp in milliseconds}`. */
export function usernameCandidate(base: string, now: number = Date.now()): string {
	return `${base}_${String(now).slice(-6)}`;
}

/** The default password of a staff-created account. */
export function defaultPassword(username: string): string {
	return `${username}${DEFAULT_PASSWORD_SUFFIX}`;
}

/**
 * Better Auth accounts of customer people (ERP-0114): one account is exactly
 * one `customer.customers` row.
 *
 * @remarks
 * Users and credentials stay owned by the identity module; everything goes
 * through `ExportedUserService`. The default password is never stored here:
 * it is returned once to the caller and emailed to the customer, and the
 * person row carries `portal_password_change_required`.
 */
@injectable()
export class CustomerAccountService {
	constructor(
		@inject(EXPORTED_USER_SERVICE_TOKEN)
		private readonly users: Pick<
			ExportedUserService,
			'findByEmail' | 'isUsernameTaken' | 'createCustomerAccount' | 'grantCustomerRole' | 'deleteUnusedUser'
		>,
		@inject(PORTAL_MAILER_TOKEN) private readonly mailer: Pick<IPortalMailer, 'sendCredentials'>,
	) {}

	/** Customer portal base URL (`PORTAL_URL`); a field so tests can set it. */
	portalUrl: string | null = appConfig.app.portalUrl ?? null;

	/** Throws when `email` already belongs to any account. */
	async assertEmailFree(email: string, exceptUserId?: string | null): Promise<void> {
		const existing = await this.users.findByEmail(email);
		if (existing && existing.id !== exceptUserId) throw new CustomerEmailTakenError(email);
	}

	/** A username no account holds yet. */
	async freeUsername(name: string): Promise<string> {
		const base = usernameBase(name);
		for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
			// A retry moves the timestamp on, so the next candidate differs.
			const candidate = usernameCandidate(base, Date.now() + attempt);
			if (!(await this.users.isUsernameTaken(candidate))) return candidate;
		}
		throw new CustomerUsernameUnavailableError();
	}

	/**
	 * Creates the account of a new person: unverified email, generated
	 * username, default password, global `customer` role.
	 *
	 * @throws CustomerEmailTakenError When the email belongs to any account
	 * @throws CustomerUsernameUnavailableError When no username is free
	 */
	async provision(input: { name: string; email: string }): Promise<{ user: TAuthUser; credentials: TCustomerCredentials }> {
		await this.assertEmailFree(input.email);
		const username = await this.freeUsername(input.name);
		const password = defaultPassword(username);
		const user = await this.users.createCustomerAccount({ name: input.name, email: input.email, username, password });
		try {
			await this.users.grantCustomerRole(user.id);
		} catch (error) {
			await this.users.deleteUnusedUser(user.id);
			throw error;
		}
		return { user, credentials: { username, password } };
	}

	/** Removes an account whose person row could not be written. */
	async discard(userId: string): Promise<void> {
		try {
			await this.users.deleteUnusedUser(userId);
		} catch (error) {
			pinoLogger.error({ err: error, userId }, 'customer account: compensation delete failed');
		}
	}

	/**
	 * Emails the credentials. A mail failure never fails the create: the
	 * staff dialog still shows them, and the queue retries delivery.
	 */
	async sendCredentials(input: { email: string; name: string } & TCustomerCredentials): Promise<void> {
		try {
			await this.mailer.sendCredentials({
				to: input.email,
				name: input.name,
				username: input.username,
				password: input.password,
				url: this.portalUrl ? `${this.portalUrl.replace(/\/+$/, '')}/login` : null,
			});
		} catch (error) {
			pinoLogger.error({ err: error }, 'customer account: credentials email failed');
		}
	}
}
