import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NavKey } from '@ims-erp/locales';

import { Button } from '@ims-erp/ui/components/button';
import { ButtonGroup } from '@ims-erp/ui/components/button-group';

import { useTheme } from '../theme-provider';

/** `labelKey` is a `nav` namespace key; resolved at render so it re-translates. */
const THEME_OPTIONS = [
	{ value: 'light', icon: Sun, labelKey: 'theme.light' },
	{ value: 'dark', icon: Moon, labelKey: 'theme.dark' },
	{ value: 'system', icon: Monitor, labelKey: 'theme.system' },
] as const satisfies ReadonlyArray<{
	value: 'light' | 'dark' | 'system';
	icon: typeof Sun;
	labelKey: NavKey;
}>;

export default function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const { t } = useTranslation('nav');

	return (
		<ButtonGroup aria-label={t('theme.label')} className='w-full p-2 flex justify-evenly'>
			{THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
				<Button
					key={value}
					variant={theme === value ? 'secondary' : 'ghost'}
					size='icon-sm'
					aria-label={t(labelKey)}
					aria-pressed={theme === value}
					className='flex-1'
					onClick={() => setTheme(value)}
				>
					<Icon />
				</Button>
			))}
		</ButtonGroup>
	);
}
