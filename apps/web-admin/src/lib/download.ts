/**
 * Downloads a server-generated file with the session cookie attached.
 *
 * @remarks
 * A plain `<a href>` would be a cross-origin navigation to `VITE_API_URL`, so
 * the cookie policy - not our code - would decide whether the session travels.
 * Fetching with `credentials: 'include'` and saving the blob keeps the
 * permission check on the server and works the same in dev and prod.
 */
export async function downloadFile(
	path: string,
	filename: string,
): Promise<void> {
	const response = await fetch(
		`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${path}`,
		{ credentials: 'include' },
	);
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as
			| { errors?: Array<{ message?: string }> }
			| null;
		throw new Error(body?.errors?.[0]?.message ?? 'Download failed');
	}
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
