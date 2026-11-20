/**
 * Public order tracking views (ERP-0073): the website's `PublicTracking`
 * (`apps/web-landing/src/api/website.ts`, full status after the contact
 * check) and the portal's minimal `PublicOrderStatus`. Money is whole rupiah,
 * progress 0..1, labels in the request language.
 */
import type { TOrderTracking } from '@app/sales/services/order-tracking.service';
import type { TTrackedOrder } from '../services/public-tracking.service';
import { dateLabel, documentFileUrl, type TPresenter } from './portal-presenter';
import { toMoney } from './portal-sales-presenter';

export const TRACKING_STAGES = ['received', 'paid', 'production', 'qc', 'shipped', 'installation', 'completed'] as const;
export type TTrackingStage = (typeof TRACKING_STAGES)[number];

type TStageFact = { stage: TTrackingStage; done: boolean; at: Date | string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (p: TPresenter, date: string | null): number =>
	date ? Math.max(0, Math.round((new Date(`${date}T00:00:00+07:00`).getTime() - new Date(`${p.today}T00:00:00+07:00`).getTime()) / DAY_MS)) : 0;

/** Courier names for the codes delivery notes carry (ERP-0080). */
const COURIER_NAMES: Record<string, string> = {
	own: 'Entragate',
	jne: 'JNE',
	jnt: 'J&T Express',
	sicepat: 'SiCepat',
	anteraja: 'AnterAja',
	pos: 'POS Indonesia',
	tiki: 'TIKI',
	lion: 'Lion Parcel',
	ninja: 'Ninja Xpress',
	wahana: 'Wahana',
};

type TNote = TOrderTracking['deliveryNotes'][number];

/** "JNE REG" / "Entragate · Budi · B 1234 CD" — who carries the latest shipment. */
export function courierLabel(note: TNote | undefined): string {
	if (!note) return '';
	const code = note.courierCode ?? (note.driverName || note.vehicleNumber ? 'own' : null);
	if (!code) return '';
	if (code === 'own') return [COURIER_NAMES.own, note.driverName, note.vehicleNumber].filter(Boolean).join(' · ');
	return [COURIER_NAMES[code] ?? code.toUpperCase(), note.courierService].filter(Boolean).join(' ');
}

/** The latest shipment that left (or the latest prepared one). */
const latestNote = (notes: TNote[]) => [...notes].reverse().find((note) => note.status !== 'prepared') ?? notes[notes.length - 1];

/**
 * The step in progress: the one right after the last finished step. An earlier step that is
 * still open (e.g. payment due after delivery) does not pull the order back.
 */
export function currentStageIndex(facts: { done: boolean }[]): number {
	let last = -1;
	facts.forEach((fact, index) => {
		if (fact.done) last = index;
	});
	return last + 1 >= facts.length ? -1 : last + 1;
}

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
	const currentIndex = currentStageIndex(facts);
	const current = currentIndex === -1 ? facts[facts.length - 1]! : facts[currentIndex]!;
	const doneCount = facts.filter((fact) => fact.done).length;
	const note = latestNote(deliveryNotes);
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
			fullyPaid,
			paymentNote: fullyPaid
				? p.t('tracking.paidInFull')
				: paidMinor > 0
					? p.t('tracking.partlyPaid', { amount: toMoney(paidMinor).toLocaleString('id-ID') })
					: p.t('tracking.unpaid'),
		},
		shipping: {
			address: note?.recipientAddress ?? order.customerSnapshot.addressLine ?? '',
			courier: [courierLabel(note), note?.waybillNumber ? `AWB ${note.waybillNumber}` : null].filter(Boolean).join(' · '),
			siteContact: [note?.recipientPic, note?.recipientContact].filter(Boolean).join(' · '),
			installationTeam: project?.manager?.name ?? '',
		},
		documents: [] as { name: string; meta: string; kind: 'pdf' | 'image' | 'dwg' }[],
		projectManager: { name: project?.manager?.name ?? order.salesPerson?.name ?? '' },
	};
}

