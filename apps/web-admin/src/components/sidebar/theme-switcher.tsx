import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { ButtonGroup } from '@ims-erp/ui/components/button-group';

import { useTheme } from '../theme-provider';

const THEME_OPTIONS = [
	{ value: 'light', icon: Sun, label: 'Light theme' },
	{ value: 'dark', icon: Moon, label: 'Dark theme' },
	{ value: 'system', icon: Monitor, label: 'System theme' },
] as const;

export default function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();

	return (
		<ButtonGroup aria-label='Theme' className='w-full p-2 flex justify-evenly'>
			{THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
				<Button
					key={value}
					variant={theme === value ? 'secondary' : 'ghost'}
					size='icon-sm'
					aria-label={label}
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
