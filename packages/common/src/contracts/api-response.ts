import type { TPaginationMeta } from './pagination.js';

export type TApiErrorMessage = {
	field?: string | null;
	message: string;
};

export type TApiResponseMeta = {
	requestId: string;
	status: number;
	message: string;
	timestamp: number;
};

export type TApiResponse<T = null> = TApiResponseMeta & {
	errors?: TApiErrorMessage[];
	data: T | null;
};

export type TApiPaginatedResponse<T> = TApiResponseMeta & {
	errors?: TApiErrorMessage[];
	pagination: TPaginationMeta;
	data: T[];
};
