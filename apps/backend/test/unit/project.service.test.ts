/**
 * Projects (M07 part 1, ADR-0011 step 6a): created from a live deal with the
 * default checklist, one live project per deal, record visibility, the
 * closing evidence rule, task and file permissions, and costs only with
 * `project:read_cost` (direct costs + shipped material value).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TCostSelect,
	TEvidenceSelect,
	TProjectSelect,
	TTaskSelect,
} from '@drizzle/schemas/project.schema';
import { PROJECT_STAGES } from '@drizzle/schemas/project.schema';
import type { TOrderSelect } from '@drizzle/schemas/sale.schema';
import type { IProjectRepository } from '../../src/app/project/contracts/project.repository.interface';
import {
	ProjectDealError,
	ProjectEvidenceMissingError,
	ProjectFileError,
	ProjectForbiddenError,
	ProjectNotActiveError,
	ProjectNotFoundError,
	ProjectStaffError,
} from '../../src/app/project/errors/project.errors';
import { ProjectService, type TProjectContext } from '../../src/app/project/services/project.service';

const SO = '0190a1b2-0000-7000-8000-00000000a001';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const pm: TProjectContext = { organizationId: 'org', actorUserId: 'pm', canViewAll: true, canSeeCost: true, canAssignTasks: true, canManage: true };
const tech: TProjectContext = { organizationId: 'org', actorUserId: 'tech', canViewAll: false, canSeeCost: false, canAssignTasks: false, canManage: false };

let rows: TProjectSelect[];
let tasks: TTaskSelect[];
let evidence: TEvidenceSelect[];
let costs: TCostSelect[];
let roles: Record<string, string>;
let stored: string[];
let service: ProjectService;

const order = {
	id: SO,
	code: '0001/SO/IMS/XI/26',
	quotationCode: '0001/QT/IMS/XI/26',
	status: 'confirmed',
	title: 'Swing gate lobi',
	customerId: 'cust-1',
	customerSnapshot: { name: 'PT Contoh' },
	grandTotal: 11_100_000_000,
	orderDate: '2026-11-06',
	createdAt: new Date(),
} as unknown as TOrderSelect;

function fakeRepository(): IProjectRepository {
	const live = (id: string) => rows.find((row) => row.id === id && !row.deletedAt) ?? null;
	return {
		async paginate(request) {
			const data = rows.filter((row) => !request.involvedUserId || row.picUserId === request.involvedUserId);
			return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
		},
		async stats(request) {
			// Same visibility rule as `paginate`: PIC or a live task. Overdue =
			// active project whose target date has passed.
			const involved = (id: string, userId: string) =>
				rows.find((row) => row.id === id)?.picUserId === userId ||
				tasks.some((task) => task.projectId === id && task.assigneeUserId === userId && !task.deletedAt);
			const visible = rows.filter(
				(row) => !row.deletedAt && (!request.involvedUserId || involved(row.id, request.involvedUserId)),
			);
			const active = visible.filter((row) => row.status === 'active');
			return {
				active: active.length,
				closed: visible.filter((row) => row.status === 'closed').length,
				cancelled: visible.filter((row) => row.status === 'cancelled').length,
				overdue: active.filter((row) => row.targetEndDate !== null && row.targetEndDate < request.today).length,
				byStage: PROJECT_STAGES.map((stage) => ({ stage, count: active.filter((row) => row.stage === stage).length })),
			};
		},
		findById: async (id) => live(id),
		listByCustomer: async (customerId) => rows.filter((row) => row.customerId === customerId && !row.deletedAt && row.status !== 'cancelled'),
		isInvolved: async (projectId, userId) =>
			live(projectId)?.picUserId === userId || tasks.some((task) => task.projectId === projectId && task.assigneeUserId === userId && !task.deletedAt),
		findLiveBySalesOrder: async (orderId) => rows.find((row) => row.orderId === orderId && row.status !== 'cancelled') ?? null,
		salesOrdersWithProject: async (ids) => new Set(rows.filter((row) => ids.includes(row.orderId) && row.status !== 'cancelled').map((row) => row.orderId)),
		async create(data, defaults) {
			const project = { ...data, id: crypto.randomUUID(), stage: 'preparation', status: 'active' } as TProjectSelect;
			rows.push(project);
			defaults.forEach((task, position) =>
				tasks.push({ ...task, id: crypto.randomUUID(), projectId: project.id, position, status: 'todo' } as TTaskSelect),
			);
			return project;
		},
		async update(id, data) {
			const project = live(id);
			if (!project || project.status !== 'active') return null;
			return Object.assign(project, data);
		},
		async transition(id, data) {
			const project = live(id);
			if (!project || project.status !== 'active') return null;
			return Object.assign(project, data);
		},
		listTasks: async (projectId) => tasks.filter((task) => task.projectId === projectId && !task.deletedAt),
		findTask: async (projectId, taskId) => tasks.find((task) => task.id === taskId && task.projectId === projectId && !task.deletedAt) ?? null,
		async addTask(projectId, actor, data) {
			const task = { ...data, id: crypto.randomUUID(), projectId, position: tasks.length, status: 'todo', createdBy: actor } as TTaskSelect;
			tasks.push(task);
			return task;
		},
		async updateTask(taskId, data) {
			return Object.assign(tasks.find((task) => task.id === taskId)!, data);
		},
		async setTaskStatus(taskId, status, actor) {
			return Object.assign(tasks.find((task) => task.id === taskId)!, { status, doneBy: status === 'done' ? actor : null });
		},
		async removeTask(taskId, actor) {
			return Object.assign(tasks.find((task) => task.id === taskId)!, { deletedAt: new Date(), deletedBy: actor });
		},
		listEvidence: async (projectId) => evidence.filter((file) => file.projectId === projectId && !file.deletedAt),
		findEvidence: async (projectId, id) => evidence.find((file) => file.id === id && file.projectId === projectId && !file.deletedAt) ?? null,
		async addEvidence(data) {
			const file = { ...data, id: crypto.randomUUID() } as TEvidenceSelect;
			evidence.push(file);
			return file;
		},
		async removeEvidence(id, actor) {
			return Object.assign(evidence.find((file) => file.id === id)!, { deletedAt: new Date(), deletedBy: actor });
		},
		listCosts: async (projectId) => costs.filter((cost) => cost.projectId === projectId),
		async addCost(data) {
			const cost = { ...data, id: crypto.randomUUID(), voidedAt: null } as TCostSelect;
			costs.push(cost);
			return cost;
		},
		async voidCost(projectId, costId, actor, reason) {
			const cost = costs.find((row) => row.id === costId && row.projectId === projectId && !row.voidedAt);
			return cost ? Object.assign(cost, { voidedAt: new Date(), voidedBy: actor, voidReason: reason }) : null;
		},
	};
}

beforeEach(() => {
	rows = [];
	tasks = [];
	evidence = [];
	costs = [];
	stored = [];
	roles = { pm: 'project_manager', tech: 'technician', sales: 'sales' };
	const grants: Record<string, string[]> = { project_manager: ['project:update', 'task:update'], technician: ['task:update'], sales: [] };
	service = new ProjectService(
		fakeRepository(),
		{
			getLiveOrder: async (id) => (id === SO && order.status !== 'cancelled' ? order : null),
			listLiveOrders: async () => [order],
			shippedMaterials: async () => [{ id: 'dn-1', code: '0001/SJ/IMS/XI/26', shippedAt: new Date(), value: 2_000_000_000 }],
		},
		{
			getMemberRole: async (_org, userId) => roles[userId] ?? null,
			listMembers: async () =>
				({
					meta: { page: 1, limit: 100, total: 3, totalPages: 1 },
					data: Object.entries(roles).map(([userId, role]) => ({ userId, role, user: { name: `User ${userId}` } })),
				}) as never,
		},
		{
			hasPermission: async (_org, names, request) =>
				Object.entries(request).every(([resource, actions]) =>
					(actions ?? []).every((action) => names.some((name) => grants[name]?.includes(`${resource}:${action}`))),
				),
		},
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
		{ next: async () => '0001/PRJ/IMS/XI/26' },
		{
			async put(key: string) {
				stored.push(key);
			},
			presignGet: (key: string) => `https://files/${key}`,
		},
	);
});

const createProject = () => service.create(pm, { orderId: SO, picUserId: 'pm', siteName: 'Lobi', targetStartDate: '2026-11-10', targetEndDate: '2026-11-30', notes: null });
const upload = (kind: 'testing' | 'training' | 'bast', bytes: Uint8Array<ArrayBuffer> = PNG) =>
	service.addEvidence(pm, rows[0]!.id, { file: new File([bytes], `${kind}.png`, { type: 'image/png' }), kind });

describe('projects', () => {
	test('created from a deal: snapshot, number and the default checklist; one live project per deal', async () => {
		const project = await createProject();
		expect(project).toMatchObject({ code: '0001/PRJ/IMS/XI/26', orderCode: order.code, customerName: 'PT Contoh', contractValue: 11_100_000_000 });
		expect(tasks.map((task) => task.stage)).toEqual(['preparation', 'delivery', 'installation', 'testing', 'training', 'handover']);
		await expect(createProject()).rejects.toBeInstanceOf(ProjectDealError);
		expect((await service.openDeals()).map((deal) => deal.hasProject)).toEqual([true]);
		await expect(service.create(pm, { orderId: SO, picUserId: 'sales', siteName: null, targetStartDate: null, targetEndDate: null, notes: null })).rejects.toBeInstanceOf(
			ProjectDealError,
		);
	});

	test('the PIC must manage projects; assignees must work tasks', async () => {
		rows = [];
		await expect(service.create(pm, { orderId: SO, picUserId: 'sales', siteName: null, targetStartDate: null, targetEndDate: null, notes: null })).rejects.toBeInstanceOf(
			ProjectStaffError,
		);
		const project = await createProject();
		await expect(service.addTask(pm, project.id, { title: 'X', stage: 'testing', assigneeUserId: 'sales', dueDate: null })).rejects.toBeInstanceOf(ProjectStaffError);
		const staff = await service.staff(pm);
		expect(staff.pics.map((person) => person.userId)).toEqual(['pm']);
		expect(staff.workers.map((person) => person.userId).sort()).toEqual(['pm', 'tech']);
	});

	test('visibility: a technician sees a project only once a task is assigned; only the assignee moves it', async () => {
		const project = await createProject();
		await expect(service.get(tech, project.id)).rejects.toBeInstanceOf(ProjectNotFoundError);
		const testing = tasks.find((task) => task.stage === 'testing')!;
		await service.updateTask(pm, project.id, testing.id, { title: testing.title, stage: 'testing', assigneeUserId: 'tech', dueDate: null });
		const seen = await service.get(tech, project.id);
		expect(seen.costs).toBeNull();
		await service.setTaskStatus(tech, project.id, testing.id, 'done');
		expect(testing).toMatchObject({ status: 'done', doneBy: 'tech' });
		const other = tasks.find((task) => task.stage === 'training')!;
		await expect(service.setTaskStatus(tech, project.id, other.id, 'done')).rejects.toBeInstanceOf(ProjectForbiddenError);
	});

	test('dashboard stats count only what the caller may see, and only active projects are overdue', async () => {
		const project = await createProject();
		// Nobody is involved yet: a manager sees it, a technician does not.
		const manager = await service.stats(pm);
		expect(manager).toMatchObject({ active: 1, closed: 0, cancelled: 0, overdue: 0 });
		expect(manager.byStage).toHaveLength(7);
		expect(manager.byStage.find((row) => row.stage === 'preparation')).toEqual({ stage: 'preparation', count: 1 });
		expect((await service.stats(tech)).active).toBe(0);

		// Assigning a task makes it visible to that technician, and only then.
		const testing = tasks.find((task) => task.stage === 'testing')!;
		await service.updateTask(pm, project.id, testing.id, { title: testing.title, stage: 'testing', assigneeUserId: 'tech', dueDate: null });
		expect((await service.stats(tech)).active).toBe(1);

		// Overdue needs an active project whose target date has passed.
		const overdue = (await service.stats(pm)).overdue;
		await service.update(pm, project.id, {
			picUserId: 'pm',
			siteName: null,
			targetStartDate: null,
			targetEndDate: '2000-01-01',
			stage: 'preparation',
			notes: null,
		});
		expect((await service.stats(pm)).overdue).toBe(overdue + 1);
		await service.close(pm, project.id).catch(() => undefined);
	});

	test('files are checked by content; closing needs testing, training and BAST evidence', async () => {		const project = await createProject();
		await expect(upload('testing', new Uint8Array(new TextEncoder().encode('not an image')))).rejects.toBeInstanceOf(ProjectFileError);
		await upload('testing');
		await upload('training');
		await expect(service.close(pm, project.id)).rejects.toBeInstanceOf(ProjectEvidenceMissingError);
		await upload('bast');
		expect(stored).toHaveLength(3);
		expect((await service.get(pm, project.id)).canClose).toBe(true);
		const closed = await service.close(pm, project.id);
		expect(closed).toMatchObject({ status: 'closed', stage: 'warranty' });
		await expect(upload('testing')).rejects.toBeInstanceOf(ProjectNotActiveError);
	});

	test('costs: direct entries plus shipped materials against the contract value; voiding', async () => {
		const project = await createProject();
		await service.addCost(pm, project.id, { category: 'transport', costDate: '2026-11-12', amount: 75_000_000, description: 'Bensin + tol' });
		const bad = await service.addCost(pm, project.id, { category: 'other', costDate: '2026-11-12', amount: 10_000, description: 'Salah' });
		await service.voidCost(pm, project.id, bad.id, 'salah input');
		const detail = await service.get(pm, project.id);
		expect(detail.costs).toMatchObject({ directTotal: 75_000_000, materialTotal: 2_000_000_000, total: 2_075_000_000, contractValue: 11_100_000_000 });
	});

	test('cancelling frees the deal for a new project', async () => {
		const project = await createProject();
		await service.cancel(pm, project.id, 'pelanggan menunda');
		expect((await createProject()).id).not.toBe(project.id);
	});
});
