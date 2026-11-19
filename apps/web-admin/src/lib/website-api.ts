import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * Typed client for the public website's identity, navigation and API keys
 * (`/website/*`, ERP-0071 stage 1).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const SOCIAL_KEYS = ['instagram', 'linkedin', 'youtube', 'facebook', 'tiktok', 'x', 'whatsapp'] as const;
export type TSocialKey = (typeof SOCIAL_KEYS)[number];

export type TWebSite = {
	brandName: string;
	legalName: string | null;
	tagline: string | null;
	address: string | null;
	phone: string | null;
	email: string | null;
	whatsapp: string | null;
	hotlineHours: string | null;
	supportEmail: string | null;
	supportWhatsapp: string | null;
	socialLinks: { key: TSocialKey; url: string }[];
	defaultSeoTitle: string | null;
	defaultSeoDescription: string | null;
};

export const WEB_MENU_CODES = ['main', 'footer'] as const;
export type TWebMenuCode = (typeof WEB_MENU_CODES)[number];

export type TMenuItem = { label: string; url: string; isActive: boolean };
export type TWebMenu = {
	code: TWebMenuCode;
	name: string;
	items: TMenuItem[];
	children: { name: string; isActive: boolean; items: TMenuItem[] }[];
};

export type TWebsiteKey = { id: string; name: string | null; start: string | null; enabled: boolean; createdAt: string; lastRequest: string | null };
export type TCreatedWebsiteKey = { id: string; key: string; start: string | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			'Accept-Language': currentLanguage(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope.data as T;
}

const send = <T>(path: string, method: string, body?: unknown) =>
	request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const websiteSiteQueryOptions = () =>
	queryOptions({ queryKey: ['website', 'site'] as const, queryFn: () => request<TWebSite | null>('/website/site') });

export const websiteMenuQueryOptions = (code: TWebMenuCode) =>
	queryOptions({ queryKey: ['website', 'menu', code] as const, queryFn: () => request<TWebMenu>(`/website/menus/${code}`) });

export const websiteKeysQueryOptions = () =>
	queryOptions({ queryKey: ['website', 'keys'] as const, queryFn: () => request<TWebsiteKey[]>('/website/keys') });

export const saveWebsiteSite = (site: TWebSite) => send<TWebSite>('/website/site', 'PUT', site);
export const saveWebsiteMenu = (code: TWebMenuCode, menu: Omit<TWebMenu, 'code'>) => send<TWebMenu>(`/website/menus/${code}`, 'PUT', menu);
export const createWebsiteKey = (name: string) => send<TCreatedWebsiteKey>('/website/keys', 'POST', { name });
export const revokeWebsiteKey = (id: string) => send<null>(`/website/keys/${encodeURIComponent(id)}`, 'DELETE');
