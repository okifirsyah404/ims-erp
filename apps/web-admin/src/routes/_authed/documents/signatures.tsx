import { createFileRoute } from '@tanstack/react-router';
import { PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/documents/signatures')({
	component: SignaturesStubPage,
});

/** Placeholder until the signature request flow (ERP-0048) is built. */
function SignaturesStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.signatures')} icon={PenLine} />;
}
