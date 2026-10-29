import type { TQuotationSelect } from '@drizzle/schemas/sales.schema';
import type { TPaymentSelect } from '@drizzle/schemas/sales.schema';
import { inject, injectable } from 'tsyringe';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	TCreateQuotationInput,
	TQuotationRepository,
	TUpdateQuotationInput,
} from '../contracts/quotation.repository.interface';
import type {
	TCreatePaymentInput,
	TPaymentRepository,
} from '../contracts/payment.repository.interface';

/**
 * Errors surfaced as typed HTTP responses by the controller.
 */
export class SalesStateError extends Error {
	constructor(
		readonly status: 403 | 404 | 409 | 422,
		message: string,
	) {
		super(message);
		this.name = 'SalesStateError';
	}
}

export type TQuotationActionContext = {
	/** Validated organization id from the ERP guard. */
	organizationId: string;
	/** Acting user id (session-derived, never client-provided). */
	actorUserId: string;
	/** Actor's organization roles, for separation-of-duties checks. */
	actorRoles: string[];
};

/**
 * Approval limit configuration. Amount limits are configuration-driven:
 * when no configuration exists for the organization, protected approval
 * actions are DENIED with a configuration error (never silently allowed).
 *
 * Storage for these rules is planned (`approval_rule` in the permission
 * catalog); until the configuration module exists, approvals of quotations
 * whose amount exceeds `DEFAULT_APPROVAL_LIMIT` are denied and absent
 * configuration is reported as an explicit error.
 */
const DEFAULT_APPROVAL_LIMIT = 0;

@injectable()
export class SalesService {
	constructor(
		@inject(QUOTATION_REPOSITORY_TOKEN)
		private readonly quotationRepository: TQuotationRepository,
		@inject(PAYMENT_REPOSITORY_TOKEN)
		private readonly paymentRepository: TPaymentRepository,
	) {}

	async createQuotation(
		input: Omit<TCreateQuotationInput, 'organizationId' | 'createdBy'>,
		ctx: TQuotationActionContext,
	): Promise<TQuotationSelect> {
		return this.quotationRepository.create({
			...input,
			organizationId: ctx.organizationId,
			createdBy: ctx.actorUserId,
		});
	}

	async getQuotation(
		organizationId: string,
		id: string,
	): Promise<TQuotationSelect | null> {
		return this.quotationRepository.findById(organizationId, id);
	}

	async listQuotations(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<{ data: TQuotationSelect[]; total: number }> {
		return this.quotationRepository.list(organizationId, pagination);
	}

	async updateQuotation(
		organizationId: string,
		id: string,
		patch: TUpdateQuotationInput,
	): Promise<TQuotationSelect | null> {
		return this.quotationRepository.update(organizationId, id, patch);
	}

	/**
	 * Submits a quotation (draft -> submitted).
	 */
	async submitQuotation(
		organizationId: string,
		id: string,
		_ctx: TQuotationActionContext,
	): Promise<TQuotationSelect | null> {
		const quotation = await this.quotationRepository.findById(organizationId, id);
		if (!quotation) return null;
		const updated = await this.quotationRepository.transitionStatus(
			organizationId,
			id,
			'draft',
			'submitted',
		);
		if (!updated) {
			throw new SalesStateError(422, 'Quotation is not in draft state');
		}
		return updated;
	}

	/**
	 * Approves or rejects a submitted quotation.
	 *
	 * Separation of duties: the creator can NEVER approve their own
	 * quotation, regardless of permissions or combined roles. Approval also
	 * requires valid state (submitted) and a configured amount limit.
	 */
	async decideQuotation(
		organizationId: string,
		id: string,
		decision: 'approve' | 'reject',
		ctx: TQuotationActionContext,
	): Promise<TQuotationSelect | null> {
		const quotation = await this.quotationRepository.findById(organizationId, id);
		if (!quotation) return null;

		if (quotation.createdBy === ctx.actorUserId) {
			throw new SalesStateError(
				403,
				'Self-approval is not allowed',
			);
		}

		if (decision === 'approve') {
			// Amount limits come from configuration. With no approval rule
			// configured (limit 0), any positive-amount approval is denied with
			// a clear configuration error rather than silently allowed.
			if (DEFAULT_APPROVAL_LIMIT <= 0) {
				throw new SalesStateError(
					403,
					'Approval limit configuration missing: configure an approval_rule for this organization before approving',
				);
			}
			if (quotation.amount > DEFAULT_APPROVAL_LIMIT) {
				throw new SalesStateError(403, 'Quotation amount exceeds approval limit');
			}
		}

		const updated = await this.quotationRepository.transitionStatus(
			organizationId,
			id,
			'submitted',
			decision === 'approve' ? 'approved' : 'rejected',
		);
		if (!updated) {
			throw new SalesStateError(422, 'Quotation is not in submitted state');
		}
		return updated;
	}

	async createPayment(
		input: Omit<TCreatePaymentInput, 'organizationId' | 'createdBy'>,
		ctx: TQuotationActionContext,
	): Promise<TPaymentSelect> {
		// Validate the referenced quotation belongs to the permitted
		// organization (cross-organization FK references are rejected).
		const quotation = await this.quotationRepository.findById(
			ctx.organizationId,
			input.quotationId,
		);
		if (!quotation) {
			throw new SalesStateError(
				404,
				'Referenced quotation not found in this organization',
			);
		}
		return this.paymentRepository.create({
			...input,
			organizationId: ctx.organizationId,
			createdBy: ctx.actorUserId,
		});
	}

	async getPayment(
		organizationId: string,
		id: string,
	): Promise<TPaymentSelect | null> {
		return this.paymentRepository.findById(organizationId, id);
	}

	/**
	 * Approves a payment (pending -> approved). Self-approval is never
	 * allowed; the transition is atomic.
	 */
	async approvePayment(
		organizationId: string,
		id: string,
		ctx: TQuotationActionContext,
	): Promise<TPaymentSelect | null> {
		const payment = await this.paymentRepository.findById(organizationId, id);
		if (!payment) return null;
		if (payment.createdBy === ctx.actorUserId) {
			throw new SalesStateError(403, 'Self-approval is not allowed');
		}
		const approved = await this.paymentRepository.approve(
			organizationId,
			id,
			ctx.actorUserId,
		);
		if (!approved) {
			throw new SalesStateError(422, 'Payment is not in pending state');
		}
		return approved;
	}

	/**
	 * Executes an approved payment. Only a payment in `approved` state can be
	 * executed; the repository's conditional update makes this race-safe and
	 * prevents duplicate execution.
	 */
	async executePayment(
		organizationId: string,
		id: string,
		ctx: TQuotationActionContext,
	): Promise<TPaymentSelect | null> {
		const payment = await this.paymentRepository.findById(organizationId, id);
		if (!payment) return null;
		if (payment.createdBy === ctx.actorUserId) {
			throw new SalesStateError(403, 'Self-execution is not allowed');
		}
		const executed = await this.paymentRepository.execute(
			organizationId,
			id,
			ctx.actorUserId,
		);
		if (!executed) {
			throw new SalesStateError(
				422,
				'Payment must be approved before execution',
			);
		}
		return executed;
	}
}
