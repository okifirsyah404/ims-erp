/**
 * Base URL of the backend API, shared by the feature clients.
 *
 * @remarks
 * Falls back to `localhost:3000` only so a missing `.env` produces a visible
 * connection error instead of a `undefined/users/me` request.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
