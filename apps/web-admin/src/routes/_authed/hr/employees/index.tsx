import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { employeesQueryOptions } from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/employees` — employees (M08 stage 1). */
export const Route = createFileRoute('/_authed/hr/employees/')({
	component: EmployeeListPage,
});

function EmployeeListPage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const canCreate = usePermission('employee.create');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<'active' | 'inactive' | ''>('active');
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		employeesQueryOptions({ page, search: deferredSearch || undefined, status: status || undefined }),
	);
	const masked = data?.rows.some((row) => row.masked);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:employees.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:employees.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/hr/employees/new' />} nativeButton={false}>
						{t('hr:employees.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap gap-2'>
				<select
					aria-label={t('hr:field.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as 'active' | 'inactive' | '');
						setPage(1);
					}}
				>
					<option value=''>{t('hr:employees.allStatuses')}</option>
					<option value='active'>{t('hr:employmentStatus.active')}</option>
					<option value='inactive'>{t('hr:employmentStatus.inactive')}</option>
				</select>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('hr:employees.search')}
					placeholder={t('hr:employees.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('hr:employees.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('hr:field.code')}</TableHead>
										<TableHead>{t('hr:field.name')}</TableHead>
										<TableHead>{t('hr:field.position')}</TableHead>
										<TableHead>{t('hr:field.nik')}</TableHead>
										<TableHead>{t('hr:field.hireDate')}</TableHead>
										<TableHead className='text-right'>{t('hr:field.baseSalary')}</TableHead>
										<TableHead>{t('hr:field.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((employee) => (
										<TableRow key={employee.id}>
											<TableCell>
												<Link to='/hr/employees/$employeeId' params={{ employeeId: employee.id }} className='font-medium hover:underline'>
													{employee.employeeCode}
												</Link>
											</TableCell>
											<TableCell>{employee.fullName}</TableCell>
											<TableCell>{employee.position ?? '—'}</TableCell>
											<TableCell className='font-mono text-xs'>{employee.nationalId ?? '—'}</TableCell>
											<TableCell>{formatBusinessDate(employee.hireDate, i18n.language)}</TableCell>
											<TableCell className='text-right whitespace-nowrap'>
												{employee.baseSalary === null ? t('hr:employees.salaryHidden') : formatIdr(employee.baseSalary)}
											</TableCell>
											<TableCell>
												<Badge variant={employee.employmentStatus === 'active' ? 'default' : 'outline'}>
													{t(`hr:employmentStatus.${employee.employmentStatus}`)}
												</Badge>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{masked && <p className='text-xs text-muted-foreground'>{t('hr:employees.masked')}</p>}
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
