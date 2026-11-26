import { findInvalidPoPlaceholders } from '@ims-erp/common';
import { PurchaseTermPlaceholderError } from '../errors/procurement.errors';

/**
 * Refuses payment terms, purchase terms or notes holding an unknown or
 * malformed `{{placeholder}}` (ERP-0165), so a typo is caught when the text
 * is saved rather than on the printed order.
 *
 * @throws {PurchaseTermPlaceholderError}
 */
export function assertTermPlaceholders(texts: (string | null | undefined)[]): void {
	const invalid = [...new Set(texts.flatMap((text) => findInvalidPoPlaceholders(text)))];
	if (invalid.length) throw new PurchaseTermPlaceholderError(invalid);
}
