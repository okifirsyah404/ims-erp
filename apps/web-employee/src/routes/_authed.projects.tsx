import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Layout passthrough for `/projects`.
 *
 * @remarks
 * File-based routing makes every `_authed.projects.*` file a child of this
 * route, so this file must exist and render an `<Outlet/>`; the list itself
 * lives in `_authed.projects.index.tsx` and the detail in
 * `_authed.projects.$projectId.tsx`. Without it the list page would swallow
 * the detail route (the bug the browser walk-through caught).
 */
export const Route = createFileRoute('/_authed/projects')({
	component: () => <Outlet />,
});