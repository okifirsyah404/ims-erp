import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { formatIdr } from '@/lib/format';
import { downloadMyPayslip, myPayslipsQueryOptions } from '@/lib/payslip-api';

/** `2026-11` -> "November 2026" in the UI language. */
function periodLabel(period: string, language: string): string {
	return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(`${period}-01T00:00:00Z`));
}

/**
 * `/payslips` — the caller's own approved payslips.
 *
 * @remarks
 * Read-only and session-scoped: `/users/me/payslips` resolves the employee from
 * the session, so there is no id to tamper with. The PDF is fetched with the
 * session cookie and opened from a blob, the same way the admin download works.
 */
export function PayslipsPage() {
	const { t, i18n } = useTranslation('employee');
	const payslips = useQuery(myPayslipsQueryOptions);

	const download = useMutation({
		mutationFn: (recordId: string) => downloadMyPayslip(recordId),
		onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
		onError: (error) => toast.error(error instanceof Error ? error.message : t('payslips.notReady')),
	});

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('payslips.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('payslips.subtitle')}</p>
			</header>

			{payslips.isPending ? (
				<PageSkeleton cards={1} />
			) : payslips.isError ? (
				<ErrorState error={payslips.error} />
			) : (payslips.data ?? []).length === 0 ? (
				<EmptyState title={t('payslips.empty')} bordered />
			) : (
				<ul className='grid gap-2 md:grid-cols-2'>
					{(payslips.data ?? []).map((payslip) => (
						<li key={payslip.recordId}>
							<Card>
								<CardContent className='flex flex-wrap items-center justify-between gap-3 p-4'>
									<div className='space-y-1'>
										<p className='text-xs text-muted-foreground'>{t('payslips.period')}</p>
										<p className='font-medium'>{periodLabel(payslip.period, i18n.language)}</p>
										<p className='text-xs text-muted-foreground'>{t('payslips.netPay')}</p>
										<p className='text-sm'>{formatIdr(payslip.netPay)}</p>
									</div>
									<div className='flex items-center gap-2'>
										{payslip.ready ? null : <Badge variant='secondary'>{t('payslips.notReady')}</Badge>}
										<Button
											size='sm'
											variant='outline'
											disabled={!payslip.ready || download.isPending}
											onClick={() => download.mutate(payslip.recordId)}
										>
											<Download /> {t('payslips.download')}
										</Button>
									</div>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Route = createFileRoute('/_authed/payslips')({
	component: PayslipsPage,
});
