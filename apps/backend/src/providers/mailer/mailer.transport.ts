import nodemailer from 'nodemailer';
import { appConfig } from '@config/providers/config';

/**
 * Provider-agnostic email payload. Queue, worker, and callers all speak this
 * shape; only {@link resolveMailTransport} knows which vendor delivers it.
 */
export type MailPayload = {
	to: string;
	subject: string;
	html?: string;
	text?: string;
	replyTo?: string;
};

/** A single email-delivery backend (SMTP today, Resend later). */
export type MailTransport = {
	send(payload: MailPayload): Promise<void>;
};

/** Envelope sender; falls back to the SMTP user, else a generic no-reply. */
export function resolveMailFrom(): string {
	return (
		appConfig.mail.from ??
		appConfig.mail.smtp?.user ??
		`noreply@${appConfig.app.id}.local`
	);
}

/**
 * Nodemailer SMTP transport built from `mail.smtp.*` config.
 * `pool: true` keeps one set of connections alive — the worker sends bursts
 * of verification/reset mails, not one-shot messages.
 */
export function createSmtpTransport(): MailTransport {
	const smtp = appConfig.mail.smtp;
	if (!smtp?.host) {
		throw new Error('createSmtpTransport: mail.smtp.host is not configured');
	}

	const transport = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port ?? 587,
		secure: smtp.secure ?? smtp.port === 465,
		auth:
			smtp.user != null
				? { user: smtp.user, pass: smtp.password ?? '' }
				: undefined,
		pool: true,
	});

	return {
		async send(payload: MailPayload): Promise<void> {
			await transport.sendMail({
				from: resolveMailFrom(),
				to: payload.to,
				subject: payload.subject,
				html: payload.html,
				text: payload.text,
				replyTo: payload.replyTo,
			});
		},
	};
}

/**
 * Picks the delivery backend. `mail.provider` wins when set; otherwise
 * auto-detect: Resend when an API key is present, else SMTP when a host is.
 * Returns `null` when nothing is configured — mail is then a no-op
 * (dev/test without Redis or SMTP must not crash boot).
 */
export function resolveMailTransport(): MailTransport | null {
	const provider = appConfig.mail.provider;
	if (provider === 'resend') {
		// Not installed yet; fail loudly rather than silently dropping mail.
		throw new Error('Resend transport is not implemented yet');
	}

	if (provider === 'smtp' || provider == null) {
		if (appConfig.mail.smtp?.host) return createSmtpTransport();
		if (appConfig.mail.resend?.apiKey) {
			throw new Error('Resend transport is not implemented yet');
		}
	}

	return null;
}

/** True when a delivery backend is configured and dispatch will enqueue. */
export function isMailEnabled(): boolean {
	return appConfig.mail.provider === 'resend'
		? true
		: (appConfig.mail.smtp?.host != null || appConfig.mail.resend?.apiKey != null);
}
