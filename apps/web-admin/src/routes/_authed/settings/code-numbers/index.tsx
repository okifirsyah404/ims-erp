import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
import { PageSkeleton } from '@/components/page-skeleton';
import { NumberingSectionCard } from '@/components/settings/numbering-settings';
import {
	CODE_NUMBER_READ,
	CODE_NUMBER_UPDATE,
	CODE_NUMBERING_SECTIONS,
	canEditSection,
	canSeeSection,
} from '@/lib/code-numbering-api';
import { companyProfileQueryOptions } from '@/lib/company-api';
import { useIsAppAdmin } from '@/lib/use-is-app-admin';
import { usePermission } from '@/lib/use-permission';

/**
 * `/settings/code-numbers` - every `<schema>.code_numberings` on one page, one
 * card per owning module (ADR-0024 Q6).
 *
 * @remarks
 * UX only: a card the caller may not see is not rendered, so its query never
 * runs; the backend (`adminOrErpGuard`) re-checks every request. Application
 * admins see every card; organization members need `code_number.read`, and
 * the warehouse card is application-admin-only.
 */
export const Route = createFileRoute('/_authed/settings/code-numbers/')({
	component: CodeNumbersPage,
});

function CodeNumbersPage() {
	const { t } = useTranslation(['settings']);
	const { isAppAdmin, isPending } = useIsAppAdmin();
	const canRead = usePermission(CODE_NUMBER_READ);
	const canUpdate = usePermission(CODE_NUMBER_UPDATE);
	const sections = CODE_NUMBERING_SECTIONS.filter((section) =>
		canSeeSection(section, { isAppAdmin, canRead }),
	);
	// Numbers need the company profile's document code; say so instead of an
	// error on every card.
	const profile = useQuery({ ...companyProfileQueryOptions(), enabled: sections.length > 0 });
	const profileMissing = profile.isSuccess && profile.data === null;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('settings:numbering.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('settings:numbering.description')}</p>
			</div>
			{isPending ? (
				<PageSkeleton />
			) : sections.length === 0 ? (
				<Alert>
					<AlertDescription>{t('settings:numbering.noAccess')}</AlertDescription>
				</Alert>
			) : profileMissing ? (
				<Alert>
					<AlertDescription>
						<Link to='/settings/company' className='underline'>
							{t('settings:numbering.profileNeeded')}
						</Link>
					</AlertDescription>
				</Alert>
			) : (
				sections.map((section) => (
					<NumberingSectionCard
						key={section.schema}
						section={section}
						canEdit={canEditSection(section, { isAppAdmin, canUpdate })}
					/>
				))
			)}
		</div>
	);
}
