import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Search } from 'lucide-react';
import { CompanyFormDialog } from '@/components/crm/company-form-dialog';
import { CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	CUSTOMER_STATUSES,
	companiesQueryOptions,
	createCompany,
	createCustomer,
	customersQueryOptions,
	type TCompanyInput,
	type TCustomerInput,
	type TCustomerStatus,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

type TTab = 'companies' | 'people';

/** `/crm/customers` - company-wide customer companies and people (ADR-0024). */
export const Route = createFileRoute('/_authed/crm/customers/')({
	component: CustomerListPage,
});

function CustomerListPage() {
	const { t } = useTranslation(['crm', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('customer.create');
	const [tab, setTab] = useState<TTab>('companies');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TCustomerStatus | ''>('');
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const params = { page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined };
	const companies = useQuery({ ...companiesQueryOptions(params), enabled: tab === 'companies' });
	const people = useQuery({ ...customersQueryOptions(params), enabled: tab === 'people' });
	const active = tab === 'companies' ? companies : people;
	const filtered = deferredSearch !== '' || status !== '';

	function switchTab(next: TTab) {
		setTab(next);
		setPage(1);
	}

	async function handleCreate(work: () => Promise<{ id: string }>, kind: TTab) {
		setSubmitting(true);
		try {
			const created = await work();
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(t('crm:customers.saved'));
			void navigate({
				to: '/crm/customers/$customerId',
				params: { customerId: created.id },
				search: kind === 'companies' ? { kind: 'company' } : {},
			});
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
				{canCreate && (
					<Button onClick={() => setCreating(true)}>
						{tab === 'companies' ? t('crm:customers.newCompany') : t('crm:customers.new')}
					</Button>
				)}
			</div>

			<div className='flex flex-wrap gap-2'>
				<Button variant={tab === 'companies' ? 'default' : 'outline'} onClick={() => switchTab('companies')}>
					{t('crm:customers.tab.companies')}
				</Button>
				<Button variant={tab === 'people' ? 'default' : 'outline'} onClick={() => switchTab('people')}>
					{t('crm:customers.tab.people')}
				</Button>
			</div>

			<div className='flex flex-wrap gap-2'>
				<InputGroup className='max-w-xs'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('crm:customers.search')}
						placeholder={t('crm:customers.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TCustomerStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('crm:customer.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('crm:customers.filterAll')}</SelectItem>
						{CUSTOMER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`crm:customerStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{active.isPending ? null : active.isError ? (
				<p className='text-sm text-destructive'>{active.error.message}</p>
			) : (active.data?.rows.length ?? 0) === 0 ? (
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
									{tab === 'companies'
										? companies.data?.rows.map((company) => (
												<TableRow key={company.id}>
													<TableCell className='font-mono text-xs'>{company.code}</TableCell>
													<TableCell>
														<Link
															to='/crm/customers/$customerId'
															params={{ customerId: company.id }}
															search={{ kind: 'company' }}
															className='font-medium hover:underline'
														>
															{company.name}
														</Link>
													</TableCell>
													<TableCell>{t(`crm:customerType.${company.companyType}`)}</TableCell>
													<TableCell className='text-muted-foreground'>{company.phone ?? company.whatsapp ?? '-'}</TableCell>
													<TableCell>
														<Badge variant={company.status === 'active' ? 'secondary' : 'outline'}>
															{t(`crm:customerStatus.${company.status}`)}
														</Badge>
													</TableCell>
												</TableRow>
											))
										: people.data?.rows.map((customer) => (
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
													<TableCell className='text-muted-foreground'>{customer.phone ?? customer.whatsapp ?? '-'}</TableCell>
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
					{active.data && active.data.pagination.totalPages > 1 && (
						<PaginationControls
							page={active.data.pagination.page}
							totalPages={active.data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}

			{creating && tab === 'companies' && (
				<CompanyFormDialog
					company={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input: TCompanyInput) => void handleCreate(() => createCompany(input), 'companies')}
				/>
			)}
			{creating && tab === 'people' && (
				<CustomerFormDialog
					customer={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input: TCustomerInput) => void handleCreate(() => createCustomer(input), 'people')}
				/>
			)}
		</div>
	);
}
