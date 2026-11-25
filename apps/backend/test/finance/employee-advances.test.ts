/**
 * Employee advances and settlements (ERP-0144): maker-checker steps, the
 * settlement journal and the payment contract.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { EmployeeAdvanceService } from '../../src/app/finance/services/employee-advance.service';
import { AdvanceSameActorError, AdvanceStateError, SettlementAdvanceError } from '../../src/app/finance/errors/advance.errors';
import { ExpenseClaimAccountError } from '../../src/app/finance/errors/expense.errors';

const rp = (rupiah: number) => rupiah * 100;
const as = (user: string) => ({ organizationId: 'org-1', actorUserId: user });

function harness() {
	const advances = new Map<string, Record<string, any>>();
	const settlements = new Map<string, Record<string, any>>();
	const items: Array<Record<string, any>> = [];
	const posted: Array<{ lines: Array<Record<string, any>>; eventType: string }> = [];
	let seq = 0;
	const service = new EmployeeAdvanceService(
		{
			paginateAdvances: async () => ({ data: [...advances.values()], meta: {} }) as never,
			findAdvance: async (_o: string, id: string) => (advances.get(id) ?? null) as never,
			insertAdvance: async (row: Record<string, unknown>) => {
				const created = { ...row, id: `adv-${++seq}` };
				advances.set(created.id, created);
				return created as never;
			},
			updateAdvance: async (_o: string, id: string, patch: Record<string, unknown>) => Object.assign(advances.get(id)!, patch) as never,
			paginateSettlements: async () => ({ data: [], meta: {} }) as never,
			findSettlement: async (_o: string, id: string) => (settlements.get(id) ?? null) as never,
			listSettlementsForAdvance: async (_o: string, advanceId: string) => [...settlements.values()].filter((s) => s.employeeAdvanceId === advanceId) as never,
			insertSettlement: async (row: Record<string, unknown>) => {
				const created = { advanceOffsetAmount: 0, payableAmount: 0, paidAmount: 0, ...row, id: `set-${++seq}` };
				settlements.set(created.id, created);
				return created as never;
			},
			updateSettlement: async (_o: string, id: string, patch: Record<string, unknown>) => Object.assign(settlements.get(id)!, patch) as never,
			listSettlementItems: async (_o: string, id: string) => items.filter((item) => item.expenseSettlementId === id) as never,
			insertSettlementItems: async (rows: Array<Record<string, unknown>>) => {
				items.push(...rows);
				return rows as never;
			},
		},
		{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
		{ next: async (type: string) => `${type}-1` },
		{
			findAccountByCode: async (_o: string, code: string) =>
				code.startsWith('6-') ? ({ id: `acc-${code}`, accountType: 'expense', isActive: true, isPostable: true } as never) : null,
		},
		{ resolveAccountId: async (_o: string, lookup: { role: string }) => `acc-${lookup.role}` },
		{
			post: async (_tx: unknown, input: never) => {
				posted.push(input);
				return { entry: { id: 'je-set' } } as never;
			},
		} as never,
		{ findEmployeeById: async () => ({ id: 'emp-1', organizationId: 'org-1', employmentStatus: 'active' }) as never },
	);
	return { service, advances, settlements, posted };
}

async function disbursedAdvance(h: ReturnType<typeof harness>, amount = rp(2_000_000)) {
	const advance = await h.service.createAdvance(as('staff'), {
		employeeId: 'emp-1',
		projectId: 'prj-1',
		amount,
		requestDate: '2026-11-02',
		purpose: 'Instalasi akses kontrol di Bandung',
	});
	await h.service.submitAdvance(as('staff'), advance.id);
	await expect(h.service.approveAdvance(as('staff'), advance.id)).rejects.toThrow(AdvanceSameActorError);
	await h.service.approveAdvance(as('manager'), advance.id);
	expect(await h.service.payable('org-1', 'employee_advance', advance.id, 'out')).toEqual({ outstanding: amount, exact: true, employeeId: 'emp-1' });
	await h.service.applyPayment('org-1', 'employee_advance', advance.id, 'out', amount, 'pay-1', {} as never);
	return advance;
}

const settle = (h: ReturnType<typeof harness>, advanceId: string, amounts: number[]) =>
	h.service.createSettlement(as('staff'), {
		employeeAdvanceId: advanceId,
		settlementDate: '2026-11-20',
		notes: null,
		items: amounts.map((amount, index) => ({
			expenseDate: '2026-11-10',
			categoryCode: index === 0 ? '6-2100' : '6-2200',
			description: null,
			amount,
			taxAmount: 0,
		})),
	});

async function approve(h: ReturnType<typeof harness>, id: string) {
	await h.service.submitSettlement(as('staff'), id);
	await expect(h.service.verifySettlement(as('staff'), id)).rejects.toThrow(AdvanceSameActorError);
	await h.service.verifySettlement(as('finance'), id);
	await expect(h.service.approveSettlement(as('finance'), id)).rejects.toThrow(AdvanceSameActorError);
	return h.service.approveSettlement(as('manager'), id);
}

describe('employee advances', () => {
	test('approved advance is disbursed by a payment; only disbursed advances settle', async () => {
		const h = harness();
		const advance = await disbursedAdvance(h);
		expect(h.advances.get(advance.id)).toMatchObject({ status: 'disbursed', paymentId: 'pay-1' });
		await expect(h.service.cancelAdvance(as('manager'), advance.id)).rejects.toThrow(AdvanceStateError);
		expect(await h.service.payable('org-1', 'employee_advance', advance.id, 'out')).toBeNull();
	});

	test('expenses below the advance offset it; the employee returns the rest by receipt', async () => {
		const h = harness();
		const advance = await disbursedAdvance(h);
		const settlement = await settle(h, advance.id, [rp(1_200_000), rp(300_000)]);
		await expect(settle(h, advance.id, [rp(1)])).rejects.toThrow(SettlementAdvanceError);
		const approved = await approve(h, settlement.id);
		expect(approved).toMatchObject({ status: 'approved', advanceOffsetAmount: rp(1_500_000), payableAmount: 0, journalEntryId: 'je-set' });
		expect(h.posted[0]!.eventType).toBe('finance.advance_settled');
		expect(h.posted[0]!.lines).toEqual([
			{ accountId: 'acc-6-2100', debit: rp(1_200_000), credit: 0, projectId: 'prj-1' },
			{ accountId: 'acc-6-2200', debit: rp(300_000), credit: 0, projectId: 'prj-1' },
			{ accountId: 'acc-employee_advance', debit: 0, credit: rp(1_500_000), partyType: 'employee', partyId: 'emp-1' },
		]);
		expect(h.advances.get(advance.id)).toMatchObject({ settledAmount: rp(1_500_000), status: 'disbursed' });
		expect(await h.service.payable('org-1', 'employee_advance', advance.id, 'in')).toEqual({ outstanding: rp(500_000), exact: false, employeeId: 'emp-1' });
		await h.service.applyPayment('org-1', 'employee_advance', advance.id, 'in', rp(500_000), 'pay-2', {} as never);
		expect(h.advances.get(advance.id)).toMatchObject({ settledAmount: rp(2_000_000), status: 'settled' });
	});

	test('expenses above the advance: the excess is owed to the employee and paid out', async () => {
		const h = harness();
		const advance = await disbursedAdvance(h, rp(1_000_000));
		const settlement = await settle(h, advance.id, [rp(1_250_000)]);
		await approve(h, settlement.id);
		expect(h.posted[0]!.lines.slice(-2)).toEqual([
			{ accountId: 'acc-employee_advance', debit: 0, credit: rp(1_000_000), partyType: 'employee', partyId: 'emp-1' },
			{ accountId: 'acc-claim_payable', debit: 0, credit: rp(250_000), partyType: 'employee', partyId: 'emp-1' },
		]);
		expect(h.advances.get(advance.id)!.status).toBe('settled');
		expect(await h.service.payable('org-1', 'expense_settlement', settlement.id, 'out')).toEqual({ outstanding: rp(250_000), exact: false, employeeId: 'emp-1' });
		await h.service.applyPayment('org-1', 'expense_settlement', settlement.id, 'out', rp(250_000), 'pay-3', {} as never);
		expect(h.settlements.get(settlement.id)).toMatchObject({ status: 'paid', paidAmount: rp(250_000), paymentId: 'pay-3' });
	});

	test('a settlement line must use an active expense account', async () => {
		const h = harness();
		const advance = await disbursedAdvance(h);
		await expect(
			h.service.createSettlement(as('staff'), {
				employeeAdvanceId: advance.id,
				settlementDate: '2026-11-20',
				notes: null,
				items: [{ expenseDate: '2026-11-10', categoryCode: '1-1110', description: null, amount: 1, taxAmount: 0 }],
			}),
		).rejects.toThrow(ExpenseClaimAccountError);
	});
});
