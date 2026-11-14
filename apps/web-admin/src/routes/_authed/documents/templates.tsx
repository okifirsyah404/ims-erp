import { createFileRoute } from '@tanstack/react-router';
import { LayoutTemplate } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/documents/templates')({
	component: TemplatesStubPage,
});

/** Placeholder until document templates CRUD (ERP-0050) is built. */
function TemplatesStubPage() {
	const { t } = useTranslation('nav');
	return <ComingSoonPage title={t('item.templates')} icon={LayoutTemplate} />;
}
