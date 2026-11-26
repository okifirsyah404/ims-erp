import { EXPORTED_LOCATION_SERVICE_TOKEN } from '@app/location/constants/di';
import type { ExportedLocationService } from '@app/location/services/exported-location.service';
import { USER_PERSONAL_FIELDS_PORT_TOKEN } from '@app/user/constants/di';
import type { IInvitationClaimPort, TClaimPersonalData } from '@app/user/contracts/invitation-claim.port';
import type { IUserPersonalFieldsPort } from '@app/user/contracts/user-personal-fields.port';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_ADDRESS_REPOSITORY_TOKEN, EMPLOYEE_DOCUMENT_SERVICE_TOKEN, EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { IEmployeeAddressRepository } from '../contracts/employee-document.contract';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import type { EmployeeDocumentService } from '../services/employee-document.service';
import { jakartaDate } from '../services/employee.mappers';

/**
 * HR adapter of the user module's claim port (ERP-0121, grill-me Q19/Q20).
 *
 * @remarks
 * Before the credentials: gender, birth data and marital status go to the
 * user (the ERP-0034 personal-fields port), the NIK to the employee and the
 * residence address — its village checked through the location module — to
 * `employee_addresses`. After the claim: the employment agreement PDF is
 * queued. It depends on HR repositories and the document service only,
 * never on `InvitationService`, so the user -> HR call has no cycle.
 */
@injectable()
export class InvitationClaimAdapter implements IInvitationClaimPort {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN) private readonly employees: Pick<IEmployeeRepository, 'findByUserId' | 'update'>,
		@inject(EMPLOYEE_ADDRESS_REPOSITORY_TOKEN) private readonly addresses: Pick<IEmployeeAddressRepository, 'savePrimaryResidence'>,
		@inject(USER_PERSONAL_FIELDS_PORT_TOKEN) private readonly personal: IUserPersonalFieldsPort,
		@inject(EXPORTED_LOCATION_SERVICE_TOKEN) private readonly locations: Pick<ExportedLocationService, 'assertVillage'>,
		@inject(EMPLOYEE_DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<EmployeeDocumentService, 'queueAgreementPdf'>,
	) {}

	async recordPersonalData(userId: string, data: TClaimPersonalData): Promise<void> {
		// Throws a 422 for an unknown village before anything is written.
		await this.locations.assertVillage(data.address.villageId);
		await this.personal.update(userId, {
			gender: data.gender,
			birthDate: jakartaDate(data.birthDate),
			birthPlace: data.birthPlace,
			maritalStatus: data.maritalStatus,
		});
		const employee = await this.employees.findByUserId(userId);
		// An invite made before ERP-0034 has no employee: the user fields are all there is.
		if (!employee) return;
		await this.employees.update(employee.id, { nationalId: data.nationalId });
		await this.addresses.savePrimaryResidence(employee.id, data.address);
	}

	async afterClaim(userId: string): Promise<void> {
		try {
			const employee = await this.employees.findByUserId(userId);
			if (employee) await this.documents.queueAgreementPdf(employee.id);
		} catch (error) {
			pinoLogger.error({ err: error, userId }, 'agreement PDF not queued after claim');
		}
	}
}
