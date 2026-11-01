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
