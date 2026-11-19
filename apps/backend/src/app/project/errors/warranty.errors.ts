import { AppError } from '@http/errors';

/** A warranty needs an issued BAST of the same project (its start date). */
export class WarrantyBastRequiredError extends AppError {
	constructor() {
		super(422, 'aftersales.warrantyBastRequired', 'Pick an issued BAST of this project: the warranty starts at its date');
	}
}

/** A cancelled project gets no warranty. */
export class WarrantyProjectCancelledError extends AppError {
	constructor() {
		super(422, 'aftersales.warrantyProjectCancelled', 'The project is cancelled');
	}
}

/** Two saves raced to create the project's certificate. */
export class WarrantyExistsError extends AppError {
	constructor() {
		super(409, 'aftersales.warrantyExists', 'This project already has a warranty certificate');
	}
}
