import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { todayBusinessDate } from '@/lib/format';
import { leaveBalancesQueryOptions } from '@/lib/hr-records-api';
import { BankAccountsCard, SalaryPeriodsCard } from './employee-salary-cards';
import { EmployeeDocumentsCard } from './employee-documents-card';
import { usePermission } from '@/lib/use-permission';

/**
 * Record cards on the ERP-0034 employee page: this year's leave balance,
 * with `payroll.read` the "Gaji" cards (salary periods and the payee
 * accounts finance owns, ERP-0119), and the employee's documents (ERP-0121).
 */
export function EmployeeRecordCards({ employeeId, fullName }: { employeeId: string; fullName: string }) {
	const canReadLeave = usePermission('leave.read');
	const canReadPayroll = usePermission('payroll.read');
	return (
		<div className='grid gap-4 lg:grid-cols-2'>
			{canReadLeave && <LeaveBalanceCard employeeId={employeeId} />}
			{canReadPayroll && <SalaryPeriodsCard employeeId={employeeId} />}
			{canReadPayroll && <BankAccountsCard employeeId={employeeId} fullName={fullName} />}
			{/* ERP-0121: the employee's documents; the page itself already needs employee.read. */}
			<EmployeeDocumentsCard employeeId={employeeId} />
		</div>
	);
}

function LeaveBalanceCard({ employeeId }: { employeeId: string }) {
	const { t } = useTranslation(['hr']);
	const year = Number(todayBusinessDate().slice(0, 4));
	const balances = useQuery(leaveBalancesQueryOptions(employeeId, year));
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('hr:balance.title', { year })}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-2 text-sm'>
				{balances.isPending ? <SectionSkeleton lines={3} /> : null}
				{balances.isError ? <ErrorState error={balances.error} size='sm' /> : null}
				{(balances.data ?? []).map((balance) => (
					<div key={balance.leaveType.id}>
						<div className='font-medium'>{balance.leaveType.name}</div>
						<div className='text-muted-foreground'>
							{t('hr:balance.line', {
								remaining: balance.remaining,
								quota: balance.leaveType.annualQuotaDays,
								approved: balance.approved,
								pending: balance.pending,
							})}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
