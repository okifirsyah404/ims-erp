import { AppError } from '@http/errors';

export const MAX_ORG_IMAGE_MB = 2;

/**
 * The uploaded file is not a recognisable image (magic bytes, not the
 * spoofable content-type header) or exceeds the size cap.
 *
 * @remarks
 * The client no longer has to produce WebP: it downscales and sends WebP when
 * the browser can, otherwise PNG/JPEG/HEIC as-is. The server normalises every
 * accepted image to WebP (ERP-0041).
 */
export class OrganizationImageInvalidError extends AppError {
	constructor() {
		super(
			422,
			'common.imageInvalid',
			'Upload a PNG, JPG, WebP or HEIC image',
			{ max: MAX_ORG_IMAGE_MB },
		);
	}
}

/**
 * Validates the multipart `file` field: a non-empty blob at most 2 MB.
 *
 * @remarks
 * Only the size and shape are checked here — the format is decided by
 * {@link toWebp} from the actual bytes, because the multipart `Content-Type`
 * is supplied by the client and therefore untrustworthy.
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
