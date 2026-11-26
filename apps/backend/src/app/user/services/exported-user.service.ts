import { USER_REPOSITORY_TOKEN } from '../constants/di';
import type { IUserRepository } from '../contracts/user.repository.interface';
import { presignObjectUrl, s3Client } from '@providers/s3/s3';
import { toWebp } from '@utils/image.util';
import { inject, injectable } from 'tsyringe';
import { avatarCustomObjectKey } from '../constants/avatar-keys';
import { USER_ACCOUNT_GATEWAY_TOKEN } from '../constants/di';
import type { IUserAccountGateway, TAuthUser } from '../contracts/user-account.gateway.interface';

/**
 * Facade over the identity module for other modules (ADR-0024 Q5, Q9).
 *
 * @remarks
 * The customer portal owns its login state (`customer.customers.user_id` and
 * the portal columns) but never touches Better Auth or `auth.*` tables: users
 * and credentials are created and read here. Depends only on the Better Auth
 * gateway, so a consumer that itself depends on other modules cannot create a
 * cycle.
 */
/** A user as a customer list shows it: `image` is a presigned URL, not the key. */
/**
 * The login (`auth.users`) behind another module's record, for a detail
 * screen (ERP-0117 follow-up: the employee page). No credential data: Better
 * Auth keeps passwords in `auth.accounts`, which this never reads.
 */
export type TAccountDetail = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	username: string | null;
	displayUsername: string | null;
	image: string | null;
	phone: string | null;
	bio: string | null;
	/** Application role(s), comma-joined (ADR-0018); `null` for a plain user. */
	role: string | null;
	status: string;
	banned: boolean;
	banReason: string | null;
	banExpires: string | null;
	claimedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

/** A cached row comes back from Redis with ISO strings instead of dates. */
const isoOf = (value: Date | string | number | null | undefined): string | null => (value == null ? null : new Date(value).toISOString());

export type TAccountSummary = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	username: string | null;
	image: string | null;
};

/** Longest side of a stored avatar in pixels; same as the self-service upload. */
const AVATAR_RENDER_SIZE = 144;

@injectable()
export class ExportedUserService {
	constructor(
		@inject(USER_ACCOUNT_GATEWAY_TOKEN)
		private readonly accounts: IUserAccountGateway,
		/** The `auth.users` row for {@link ExportedUserService.accountDetail}; optional for tests that never read it. */
		@inject(USER_REPOSITORY_TOKEN)
		private readonly users?: Pick<IUserRepository, 'findById'>,
	) {}

