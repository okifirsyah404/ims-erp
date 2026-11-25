import type { TFunction } from 'i18next';
import type { TRequestStatus } from '@/lib/portal-api';

/** Badge variant per request status; shared by the leave and overtime screens. */
export const REQUEST_STATUS_VARIANT: Record<
	TRequestStatus,
	'default' | 'secondary' | 'destructive' | 'outline'
> = {
	submitted: 'secondary',
	approved: 'default',
	rejected: 'destructive',
	cancelled: 'outline',
};

/**
 * Labels for the server vocabularies the portal renders.
 *
 * @remarks
 * Statuses and sources arrive as values (`present`, `self`, ...), so the key is
 * composed from the value. Spelling every branch out here keeps the composed
 * keys in one greppable place - the locale dead-key scan treats these prefixes
 * as live and would otherwise call the whole `attendance.*` block dead copy.
 */
export function attendanceSourceLabel(t: TFunction<'employee'>, source: string): string {
	switch (source) {
		case 'manual':
			return t('attendance.source.manual');
		case 'import':
			return t('attendance.source.import');
		case 'leave':
			return t('attendance.source.leave');
		case 'self':
			return t('attendance.source.self');
		default:
			return source;
	}
}

export function attendanceStatusLabel(t: TFunction<'employee'>, status: string): string {
	switch (status) {
		case 'present':
			return t('attendance.month.present');
		case 'permit':
			return t('attendance.month.permit');
		case 'sick':
			return t('attendance.month.sick');
		case 'leave':
			return t('attendance.month.leave');
		case 'absent':
			return t('attendance.month.absent');
		case 'holiday':
			return t('attendance.month.holiday');
		default:
			return status;
	}
}

export function taskStatusLabel(t: TFunction<'employee'>, status: string): string {
	switch (status) {
		case 'open':
			return t('tasks.status.open');
		case 'done':
			return t('tasks.status.done');
		case 'cancelled':
			return t('tasks.status.cancelled');
		default:
			return status;
	}
}

export function requestStatusLabel(t: TFunction<'employee'>, status: string): string {
	switch (status) {
		case 'submitted':
			return t('leave.status.submitted');
		case 'approved':
			return t('leave.status.approved');
		case 'rejected':
			return t('leave.status.rejected');
		case 'cancelled':
			return t('leave.status.cancelled');
		default:
			return status;
	}
}
