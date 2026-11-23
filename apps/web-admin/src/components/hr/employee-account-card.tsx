import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { formatBusinessDate, formatDateTime } from '@/lib/format';
import type { TEmployee } from '@/lib/hr-api';

type TMaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

/**
 * The login (`auth.users`) behind an employee, on the employee page: who it
 * is, how it signs in, its state, plus the personal fields that live on the
 * user (gender, birth data, marital status — ERP-0034). Read-only: the
 * account itself is managed in Administration → Users.
 */
export function EmployeeAccountCard({ employee }: { employee: TEmployee }) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const account = employee.account ?? null;

	const personal: Array<[string, string | null]> = [
		[t('hr:account.gender'), employee.gender ? t(`hr:account.genderOption.${employee.gender}`) : null],
		[t('hr:account.birthPlace'), employee.birthPlace],
		[t('hr:account.birthDate'), employee.birthDate ? formatBusinessDate(employee.birthDate.slice(0, 10), i18n.language) : null],
		[t('hr:account.maritalStatus'), employee.maritalStatus ? t(`hr:account.maritalOption.${employee.maritalStatus as TMaritalStatus}`) : null],
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('hr:account.title')}</CardTitle>
				<CardDescription>{account ? t('hr:account.description') : t('hr:account.none')}</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4 text-sm'>
				{account && (
					<>
						<div className='flex items-center gap-3'>
							<Avatar className='size-12'>
								{account.image && <AvatarImage src={account.image} alt='' />}
								<AvatarFallback>{account.name.slice(0, 2).toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className='min-w-0'>
								<div className='font-medium'>{account.name}</div>
								<div className='truncate text-muted-foreground'>{account.username ? `@${account.displayUsername ?? account.username}` : '—'}</div>
							</div>
							<div className='ml-auto flex flex-wrap justify-end gap-1'>
								<Badge variant={account.status === 'active' ? 'default' : 'secondary'}>{t(`hr:account.status.${account.status}`)}</Badge>
								{account.banned && <Badge variant='destructive'>{t('hr:account.banned')}</Badge>}
							</div>
						</div>
						<dl className='grid grid-cols-[150px_1fr] gap-x-2 gap-y-2'>
							<dt className='text-muted-foreground'>{t('hr:account.email')}</dt>
							<dd className='flex flex-wrap items-center gap-2'>
								{account.email}
								<Badge variant={account.emailVerified ? 'outline' : 'secondary'}>
									{account.emailVerified ? t('hr:account.verified') : t('hr:account.unverified')}
								</Badge>
							</dd>
							<dt className='text-muted-foreground'>{t('hr:account.phone')}</dt>
							<dd>{account.phone ?? '—'}</dd>
							<dt className='text-muted-foreground'>{t('hr:account.appRole')}</dt>
							<dd>{account.role ?? '—'}</dd>
							{account.banned && (
								<>
									<dt className='text-muted-foreground'>{t('hr:account.banReason')}</dt>
									<dd>
										{account.banReason ?? '—'}
										{account.banExpires && ` · ${t('hr:account.banUntil', { date: formatDateTime(account.banExpires, i18n.language) })}`}
									</dd>
								</>
							)}
							<dt className='text-muted-foreground'>{t('hr:account.claimedAt')}</dt>
							<dd>{account.claimedAt ? formatDateTime(account.claimedAt, i18n.language) : t('hr:account.notClaimed')}</dd>
							<dt className='text-muted-foreground'>{t('hr:account.createdAt')}</dt>
							<dd>{formatDateTime(account.createdAt, i18n.language)}</dd>
							<dt className='text-muted-foreground'>{t('hr:account.updatedAt')}</dt>
							<dd>{formatDateTime(account.updatedAt, i18n.language)}</dd>
							{account.bio && (
								<>
									<dt className='text-muted-foreground'>{t('hr:account.bio')}</dt>
									<dd className='whitespace-pre-line'>{account.bio}</dd>
								</>
							)}
						</dl>
					</>
				)}
				<div>
					<div className='mb-2 font-medium'>{t('hr:account.personal')}</div>
					<dl className='grid grid-cols-[150px_1fr] gap-x-2 gap-y-2'>
						{personal.map(([label, value]) => (
							<div key={label} className='contents'>
								<dt className='text-muted-foreground'>{label}</dt>
								<dd>{value || '—'}</dd>
							</div>
						))}
					</dl>
				</div>
			</CardContent>
		</Card>
	);
}
