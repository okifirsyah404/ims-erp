import { Heading, Text } from '@react-email/components';
import {
	ActionButton,
	EmailLayout,
	FallbackLink,
} from './components/email-layout';
import type { EmailTexts } from './types';

export type VerificationEmailProps = {
	url: string;
	texts: EmailTexts;
};

/** Account email-verification email. */
export function VerificationEmail({ url, texts }: VerificationEmailProps) {
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

VerificationEmail.PreviewProps = {
	url: 'https://app.example.com/verify?token=abc123',
	texts: {
		greeting: 'Hi John,',
		body: 'Welcome to IMS ERP. Please confirm your email address by clicking the button below. The link expires when your verification request does.',
		action: 'Verify email',
		fallback:
			'If the button does not work, copy and paste this link into your browser:',
		footer:
			'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies VerificationEmailProps;

export default VerificationEmail;
