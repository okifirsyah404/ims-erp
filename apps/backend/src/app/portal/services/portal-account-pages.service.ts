import { CUSTOMER_ADDRESS_SERVICE_TOKEN, CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { TCustomerSiteInput } from '@app/crm/contracts/customer-address.contract';
import type { CustomerAddressService } from '@app/crm/services/customer-address.service';
import type { CustomerService } from '@app/crm/services/customer.service';
import type { TPortalProjectDetail } from '@app/projects/services/project-portal.service';
import { USER_PREFERENCE_SERVICE_TOKEN, USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { TPortalMemberInvite } from '@app/user/contracts/portal-account.contract';
import type { TPortalPreferences, UserPreferenceService } from '@app/user/services/user-preference.service';
import type { UserService } from '@app/user/services/user.service';
import type { PortalContext } from '@authorization/portal-auth';
import type { TCustomerAddressSelect, TCustomerContactSelect } from '@drizzle/schemas/crm.schema';
import { inject, injectable } from 'tsyringe';
import { PORTAL_SALES_SERVICE_TOKEN, PORTAL_SERVICE_TOKEN } from '../constants/di';
import { PortalRoleForbiddenError } from '../errors/portal.errors';
import type { PortalSalesService } from './portal-sales.service';
import type { PortalService } from './portal.service';

/** Roles that manage the account's sites and finish onboarding. */
const MAY_MANAGE = new Set<PortalContext['role']>(['owner', 'approver']);

export type TPortalProfileFacts = {
	orders: number;
	activeOrders: number;
	projects: number;
	devices: number;
	tickets: number;
	quotationsAwaiting: number;
	/** Unpaid on issued invoices, minor units. */
	outstandingMinor: number;
	memberSince: Date | null;
	sites: number;
	warrantyExpiring: number;
	documents: number;
	members: number;
	approvers: number;
};

export type TPortalDocumentFolder = 'invoices' | 'quotations' | 'warranty' | 'drawings';
export type TPortalDocumentEntry = { id: string; folder: TPortalDocumentFolder; name: string; date: Date | string | null; kind: 'pdf' | 'dwg' | 'zip' | 'file'; url?: string; amountMinor?: number };

const kindOf = (fileName: string): TPortalDocumentEntry['kind'] => {
	const extension = fileName.split('.').pop()?.toLowerCase();
	return extension === 'pdf' ? 'pdf' : extension === 'dwg' ? 'dwg' : extension === 'zip' ? 'zip' : 'file';
};

/** Days a warranty counts as "expiring soon" on the profile. */
const EXPIRING_DAYS = 60;

/**
 * The customer portal's account pages (ERP-0075): profile figures, personal
 * data, installation sites, settings, onboarding and the document library.
 * Owns no data — CRM (contact, sites), Identity (name, preferences, members),
 * Sales, Projects and After-sales through their contracts, always with the
 * ids the portal guard resolved.
 */
@injectable()
export class PortalAccountPagesService {
	constructor(
		@inject(PORTAL_SERVICE_TOKEN)
		private readonly portalService: Pick<PortalService, 'customer' | 'members' | 'inviteMember' | 'listProjects' | 'getProject' | 'listTickets' | 'listDevices'>,
		@inject(PORTAL_SALES_SERVICE_TOKEN) private readonly sales: Pick<PortalSalesService, 'listOrders' | 'listInvoices' | 'listQuotations'>,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'get' | 'updateContact'>,
		@inject(CUSTOMER_ADDRESS_SERVICE_TOKEN) private readonly addresses: Pick<CustomerAddressService, 'listSites' | 'saveSite' | 'removeSite'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'updateSelf'>,
		@inject(USER_PREFERENCE_SERVICE_TOKEN) private readonly preferences: Pick<UserPreferenceService, 'portal' | 'setPortal'>,
	) {}

	private assertManager(portal: PortalContext) {
		if (!MAY_MANAGE.has(portal.role)) throw new PortalRoleForbiddenError();
	}

	/* Personal data and settings ---------------------------------------- */

	/** Name on the login; phone and job title on the CRM contact behind it. */
	async updatePersonal(portal: PortalContext, input: { name: string; phone: string; jobTitle?: string }, headers: Headers): Promise<void> {
		await this.users.updateSelf(portal.userId, { name: input.name }, headers);
		if (portal.contactId) {
			await this.customers.updateContact(portal.customerId, portal.contactId, {
				name: input.name,
				phone: input.phone,
				...(input.jobTitle !== undefined ? { position: input.jobTitle || undefined } : {}),
			});
		}
	}

	/** The CRM contact behind the login (phone, job title), or `null`. */
	async contactOf(portal: PortalContext): Promise<TCustomerContactSelect | null> {
		if (!portal.contactId) return null;
		const customer = await this.customers.get(portal.customerId).catch(() => null);
		return customer?.contacts.find((contact) => contact.id === portal.contactId) ?? null;
	}

	preferencesOf(portal: PortalContext): Promise<TPortalPreferences> {
		return this.preferences.portal(portal.userId);
	}

	/** Notification channels and language; face ID and two-step are not supported (ignored). */
	updateSettings(portal: PortalContext, patch: { notifications?: Partial<TPortalPreferences['notifications']>; preferences?: { language?: 'en' | 'id' } }) {
		return this.preferences.setPortal(portal.userId, { notifications: patch.notifications, language: patch.preferences?.language });
	}

	/* Sites ---------------------------------------------------------------- */

	listSites(portal: PortalContext): Promise<TCustomerAddressSelect[]> {
		return this.addresses.listSites(portal.customerId);
	}

	/** @throws {PortalRoleForbiddenError} finance and viewer logins */
	saveSite(portal: PortalContext, input: TCustomerSiteInput, id?: string): Promise<TCustomerAddressSelect> {
		this.assertManager(portal);
		return this.addresses.saveSite(portal.customerId, input, id);
	}

	/** @throws {PortalRoleForbiddenError} finance and viewer logins */
	removeSite(portal: PortalContext, id: string): Promise<void> {
		this.assertManager(portal);
		return this.addresses.removeSite(portal.customerId, id);
	}

	/**
	 * Onboarding (05.08): the first installation site and colleague invites.
	 * An invite that fails (e.g. the email already has a login) does not stop the others.
	 */
	async completeOnboarding(
		portal: PortalContext,
		input: { siteAddress: string; invites: TPortalMemberInvite[] },
	): Promise<{ invited: number; failed: string[] }> {
		this.assertManager(portal);
		const [customer, sites] = await Promise.all([this.portalService.customer(portal), this.addresses.listSites(portal.customerId)]);
		if (sites.length === 0) {
			await this.addresses.saveSite(portal.customerId, {
				name: customer?.name ?? portal.user.name,
				address: input.siteAddress,
				picName: portal.user.name,
				picPhone: customer?.phone ?? '',
				primary: true,
			});
		}
		const failed: string[] = [];
		for (const invite of input.invites) {
			try {
				await this.portalService.inviteMember(portal, invite);
			} catch {
				failed.push(invite.email);
			}
		}
		return { invited: input.invites.length - failed.length, failed };
	}

	/* Profile and documents -------------------------------------------- */

	async profile(portal: PortalContext): Promise<TPortalProfileFacts> {
		const [customer, members, projects, tickets, devices, orders, invoices, quotations, sites, documents] = await Promise.all([
			this.portalService.customer(portal),
			this.portalService.members(portal),
			this.portalService.listProjects(portal),
			this.portalService.listTickets(portal),
			this.portalService.listDevices(portal),
			this.sales.listOrders(portal),
			this.sales.listInvoices(portal),
			this.sales.listQuotations(portal),
			this.addresses.listSites(portal.customerId),
			this.documents(portal),
		]);
		const soon = new Date(Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		const today = new Date().toISOString().slice(0, 10);
		const active = members.filter((member) => member.status === 'active');
		return {
			orders: orders.length,
			activeOrders: orders.filter((order) => order.status === 'confirmed' || order.status === 'in_progress').length,
			projects: projects.length,
			devices: devices.length,
			tickets: tickets.length,
			quotationsAwaiting: quotations.filter((quotation) => quotation.status === 'sent' && !quotation.expired).length,
			outstandingMinor: invoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + Math.max(0, invoice.grandTotal - invoice.paidTotal), 0),
			memberSince: customer?.createdAt ?? null,
			sites: sites.length,
			warrantyExpiring: devices.filter((device) => device.certificate.endDate >= today && device.certificate.endDate <= soon).length,
			documents: documents.length,
			members: active.length,
			approvers: active.filter((member) => member.role === 'owner' || member.role === 'approver').length,
		};
	}

	/**
	 * The account's documents, newest first: issued invoices and sent
	 * quotations (listed; open them on their pages), warranty certificates,
	 * and the customer-visible project files (with a short-lived link).
	 */
	async documents(portal: PortalContext): Promise<TPortalDocumentEntry[]> {
		const [invoices, quotations, devices, projects] = await Promise.all([
			this.sales.listInvoices(portal),
			this.sales.listQuotations(portal),
			this.portalService.listDevices(portal),
			this.portalService.listProjects(portal),
		]);
		const details = await Promise.all(projects.map((project) => this.portalService.getProject(portal, project.id).catch(() => null)));
		const certificates = new Map(devices.map((device) => [device.certificate.id, device.certificate]));
		const entries: TPortalDocumentEntry[] = [
			...invoices.map((invoice) => ({ id: invoice.id, folder: 'invoices' as const, name: invoice.code ?? '', date: invoice.issueDate, kind: 'pdf' as const, amountMinor: invoice.grandTotal })),
			...quotations
				.filter((quotation) => quotation.status !== 'draft')
				.map((quotation) => ({ id: quotation.id, folder: 'quotations' as const, name: quotation.code ?? '', date: quotation.sentAt ?? quotation.createdAt, kind: 'pdf' as const, amountMinor: quotation.grandTotal })),
			...[...certificates.values()].map((certificate) => ({ id: certificate.id, folder: 'warranty' as const, name: certificate.code, date: certificate.issueDate, kind: 'pdf' as const })),
			...details
				.filter((detail): detail is TPortalProjectDetail => detail !== null)
				.flatMap((detail) =>
					detail.files.map((file) => ({ id: file.id, folder: 'drawings' as const, name: file.fileName, date: file.createdAt, kind: kindOf(file.fileName), url: file.url })),
				),
		];
		const time = (value: Date | string | null) => (value ? new Date(value).getTime() : 0);
		return entries.sort((a, b) => time(b.date) - time(a.date));
	}
}
