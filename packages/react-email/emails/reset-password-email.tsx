import { Heading, Text } from '@react-email/components';
import {
	ActionButton,
	EmailLayout,
	FallbackLink,
} from './components/email-layout';
import type { EmailTexts } from './types';

export type ResetPasswordEmailProps = {
	url: string;
	texts: EmailTexts;
};

/** Password-reset email. */
export function ResetPasswordEmail({ url, texts }: ResetPasswordEmailProps) {
	return (
		<EmailLayout preview={texts.body} footer={texts.footer}>
			<Heading
				as="h1"
				className="text-foreground text-xl font-semibold m-0 mb-4"
			>
				{texts.greeting}
			</Heading>
			<Text
				className="text-foreground text-sm m-0"
				style={{ lineHeight: 1.6 }}
			>
				{texts.body}
			</Text>
			<ActionButton url={url} label={texts.action} />
			<FallbackLink text={texts.fallback} url={url} />
		</EmailLayout>
	);
}

ResetPasswordEmail.PreviewProps = {
	url: 'https://app.example.com/reset-password?token=abc123',
	texts: {
		greeting: 'Hi John,',
		body: 'We received a request to reset the password for your IMS ERP account. Click the button below to choose a new password. If you did not request this, you can safely ignore this email.',
		action: 'Reset password',
		fallback:
			'If the button does not work, copy and paste this link into your browser:',
		footer:
			'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
