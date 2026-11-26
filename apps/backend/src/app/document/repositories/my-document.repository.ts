import { and, count, desc, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DRIZZLE_TOKEN } from '@di/provider';
import { documents, documentFiles, documentSignatureRequests } from '@drizzle/schemas/document.schema';
import { employees } from '@drizzle/schemas/human-resource.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';

/** Page settings of the portal's document list. */
export type TMyDocumentPageRequest = {
	page: number;
	limit: number;
	search: string | null;
};

/** One row of the caller's own document list. */
export type TMyDocumentRow = {
	id: string;
	code: string;
	title: string;
	documentType: string;
	status: string;
	issuedOn: string | null;
	createdAt: Date;
	/** Set when the document is waiting for the caller's signature. */
	pendingSignatureRequestId: string | null;
	/** Newest live file, if any; the portal links straight to it. */
	fileId: string | null;
	fileName: string | null;
};

/** The employee-record document source (`human_resource` / `employee`). */
const EMPLOYEE_DOCUMENT_MODULE = 'human_resource';
const EMPLOYEE_DOCUMENT_SOURCE = 'employee';

/**
 * Documents that concern one user, for the employee portal (Phase C).
 *
 * @remarks
 * Two disjoint sets, unioned inside the query rather than in memory:
 * - documents the user must sign — `document.signature_requests` addressed to
 *   them — whatever module issued them;
 * - documents of the user's own **employee record** (contract, SK, certificate,
 *   payslip): `module='human_resource'`, `source_type='employee'`,
 *   `source_id = <employee id>` resolved from `hr.employees.user_id`.
 *
 * The second half reads `human_resource.employees` by id only (module-ownership
 * §9: a logical reference with no business rule attached), and the page itself
 * is paginated in SQL so a large tenant is never materialised.
 */
@injectable()
export class MyDocumentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate(userId: string, request: TMyDocumentPageRequest): Promise<TPaginationResult<TMyDocumentRow>> {
		// Pending requests addressed to the caller: a plain `IN` subquery (the
		// page join below merges the request id per row, so duplicates here are
		// harmless and no GROUP BY derived table is needed).
		const pendingDocumentIds = this.database
			.select({ id: documentSignatureRequests.documentId })
			.from(documentSignatureRequests)
			.where(
				and(
					eq(documentSignatureRequests.signerUserId, userId),
					eq(documentSignatureRequests.status, 'pending'),
				),
			);

		// `documents.source_id` is text (it holds ids of many modules), so the
		// employee uuid is cast instead of the column: a cast on the column would
		// defeat the index.
		const issuedToCaller = exists(
			this.database
				.select({ one: sql`1` })
				.from(employees)
				.where(
					and(
						eq(employees.userId, userId),
						isNull(employees.deletedAt),
						sql`${documents.sourceId} = ${employees.id}::text`,
					),
				),
		);

		const where = and(
			isNull(documents.deletedAt),
			request.search
				? or(ilike(documents.title, `%${request.search}%`), ilike(documents.code, `%${request.search}%`))
				: undefined,
			or(
				and(
					eq(documents.module, EMPLOYEE_DOCUMENT_MODULE),
					eq(documents.sourceType, EMPLOYEE_DOCUMENT_SOURCE),
					issuedToCaller,
				),
				// Waiting for the caller's signature.
				inArray(documents.id, pendingDocumentIds),
			),
		);

		const [{ value: total }] = await this.database.select({ value: count() }).from(documents).where(where);
		const rows = await this.database
			.select({
				id: documents.id,
				code: documents.code,
				title: documents.title,
				documentType: documents.documentType,
				status: documents.status,
				issuedOn: documents.issuedOn,
				createdAt: documents.createdAt,
			})
			.from(documents)
			.where(where)
			.orderBy(desc(documents.createdAt), desc(documents.id))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);

		// One pending request id per listed document, in one query for the page.
		const pending = rows.length
			? await this.database
					.select({
						id: documentSignatureRequests.id,
						documentId: documentSignatureRequests.documentId,
					})
					.from(documentSignatureRequests)
					.where(
						and(
							eq(documentSignatureRequests.signerUserId, userId),
							eq(documentSignatureRequests.status, 'pending'),
							inArray(
								documentSignatureRequests.documentId,
								rows.map((row) => row.id),
							),
						),
					)
			: [];
		const pendingByDocument = new Map<string, string>();
		for (const request of pending) {
			if (!pendingByDocument.has(request.documentId)) pendingByDocument.set(request.documentId, request.id);
		}

		// Newest live file per document, in one extra query for the page.
		const files = rows.length
			? await this.database
					.select({
						documentId: documentFiles.documentId,
						id: documentFiles.id,
						fileName: documentFiles.fileName,
						uploadedAt: documentFiles.uploadedAt,
					})
					.from(documentFiles)
					.where(
						and(
							inArray(
								documentFiles.documentId,
								rows.map((row) => row.id),
							),
							isNull(documentFiles.deletedAt),
						),
					)
					.orderBy(desc(documentFiles.uploadedAt), desc(documentFiles.id))
			: [];
		const newest = new Map<string, { id: string; fileName: string }>();
		for (const file of files) {
			if (!newest.has(file.documentId)) newest.set(file.documentId, { id: file.id, fileName: file.fileName });
		}
		const data = rows.map((row) => {
			const file = newest.get(row.id) ?? null;
			return {
				...row,
				pendingSignatureRequestId: pendingByDocument.get(row.id) ?? null,
				fileId: file?.id ?? null,
				fileName: file?.fileName ?? null,
			};
		});

		return paginationResult({ page: request.page, limit: request.limit }, Number(total ?? 0), data);
	}
}





