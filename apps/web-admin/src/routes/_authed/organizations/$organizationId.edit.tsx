import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useState } from 'react';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	organizationQueryOptions,
	updateOrganization,
} from '@/lib/organization-api';

export const Route = createFileRoute('/_authed/organizations/$organizationId/edit')(
	{
		component: EditOrganizationPage,
	},
);

function EditOrganizationPage() {
	const { organizationId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: organization } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});

	const [name, setName] = useState(organization?.name ?? '');
	const [pending, setPending] = useState(false);
	const [loadedName, setLoadedName] = useState<string | null>(null);

	if (organization && loadedName === null) {
		setName(organization.name);
		setLoadedName(organization.name);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		try {
			await updateOrganization(organizationId, { name });
			toast.success('Organization updated');
			await queryClient.invalidateQueries({
				queryKey: organizationQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
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
				<h1 className='text-2xl font-bold'>Edit organization</h1>
				<p className='text-sm text-muted-foreground'>
					The slug is permanent and cannot be changed.
				</p>
			</div>
			<Card className='max-w-xl'>
				<CardHeader>
					<CardTitle>Organization details</CardTitle>
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
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<div className='flex gap-2'>
								<Button type='submit' disabled={pending || !name}>
									{pending ? 'Saving…' : 'Save'}
								</Button>
								<Button
									type='button'
									variant='outline'
									onClick={() =>
										navigate({
											to: '/organizations/$organizationId',
											params: { organizationId },
										})
									}
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