/** The portal's sign-in-free status: no customer, prices or addresses (same stages as the order page). */
export function publicOrderStatus(p: TPresenter, tracking: TOrderTracking) {
	const summary = portalOrderSummary(p, { ...tracking, project: null });
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

/* ------------------------------------------------------------------------ *
 * Customer portal orders (ERP-0080): the same stages as public tracking
 * ------------------------------------------------------------------------ */

type TPortalOrderStatus = 'confirmed' | 'production' | 'qc' | 'shipped' | 'installing' | 'delivered' | 'cancelled';

/** The portal's order status from the furthest finished stage. */
export function portalOrderStatus(tracked: TTrackedOrder): TPortalOrderStatus {
	if (tracked.order.status === 'cancelled') return 'cancelled';
	const facts = trackingStages(tracked);
	const done = (stage: TTrackingStage) => facts.find((fact) => fact.stage === stage)?.done ?? false;
	if (done('completed')) return 'delivered';
	if (done('shipped')) return tracked.project && !done('installation') ? 'installing' : 'shipped';
	if (done('qc')) return 'qc';
	if (done('production')) return 'production';
	return 'confirmed';
}

/** `OrderSummary` of the portal, from real progress (delivery notes, project, payment). */
export function portalOrderSummary(p: TPresenter, tracked: TTrackedOrder) {
	const { order } = tracked;
	const facts = trackingStages(tracked);
	const status = portalOrderStatus(tracked);
	const doneCount = facts.filter((fact) => fact.done).length;
	const currentIndex = currentStageIndex(facts);
	const statusLabel =
		status === 'cancelled'
			? p.t('tracking.cancelled')
			: currentIndex === -1
				? p.t('tracking.stage.completed')
				: p.t(`tracking.now.${facts[currentIndex]!.stage}` as const);
	const finish = tracked.project?.targetEndDate ?? order.deliveryDate;
	return {
		id: order.id,
		number: order.code,
		title: order.title,
		status,
		statusLabel,
		step: status === 'cancelled' ? 0 : doneCount,
		stepCount: facts.length,
		stepLabel: statusLabel,
		progress: status === 'cancelled' ? 0 : doneCount / facts.length,
		etaLabel: finish ? p.t('portal.sales.order.eta', { date: dateLabel(p, finish) }) : p.t('portal.sales.order.etaOpen'),
		total: toMoney(order.grandTotal),
		placedAt: order.orderDate,
	};
}

/** `OrderDetail` of the portal: timeline, delivery (courier, AWB), installation and documents. */
export function portalOrderDetail(p: TPresenter, tracked: TTrackedOrder) {
	const { order, project, paidMinor, fullyPaid } = tracked;
	const summary = portalOrderSummary(p, tracked);
	const facts = trackingStages(tracked);
	const currentIndex = currentStageIndex(facts);
	const note = latestNote(tracked.deliveryNotes);
	const onTheWay = note?.status === 'shipped';
	return {
		...summary,
		arrivalLabel: summary.etaLabel,
		arrivalWindow: order.deliveryDate ? dateLabel(p, order.deliveryDate) : '',
		lines: order.items.map((item) => ({
			name: item.name,
			detail: item.specification ?? item.sku ?? '',
			quantity: Number(item.quantity),
			amount: toMoney(item.lineTotal),
		})),
		delivery: {
			site: project?.siteName ?? note?.recipientName ?? order.customerSnapshot.name,
			address: note?.recipientAddress ?? note?.projectLocation ?? order.customerSnapshot.addressLine ?? '',
			courier: courierLabel(note),
			awb: note?.waybillNumber ?? '',
			...(note?.recipientPic ? { pic: [note.recipientPic, note.recipientContact].filter(Boolean).join(' · ') } : {}),
		},
		...(project
			? {
					installation: {
						label: project.targetStartDate ? dateLabel(p, project.targetStartDate) : p.t('tracking.toBeConfirmed'),
						detail: [project.siteName, project.manager?.name].filter(Boolean).join(' · '),
					},
				}
			: {}),
		payment: {
			subtotal: toMoney(order.subtotal),
			...(order.discountTotal > 0 ? { discountLabel: p.t('portal.sales.discount'), discount: toMoney(order.discountTotal) } : {}),
			tax: toMoney(order.taxTotal),
			total: toMoney(order.grandTotal),
			fullyPaid,
			paidLabel: fullyPaid
				? p.t('tracking.paidInFull')
				: paidMinor > 0
					? p.t('tracking.partlyPaid', { amount: toMoney(paidMinor).toLocaleString('id-ID') })
					: p.t('tracking.unpaid'),
		},
		documents: tracked.invoiceIds.map((invoice) => ({
			id: invoice.id,
			name: invoice.code ?? '',
			meta: dateLabel(p, invoice.issueDate),
			kind: 'pdf' as const,
			url: documentFileUrl('invoice', invoice.id),
		})),
		timeline: facts.map((fact, index) => ({
			title: p.t(`tracking.stage.${fact.stage}` as const),
			description: p.t(`tracking.text.${fact.stage}` as const),
			dateLabel: fact.at ? dateLabel(p, fact.at) : '',
			state: fact.done ? ('done' as const) : index === currentIndex ? ('current' as const) : ('upcoming' as const),
		})),
		...(onTheWay
			? {
					courier: {
						name: courierLabel(note),
						vehicle: note?.waybillNumber ? `AWB ${note.waybillNumber}` : (note?.vehicleNumber ?? ''),
						distanceLabel: '',
						updatedLabel: note?.shippedAt ? p.t('tracking.updated', { date: dateLabel(p, note.shippedAt) }) : '',
					},
				}
			: {}),
	};
}
