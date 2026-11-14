/**
 * Domain errors for the user-management module, translated to HTTP statuses
 * by the controller. Never carry HTTP shapes themselves.
 *
 * @remarks
 * Each error carries a locale **key** (`ApiKey`) rather than translated prose.
 * Services have no request context and must not know about presentation; the
 * controllers resolve the key against the request's `Accept-Language` before
 * writing the response envelope.
 *
 * The family now derives from the shared {@link AppError}, so the module's
 * `onError` hook maps it with the same arm as every other domain error.
 * All subclasses below are unchanged - the base is a strict superset of the
 * old standalone class.
 */
import { AppError } from '@http/errors';

/** Base class so the controller can map the family in one arm. */
export class UserManagementError extends AppError {}

export class InvitationNotFoundError extends UserManagementError {
	constructor(invitationId: string) {
		super(404, 'invitation.notFound', `Invitation not found: ${invitationId}`);
	}
}

/** Invite target email already has a pending invitation (single create). */
export class InvitationPendingExistsError extends UserManagementError {
	constructor(readonly email: string) {
		super(
			409,
			'invitation.pendingExists',
			`A pending invitation already exists for ${email}`,
		);
	}
}

export class InvitationNotPendingError extends UserManagementError {
	constructor() {
		super(409, 'invitation.notPending', 'Invitation is not pending');
	}

	/** Delete path: claimed invitations must be deactivated instead. */
	static claimed(): InvitationNotPendingError {
		return new InvitationNotPendingError().withKey(
			'invitation.claimed',
			'Claimed invitations cannot be deleted; deactivate the user instead',
		);
	}
}

/** Org invite missing organizationId/organizationRoles, or an invalid role. */
export class InvalidInvitationError extends UserManagementError {
	constructor() {
		super(
			422,
			'invitation.invalidPayload',
			'Organization invites require both organizationId and valid organizationRoles',
		);
	}

	/** The non-org (application) invite path requires a display name. */
	static requiresName(): InvalidInvitationError {
		return new InvalidInvitationError().withKey(
			'invitation.requiresName',
			'Application invites require name',
		);
	}

	/** Bulk create was given more rows than the hard cap allows. */
	static bulkLimited(max: number): InvalidInvitationError {
		return new InvalidInvitationError().withKey(
			'invitation.bulkLimited',
			`Bulk limited to ${max} rows`,
			{ max },
		);
	}

	/** A bulk-file row names an organization slug no live organization has. */
	static unknownOrganizationSlug(slug: string): InvalidInvitationError {
		return new InvalidInvitationError().withKey(
			'invitation.unknownOrganizationSlug',
			`No organization has slug "${slug}"`,
			{ slug },
		);
	}
}

/** Token invalid, expired, cancelled, or already used. */
export class InvalidClaimTokenError extends UserManagementError {
	constructor() {
		super(
			422,
			'invitation.invalidLink',
			'Invitation link is invalid or expired',
		);
	}

	/** The token belongs to an invitation that has already been accepted. */
	static alreadyUsed(): InvalidClaimTokenError {
		return new InvalidClaimTokenError().withKey(
			'invitation.alreadyUsed',
			'This invitation was already used',
		);
	}

	/** The invitation was cancelled, or otherwise left the pending state. */
	static inactive(): InvalidClaimTokenError {
		return new InvalidClaimTokenError().withKey(
			'invitation.inactive',
			'This invitation is no longer active',
		);
	}

	/** The token is well-formed but past its expiry window. */
	static expired(): InvalidClaimTokenError {
		return new InvalidClaimTokenError().withKey(
			'invitation.expired',
			'This invitation link has expired',
		);
	}
}

/**
 * Username or phone already taken at claim time.
 *
 * @remarks
 * A 422 from Better Auth cannot tell us *which* field collided, so it is
 * reported by {@link ClaimConflictError.reportedByAuth}.
 */
export class ClaimConflictError extends UserManagementError {
	constructor() {
		super(409, 'claim.usernameTaken', 'Username is already taken');
	}

	/** The conflict is on the phone number, not the username. */
	static phoneInUse(): ClaimConflictError {
		return new ClaimConflictError().withKey(
			'claim.phoneInUse',
			'Phone number is already in use',
		);
	}

	/** Better Auth rejected the credentials; the offending field is unknown. */
	static reportedByAuth(message: string): ClaimConflictError {
		return new ClaimConflictError().withKey(
			'claim.alreadyInUse',
			message || 'Username or email already in use',
		);
	}
}

/** Pre-created user row is missing or not pending. */
export class ClaimStateError extends UserManagementError {
	constructor() {
		super(409, 'invitation.claimUserMissing', 'Invited user no longer exists');
	}

	/** The account was already activated by another path. */
	static alreadyActive(): ClaimStateError {
		return new ClaimStateError().withKey(
			'invitation.claimAlreadyActive',
			'This account is already active',
		);
	}

	/** A pending invitation points at a pre-created user row that is gone. */
	static invitedUserMissing(): ClaimStateError {
		return new ClaimStateError().withKey(
			'invitation.claimUserMissing',
			'Pending invitation exists but its pre-created user is missing',
		);
	}

	/** Better Auth rejected the claim payload; the cause is unknown. */
	static reportedByAuth(message: string): ClaimStateError {
		return new ClaimStateError().withKey(
			'invitation.claimInvalid',
			message || 'Invalid claim data',
		);
	}
}

// ---------------------------------------------------------------------------
// Phase 4 — account lifecycle, escalation guard
// ---------------------------------------------------------------------------

export class UserNotFoundError extends UserManagementError {
	constructor(userId: string) {
		super(404, 'user.notFound', `User not found: ${userId}`);
	}
}

/** Lifecycle transition not allowed from the user's current state. */
export class UserStateError extends UserManagementError {
	constructor() {
		super(
			409,
			'userAdmin.cannotDeactivate',
			'Cannot deactivate an account in this status',
		);
	}

	/** Reactivate called on an account that is already active. */
	static alreadyActive(): UserStateError {
		return new UserStateError().withKey(
			'userAdmin.accountAlreadyActive',
			'Account is already active',
		);
	}
}

