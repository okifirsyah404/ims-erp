import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { CONTRACT_STATUS_VARIANT, type TLicenseContract } from '@/lib/license-api';

/** Status, plus how long an active contract has left (or that it has expired). */
export function ContractBadges({ contract }: { contract: TLicenseContract }) {
	const { t } = useTranslation('licensing');
	const { status, daysLeft, isExpired, isDue } = contract;
	return (
		<span className='inline-flex flex-wrap gap-1'>
			<Badge variant={CONTRACT_STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
			{status === 'active' && daysLeft === null && <Badge variant='outline'>{t('timing.perpetual')}</Badge>}
			{isExpired && <Badge variant='destructive'>{t('timing.expired')}</Badge>}
			{isDue && !isExpired && daysLeft !== null && (
				<Badge variant='secondary'>{daysLeft === 0 ? t('timing.endsToday') : t('timing.daysLeft', { count: daysLeft })}</Badge>
			)}
		</span>
	);
}
