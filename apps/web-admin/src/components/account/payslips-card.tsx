import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { toast } from '@/components/toast';
import { formatIdr } from '@/lib/format';
import { myPayslipDownloadUrl, myPayslipsQueryOptions } from '@/lib/hr-records-api';

/** `2026-11` → "November 2026" in the UI language. */
function periodLabel(period: string, language: string) {
	return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
		new Date(`${period}-01T00:00:00Z`),
	);
}

/**
 * "My payslips" on the account page (ERP-0122, grill-me Q35): the signed-in
 * user's own payslips only — the backend resolves the employee from the
 * session. Hidden for a user who is not an employee or has none yet.
 */
export function PayslipsCard({ id }: { id: string }) {
	const { t, i18n } = useTranslation(['account', 'common']);
	const query = useQuery(myPayslipsQueryOptions());
	if (!query.data || query.data.length === 0) return null;

	return (
		<section id={id} className='scroll-mt-4'>
			<Card>
				<CardHeader>
					<CardTitle>{t('account:payslips.title')}</CardTitle>
					<CardDescription>{t('account:payslips.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className='divide-y text-sm'>
						{query.data.map((payslip) => (
							<li key={payslip.recordId} className='flex items-center justify-between gap-2 py-2'>
								<div>
									<div className='font-medium'>{periodLabel(payslip.period, i18n.language)}</div>
									<div className='text-muted-foreground tabular-nums'>{formatIdr(payslip.netPay)}</div>
								</div>
								{payslip.ready ? (
									<Button
										size='sm'
										variant='outline'
										onClick={async () => {
											try {
												const { url } = await myPayslipDownloadUrl(payslip.recordId);
												window.open(url, '_blank', 'noopener');
											} catch (cause) {
												toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
											}
										}}
									>
										<Download className='size-4' /> {t('account:payslips.download')}
									</Button>
								) : (
									<span className='text-xs text-muted-foreground'>{t('account:payslips.pending')}</span>
								)}
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</section>
	);
}
