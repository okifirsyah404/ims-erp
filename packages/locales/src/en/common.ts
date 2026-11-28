/**
 * Shared, cross-feature UI copy. English is the source of truth; `id` mirrors
 * this key set exactly (enforced by `locale-parity.test.ts`).
 *
 * Keys are flat and dot-notated: `{feature}.{context}.{action|status}`.
 */
const common = {
	// Suffix of an optional form field label: "Phone (Optional)" (ERP-0114).
	'form.optional': 'Optional',
	// Shared form parts (P7-6, RF-6, RF-16, RF-19, RF-27).
	'form.requiredLegend': 'required',
	'form.requiredMark': 'required',
	'form.errorSummary': '{{count}} field(s) need fixing',
	'form.serverError':
		'Something went wrong on the server (ref: {{ref}}). Try again or report this number to the administrator.',
	'form.networkError': 'Could not save. Check your connection and try again.',
	// Field messages with the field label (pattern 4.5), composed from the shared key.
	'formError.required': '{{label}} is required.',
	'formError.invalidFormat': '{{label}} is not valid.',
	'formError.invalidFormatExample': '{{label}} is not valid. Example: {{example}}.',
	'formError.min': '{{label}} must be at least {{min}}.',
	'formError.max': '{{label}} must be at most {{max}}.',
	'formError.minLength': '{{label}} needs at least {{min}} characters.',
	'formError.maxLength': '{{label}} can have at most {{max}} characters.',
	'formError.notNegative': '{{label}} cannot be negative.',
	'formError.notPast': '{{label}} cannot be in the past.',
	'formError.dateOrder': '{{label}} cannot be before {{other}}.',
	'formError.taken': '{{label}} {{value}} is already used. Use another one.',
	'formError.exceedsRemaining': '{{label}} exceeds the remaining {{remaining}}.',
	'formError.emptyTable': 'Add at least one {{label}}.',
	'formError.contactRequired': 'Fill in at least one contact: phone, WhatsApp, or email.',
	'formError.unknownField': '{{label}} is not a known field.',
	'action.cancel': 'Cancel',
	'cardMenu.label': 'Actions',
	'cardMenu.stockAdjustment': 'Stock adjustment',
	'cardMenu.archive': 'Archive',
	'cardMenu.activate': 'Activate',
	'cardMenu.delete': 'Delete',
	'cardMenu.archiveTitle': 'Archive "{{name}}"?',
	'cardMenu.archiveBody':
		'It is marked inactive: it stays in the list with an inactive badge and is no longer offered for new documents. You can activate it again at any time.',
	'cardMenu.deleteTitle': 'Delete "{{name}}"?',
	'cardMenu.deleteBody':
		'It is removed from the list. Records that already use it keep their history. This cannot be undone from this screen.',
	'cardMenu.reasonPlaceholder': 'Reason (required)',
	'action.confirm': 'Confirm',
	'action.save': 'Save',
	'action.saving': 'Saving…',
	'action.delete': 'Delete',
	'action.edit': 'Edit',
	'action.search': 'Search',
	'action.restore': 'Restore',
	'action.previous': 'Previous',
	'action.next': 'Next',
	'action.actions': 'Actions',
	'action.download': 'Download',

	'state.loading': 'Loading…',
	'state.noResults': 'No results',

	'status.active': 'Active',
	'status.inactive': 'Inactive',
	'status.pending': 'Pending',
	'status.deactivated': 'Deactivated',
	'status.deleted': 'Deleted',
	'status.enabled': 'Enabled',
	'status.disabled': 'Disabled',

	'pagination.summary': 'Page {{page}} of {{totalPages}}',
	'pagination.goto': 'Go to page {{page}}',

	'error.generic': 'Something went wrong',
	'error.failed': 'Failed',
	'error.network': 'Cannot reach the server. Check your connection and try again.',

	'notFound.title': '404 — Page not found',
	'notFound.description':
		"The page you're looking for doesn't exist or has been moved.",
	'notFound.backToDashboard': 'Back to dashboard',

	'breadcrumb.home': 'Home',

	'language.label': 'Language',
	/**
	 * Screen-reader labels for the switcher buttons. The buttons themselves
	 * show the short code (`EN`/`ID`), so these are what assistive tech reads;
	 * each one names its own language, in that language.
	 */
	'language.switchToEnglish': 'English',
	'language.switchToIndonesian': 'Bahasa Indonesia',
	'image.none': 'No image',
	'image.remove': 'Remove image',
	'image.drop': 'Drop an image here, or click to pick one',
	'image.choose': 'Choose image',
	'image.replace': 'Replace image',
	'image.converting': 'Converting.',
	'image.wrongType': 'That file is not an image.',
	'image.sourceTooLarge': 'The image is larger than 20 MB.',
	'image.hint': 'PNG, JPG or WebP, at most 2 MB. Converted to WebP before upload.',
	'image.tooLarge': 'The image is larger than 2 MB.',
	'gallery.cover': 'Cover',
	'gallery.pending': 'Not saved yet',
	'gallery.add': 'Add images',
	'gallery.caption': 'Caption',
	'gallery.moveEarlier': 'Move earlier',
	'gallery.moveLater': 'Move later',
	'gallery.limit': 'You can add at most {{max}} images.',
	'gallery.hint': 'Up to {{max}} images, PNG, JPG or WebP. The first image is the cover. New images upload when you save.',
} as const;

export default common;
