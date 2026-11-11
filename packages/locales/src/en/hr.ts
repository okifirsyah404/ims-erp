/** HR employee feature (ERP-0034) — admin UI strings (flat dotted keys). */
const hr = {
	'list.title': 'Employees',
	'list.description':
		'Your organization’s employees plus company-level staff. Creating an employee sends them an invitation email.',
	'list.new': 'New employee',
	'list.searchPlaceholder': 'Search name, code, or email…',
	'list.filterAllStatuses': 'All statuses',
	'list.emptyTitle': 'No employees yet',
	'list.empty': 'Invite your first employee to get started.',
	'list.companyLevel': 'Company-level',
	'list.archived': 'Employee archived',
	'list.archive': 'Archive',

	'status.active': 'Active',
	'status.inactive': 'Inactive',
	'status.terminated': 'Terminated',

	'employmentType.permanent': 'Permanent',
	'employmentType.contract': 'Contract',
	'employmentType.probation': 'Probation',
	'employmentType.internship': 'Internship',
	'employmentType.outsourced': 'Outsourced',

	'workType.onsite': 'Onsite',
	'workType.remote': 'Remote',
	'workType.hybrid': 'Hybrid',

	'form.newEmployee': 'New employee',
	'form.newEmployeeDescription':
		'One step creates the employee record and emails an invitation to claim the login.',
	'form.identity': 'Identity',
	'form.fullName': 'Full name',
	'form.email': 'Login email',
	'form.emailHint':
		'The invitation link is sent to this address; it becomes the employee’s login.',
	'form.phone': 'Phone',
	'form.nationalId': 'National ID (NIK)',
	'form.employmentType': 'Employment type',
	'form.workType': 'Work type',
	'form.hireDate': 'Hire date',
	'form.employeeCode': 'Employee code',
	'form.inviteAndCreate': 'Invite & create',
	'form.cancel': 'Cancel',
	'form.created': 'Employee {{code}} created; the invitation email is on its way',

	'detail.details': 'Details',
	'detail.notFound': 'Employee not found',
} as const;

export default hr;
