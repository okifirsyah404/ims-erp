import type { TPurchaseTermTemplateSelect } from '@drizzle/schemas/procurement.schema';
import { inject, injectable } from 'tsyringe';
import { PURCHASE_TERM_TEMPLATE_REPOSITORY_TOKEN } from '../constants/di';
import type { IPurchaseTermTemplateRepository } from '../contracts/procurement.repository.interface';
import type { TPurchaseTermTemplateBody } from '../contracts/purchase-term-template.contract';
import { PurchaseTermTemplateNotFoundError } from '../errors/procurement.errors';
import { assertTermPlaceholders } from '../utils/term-placeholders';

/**
 * Purchase term template use cases (ERP-0165).
 *
 * @remarks
 * Read with `purchase_order:read`, managed with `purchase_order:update`.
 * Choosing a template in the order form copies its text into the order; the
 * order never references it, so editing or deleting a template never changes
 * an order. Unknown `{{placeholders}}` are refused on save.
 */
@injectable()
export class PurchaseTermTemplateService {
	constructor(
		@inject(PURCHASE_TERM_TEMPLATE_REPOSITORY_TOKEN)
		private readonly templates: IPurchaseTermTemplateRepository,
	) {}

	list(): Promise<TPurchaseTermTemplateSelect[]> {
		return this.templates.findAll();
	}

	/** @throws {PurchaseTermTemplateNotFoundError} */
	async get(id: string): Promise<TPurchaseTermTemplateSelect> {
		const row = await this.templates.findLive(id);
		if (!row) throw new PurchaseTermTemplateNotFoundError();
		return row;
	}

	/** @throws {PurchaseTermPlaceholderError} */
	async create(body: TPurchaseTermTemplateBody, actorUserId: string): Promise<TPurchaseTermTemplateSelect> {
		assertTermPlaceholders([body.paymentTerms, body.terms, body.notes]);
		return this.templates.create({ ...body, createdBy: actorUserId, updatedBy: actorUserId });
	}

	/**
	 * @throws {PurchaseTermTemplateNotFoundError}
	 * @throws {PurchaseTermPlaceholderError}
	 */
	async update(id: string, body: TPurchaseTermTemplateBody, actorUserId: string): Promise<TPurchaseTermTemplateSelect> {
		assertTermPlaceholders([body.paymentTerms, body.terms, body.notes]);
		const row = await this.templates.update(id, { ...body, updatedBy: actorUserId });
		if (!row) throw new PurchaseTermTemplateNotFoundError();
		return row;
	}

	/** @throws {PurchaseTermTemplateNotFoundError} */
	async remove(id: string, actorUserId: string): Promise<void> {
		if (!(await this.templates.softDelete(id, actorUserId))) throw new PurchaseTermTemplateNotFoundError();
	}
}
