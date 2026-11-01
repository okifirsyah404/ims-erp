import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
						`${bulkResult.succeeded} sent, ${bulkResult.failed} failed`,
					);
				} else {
					toast.success(`${bulkResult.succeeded} invitation(s) sent`);
					setReport(null);
					reset();
				}
			} else {
				toast.success('Invitation sent');
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
			toast.error('Email is required');
			return;
		}
		if (!roleId) {
			toast.error('Choose a role');
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
					<DialogTitle>Invite users</DialogTitle>
					<DialogDescription>
						Invitations are single-use, expire in 3 days, and are the only way
						to create an account.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue='single'>
					<TabsList>
						<TabsTrigger value='single'>Single</TabsTrigger>
						<TabsTrigger value='bulk'>Bulk paste</TabsTrigger>
					</TabsList>

					<TabsContent value='single' className='pt-4'>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='invite-email'>Email</FieldLabel>
								<Input
									id='invite-email'
									type='email'
									placeholder='person@company.com'
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='invite-name'>Name (optional)</FieldLabel>
								<Input
									id='invite-name'
									placeholder='Prefills the claim form'
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Role</FieldLabel>
								<Select value={roleId ?? null} onValueChange={(value) => setRoleId(value ?? undefined)}>
									<SelectTrigger>
										<SelectValue placeholder='Select a role' />
									</SelectTrigger>
									<SelectContent>
										{assignable.map((role) => (
											<SelectItem key={role.id} value={role.id}>
												{role.name} (rank {role.rank})
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
								Cancel
							</Button>
							<Button onClick={submitSingle} disabled={send.isPending}>
								Send invitation
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent value='bulk' className='pt-4'>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='invite-bulk'>
									Rows ({BULK_INVITE_LIMIT} max)
								</FieldLabel>
								<Textarea
									id='invite-bulk'
									className='min-h-40 font-mono text-xs'
									placeholder={'email@company.com, Jane Doe, member\nother@company.com'}
									value={bulk}
									onChange={(event) => setBulk(event.target.value)}
								/>
								<p className='text-xs text-muted-foreground'>
									One per line: <code>email, name, role</code>. Name and role
									are optional; an unrecognized role falls back to{' '}
									<strong>member</strong>.
								</p>
							</Field>
							<Field>
								<FieldLabel>Default role (optional)</FieldLabel>
								<Select value={roleId ?? null} onValueChange={(value) => setRoleId(value ?? undefined)}>
									<SelectTrigger>
										<SelectValue placeholder='Used when a row omits role' />
									</SelectTrigger>
									<SelectContent>
										{assignable.map((role) => (
											<SelectItem key={role.id} value={role.id}>
												{role.name} (rank {role.rank})
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
								Cancel
							</Button>
							<Button onClick={submitBulk} disabled={send.isPending}>
								Send invitations
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

