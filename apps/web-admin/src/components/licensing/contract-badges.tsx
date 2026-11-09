import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import { CONTRACT_STATUS_VARIANT, type TLicenseContract } from '@/lib/license-api';

/** Status, plus how long an active contract has left, its grace period, or that it has expired. */
export function ContractBadges({ contract }: { contract: TLicenseContract }) {
	const { t, i18n } = useTranslation('licensing');
	const { status, daysLeft, isExpired, isDue, graceEndsOn } = contract;
	const today = todayBusinessDate();
	return (
		<span className='inline-flex flex-wrap gap-1'>
			<Badge variant={CONTRACT_STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
			{status === 'active' && daysLeft === null && <Badge variant='outline'>{t('timing.perpetual')}</Badge>}
			{isExpired && graceEndsOn && today <= graceEndsOn && <Badge variant='secondary'>{t('timing.grace', { date: formatBusinessDate(graceEndsOn, i18n.language) })}</Badge>}
			{isExpired && (!graceEndsOn || today > graceEndsOn) && <Badge variant='destructive'>{t('timing.expired')}</Badge>}
			{isDue && !isExpired && daysLeft !== null && (
				<Badge variant='secondary'>{daysLeft === 0 ? t('timing.endsToday') : t('timing.daysLeft', { count: daysLeft })}</Badge>
			)}
		</span>
	);
}
