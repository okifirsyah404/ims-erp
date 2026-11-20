import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { customerAddressesQueryOptions } from '@/lib/customer-address-api';

/**
 * A customer's addresses (ERP-0075), read-only: installation sites are kept
 * by the customer in the portal; staff see them here.
 */
export function CustomerAddressesCard({ customerId }: { customerId: string }) {
	const { t } = useTranslation(['crm', 'common']);
	const { data, isPending, isError, error } = useQuery(customerAddressesQueryOptions(customerId));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('crm:addresses.title')}</CardTitle>
				<CardDescription>{t('crm:addresses.description')}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{isPending ? (
					<p className='text-muted-foreground'>{t('common:state.loading')}</p>
				) : isError ? (
					<p className='text-destructive'>{error.message}</p>
				) : data.length === 0 ? (
					<p className='text-muted-foreground'>{t('crm:addresses.empty')}</p>
				) : (
					data.map((address) => (
						<div key={address.id} className='flex flex-col gap-1 rounded-md border p-3'>
							<div className='flex flex-wrap items-center gap-2 font-medium'>
								{address.label || '—'}
								<Badge variant='outline'>{t(`crm:addresses.kind.${address.kind}`)}</Badge>
								{address.isPrimary && <Badge variant='secondary'>{t('crm:contacts.primary')}</Badge>}
							</div>
							<div className='text-muted-foreground'>{address.addressLine || '—'}</div>
							{(address.contactName || address.contactPhone) && (
								<div className='text-muted-foreground'>
									{t('crm:addresses.pic')}: {[address.contactName, address.contactPhone].filter(Boolean).join(' · ')}
								</div>
							)}
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
