import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Switch } from '@ims-erp/ui/components/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { TimePicker } from '@ims-erp/ui/components/time-picker';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { todayBusinessDate } from '@/lib/format';
import {
	createSchedule,
	fillSchedule,
	removeSchedule,
	scheduleWeekQueryOptions,
	type TPersonRef,
	type TScheduleCell,
	type TShift,
	updateSchedule,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/schedule` — the weekly work schedule grid (ERP-0118). */
export const Route = createFileRoute('/_authed/hr/schedule/')({
	component: SchedulePage,
});

const DAY_MS = 86_400_000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** Monday of the week holding `date` (business dates, Monday first). */
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

/** The default fill pattern (grill-me Q9): Mon-Sat 08:00-17:00, Sunday off. */
const DEFAULT_PATTERN: TShift[] = [0, 1, 2, 3, 4, 5, 6].map((index) =>
	index === 6
		? { isDayOff: true, shiftStart: null, shiftEnd: null, shiftLabel: null }
		: { isDayOff: false, shiftStart: '08:00', shiftEnd: '17:00', shiftLabel: null },
);

function dayHeading(date: string, language: string, options: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/** What a cell opens: an existing shift, or an empty (employee, date). */
type TEditing = { employee: TPersonRef; date: string; cell: TScheduleCell | null };

function SchedulePage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const canCreate = usePermission('schedule.create');
	const canUpdate = usePermission('schedule.update');
	const canDelete = usePermission('schedule.delete');
	const [start, setStart] = useState(() => mondayOf(todayBusinessDate()));
	const { data, isPending, isError, error } = useQuery(scheduleWeekQueryOptions(start));
	const [editing, setEditing] = useState<TEditing | null>(null);
	const [filling, setFilling] = useState(false);
	const today = todayBusinessDate();

	const editable = (cell: TScheduleCell | null) => (cell ? canUpdate || canDelete : canCreate);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:schedule.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:schedule.description')}</p>
				</div>
				{canCreate && (
					<Button variant='outline' onClick={() => setFilling(true)}>
						{t('hr:schedule.fill')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<Button variant='outline' size='icon' aria-label={t('hr:schedule.previousWeek')} onClick={() => setStart(addDays(start, -7))}>
					<ChevronLeft className='size-4' />
				</Button>
				<DatePicker
					className='w-44'
					aria-label={t('hr:schedule.week')}
					value={start}
					onChange={(value) => value && setStart(mondayOf(value))}
				/>
				<Button variant='outline' size='icon' aria-label={t('hr:schedule.nextWeek')} onClick={() => setStart(addDays(start, 7))}>
					<ChevronRight className='size-4' />
				</Button>
				<Button variant='ghost' size='sm' onClick={() => setStart(mondayOf(today))}>
					{t('hr:schedule.thisWeek')}
				</Button>
			</div>
			{isPending ? (
				<PageSkeleton cards={1} />
			) : isError ? (
				<ErrorState error={error} bordered />
			) : data.rows.length === 0 ? (
				<EmptyState title={t('hr:schedule.empty')} bordered />
			) : (
				<div className='overflow-x-auto rounded-md border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className='min-w-48'>{t('hr:field.employee')}</TableHead>
								{data.dates.map((date) => (
									<TableHead key={date} className={date === today ? 'min-w-28 text-primary' : 'min-w-28'}>
										{dayHeading(date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.rows.map((row) => (
								<TableRow key={row.employee.id}>
									<TableCell>
										<div className='font-medium'>{row.employee.fullName}</div>
										<div className='text-xs text-muted-foreground'>{row.employee.employeeCode}</div>
									</TableCell>
									{data.dates.map((date) => {
										const cell = row.cells[date] ?? null;
										const label = !cell
											? '—'
											: cell.isDayOff
												? t('hr:schedule.dayOff')
												: `${cell.shiftStart}–${cell.shiftEnd}`;
										return (
											<TableCell key={date} className='p-1'>
												<Button
													variant={cell ? (cell.isDayOff ? 'secondary' : 'outline') : 'ghost'}
													size='sm'
													className='h-auto w-full flex-col items-start gap-0 px-2 py-1 text-left tabular-nums'
													disabled={!editable(cell)}
													aria-label={`${row.employee.fullName} ${date}`}
													onClick={() => setEditing({ employee: row.employee, date, cell })}
												>
													<span>{label}</span>
													{cell?.shiftLabel && <span className='text-xs text-muted-foreground'>{cell.shiftLabel}</span>}
												</Button>
											</TableCell>
										);
									})}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
			{editing && (
				<CellDialog
					key={`${editing.employee.id}-${editing.date}`}
					editing={editing}
					canSave={editing.cell ? canUpdate : canCreate}
					canDelete={canDelete}
					onClose={() => setEditing(null)}
				/>
			)}
			{filling && <FillDialog start={start} onClose={() => setFilling(false)} />}
		</div>
	);
}

/** Shift fields shared by the cell dialog and every pattern row. */
function ShiftFields({ id, value, onChange }: { id: string; value: TShift; onChange: (next: TShift) => void }) {
	const { t } = useTranslation('hr');
	return (
		<div className='grid grid-cols-[auto_1fr_1fr] items-center gap-2 sm:grid-cols-[auto_1fr_1fr_1fr]'>
			<label className='flex items-center gap-2 text-sm' htmlFor={`${id}-off`}>
				<Switch
					id={`${id}-off`}
					checked={value.isDayOff}
					onCheckedChange={(checked: boolean) =>
						onChange(
							checked
								? { ...value, isDayOff: true, shiftStart: null, shiftEnd: null }
								: { ...value, isDayOff: false, shiftStart: '08:00', shiftEnd: '17:00' },
						)
					}
				/>
				{t('schedule.dayOff')}
			</label>
			<TimePicker
				aria-label={t('schedule.start')}
				disabled={value.isDayOff}
				value={value.shiftStart ?? ''}
				onChange={(next) => onChange({ ...value, shiftStart: next || null })}
			/>
			<TimePicker
				aria-label={t('schedule.end')}
				disabled={value.isDayOff}
				value={value.shiftEnd ?? ''}
				onChange={(next) => onChange({ ...value, shiftEnd: next || null })}
			/>
			<Input
				className='col-span-3 sm:col-span-1'
				aria-label={t('schedule.label')}
				placeholder={t('schedule.label')}
				maxLength={100}
				value={value.shiftLabel ?? ''}
				onChange={(event) => onChange({ ...value, shiftLabel: event.target.value || null })}
			/>
		</div>
	);
}

const complete = (shift: TShift) => shift.isDayOff || (!!shift.shiftStart && !!shift.shiftEnd);

function CellDialog({
	editing,
	canSave,
	canDelete,
	onClose,
}: {
	editing: TEditing;
	canSave: boolean;
	canDelete: boolean;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { cell } = editing;
	const [shift, setShift] = useState<TShift>(
		cell
			? { isDayOff: cell.isDayOff, shiftStart: cell.shiftStart, shiftEnd: cell.shiftEnd, shiftLabel: cell.shiftLabel }
			: DEFAULT_PATTERN[0]!,
	);
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['hr', 'schedule'] });
			toast.success(done);
			onClose();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	const input = { ...shift, employeeId: editing.employee.id, workDate: editing.date };

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void run(
							() => (cell ? updateSchedule(cell.id, input) : createSchedule(input)),
							cell ? t('hr:schedule.updated') : t('hr:schedule.created'),
						);
					}}
				>
					<DialogHeader>
						<DialogTitle>{cell ? t('hr:schedule.edit') : t('hr:schedule.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<p className='text-sm'>
							<span className='font-medium'>{editing.employee.fullName}</span> ·{' '}
							{dayHeading(editing.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
						</p>
						<Field>
							<FieldLabel htmlFor='cell'>{t('hr:schedule.shift')}</FieldLabel>
							<ShiftFields id='cell' value={shift} onChange={setShift} />
							<FieldDescription>{t('hr:schedule.overnightHint')}</FieldDescription>
						</Field>
					</FieldGroup>
					<DialogFooter>
						{cell && canDelete && (
							<Button
								type='button'
								variant='destructive'
								className='sm:mr-auto'
								disabled={busy}
								onClick={async () => {
									if (await confirm({ title: t('hr:schedule.deleteConfirm'), destructive: true })) {
										void run(() => removeSchedule(cell.id), t('hr:schedule.deleted'));
									}
								}}
							>
								{t('hr:schedule.delete')}
							</Button>
						)}
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						{canSave && (
							<Button type='submit' disabled={busy || !complete(shift)}>
								{t('common:action.save')}
							</Button>
						)}
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function FillDialog({ start, onClose }: { start: string; onClose: () => void }) {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const [from, setFrom] = useState(start);
	const [to, setTo] = useState(addDays(start, 6));
	const [employeeId, setEmployeeId] = useState('');
	const [pattern, setPattern] = useState<TShift[]>(DEFAULT_PATTERN);
	const [busy, setBusy] = useState(false);
	// Weekday names from a known Monday (2026-11-23), Monday first.
	const weekdays = [0, 1, 2, 3, 4, 5, 6].map((index) => dayHeading(addDays('2026-11-23', index), i18n.language, { weekday: 'long' }));

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className='sm:max-w-2xl'>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setBusy(true);
						try {
							const result = await fillSchedule({ from, to, employeeIds: employeeId ? [employeeId] : undefined, pattern });
							await queryClient.invalidateQueries({ queryKey: ['hr', 'schedule'] });
							toast.success(t('hr:schedule.filled', { created: result.created, skipped: result.skipped }));
							onClose();
						} catch (cause) {
							toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
						} finally {
							setBusy(false);
						}
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('hr:schedule.fill')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<div className='grid gap-4 sm:grid-cols-3'>
							<Field>
								<FieldLabel htmlFor='fill-from'>{t('hr:schedule.from')}</FieldLabel>
								<DatePicker id='fill-from' required value={from} onChange={setFrom} />
							</Field>
							<Field>
								<FieldLabel htmlFor='fill-to'>{t('hr:schedule.to')}</FieldLabel>
								<DatePicker id='fill-to' required min={from} value={to} onChange={setTo} />
							</Field>
							<Field>
								<FieldLabel htmlFor='fill-employee'>{t('hr:field.employee')}</FieldLabel>
								<EmployeeSelect id='fill-employee' value={employeeId} allowAll={t('hr:schedule.allEmployees')} onChange={setEmployeeId} />
							</Field>
						</div>
						<Field>
							<FieldLabel>{t('hr:schedule.pattern')}</FieldLabel>
							<div className='flex flex-col gap-3'>
								{pattern.map((shift, index) => (
									<div key={weekdays[index]} className='grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-center'>
										<span className='text-sm font-medium'>{weekdays[index]}</span>
										<ShiftFields
											id={`pattern-${index}`}
											value={shift}
											onChange={(next) => setPattern((current) => current.map((item, position) => (position === index ? next : item)))}
										/>
									</div>
								))}
							</div>
							<FieldDescription>{t('hr:schedule.fillHint')}</FieldDescription>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !from || !to || to < from || !pattern.every(complete)}>
							{t('hr:schedule.fillSubmit')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
