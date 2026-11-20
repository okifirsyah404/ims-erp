/**
 * Maps portal DTOs onto the customer portal's `PortalSource` view types
 * (website repo, `packages/api-client/src/services/portal.ts`, ERP-0022).
 *
 * The portal's ERP adapter passes responses straight to its screens, so the
 * API answers in those shapes: display labels in the caller's language
 * (`Accept-Language`, en/id), dates on the Asia/Jakarta clock. Pure
 * functions, no I/O; business rules stay in the services.
 */
import type { TWishlistEntry } from '@app/commerce/services/account-shop.service';
import type { TPortalRfqView } from '../services/portal-rfq.service';
import type { TNotificationView } from '@app/notification/contracts/notification.contract';
import type { TPortalDocumentEntry, TPortalDocumentFolder, TPortalProfileFacts } from '../services/portal-account-pages.service';
import type { TPortalPreferences } from '@app/user/services/user-preference.service';
import type { TCustomerAddressSelect, TCustomerContactSelect } from '@drizzle/schemas/crm.schema';
import type { TPortalTicket, TPortalTicketDetail } from '@app/aftersales/contracts/service-ticket.contract';
import type { TPortalProject, TPortalProjectDetail } from '@app/projects/services/project-portal.service';
import type { TPortalAccountView } from '@app/user/contracts/portal-account.contract';
import type { PortalContext } from '@authorization/portal-auth';
import { PROJECT_STAGES, type ProjectStage } from '@drizzle/schemas/projects.schema';
import type { TCustomerSelect } from '@drizzle/schemas/crm.schema';
import type { ApiKey } from '@providers/i18n/translator';
import type { LanguageCode } from '@ims-erp/locales';
import type { TPortalDevice } from '../services/portal.service';

export type TPresenter = {
	t: (key: ApiKey, options?: object) => string;
	language: LanguageCode;
	/** Today on the Jakarta business clock (`YYYY-MM-DD`). */
	today: string;
	/** "Now", for relative times. */
	now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const locale = (p: TPresenter) => (p.language === 'id' ? 'id-ID' : 'en-GB');

/** `2026-11-14` or a Date → "14 Nov 2026" / "14 Nov 2026" in the caller's language. */
/**
 * The portal's download path for a document (ERP-0079): the portal server streams it from
 * `GET /portal/v1/documents/:kind/:id/file` with the customer's session, so links work
 * without the ERP's session or storage being reachable from the browser.
 */
export const documentFileUrl = (kind: 'quotation' | 'invoice' | 'warranty' | 'file', id: string) => `/documents/file/${kind}/${id}`;

export function dateLabel(p: TPresenter, value: string | Date | null | undefined): string {
	if (!value) return '';
	// A business date (`YYYY-MM-DD`) is a Jakarta day; a full timestamp (e.g. a cached ISO string) is a moment.
	const date = typeof value === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value) : value;
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat(locale(p), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);
}

/** "3 days ago" / "3 hari yang lalu". */
export function agoLabel(p: TPresenter, value: Date): string {
	const seconds = Math.round((value.getTime() - p.now.getTime()) / 1000);
	const format = new Intl.RelativeTimeFormat(locale(p), { numeric: 'auto' });
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	return format.format(Math.round(seconds / 86400), 'day');
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? '?').slice(0, 2);
	return letters.toUpperCase().slice(0, 4) || '?';
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/* ------------------------------------------------------------------------ *
 * Account
 * ------------------------------------------------------------------------ */

export function portalUser(portal: PortalContext, customer: TCustomerSelect | null) {
	const business = customer ? customer.customerType !== 'individual' : true;
	return {
		id: portal.userId,
		name: portal.user.name,
		initials: initials(portal.user.name),
		email: portal.user.email,
		...(customer?.phone ? { phone: customer.phone } : {}),
		accountType: business ? ('business' as const) : ('individual' as const),
		verified: true,
		...(customer && business
			? {
					company: {
						id: customer.id,
						name: customer.name,
						...(customer.taxId ? { npwp: customer.taxId } : {}),
						shortName: initials(customer.name),
					},
				}
			: {}),
	};
}

