import { EXPORTED_CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { ExportedCustomerService } from '@app/customer/services/exported-customer.service';
import { PROJECT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import { COMPANY_SERVICE_TOKEN } from '@app/company';
import type { CompanyService } from '@app/company';
import type { ProjectNumberingService } from './project-numbering.service';
import { EXPORTED_INVENTORY_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ExportedInventoryService } from '@app/inventory/services/exported-inventory.service';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import { HANDOVER_SERVICE_TOKEN } from '@app/project/constants/di';
import type { HandoverService } from '@app/project/services/handover.service';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import type { TProjectContext } from '@app/project/services/project.service';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sale/constants/di';
import type { SalesFulfilmentService } from '@app/sale/services/sales-fulfilment.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TWarrantySelect } from '@drizzle/schemas/project.schema';
import type { TDocumentItem } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import { inTransaction, type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { WARRANTY_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IWarrantyRepository,
	TWarrantyBodyRequest,
	TWarrantyListQuery,
	TWarrantyRow,
} from '../contracts/warranty.contract';
import { WarrantyBastRequiredError, WarrantyExistsError, WarrantyProjectCancelledError } from '../errors/warranty.errors';
import {
	DEFAULT_WARRANTY_COVERAGE,
	DEFAULT_WARRANTY_EXCLUSIONS,
	DEFAULT_WARRANTY_MONTHS,
	DEFAULT_WARRANTY_SERVICE_TERMS,
	customerNumberCode,
	textOrDefault,
	warrantyEndDate,
} from '../utils/warranty';

/** The result of a warranty check (service tickets). */
export type TWarrantyCheck = {
	/** Customer the serial was shipped to, when known. */
	customerId: string | null;
	projectId: string | null;
	projectCode: string | null;
	deviceDescription: string | null;
	inWarranty: boolean;
	warrantyEndsOn: string | null;
	warrantyCode: string | null;
	/**
	 * Where the end date came from (B-30): the project's certificate, the
	 * unit's own warranty date, or delivery date + the product's standard
	 * months; `null` when nothing gives a warranty.
	 */
	warrantySource?: 'certificate' | 'serial' | 'product' | null;
	/** Whether a given serial was found (shipped or registered); `null` without a serial (FU10). */
	serialKnown?: boolean | null;
};

/** A new certificate's prefilled fields (not saved). */
export type TWarrantyDraft = Omit<TWarrantyBodyRequest, 'handoverId'> & { handoverId: string | null };

/**
 * Warranty certificates (Surat Keterangan Garansi, M07, ADR-0011 step 6b).
 *
 * @remarks
 * One live certificate per project, numbered on creation (`SG-GARANSI`
 * with the customer code). The warranty starts at the chosen BAST's date
 * and ends the day before the same date `months` later. Visibility follows
 * the project (Projects contract); a cancelled project gets none. Texts are
 * snapshotted from the company profile (else the sample's defaults).
 */
@injectable()
export class WarrantyService {
	constructor(
		@inject(WARRANTY_REPOSITORY_TOKEN) private readonly certificates: IWarrantyRepository,
		@inject(HANDOVER_SERVICE_TOKEN) private readonly projects: Pick<HandoverService, 'requireProject' | 'findBast'>,
		@inject(SALES_FULFILMENT_SERVICE_TOKEN) private readonly sales: Pick<SalesFulfilmentService, 'shippedLines' | 'orderLines' | 'findShipmentBySerial'>,
		@inject(EXPORTED_CUSTOMER_SERVICE_TOKEN)
	private readonly customers: Pick<ExportedCustomerService, 'getSnapshot'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly profile: Pick<CompanyService, 'get'>,
		@inject(PROJECT_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<ProjectNumberingService, 'next'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly lookup: Pick<ProjectLookupService, 'liveProjectOfOrder' | 'getProject'>,
		/** ERP-0044: issued certificates are registered documents. */
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'register'>,
		/** P7-5: document number + write in one transaction; optional for unit tests built by hand. */
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions?: ITransactionRunner,
		/** B-30: a serial's own warranty date (inventory owns the units). */
		@inject(EXPORTED_INVENTORY_SERVICE_TOKEN)
		private readonly units?: Pick<ExportedInventoryService, 'serialWarranty'>,
		/** B-30: the product's standard warranty months. */
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly products?: Pick<ExportedProductService, 'productsById'>,
	) {}

	/** The project's certificate, or `null`. */
	async get(ctx: TProjectContext, projectId: string): Promise<TWarrantySelect | null> {
		await this.projects.requireProject(ctx, projectId);
		return this.certificates.findByProject(projectId);
	}

	/** Certificates across the projects visible to the caller. */
	list(ctx: TProjectContext, query: TWarrantyListQuery): Promise<TPaginationResult<TWarrantyRow>> {
		return this.certificates.paginate({ ...query, involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId });
	}

	/** Prefilled fields: shipped devices with their serials, the profile's texts. */
	async draft(ctx: TProjectContext, projectId: string): Promise<TWarrantyDraft> {
		const project = await this.projects.requireProject(ctx, projectId);
		// ADR-0014: a project may carry no sales order; then nothing was shipped
		// through it and the draft starts with no items.
		const orderId = project.orderId;
		const [shipped, profile] = await Promise.all([orderId ? this.sales.shippedLines(orderId) : Promise.resolve([]), this.profile.get()]);
		// One row per order line: shipped quantities summed, serials listed.
		const byLine = new Map<string, { description: string; unit: string; quantity: number; serials: string[] }>();
		for (const line of shipped) {
			const row = byLine.get(line.orderItemId) ?? { description: line.name, unit: line.unit, quantity: 0, serials: [] };
			row.quantity += Number(line.quantity);
			row.serials.push(...(line.serialNumbers ?? []));
			byLine.set(line.orderItemId, row);
		}
		let items: TDocumentItem[] = [...byLine.values()].map((row) => ({
			description: row.description,
			volume: `${row.quantity.toLocaleString('id-ID')} ${row.unit}`,
			remarks: row.serials.length ? `SN: ${row.serials.join(', ')}` : '',
		}));
		if (items.length === 0 && orderId) {
			items = (await this.sales.orderLines(orderId)).map((line) => ({
				description: line.name,
				volume: `${Number(line.quantity).toLocaleString('id-ID')} ${line.unit}`,
				remarks: '',
			}));
		}
		return {
			handoverId: null,
			issueDate: businessDateOf(),
			months: DEFAULT_WARRANTY_MONTHS,
			productSummary: project.title,
			projectName: project.title,
			projectLocation: project.siteName,
			projectOwner: project.customerName,
			items,
			coverage: textOrDefault(profile?.warrantyCoverage, DEFAULT_WARRANTY_COVERAGE),
			exclusions: textOrDefault(profile?.warrantyExclusions, DEFAULT_WARRANTY_EXCLUSIONS),
			serviceTerms: textOrDefault(profile?.warrantyServiceTerms, DEFAULT_WARRANTY_SERVICE_TERMS),
		};
	}

	/** Creates (and numbers) or updates the project's certificate. */
	async save(ctx: TProjectContext, projectId: string, body: TWarrantyBodyRequest): Promise<TWarrantySelect> {
		const project = await this.projects.requireProject(ctx, projectId);
		if (project.status === 'cancelled') throw new WarrantyProjectCancelledError();
		const bast = await this.projects.findBast(projectId, body.handoverId);
		if (!bast || bast.status !== 'issued') throw new WarrantyBastRequiredError();
		const data = {
			...body,
			projectId,
			customerId: project.customerId,
			startDate: bast.bastDate,
			endDate: warrantyEndDate(bast.bastDate, body.months),
		};
		const existing = await this.certificates.findByProject(projectId);
		if (existing) return (await this.certificates.update(existing.id, data)) ?? existing;
		const customer = project.customerId
			? await this.customers.getSnapshot({ customerId: project.customerId }).catch(() => null)
			: null;
		try {
			// P7-5 (T-1): number, certificate and registry entry commit together;
			// a code over 32 characters is refused and rolls the counter back.
			return await inTransaction(this.transactions, async (tx) => {
				const code = await this.numbering.next('warranty', tx, new Date(`${body.issueDate}T12:00:00+07:00`), {
					customer: customerNumberCode(customer?.code),
				});
				const certificate = await this.certificates.create(code, ctx.actorUserId, data, tx);
				// ERP-0044: the certificate the customer holds is a registered document.
				await this.documents.register({
					code: certificate.code,
					title: `Garansi - ${customer?.name ?? project.customerName} - ${project.code}`,
					documentType: 'warranty',
					module: 'project',
					sourceType: 'warranty',
					sourceId: certificate.id,
					organizationId: null,
					issuedOn: certificate.issueDate,
					issuedByUserId: ctx.actorUserId,
				}, tx);
				return certificate;
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw new WarrantyExistsError();
			throw error;
		}
	}

	/**
	 * Is a device under warranty on `on` (a Jakarta business date)?
	 *
	 * @remarks
	 * B-30 (KF-P2) order: (1) a serial is traced to the delivery note that
	 * shipped it, its order's live project and that project's certificate
	 * (without a serial, the given project's certificate); (2) else the unit's
	 * own `warranty_expires_on` (frozen when it was shipped without a project,
	 * or typed on the unit); (3) else, for a sale without a project, the
	 * delivery date + the product's standard warranty months. Nothing found =
	 * out of warranty: the ticket is still opened and counts as paid (FU10).
	 * No caller visibility: the ticket service authorizes its callers.
	 */
	async check(query: { serialNumber?: string | null; projectId?: string | null }, on: string): Promise<TWarrantyCheck> {
		let customerId: string | null = null;
		let deviceDescription: string | null = null;
		let project = null;
		let shipment = null;
		if (query.serialNumber) {
			shipment = await this.sales.findShipmentBySerial(query.serialNumber);
			if (shipment) {
				customerId = shipment.customerId;
				deviceDescription = shipment.description;
				project = await this.lookup.liveProjectOfOrder(shipment.orderId);
			}
		}
		const shippedWithProject = !!project;
		if (!project && query.projectId) project = await this.lookup.getProject(query.projectId);
		const certificate = project ? await this.certificates.findByProject(project.id) : null;
		let endsOn: string | null = certificate?.endDate ?? null;
		let source: TWarrantyCheck['warrantySource'] = certificate ? 'certificate' : null;
		let serialKnown: boolean | null = query.serialNumber ? !!shipment : null;
		if (!certificate && query.serialNumber && this.units) {
			const unit = await this.units.serialWarranty(query.serialNumber);
			if (unit) serialKnown = true;
			if (unit?.warrantyExpiresOn) {
				endsOn = unit.warrantyExpiresOn;
				source = 'serial';
			} else if (unit?.productId && shipment?.shippedAt && !shippedWithProject && this.products) {
				const productId = unit.productId;
				const months = (await this.products.productsById([productId])).get(productId)?.warrantyMonths;
				if (months) {
					endsOn = warrantyEndDate(businessDateOf(shipment.shippedAt), months);
					source = 'product';
				}
			}
		}
		const startsOn = certificate?.startDate ?? null;
		return {
			customerId,
			projectId: project?.id ?? null,
			projectCode: project?.code ?? null,
			deviceDescription,
			inWarranty: !!endsOn && on <= endsOn && (!startsOn || on >= startsOn),
			warrantyEndsOn: endsOn,
			warrantyCode: certificate?.code ?? null,
			warrantySource: source,
			serialKnown,
		};
	}

	/**
	 * The customer's warranty certificates (portal, ERP-0022). The
	 * certificate is a document the customer already holds on paper, so it is
	 * returned whole; nothing internal is on it.
	 */
	listForCustomer(customerId: string): Promise<TWarrantySelect[]> {
		return this.certificates.listByCustomer(customerId);
	}

	/** One of the customer's certificates, or `null` for anyone else's. */
	async getForCustomer(customerId: string, id: string): Promise<TWarrantySelect | null> {
		const certificates = await this.certificates.listByCustomer(customerId);
		return certificates.find((certificate) => certificate.id === id) ?? null;
	}
}
