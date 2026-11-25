import { createFileRoute } from '@tanstack/react-router';

import { ProjectBudgetsPage } from '@/components/finance/project-budgets-page';

/** `/finance/project-budgets` - versioned project budgets and budget vs actual (ERP-0146). */
export const Route = createFileRoute('/_authed/finance/project-budgets/')({
	component: ProjectBudgetsPage,
});
