import { createFileRoute } from '@tanstack/react-router';
import { FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/documents/signatures/documents')({
	component: DocumentSignaturesStubPage,
});

/** Placeholder until the signature request flow (ERP-0048) is built. */
function DocumentSignaturesStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.documentSignatures')} icon={FileCheck2} />;
}
