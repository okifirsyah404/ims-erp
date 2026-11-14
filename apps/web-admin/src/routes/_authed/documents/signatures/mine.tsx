import { createFileRoute } from '@tanstack/react-router';
import { PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/documents/signatures/mine')({
	component: MySignatureStubPage,
});

/** Placeholder until the user signature image (ERP-0049) is built. */
function MySignatureStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.mySignature')} icon={PenLine} />;
}
