import { Ban, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RowActions } from '@/components/data-table/row-actions';
import type { TRequestStatus } from '@/lib/hr-records-api';

/**
 * Approve / reject / cancel actions of a leave or overtime row. Whoever
 * recorded the request cannot approve or reject it (the server refuses too).
 */
export function RequestActions({
	status,
	recordedByMe,
	canApprove,
	canReject,
	canCancel,
	busy,
	onAction,
}: {
	status: TRequestStatus;
	recordedByMe: boolean;
	canApprove: boolean;
	canReject: boolean;
	canCancel: boolean;
	busy: boolean;
	onAction: (action: 'approve' | 'reject' | 'cancel') => void;
}) {
	const { t } = useTranslation('hr');
	const open = status === 'submitted';

	if (open && recordedByMe && (canApprove || canReject)) {
		return (
			<span className='text-xs text-muted-foreground'>
				{t('request.recordedByYou')}
			</span>
		);
	}

	return (
		<RowActions
			label={t('request.actions')}
			disabled={busy}
			actions={[
				{
					key: 'approve',
					label: t('request.approve'),
					icon: Check,
					hidden: !(open && !recordedByMe && canApprove),
					onSelect: () => onAction('approve'),
				},
				{
					key: 'reject',
					label: t('request.reject'),
					icon: X,
					hidden: !(open && !recordedByMe && canReject),
					destructive: true,
					onSelect: () => onAction('reject'),
				},
				{
					key: 'cancel',
					label: t('request.cancel'),
					icon: Ban,
					hidden: !((open || status === 'approved') && canCancel),
					destructive: true,
					onSelect: () => onAction('cancel'),
				},
			]}
		/>
	);
}
