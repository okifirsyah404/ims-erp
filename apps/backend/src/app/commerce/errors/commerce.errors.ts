import { AppError } from '@http/errors';

/** The website API key is unknown or belongs to another organization (ERP-0071). */
export class WebsiteKeyNotFoundError extends AppError {
	constructor() {
		super(404, 'commerce.websiteKeyNotFound', 'Website key not found');
	}
}
