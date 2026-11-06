/**
 * File rules for project evidence and cost receipts (pure, no I/O). Types
 * are detected from the file content, never from the name.
 */
export const PROJECT_FILE_MAX_BYTES = 15 * 1024 * 1024;

/** JPEG / PNG / WebP / PDF from the first bytes; `null` otherwise. */
export function sniffProjectFile(bytes: Uint8Array): { contentType: string; ext: string } | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' };
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { contentType: 'image/png', ext: 'png' };
	}
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
	if (ascii(0, 5) === '%PDF-') return { contentType: 'application/pdf', ext: 'pdf' };
	return null;
}

/** A safe display name; storage keys never use it. */
export function cleanFileName(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? 'file';
	const cleaned = base.replace(/[^\w.\- ()]/g, '_').trim();
	return (cleaned || 'file').slice(-200);
}
