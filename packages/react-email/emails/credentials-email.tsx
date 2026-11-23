import { Heading, Section, Text } from '@react-email/components';
import { ActionButton, EmailLayout } from './components/email-layout';

export type CredentialsEmailProps = {
	username: string;
	password: string;
	/** Sign-in page of the customer portal; the button is omitted without it. */
	url?: string | null;
	texts: {
		greeting: string;
		body: string;
		usernameLabel: string;
		passwordLabel: string;
		changeNotice: string;
		action: string;
		footer: string;
	};
};

/**
 * Account credentials email: the username and the default password of a
 * customer account created by staff (ERP-0114). The password must be changed
 * at the first sign-in.
 */
export function CredentialsEmail({ username, password, url, texts }: CredentialsEmailProps) {
	return (
		<EmailLayout preview={texts.body} footer={texts.footer}>
			<Heading as="h1" className="text-foreground text-xl font-semibold m-0 mb-4">
				{texts.greeting}
			</Heading>
			<Text className="text-foreground text-sm m-0" style={{ lineHeight: 1.6 }}>
				{texts.body}
			</Text>
			<Section className="my-6 rounded-md border border-solid border-border bg-muted px-4 py-3">
				<Text className="text-muted-foreground text-xs m-0">{texts.usernameLabel}</Text>
				<Text className="text-foreground text-base font-semibold m-0 mb-3" style={{ fontFamily: 'monospace' }}>
					{username}
				</Text>
				<Text className="text-muted-foreground text-xs m-0">{texts.passwordLabel}</Text>
				<Text className="text-foreground text-base font-semibold m-0" style={{ fontFamily: 'monospace' }}>
					{password}
				</Text>
			</Section>
			<Text className="text-foreground text-sm m-0 mb-6" style={{ lineHeight: 1.6 }}>
				{texts.changeNotice}
			</Text>
			{url ? <ActionButton url={url} label={texts.action} /> : null}
		</EmailLayout>
	);
}

CredentialsEmail.PreviewProps = {
	username: 'budi_santoso_482913',
	password: 'budi_santoso_48291312345678',
	url: 'https://portal.example.com/login',
	texts: {
		greeting: 'Hi Budi,',
		body: 'An IMS ERP customer account has been created for you.',
		usernameLabel: 'Username',
		passwordLabel: 'Password',
		changeNotice: 'For your security, change this password the first time you sign in.',
		action: 'Sign in',
		footer: 'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies CredentialsEmailProps;

export default CredentialsEmail;
