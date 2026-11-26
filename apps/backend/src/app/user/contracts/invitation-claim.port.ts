import { z } from 'zod';
import { GENDERS, MARITAL_STATUSES } from './user-personal-fields.contract';

/**
 * Personal data the invitee enters on the claim form (ERP-0121, grill-me
 * Q19): required NIK, birth place and date, gender and residence address
 * (line, village, postal code);
 * optional marital status. The user module only carries it; the Human
 * Resource module stores it (user personal fields, the employee's NIK and
 * address) through {@link IInvitationClaimPort}.
 */
export const claimPersonalDataSchema = z.object({
	nationalId: z.string().trim().regex(/^\d{16}$/, 'NIK has 16 digits'),
	birthPlace: z.string().trim().min(1).max(200),
	birthDate: z.iso.date(),
	gender: z.enum(GENDERS),
	maritalStatus: z.enum(MARITAL_STATUSES).nullish().transform((value) => value ?? null),
	address: z.object({
		addressLine: z.string().trim().min(1).max(500),
		villageId: z.uuid(),
		postalCode: z.string().trim().regex(/^\d{5}$/, 'Postal code has 5 digits'),
	}),
});

export type TClaimPersonalData = z.output<typeof claimPersonalDataSchema>;

/**
 * Cross-module port of the claim flow, implemented by the Human Resource
 * module (ERP-0121). The user module calls it; it never imports HR classes,
 * and the HR adapter never depends on `InvitationService`, so there is no
 * service cycle.
 */
export interface IInvitationClaimPort {
	/**
	 * Validates and stores the personal data before the credentials are
	 * written, so invalid data fails the claim without a half-claimed account.
	 */
	recordPersonalData(userId: string, data: TClaimPersonalData): Promise<void>;
	/** After a successful claim (the agreement PDF). Must never throw. */
	afterClaim(userId: string): Promise<void>;
}
