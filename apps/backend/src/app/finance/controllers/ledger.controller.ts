import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	accountCreateSchema,
	accountListQuerySchema,
	accountUpdateSchema,
	cashBankAccountCreateSchema,
	cashBankAccountUpdateSchema,
	cashBankMovementListQuerySchema,
	cashBankMovementSchema,
	journalEntryCreateSchema,
	journalEntryListQuerySchema,
	journalReversalCreateSchema,
	ledgerIdParamSchema,
	openingBalanceRowSchema,
	openingBalanceUpdateSchema,
	periodCreateSchema,
	periodListQuerySchema,
	periodTransitionSchema,
} from '../contracts/ledger.contract';
import {
	ACCOUNT_SERVICE_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	OPENING_BALANCE_SERVICE_TOKEN,
	PERIOD_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { AccountService } from '../services/account.service';
import type { PeriodService } from '../services/period.service';
import type { PostingService } from '../services/posting.service';
import type { OpeningBalanceService } from '../services/opening-balance.service';
import type { CashBankService } from '../services/cash-bank.service';

/**
 * REST controller for the ledger slice (M09 F2).
 *
 * @remarks
 * Permissions come from the existing resources in `erp-permissions.ts`:
 * `chart_of_account` (accountant), `accounting_period` (accountant, with
 * `close`/`reopen`), `journal` (accountant, with `post`/`reverse`). The
 * posting service itself is a service-layer contract for other modules, not
 * an HTTP surface; the `/journal` routes below are for manual accountant
 * entries. Controllers only parse, call the service, and envelope.
 */
export class LedgerController {
	/** Builds the Elysia plugin mounting `/accounts`, `/periods`, `/journal`. */
	static plugin() {
		const accounts = container.resolve<AccountService>(ACCOUNT_SERVICE_TOKEN);
		const periods = container.resolve<PeriodService>(PERIOD_SERVICE_TOKEN);
		const posting = container.resolve<PostingService>(POSTING_SERVICE_TOKEN);
		const openingBalances = container.resolve<OpeningBalanceService>(
			OPENING_BALANCE_SERVICE_TOKEN,
		);
		const cashBank =
			container.resolve<CashBankService>(CASH_BANK_SERVICE_TOKEN);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'ledger',
			prefix: '/finance',
			tags: ['Accounting'],
			guards: 'erp',
		})
			/* ---------------- chart of accounts ---------------- */
			.get(
				'/ledger/accounts',
				async ({ query, erp }) =>
					okPaginated(
						await accounts.listAccounts({
							organizationId: erp.organizationId,
							...accountListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['chart_of_account:read'] },
					detail: { description: 'Paginated chart of accounts' },
				},
			)
			.get(
				'/ledger/accounts/:id',
				async ({ params, erp }) =>
					ok(
						await accounts.getAccount(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['chart_of_account:read'] },
					detail: { description: 'One chart-of-accounts row' },
				},
			)
			.post(
				'/ledger/accounts',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await accounts.createAccount(
								erp.organizationId,
								accountCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['chart_of_account:create'] },
					detail: { description: 'Creates a chart-of-accounts row' },
				},
			)
			.patch(
				'/ledger/accounts/:id',
				async ({ params, body, erp }) =>
					ok(
						await accounts.updateAccount(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
							accountUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['chart_of_account:update'] },
					detail: { description: 'Edits a chart-of-accounts row' },
				},
			)
			.delete(
				'/ledger/accounts/:id',
				async ({ params, erp }) =>
					ok(
						await accounts.archiveAccount(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['chart_of_account:archive'] },
					detail: {
						description:
							'Deactivates an account that has no journal history',
					},
				},
			)
			/* ---------------- accounting periods ---------------- */
			.get(
				'/periods',
				async ({ query, erp }) =>
					okPaginated(
						await periods.listPeriods({
							organizationId: erp.organizationId,
							...periodListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['accounting_period:read'] },
					detail: { description: 'Paginated accounting periods' },
				},
			)
			.post(
				'/periods',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await periods.ensurePeriod(
								erp.organizationId,
								periodCreateSchema.parse(body).periodYear,
								periodCreateSchema.parse(body).periodMonth,
							),
						),
					),
				{
					erp: { permission: ['accounting_period:create'] },
					detail: { description: 'Ensures the period for a month exists' },
				},
			)
			.post(
				'/periods/:id/transition',
				async ({ params, body, erp }) =>
					ok(
						await periods.transition(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
							periodTransitionSchema.parse(body).to,
							ctxOf(erp),
						),
					),
				{
					erp: {
						// `locked -> open` stays owner-only: the `reopen` permission is
						// not granted to the plain accountant role (erp-permissions.ts).
						permission: ['accounting_period:close'],
						ownership: { reopen: 'owner' },
					},
					detail: {
						description:
							'Moves a period through open/closed/locked (reopen audited)',
					},
				},
			)
			/* ---------------- journal entries (manual, accountant) ---------------- */
			.get(
				'/ledger/journal',
				async ({ query, erp }) =>
					okPaginated(
						await posting.listEntries({
							organizationId: erp.organizationId,
							...journalEntryListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['journal:read'] },
					detail: { description: 'Paginated journal entries' },
				},
			)
			.get(
				'/ledger/journal/:id',
				async ({ params, erp }) =>
					ok(
						await posting.getEntry(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['journal:read'] },
					detail: { description: 'One journal entry with its lines' },
				},
			)
			.post(
				'/ledger/journal',
				async ({ body, erp, status }) => {
					const input = journalEntryCreateSchema.parse(body);
					return status(
						201,
						created(
							await posting.postManual(
								ctxOf(erp),
								{
									entryDate: input.entryDate,
									description: input.description,
									idempotencyKey: input.idempotencyKey,
									lines: input.lines,
								},
							),
						),
					);
				},
				{
					erp: { permission: ['journal:post'] },
					detail: {
						description:
							'Posts a manual balanced journal entry (accountant)',
					},
				},
			)
			.post(
				'/ledger/journal/:id/reverse',
				async ({ params, body, erp }) =>
					ok(
						await posting.reverseManual(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							journalReversalCreateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['journal:reverse'] },
					detail: {
						description:
							'Reverses a posted entry with a mirrored, append-only entry',
					},
				},
			)
			/* ---------------- opening balances (F3) ---------------- */
			.get(
				'/ledger/opening-balances',
				async ({ erp }) =>
					ok(await openingBalances.list(erp.organizationId)),
				{
					erp: { permission: ['journal:read'] },
					detail: { description: 'Lists the opening-balance draft/posted rows' },
				},
			)
			.post(
				'/ledger/opening-balances',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await openingBalances.addRow(
								ctxOf(erp),
								openingBalanceRowSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['journal:create'] },
					detail: {
						description:
							'Adds (or merges into) a draft opening-balance row for (account, as-of date)',
					},
				},
			)
			.patch(
				'/ledger/opening-balances/:id',
				async ({ params, body, erp }) =>
					ok(
						await openingBalances.updateRow(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							openingBalanceUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['journal:update'] },
					detail: { description: 'Edits a draft opening-balance row' },
				},
			)
			.delete(
				'/ledger/opening-balances/:id',
				async ({ params, erp }) =>
					ok(
						await openingBalances.removeRow(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['journal:update'] },
					detail: { description: 'Removes a draft opening-balance row' },
				},
			)
			.post(
				'/ledger/opening-balances/post',
				async ({ erp }) =>
					ok(await openingBalances.post(ctxOf(erp))),
				{
					erp: { permission: ['journal:post'] },
					detail: {
						description:
							'Posts the draft batch as ONE journal entry (must balance; once only)',
					},
				},
			)
			/* ---------------- cash/bank (F3) ---------------- */
			.get(
				'/cash-bank-accounts',
				async ({ erp }) =>
					ok(await cashBank.listAccounts(erp.organizationId)),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'Lists cash/bank accounts with balances' },
				},
			)
			.get(
				'/cash-bank-accounts/:id',
				async ({ params, erp }) =>
					ok(
						await cashBank.getAccount(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'One cash/bank account' },
				},
			)
			.post(
				'/cash-bank-accounts',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await cashBank.createAccount(
								ctxOf(erp),
								cashBankAccountCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['cash_bank:create'] },
					detail: { description: 'Creates a cash/bank account (link optional)' },
				},
			)
			.patch(
				'/cash-bank-accounts/:id',
				async ({ params, body, erp }) =>
					ok(
						await cashBank.updateAccount(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							cashBankAccountUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['cash_bank:update'] },
					detail: { description: 'Edits a cash/bank account (incl. GL link)' },
				},
			)
			.post(
				'/cash-bank-transactions',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await cashBank.postMovement(
								ctxOf(erp),
								cashBankMovementSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['cash_bank:create'] },
					detail: {
						description:
							'Posts a manual cash movement with its auto-journal (GL link required)',
					},
				},
			)
			.get(
				'/cash-bank-transactions',
				async ({ query, erp }) =>
					okPaginated(
						await cashBank.listMovements({
							organizationId: erp.organizationId,
							...cashBankMovementListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['cash_bank:read'] },
					detail: { description: 'Paginated cash/bank movement ledger' },
				},
			);
	}
}