/** One login of the customer as the portal's `CompanyMember`. */
export function companyMember(p: TPresenter, account: TPortalAccountView) {
	return {
		id: account.id,
		...(account.user.name ? { name: account.user.name } : {}),
		email: account.user.email,
		initials: initials(account.user.name || account.user.email),
		role: account.role,
		admin: account.role === 'owner',
		status: account.passwordSet ? ('active' as const) : ('invited' as const),
		lastActiveLabel: account.lastLoginAt ? agoLabel(p, account.lastLoginAt) : '',
	};
}

/** The portal's `AccountSettings`; sites, notification channels and security are not stored yet. */
/** What the account page shows besides the customer and members (ERP-0075). */
export type TAccountExtras = {
	contact: TCustomerContactSelect | null;
	sites: TCustomerAddressSelect[];
	preferences: TPortalPreferences | null;
	/** A company change waits for sales' review (ERP-0076): shown as not verified. */
	changePending?: boolean;
	/** Signed-in devices of the login (ERP-0081). */
	deviceCount?: number;
};

export function accountSettings(
	p: TPresenter,
	portal: PortalContext,
	customer: TCustomerSelect | null,
	members: TPortalAccountView[],
	extras: TAccountExtras = { contact: null, sites: [], preferences: null },
) {
	const business = customer ? customer.customerType !== 'individual' : true;
	const { contact, sites, preferences, changePending = false, deviceCount = 1 } = extras;
	return {
		personal: {
			name: portal.user.name,
			email: portal.user.email,
			phone: contact?.phone ?? '',
			...(contact?.position ? { jobTitle: contact.position } : {}),
		},
		...(customer && business
			? {
					company: {
						name: customer.name,
						shortName: initials(customer.name),
						...(customer.taxId ? { npwp: customer.taxId } : {}),
						...(customer.industry ? { industry: customer.industry } : {}),
						verified: !changePending,
					},
				}
			: {}),
		members: members.map((member) => companyMember(p, member)),
		sites: sites.map(companySite),
		notifications: preferences?.notifications ?? { push: false, email: true, whatsapp: false },
		security: { twoStep: preferences?.twoStep ?? false, passwordChangedLabel: '', activeDevices: deviceCount },
		preferences: { language: preferences?.language ?? p.language, currency: 'IDR' as const },
	};
}

/* ------------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------------ */

const stageIndex = (stage: ProjectStage) => PROJECT_STAGES.indexOf(stage);

export function projectSummary(p: TPresenter, project: TPortalProject) {
	const done = project.tasks.filter((task) => task.status === 'done').length;
	const next = project.tasks.find((task) => task.status !== 'done');
	const handedOver = project.status === 'closed' || stageIndex(project.stage) >= stageIndex('handover');
	return {
		id: project.id,
		code: project.code,
		name: project.title,
		site: project.siteName ?? '',
		status: handedOver ? ('handed_over' as const) : ('on_track' as const),
		stage: stageIndex(project.stage) + 1,
		stageCount: PROJECT_STAGES.length,
		stageLabel: p.t(`portal.stage.${project.stage}`),
		progress: project.tasks.length > 0 ? done / project.tasks.length : handedOver ? 1 : 0,
		nextLabel: next ? next.title : p.t('portal.label.allDone'),
		completionLabel: project.closedAt
			? p.t('portal.label.completed', { date: dateLabel(p, project.closedAt) })
			: project.targetEndDate
				? p.t('portal.label.target', { date: dateLabel(p, project.targetEndDate) })
				: p.t('portal.label.noTarget'),
		...(project.manager ? { team: [{ initials: initials(project.manager.name), name: project.manager.name }] } : {}),
	};
}

