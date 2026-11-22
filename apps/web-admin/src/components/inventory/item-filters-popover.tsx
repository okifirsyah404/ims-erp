import { useQuery } from '@tanstack/react-query';
import { Funnel } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from '@ims-erp/ui/components/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Slider } from '@ims-erp/ui/components/slider';
import { MoneyInput } from '@/components/money-input';
import { itemCategoriesQueryOptions } from '@/lib/item-category-api';
import {
	countPopoverFilters,
	type TItemListFilters,
	type TItemSortField,
	type TItemStatus,
} from '@/lib/item-list-search';
import { productRangesQueryOptions, type TProductKind } from '@/lib/inventory-api';
import { sanitizeQuantity, sliderStep, sliderValue, toDraft, toNumber } from '@/lib/item-filter-draft';

/**
 * Filter and sort popover of the product / component / material lists, the
 * same pattern as the warehouse list: a "Filters" button, drafts that apply on
 * demand, Reset and Apply.
 *
 * @remarks
 * Price and stock are a slider plus two exact inputs. The slider bounds come
 * from `GET /products/ranges` (highest price / highest summed stock of the
 * kind), fetched when the popover opens. A thumb parked on a bound means "no
 * limit" on that side, so the URL only carries what narrows the list. Prices
 * are typed and kept in rupiah; the list converts them to minor units.
 */
