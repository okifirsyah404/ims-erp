import {
	CalendarCheck,
	CalendarClock,
	CalendarOff,
	ClipboardList,
	FileText,
	FolderKanban,
	House,
	Timer,
	PenLine,
	Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavKey } from '@ims-erp/locales';

/**
 * Portal navigation, shaped like web-admin's `navSections`.
 *
 * @remarks
 * Same `{ labelKey, items }` structure and the same `SidebarGroup` rendering, so
 * the rail reads identically in both apps. Differences are content only: no
 * permission flags (the portal guard already proved an employee record) and no
 * notifications entry (the header bell is the inbox).
 *
 * `phase` keeps a destination hidden until its page exists: a rail entry with no
 * route is a 404 waiting to be clicked.
 */
export type TPortalNavItem = {
	titleKey: NavKey;
	url: string;
	icon?: LucideIcon;
	/** Rendered in the mobile bottom bar. */
	mobile?: boolean;
	phase: 'a' | 'b' | 'c';
};

export type TPortalNavSection = {
	labelKey: NavKey;
	items: TPortalNavItem[];
};

/** Phases whose pages exist in this build. */
const SHIPPED: TPortalNavItem['phase'][] = ['a', 'b', 'c'];

export const portalNavSections: TPortalNavSection[] = [
	{
		labelKey: 'section.dashboard',
		items: [
			{ titleKey: 'item.dashboard', url: '/', icon: House, mobile: true, phase: 'a' },
		],
	},
	{
		labelKey: 'section.hr',
		items: [
			{ titleKey: 'item.attendance', url: '/attendance', icon: CalendarCheck, mobile: true, phase: 'a' },
			{ titleKey: 'item.schedule', url: '/schedule', icon: CalendarClock, phase: 'a' },
			{ titleKey: 'item.leave', url: '/leave', icon: CalendarOff, mobile: true, phase: 'a' },
			{ titleKey: 'item.overtime', url: '/overtime', icon: Timer, phase: 'a' },
			{ titleKey: 'item.hrTasks', url: '/tasks', icon: ClipboardList, mobile: true, phase: 'a' },
		],
	},
	{
		labelKey: 'section.projects',
		items: [
			{ titleKey: 'item.projects', url: '/projects', icon: FolderKanban, phase: 'b' },
		],
	},
	{
		labelKey: 'section.documents',
		items: [
			{ titleKey: 'item.files', url: '/documents', icon: FileText, phase: 'c' },
			{ titleKey: 'item.signatures', url: '/signature', icon: PenLine, phase: 'c' },
		],
	},
	{
		labelKey: 'section.account',
		items: [
			// Payroll only: the employee's own profile is reached from the
			// account menu in the header (`NavUser`), not from the rail.
			{ titleKey: 'item.payroll', url: '/payslips', icon: Wallet, phase: 'c' },
		],
	},
];

/** The destinations the current build serves (empty sections dropped). */
export const liveNavSections: TPortalNavSection[] = portalNavSections
	.map((section) => ({
		...section,
		items: section.items.filter((item) => SHIPPED.includes(item.phase)),
	}))
	.filter((section) => section.items.length > 0);

/** Flat list, for the mobile bar and the route guard. */
export const liveNavItems: TPortalNavItem[] = liveNavSections.flatMap((section) => section.items);


