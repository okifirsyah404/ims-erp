import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { projectsQueryOptions } from '@/lib/project-api';

const NONE = 'none';

/** Optional project picker (ERP-0146): the project a cost, claim or order is for. */
export function ProjectSelect({ id, value, onChange }: { id?: string; value: string | null; onChange: (projectId: string | null) => void }) {
	const { t } = useTranslation(['finance']);
	const projects = useQuery(projectsQueryOptions({ page: 1, limit: 100, status: 'active' }));
	return (
		<Select value={value ?? NONE} onValueChange={(next: string | null) => onChange(!next || next === NONE ? null : next)}>
			<SelectTrigger id={id}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={NONE}>{t('finance:budgets.noProject')}</SelectItem>
				{(projects.data?.rows ?? []).map((project) => (
					<SelectItem key={project.id} value={project.id}>
						{project.code} — {project.title}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