export function ItemFiltersPopover({
	kind,
	filters,
	onApply,
	onReset,
}: {
	kind: TProductKind;
	filters: TItemListFilters;
	/** Receives the popover's filters; the caller keeps `q`. */
	onApply: (next: TItemListFilters) => void;
	onReset: () => void;
}) {
	const { t } = useTranslation(['product', 'common']);
	const [open, setOpen] = useState(false);

	const [categoryId, setCategoryId] = useState(filters.categoryId);
	const [status, setStatus] = useState<TItemStatus | undefined>(filters.status);
	const [minPrice, setMinPrice] = useState(toDraft(filters.minPrice));
	const [maxPrice, setMaxPrice] = useState(toDraft(filters.maxPrice));
	const [minStock, setMinStock] = useState(toDraft(filters.minStock));
	const [maxStock, setMaxStock] = useState(toDraft(filters.maxStock));
	const [sortBy, setSortBy] = useState<TItemSortField>(filters.sortBy ?? 'name');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sortDir ?? 'asc');

	const { data: categories = [] } = useQuery({ ...itemCategoriesQueryOptions(true), enabled: open });
	const { data: ranges } = useQuery({ ...productRangesQueryOptions(kind), enabled: open });

	// Bounds in the units people read: rupiah for price, the item unit for stock.
	const priceBound = Math.ceil((ranges?.maxSellingPrice ?? 0) / 100);
	const stockBound = Math.ceil(ranges?.maxStock ?? 0);
	const activeCount = countPopoverFilters(filters);

	/** Re-seeds the drafts from the URL whenever the popover opens. */
	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setCategoryId(filters.categoryId);
			setStatus(filters.status);
			setMinPrice(toDraft(filters.minPrice));
			setMaxPrice(toDraft(filters.maxPrice));
			setMinStock(toDraft(filters.minStock));
			setMaxStock(toDraft(filters.maxStock));
			setSortBy(filters.sortBy ?? 'name');
			setSortDir(filters.sortDir ?? 'asc');
		}
		setOpen(nextOpen);
	}

	/** A thumb on a bound means "open-ended": store nothing for that side. */
	function setRange(
		values: number | readonly number[],
		bound: number,
		setMin: (value: string) => void,
		setMax: (value: string) => void,
	) {
		const [low, high] = Array.isArray(values) ? values : [values, bound];
		setMin(low && low > 0 ? String(low) : '');
		setMax(high !== undefined && high < bound ? String(high) : '');
	}

	function apply() {
		const [priceLow, priceHigh] = orderRange(toNumber(minPrice), toNumber(maxPrice));
		const [stockLow, stockHigh] = orderRange(toNumber(minStock), toNumber(maxStock));
		onApply({
			categoryId,
			status,
			minPrice: priceLow,
			maxPrice: priceHigh,
			minStock: stockLow,
			maxStock: stockHigh,
			sortBy: sortBy === 'name' ? undefined : sortBy,
			sortDir: sortDir === 'asc' ? undefined : sortDir,
		});
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant={activeCount > 0 ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' aria-hidden='true' />
						{t('product:items.filters')}
						{activeCount > 0 ? ` (${activeCount})` : ''}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-80'>
				<PopoverHeader>
					<PopoverTitle>{t('product:items.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-4'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('product:items.category')}</span>
						<Select
							value={categoryId ?? 'all'}
							onValueChange={(value: string | null) =>
								setCategoryId(value == null || value === 'all' ? undefined : value)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>{t('product:items.allCategories')}</SelectItem>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.id}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>{t('product:items.filterStatus')}</span>
						<Select
							value={status ?? 'all'}
							onValueChange={(value: string | null) =>
								setStatus(value === 'active' || value === 'inactive' ? value : undefined)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>{t('product:items.statusAll')}</SelectItem>
								<SelectItem value='active'>{t('common:status.active')}</SelectItem>
								<SelectItem value='inactive'>{t('common:status.inactive')}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className='flex flex-col gap-2'>
						<span className='text-xs text-muted-foreground'>{t('product:items.filterPrice')}</span>
						<Slider
							aria-label={t('product:items.filterPrice')}
							min={0}
							max={Math.max(priceBound, 1)}
							step={sliderStep(priceBound)}
							disabled={priceBound === 0}
							value={sliderValue(minPrice, maxPrice, priceBound)}
							onValueChange={(values) => setRange(values, priceBound, setMinPrice, setMaxPrice)}
						/>
						<div className='grid grid-cols-2 gap-2'>
							<MoneyInput
								aria-label={t('product:items.min')}
								placeholder={t('product:items.min')}
								value={minPrice}
								onValueChange={setMinPrice}
							/>
							<MoneyInput
								aria-label={t('product:items.max')}
								placeholder={t('product:items.max')}
								value={maxPrice}
								onValueChange={setMaxPrice}
							/>
						</div>
					</div>

					<div className='flex flex-col gap-2'>
						<span className='text-xs text-muted-foreground'>{t('product:items.filterStock')}</span>
						<Slider
							aria-label={t('product:items.filterStock')}
							min={0}
							max={Math.max(stockBound, 1)}
							step={1}
							disabled={stockBound === 0}
							value={sliderValue(minStock, maxStock, stockBound)}
							onValueChange={(values) => setRange(values, stockBound, setMinStock, setMaxStock)}
						/>
						<div className='grid grid-cols-2 gap-2'>
							<Input
								inputMode='decimal'
								autoComplete='off'
								aria-label={t('product:items.min')}
								placeholder={t('product:items.min')}
								value={minStock}
								onChange={(event) => setMinStock(sanitizeQuantity(event.target.value))}
							/>
							<Input
								inputMode='decimal'
								autoComplete='off'
								aria-label={t('product:items.max')}
								placeholder={t('product:items.max')}
								value={maxStock}
								onChange={(event) => setMaxStock(sanitizeQuantity(event.target.value))}
							/>
						</div>
						{stockBound === 0 ? (
							<span className='text-xs text-muted-foreground'>{t('product:items.noStockData')}</span>
						) : null}
					</div>

					<div className='grid grid-cols-2 gap-2'>
						<div className='flex flex-col gap-1'>
							<span className='text-xs text-muted-foreground'>{t('product:items.sortBy')}</span>
							<Select value={sortBy} onValueChange={(value) => setSortBy((value ?? 'name') as TItemSortField)}>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='name'>{t('product:items.sortName')}</SelectItem>
									<SelectItem value='code'>{t('product:items.sortCode')}</SelectItem>
									<SelectItem value='price'>{t('product:items.sortPrice')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className='flex flex-col gap-1'>
							<span className='text-xs text-muted-foreground'>{t('product:items.sortOrder')}</span>
							<Select value={sortDir} onValueChange={(value) => setSortDir((value ?? 'asc') as 'asc' | 'desc')}>
								<SelectTrigger className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='asc'>{t('product:items.sortAsc')}</SelectItem>
									<SelectItem value='desc'>{t('product:items.sortDesc')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							onReset();
							setOpen(false);
						}}
					>
						{t('product:items.reset')}
					</Button>
					<Button size='sm' onClick={apply}>
						{t('product:items.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Puts a swapped pair (min above max) back in order; a missing side stays open. */
function orderRange(low: number | undefined, high: number | undefined): [number | undefined, number | undefined] {
	return low !== undefined && high !== undefined && low > high ? [high, low] : [low, high];
}
