import type {
	TUserPersonalFields,
	TUserPersonalFieldsPatch,
} from './user-personal-fields.contract';

/**
 * Cross-module port over the personal fields of `auth.users`.
 *
 * @remarks
 * Consumed by the HR module through `USER_PERSONAL_FIELDS_PORT_TOKEN`, so HR
 * never touches the user repository or the `auth` schema directly.
 */
export interface IUserPersonalFieldsPort {
	/** Null when the user does not exist or is soft-deleted. */
	get(userId: string): Promise<TUserPersonalFields | null>;

	/** Writes only the given keys; a missing user is a no-op. */
	update(userId: string, patch: TUserPersonalFieldsPatch): Promise<void>;
}
