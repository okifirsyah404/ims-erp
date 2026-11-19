/**
 * Public order tracking views (ERP-0073): the website's `PublicTracking`
 * (`apps/web-landing/src/api/website.ts`, full status after the contact
 * check) and the portal's minimal `PublicOrderStatus`. Money is whole rupiah,
 * progress 0..1, labels in the request language.
 */
import type { TOrderTracking } from '@app/sales/services/order-tracking.service';
import type { TTrackedOrder } from '../services/public-tracking.service';
import { dateLabel, type TPresenter } from './portal-presenter';
import { orderSummary, toMoney } from './portal-sales-presenter';

export const TRACKING_STAGES = ['received', 'paid', 'production', 'qc', 'shipped', 'installation', 'completed'] as const;
export type TTrackingStage = (typeof TRACKING_STAGES)[number];

type TStageFact = { stage: TTrackingStage; done: boolean; at: Date | string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (p: TPresenter, date: string | null): number =>
	date ? Math.max(0, Math.round((new Date(`${date}T00:00:00+07:00`).getTime() - new Date(`${p.today}T00:00:00+07:00`).getTime()) / DAY_MS)) : 0;

/** Which stages are done, from the order, its invoices, delivery notes and installation project. */
export function trackingStages(tracked: TTrackedOrder): TStageFact[] {
	const { order, fullyPaid, deliveryNotes, project } = tracked;
	const shipped = deliveryNotes.filter((note) => note.status === 'shipped' || note.status === 'delivered');
	const orderDone = order.status === 'completed';
	const delivered = order.status === 'delivered' || orderDone;
	const projectDone = project?.status === 'closed';
	const facts: TStageFact[] = [
		{ stage: 'received', done: true, at: order.orderDate },
		{ stage: 'paid', done: fullyPaid, at: null },
		{ stage: 'production', done: order.status !== 'confirmed', at: null },
		{ stage: 'qc', done: deliveryNotes.length > 0 || delivered, at: deliveryNotes[0]?.createdAt ?? null },
		{ stage: 'shipped', done: shipped.length > 0 || delivered, at: shipped[0]?.shippedAt ?? null },
	];
	if (project) facts.push({ stage: 'installation', done: projectDone, at: project.closedAt });
	facts.push({ stage: 'completed', done: orderDone || projectDone, at: null });
	return facts;
}

export function publicTracking(p: TPresenter, tracked: TTrackedOrder) {
	const { order, paidMinor, fullyPaid, deliveryNotes, project } = tracked;
	const facts = trackingStages(tracked);
	const cancelled = order.status === 'cancelled';
	const currentIndex = facts.findIndex((fact) => !fact.done);
	const current = currentIndex === -1 ? facts[facts.length - 1]! : facts[currentIndex]!;
	const doneCount = facts.filter((fact) => fact.done).length;
	const note = deliveryNotes[deliveryNotes.length - 1];
	const finish = project?.targetEndDate ?? order.deliveryDate;
	const tasks = project?.tasks ?? [];
	const tasksDone = tasks.filter((task) => task.status === 'done').length;
	const lastChange = [order.updatedAt, ...deliveryNotes.map((row) => row.updatedAt), ...order.history.map((row) => row.createdAt)].reduce(
		(latest, value) => (value > latest ? value : latest),
		order.updatedAt,
	);
	const shippedAny = facts.find((fact) => fact.stage === 'shipped')!.done;

	return {
		orderNumber: order.code,
		status: current.stage,
		// The headline says what happens now ("Awaiting payment"), the timeline what each step is.
		statusLabel: cancelled
			? p.t('tracking.cancelled')
			: currentIndex === -1
				? p.t('tracking.stage.completed')
				: p.t(`tracking.now.${current.stage}` as const),
		placedLabel: p.t('tracking.placed', { date: dateLabel(p, order.orderDate) }),
		customerName: order.customerSnapshot.name,
		itemCount: order.items.length,
		estimatedCompletionLabel: finish ? dateLabel(p, finish) : p.t('tracking.toBeConfirmed'),
		progress: cancelled ? 0 : doneCount / facts.length,
		daysToCompletion: daysUntil(p, finish),
		siteLabel: project?.siteName ?? note?.projectLocation ?? order.customerSnapshot.addressLine ?? '',
		delivery: {
			windowLabel: order.deliveryDate ? dateLabel(p, order.deliveryDate) : p.t('tracking.toBeConfirmed'),
			installationLabel: project ? (project.targetStartDate ? dateLabel(p, project.targetStartDate) : p.t('tracking.toBeConfirmed')) : p.t('tracking.noInstallation'),
			onSchedule: shippedAny || !order.deliveryDate || order.deliveryDate >= p.today,
			daysToShip: shippedAny ? 0 : daysUntil(p, order.deliveryDate),
			daysToFinish: daysUntil(p, finish),
		},
		timeline: facts.map((fact, index) => ({
			stage: fact.stage,
			title: p.t(`tracking.stage.${fact.stage}` as const),
			description: p.t(`tracking.text.${fact.stage}` as const),
			state: fact.done ? ('done' as const) : index === currentIndex ? ('current' as const) : ('upcoming' as const),
			dateLabel: fact.at ? dateLabel(p, fact.at) : '',
			...(fact.stage === 'installation' && tasks.length > 0
				? {
						progress: {
							value: tasksDone / tasks.length,
							tasks: tasks.slice(0, 8).map((task) => ({
								label: task.title,
								state: task.status === 'done' ? ('done' as const) : task.status === 'in_progress' ? ('current' as const) : ('pending' as const),
							})),
						},
					}
				: {}),
		})),
		lastUpdatedLabel: p.t('tracking.updated', { date: dateLabel(p, lastChange) }),
		items: order.items.map((item) => ({ name: item.name, quantity: Number(item.quantity), amount: toMoney(item.lineTotal) })),
		totals: {
			subtotal: toMoney(order.subtotal),
			installation: 0,
			tax: toMoney(order.taxTotal),
			total: toMoney(order.grandTotal),
			paymentNote: fullyPaid
				? p.t('tracking.paidInFull')
				: paidMinor > 0
					? p.t('tracking.partlyPaid', { amount: toMoney(paidMinor).toLocaleString('id-ID') })
					: p.t('tracking.unpaid'),
		},
		shipping: {
			address: note?.recipientAddress ?? order.customerSnapshot.addressLine ?? '',
			courier: [note?.driverName, note?.vehicleNumber].filter(Boolean).join(' · '),
			siteContact: [note?.recipientPic, note?.recipientContact].filter(Boolean).join(' · '),
			installationTeam: project?.manager?.name ?? '',
		},
		documents: [] as { name: string; meta: string; kind: 'pdf' | 'image' | 'dwg' }[],
		projectManager: { name: project?.manager?.name ?? order.salesPerson?.name ?? '' },
	};
}

/** The portal's sign-in-free status: no customer, prices or addresses. */
export function publicOrderStatus(p: TPresenter, tracking: TOrderTracking) {
	const summary = orderSummary(p, tracking.order);
	return {
		orderNumber: summary.number,
		title: p.t('tracking.publicTitle', { count: tracking.order.items.length }),
		status: summary.status,
		statusLabel: summary.statusLabel,
		arrivalLabel: summary.etaLabel,
		step: summary.step,
		stepCount: summary.stepCount,
		stepLabel: summary.stepLabel,
		progress: summary.progress,
	};
}
