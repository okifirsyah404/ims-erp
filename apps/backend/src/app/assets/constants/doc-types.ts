/**
 * Asset module document types for ERP-0009 numbering (D15).
 *
 * @remarks
 * Document types of the one numbering service
 * (`organization.document_sequences`, company-wide); every asset document
 * code comes from `CodeNumberService.next` inside the document's transaction
 * — no `Math.random()`, no local counters (hardening plan Phase A-2).
 */
export const ASSET_DOC_TYPES = {
	/** Asset register codes: `AST-<#6>`. */
	asset: 'asset',
	/** Maintenance/service records: `MNT-YYYY-<#5>`. */
	maintenance: 'asset_maintenance',
	/** Disposal records: `DSP-YYYY-<#5>`. */
	disposal: 'asset_disposal',
	/** Tool sets: `TST-<#5>`. */
	toolSet: 'asset_tool_set',
	/** Borrowing documents: `BRW-YYYYMM-<#4>`. */
	borrowing: 'asset_borrowing',
} as const;

export type AssetDocType = (typeof ASSET_DOC_TYPES)[keyof typeof ASSET_DOC_TYPES];