	/** The live login behind a record, or `null` (none, deleted, or not wired). */
	async accountDetail(userId: string): Promise<TAccountDetail | null> {
		const user = this.users ? await this.users.findById(userId) : null;
		if (!user) return null;
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			username: user.username ?? null,
			displayUsername: user.displayUsername ?? null,
			image: user.image ? presignObjectUrl(user.image) : null,
			phone: user.phone ?? null,
			bio: user.bio ?? null,
			role: user.role ?? null,
			status: user.status ?? 'active',
			banned: user.banned ?? false,
			banReason: user.banReason ?? null,
			banExpires: isoOf(user.banExpires),
			claimedAt: isoOf(user.claimedAt),
			createdAt: isoOf(user.createdAt)!,
			updatedAt: isoOf(user.updatedAt)!,
		};
	}

	findByEmail(email: string): Promise<TAuthUser | null> {
		return this.accounts.findUserByEmail(email);
	}

	findById(id: string): Promise<TAuthUser | null> {
		return this.accounts.findUserById(id);
	}

	/**
	 * Creates a login that is not an organization member (a portal user never
	 * passes the `erp` guard).
	 */
	createPortalLogin(input: { name: string; email: string; emailVerified: boolean }): Promise<TAuthUser> {
		return this.accounts.createUser(input);
	}

	/**
	 * Creates a customer account (ERP-0114): a login that is not an
	 * organization member, with a username and a password. The email is not
	 * verified until the customer first signs in.
	 */
	async createCustomerAccount(input: {
		name: string;
		email: string;
		username: string;
		password: string;
	}): Promise<TAuthUser> {
		const user = await this.accounts.createUser({
			name: input.name,
			email: input.email,
			emailVerified: false,
			username: input.username,
		});
		try {
			await this.accounts.setPassword(user.id, input.password);
		} catch (error) {
			await this.accounts.deleteUser(user.id);
			throw error;
		}
		return user;
	}

	isUsernameTaken(username: string): Promise<boolean> {
		return this.accounts.isUsernameTaken(username);
	}

	/** Summaries by id with presigned avatars, keyed by user id. */
	async summaries(ids: string[]): Promise<Map<string, TAccountSummary>> {
		const unique = [...new Set(ids.filter(Boolean))];
		const users = await this.accounts.findUsersByIds(unique);
		return new Map(users.map((user) => [user.id, this.toSummary(user)]));
	}

	/** One summary, or `null`. */
	async summary(userId: string): Promise<TAccountSummary | null> {
		const user = await this.accounts.findUserById(userId);
		return user ? this.toSummary(user) : null;
	}

	private toSummary(user: TAuthUser): TAccountSummary {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			username: user.username ?? null,
			image: user.image ? presignObjectUrl(user.image) : null,
		};
	}

	/** Ids of users whose email contains `term`, for searches by email. */
	findIdsByEmail(term: string, limit = 200): Promise<string[]> {
		return this.accounts.findUserIdsByEmailLike(term, limit);
	}

	/** Updates the name and/or email Better Auth owns. */
	updateProfile(userId: string, patch: { name?: string; email?: string }): Promise<void> {
		return this.accounts.updateUser(userId, patch);
	}

	/**
	 * Stores an avatar uploaded by staff for this user (same pipeline as the
	 * self-service upload: re-encoded to WebP, custom-key namespace).
	 *
	 * @throws UnsupportedImageError When the bytes cannot be decoded
	 */
	async setAvatar(userId: string, bytes: Uint8Array): Promise<string> {
		const webp = await toWebp(bytes, { maxSize: AVATAR_RENDER_SIZE });
		const key = avatarCustomObjectKey(userId);
		await s3Client.write(key, webp, { type: 'image/webp' });
		await this.accounts.updateUser(userId, { image: key });
		return presignObjectUrl(key);
	}

	/** Clears the avatar; the stored object stays (history). */
	async clearAvatar(userId: string): Promise<void> {
		await this.accounts.updateUser(userId, { image: null });
	}

	/** Compensation for a create that failed after the user was created. */
	deleteUnusedUser(userId: string): Promise<void> {
		return this.accounts.deleteUser(userId);
	}

	/** A staff login (organization member); such an email may never become a portal login. */
	isStaff(userId: string): Promise<boolean> {
		return this.accounts.isOrganizationMember(userId);
	}

	setPassword(userId: string, password: string): Promise<void> {
		return this.accounts.setPassword(userId, password);
	}

	markEmailVerified(userId: string): Promise<void> {
		return this.accounts.markEmailVerified(userId);
	}

	hasPassword(userId: string): Promise<boolean> {
		return this.accounts.hasPassword(userId);
	}

	/** One-time token for Better Auth's reset-password endpoint (first password or reset). */
	issuePasswordToken(userId: string, ttlSeconds: number): Promise<string> {
		return this.accounts.issuePasswordToken(userId, ttlSeconds);
	}

	/** Gives the user the global `customer` role the portal guard requires (ADR-0027). */
	grantCustomerRole(userId: string): Promise<void> {
		return this.accounts.grantCustomerRole(userId);
	}

	/** Ends every session of the user; the user row stays (history). */
	revokeSessions(userId: string): Promise<void> {
		return this.accounts.revokeSessions(userId);
	}
}
