/** In-app notification bell and template copy (ERP-0047). */
const notifications = {
	'title': 'Notifications',
	'unreadLabel': 'Notifications, {{count}} unread',
	'markAllRead': 'Mark all as read',
	'empty': 'No notifications yet',
	'loadFailed': 'Could not load notifications',
	'offline': 'Live updates unavailable',

	// Rendered from `templateCode` + `variables`; the server's stored English
	// copy is only the fallback for a code this bundle does not know. Key names
	// are camelCase, not the code's snake_case: i18next's typed keys treat `_`
	// as a plural suffix and would reject `template.org.member_added.title`.
	'template.org.memberAdded.title': 'You joined {{organizationName}}',
	'template.org.memberAdded.body':
		'You were added to {{organizationName}} as {{role}}.',
	'template.org.orgCreated.title': '{{organizationName}} is ready',
	'template.org.orgCreated.body':
		'You created {{organizationName}}. Invite your team to get started.',
	'template.sales.invoiceIssued.title': 'Invoice {{invoiceNumber}} issued',
	'template.sales.invoiceIssued.body':
		'Invoice {{invoiceNumber}} for {{customerName}} was issued for {{amount}}.',
	'template.document.signatureRequested.title':
		'Signature requested: {{documentName}}',
	'template.document.signatureRequested.body':
		'{{requesterName}} requested your signature on {{documentName}}.',
	'template.document.signatureSigned.title': 'Document signed: {{documentName}}',
	'template.document.signatureSigned.body': '{{signerName}} signed {{documentName}}.',
	'template.document.signatureDeclined.title':
		'Signature declined: {{documentName}}',
	'template.document.signatureDeclined.body':
		'{{signerName}} declined to sign {{documentName}}.',
	'template.hr.taskAssigned.title': 'New task: {{title}}',
	'template.hr.taskAssigned.body':
		'You were given the task {{title}} due {{dueDate}}.',
	'template.hr.leaveDecided.title':
		'Your {{requestType}} request was {{decision}}',
	'template.hr.leaveDecided.body':
		'Your {{requestType}} request for {{period}} was {{decision}}.',
	'template.project.attendanceRecorded.title':
		'Attendance recorded on {{projectName}}',
	'template.project.attendanceRecorded.body':
		'{{employeeName}} checked in on {{projectName}} at {{checkedAt}}.',
	'template.hr.payrollDraftReady.title': 'Payroll {{period}} is ready for approval',
	'template.hr.payrollDraftReady.body': 'The payday run created {{records}} draft salary record(s) for {{period}}.',
	'template.hr.payslipReady.title': 'Your payslip for {{period}} is ready',
	'template.hr.payslipReady.body': 'Your payslip for {{period}} can be downloaded from your account page.',
} as const;

export default notifications;
