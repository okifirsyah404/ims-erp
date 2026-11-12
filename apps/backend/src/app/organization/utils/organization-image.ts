import { AppError } from '@http/errors';

export const MAX_ORG_IMAGE_MB = 2;

/**
 * The uploaded file is not a WebP image (by magic bytes, not the spoofable
 * content-type header) or exceeds the size cap. The frontend is responsible
 * for encoding WebP; the server only validates (ERP-0041 decision).
 */
export class OrganizationImageInvalidError extends AppError {
	constructor() {
		super(
			422,
			'common.imageInvalid',
			'Upload a WebP image',
			{ max: MAX_ORG_IMAGE_MB },
		);
	}
}

/**
 * Validates the multipart `file` field as a WebP image: RIFF container with
 * a WEBP form type at bytes 8-11, non-empty, at most 2 MB. Returns the file
 * for direct storage — no server-side conversion.
 *
 * @throws OrganizationImageInvalidError otherwise
 */
export function organizationImageFrom(body: unknown): File {
	const file =
		body && typeof body === 'object' ? (body as { file?: unknown }).file : undefined;
	const validSize =
		file instanceof File && file.size > 0 && file.size <= MAX_ORG_IMAGE_MB * 1024 * 1024;
	if (!validSize) throw new OrganizationImageInvalidError();
	return file;
}

/**
 * Buffer-level WebP check (magic bytes): `RIFF` + 4-byte size + `WEBP`.
 * Async because the bytes are read from the File after size validation.
 */
export async function isWebpBuffer(file: File): Promise<boolean> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	return (
		head.length >= 12 &&
		head[0] === 0x52 && // R
		head[1] === 0x49 && // I
		head[2] === 0x46 && // F
		head[3] === 0x46 && // F
		head[8] === 0x57 && // W
		head[9] === 0x45 && // E
		head[10] === 0x42 && // B
		head[11] === 0x50 //   P
	);
}
