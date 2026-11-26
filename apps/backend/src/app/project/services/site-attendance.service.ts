import type { TSiteAttendanceSelect } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { businessDateOf } from '@utils/business-date.util';
import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import type { IObjectStorage } from '@providers/s3/object-storage';
import { OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { PROJECT_REPOSITORY_TOKEN, SITE_ATTENDANCE_REPOSITORY_TOKEN } from '../constants/di';
import type { IProjectRepository } from '../contracts/project.repository.interface';
import type { ISiteAttendanceRepository } from '../contracts/site-attendance.repository.interface';
import type {
	TSiteAttendanceListQuery,
	TSiteCheckInBody,
	TSiteCheckOutBody,
} from '../contracts/site-attendance.contract';
import {
	ProjectForbiddenError,
	ProjectNotFoundError,
	ProjectNotActiveError,
	ProjectSiteCoordinatesError,
	SiteAttendanceStateError,
	SiteSelfieError,
} from '../errors/project.errors';

/** Selfie limits; the bytes are stored as sent, type detected from the content. */
export const SELFIE_MAX_BYTES = 5 * 1024 * 1024;
const SELFIE_URL_TTL_SECONDS = 600;

/** Who the portal resolved the employee as (guard-owned facts). */
export type TPortalActor = {
	employeeId: string;
	userId: string;
	fullName: string;
	organizationId: string;
};

function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' };
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { contentType: 'image/png', ext: 'png' };
	}
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
	return null;
}

/** `HH:mm` in Jakarta for the notification copy. */
function jakartaClock(at: Date): string {
	return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
}

/** One site attendance row as the portal renders it. */
export type TSiteAttendanceView = TSiteAttendanceSelect & {
	selfieUrl: string | null;
	distance: number;
	radius: number;
};

/**
 * Field attendance at a project site (employee portal Phase B).
 *
 * @remarks
 * The backend - never the phone - decides whether a check-in is inside the
 * radius: the coordinates from the request are measured against the project's
 * primary site address with PostGIS (`ST_Distance` / `ST_DWithin`), and the
 * result is snapshotted (`distance_meters`, `radius_meters`, `status`) so a
 * later settings change cannot rewrite history.
 *
 * An out-of-range check-in is **recorded** as `out_of_range`, not rejected: the
 * row is evidence a supervisor can review, and dropping it would hide the
 * attempt. A missing selfie is rejected, because without it the coordinates are
 * only the phone's claim.
 *
 * PIC management is `project.projects.pic_user_id = caller`, which is the same
 * fact the admin screen shows; organization permissions stay out of this path
 * (the portal guard already proved an employee record, and the PIC row is the
 * record-level rule).
 */
