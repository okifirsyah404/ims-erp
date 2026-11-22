import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { Button } from '@ims-erp/ui/components/button';
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@ims-erp/ui/components/combobox';
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Switch } from '@ims-erp/ui/components/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	employmentTypeLabels,
	erpRoleLabel,
	parseInviteSheet,
	MAX_INVITE_SHEET_ROWS,
} from '@ims-erp/common';
import {
	BULK_INVITE_LIMIT,
	parseBulkInviteRows,
	sendInvitations,
	downloadInvitationTemplate,
	type TBulkInviteResult,
	type TInviteInput,
} from '@/lib/admin-api';
import { listOrganizations, type TOrganization } from '@/lib/organization-api';
import {
	sendOrgInvitations,
	downloadOrgInvitationTemplate,
} from '@/lib/org-invitation-api';
import { useGrantableOrgRoles } from '@/lib/use-caller-org-roles';

/** `admin` = application-level dialog (`/admin/users`); `org` = organization detail. */
export type TInviteMode = 'admin' | 'org';

/** Selector value for the explicit "no organization" (application-level) choice. */
const NO_ORGANIZATION = '__none__';

/** One row of the organization picker. */
type TOrgItem = { value: string; label: string };

/**
 * Invitation dialog, shared by the two entry points.
 *
 * @remarks
 * - `mode='admin'` (application administrators, `/admin/users`): the invitee
 *   may be attached to any live organization or to none. Bulk rows read
 *   `email, name, org-code, role`; an empty code means an application-level
 *   invite and the role is ignored.
 * - `mode='org'` (organization members tab): the organization comes from the
 *   page, never from the dialog. Bulk rows read `email, name, role`.
 *
 * The dialog is UX only; the backend re-validates every row and re-checks the
 * caller's permission and organization scope.
 */
