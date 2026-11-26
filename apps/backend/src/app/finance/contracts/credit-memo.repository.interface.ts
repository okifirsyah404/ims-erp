import type { TTx } from '@drizzle/types';
import type { TCreditMemoSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

export type TCreditMemoPaginationRequest = TPaginationRequest & {
	organizationId: string;
	invoiceId?: string;
	status?: string;
};

/** Data access over `finance.credit_memos` (ERP-0135). */
export interface ICreditMemoRepository {
	insert(row: {
		organizationId: string;
		code: string;
		invoiceId: string;
		customerId: string | null;
		memoDate: string;
		amount: number;
		taxAmount: number;
		reason: string;
		createdBy: string;
	}): Promise<TCreditMemoSelect>;
	findById(organizationId: string, id: string, tx?: TTx): Promise<TCreditMemoSelect | null>;
	paginate(request: TCreditMemoPaginationRequest): Promise<TPaginationResult<TCreditMemoSelect>>;
	update(
		organizationId: string,
		id: string,
		patch: Partial<Pick<TCreditMemoSelect, 'status' | 'journalEntryId' | 'issuedBy' | 'issuedAt'>>,
		tx?: TTx,
	): Promise<TCreditMemoSelect | null>;
}
