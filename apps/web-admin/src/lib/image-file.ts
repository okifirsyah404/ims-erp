/**
 * Which file a click/drop should hand to the uploader (ERP-0041).
 *
 * Only image MIME types are accepted; anything else (including a folder drag,
 * which surfaces as a non-image type) is rejected so the caller can toast
 * instead of trying to decode it into WebP.
 */
export function pickImageFile(file: File | null | undefined): File | null {
	if (!file) return null;
	return file.type.startsWith('image/') ? file : null;
}