export function InviteDialog({
	mode,
	organizationId,
	open,
	onOpenChange,
	onInvited,
}: {
	mode: TInviteMode;
	/** `org` mode target; also the `admin` mode default selection. */
	organizationId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onInvited: () => void;
}) {
	const isAdmin = mode === 'admin';
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');
	const [organizationRole, setOrganizationRole] = useState<string>('member');
	const [targetOrganizationId, setTargetOrganizationId] = useState<string | null>(
		organizationId ?? null,
	);
	const [bulk, setBulk] = useState('');
	const [fileRows, setFileRows] = useState<TInviteInput[] | null>(null);
	const [fileErrors, setFileErrors] = useState<string[]>([]);
	const [report, setReport] = useState<string[] | null>(null);
	// Permanent vs. temporary employee. Applies to every tab: single, bulk and
	// file rows all create an employee record, and a sheet row without its own
	// `employmentType` cell falls back to this.
	const [isPermanent, setIsPermanent] = useState(true);
	const employmentType = isPermanent ? 'permanent' : 'contract';
	const { t, i18n } = useTranslation(['admin', 'common']);

	// Every live organization, for the admin-mode selector and bulk codes.
	// Deleted organizations are excluded: an invitation into one cannot be
	// accepted, so offering it would only produce a failure.
	const { data: organizations } = useQuery({
		queryKey: ['organizations', 'invite-selector'],
		queryFn: () => listOrganizations({ limit: 100 }),
		enabled: isAdmin && open,
		staleTime: 60 * 1000,
	});
	const options = (organizations?.rows ?? []).filter((row) => !row.deletedAt);

	// The organization whose membership governs the role dropdown. In `org`
	// mode it is the page's organization; in `admin` mode it follows the
	// selector, so switching target organizations re-evaluates the caller's
	// tier there (a platform admin may be owner in one org and a plain member
	// in another).
	const roleScopeOrganizationId = isAdmin ? targetOrganizationId : (organizationId ?? null);
	const { roles: grantableRoles } = useGrantableOrgRoles(roleScopeOrganizationId);

	// Derived, not synced in an effect: a role picked for one organization may
	// sit above the caller's tier in the next, so the *effective* role is
	// clamped at render time. The stored value is left untouched so returning
	// to an organization where it is legal restores it.
	const effectiveRole = grantableRoles.includes(organizationRole as never)
		? organizationRole
		: grantableRoles.includes('member')
			? 'member'
			: (grantableRoles[0] ?? 'member');

	const send = useMutation({
		mutationFn: (input: TInviteInput | TInviteInput[]) =>
			isAdmin
				? // The header carries the guard's organization context; the
					// invite's own organization travels in the body.
					sendInvitations(organizationId ?? '', input)
				: sendOrgInvitations(organizationId ?? '', input),
		onSuccess: (result) => {
			// Bulk returns a per-row summary; single returns the invitation.
			const bulkResult = result as TBulkInviteResult | undefined;
			if (bulkResult?.results) {
				const failures = bulkResult.results
					.filter((row) => !row.ok)
					.map((row) => (row.ok ? '' : `${row.email}: ${row.error}`))
					.filter(Boolean);
				if (bulkResult.failed > 0) {
					setReport(failures);
					toast.error(
						t('invite.sentMixed', {
							succeeded: bulkResult.succeeded,
							failed: bulkResult.failed,
						}),
					);
				} else {
					toast.success(t('invite.sentBulk', { count: bulkResult.succeeded }));
					setReport(null);
					reset();
					onOpenChange(false);
				}
			} else {
				toast.success(t('invite.sent'));
				setReport(null);
				reset();
				onOpenChange(false);
			}
			onInvited();
		},
		onError: (error: Error) => {
			setReport([error.message]);
			toast.error(error.message);
		},
	});

	function reset() {
		setEmail('');
		setName('');
		setOrganizationRole('member');
		setBulk('');
		setFileRows(null);
		setFileErrors([]);
	}

	function submitSingle() {
		if (!email.trim()) {
			toast.error(t('invite.emailRequired'));
			return;
		}
		if (!name.trim()) {
			// `name` is required by the backend contract (it greets the
			// invitee and prefills their profile).
			toast.error(t('invite.nameRequired'));
			return;
		}
		setReport(null);
		// A role only means something inside an organization.
		send.mutate({
			email: email.trim(),
			name: name.trim(),
			organizationId: targetOrganizationId ?? undefined,
			organizationRoles: targetOrganizationId ? [effectiveRole] : undefined,
			// Every invitation creates an employee record (company-level when no
			// organization is chosen), so the switch always applies.
			employmentType,
		});
	}

	function submitBulk() {
		const { rows, rowErrors, error } = parseBulkInviteRows(bulk, {
			mode,
			organizationId,
			organizationRole: effectiveRole,
			allowedRoles: grantableRoles,
			employmentType,
			resolveOrganizationCode: (code) =>
				options.find((row) => row.slug === code)?.id ?? null,
		});
		if (error) {
			setReport([error]);
			toast.error(error);
			return;
		}
		// Row-level failures are reported alongside the batch summary, so a
		// single bad code does not discard the rows that parsed cleanly.
		setReport(rowErrors.length > 0 ? rowErrors : null);
		if (rows.length === 0) {
			toast.error(rowErrors[0] ?? t('invite.rowsEmpty'));
			return;
		}
		send.mutate(rows);
	}

	async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		setFileRows(null);
		setFileErrors([]);
		if (file.size > 1024 * 1024) {
			setFileErrors([t('invite.fileTooLarge')]);
			return;
		}
		try {
			const buffer = new Uint8Array(await file.arrayBuffer());
			// `allowedRoles` is the same ladder the dropdown uses: the sheet
			// parser reports a disallowed role as a per-row error instead of
			// sending a request the backend will reject.
			const parsed = parseInviteSheet(file.name, buffer, {
				allowedRoles: grantableRoles,
			});
			if (parsed.rows.length === 0 && parsed.errors.length === 0) {
				setFileErrors([t('invite.fileEmpty')]);
				return;
			}
			const errors = parsed.errors.map((e) =>
				t('invite.fileRowError', { row: e.row, message: e.message }),
			);
			// Admin rows resolve the slug client-side; org rows pin to the page's
			// organization. Backend re-validates everything regardless.
			const rows: TInviteInput[] = parsed.rows.map((row) => {
				const targetOrgId = isAdmin
					? (row.organizationSlug
						? (options.find((o) => o.slug === row.organizationSlug)?.id ??
							row.organizationSlug)
						: undefined)
					: organizationId;
				// Sheet cells carry pipe-separated roles ('admin|finance');
				// empty falls back to the dialog default.
				const roles = targetOrgId
					? (row.role
						? row.role.split('|').map((r) => r.trim()).filter(Boolean)
						: [effectiveRole])
					: undefined;
				return {
					email: row.email,
					name: row.name,
					organizationId: targetOrgId,
					organizationRoles: roles,
					// A row may override the switch (spreadsheet column).
					employmentType: row.employmentType ?? employmentType,
				};
			});
			setFileRows(rows);
			setFileErrors(errors);
		} catch (error) {
			setFileErrors([
				error instanceof Error ? error.message : t('invite.fileUnreadable'),
			]);
		}
	}

	async function downloadTemplate(format: 'xlsx' | 'csv') {
		try {
			const download = isAdmin
				? downloadInvitationTemplate(format)
				: downloadOrgInvitationTemplate(organizationId ?? '', format);
			await download;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	}

	function submitFile() {
		if (!fileRows || fileRows.length === 0) {
			toast.error(t('invite.fileEmpty'));
			return;
		}
		setReport(null);
		send.mutate(fileRows);
	}

	/**
	 * Role dropdown, restricted to what the caller may actually assign.
	 *
	 * @remarks
	 * `grantableRoles` comes from the shared ladder
	 * (`grantableOrganizationRoles`): `owner` never appears, an org admin does
	 * not see `admin`, org HR does not see `hr`. The backend enforces the same
	 * rule, so hiding an option here is UX, not the boundary.
	 */
	const roleSelect = (placeholder: string) => (
		<Select
			value={effectiveRole}
			onValueChange={(value) => setOrganizationRole(value ?? 'member')}
		>
			<SelectTrigger>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{grantableRoles.map((roleName) => (
					<SelectItem key={roleName} value={roleName}>
						{erpRoleLabel(roleName, i18n.language)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	/**
	 * Permanent/temporary switch for the employee record every org invite
	 * creates. One switch, above the tabs, so all three input modes agree.
	 */
	const employmentSwitch = (
		<Field orientation='horizontal' className='items-center justify-between rounded-lg border p-3'>
			<div className='flex flex-col gap-0.5'>
				<FieldLabel htmlFor='invite-employment-type'>
					{t('invite.permanentEmployee')}
				</FieldLabel>
				<p className='text-xs text-muted-foreground'>
					{t('invite.permanentEmployeeHint')}
				</p>
			</div>
			<div className='flex items-center gap-2'>
				<span className='text-xs text-muted-foreground'>
					{employmentTypeLabels[isPermanent ? 'permanent' : 'contract'][
						i18n.language.startsWith('id') ? 'id' : 'en'
					]}
				</span>
				<Switch
					id='invite-employment-type'
					checked={isPermanent}
					onCheckedChange={(checked) => setIsPermanent(checked)}
				/>
			</div>
		</Field>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>{t('invite.title')}</DialogTitle>
					<DialogDescription>{t('invite.description')}</DialogDescription>
				</DialogHeader>

				{employmentSwitch}

				<Tabs defaultValue='single'>
					<TabsList>
						<TabsTrigger value='single'>{t('invite.single')}</TabsTrigger>
						<TabsTrigger value='bulk'>{t('invite.bulk')}</TabsTrigger>
						<TabsTrigger value='file'>{t('invite.file')}</TabsTrigger>
					</TabsList>

					<TabsContent value='single' className='pt-4'>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='invite-email'>
									{t('invite.email')}
								</FieldLabel>
								<Input
									id='invite-email'
									type='email'
									placeholder={t('invite.emailPlaceholder')}
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='invite-name'>{t('invite.name')}</FieldLabel>
								<Input
									id='invite-name'
									placeholder={t('invite.namePlaceholder')}
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							{isAdmin && (
								<Field>
									<FieldLabel>{t('invite.organization')}</FieldLabel>
									<OrganizationSelect
										options={options}
										value={targetOrganizationId}
										onChange={setTargetOrganizationId}
										placeholder={t('invite.organizationPlaceholder')}
										emptyLabel={t('invite.organizationEmpty')}
									/>
								</Field>
							)}
							{targetOrganizationId && (
								<Field>
									<FieldLabel>{t('invite.role')}</FieldLabel>
									{roleSelect(t('invite.rolePlaceholder'))}
								</Field>
							)}
						</FieldGroup>
						<DialogFooter className='mt-6'>
							<Button
								variant='outline'
								onClick={() => onOpenChange(false)}
								disabled={send.isPending}
							>
								{t('common:action.cancel')}
							</Button>
							<Button onClick={submitSingle} disabled={send.isPending}>
								{t('invite.send')}
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent value='bulk' className='pt-4'>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='invite-bulk'>
									{t('invite.rows', { max: BULK_INVITE_LIMIT })}
								</FieldLabel>
								<Textarea
									id='invite-bulk'
									className='min-h-40 font-mono text-xs'
									placeholder={
										isAdmin
											? t('invite.rowsPlaceholderAdmin')
											: t('invite.rowsPlaceholder')
									}
									value={bulk}
									onChange={(event) => setBulk(event.target.value)}
								/>
								<p className='text-xs text-muted-foreground'>
									<Trans
										t={t}
										i18nKey={
											isAdmin ? 'invite.rowsHintAdmin' : 'invite.rowsHint'
										}
										components={{ code: <code />, strong: <strong /> }}
									/>
								</p>
							</Field>
							<Field>
								<FieldLabel>{t('invite.defaultRole')}</FieldLabel>
								{roleSelect(t('invite.defaultRolePlaceholder'))}
							</Field>
						</FieldGroup>
						<DialogFooter className='mt-6'>
							<Button
								variant='outline'
								onClick={() => onOpenChange(false)}
								disabled={send.isPending}
							>
								{t('common:action.cancel')}
							</Button>
							<Button onClick={submitBulk} disabled={send.isPending}>
								{t('invite.sendBulk')}
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent value='file' className='pt-4'>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='invite-file'>
									{t('invite.fileLabel', { max: MAX_INVITE_SHEET_ROWS })}
								</FieldLabel>
								<Input
									id='invite-file'
									type='file'
									accept='.csv,.xlsx,.xls'
									onChange={(event) => void handleFile(event)}
								/>
								<p className='text-xs text-muted-foreground'>
									<Trans
										t={t}
										i18nKey='invite.fileHint'
										components={{ code: <code /> }}
									/>
								</p>
								<div className='flex gap-2'>
									<Button
										type='button'
										variant='outline'
										size='sm'
										onClick={() => void downloadTemplate('xlsx')}
									>
										{t('invite.downloadTemplateXlsx')}
									</Button>
									<Button
										type='button'
										variant='outline'
										size='sm'
										onClick={() => void downloadTemplate('csv')}
									>
										{t('invite.downloadTemplateCsv')}
									</Button>
								</div>
							</Field>
							{fileRows && fileRows.length > 0 && (
								<p className='text-sm'>
									{t('invite.fileReady', { count: fileRows.length })}
								</p>
							)}
							{fileErrors.length > 0 && (
								<div className='max-h-40 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
									{fileErrors.map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							)}
						</FieldGroup>
						<DialogFooter className='mt-6'>
							<Button
								variant='outline'
								onClick={() => onOpenChange(false)}
								disabled={send.isPending}
							>
								{t('common:action.cancel')}
							</Button>
							<Button
								onClick={submitFile}
								disabled={send.isPending || !fileRows || fileRows.length === 0}
							>
								{t('invite.sendBulk')}
							</Button>
						</DialogFooter>
					</TabsContent>
				</Tabs>

				{report && report.length > 0 && (
					<div className='mt-2 max-h-40 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
						{report.map((line) => (
							<div key={line}>{line}</div>
						))}
					</div>
				)}
			</ScrollDialogContent>
		</Dialog>
	);
}

/**
 * Searchable organization picker with an explicit application-level option.
 *
 * @remarks
 * `null` means "no organization" (the invite creates a user without a
 * membership) — a deliberate choice, not an empty state, which is why it is a
 * list item rather than a cleared input.
 */
function OrganizationSelect({
	options,
	value,
	onChange,
	placeholder,
	emptyLabel,
}: {
	options: TOrganization[];
	value: string | null;
	onChange: (value: string | null) => void;
	placeholder: string;
	emptyLabel: string;
}) {
	const { t } = useTranslation(['admin']);
	const items = useMemo<TOrgItem[]>(
		() => [
			{ value: NO_ORGANIZATION, label: t('invite.noOrganization') },
			...options.map((row) => ({ value: row.id, label: row.name })),
		],
		[options, t],
	);
	const selected = items.find((item) => item.value === (value ?? NO_ORGANIZATION)) ?? null;
	const [query, setQuery] = useState('');

	// Filtered here, not via a `ComboboxList` function child: that child must be
	// the list's only child, and the empty state sits inside the list too.
	const matches = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) return items;
		return items.filter((item) => item.label.toLowerCase().includes(term));
	}, [items, query]);

	return (
		<Combobox
			items={items}
			value={selected}
			onValueChange={(next: TOrgItem | null) =>
				onChange(
					!next || next.value === NO_ORGANIZATION ? null : next.value,
				)
			}
			isItemEqualToValue={(item: TOrgItem, candidate: TOrgItem) =>
				item.value === candidate.value
			}
			itemToStringLabel={(item: TOrgItem) => item.label}
			onInputValueChange={(input: string) => setQuery(input)}
		>
			<ComboboxInput placeholder={placeholder} showClear />
			<ComboboxContent>
				<ComboboxList>
					<ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
					{matches.map((item) => (
						<ComboboxItem key={item.value} value={item}>
							{item.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
