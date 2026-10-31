import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';

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
import { createOrganization, organizationsQueryOptions } from '@/lib/organization-api';

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

	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		try {
			const created = await createOrganization({ name, slug });
			if (!created) throw new Error('Create failed');
			toast.success('Organization created');
			await queryClient.invalidateQueries({
				queryKey: organizationsQueryOptions.queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId: created.id },
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed');
		} finally {
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>New organization</h1>
				<p className='text-sm text-muted-foreground'>
					Only one organization is allowed on this deployment.
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>Organization details</CardTitle>
					<CardDescription>
						The slug is permanent and used in URLs and API contexts.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='name'>Name</FieldLabel>
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
								<FieldLabel htmlFor='slug'>Slug</FieldLabel>
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
							<div className='flex gap-2'>
								<Button type='submit' disabled={pending || !name || !slug}>
									{pending ? 'Creating…' : 'Create'}
								</Button>
								<Button
									type='button'
									variant='outline'
									onClick={() => navigate({ to: '/organizations' })}
								>
									Cancel
								</Button>
							</div>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
