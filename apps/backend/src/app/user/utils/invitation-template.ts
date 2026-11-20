import * as XLSX from 'xlsx';
import { INVITE_SHEET_HEADERS } from '@ims-erp/common';

/**
 * Builds the bulk-invite template file (xlsx or csv) for download.
 *
 * @remarks
 * Shared by the app-scope and org-scope template endpoints. Header contract
 * comes from the shared parser so the file round-trips exactly.
 */
export function buildInvitationTemplate(
	format: 'xlsx' | 'csv',
): { body: ArrayBuffer; contentType: string; fileName: string } {
	const sample = [
		[...INVITE_SHEET_HEADERS],
		// Multi-role cells are pipe-separated; the comma stays the field
		// separator (ERP-0041). `employmentType` is the employee profile the
		// invite creates; an empty cell falls back to the dialog's switch.
		['budi@example.com', 'Budi Santoso', 'my-org-slug', 'member', 'permanent'],
		['ani@example.com', 'Ani Lestari', 'my-org-slug', 'admin|finance', 'contract'],
		['sari@example.com', 'Sari Dewi', '', '', ''],
	];
	if (format === 'csv') {
		const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(sample));
		return {
			body: new TextEncoder().encode(csv).buffer as ArrayBuffer,
			contentType: 'text/csv; charset=utf-8',
			fileName: 'invitation-template.csv',
		};
	}
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet(sample),
		'Invites',
	);
	const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
	return {
		body: buffer,
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: 'invitation-template.xlsx',
	};
}
