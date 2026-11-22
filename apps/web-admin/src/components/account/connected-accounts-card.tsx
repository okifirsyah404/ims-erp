import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
	SOCIAL_PROVIDERS,
	invalidateLinkedAccounts,
	linkedAccountsQueryOptions,
	type TSocialProvider,
} from '@/lib/account-api';
import { accountsCallbackUrl, type TLinkOutcome } from '@/lib/account-search';
import { clearLastLoginMethodIf } from '@/lib/last-login';
import { ErrorState } from '@/components/empty-state';
import { GoogleIcon } from '@/components/icons/google-icon';
import { toast } from '@/components/toast';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@ims-erp/ui/components/alert';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from '@ims-erp/ui/components/item';
import { Skeleton } from '@ims-erp/ui/components/skeleton';

const PROVIDER_META = {
	google: { labelKey: 'connected.google', Icon: GoogleIcon },
} as const satisfies Record<TSocialProvider, unknown>;

const OUTCOME_KEY = {
	emailMismatch: 'connected.emailMismatch',
	linkedElsewhere: 'connected.linkedElsewhere',
	failed: 'connected.failed',
} as const;

/**
 * Connected accounts card on `/accounts` (ERP-0109): link or unlink a social
 * login (Google) through Better Auth's `linkSocial` / `unlinkAccount`.
 *
 * @remarks
 * Linking leaves the app for the provider and returns to
 * `/accounts?section=connected` (`linked=1` on success, Better Auth's
 * `error` code on failure; the page parses it into `outcome`). Only an
 * account with the user's own email can be linked: Better Auth's default
 * `allowDifferentEmails: false` (owner decision 2026-11-21). The server also
 * refuses to unlink the last sign-in method; the disabled button only
 * mirrors that rule.
 */
export function ConnectedAccountsCard({
	id,
	outcome,
}: {
	id: string;
	outcome: TLinkOutcome | null;
}) {
	const { t } = useTranslation(['account', 'common']);
	const accountsQuery = useQuery(linkedAccountsQueryOptions);
	const [busy, setBusy] = useState<TSocialProvider | null>(null);

	const accounts = accountsQuery.data ?? [];
	const onlyOneMethod = accounts.length <= 1;

	async function connect(provider: TSocialProvider) {
		setBusy(provider);
		try {
			const origin = window.location.origin;
			const { error } = await authClient.linkSocial({
				provider,
				callbackURL: accountsCallbackUrl(origin, 'connected', { linked: '1' }),
				errorCallbackURL: accountsCallbackUrl(origin, 'connected'),
			});
			// Success navigates away; only an immediate refusal lands here.
			if (error) toast.error(error.message ?? t('connected.failed'));
		} catch {
			toast.error(t('common:error.network'));
		} finally {
			setBusy(null);
		}
	}

	/** `rowId` is the Better Auth account row id, not the provider's user id. */
	async function disconnect(provider: TSocialProvider, rowId: string) {
		setBusy(provider);
		try {
			const { error } = await authClient.unlinkAccount({ accountId: rowId });
			if (error) {
				toast.error(error.message ?? t('connected.failed'));
				return;
			}
			await invalidateLinkedAccounts();
			// The remembered method must not point at a disconnected provider.
			clearLastLoginMethodIf(provider);
			toast.success(t('connected.unlinked'));
		} catch {
			toast.error(t('common:error.network'));
		} finally {
			setBusy(null);
		}
	}

	return (
		<section id={id} className='scroll-mt-4'>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>{t('connected.title')}</CardTitle>
					<CardDescription>{t('connected.description')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-3'>
					{outcome === 'linked' && (
						<Alert>
							<CircleCheck className='text-emerald-600' />
							<AlertTitle>{t('connected.linked')}</AlertTitle>
						</Alert>
					)}
					{outcome && outcome !== 'linked' && (
						<Alert variant='destructive'>
							<CircleAlert />
							<AlertTitle>{t('connected.failed')}</AlertTitle>
							{outcome !== 'failed' && (
								<AlertDescription>{t(OUTCOME_KEY[outcome])}</AlertDescription>
							)}
						</Alert>
					)}

					{accountsQuery.isError ? (
						<ErrorState error={accountsQuery.error} size='sm' />
					) : (
						<ItemGroup className='gap-2'>
							{SOCIAL_PROVIDERS.map((provider) => {
								const { labelKey, Icon } = PROVIDER_META[provider];
								const linked = accounts.find((a) => a.providerId === provider);
								return (
									<Item key={provider} variant='outline' size='sm' role='listitem'>
										<ItemMedia>
											<Icon className='size-5' />
										</ItemMedia>
										<ItemContent>
											<ItemTitle>
												{t(labelKey)}
												{accountsQuery.isPending ? (
													<Skeleton className='h-4 w-20' />
												) : (
													<Badge variant={linked ? 'secondary' : 'outline'}>
														{linked
															? t('connected.connected')
															: t('connected.notConnected')}
													</Badge>
												)}
											</ItemTitle>
											{linked && onlyOneMethod && (
												<ItemDescription>{t('connected.onlyMethod')}</ItemDescription>
											)}
										</ItemContent>
										<ItemActions>
											{linked ? (
												<Button
													type='button'
													size='sm'
													variant='outline'
													disabled={busy !== null || onlyOneMethod}
													onClick={() => disconnect(provider, linked.id)}
												>
													{t('connected.disconnect')}
												</Button>
											) : (
												<Button
													type='button'
													size='sm'
													disabled={busy !== null || accountsQuery.isPending}
													onClick={() => connect(provider)}
												>
													{t('connected.connect')}
												</Button>
											)}
										</ItemActions>
									</Item>
								);
							})}
						</ItemGroup>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
