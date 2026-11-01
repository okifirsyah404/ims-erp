/**
 * Domain errors for the user-management module, translated to HTTP statuses
 * by the controller. Never carry HTTP shapes themselves.
 */

/** Base class so the controller can map the family in one arm. */
export class UserManagementError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = new.target.name;
	}
}

export class InvitationNotFoundError extends UserManagementError {
	constructor(invitationId: string) {
		super(404, `Invitation not found: ${invitationId}`);
	}
}

/** Invite target email already has a pending invitation (single create). */
export class InvitationPendingExistsError extends UserManagementError {
	constructor(readonly email: string) {
		super(409, `A pending invitation already exists for ${email}`);
	}
}

export class InvitationNotPendingError extends UserManagementError {
	constructor(message = 'Invitation is not pending') {
		super(409, message);
	}
}

/** Org invite missing organizationId/roleId, or unknown roleId. */
export class InvalidInvitationError extends UserManagementError {
	constructor(message: string) {
		super(422, message);
	}
}

/** Token invalid, expired, cancelled, or already used. */
export class InvalidClaimTokenError extends UserManagementError {
	constructor(message = 'Invitation link is invalid or expired') {
		super(422, message);
	}
}

/** Username or phone already taken at claim time. */
export class ClaimConflictError extends UserManagementError {
	constructor(message: string) {
		super(409, message);
	}
}

/** Pre-created user row is missing or not pending. */
export class ClaimStateError extends UserManagementError {
	constructor(message: string) {
		super(409, message);
	}
}

/** Role name not in the organization's master data (single invite path). */
export class RoleNotFoundError extends UserManagementError {
	constructor(readonly roleNameOrId: string) {
		super(422, `Role not found: ${roleNameOrId}`);
	}
}

// ---------------------------------------------------------------------------
// Phase 4 — account lifecycle, role CRUD, escalation guard
// ---------------------------------------------------------------------------

export class UserNotFoundError extends UserManagementError {
	constructor(userId: string) {
		super(404, `User not found: ${userId}`);
	}
}

/** Lifecycle transition not allowed from the user's current status. */
export class UserStateError extends UserManagementError {
	constructor(message: string) {
		super(409, message);
	}
}

/**
 * Escalation guard (D5): a caller can never grant or touch a rank at or
 * above their own. Enforced server-side on every role/member write.
 */
export class RankGuardError extends UserManagementError {
	constructor(message = 'You cannot grant a role at or above your own rank') {
		super(403, message);
	}
}

/** Role exists in this organization's live master data. */
export class RoleNameTakenError extends UserManagementError {
	constructor(name: string) {
		super(409, `A role named "${name}" already exists in this organization`);
	}
}

/**
 * Role cannot be deleted or renamed: it is a seeded system role, or live
 * members still hold it.
 */
export class RoleInUseError extends UserManagementError {
	constructor(message: string) {
		super(409, message);
	}
}

/** Permission grant references a resource/action outside the catalog. */
export class InvalidPermissionGrantError extends UserManagementError {
	constructor(message: string) {
		super(422, message);
	}
}
