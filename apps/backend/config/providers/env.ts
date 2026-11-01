import { appConfig } from './config';

/**
 * Production-environment detection.
 *
 * @remarks
 * `appConfig.instance.env` is a 7-value enum (`local`, `dev`, `development`,
 * `staging`, `prod`, `production`, `test`), so a bare `=== 'production'`
 * check would silently miss the `prod` spelling. Both are treated as
 * production here; `staging` deliberately is NOT (seeders remain available
 * there).
 */
export function isProductionEnv(): boolean {
	return isProdLikeEnv(appConfig.instance.env);
}

/** Pure predicate behind {@link isProductionEnv} (exported for tests). */
export function isProdLikeEnv(env: string): boolean {
	return env === 'prod' || env === 'production';
}
