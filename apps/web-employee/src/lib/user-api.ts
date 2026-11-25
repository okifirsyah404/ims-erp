import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { useEffect } from 'react';
import { encodeImage } from './image-file';
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
 * Uploads the avatar (`POST /users/me/avatar`, multipart field `file`)
 * and returns the refreshed profile with a fresh presigned image URL.
 *
 * @remarks
 * The file is downscaled client-side as a fast path; the server normalises
 * whatever arrives to WebP, so a browser without a WebP encoder (or a HEIC
 * photo) still works — {@link encodeImage} falls back to PNG.
 */
export async function uploadSelfAvatar(file: File): Promise<TSelfUser> {
	const encoded = await encodeImage(file, { maxSize: 512 });
	const form = new FormData();
	form.append('file', encoded.blob, `avatar.${encoded.extension}`);
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

/**
 * How long before its expiry a presigned URL is considered stale on the
 * client, in seconds. Absorbs clock skew and slow first paint of the image.
 */
const PRESIGNED_URL_REFRESH_MARGIN_SECONDS = 30;

/** Fallback TTL when a presigned URL carries no readable expiry metadata. */
const PRESIGNED_URL_FALLBACK_TTL_SECONDS = 60;

/**
 * Absolute expiry (epoch ms) of an S3 presigned URL.
 *
 * @remarks
 * SigV4 signs `X-Amz-Date` and `X-Amz-Expires` into the query string, so the
 * deadline is derivable client-side without trusting local clocks that may
 * differ from the signing host: expiry = `X-Amz-Date` + `X-Amz-Expires`.
 *
 * @returns Epoch milliseconds of expiry, or `null` when the URL is not a
 * recognisable SigV4 presigned URL (supports lazy refresh only).
 */
export function presignedUrlExpiresAt(url: string): number | null {
	let parsed: URL;
	try {
		parsed = new URL(url, globalThis.location?.origin);
	} catch {
		return null;
	}
	const params = parsed.searchParams;
	const amzDate = params.get('X-Amz-Date');
	const amzExpires = params.get('X-Amz-Expires');
	if (!amzDate || !amzExpires) return null;

	// Format: YYYYMMDD'T'HHmmss'Z' (UTC, no separators).
	const match =
		/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
	if (!match) return null;
	const issuedAt = Date.UTC(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		Number(match[4]),
		Number(match[5]),
		Number(match[6]),
	);
	const ttlSeconds = Number(amzExpires);
	if (!Number.isFinite(issuedAt) || !Number.isFinite(ttlSeconds)) return null;
	return issuedAt + ttlSeconds * 1000;
}

/**
 * Floor on the reschedule delay. A freshly signed URL can never legitimately
 * be due again within seconds; a sub-floor value means clock skew or an
 * in-flight refresh loop, and would otherwise hot-loop `/users/me`.
 */
const PRESIGNED_URL_MIN_REFRESH_DELAY_MS = 5_000;

/**
 * Milliseconds until a presigned URL should be refreshed, clamped into
 * `[PRESIGNED_URL_MIN_REFRESH_DELAY_MS, TTL - margin]`.
 *
 * @remarks
 * Unparseable URLs fall back to {@link PRESIGNED_URL_FALLBACK_TTL_SECONDS}
 * minus the margin, so a backend signing format change degrades to periodic
 * refreshes instead of a permanently dead avatar.
 */
export function presignedUrlRefreshDelayMs(url: string): number {
	const expiresAt = presignedUrlExpiresAt(url);
	const ttlMs =
		expiresAt === null
			? PRESIGNED_URL_FALLBACK_TTL_SECONDS * 1000
			: expiresAt - Date.now();
	return Math.max(
		PRESIGNED_URL_MIN_REFRESH_DELAY_MS,
		ttlMs - PRESIGNED_URL_REFRESH_MARGIN_SECONDS * 1000,
	);
}

const MAX_REFRESH_BACKOFF_MS = 5 * 60_000;

/**
 * Softly refetches the self user shortly before its presigned avatar URL
 * expires, keeping the sidebar avatar and profile pages live without a
 * hard refresh.
 *
 * @remarks
 * - Invalidation (not `refetch`) is used: `invalidateQueries` keeps the
 *   current data rendered while the new URL loads, so the avatar never
 *   blanks mid-session.
 * - Each successful fetch re-signs a *new* URL with a *new* `X-Amz-Date`,
 *   so the timer reschedules itself off the fresh expiry rather than a
 *   fixed interval.
 * - The timer is armed only while the tab is visible. On return it checks
 *   the cached URL and refetches immediately if it is already near/at
 *   expiry, which also covers sleeping laptops and throttled timers.
 * - Failures back off exponentially (capped) instead of hot-looping: an
 *   offline tab must not hammer `/users/me`.
 * - Unsigned avatar URLs (plain CDN paths) skip the timer entirely.
 */
export function useSelfUserImageRefresh(): void {
	useEffect(() => {
		// Non-SigV4 URLs never expire; nothing to schedule.
		const scheduleFor = (image: string | null | undefined) =>
			image && presignedUrlExpiresAt(image) !== null
				? presignedUrlRefreshDelayMs(image)
				: null;

		let timer: ReturnType<typeof setTimeout> | undefined;
		let failures = 0;
		let disposed = false;
		let refreshing = false;

		const clear = () => {
			if (timer !== undefined) clearTimeout(timer);
			timer = undefined;
		};

		const arm = () => {
			clear();
			if (disposed || document.visibilityState !== 'visible') return;
			const { data } = queryClient.getQueryState<TSelfUser>(
				selfUserQueryOptions.queryKey,
			) ?? { data: undefined };
			const delay = scheduleFor(data?.image);
			if (delay === null) return;
			timer = setTimeout(refresh, delay);
		};

		const refresh = () => {
			timer = undefined;
			if (disposed || refreshing || document.visibilityState !== 'visible')
				return;
			refreshing = true;
			void queryClient
				.invalidateQueries({ queryKey: selfUserQueryOptions.queryKey })
				.then(() => {
					failures = 0;
					arm();
				})
				.catch(() => {
					failures += 1;
					if (disposed) return;
					const backoff = Math.min(
						(2 ** failures - 1) * 5_000,
						MAX_REFRESH_BACKOFF_MS,
					);
					timer = setTimeout(refresh, backoff);
				})
				.finally(() => {
					refreshing = false;
				});
		};

		// Reschedule whenever the cached profile (and thus its URL) changes -
		// covers the initial load, profile edits and post-refresh values.
		const selfKey: readonly unknown[] = selfUserQueryOptions.queryKey;
		const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
			// Skip while a refresh is in flight - its .then(arm) reschedules,
			// avoiding stacked timers during the invalidation round-trip.
			if (refreshing) return;
			const key: readonly unknown[] | undefined = event.query?.queryKey;
			if (
				key?.length === selfKey.length &&
				key.every((part, i) => part === selfKey[i])
			) {
				arm();
			}
		});

		// A hidden tab pauses the timer; a visible one re-arms it, firing
		// immediately when the cached URL is already inside the margin.
		const onVisibility = () => {
			if (document.visibilityState === 'visible') arm();
			else clear();
		};
		document.addEventListener('visibilitychange', onVisibility);

		arm();

		return () => {
			disposed = true;
			clear();
			unsubscribe();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, []);
}
