import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@ims-erp/ui/components/alert-dialog';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import {
	ADMIN_PERMISSIONS,
	createRole,
	deleteRole,
	permissionCatalogQueryOptions,
	rolesQueryOptions,
	updateRole,
	type TAdminRole,
	type TPermissionCatalogEntry,
	type TPermissionGrant,
} from '@/lib/admin-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';

export const Route = createFileRoute('/_authed/roles/')({
	component: RolesPage,
});

/** Rank of the owner role; the escalation ceiling for every caller. */
const OWNER_RANK = 100;

function RolesPage() {
	const organizationId = useActiveOrganizationId();
	const queryClient = useQueryClient();
	const { t } = useTranslation(['admin', 'common', 'nav']);

	const canCreate = usePermission(ADMIN_PERMISSIONS.createMembers);
	const canUpdate = usePermission(ADMIN_PERMISSIONS.updateMembers);
	const canDelete = usePermission(ADMIN_PERMISSIONS.deleteMembers);

	const { data: roles, isPending } = useQuery({
		...rolesQueryOptions(organizationId ?? ''),
		enabled: !!organizationId,
	});
	const { data: catalog } = useQuery({
		...permissionCatalogQueryOptions(organizationId ?? ''),
		enabled: !!organizationId,
	});

	/** Which role is open in the editor (null = none, '' = new role). */
	const [editingId, setEditingId] = useState<string | null>(null);

	const remove = useMutation({
		mutationFn: (roleId: string) => deleteRole(organizationId!, roleId),
		onSuccess: async () => {
			toast.success(t('roles.deleted'));
			await refresh();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	async function refresh() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
			queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
		]);
	}

	if (!organizationId) {
		return (
			<div className='p-6 text-sm text-muted-foreground'>
				{t('nav:organization.required')}
			</div>
		);
	}

	const rows = roles ?? [];
	const editingRole = rows.find((role) => role.id === editingId) ?? null;

	// Live roles above the editor's target rank are the escalation ceiling
	// shown as a hint; the backend enforces it for real.
	const highestCustomRank = rows
		.filter((role) => !role.isSystem)
		.reduce((max, role) => Math.max(max, role.rank), 0);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='flex items-center gap-2 text-2xl font-bold'>
						<ShieldCheck className='size-6' />
						{t('roles.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('roles.description')}
					</p>
				</div>
				{canCreate && (
					<Button onClick={() => setEditingId('')}>{t('roles.new')}</Button>
				)}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('roles.masterData')}</CardTitle>
					<CardDescription>
						{t('roles.masterDataDescription', { count: rows.length })}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPending && (
						<p className='text-sm text-muted-foreground'>
							{t('roles.loading')}
						</p>
					)}
					{!isPending && rows.length === 0 && (
						<p className='text-sm text-muted-foreground'>{t('roles.empty')}</p>
					)}
					{rows.length > 0 && (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('roles.role')}</TableHead>
									<TableHead>{t('roles.rank')}</TableHead>
									<TableHead>{t('roles.members')}</TableHead>
									<TableHead>{t('roles.grants')}</TableHead>
									<TableHead className='text-right'>
										{t('roles.actions')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((role) => (
									<TableRow key={role.id}>
										<TableCell>
											<div className='flex items-center gap-2'>
												<span className='font-medium'>{role.name}</span>
												{role.isSystem && (
													<Badge variant='outline'>{t('roles.systemBadge')}</Badge>
												)}
											</div>
										</TableCell>
										<TableCell>
											<Badge variant={role.rank >= OWNER_RANK ? 'default' : 'secondary'}>
												{role.rank}
											</Badge>
										</TableCell>
										<TableCell>{role.memberCount}</TableCell>
										<TableCell className='text-xs text-muted-foreground'>
											{summarizeGrant(role.permissions) ?? t('roles.noGrants')}
										</TableCell>
										<TableCell className='text-right'>
											<div className='flex justify-end gap-2'>
												{canUpdate && (
													<Button
														variant='ghost'
														size='sm'
														onClick={() => setEditingId(role.id)}
													>
														{t('common:action.edit')}
													</Button>
												)}
												{canDelete && !role.isSystem && (
													<AlertDialog>
														<AlertDialogTrigger
															render={
																<Button
																	variant='ghost'
																	size='sm'
																	disabled={remove.isPending}
																>
																	<Trash2 className='size-4' />
																</Button>
															}
														/>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>
																	{t('roles.deleteTitle', { name: role.name })}
																</AlertDialogTitle>
																<AlertDialogDescription>
																	{role.memberCount > 0
																		? t('roles.deleteBlocked', {
																				count: role.memberCount,
																			})
																		: t('roles.deleteOk')}
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>
																	{t('common:action.cancel')}
																</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() => remove.mutate(role.id)}
																>
																	{t('common:action.delete')}
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												)}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{editingId !== null && catalog && (
				<RoleEditor
					organizationId={organizationId}
					catalog={catalog}
					role={editingRole}
					maxRankHint={highestCustomRank}
					onClose={() => setEditingId(null)}
					onSaved={async () => {
						setEditingId(null);
						await refresh();
					}}
				/>
			)}
		</div>
	);
}

/** Compact one-line grant summary for the table; `null` when empty. */
function summarizeGrant(grant: TPermissionGrant): string | null {
	const entries = Object.entries(grant).filter(([, actions]) => actions.length > 0);
	if (entries.length === 0) return null;
	return entries
		.map(([resource, actions]) => `${resource}(${actions.length})`)
		.join(', ');
}

/**
 * Create/edit form with the permission matrix.
 *
 * @remarks
 * The matrix lists every resource in the shared catalog with its actions, so
 * a grant can never reference something the backend does not recognize. The
 * rank field is constrained by the caller's own rank server-side; the hint
 * here just explains why a save may be rejected.
 */
function RoleEditor({
	organizationId,
	catalog,
	role,
	maxRankHint,
	onClose,
	onSaved,
}: {
	organizationId: string;
	catalog: TPermissionCatalogEntry[];
	role: TAdminRole | null;
	maxRankHint: number;
	onClose: () => void;
	onSaved: () => void;
}) {
	const isNew = role === null;
	const [name, setName] = useState(role?.name ?? '');
	const [rank, setRank] = useState(role ? String(role.rank) : '50');
	const [grant, setGrant] = useState<TPermissionGrant>(role?.permissions ?? {});
	const [dirtyPermissions, setDirtyPermissions] = useState(false);
	const { t } = useTranslation(['admin', 'common']);

	function toggle(resource: string, action: string, checked: boolean) {
		setDirtyPermissions(true);
		setGrant((current) => {
			const actions = new Set(current[resource] ?? []);
			if (checked) actions.add(action);
			else actions.delete(action);
			const next = { ...current };
			if (actions.size === 0) delete next[resource];
			else next[resource] = [...actions];
			return next;
		});
	}

	const save = useMutation({
		mutationFn: () => {
			const parsedRank = Number(rank);
			if (!Number.isInteger(parsedRank) || parsedRank < 1 || parsedRank > 100) {
				throw new Error(t('roles.rankInvalid'));
			}
			return isNew
				? createRole(organizationId, {
						name: name.trim(),
						rank: parsedRank,
						permissions: grant,
					})
				: updateRole(organizationId, role.id, {
						name: name.trim() !== role.name ? name.trim() : undefined,
						rank: parsedRank !== role.rank ? parsedRank : undefined,
						permissions: dirtyPermissions ? grant : undefined,
					});
		},
		onSuccess: () => {
			toast.success(isNew ? t('roles.created') : t('roles.updated'));
			onSaved();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{isNew ? t('roles.new') : t('roles.editNamed', { name: role.name })}
				</CardTitle>
				<CardDescription>
					{t('roles.rankHint', {
						maxRank: maxRankHint || '—',
						ownerRank: OWNER_RANK,
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-6'>
				<FieldGroup className='max-w-md'>
					<Field>
						<FieldLabel htmlFor='role-name'>{t('roles.name')}</FieldLabel>
						<Input
							id='role-name'
							placeholder={t('roles.namePlaceholder')}
							value={name}
							disabled={role?.isSystem && !isNew}
							onChange={(event) => setName(event.target.value)}
						/>
						<FieldDescription>{t('roles.nameHint')}</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor='role-rank'>{t('roles.rank')}</FieldLabel>
						<Input
							id='role-rank'
							type='number'
							min={1}
							max={100}
							value={rank}
							onChange={(event) => setRank(event.target.value)}
						/>
						<FieldDescription>{t('roles.rankDescription')}</FieldDescription>
					</Field>
				</FieldGroup>

				<div className='flex flex-col gap-3'>
					<h3 className='text-sm font-semibold'>{t('roles.permissions')}</h3>
					<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
						{catalog.map((entry) => (
							<div key={entry.resource} className='rounded-md border p-3'>
								<div className='mb-2 flex items-center justify-between'>
									<span className='text-sm font-medium'>{entry.resource}</span>
									<Badge variant='outline'>
										{(grant[entry.resource] ?? []).length}/{entry.actions.length}
									</Badge>
								</div>
								<div className='flex flex-col gap-1'>
									{entry.actions.map((action) => (
										<label
											key={action}
											className='flex items-center gap-2 text-xs'
										>
											<Checkbox
												checked={(grant[entry.resource] ?? []).includes(action)}
												onCheckedChange={(checked) =>
													toggle(entry.resource, action, checked === true)
												}
											/>
											{action}
										</label>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className='flex justify-end gap-2'>
					<Button variant='outline' onClick={onClose} disabled={save.isPending}>
						{t('common:action.cancel')}
					</Button>
					<Button onClick={() => save.mutate()} disabled={save.isPending}>
						{isNew ? t('roles.createRole') : t('roles.saveChanges')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