@injectable()
export class SiteAttendanceService {
	constructor(
		@inject(SITE_ATTENDANCE_REPOSITORY_TOKEN) private readonly repository: ISiteAttendanceRepository,
		@inject(PROJECT_REPOSITORY_TOKEN) private readonly projects: Pick<IProjectRepository, 'findById' | 'isInvolved'>,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'put' | 'presignGet'>,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN)
		private readonly notifications?: Pick<ExportedNotificationService, 'notify'>,
	) {}

	private view(row: TSiteAttendanceSelect): TSiteAttendanceView {
		return {
			...row,
			selfieUrl: this.storage.presignGet(row.selfieKey, {
				fileName: `${row.businessDate}.${row.selfieContentType === 'image/png' ? 'png' : row.selfieContentType === 'image/webp' ? 'webp' : 'jpg'}`,
				expiresIn: SELFIE_URL_TTL_SECONDS,
				inline: true,
			}),
			distance: Number(row.distanceMeters),
			radius: row.radiusMeters,
		};
	}

	/** The project, if this employee is involved in it (PIC or a live task). */
	private async requireVisible(actor: TPortalActor, projectId: string) {
		const project = await this.projects.findById(projectId);
		if (!project || !(await this.projects.isInvolved(projectId, actor.userId))) {
			throw new ProjectNotFoundError();
		}
		return project;
	}

	/** The project, if the caller is its PIC. */
	private async requirePic(actor: TPortalActor, projectId: string) {
		const project = await this.requireVisible(actor, projectId);
		if (project.picUserId !== actor.userId) throw new ProjectForbiddenError('pic');
		return project;
	}

	async checkIn(actor: TPortalActor, body: TSiteCheckInBody): Promise<TSiteAttendanceView> {
		const project = await this.requireVisible(actor, body.projectId);
		if (project.status !== 'active') throw new ProjectNotActiveError();
		const date = businessDateOf();
		if (await this.repository.findDay(project.id, actor.employeeId, date)) {
			throw new SiteAttendanceStateError('alreadyCheckedIn');
		}
		const radius = await this.repository.radiusMeters();
		// PostGIS does both the radius test and the distance in one query; a
		// project without site coordinates cannot be measured at all.
		const measured = await this.repository.measure(
			project.id,
			{ latitude: body.latitude, longitude: body.longitude },
			radius,
		);
		if (!measured) throw new ProjectSiteCoordinatesError();
		const type = await this.checkSelfie(body.selfie);
		const storageKey = `projects/${project.id}/site-attendance/${crypto.randomUUID()}.${type.ext}`;
		await this.storage.put(storageKey, body.selfie, type.contentType);

		const now = new Date();
		const row = await this.repository.create({
			organizationId: actor.organizationId,
			projectId: project.id,
			employeeId: actor.employeeId,
			userId: actor.userId,
			businessDate: date,
			checkInAt: now,
			checkOutAt: null,
			latitude: String(body.latitude),
			longitude: String(body.longitude),
			accuracyMeters: body.accuracyMeters === null ? null : String(body.accuracyMeters),
			checkOutLatitude: null,
			checkOutLongitude: null,
			distanceMeters: String(measured.distanceMeters.toFixed(2)),
			radiusMeters: radius,
			status: measured.within ? 'verified' : 'out_of_range',
			selfieKey: storageKey,
			selfieContentType: type.contentType,
			note: body.note,
		});

		// PIC sees the visit; a failed enqueue never fails the check-in.
		if (project.picUserId && project.picUserId !== actor.userId) {
			await this.notifications?.notify({
				userIds: [project.picUserId],
				templateCode: 'project.attendance_recorded',
				variables: {
					projectName: project.title,
					employeeName: actor.fullName,
					checkedAt: jakartaClock(now),
				},
				sourceType: 'project_site_attendance',
				sourceId: row.id,
			});
		}
		return this.view(row);
	}

	private async checkSelfie(file: File | undefined): Promise<{ contentType: string; ext: string }> {
		if (!file) throw new SiteSelfieError('missing');
		if (file.size === 0) throw new SiteSelfieError('empty');
		if (file.size > SELFIE_MAX_BYTES) throw new SiteSelfieError('size');
		const type = sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
		if (!type) throw new SiteSelfieError('type');
		return type;
	}

	async checkOut(actor: TPortalActor, id: string, body: TSiteCheckOutBody): Promise<TSiteAttendanceView> {
		const row = await this.repository.findById(id);
		if (!row || row.employeeId !== actor.employeeId) throw new ProjectNotFoundError();
		if (row.checkOutAt) throw new SiteAttendanceStateError('alreadyCheckedOut');
		const updated = await this.repository.checkOut(id, {
			at: new Date(),
			latitude: body.latitude,
			longitude: body.longitude,
			accuracyMeters: body.accuracyMeters,
			note: body.note,
		});
		if (!updated) throw new SiteAttendanceStateError('alreadyCheckedOut');
		return this.view(updated);
	}

	async listMine(actor: TPortalActor, query: TSiteAttendanceListQuery): Promise<TPaginationResult<TSiteAttendanceView>> {
		const result = await this.repository.paginateForEmployee(actor.employeeId, query);
		return { meta: result.meta, data: result.data.map((row) => this.view(row)) };
	}

	/** Everyone's visits on one project; PIC only. */
	async listProject(
		actor: TPortalActor,
		projectId: string,
		query: TSiteAttendanceListQuery,
	): Promise<TPaginationResult<TSiteAttendanceView>> {
		await this.requirePic(actor, projectId);
		const result = await this.repository.paginateForProject(projectId, { ...query, projectId });
		return { meta: result.meta, data: result.data.map((row) => this.view(row)) };
	}

	/** The PIC gate, exposed for the task/evidence routes of the same controller. */
	async assertPic(actor: TPortalActor, projectId: string): Promise<void> {
		await this.requirePic(actor, projectId);
	}

	/** The involvement gate for read routes. */
	async assertVisible(actor: TPortalActor, projectId: string): Promise<void> {
		await this.requireVisible(actor, projectId);
	}
}
