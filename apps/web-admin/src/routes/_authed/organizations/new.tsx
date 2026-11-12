import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { erpRoleLabel, erpRoleNames } from '@ims-erp/common';
import {
	createOrganization,
	encodeWebp,
	organizationsQueryOptions,
	uploadOrganizationImage,
} from '@/lib/organization-api';

/** One nested-user row in the create form (ERP-0041). */
function NewUserRow(props: {
	email: string;
	name: string;
	roles: string[];
	onEmail: (value: string) => void;
	onName: (value: string) => void;
	onRoleToggle: (role: string, checked: boolean) => void;
	onRemove: () => void;
	t: ReturnType<typeof useTranslation>['t'];
	language: string;
}) {
	const { email, name, roles, onEmail, onName, onRoleToggle, onRemove, t, language } = props;
	return (
		<div className='rounded-md border p-3 flex flex-col gap-3'>
			<div className='grid gap-3 sm:grid-cols-2'>
				<Field>
					<FieldLabel>{t('orgs.userEmail')}</FieldLabel>
					<Input
						type='email'
						value={email}
						required
						onChange={(e) => onEmail(e.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel>{t('orgs.userName')}</FieldLabel>
					<Input
						value={name}
						required
						onChange={(e) => onName(e.target.value)}
					/>
				</Field>
			</div>
			<div className='flex flex-wrap gap-2'>
				{erpRoleNames.map((roleName) => {
					const id = `new-role-${roleName}-${email || 'row'}`;
					return (
						<label
							key={roleName}
							htmlFor={id}
							className='flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer has-[:checked]:bg-accent'
						>
							<input
								id={id}
								type='checkbox'
								checked={roles.includes(roleName)}
								onChange={(e) => onRoleToggle(roleName, e.target.checked)}
							/>
							{erpRoleLabel(roleName, language)}
						</label>
					);
				})}
			</div>
			<Button type='button' variant='ghost' size='sm' onClick={onRemove}>
				{t('orgs.removeUser')}
			</Button>
		</div>
	);
}

export const Route = createFileRoute('/_authed/organizations/new')({
	component: NewOrganizationPage,
});

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function NewOrganizationPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t, i18n } = useTranslation(['admin', 'common']);

	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);
	const [pending, setPending] = useState(false);
	// Nested users (ERP-0041): active emails join directly, unknown emails
	// are invited (per-item outcomes reported in a toast on success).
	const [users, setUsers] = useState<
		Array<{ email: string; name: string; roles: string[] }>
	>([]);
	// Optional profile image (ERP-0041): uploaded right after the org is
	// created, since the image endpoints are organization-id-scoped.
	const [imageFile, setImageFile] = useState<File | null>(null);
	const imageInput = useRef<HTMLInputElement>(null);

	function addUser() {
		setUsers((current) => [...current, { email: '', name: '', roles: ['member'] }]);
	}

	function patchUser(index: number, patch: Partial<{ email: string; name: string; roles: string[] }>) {
		setUsers((current) =>
			current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
		);
	}

	const duplicateEmails = (() => {
		const emails = users.map((u) => u.email.trim().toLowerCase()).filter(Boolean);
		return new Set(emails.filter((e, i) => emails.indexOf(e) !== i)).size > 0;
	})();

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (duplicateEmails) {
			toast.error(t('orgs.duplicateUserEmail'));
			return;
		}
		setPending(true);
		try {
			const created = await createOrganization({
				name,
				slug,
				users: users.length > 0 ? users : undefined,
			});
			if (!created) throw new Error(t('common:error.failed'));
			// Optional profile image picked in the create form: upload after
			// the org exists (image endpoints are id-scoped).
			if (imageFile) {
				try {
					const webp = await encodeWebp(imageFile);
					await uploadOrganizationImage(created.organization.id, webp);
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: t('common:error.failed'),
					);
				}
			}
			toast.success(t('orgs.created'));
			// Surface the per-item outcomes (ERP-0041) without blocking the
			// redirect.
			for (const member of created.members ?? []) {
				if (member.status === 'failed') {
					toast.error(`${member.email}: ${member.error}`);
				} else if (member.status === 'skipped') {
					toast.error(`${member.email}: ${member.reason}`);
				}
			}
			// Better Auth activates the new organization for this session, so
			// the organization list AND the permission cache are both stale.
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({ queryKey: ['erp-organizations'] }),
				queryClient.invalidateQueries({ queryKey: ['erp-has-permission'] }),
			]);
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId: created.organization.id },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('orgs.newTitle')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('orgs.newDescription')}
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>{t('orgs.details')}</CardTitle>
					<CardDescription>{t('orgs.slugDescription')}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='name'>{t('orgs.name')}</FieldLabel>
								<Input
									id='name'
									value={name}
									required
									maxLength={200}
									onChange={(event) => {
										setName(event.target.value);
										if (!slugTouched) setSlug(slugify(event.target.value));
									}}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='slug'>{t('orgs.slug')}</FieldLabel>
								<Input
									id='slug'
									value={slug}
									required
									pattern='[a-z0-9]+(-[a-z0-9]+)*'
									onChange={(event) => {
										setSlugTouched(true);
										setSlug(event.target.value);
									}}
								/>
							</Field>
						{/* Nested users (ERP-0041) */}
						<div className='flex flex-col gap-3'>
						<div className='flex items-center justify-between'>
							<FieldLabel>{t('orgs.usersTitle')}</FieldLabel>
							<Button type='button' variant='outline' size='sm' onClick={addUser}>
								{t('orgs.addUser')}
							</Button>
						</div>
						{duplicateEmails && (
							<p className='text-sm text-destructive'>
								{t('orgs.duplicateUserEmail')}
							</p>
						)}
						{users.map((row, index) => (
							<NewUserRow
								key={index}
								email={row.email}
								name={row.name}
								roles={row.roles}
								language={i18n.language}
								t={t}
								onEmail={(value) => patchUser(index, { email: value })}
								onName={(value) => patchUser(index, { name: value })}
								onRoleToggle={(role, checked) =>
									patchUser(index, {
										roles: checked
											? [...row.roles, role]
											: row.roles.filter((r) => r !== role),
									})
								}
								onRemove={() =>
									setUsers((current) => current.filter((_, i) => i !== index))
								}
							/>
						))}
					</div>
					<div className='flex gap-2'>
						<input
							ref={imageInput}
							type='file'
							accept='image/*'
							hidden
							onChange={(event) => {
								setImageFile(event.target.files?.[0] ?? null);
								event.target.value = '';
							}}
						/>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() => imageInput.current?.click()}
						>
							{imageFile
								? imageFile.name
								: t('orgImage.upload')}
						</Button>
						{imageFile && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
								onClick={() => setImageFile(null)}
							>
								{t('orgImage.removeSelection')}
							</Button>
						)}
					</div>
					<div className='flex gap-2'>
						<Button type='submit' disabled={pending || !name || !slug || duplicateEmails}>
							{pending ? t('orgs.creating') : t('orgs.create')}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={() => navigate({ to: '/organizations' })}
						>
							{t('common:action.cancel')}
						</Button>
					</div>
					</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
