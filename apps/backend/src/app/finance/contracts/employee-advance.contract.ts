import type {
	TEmployeeAdvanceSelect,
	TExpenseSettlementItemSelect,
	TExpenseSettlementSelect,
} from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { z } from 'zod';

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const advanceCreateSchema = z.object({
	employeeId: z.uuid(),
	projectId: z.uuid().nullish().transform((v) => v ?? null),
	amount: money.positive(),
	requestDate: z.iso.date(),
	purpose: z.string().trim().min(1).max(500),
});

export const settlementItemSchema = z.object({
	expenseDate: z.iso.date(),
	/** Expense account code, as on expense claim items. */
	categoryCode: z.string().trim().min(1).max(32),
	description: z.string().trim().max(500).nullish().transform((v) => v ?? null),
	amount: money,
	taxAmount: money.default(0),
});

export const settlementCreateSchema = z.object({
	employeeAdvanceId: z.uuid(),
	settlementDate: z.iso.date(),
	notes: z.string().trim().max(1000).nullish().transform((v) => v ?? null),
	items: z.array(settlementItemSchema).min(1).max(200),
});

export const advanceListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.string().max(20).optional(),
	employeeId: z.uuid().optional(),
});

export type TAdvanceCreate = z.output<typeof advanceCreateSchema>;
export type TSettlementCreate = z.output<typeof settlementCreateSchema>;
export type TAdvanceListQuery = z.output<typeof advanceListQuerySchema>;

export type TSettlementDetail = TExpenseSettlementSelect & { items: TExpenseSettlementItemSelect[] };

/** Persistence port of employee advances and their settlements (ERP-0144). */
export interface IEmployeeAdvanceRepository {
	paginateAdvances(organizationId: string, query: TAdvanceListQuery): Promise<TPaginationResult<TEmployeeAdvanceSelect>>;
	findAdvance(organizationId: string, id: string, tx?: TTx): Promise<TEmployeeAdvanceSelect | null>;
	insertAdvance(row: Omit<typeof import('@drizzle/schemas/finance.schema').employeeAdvances.$inferInsert, 'createdAt' | 'updatedAt'>, tx?: TTx): Promise<TEmployeeAdvanceSelect>;
	updateAdvance(organizationId: string, id: string, patch: Partial<TEmployeeAdvanceSelect>, tx?: TTx): Promise<TEmployeeAdvanceSelect | null>;
	paginateSettlements(organizationId: string, query: TAdvanceListQuery): Promise<TPaginationResult<TExpenseSettlementSelect>>;
	findSettlement(organizationId: string, id: string, tx?: TTx): Promise<TExpenseSettlementSelect | null>;
	listSettlementsForAdvance(organizationId: string, advanceId: string, tx?: TTx): Promise<TExpenseSettlementSelect[]>;
	insertSettlement(
		row: Omit<typeof import('@drizzle/schemas/finance.schema').expenseSettlements.$inferInsert, 'createdAt' | 'updatedAt'>,
		tx?: TTx,
	): Promise<TExpenseSettlementSelect>;
	updateSettlement(organizationId: string, id: string, patch: Partial<TExpenseSettlementSelect>, tx?: TTx): Promise<TExpenseSettlementSelect | null>;
	listSettlementItems(organizationId: string, settlementId: string, tx?: TTx): Promise<TExpenseSettlementItemSelect[]>;
	insertSettlementItems(
		rows: Array<Omit<typeof import('@drizzle/schemas/finance.schema').expenseSettlementItems.$inferInsert, 'createdAt' | 'updatedAt'>>,
		tx?: TTx,
	): Promise<TExpenseSettlementItemSelect[]>;
}
