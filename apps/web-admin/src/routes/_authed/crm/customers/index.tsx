import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	CUSTOMER_STATUSES,
	createCustomer,
	customersQueryOptions,
	type TCustomerInput,
	type TCustomerStatus,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/crm/customers` — company-wide customer list (ADR-0011 step 3a). */
export const Route = createFileRoute('/_authed/crm/customers/')({
	component: CustomerListPage,
});

function CustomerListPage() {
	const { t } = useTranslation(['crm', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('customer.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TCustomerStatus | ''>('');
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		customersQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
		}),
	);
	const filtered = deferredSearch !== '' || status !== '';

	async function handleCreate(input: TCustomerInput) {
		setSubmitting(true);
		try {
			const created = await createCustomer(input);
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(t('crm:customers.saved'));
			void navigate({ to: '/crm/customers/$customerId', params: { customerId: created.id } });
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('crm:customers.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('crm:customers.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setCreating(true)}>{t('crm:customers.new')}</Button>}
			</div>

			<div className='flex flex-wrap gap-2'>
				<Input
					type='search'
					className='max-w-xs'
					aria-label={t('crm:customers.search')}
					placeholder={t('crm:customers.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
				<select
					aria-label={t('crm:customer.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TCustomerStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('crm:customers.filterAll')}</option>
					{CUSTOMER_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`crm:customerStatus.${value}`)}
						</option>
					))}
				</select>
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{filtered ? t('crm:customers.noResults') : t('crm:customers.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('crm:customer.code')}</TableHead>
										<TableHead>{t('crm:customer.name')}</TableHead>
										<TableHead>{t('crm:customer.customerType')}</TableHead>
										<TableHead>{t('crm:customer.phone')}</TableHead>
										<TableHead>{t('crm:customer.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((customer) => (
										<TableRow key={customer.id}>
											<TableCell className='font-mono text-xs'>{customer.code}</TableCell>
											<TableCell>
												<Link
													to='/crm/customers/$customerId'
													params={{ customerId: customer.id }}
													className='font-medium hover:underline'
												>
													{customer.name}
												</Link>
											</TableCell>
											<TableCell>{t(`crm:customerType.${customer.customerType}`)}</TableCell>
											<TableCell className='text-muted-foreground'>
												{customer.phone ?? customer.whatsapp ?? '—'}
											</TableCell>
											<TableCell>
												<Badge variant={customer.status === 'active' ? 'secondary' : 'outline'}>
													{t(`crm:customerStatus.${customer.status}`)}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls
							page={data.pagination.page}
							totalPages={data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}

			{creating && (
				<CustomerFormDialog
					customer={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input) => void handleCreate(input)}
				/>
			)}
		</div>
	);
}
