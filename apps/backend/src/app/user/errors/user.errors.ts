/**
 * Domain errors translated to HTTP statuses by the user controller.
 *
 * @remarks
 * Thrown by the user service and the Better Auth gateway; never carry
 * HTTP shapes themselves.
 */
export class UserNotFoundError extends Error {
	constructor(readonly userId: string) {
		super(`User not found: ${userId}`);
		this.name = 'UserNotFoundError';
	}
}

export class UserEmailTakenError extends Error {
	constructor(readonly email: string) {
		super(`Email already in use: ${email}`);
		this.name = 'UserEmailTakenError';
	}
}

/** Uploaded avatar failed validation (type or size). */
export class InvalidAvatarError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidAvatarError';
	}
}
