import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import { selfUserQueryOptions } from '@/lib/user-api';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';

/**
 * Change-email form (`/account/email`). Shows the current email with its
 * verification status; runs Better Auth's `changeEmail` (a verification
 * email is sent to the new address — currently logged by the backend).
 */
export function ChangeEmailForm() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const [newEmail, setNewEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [requested, setRequested] = useState(false);
	const { t } = useTranslation(['account', 'common']);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			const { error: changeError } = await authClient.changeEmail({
				newEmail,
			});
			if (changeError) {
				setError(changeError.message ?? t('email.failed'));
				return;
			}
			setRequested(true);
			toast.success(t('email.sent'));
			setNewEmail('');
		} catch {
			setError(t('common:error.network'));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('email.title')}</CardTitle>
				<CardDescription>{t('email.description')}</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor='current-email'>
							{t('email.current')}
						</FieldLabel>
						<div className='flex items-center gap-2'>
							<Input
								id='current-email'
								value={user.email}
								readOnly
								className='flex-1'
							/>
							<Badge variant={user.emailVerified ? 'secondary' : 'outline'}>
								{user.emailVerified ? t('email.verified') : t('email.unverified')}
							</Badge>
						</div>
					</Field>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='new-email'>{t('email.new')}</FieldLabel>
								<Input
									id='new-email'
									type='email'
									required
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									autoComplete='email'
								/>
								<FieldDescription>
									{t('email.verificationHint')}
								</FieldDescription>
							</Field>
							{requested && (
								<FieldDescription>
									{t('email.verificationRequested')}
								</FieldDescription>
							)}
							{error && (
								<p className='text-destructive text-sm' role='alert'>
									{error}
								</p>
							)}
							<div>
								<Button type='submit' disabled={pending}>
									{pending ? t('email.submitting') : t('email.submit')}
								</Button>
							</div>
						</FieldGroup>
					</form>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
