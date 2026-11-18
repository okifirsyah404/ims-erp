import { inject, injectable } from 'tsyringe';
import type { TPaymentAllocationSelect, TPaymentInsert, TPaymentSelect } from '@drizzle/schemas/payment.schema';
import { PAYMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { IPaymentRepository } from '../contracts/payment.repository.interface';
import type { IPaymentLedgerGateway } from '../contracts/payment-ledger.gateway.interface';
import { PaymentInvalidTransitionError, PaymentNotFoundError } from '../errors/payment.errors';

/**
 * Exported payment ledger operations for other modules (ADR-0024).
 *
 * @remarks
 * Depends only on the payment repository — no Accounting, Sales or gateway
 * dependency — so Accounting can inject it without creating a DI cycle with
 * {@link PaymentService}. It owns the payment module's rules: a caller gets the
 * payment module's errors, never a repository row it has to interpret.
 */
@injectable()
export class ExportedPaymentService implements IPaymentLedgerGateway {
	constructor(@inject(PAYMENT_REPOSITORY_TOKEN) private readonly repo: IPaymentRepository) {}

	countOpen(organizationId: string): Promise<number> {
		return this.repo.countOpen(organizationId);
	}

	listAllocations(
		organizationId: string,
		paymentId: string,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]> {
		return this.repo.listAllocations(organizationId, paymentId, tx);
	}

	async requireExecuted(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect> {
		const payment = await this.repo.findById(organizationId, id, tx);
		if (!payment) throw new PaymentNotFoundError();
		if (payment.status !== 'executed') throw new PaymentInvalidTransitionError();
		return payment;
	}

	markVoided(
		organizationId: string,
		id: string,
		reason: string,
		tx?: unknown,
	): Promise<TPaymentSelect> {
		return this.repo
			.update(organizationId, id, {
				status: 'void',
				voidedAt: new Date(),
				voidReason: reason,
			}, tx)
			.then((row) => row ?? Promise.reject(new PaymentNotFoundError()));
	}

	update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null> {
		return this.repo.update(organizationId, id, patch, tx);
	}
}
