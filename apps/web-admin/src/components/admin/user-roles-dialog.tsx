import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { erpRoleLabel } from '@ims-erp/common';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Spinner } from '@ims-erp/ui/components/spinner';
import { useAssignableOrgRoles } from '@/lib/use-caller-org-roles';

/**
 * Role editor for one user of the company organization (M12-14, KF-R1).
 *
 * @remarks
 * Multi-role checkboxes over the roles the caller may assign
 * (`useAssignableOrgRoles`): the shared ladder in `@ims-erp/common` hides what
 * the server would reject, and the server re-checks it anyway. `owner` is only
 * offered to an owner, which is why the ladder — not a static list — decides.
 *
 * The dialog is mounted only while open, so every open starts from the member's
 * current roles.
 */
export function UserRolesDialog({
	open,
	onOpenChange,
	userName,
	organizationId,
	currentRoles,
	onSave,
	saving,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userName: string;
	organizationId: string;
	currentRoles: string[];
	onSave: (roles: string[]) => void;
	saving: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && (
				<UserRolesDialogBody
					userName={userName}
					organizationId={organizationId}
					currentRoles={currentRoles}
					onSave={onSave}
					onCancel={() => onOpenChange(false)}
					saving={saving}
				/>
			)}
		</Dialog>
	);
}

function UserRolesDialogBody({
	userName,
	organizationId,
	currentRoles,
	onSave,
	onCancel,
	saving,
}: {
	userName: string;
	organizationId: string;
	currentRoles: string[];
	onSave: (roles: string[]) => void;
	onCancel: () => void;
	saving: boolean;
}) {
	const { t, i18n } = useTranslation(['admin', 'common']);
	const [roles, setRoles] = useState<string[]>(currentRoles);
	const { roles: assignableRoles, isPending } = useAssignableOrgRoles(
		organizationId,
		currentRoles,
	);

	// A role the caller may not hand out stays visible when the member already
	// holds it: removing it is not an escalation, and hiding it would make the
	// list look like it was lost.
	const hiddenRoles = currentRoles.filter(
		(role) => !assignableRoles.includes(role as never),
	);
	const unchanged =
		[...roles].sort().join(',') === [...currentRoles].sort().join(',');

	function toggle(role: string, checked: boolean) {
		setRoles((current) =>
			checked ? [...current, role] : current.filter((r) => r !== role),
		);
	}

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>{t('users.rolesDialog.title')}</DialogTitle>
				<DialogDescription>
					{t('users.rolesDialog.description', { name: userName })}
				</DialogDescription>
			</DialogHeader>
			{isPending ? (
				<div className='flex justify-center py-6'>
					<Spinner />
				</div>
			) : (
				<FieldGroup>
					<Field>
						<FieldLabel>{t('users.rolesDialog.roles')}</FieldLabel>
						<div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
							{assignableRoles.map((role) => {
								const id = `user-role-${role}`;
								return (
									<Field
										key={role}
										orientation='horizontal'
										className='rounded-md border px-3 py-2 has-[[data-checked]]:bg-accent'
									>
										<Checkbox
											id={id}
											checked={roles.includes(role)}
											onCheckedChange={(checked) =>
												toggle(role, checked === true)
											}
										/>
										<FieldLabel htmlFor={id} className='cursor-pointer'>
											{erpRoleLabel(role, i18n.language)}
										</FieldLabel>
									</Field>
								);
							})}
						</div>
						{hiddenRoles.length > 0 && (
							<p className='text-xs text-muted-foreground'>
								{t('users.rolesDialog.rolesLocked', {
									roles: hiddenRoles
										.map((role) => erpRoleLabel(role, i18n.language))
										.join(', '),
								})}
							</p>
						)}
						<p className='text-xs text-muted-foreground'>
							{t('users.rolesDialog.hint')}
						</p>
					</Field>
				</FieldGroup>
			)}
			<DialogFooter>
				<Button variant='outline' onClick={onCancel} disabled={saving}>
					{t('common:action.cancel')}
				</Button>
				<Button
					onClick={() => onSave(roles)}
					disabled={saving || isPending || roles.length === 0 || unchanged}
				>
					{saving ? t('common:action.saving') : t('common:action.save')}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
