import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import type { TDocumentItem } from '@/lib/handover-api';

/** Editable NO / Uraian / Vol / Keterangan rows of a BAST or warranty. */
export function DocumentItemsEditor({ value, onChange, idPrefix }: { value: TDocumentItem[]; onChange: (items: TDocumentItem[]) => void; idPrefix: string }) {
	const { t } = useTranslation('projects');
	const set = (index: number, patch: Partial<TDocumentItem>) => onChange(value.map((item, at) => (at === index ? { ...item, ...patch } : item)));

	return (
		<div className='flex flex-col gap-2'>
			<div className='hidden grid-cols-[2rem_3fr_1fr_2fr_auto] gap-2 text-xs text-muted-foreground sm:grid'>
				<span>{t('items.no')}</span>
				<span>{t('items.description')}</span>
				<span>{t('items.volume')}</span>
				<span>{t('items.remarks')}</span>
				<span />
			</div>
			{value.map((item, index) => (
				<div key={index} className='grid gap-2 sm:grid-cols-[2rem_3fr_1fr_2fr_auto] sm:items-center'>
					<span className='text-sm text-muted-foreground'>{index + 1}</span>
					<Input
						id={`${idPrefix}-description-${index}`}
						aria-label={`${t('items.description')} ${index + 1}`}
						required
						maxLength={500}
						value={item.description}
						onChange={(event) => set(index, { description: event.target.value })}
					/>
					<Input
						aria-label={`${t('items.volume')} ${index + 1}`}
						maxLength={60}
						value={item.volume}
						onChange={(event) => set(index, { volume: event.target.value })}
					/>
					<Input
						aria-label={`${t('items.remarks')} ${index + 1}`}
						maxLength={300}
						value={item.remarks}
						onChange={(event) => set(index, { remarks: event.target.value })}
					/>
					<Button type='button' variant='ghost' size='sm' disabled={value.length === 1} onClick={() => onChange(value.filter((_, at) => at !== index))}>
						{t('items.remove')}
					</Button>
				</div>
			))}
			<Button type='button' variant='outline' size='sm' className='self-start' onClick={() => onChange([...value, { description: '', volume: '', remarks: '' }])}>
				{t('items.add')}
			</Button>
		</div>
	);
}
