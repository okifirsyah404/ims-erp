/**
 * Asset module document-type keys for ERP-0009 numbering (D15).
 *
 * @remarks
 * Stable keys into `organization.document_sequences`; every asset document
 * code is sequence-allocated through the shared DocumentNumberingService —
 * no `Math.random()`, no local counters (hardening plan Phase A-2).
 * Global-scope assets (organizationId null) share the empty-string key,
 * same convention as inventory.
 */
export const ASSET_DOC_TYPES = {
	/** Asset register codes: `AST-<...>-<#6>`. */
	asset: 'asset',
	/** Maintenance/service records: `MNT-<...>-<#5>`. */
	maintenance: 'asset_maintenance',
	/** Disposal records: `DSP-<...>-<#5>`. */
	disposal: 'asset_disposal',
	/** Borrowing documents: `BRW-YYYYMM-<#4>`. */
	borrowing: 'asset_borrowing',
} as const;

export type AssetDocType = (typeof ASSET_DOC_TYPES)[keyof typeof ASSET_DOC_TYPES];
