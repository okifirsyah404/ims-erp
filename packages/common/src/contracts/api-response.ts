import type { TFormErrorKey, TFormErrorParams } from '../forms/form-error.js';
import type { TPaginationMeta } from './pagination.js';

/**
 * One error in the envelope's `errors` list.
 *
 * @remarks
 * `message` is already translated for the request language. Validation
 * errors also carry `key` (a {@link TFormErrorKey} from `forms/form-error`)
 * and its `params`, so a form can re-word the message with its own field
 * label (P7-6, TF-1).
 */
export type TApiErrorMessage = {
	field?: string | null;
	message: string;
	key?: TFormErrorKey;
	params?: TFormErrorParams;
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