export function projectDetail(p: TPresenter, project: TPortalProjectDetail) {
	const current = stageIndex(project.stage);
	const milestones = PROJECT_STAGES.map((stage, index) => {
		const tasks = project.tasks.filter((task) => task.stage === stage);
		const tasksDone = tasks.filter((task) => task.status === 'done').length;
		const lastDue = tasks.map((task) => task.dueDate).filter((due): due is string => !!due).sort().pop();
		return {
			title: p.t(`portal.stage.${stage}`),
			dateLabel: dateLabel(p, lastDue),
			state: index < current || project.status === 'closed' ? ('done' as const) : index === current ? ('current' as const) : ('upcoming' as const),
			...(tasks.length > 0 ? { tasks: tasks.map((task) => ({ label: task.title, done: task.status === 'done' })), tasksDone, tasksTotal: tasks.length } : {}),
		};
	});
	return {
		...projectSummary(p, project),
		daysLeft: project.targetEndDate && project.status !== 'closed' ? Math.max(0, daysBetween(p.today, project.targetEndDate)) : 0,
		openTasks: project.tasks.filter((task) => task.status !== 'done').length,
		milestones,
		documents: [
			...project.handovers.map((bast) => ({
				id: bast.id,
				name: p.t('portal.label.bast', { code: bast.code }),
				meta: dateLabel(p, bast.bastDate),
				kind: 'file' as const,
			})),
			...project.files.map((file) => ({
				id: file.id,
				name: file.fileName,
				meta: `${p.t(`portal.evidence.${file.kind as 'testing' | 'training' | 'bast' | 'photo'}`)} · ${dateLabel(p, file.createdAt)}`,
				kind: file.contentType === 'application/pdf' ? ('pdf' as const) : ('file' as const),
				url: documentFileUrl('file', file.id),
			})),
		],
		manager: { name: project.manager?.name ?? '', role: p.t('portal.label.projectManager') },
	};
}

/* ------------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------------ */

/** The portal's ticket states: `awaiting_you` when a staff reply or a fix waits for the customer. */
function ticketStatus(ticket: TPortalTicket) {
	if (ticket.status === 'closed') return 'resolved' as const;
	if (ticket.status === 'resolved') return 'awaiting_you' as const;
	if (ticket.lastMessage?.authorType === 'staff') return 'awaiting_you' as const;
	return ticket.status === 'new' && !ticket.assigneeName ? ('new' as const) : ('in_progress' as const);
}

const subjectOf = (ticket: TPortalTicket) => ticket.complaint.split('\n')[0]!.slice(0, 200);

export function ticketSummary(p: TPresenter, ticket: TPortalTicket) {
	const last = ticket.lastMessage;
	const subject = subjectOf(ticket);
	return {
		id: ticket.id,
		number: ticket.code,
		subject,
		shortSubject: subject.length > 40 ? `${subject.slice(0, 39)}…` : subject,
		status: ticketStatus(ticket),
		priority: 'normal' as const,
		...(last
			? {
					lastMessage: {
						author: last.authorType === 'customer' ? p.t('portal.label.you') : last.authorName,
						role: last.authorType === 'customer' ? p.t('portal.label.you') : p.t('portal.label.support'),
						initials: initials(last.authorName),
						text: last.body.slice(0, 200),
						ago: agoLabel(p, last.createdAt),
						unread: 0,
					},
				}
			: {}),
		...(ticket.closedAt || ticket.resolvedAt ? { resolvedLabel: p.t('portal.label.resolvedOn', { date: dateLabel(p, ticket.resolvedAt ?? ticket.closedAt) }) } : {}),
	};
}

export function ticketDetail(p: TPresenter, ticket: TPortalTicketDetail) {
	const stage = ticket.status === 'resolved' || ticket.status === 'closed' ? 4 : ticket.status === 'in_progress' ? 2 : ticket.assigneeName ? 1 : 0;
	const agentName = ticket.assigneeName ?? p.t('portal.label.support');
	const activity = [
		{ title: p.t('portal.ticket.created'), dateLabel: dateLabel(p, ticket.reportedAt), state: 'done' as const },
		...(ticket.resolvedAt ? [{ title: p.t('portal.ticket.resolved'), description: ticket.resolution ?? undefined, dateLabel: dateLabel(p, ticket.resolvedAt), state: 'done' as const }] : []),
		...(ticket.closedAt ? [{ title: p.t('portal.ticket.closed'), dateLabel: dateLabel(p, ticket.closedAt), state: 'done' as const }] : []),
	];
	return {
		...ticketSummary(p, ticket),
		stage,
		agent: { name: agentName, initials: initials(agentName), online: false, replyLabel: '' },
		messages: [
			{ kind: 'message' as const, id: `${ticket.id}:complaint`, from: 'customer' as const, text: ticket.complaint, time: dateLabel(p, ticket.reportedAt) },
			...ticket.messages.map((message) => ({
				kind: 'message' as const,
				id: message.id,
				from: message.authorType === 'customer' ? ('customer' as const) : ('agent' as const),
				author: message.authorName,
				text: message.body,
				time: agoLabel(p, message.createdAt),
			})),
			...(ticket.resolution ? [{ kind: 'event' as const, id: `${ticket.id}:resolution`, text: ticket.resolution, icon: 'calendar' as const }] : []),
		],
		quickReplies: [],
		createdLabel: dateLabel(p, ticket.reportedAt),
		...(ticket.deviceDescription || ticket.serialNumber
			? { device: { name: ticket.deviceDescription ?? '', serial: ticket.serialNumber ?? '' } }
			: {}),
		activity,
		/** ERP extension: the customer can confirm the fix (`POST /tickets/:id/confirm`). */
		canConfirm: ticket.status === 'resolved',
	};
}

