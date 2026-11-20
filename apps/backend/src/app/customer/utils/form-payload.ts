import { PortalAttachmentsUnsupportedError } from '../errors/portal.errors';

/**
 * Reads a JSON body or the portal's multipart form (`payload` = JSON, files
 * under `photos` / `attachments`). Files are refused in stage 1.
 */
export function formPayload(body: unknown): unknown {
	if (!body || typeof body !== 'object') return body;
	const record = body as Record<string, unknown>;
	const files = [record.photos, record.attachments].flat().filter((file) => file instanceof Blob && file.size > 0);
	if (files.length > 0) throw new PortalAttachmentsUnsupportedError();
	if (typeof record.payload === 'string') {
		try {
			return JSON.parse(record.payload);
		} catch {
			return null;
		}
	}
	// Elysia already parses a JSON-looking multipart field into an object.
	if (record.payload && typeof record.payload === 'object' && !(record.payload instanceof Blob)) return record.payload;
	return body;
}
