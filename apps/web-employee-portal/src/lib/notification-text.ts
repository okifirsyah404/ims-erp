import type { TFunction } from 'i18next';
import type { TNotification } from './notification-api';

/**
 * Localized copy for a notification (ADR-0016 decision 4).
 *
 * @remarks
 * The server stores an English `title`/`body` as the fallback; the client
 * renders localized copy from `templateCode` + `variables`, so an Indonesian
 * user never reads an English sentence. Each code is spelled out with a literal
 * key and a literal options object, which is what keeps `t()`'s interpolation
 * checking on: a template that gains a `{{placeholder}}` fails to compile here
 * until the producer's variable is passed. Key names are camelCase rather than
 * the code's snake_case because i18next's typed keys read `_` as a plural
 * suffix.
 *
 * A code with no case — a newer backend, or the seeded demo rows — falls back
 * to the stored text instead of rendering a raw key.
 */
export function notificationText(
	t: TFunction<'notifications'>,
	notification: TNotification,
): { title: string; body: string | null } {
	const variables = notification.variables ?? {};
	const fallback = { title: notification.title, body: notification.body };

	switch (notification.templateCode) {
		case 'org.member_added':
			return {
				title: t('template.org.memberAdded.title', {
					organizationName: variables.organizationName ?? '',
				}),
				body: t('template.org.memberAdded.body', {
					organizationName: variables.organizationName ?? '',
					role: variables.role ?? '',
				}),
			};
		case 'org.org_created':
			return {
				title: t('template.org.orgCreated.title', {
					organizationName: variables.organizationName ?? '',
				}),
				body: t('template.org.orgCreated.body', {
					organizationName: variables.organizationName ?? '',
				}),
			};
		case 'sales.invoice_issued':
			return {
				title: t('template.sales.invoiceIssued.title', {
					invoiceNumber: variables.invoiceNumber ?? '',
				}),
				body: t('template.sales.invoiceIssued.body', {
					invoiceNumber: variables.invoiceNumber ?? '',
					customerName: variables.customerName ?? '',
					amount: variables.amount ?? '',
				}),
			};
		case 'document.signature_requested':
			return {
				title: t('template.document.signatureRequested.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureRequested.body', {
					requesterName: variables.requesterName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		case 'document.signature_signed':
			return {
				title: t('template.document.signatureSigned.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureSigned.body', {
					signerName: variables.signerName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		case 'document.signature_declined':
			return {
				title: t('template.document.signatureDeclined.title', {
					documentName: variables.documentName ?? '',
				}),
				body: t('template.document.signatureDeclined.body', {
					signerName: variables.signerName ?? '',
					documentName: variables.documentName ?? '',
				}),
			};
		case 'hr.payslip_ready':
			return {
				title: t('template.hr.payslipReady.title', { period: variables.period ?? '' }),
				body: t('template.hr.payslipReady.body', { period: variables.period ?? '' }),
			};
		case 'hr.payroll_draft_ready':
			return {
				title: t('template.hr.payrollDraftReady.title', { period: variables.period ?? '' }),
				body: t('template.hr.payrollDraftReady.body', {
					period: variables.period ?? '',
					records: variables.records ?? '',
				}),
			};
		case 'hr.task_assigned':
			return {
				title: t('template.hr.taskAssigned.title', {
					title: variables.title ?? '',
				}),
				body: t('template.hr.taskAssigned.body', {
					title: variables.title ?? '',
					dueDate: variables.dueDate ?? '',
				}),
			};
		case 'hr.leave_decided':
			return {
				title: t('template.hr.leaveDecided.title', {
					requestType: variables.requestType ?? '',
					decision: variables.decision ?? '',
				}),
				body: t('template.hr.leaveDecided.body', {
					requestType: variables.requestType ?? '',
					period: variables.period ?? '',
					decision: variables.decision ?? '',
				}),
			};
		case 'project.attendance_recorded':
			return {
				title: t('template.project.attendanceRecorded.title', {
					projectName: variables.projectName ?? '',
				}),
				body: t('template.project.attendanceRecorded.body', {
					employeeName: variables.employeeName ?? '',
					projectName: variables.projectName ?? '',
					checkedAt: variables.checkedAt ?? '',
				}),
			};
		default:
			return fallback;
	}
}
