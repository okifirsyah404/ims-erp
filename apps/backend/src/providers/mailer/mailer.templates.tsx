import {
	DEFAULT_LANGUAGE,
	en,
	id,
	type LanguageCode,
} from '@ims-erp/locales';
import {
	AppInvitationEmail,
	CodeEmail,
	OrganizationInvitationEmail,
	ResetPasswordEmail,
	renderEmail,
	VerificationEmail,
} from '@ims-erp/react-email';
import { createInstance } from 'i18next';
import { container } from 'tsyringe';
import { appConfig } from '@config/providers/config';
import { COMPANY_SERVICE_TOKEN } from '@app/company';
import type { MailPayload } from './mailer.transport';

/**
 * Email templates rendered with `@ims-erp/react-email`.
 *
 * This module owns i18n: a standalone i18next instance is built here (Better
 * Auth hooks run outside the Elysia request lifecycle — no request-scoped
 * `t`), translations are interpolated into final strings, and passed as
 * props to the layout components which know nothing about i18n.
 *
 * Language is a parameter defaulting to {@link DEFAULT_LANGUAGE}; pass the
 * user's locale once it is stored on the user record.
 */

const appNameFallback = () => appConfig.app.name ?? 'ERP';

/** The company display name (`tradingName ?? legalName`), or the env fallback. */
async function appName(): Promise<string> {
	try {
		const company = container.resolve(COMPANY_SERVICE_TOKEN);
		return (await company.getDisplayName()) ?? appNameFallback();
	} catch {
		// Better Auth hooks can run before the container is populated (tests,
		// standalone scripts); the env name keeps emails working.
		return appNameFallback();
	}
}

type EmailKey = keyof typeof en.email & string;

function t(
	language: LanguageCode,
	key: `email:${EmailKey}`,
	options?: Record<string, unknown>,
): string {
	const instance = createInstance();
	instance.init({
		lng: language,
		fallbackLng: DEFAULT_LANGUAGE,
		supportedLngs: ['en', 'id'],
		keySeparator: false,
		nsSeparator: ':',
		interpolation: { escapeValue: false },
		resources: { en, id } as never,
	});
	return instance.t(key, options ?? {}) as string;
}

type TemplateInput = {
	name?: string | null;
	url: string;
	language?: LanguageCode;
};

/** Verification-email subject + HTML/plain-text body. */
export async function renderVerificationEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Promise<Omit<MailPayload, 'to'>> {
	const app = await appName();
	const texts = {
		greeting: t(language, 'email:verification.greeting', {
			name: name ?? '',
		}),
		body: t(language, 'email:verification.body', { app }),
		action: t(language, 'email:verification.action'),
		fallback: t(language, 'email:verification.fallback'),
		footer: t(language, 'email:footer.noReply', { app }),
	};
	const { html, text } = await renderEmail(
		<VerificationEmail url={url} texts={texts} />,
	);
	return { subject: t(language, 'email:verification.subject'), html, text };
}

/** Password-reset-email subject + HTML/plain-text body. */
export async function renderResetPasswordEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Promise<Omit<MailPayload, 'to'>> {
	const app = await appName();
	const texts = {
		greeting: t(language, 'email:resetPassword.greeting', {
			name: name ?? '',
		}),
		body: t(language, 'email:resetPassword.body', { app }),
		action: t(language, 'email:resetPassword.action'),
		fallback: t(language, 'email:resetPassword.fallback'),
		footer: t(language, 'email:footer.noReply', { app }),
	};
	const { html, text } = await renderEmail(
		<ResetPasswordEmail url={url} texts={texts} />,
	);
	return { subject: t(language, 'email:resetPassword.subject'), html, text };
}

/** App-invitation-email subject + HTML/plain-text body (`type: 'app'`). */
export async function renderAppInvitationEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Promise<Omit<MailPayload, 'to'>> {
	const app = await appName();
	const texts = {
		greeting: t(language, 'email:appInvitation.greeting', {
			name: name ?? '',
		}),
		body: t(language, 'email:appInvitation.body', { app }),
		action: t(language, 'email:appInvitation.action'),
		fallback: t(language, 'email:appInvitation.fallback'),
		footer: t(language, 'email:footer.noReply', { app }),
	};
	const { html, text } = await renderEmail(
		<AppInvitationEmail url={url} texts={texts} />,
	);
	return {
		subject: t(language, 'email:appInvitation.subject', { app }),
		html,
		text,
	};
}

/**
 * Customer-portal invitation (ERP-0022): the link sets the first password on
 * the portal's `/reset-password` page. Reuses the app-invitation layout.
 */
export async function renderPortalInvitationEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Promise<Omit<MailPayload, 'to'>> {
	const texts = {
		greeting: t(language, 'email:portalInvitation.greeting', { name: name ?? '' }),
		body: t(language, 'email:portalInvitation.body', { app: appName() }),
		action: t(language, 'email:portalInvitation.action'),
		fallback: t(language, 'email:portalInvitation.fallback'),
		footer: t(language, 'email:footer.noReply', { app: appName() }),
	};
	const { html, text } = await renderEmail(<AppInvitationEmail url={url} texts={texts} />);
	return { subject: t(language, 'email:portalInvitation.subject', { app: appName() }), html, text };
}

/** Customer-portal sign-up code (ERP-0022, owner decision D1). */
export async function renderPortalSignupCodeEmail({
	name,
	code,
	language = DEFAULT_LANGUAGE,
}: {
	name: string;
	code: string;
	language?: LanguageCode;
}): Promise<Omit<MailPayload, 'to'>> {
	const texts = {
		greeting: t(language, 'email:portalSignupCode.greeting', { name }),
		body: t(language, 'email:portalSignupCode.body', { app: appName() }),
		expiry: t(language, 'email:portalSignupCode.expiry'),
		footer: t(language, 'email:footer.noReply', { app: appName() }),
	};
	const { html, text } = await renderEmail(<CodeEmail code={code} texts={texts} />);
	return { subject: t(language, 'email:portalSignupCode.subject', { app: appName(), code }), html, text };
}

/** Organization-invitation input; superset of the base template input. */
export type OrganizationInvitationTemplateInput = TemplateInput & {
	organizationName: string;
	roleName: string;
	/** Pre-formatted expiry (e.g. via luxon in the caller). */
	expiresAt: string;
};

/** Organization-invitation-email subject + HTML/plain-text body (`type: 'org'`). */
export async function renderOrganizationInvitationEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
	organizationName,
	roleName,
	expiresAt,
}: OrganizationInvitationTemplateInput): Promise<Omit<MailPayload, 'to'>> {
	const app = await appName();
	const intro = t(language, 'email:organizationInvitation.intro', {
		organization: organizationName,
		role: roleName,
		app,
	});
	const expires = t(language, 'email:organizationInvitation.expires', {
		expiresAt,
	});
	const texts = {
		greeting: t(language, 'email:organizationInvitation.greeting', {
			name: name ?? '',
		}),
		body: intro,
		action: t(language, 'email:organizationInvitation.action'),
		fallback: t(language, 'email:organizationInvitation.fallback'),
		footer: t(language, 'email:footer.noReply', { app }),
	};
	const { html, text } = await renderEmail(
		<OrganizationInvitationEmail
			intro={intro}
			expires={expires}
			url={url}
			texts={texts}
		/>,
	);
	return {
		subject: t(language, 'email:organizationInvitation.subject', {
			organization: organizationName,
		}),
		html,
		text,
	};
}
