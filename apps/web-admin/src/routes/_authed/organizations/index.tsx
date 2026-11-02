import { toast } from '@/components/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/auth-client';
import {
	organizationsQueryOptions,
	restoreOrganization,
} from '@/lib/organization-api';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';

export const Route = createFileRoute('/_authed/organizations/')({
	component: OrganizationsPage,
});

function OrganizationsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const canCreate = session?.user?.role === 'admin';
	const { data, isPending } = useQuery({ ...organizationsQueryOptions });
	const { t } = useTranslation(['admin', 'common']);

	const hasAny = (data?.rows.length ?? 0) > 0;

	async function handleRestore(organizationId: string) {
		try {
			await restoreOrganization(organizationId);
			toast.success(t('orgs.restored'));
			await queryClient.invalidateQueries({
				queryKey: organizationsQueryOptions.queryKey,
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		}
	}

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-2xl font-bold'>{t('orgs.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('orgs.description')}
					</p>
				</div>
				{!isPending && canCreate && (
					<Button onClick={() => navigate({ to: '/organizations/new' })}>
						{t('orgs.new')}
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
								<CardHeader className='flex items-center gap-3 space-y-0'>
									<div className='flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted'>
										{org.logo ? (
											<img
												src={org.logo}
												alt={org.name}
												className='size-full object-cover'
											/>
										) : (
											<span className='text-sm font-semibold'>
												{org.name.slice(0, 1).toUpperCase()}
											</span>
										)}
									</div>
									<div className='flex flex-col gap-0.5'>
										<CardTitle className='truncate text-base'>
											{org.name}
										</CardTitle>
										<p className='text-sm text-muted-foreground truncate'>
											{org.slug}
										</p>
									</div>
								</CardHeader>
								<CardContent className='text-sm text-muted-foreground'>
									<p className='truncate'>{org.slug}</p>
								</CardContent>
								<CardFooter className='justify-between'>
									{org.deletedAt ? (
										<Badge variant='destructive'>
											{t('orgs.deletedBadge')}
										</Badge>
									) : (
										<Badge variant='secondary'>{t('orgs.activeBadge')}</Badge>
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
											{t('common:action.restore')}
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
						{t('orgs.empty')}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
