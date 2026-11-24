import { createFileRoute } from '@tanstack/react-router';

import { PostingRulesPage } from '@/components/finance/posting-rules-page';

/** `/finance/posting-rules` - account determination for business-event postings (ERP-0128). */
export const Route = createFileRoute('/_authed/finance/posting-rules/')({
	component: PostingRulesPage,
});
