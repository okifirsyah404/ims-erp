import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { Textarea } from '@ims-erp/ui/components/textarea';
import {
	BULK_INVITE_LIMIT,
	parseBulkInviteRows,
	sendInvitations,
	rolesQueryOptions,
	type TBulkInviteResult,
	type TInviteInput,
} from '@/lib/admin-api';
import { humanizeIdentifier } from '@/lib/format';

/**
 * Invitation dialog with two paths (locked decisions D2/D13):
 *
 * - **Single**: `email` + optional `name` + a role from the organization's
 *   live role master data. A typo'd role is rejected by the backend.
 * - **Bulk**: paste up to 100 rows, `email[,name[,role]]` per line. Per-row
 *   isolation — an unapproved role falls back to `member` server-side and
 *   every failure is reported back for that row only.
 *
 * The dialog is UX only; the backend re-validates every row.
 */
export function InviteDialog({
	organizationId,
	open,
	onOpenChange,
	onInvited,
}: {
	organizationId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onInvited: () => void;
}) {
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');
	const [roleId, setRoleId] = useState<string | undefined>();
	const [bulk, setBulk] = useState('');
	const [report, setReport] = useState<string[] | null>(null);
	const { t } = useTranslation(['admin', 'common']);

	// Only live, non-system-bound roles are offered. Ordering comes from the
	// backend (ascending rank) so the last item is the highest grantable role.
	const { data: roles } = useQuery({
		...rolesQueryOptions(organizationId),
		enabled: open,
	});
	const assignable = (roles ?? []).filter((role) => !role.deletedAt);
	const roleNamesById = new Map(
		assignable.map((role) => [role.id, role.name] as const),
	);

	const send = useMutation({
		mutationFn: (input: TInviteInput | TInviteInput[]) =>
			sendInvitations(organizationId, input),
		onSuccess: (result) => {
			// Bulk returns a per-row summary; single returns the invitation.
			const bulkResult = result as TBulkInviteResult | undefined;
			if (bulkResult?.results) {
				const failures = bulkResult.results
					.filter((row) => !row.ok)
					.map((row) =>
						row.ok ? '' : `${row.email}: ${row.error}`,
					)
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
					toast.success(
						t('invite.sentBulk', { count: bulkResult.succeeded }),
					);
					setReport(null);
					reset();
				}
			} else {
				toast.success(t('invite.sent'));
				setReport(null);
				reset();
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
		setRoleId(undefined);
		setBulk('');
	}

	function submitSingle() {
		if (!email.trim()) {
			toast.error(t('invite.emailRequired'));
			return;
		}
		if (!roleId) {
			toast.error(t('invite.roleRequired'));
			return;
		}
		setReport(null);
		send.mutate({
			email: email.trim(),
			name: name.trim() || undefined,
			organizationId,
			roleId,
		});
	}

	function submitBulk() {
		const { rows, error } = parseBulkInviteRows(bulk, {
			organizationId,
			roleId,
			roleNamesById,
		});
		if (error) {
			setReport([error]);
			toast.error(error);
			return;
		}
		setReport(null);
		send.mutate(rows);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>{t('invite.title')}</DialogTitle>
					<DialogDescription>{t('invite.description')}</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue='single'>
					<TabsList>
						<TabsTrigger value='single'>{t('invite.single')}</TabsTrigger>
						<TabsTrigger value='bulk'>{t('invite.bulk')}</TabsTrigger>
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
							<Field>
								<FieldLabel>{t('invite.role')}</FieldLabel>
								<Select value={roleId ?? null} onValueChange={(value) => setRoleId(value ?? undefined)}>
									<SelectTrigger>
										<SelectValue placeholder={t('invite.rolePlaceholder')} />
									</SelectTrigger>
									<SelectContent>
										{assignable.map((role) => (
											<SelectItem key={role.id} value={role.id}>
												{t('invite.roleOption', {
													name: humanizeIdentifier(role.name),
													rank: role.rank,
												})}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
									placeholder={t('invite.rowsPlaceholder')}
									value={bulk}
									onChange={(event) => setBulk(event.target.value)}
								/>
								<p className='text-xs text-muted-foreground'>
									<Trans
										t={t}
										i18nKey='invite.rowsHint'
										components={{ code: <code />, strong: <strong /> }}
									/>
								</p>
							</Field>
							<Field>
								<FieldLabel>{t('invite.defaultRole')}</FieldLabel>
								<Select value={roleId ?? null} onValueChange={(value) => setRoleId(value ?? undefined)}>
									<SelectTrigger>
										<SelectValue placeholder={t('invite.defaultRolePlaceholder')} />
									</SelectTrigger>
									<SelectContent>
										{assignable.map((role) => (
											<SelectItem key={role.id} value={role.id}>
												{t('invite.roleOption', {
													name: humanizeIdentifier(role.name),
													rank: role.rank,
												})}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
				</Tabs>

				{report && report.length > 0 && (
					<div className='mt-2 max-h-40 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
						{report.map((line) => (
							<div key={line}>{line}</div>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

