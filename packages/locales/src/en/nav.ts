/**
 * Sidebar / shell navigation copy. Route-level breadcrumb labels live here
 * too, because `build-crumbs.ts` resolves them from the same vocabulary.
 */
const nav = {
	'section.inventory': 'Inventory',
	'section.administration': 'Administration',
	'section.platform': 'Platform',

	'item.warehouses': 'Warehouses',
	'item.stock': 'Stock',
	'item.items': 'Items',
	'item.products': 'Products',
	'item.components': 'Components',
	'item.materials': 'Materials',
	'item.tools': 'Tools',
	'item.newItem': 'New item',
	'item.itemMovements': 'Item Movements',
	'item.organizations': 'Organization',
	'item.users': 'Users',
	'item.auditLog': 'Audit Log',
	'item.settings': 'Settings',

	'theme.label': 'Theme',
	'theme.light': 'Light theme',
	'theme.dark': 'Dark theme',
	'theme.system': 'System theme',

	'organization.manage': 'Manage',
	'organization.new': 'New organization',
	'organization.none': 'No organization',
	'organization.setUp': 'Set up your organization',
	'organization.required': 'Select an organization to continue.',
	'organization.switchFailed': 'Could not switch organization',
	'organization.switched': 'Organization switched',

	'user.loadingAccount': 'Loading account…',
	'user.account': 'Account',
	'user.notifications': 'Notifications',
	'user.logOut': 'Log out',

	'project.projects': 'Projects',
	'project.view': 'View Project',
	'project.share': 'Share Project',
	'project.delete': 'Delete Project',
	'project.more': 'More',

	'breadcrumb.home': 'Home',
	'breadcrumb.organizations': 'Organizations',
	'breadcrumb.organizationNew': 'New organization',
	'breadcrumb.organizationEdit': 'Edit',
	'breadcrumb.memberNew': 'Add member',
	'breadcrumb.memberEdit': 'Edit member',
} as const;

export default nav;
