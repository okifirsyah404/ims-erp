import { z } from 'zod';

/**
 * Personal fields owned by `auth.users` (ERP-0034). They moved out of
 * `hr.employees` because they describe the person, not the employment.
 *
 * @remarks
 * `gender` is the closed API contract `male | female`. `birthDate` is a
 * Jakarta `YYYY-MM-DD` business date stored as an instant at midnight.
 */
export const GENDERS = ['male', 'female'] as const;
export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;

export const userPersonalFieldsSchema = z.object({
	gender: z.enum(GENDERS).nullable(),
	birthDate: z.date().nullable(),
	birthPlace: z.string().nullable(),
	maritalStatus: z.enum(MARITAL_STATUSES).nullable(),
});

export type TUserPersonalFields = z.infer<typeof userPersonalFieldsSchema>;

/** Patch: only the keys present are written; absent keys stay untouched. */
export type TUserPersonalFieldsPatch = Partial<TUserPersonalFields>;
