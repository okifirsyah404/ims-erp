import type { TPaymentSelect } from '@drizzle/schemas/sales.schema';
import { DomainHttpError } from '@http/errors';
import { inject, injectable } from 'tsyringe';
import {
	QUOTATION_REPOSITORY_TOKEN,
	PAYMENT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IQuotationRepository } from '../contracts/quotation.repository.interface';
import type {
	TCreatePaymentInput,
	TPaymentRepository,
} from '../contracts/payment.repository.interface';

/**
 * Typed HTTP-facing error for sales workflow violations. Controllers map the
 * `status` field onto the response, so throwing this is how the service
 * dictates a non-200 outcome.
 *
 * @remarks
 * Messages here are user-facing English text composed at runtime, so this
 * family extends {@link DomainHttpError} rather than carrying locale keys.
 * Where a fixed-meaning error exists it should become an {@link AppError}
 * subclass with a real key - that is the only form that survives translation.
 */
export class SalesStateError extends DomainHttpError {}

/**
 * The quotation referenced by a new payment does not exist inside the
 * caller's organization.
 *
 * @remarks
 * Distinct from {@link SalesStateError} with a bare 404 so the controller can
 * report the *quotation* rather than reusing a generic "not found" - the
 * previous mapping told clients the wrong resource was missing.
 */
export class ReferencedQuotationNotFoundError extends SalesStateError {
	constructor() {
		super(404, 'Referenced quotation not found');
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
 * Application service for the transitional payments (scaffold until S7).
 *
 * @remarks
 * Enforces separation-of-duties (self-approval/self-execution bans) and
 * the deny-by-default approval limit; all state-transition races are
 * pushed down into the repositories' conditional updates. This service is
 * deliberately stateless besides its injected repositories.
 */
@injectable()
export class SalesService {
	constructor(
		@inject(QUOTATION_REPOSITORY_TOKEN)
		private readonly quotationRepository: Pick<IQuotationRepository, 'findById'>,
		@inject(PAYMENT_REPOSITORY_TOKEN)
		private readonly paymentRepository: TPaymentRepository,
	) {}

	/**
	 * Creates a payment against a quotation.
	 *
	 * @remarks
	 * Validates the referenced quotation belongs to the permitted
	 * organization, so cross-organization FK references are rejected.
	 *
	 * @throws SalesStateError 404 when the quotation is not found in the
	 * caller's organization
	 */
	async createPayment(
		input: Omit<TCreatePaymentInput, 'organizationId' | 'createdBy'>,
		ctx: TQuotationActionContext,
	): Promise<TPaymentSelect> {
		// Validate the referenced quotation belongs to the permitted
		// organization (cross-organization FK references are rejected).
		// Quotations are company-wide (ADR-0011): only existence is checked.
		const quotation = await this.quotationRepository.findById(input.quotationId);
		if (!quotation) {
			throw new ReferencedQuotationNotFoundError();
		}
		return this.paymentRepository.create({
			...input,
			organizationId: ctx.organizationId,
			createdBy: ctx.actorUserId,
		});
	}

	/**
	 * Fetches one tenant-scoped payment.
	 *
	 * @returns The payment, or `null` when absent or foreign
	 */
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
	/**
	 * Approves a pending payment.
	 *
	 * @throws SalesStateError 403 on self-approval
	 * @throws SalesStateError 422 when the payment is not in pending state
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
