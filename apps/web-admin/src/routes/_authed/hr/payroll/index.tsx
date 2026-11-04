import { createFileRoute } from '@tanstack/react-router';
import { HandCoins } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/hr/payroll/')({
	component: ComingSoonStubPage,
});

/** Placeholder: implemented in a later phase (docs module map). */
function ComingSoonStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.payroll')} icon={HandCoins} />;
}