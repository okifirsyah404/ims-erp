/**
 * ERP permission types for the frontend.
 *
 * The vocabulary is imported from the shared browser-safe catalog
 * (`@ims-erp/common`), which the backend's organization access control is
 * also built from - the two can no longer drift.
 *
 * IMPORTANT: frontend permission checks are UX only. The backend enforces
 * every permission and record-level policy server-side.
 */
import { erpStatements, portalStatements, builtInOrgStatements } from '@ims-erp/common';

export {
	erpRoleGrants,
	erpRoleNames,
} from '@ims-erp/common';

export type { ErpResource, ErpRoleName } from '@ims-erp/common';

/** Permission string, e.g. `quotation.approve` (resource.action). */
export type Permission =
	| {
			[R in keyof typeof erpStatements]: `${R & string}.${(typeof erpStatements)[R][number] & string}`;
	  }[keyof typeof erpStatements]
	| {
			[R in keyof typeof portalStatements]: `${R & string}.${(typeof portalStatements)[R][number] & string}`;
	  }[keyof typeof portalStatements]
	| {
			[R in keyof typeof builtInOrgStatements]: `${R & string}.${(typeof builtInOrgStatements)[R][number] & string}`;
	  }[keyof typeof builtInOrgStatements];
