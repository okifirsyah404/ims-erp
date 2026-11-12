/**
 * Shared, cross-feature UI copy. English is the source of truth; `id` mirrors
 * this key set exactly (enforced by `locale-parity.test.ts`).
 *
 * Keys are flat and dot-notated: `{feature}.{context}.{action|status}`.
 */
const common = {
	'action.cancel': 'Cancel',
	'action.save': 'Save',
	'action.saving': 'Saving…',
	'action.delete': 'Delete',
	'action.edit': 'Edit',
	'action.search': 'Search',
	'action.restore': 'Restore',
	'action.previous': 'Previous',
	'action.next': 'Next',

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
	'image.hint': 'PNG, JPG or WebP, at most 2 MB.',
	'image.tooLarge': 'The image is larger than 2 MB.',
} as const;

export default common;
