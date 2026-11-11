import { Heading, Text } from '@react-email/components';
import {
	ActionButton,
	EmailLayout,
	FallbackLink,
} from './components/email-layout';
import type { EmailTexts } from './types';

export type AppInvitationEmailProps = {
	url: string;
	texts: EmailTexts;
};

/**
 * App invitation email — invites a user to create their account on the
 * application itself (`invitation.type === 'app'`). No organization or
 * role context; the invitee may never have heard of the app before.
 */
export function AppInvitationEmail({ url, texts }: AppInvitationEmailProps) {
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

AppInvitationEmail.PreviewProps = {
	url: 'https://app.example.com/invite/abc123',
	texts: {
		greeting: 'Hi John,',
		body: "You have been invited to create your account on IMS ERP. Accept the invitation to set up your account and get started. This invitation expires on 12 Jan 2026, 09:00.",
		action: 'Create account',
		fallback:
			'If the button does not work, copy and paste this link into your browser:',
		footer:
			'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies AppInvitationEmailProps;

export default AppInvitationEmail;
