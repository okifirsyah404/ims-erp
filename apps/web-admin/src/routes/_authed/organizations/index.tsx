import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Building2 } from 'lucide-react';
import { toast } from '@/components/toast';

import { Button } from '@ims-erp/ui/components/button';
import { Badge } from '@ims-erp/ui/components/badge';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { organizationsQueryOptions, restoreOrganization } from '@/lib/organization-api';
import { useSession } from '@/lib/auth-client';

export const Route = createFileRoute('/_authed/organizations/')({
	component: OrganizationsPage,
});

function OrganizationsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const canCreate = session?.user?.role === 'admin';
	const { data, isPending } = useQuery({ ...organizationsQueryOptions });

	const hasAny = (data?.rows.length ?? 0) > 0;

	async function handleRestore(organizationId: string) {
		try {
			await restoreOrganization(organizationId);
			toast.success('Organization restored');
			await queryClient.invalidateQueries({
				queryKey: organizationsQueryOptions.queryKey,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed');
		}
	}

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>Organizations</h1>
					<p className='text-sm text-muted-foreground'>
						Internal organizations of the company. Each has its own members
						and roles.
					</p>
				</div>
				{!isPending && canCreate && (
					<Button onClick={() => navigate({ to: '/organizations/new' })}>
						New organization
					</Button>
				)}
			</div>

			{isPending ? null : hasAny ? (
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
					{(data?.rows ?? []).map((org) => (
						<Link
							key={org.id}
							to='/organizations/$organizationId'
							params={{ organizationId: org.id }}
							className='group'
						>
							<Card className='h-full transition-shadow group-hover:shadow-md'>
								<CardHeader className='flex-row items-center gap-3 space-y-0'>
									<div className='flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted'>
										{org.logo ? (
											<img
												src={org.logo}
												alt={org.name}
												className='size-full object-cover'
											/>
										) : (
											<Building2 className='size-5 text-muted-foreground' />
										)}
									</div>
									<CardTitle className='truncate text-base'>
										{org.name}
									</CardTitle>
								</CardHeader>
								<CardContent className='text-sm text-muted-foreground'>
									<p className='truncate'>{org.slug}</p>
								</CardContent>
								<CardFooter className='justify-between'>
									{org.deletedAt ? (
										<Badge variant='destructive'>Deleted</Badge>
									) : (
										<Badge variant='secondary'>Active</Badge>
									)}
									{org.deletedAt && (
										<Button
											variant='outline'
											size='sm'
											onClick={(event) => {
												event.preventDefault();
												void handleRestore(org.id);
											}}
										>
											Restore
										</Button>
									)}
								</CardFooter>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						No organization exists yet. Create the first one to get started.
					</CardContent>
				</Card>
			)}
		</div>
	);
}