/* ------------------------------------------------------------------------ *
 * Devices and warranty
 * ------------------------------------------------------------------------ */

function warrantyWindow(p: TPresenter, device: TPortalDevice) {
	const { startDate, endDate, months } = device.certificate;
	const daysLeft = Math.max(0, daysBetween(p.today, endDate) + 1);
	const total = Math.max(1, daysBetween(startDate, endDate) + 1);
	const status = p.today > endDate ? ('expired' as const) : daysLeft <= 60 ? ('expiring' as const) : ('active' as const);
	return { daysLeft, monthsLeft: Math.floor(daysLeft / 30), progress: Math.min(1, daysLeft / total), status, months };
}

export function deviceSummary(p: TPresenter, device: TPortalDevice) {
	const item = device.certificate.items[device.line]!;
	const window = warrantyWindow(p, device);
	return {
		id: device.id,
		name: item.description,
		serialLabel: item.remarks || device.certificate.code,
		site: device.certificate.projectLocation ?? device.certificate.projectName,
		siteKey: device.certificate.projectId,
		warrantyStatus: window.status,
		monthsLeft: window.monthsLeft,
		daysLeft: window.daysLeft,
		progress: window.progress,
	};
}

const lines = (text: string) =>
	text
		.split('\n')
		.map((line) => line.replace(/^(o |- )/, '').replace(/\*\*/g, '').trim())
		.filter(Boolean);

export function warrantyDetail(p: TPresenter, device: TPortalDevice) {
	const { certificate } = device;
	const item = certificate.items[device.line]!;
	const window = warrantyWindow(p, device);
	return {
		productId: device.id,
		certificate: certificate.code,
		plan: p.t('portal.label.warrantyPlan', { months: certificate.months }),
		productName: item.description,
		serial: item.remarks || '',
		installedLabel: dateLabel(p, certificate.startDate),
		monthsRemaining: window.monthsLeft,
		termMonths: certificate.months,
		periodLabel: `${dateLabel(p, certificate.startDate)} – ${dateLabel(p, certificate.endDate)}`,
		coverage: [
			...lines(certificate.coverage).map((title) => ({ title, detail: '', covered: true })),
			...lines(certificate.exclusions).map((title) => ({ title, detail: '', covered: false })),
		],
		history: [],
		certificateFile: {
			id: certificate.id,
			name: p.t('portal.label.warrantyCertificate', { code: certificate.code }),
			meta: dateLabel(p, certificate.issueDate),
			kind: 'pdf' as const,
			url: documentFileUrl('warranty', certificate.id),
		},
	};
}

/** A website RFQ in the portal's `RfqSummary` shape (ERP-0072). */
export function rfqSummary(p: TPresenter, rfq: TPortalRfqView) {
	return {
		reference: rfq.reference,
		title: rfq.title,
		siteLocation: rfq.siteLocation,
		status: rfq.portalStatus,
		statusLabel: p.t(`portal.rfq.status.${rfq.portalStatus}` as const),
		submittedLabel: p.t('portal.rfq.submittedOn', { date: dateLabel(p, rfq.submittedAt) }),
		itemCount: rfq.itemCount,
		...(rfq.quotationId ? { quotationId: rfq.quotationId } : {}),
		origin: rfq.origin,
	};
}

/** A saved product in the portal's `WishlistItem` shape (ERP-0074). */
export function wishlistItem(p: TPresenter, entry: TWishlistEntry) {
	const { product } = entry;
	return {
		id: entry.id,
		productSlug: entry.productSlug,
		name: product.name,
		category: product.category,
		priceLabel: product.price !== null ? `Rp ${product.price.toLocaleString('id-ID')}` : product.priceCaption || p.t('portal.wishlist.priceOnRequest'),
		stock: product.stock === 'out' ? ('request' as const) : product.stock,
		...(product.image ? { image: product.image } : {}),
		addedLabel: p.t('portal.wishlist.added', { date: dateLabel(p, entry.addedAt) }),
	};
}

