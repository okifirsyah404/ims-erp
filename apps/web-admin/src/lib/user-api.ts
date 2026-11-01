import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { queryClient } from './query-client';

/**
 * Shape of `GET /users/me`'s `data` (the user module's self profile).
 *
 * @remarks
 * Mirrors the backend's `TUserProfile` (`TUserSelect` with `image` carrying
 * a short-lived presigned S3 GET URL, or null). Kept local to the frontend
 * on purpose: the envelope type comes from `@ims-erp/common`, the row shape
 * tracks the auth schema the backend projects.
 */
export type TSelfUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: string | null;
	banned: boolean;
	username: string | null;
	displayUsername: string | null;
	bio: string | null;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function fetchSelfUser(): Promise<TSelfUser> {
	const response = await fetch(`${API_URL}/users/me`, {
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<TSelfUser>;
	if (!response.ok || !envelope.data) {
		throw new Error(envelope.message ?? 'Failed to load user');
	}
	return envelope.data;
}

/**
 * Self-service profile update (`PATCH /users/me`). Only profile fields —
 * avatar flows through {@link uploadSelfAvatar}, email/password through
 * Better Auth's own endpoints.
 */
export async function updateSelfUser(input: {
	name?: string;
	username?: string;
	bio?: string;
}): Promise<void> {
	const response = await fetch(`${API_URL}/users/me`, {
		method: 'PATCH',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
	});
	if (!response.ok) {
		const envelope = (await response.json()) as TApiResponse<null>;
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Update failed',
		);
	}
}

/**
 * Compresses an image file to a small WebP blob suitable for avatar
 * upload. UX only — the backend revalidates with magic bytes + size cap.
 *
 * Fits within 512x512 and iterates WebP quality down until the blob fits
 * in 2 MiB (at 512px this practically always succeeds on the first pass).
 */
export async function compressAvatar(file: File): Promise<Blob> {
	const MAX_DIMENSION = 512;
	const MAX_BYTES = 2 * 1024 * 1024;
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(
		1,
		MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
	);
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas not supported');
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	for (const quality of [0.85, 0.7, 0.5, 0.35]) {
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/webp', quality),
		);
		if (blob && blob.size <= MAX_BYTES) return blob;
	}
	throw new Error('Could not compress the image small enough');
}

/**
 * Uploads the avatar (`POST /users/me/avatar`, multipart field `file`)
 * and returns the refreshed profile with a fresh presigned image URL.
 */
export async function uploadSelfAvatar(file: File): Promise<TSelfUser> {
	const compressed = await compressAvatar(file);
	const form = new FormData();
	form.append('file', compressed, 'avatar.webp');
	const response = await fetch(`${API_URL}/users/me/avatar`, {
		method: 'POST',
		credentials: 'include',
		body: form,
	});
	const envelope = (await response.json()) as TApiResponse<TSelfUser>;
	if (!response.ok || !envelope.data) {
		throw new Error(
			envelope.errors?.[0]?.message ??
				envelope.message ??
				'Avatar upload failed',
		);
	}
	return envelope.data;
}

/**
 * Self session user (`GET /users/me`). The backend is authoritative for
 * profile fields and the presigned avatar URL; pending/error states must
 * be handled by the consumer (the sidebar degrades, never blocks).
 */
export const selfUserQueryOptions = queryOptions({
	queryKey: ['users', 'me'] as const,
	queryFn: fetchSelfUser,
	staleTime: 60_000,
	retry: 1,
});

/** Invalidates the self-user cache so presigned URLs and fields refresh. */
export const invalidateSelfUser = () =>
	queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
