import { inject, injectable } from 'tsyringe';
import { USER_PREFERENCE_REPOSITORY_TOKEN } from '../constants/di';
import type { IUserPreferenceRepository } from '../repositories/user-preference.repository';

/** The customer portal's per-login settings (ERP-0075). */
export type TPortalPreferences = {
	notifications: { email: boolean; whatsapp: boolean; push: boolean };
	language: 'en' | 'id' | null;
	/** An emailed code at every sign-in (ERP-0081). */
	twoStep: boolean;
};

const KEYS = {
	email: 'portal.notify.email',
	whatsapp: 'portal.notify.whatsapp',
	push: 'portal.notify.push',
	language: 'portal.language',
	twoStep: 'portal.security.two_step',
} as const;

/** Email on, WhatsApp and push off, language from the browser until chosen, two-step off. */
const DEFAULTS: TPortalPreferences = { notifications: { email: true, whatsapp: false, push: false }, language: null, twoStep: false };

const flag = (value: string | null | undefined, fallback: boolean) => (value === 'true' ? true : value === 'false' ? false : fallback);

/**
 * Per-user preferences (`auth.user_preferences`, ERP-0075), Identity's
 * contract for the portal module. Values are stored as text; this service
 * owns their meaning.
 */
@injectable()
export class UserPreferenceService {
	constructor(@inject(USER_PREFERENCE_REPOSITORY_TOKEN) private readonly preferences: IUserPreferenceRepository) {}

	async portal(userId: string): Promise<TPortalPreferences> {
		const values = await this.preferences.get(userId, Object.values(KEYS));
		const language = values.get(KEYS.language);
		return {
			notifications: {
				email: flag(values.get(KEYS.email), DEFAULTS.notifications.email),
				whatsapp: flag(values.get(KEYS.whatsapp), DEFAULTS.notifications.whatsapp),
				push: flag(values.get(KEYS.push), DEFAULTS.notifications.push),
			},
			language: language === 'en' || language === 'id' ? language : DEFAULTS.language,
			twoStep: flag(values.get(KEYS.twoStep), DEFAULTS.twoStep),
		};
	}

	/** Saves the given settings only; others keep their value. */
	async setPortal(
		userId: string,
		patch: { notifications?: Partial<TPortalPreferences['notifications']>; language?: 'en' | 'id'; twoStep?: boolean },
	): Promise<TPortalPreferences> {
		const entries: Record<string, string> = {};
		for (const channel of ['email', 'whatsapp', 'push'] as const) {
			const value = patch.notifications?.[channel];
			if (value !== undefined) entries[KEYS[channel]] = String(value);
		}
		if (patch.language) entries[KEYS.language] = patch.language;
		if (patch.twoStep !== undefined) entries[KEYS.twoStep] = String(patch.twoStep);
		if (Object.keys(entries).length > 0) await this.preferences.set(userId, entries);
		return this.portal(userId);
	}
}
