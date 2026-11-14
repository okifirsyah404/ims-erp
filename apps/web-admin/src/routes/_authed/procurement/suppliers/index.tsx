import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { SupplierFormDialog } from '@/components/procurement/supplier-form-dialog';
import { toast } from '@/components/toast';
import { createSupplier, suppliersQueryOptions, type TSupplierInput } from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/suppliers` — the supplier master (ADR-0011 step 4a). */
export const Route = createFileRoute('/_authed/procurement/suppliers/')({
	component: SupplierListPage,
});

function SupplierListPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('supplier.create');
	const canSeeBank = usePermission('supplier.read_bank');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<'active' | 'inactive' | ''>('');
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		suppliersQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	async function handleCreate(input: Partial<TSupplierInput>) {
		setSubmitting(true);
		try {
			const created = await createSupplier(input as TSupplierInput);
			await queryClient.invalidateQueries({ queryKey: ['procurement', 'suppliers'] });
			toast.success(t('procurement:suppliers.saved'));
			void navigate({ to: '/procurement/suppliers/$supplierId', params: { supplierId: created.id } });
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
					<h1 className='text-2xl font-bold'>{t('procurement:suppliers.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:suppliers.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setCreating(true)}>{t('procurement:suppliers.new')}</Button>}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('procurement:suppliers.search')}
						placeholder={t('procurement:suppliers.search')}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as 'active' | 'inactive'));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('procurement:supplier.status')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('procurement:suppliers.allStatuses')}</SelectItem>
						<SelectItem value='active'>{t('common:status.active')}</SelectItem>
						<SelectItem value='inactive'>{t('common:status.inactive')}</SelectItem>
					</SelectContent>
				</Select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('procurement:suppliers.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('procurement:supplier.name')}</TableHead>
										<TableHead>{t('procurement:supplier.picName')}</TableHead>
										<TableHead>{t('procurement:supplier.phone')}</TableHead>
										<TableHead>{t('procurement:supplier.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((supplier) => (
										<TableRow key={supplier.id}>
											<TableCell>
												<Link
													to='/procurement/suppliers/$supplierId'
													params={{ supplierId: supplier.id }}
													className='font-medium hover:underline'
												>
													{supplier.name}
												</Link>
												<div className='text-xs text-muted-foreground'>{supplier.code}</div>
											</TableCell>
											<TableCell>{supplier.picName ?? '—'}</TableCell>
											<TableCell>{supplier.phone ?? supplier.whatsapp ?? '—'}</TableCell>
											<TableCell>
												<Badge variant={supplier.status === 'active' ? 'default' : 'outline'}>
													{t(`common:status.${supplier.status}`)}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
			{creating && (
				<SupplierFormDialog
					supplier={null}
					canSeeBank={canSeeBank}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input) => void handleCreate(input)}
				/>
			)}
		</div>
	);
}
