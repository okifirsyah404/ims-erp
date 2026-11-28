/**
 * Dummy data for the organization info dashboard. Placeholder only — every
 * section will be replaced by real API queries as the modules land.
 */

export const roleCounts = [
	{ role: 'owner', count: 1 },
	{ role: 'finance', count: 3 },
	{ role: 'project_manager', count: 4 },
	{ role: 'technician', count: 12 },
	{ role: 'member', count: 28 },
] as const;

export type TDashboardProject = {
	name: string;
	status: 'planned' | 'in_progress' | 'done' | 'on_hold';
	progress: number;
};

export const projects: TDashboardProject[] = [
	{ name: 'Instalasi CCTV — Mall Senayan', status: 'in_progress', progress: 65 },
	{ name: 'Access Control — Kantor Pusat BCA', status: 'in_progress', progress: 40 },
	{ name: 'Maintenance Gedung A — Yearly', status: 'planned', progress: 0 },
	{ name: 'Gate Barrier — Tol Jagorawi', status: 'done', progress: 100 },
	{ name: 'Renewal Lisensi — PT Maju', status: 'on_hold', progress: 15 },
];

export const salesByMonth = [
	{ month: '2026-06', sales: 145_000_000 },
	{ month: '2026-07', sales: 168_000_000 },
	{ month: '2026-08', sales: 122_000_000 },
	{ month: '2026-09', sales: 190_000_000 },
	{ month: '2026-10', sales: 210_000_000 },
	{ month: '2026-11', sales: 175_000_000 },
] as const;

export type TDashboardInventoryItem = {
	name: string;
	quantity: number;
	minQuantity: number;
	value: number;
};

export const inventorySummary = {
	totalItems: 482,
	totalValue: 1_240_000_000,
	lowStock: [
		{ name: 'Reader RFID X-100', quantity: 2, minQuantity: 5, value: 4_500_000 },
		{ name: 'Kabel FTP Cat6 (m)', quantity: 40, minQuantity: 100, value: 1_600_000 },
		{ name: 'Magnetic Lock 280kg', quantity: 3, minQuantity: 10, value: 6_300_000 },
	] satisfies TDashboardInventoryItem[],
};

export const activities = [
	{ actor: 'Budi Santoso', action: 'project.created', target: 'Instalasi CCTV — Mall Senayan', at: '2026-11-12T08:30:00+07:00' },
	{ actor: 'Sari Dewi', action: 'invoice.paid', target: 'INV-2026-0087', at: '2026-11-11T15:12:00+07:00' },
	{ actor: 'Andi Wijaya', action: 'inventory.received', target: 'GRN-2026-0102', at: '2026-11-11T09:45:00+07:00' },
	{ actor: 'Rina Putri', action: 'member.invited', target: 'tech3@ims.co.id', at: '2026-11-10T11:20:00+07:00' },
	{ actor: 'Budi Santoso', action: 'task.assigned', target: 'Wiring Lantai 3', at: '2026-11-09T14:05:00+07:00' },
] as const;

export const profitAndLossByMonth = [
	{ month: '2026-06', revenue: 145_000_000, expense: 112_000_000 },
	{ month: '2026-07', revenue: 168_000_000, expense: 128_000_000 },
	{ month: '2026-08', revenue: 122_000_000, expense: 109_000_000 },
	{ month: '2026-09', revenue: 190_000_000, expense: 135_000_000 },
	{ month: '2026-10', revenue: 210_000_000, expense: 148_000_000 },
	{ month: '2026-11', revenue: 175_000_000, expense: 121_000_000 },
] as const;

export type TDashboardCashAccount = {
	name: string;
	type: 'cash' | 'bank';
	balance: number;
};

export const cashAccounts = [
	{ name: 'Kas Besar', type: 'cash', balance: 25_000_000 },
	{ name: 'Kas Kecil', type: 'cash', balance: 4_250_000 },
	{ name: 'BCA — 1234567890', type: 'bank', balance: 342_500_000 },
	{ name: 'Mandiri — 9876543210', type: 'bank', balance: 128_750_000 },
] satisfies TDashboardCashAccount[];
