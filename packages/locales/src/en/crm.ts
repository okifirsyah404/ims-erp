/**
 * CRM: customers and contacts (ADR-0011 port step 3a). Leads follow.
 */
const crm = {
	'customers.title': 'Customers',
	'customers.description': 'Customers are shared by the whole company. Inactive customers cannot be used on new documents.',
	'customers.new': 'New customer',
	'customers.edit': 'Edit customer',
	'customers.search': 'Search name or code…',
	'customers.empty': 'No customers yet.',
	'customers.noResults': 'No customers match the filter.',
	'customers.notFound': 'Customer not found.',
	'customers.back': 'Back to customers',
	'customers.filterAll': 'All statuses',
	'customers.saved': 'Customer saved',
	'customers.deactivate': 'Deactivate',
	'customers.activate': 'Activate',
	'customers.deactivated': 'Customer deactivated',
	'customers.activated': 'Customer activated',
	'customers.details': 'Details',

	'customer.code': 'Code',
	'customer.codeHint': 'Letters, digits and . _ - /; stored in upper case.',
	'customer.name': 'Name',
	'customer.legalName': 'Legal name',
	'customer.customerType': 'Type',
	'customer.taxId': 'Tax ID (NPWP)',
	'customer.taxIdHint': '15 or 16 digits; dots and dashes are ignored.',
	'customer.email': 'Email',
	'customer.phone': 'Phone',
	'customer.whatsapp': 'WhatsApp',
	'customer.address': 'Address',
	'customer.postalCode': 'Postal code',
	'customer.notes': 'Notes',
	'customer.status': 'Status',

	'customerType.individual': 'Individual',
	'customerType.company': 'Company',
	'customerType.government': 'Government',
	'customerType.partner': 'Partner',

	'customerStatus.active': 'Active',
	'customerStatus.inactive': 'Inactive',

	'contacts.title': 'Contacts',
	'contacts.add': 'Add contact',
	'contacts.edit': 'Edit contact',
	'contacts.empty': 'No contacts yet.',
	'contacts.name': 'Name',
	'contacts.position': 'Position',
	'contacts.isPrimary': 'Primary contact',
	'contacts.primary': 'Primary',
	'contacts.saved': 'Contact saved',
	'contacts.remove': 'Remove',
	'contacts.removeConfirm': 'Remove the contact {{name}}?',
	'contacts.removed': 'Contact removed',
} as const;

export default crm;
