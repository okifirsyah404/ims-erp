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
	'template.crm.companyChangeRequested.title': '{{customerName}} asked to change company data',
	'template.crm.companyChangeRequested.body':
		'{{requestedBy}} asked to change {{fields}} of {{customerName}} in the customer portal. Review it on the customer page.',
	'template.sales.invoiceIssued.title': 'Invoice {{invoiceNumber}} issued',
	'template.sales.invoiceIssued.body':
		'Invoice {{invoiceNumber}} for {{customerName}} was issued for {{amount}}.',
	'template.aftersales.ticketOpened.title': 'New ticket {{ticketNumber}} from {{customerName}}',
	'template.aftersales.ticketOpened.body': '{{customerName}} opened {{ticketNumber}} in the customer portal: {{subject}}',
	'template.aftersales.customerReplied.title': '{{author}} replied on {{ticketNumber}}',
	'template.aftersales.customerReplied.body': '{{author}} ({{customerName}}) wrote on ticket {{ticketNumber}}: {{message}}',
	'template.aftersales.ticketConfirmed.title': '{{customerName}} confirmed the fix of {{ticketNumber}}',
	'template.aftersales.ticketConfirmed.body': '{{confirmedBy}} confirmed in the customer portal that ticket {{ticketNumber}} is fixed. The ticket is closed.',
	'template.sales.onlineOrderReceived.title': 'Online order {{quotationNumber}} from {{customerName}}',
	'template.sales.onlineOrderReceived.body':
		'{{customerName}} ordered online ({{amount}}). Review and submit draft SPH {{quotationNumber}}.',
	'template.sales.quotationAccepted.title': '{{customerName}} accepted {{quotationNumber}}',
	'template.sales.quotationAccepted.body':
		'{{customerName}} accepted {{quotationNumber}} in the customer portal. Sales order {{orderNumber}} was created.',
	'template.sales.quotationRevisionRequested.title': '{{customerName}} asked to revise {{quotationNumber}}',
	'template.sales.quotationRevisionRequested.body': '{{customerName}} asked to revise {{quotationNumber}}: {{message}}',
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
} as const;

export default notifications;
