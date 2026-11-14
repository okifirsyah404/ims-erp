import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import type { TRequestStatus } from '@/lib/hr-records-api';

/**
 * Approve / reject / cancel buttons of a leave or overtime row. Whoever
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
	return (
		<span className='inline-flex flex-wrap items-center justify-end gap-1'>
			{open && recordedByMe && (canApprove || canReject) && (
				<span className='text-xs text-muted-foreground'>{t('request.recordedByYou')}</span>
			)}
			{open && !recordedByMe && canApprove && (
				<Button size='sm' disabled={busy} onClick={() => onAction('approve')}>
					{t('request.approve')}
				</Button>
			)}
			{open && !recordedByMe && canReject && (
				<Button size='sm' variant='outline' disabled={busy} onClick={() => onAction('reject')}>
					{t('request.reject')}
				</Button>
			)}
			{(open || status === 'approved') && canCancel && (
				<Button size='sm' variant='ghost' disabled={busy} onClick={() => onAction('cancel')}>
					{t('request.cancel')}
				</Button>
			)}
		</span>
	);
}
