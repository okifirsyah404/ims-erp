import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { PageSkeleton } from '@/components/page-skeleton';
import { ErrorState, errorMessage } from '@/components/empty-state';
import { toast } from '@/components/toast';
import { AccountSecurityCard } from '@/components/profile/account-security-card';
import { myProfileQueryOptions, updateMyProfile, type TMyProfile } from '@/lib/portal-api';

/**
 * `/profile` — the employee's own data.
 *
 * @remarks
 * Only the whitelisted fields are editable here: nickname, phone and the
 * primary address. Everything HR owns (NIK, NPWP, BPJS, email, position,
 * salary, bank) is shown read-only; the backend refuses those keys too, so the
 * UI is a convenience, not the boundary.
 */
export function ProfilePage() {
	const { t } = useTranslation('employee');
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(myProfileQueryOptions);

	// `key` remounts the form when the profile arrives or the organization
	// switches, so the fields start from server state without an effect.
	return (
		<ProfileScreen
			key={data ? `${data.id}:${data.phone ?? ''}:${data.address?.addressLine ?? ''}` : 'pending'}
			profile={data}
			isPending={isPending}
			isError={isError}
			error={error}
			t={t}
			queryClient={queryClient}
		/>
	);
}

function ProfileScreen({
	profile,
	isPending,
	isError,
	error,
	t,
	queryClient,
}: {
	profile: TMyProfile | undefined;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	t: TFunction<'employee'>;
	queryClient: QueryClient;
}) {
	const [nickname, setNickname] = useState(profile?.nickname ?? '');
	const [phone, setPhone] = useState(profile?.phone ?? '');
	const [addressLine, setAddressLine] = useState(profile?.address?.addressLine ?? '');
	const [postalCode, setPostalCode] = useState(profile?.address?.postalCode ?? '');

	const save = useMutation({
		mutationFn: () =>
			updateMyProfile({
				nickname: nickname.trim() === '' ? null : nickname.trim(),
				phone: phone.trim() === '' ? null : phone.trim(),
				address:
					addressLine.trim() === ''
						? null
						: {
								addressLine: addressLine.trim(),
								villageId: profile?.address?.villageId ?? null,
								postalCode: postalCode.trim() === '' ? null : postalCode.trim(),
							},
			}),
		onSuccess: async (profile) => {
			queryClient.setQueryData(myProfileQueryOptions.queryKey, profile);
			toast.success(t('profile.saved'));
		},
		onError: (mutationError) => toast.error(errorMessage(mutationError)),
	});

	if (isPending) return <PageSkeleton cards={2} />;
	if (isError || !profile) return <ErrorState error={error} />;

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('profile.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('profile.subtitle')}</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('profile.employment')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.employeeCode')}</p>
						<p className='font-medium'>{profile.employeeCode}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.fullName')}</p>
						<p className='font-medium'>{profile.fullName}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.email')}</p>
						<p className='font-medium'>{profile.email ?? '-'}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.status')}</p>
						<p className='font-medium'>{profile.employmentStatus}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.type')}</p>
						<p className='font-medium'>{profile.employmentType}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.workType')}</p>
						<p className='font-medium'>{profile.workType}</p>
					</div>
					<div>
						<p className='text-xs text-muted-foreground'>{t('profile.hireDate')}</p>
						<p className='font-medium'>{profile.hireDate ?? '-'}</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{t('profile.personal')}</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className='space-y-4'
						onSubmit={(event) => {
							event.preventDefault();
							save.mutate();
						}}
					>
						<FieldGroup className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel>{t('profile.nickname')}</FieldLabel>
								<Input value={nickname} onChange={(event) => setNickname(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel>{t('profile.phone')}</FieldLabel>
								<Input
									value={phone}
									inputMode='tel'
									onChange={(event) => setPhone(event.target.value)}
								/>
							</Field>
							<Field className='sm:col-span-2'>
								<FieldLabel>{t('profile.addressLine')}</FieldLabel>
								<Input value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel>{t('profile.postalCode')}</FieldLabel>
								<Input
									value={postalCode}
									inputMode='numeric'
									onChange={(event) => setPostalCode(event.target.value)}
								/>
							</Field>
						</FieldGroup>
						<p className='text-xs text-muted-foreground'>{t('profile.readOnlyHint')}</p>
						<Button type='submit' disabled={save.isPending}>
							{t('profile.save')}
						</Button>
					</form>
				</CardContent>
			</Card>

			<AccountSecurityCard />
		</div>
	);
}




export const Route = createFileRoute('/_authed/profile')({
	component: ProfilePage,
});







