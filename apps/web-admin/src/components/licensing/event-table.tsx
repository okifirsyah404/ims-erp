import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { formatDateTime } from '@/lib/format';
import type { TLicenseEvent } from '@/lib/license-api';

const PASSED = new Set(['ok', 'grace']);

type TResult = 'ok' | 'grace' | 'unknown' | 'expired' | 'not_started' | 'suspended' | 'terminated' | 'revoked' | 'seat_limit' | 'not_activated';

/** The license event log: API calls from applications and staff overrides. */
export function EventTable({ events, showContract }: { events: TLicenseEvent[]; showContract: boolean }) {
	const { t, i18n } = useTranslation(['licensing', 'common']);
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('licensing:events.at')}</TableHead>
					<TableHead>{t('licensing:events.type')}</TableHead>
					<TableHead>{t('licensing:events.result')}</TableHead>
					{showContract && <TableHead>{t('licensing:events.contract')}</TableHead>}
					<TableHead>{t('licensing:events.source')}</TableHead>
					<TableHead>{t('licensing:events.detail')}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{events.map((event) => (
					<TableRow key={event.id}>
						<TableCell className='whitespace-nowrap'>{formatDateTime(event.eventAt, i18n.language)}</TableCell>
						<TableCell>{t(`licensing:events.kind.${event.eventType}`)}</TableCell>
						<TableCell>
							<Badge variant={PASSED.has(event.result) ? (event.result === 'grace' ? 'secondary' : 'default') : 'destructive'}>
								{t(`licensing:result.${event.result as TResult}`)}
							</Badge>
						</TableCell>
						{showContract && (
							<TableCell>
								{event.licenseContractId ? (
									<Link to='/subscription/$contractId' params={{ contractId: event.licenseContractId }} className='hover:underline'>
										{event.contractCode}
									</Link>
								) : (
									'—'
								)}
								{event.customerName && <div className='text-xs text-muted-foreground'>{event.customerName}</div>}
							</TableCell>
						)}
						<TableCell>{event.applicationApiKeyId ? t('licensing:events.byApplication') : t('licensing:events.byStaff')}</TableCell>
						<TableCell className='max-w-80 text-sm'>
							{event.instanceId && <code className='font-mono text-xs'>{event.instanceId}</code>}
							{event.ipAddress && <span className='ml-2 text-xs text-muted-foreground'>{event.ipAddress}</span>}
							{event.description && <div className='text-xs text-muted-foreground'>{event.description}</div>}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
