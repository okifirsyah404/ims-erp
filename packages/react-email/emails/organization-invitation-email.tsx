import { Heading, Text } from '@react-email/components';
import {
	ActionButton,
	EmailLayout,
	FallbackLink,
} from './components/email-layout';
import type { EmailTexts } from './types';

export type OrganizationInvitationEmailProps = {
	/** Pre-translated organization/role sentence, e.g. "You have been invited to join Acme as Admin.". */
	intro: string;
	/** Pre-translated expiry sentence, e.g. "This invitation expires on 12 Jan 2026, 09:00.". */
	expires: string;
	url: string;
	texts: EmailTexts;
};

/**
 * Organization invitation email — invites a user to join a specific
 * organization with a role (`invitation.type === 'org'`). The invitee
 * already knows the organization; the email names it, the role, and the
 * expiry.
 */
export function OrganizationInvitationEmail({
	intro,
	expires,
	url,
	texts,
}: OrganizationInvitationEmailProps) {
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
				{intro}
			</Text>
			<Text className="text-muted-foreground text-sm mt-0 mb-4">
				{expires}
			</Text>
			<ActionButton url={url} label={texts.action} />
			<FallbackLink text={texts.fallback} url={url} />
		</EmailLayout>
	);
}

OrganizationInvitationEmail.PreviewProps = {
	intro: 'You have been invited to join Acme Corp as Admin.',
	expires: 'This invitation expires on 12 Jan 2026, 09:00.',
	url: 'https://app.example.com/invite/abc123',
	texts: {
		greeting: 'Hi John,',
		body: 'Accept the invitation to create your account and start collaborating.',
		action: 'Accept invitation',
		fallback:
			'If the button does not work, copy and paste this link into your browser:',
		footer:
			'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
