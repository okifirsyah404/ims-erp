import { AppError } from '@http/errors';

/** The website API key is unknown or belongs to another organization (ERP-0071). */
export class WebsiteKeyNotFoundError extends AppError {
	constructor() {
		super(404, 'commerce.websiteKeyNotFound', 'Website key not found');
	}
}

/** The website content entry is unknown or deleted (ERP-0071). */
export class WebPageNotFoundError extends AppError {
	constructor() {
		super(404, 'commerce.webPageNotFound', 'Website content not found');
	}
}

/** Someone saved the entry since it was loaded; reload and save again. */
export class WebPageStaleError extends AppError {
	constructor() {
		super(409, 'commerce.webPageStale', 'This content was changed by someone else. Reload it and try again.');
	}
}

/** Another live entry of the same type already uses the slug. */
export class WebPageSlugTakenError extends AppError {
	constructor() {
		super(409, 'commerce.webPageSlugTaken', 'Another entry of this type already uses this address');
	}
}

/** The content does not match its type, or a single page is not at slug `home`. */
export class WebPageContentInvalidError extends AppError {
	constructor(issues: string[]) {
		super(400, 'commerce.webPageContentInvalid', `Invalid content: ${issues.slice(0, 3).join('; ')}`, { count: issues.length });
	}
}

/** The upload is not a decodable image or is too large. */
export class WebsiteImageInvalidError extends AppError {
	constructor(maxMb: number) {
		super(422, 'commerce.websiteImageInvalid', 'Upload a PNG, JPG, WebP or HEIC image', { max: maxMb });
	}
}

/** The website image is unknown or deleted. */
export class WebAssetNotFoundError extends AppError {
	constructor() {
		super(404, 'commerce.webAssetNotFound', 'Image not found');
	}
}
