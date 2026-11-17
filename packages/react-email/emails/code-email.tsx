import { Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/email-layout';

export type CodeEmailProps = {
	/** The one-time code, shown large and spaced. */
	code: string;
	texts: { greeting: string; body: string; expiry: string; footer: string };
};

/** One-time code email (customer portal sign-up verification, ERP-0022). */
export function CodeEmail({ code, texts }: CodeEmailProps) {
	return (
		<EmailLayout preview={texts.body} footer={texts.footer}>
			<Heading as="h1" className="text-foreground text-xl font-semibold m-0 mb-4">
				{texts.greeting}
			</Heading>
			<Text className="text-foreground text-sm m-0" style={{ lineHeight: 1.6 }}>
				{texts.body}
			</Text>
			<Section className="my-6 rounded-md border border-solid border-border bg-muted px-4 py-3 text-center">
				<Text className="text-foreground text-2xl font-semibold m-0" style={{ letterSpacing: '0.3em' }}>
					{code}
				</Text>
			</Section>
			<Text className="text-muted-foreground text-xs m-0">{texts.expiry}</Text>
		</EmailLayout>
	);
}

CodeEmail.PreviewProps = {
	code: '482913',
	texts: {
		greeting: 'Hi John,',
		body: 'Use this code to finish creating your IMS ERP customer portal account.',
		expiry: 'The code expires in 10 minutes. If you did not sign up, ignore this email.',
		footer: 'This is an automated message from IMS ERP; replies to this address are not monitored.',
	},
} satisfies CodeEmailProps;

export default CodeEmail;