/** An installation site in the portal's `CompanySite` shape (ERP-0075). */
export function companySite(site: TCustomerAddressSelect) {
	return {
		id: site.id,
		name: site.label ?? '',
		address: site.addressLine ?? '',
		picName: site.contactName ?? '',
		picPhone: site.contactPhone ?? '',
		...(site.isPrimary ? { primary: true } : {}),
	};
}

const rupiah = (minor: number) => `Rp ${Math.round(minor / 100).toLocaleString('id-ID')}`;

/** The profile page's figures (`ProfileSummary`, ERP-0075). */
export function profileSummary(p: TPresenter, facts: TPortalProfileFacts) {
	return {
		stats: { orders: facts.orders, projects: facts.projects, devices: facts.devices, tickets: facts.tickets },
		quotationsAwaiting: facts.quotationsAwaiting,
		outstanding: Math.round(facts.outstandingMinor / 100),
		orderCount: facts.orders,
		memberSince: facts.memberSince ? dateLabel(p, facts.memberSince) : '',
		deviceCount: facts.devices,
		siteCount: facts.sites,
		warrantyExpiring: facts.warrantyExpiring,
		documentCount: facts.documents,
		memberCount: facts.members,
		approverCount: facts.approvers,
	};
}

const DOCUMENT_FOLDERS: TPortalDocumentFolder[] = ['invoices', 'quotations', 'warranty', 'drawings'];

/** The document library (`DocumentLibrary`, ERP-0075), filtered to one folder when asked. */
export function documentLibrary(p: TPresenter, entries: TPortalDocumentEntry[], folder?: TPortalDocumentFolder) {
	return {
		total: entries.length,
		folders: DOCUMENT_FOLDERS.map((key) => ({
			key,
			label: p.t(`portal.documents.folder.${key}` as const),
			count: entries.filter((entry) => entry.folder === key).length,
		})),
		files: entries
			.filter((entry) => !folder || entry.folder === folder)
			.map((entry) => ({
				id: entry.id,
				name: entry.name,
				meta: [dateLabel(p, entry.date), entry.amountMinor !== undefined ? rupiah(entry.amountMinor) : null].filter(Boolean).join(' · '),
				kind: entry.kind,
				...(entry.url ? { url: entry.url } : {}),
				folder: entry.folder,
			})),
	};
}

/** Portal notification template → what the portal shows (ERP-0077). */
const PORTAL_NOTICES = {
	'portal.quotation_sent': { key: 'quotationSent', kind: 'quotation', href: (id: string) => `/quotations/${id}` },
	'portal.order_shipped': { key: 'orderShipped', kind: 'order', href: (id: string) => `/orders/${id}` },
	'portal.invoice_issued': { key: 'invoiceIssued', kind: 'payment', href: (id: string) => `/payments/${id}` },
	'portal.payment_received': { key: 'paymentReceived', kind: 'payment', href: (id: string) => `/payments/${id}` },
	'portal.ticket_replied': { key: 'ticketReplied', kind: 'support', href: (id: string) => `/support/${id}` },
} as const;

const jakartaDay = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(value);

/** One in-app notification in the portal's `PortalNotification` shape; `null` for a template the portal does not know. */
export function portalNotification(p: TPresenter, notification: TNotificationView) {
	const notice = PORTAL_NOTICES[notification.templateCode as keyof typeof PORTAL_NOTICES];
	if (!notice) return null;
	const variables = notification.variables ?? {};
	const created = new Date(notification.createdAt);
	const text = (part: 'title' | 'body') => p.t(`portal.notification.${notice.key}.${part}` as const, variables as never) as string;
	return {
		id: notification.id,
		group: jakartaDay(created) === p.today ? ('today' as const) : ('earlier' as const),
		kind: notice.kind,
		title: text('title'),
		body: text('body'),
		ago: agoLabel(p, created),
		unread: notification.readAt === null,
		...(notification.sourceId ? { href: notice.href(notification.sourceId) } : {}),
	};
}
