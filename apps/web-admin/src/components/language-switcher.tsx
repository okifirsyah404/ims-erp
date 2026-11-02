import { useTranslation } from 'react-i18next';

import { LANGUAGES } from '@ims-erp/locales';
import { Button } from '@ims-erp/ui/components/button';
import { ButtonGroup } from '@ims-erp/ui/components/button-group';

import { changeLanguage, currentLanguage } from '@/i18n';

/**
 * Language switcher (English / Indonesian).
 *
 * Deliberately mirrors `theme-switcher.tsx`: a `ButtonGroup` of icon-sized
 * buttons using `aria-pressed` rather than a menu, so the current language is
 * announced by screen readers and the control stays one click away.
 *
 * Short codes (`EN`/`ID`) are shown instead of full names because the trigger
 * also lives inside the narrow sidebar dropdown; the full language name lives
 * in `aria-label`, and each name is given in its own language so a speaker of
 * either can find their choice.
 */
export default function LanguageSwitcher({
	className,
}: {
	className?: string;
}) {
	const { t } = useTranslation('common');
	const active = currentLanguage();

	return (
		<ButtonGroup
			aria-label={t('language.label')}
			className={className ?? 'w-full p-2 flex justify-evenly'}
		>
			{LANGUAGES.map(({ code, labelKey, short }) => (
				<Button
					key={code}
					variant={active === code ? 'secondary' : 'ghost'}
					size='icon-sm'
					aria-label={t(labelKey)}
					aria-pressed={active === code}
					className='flex-1 text-xs font-medium'
					onClick={() => void changeLanguage(code)}
					data-language={code}
				>
					{short}
				</Button>
			))}
		</ButtonGroup>
	);
}
