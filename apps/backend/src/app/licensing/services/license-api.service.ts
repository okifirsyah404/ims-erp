import { ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { OrganizationService } from '@app/organization/services/organization.service';
import type { TApplicationApiKeySelect, TLicenseActivationSelect } from '@drizzle/schemas/licensing.schema';
import { businessDateOf, type TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type { IApiKeyIssuer } from '../adapters/better-auth-api-keys';
import { API_KEY_ISSUER_TOKEN, LICENSE_API_REPOSITORY_TOKEN, LICENSING_SERVICE_TOKEN } from '../constants/di';
import type {
	ILicenseApiRepository,
	TActivateBody,
	TDeactivateBody,
	TEventListQuery,
	TEventRow,
	TKeyWithContract,
	TValidateBody,
} from '../contracts/license-api.contract';
import {
	ActivationNotFoundError,
	ApiKeyIssueError,
	LicenseApiAuthError,
	LicenseRefusedError,
} from '../errors/licensing.errors';
import { licenseState, maskLicenseKey, type TLicenseResult } from '../utils/license';
import type { LicensingService } from './licensing.service';

/** The own application calling the API, from its machine key. */
export type TApiClient = { applicationApiKeyId: string; applicationId: string };

/** Staff calling the key screens. */
export type TApiKeyContext = { actorUserId: string; organizationId: string };

/** What the application learns about a key. */
export type TValidation = {
	valid: boolean;
	/** `ok`, `grace` (still valid, warn the user), or why it is refused. */
	status: TLicenseResult | 'not_activated';
	warning: boolean;
	licenseKey: string;
	application: { code: string; name: string } | null;
	customerName: string | null;
	packageName: string | null;
	endsOn: string | null;
	graceEndsOn: string | null;
	daysLeft: number | null;
	maxActivations: number | null;
	activation: { instanceId: string; activatedAt: Date; lastSeenAt: Date } | null;
};

export type TIssuedApiKey = { apiKey: TApplicationApiKeySelect; secret: string };

/**
 * The license API (M03 stage 2, decisions of 2026-11-06).
 *
 * @remarks
 * Machine side: an own application authenticates with its `elk_` key and can
 * only validate, activate (take a seat) and deactivate (release a seat) keys
 * of its own application; a key of another application looks unknown. A
 * paid draft renewal is activated before the key is judged. Every call is
 * written to the license event log. Staff side: issue and revoke the
 * application keys (shown once), release seats, read the log.
 */
@injectable()
export class LicenseApiService {
	constructor(
		@inject(LICENSE_API_REPOSITORY_TOKEN) private readonly repository: ILicenseApiRepository,
		@inject(LICENSING_SERVICE_TOKEN) private readonly licensing: Pick<LicensingService, 'activatePaidRenewals' | 'getApplication' | 'contractKeyIds'>,
		@inject(API_KEY_ISSUER_TOKEN) private readonly issuer: IApiKeyIssuer,
		@inject(ORGANIZATION_SERVICE_TOKEN) private readonly organizations: Pick<OrganizationService, 'listMembers'>,
	) {}

	// Application keys (staff) -----------------------------------------------

	listApiKeys(applicationId: string): Promise<TApplicationApiKeySelect[]> {
		return this.repository.listApiKeys(applicationId);
	}

	private async ownerOf(organizationId: string): Promise<string> {
		const members = await this.organizations.listMembers(organizationId, { page: 1, limit: 100 });
		const owner = members.data.find((member) => member.role.split(',').some((role) => role.trim() === 'owner'));
		if (!owner) throw new ApiKeyIssueError('noOwner');
		return owner.userId;
	}

	async issueApiKey(ctx: TApiKeyContext, applicationId: string, name: string): Promise<TIssuedApiKey> {
		const application = await this.licensing.getApplication(applicationId);
		if (application.source !== 'own' || application.status !== 'active') throw new ApiKeyIssueError('ownOnly');
		const ownerUserId = await this.ownerOf(ctx.organizationId);
		const created = await this.issuer.issue({ organizationId: ctx.organizationId, ownerUserId, name, applicationId });
		const apiKey = await this.repository.createApiKey({
			licensableApplicationId: applicationId,
			apiKeyId: created.id,
			name,
			keyStart: created.start,
			createdBy: ctx.actorUserId,
		});
		return { apiKey, secret: created.key };
	}

	async revokeApiKey(ctx: TApiKeyContext, applicationId: string, id: string): Promise<TApplicationApiKeySelect> {
		const row = await this.repository.findApiKey(id);
		if (!row || row.licensableApplicationId !== applicationId || row.status !== 'active') throw new ApiKeyIssueError('notFound');
		await this.issuer.disable({ apiKeyId: row.apiKeyId, ownerUserId: await this.ownerOf(ctx.organizationId) });
		const revoked = await this.repository.revokeApiKey(id, ctx.actorUserId);
		if (!revoked) throw new ApiKeyIssueError('notFound');
		return revoked;
	}

	// Staff views ------------------------------------------------------------

	listEvents(query: TEventListQuery): Promise<TPaginationResult<TEventRow>> {
		return this.repository.paginateEvents(query);
	}

	/** Releases a seat from the contract screen (for example a replaced device). */
	async releaseSeat(actorUserId: string, contractId: string, activationId: string): Promise<TLicenseActivationSelect> {
		const keyIds = await this.licensing.contractKeyIds(contractId);
		const [activation] = (await this.repository.listActivations(keyIds)).filter((row) => row.id === activationId);
		if (!activation) throw new ActivationNotFoundError();
		const released = await this.repository.deactivate(activationId, actorUserId);
		if (!released) throw new ActivationNotFoundError();
		await this.repository.insertEvent({
			eventType: 'deactivated',
			result: 'ok',
			licenseKeyId: activation.licenseKeyId,
			licenseContractId: contractId,
			instanceId: activation.instanceId,
			actorUserId,
			description: 'Seat released by staff',
			eventAt: new Date(),
		});
		return released;
	}

	// Machine API ------------------------------------------------------------

	/** Bearer `elk_` key → the application it belongs to. */
	async authenticate(authorization: string | null): Promise<TApiClient> {
		const [scheme, token] = (authorization ?? '').split(' ');
		if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) throw new LicenseApiAuthError('missing');
		const verified = await this.issuer.verify(token.trim());
		if (verified === 'rateLimited') throw new LicenseApiAuthError('rateLimited');
		const row = verified ? await this.repository.findApiKeyByAuthId(verified.id) : null;
		if (!row || row.status !== 'active') throw new LicenseApiAuthError('invalid');
		await this.repository.touchApiKey(row.id);
		return { applicationApiKeyId: row.id, applicationId: row.licensableApplicationId };
	}

	/** The key of this application, after a paid renewal had its chance to activate. */
	private async lookup(client: TApiClient, licenseKey: string): Promise<TKeyWithContract | null> {
		const found = await this.repository.findKeyWithContract(licenseKey);
		if (!found || found.contract.licensableApplicationId !== client.applicationId) return null;
		if ((await this.licensing.activatePaidRenewals(found.contract.id)) === 0) return found;
		// The key moved to the renewal.
		return this.repository.findKeyWithContract(licenseKey);
	}

	private log(
		client: TApiClient,
		type: 'validated' | 'activated' | 'deactivated',
		result: string,
		found: TKeyWithContract | null,
		instanceId: string | undefined,
		ip: string | null,
	) {
		return this.repository.insertEvent({
			eventType: type,
			result,
			licenseKeyId: found?.key.id ?? null,
			licenseContractId: found?.contract.id ?? null,
			applicationApiKeyId: client.applicationApiKeyId,
			instanceId: instanceId ?? null,
			ipAddress: ip,
			eventAt: new Date(),
		});
	}

	private answer(found: TKeyWithContract | null, licenseKey: string, activation: TLicenseActivationSelect | null) {
		const state = found ? licenseState(found.contract, found.key, businessDateOf()) : null;
		return {
			state,
			body: {
				licenseKey: maskLicenseKey(licenseKey),
				application: found ? { code: found.contract.applicationCode, name: found.contract.applicationName } : null,
				customerName: found?.contract.customerName ?? null,
				packageName: found?.contract.packageName ?? null,
				endsOn: state?.endsOn ?? null,
				graceEndsOn: state?.graceEndsOn ?? null,
				daysLeft: state?.daysLeft ?? null,
				maxActivations: found?.key.maxActivations ?? null,
				activation: activation
					? { instanceId: activation.instanceId, activatedAt: activation.activatedAt, lastSeenAt: activation.lastSeenAt }
					: null,
			},
		};
	}

	async validate(client: TApiClient, body: TValidateBody, ip: string | null): Promise<TValidation> {
		const found = await this.lookup(client, body.licenseKey);
		const activation = found && body.instanceId ? await this.repository.findActiveActivation(found.key.id, body.instanceId) : null;
		const { state, body: details } = this.answer(found, body.licenseKey, activation);
		let status: TValidation['status'] = state?.result ?? 'unknown';
		if (state?.valid && body.instanceId && !activation) status = 'not_activated';
		const valid = status === 'ok' || status === 'grace';
		if (valid && activation) await this.repository.touchActivation(activation.id, ip);
		await this.log(client, 'validated', status, found, body.instanceId, ip);
		return { ...details, valid, status, warning: status === 'grace' };
	}

	/** Takes a seat (idempotent per installation). */
	async activate(client: TApiClient, body: TActivateBody, ip: string | null): Promise<TValidation> {
		const found = await this.lookup(client, body.licenseKey);
		const state = found ? licenseState(found.contract, found.key, businessDateOf()) : null;
		if (!found || !state?.valid) {
			const result = state?.result ?? 'unknown';
			await this.log(client, 'activated', result, found, body.instanceId, ip);
			throw new LicenseRefusedError(result === 'ok' || result === 'grace' ? 'unknown' : result);
		}
		let activation = await this.repository.findActiveActivation(found.key.id, body.instanceId);
		if (activation) {
			await this.repository.touchActivation(activation.id, ip);
		} else {
			const now = new Date();
			activation = await this.repository.createActivationLocked(
				{
					licenseKeyId: found.key.id,
					instanceId: body.instanceId,
					deviceName: body.deviceName ?? null,
					activatedAt: now,
					lastSeenAt: now,
					lastIp: ip,
				},
				found.key.maxActivations,
			);
			if (!activation) {
				await this.log(client, 'activated', 'seat_limit', found, body.instanceId, ip);
				throw new LicenseRefusedError('seat_limit');
			}
		}
		await this.log(client, 'activated', state.result, found, body.instanceId, ip);
		const { body: details } = this.answer(found, body.licenseKey, activation);
		return { ...details, valid: true, status: state.result, warning: state.result === 'grace' };
	}

	/** Releases this installation's seat. */
	async deactivate(client: TApiClient, body: TDeactivateBody, ip: string | null): Promise<{ released: true }> {
		const found = await this.lookup(client, body.licenseKey);
		if (!found) {
			await this.log(client, 'deactivated', 'unknown', null, body.instanceId, ip);
			throw new LicenseRefusedError('unknown');
		}
		const activation = await this.repository.findActiveActivation(found.key.id, body.instanceId);
		if (!activation || !(await this.repository.deactivate(activation.id, null))) {
			await this.log(client, 'deactivated', 'not_activated', found, body.instanceId, ip);
			throw new LicenseRefusedError('not_activated');
		}
		await this.log(client, 'deactivated', 'ok', found, body.instanceId, ip);
		return { released: true };
	}
}

