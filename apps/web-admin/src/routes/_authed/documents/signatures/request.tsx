import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/documents/signatures/request')({
	component: RequestSignatureStubPage,
});

/** Placeholder until the signature request flow (ERP-0048) is built. */
function RequestSignatureStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.requestSignature')} icon={Send} />;
}
