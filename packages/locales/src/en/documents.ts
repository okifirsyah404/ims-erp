/**
 * Document registry copy (`/documents`).
 *
 * @remarks
 * English is the source of truth; `id` mirrors this key set exactly.
 */
const documents = {
	'title': 'Documents',
	'description':
		'Every issued document with its number, type and status. Business records stay in their own module; this registry holds the issued copy.',
	'entries': 'Issued documents',
	'count': '{{count}} documents',
	'empty': 'No documents yet.',
	'noPermission': 'You do not have permission to see documents.',
	'search': 'Search',
	'searchPlaceholder': 'Number or title',
	'code': 'Number',
	'type': 'Type',
	'documentTitle': 'Title',
	'issuedOn': 'Issued on',
	'status': 'Status',
	'allStatuses': 'All statuses',
	'void': 'Void',
	'voided': 'Document voided',
	'status.draft': 'Draft',
	'status.issued': 'Issued',
	'status.void': 'Void',
	'status.archived': 'Archived',
};

export default documents;
