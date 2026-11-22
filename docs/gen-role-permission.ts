/**
 * Regenerates the generated half of `docs/role-permission.md` (ERP-0113).
 *
 * Usage (repo root): `bun docs/gen-role-permission.ts`
 *
 * Sources, both read as code, never as prose:
 * - the role catalog in `packages/common/src/authorization/erp-permissions.ts`
 *   (`erpRoleNames`, `erpRoleGrants`, `appRoleNames`, `appRoleGrants`);
 * - every backend controller, parsed with the TypeScript AST: the
 *   `domainPlugin({ prefix, guards })` chain each route hangs off, and the
 *   route's guard macro option (`erp`, `erpSession`, `adminOrErp`,
 *   `warehouse`, `portal`, `publicApi`).
 *
 * Only the block between the BEGIN/END GENERATED markers is rewritten; the
 * hand-written explanation above it is preserved. Run it whenever an endpoint,
 * a guard option or a role grant changes (see `runbook.md`).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import {
	appRoleGrants,
	appRoleNames,
	erpRoleGrants,
	erpRoleLabels,
	erpRoleNames,
	type ErpPermissionRequest,
} from '../packages/common/src/authorization/erp-permissions';

const ROOT = join(import.meta.dir, '..');
const BACKEND_APP = join(ROOT, 'apps/backend/src/app');
const NUMBERING_CONTROLLER = join(ROOT, 'apps/backend/src/shared/numbering/controller.ts');
const DOC = join(ROOT, 'docs/role-permission.md');
const BEGIN = '<!-- BEGIN GENERATED: bun docs/gen-role-permission.ts -->';
const END = '<!-- END GENERATED -->';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
const GUARD_KEYS = ['erp', 'erpSession', 'adminOrErp', 'warehouse', 'portal', 'publicApi'] as const;
type TGuardKey = (typeof GUARD_KEYS)[number];

/** What one route requires, as read from its options object. */
type TRequirement = {
	guard: TGuardKey | 'none' | 'unresolved';
	permissions: string[];
	policy: string | null;
	appAdminOnly: boolean;
	action: string | null;
};

type TRoute = {
	module: string;
	method: string;
	path: string;
	pluginGuards: string;
	requirement: TRequirement;
};

/* ------------------------------- AST helpers ------------------------------- */

function stringOf(node: ts.Node | undefined): string | null {
	if (!node) return null;
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	return null;
}

/** Top-level `const x = ...` and `function x()` declarations of a file, by name. */
function declarationsOf(file: ts.SourceFile): Map<string, ts.Node> {
	const found = new Map<string, ts.Node>();
	const visit = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			found.set(node.name.text, node.initializer);
		}
		if (ts.isFunctionDeclaration(node) && node.name) found.set(node.name.text, node);
		// `static plugin(prefix = '/webhooks')`: a defaulted parameter acts as a constant.
		if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer) {
			found.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}

/** Resolves an expression to the object literal it denotes, following local names and helpers. */
function objectOf(
	node: ts.Node | undefined,
	decls: Map<string, ts.Node>,
	depth = 0,
): ts.ObjectLiteralExpression | null {
	if (!node || depth > 5) return null;
	if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		return objectOf(node.expression, decls, depth + 1);
	}
	if (ts.isObjectLiteralExpression(node)) return node;
	if (ts.isIdentifier(node)) return objectOf(decls.get(node.text), decls, depth + 1);
	if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
		return objectOf(decls.get(node.expression.text), decls, depth + 1);
	}
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
		const body = node.body;
		if (!body) return null;
		if (!ts.isBlock(body)) return objectOf(body, decls, depth + 1);
		for (const statement of body.statements) {
			if (ts.isReturnStatement(statement)) return objectOf(statement.expression, decls, depth + 1);
		}
	}
	return null;
}

/** Flattens an options object, merging `...spread` members that resolve to objects. */
function propertiesOf(
	object: ts.ObjectLiteralExpression,
	decls: Map<string, ts.Node>,
): Map<string, ts.Expression> {
	const props = new Map<string, ts.Expression>();
	for (const member of object.properties) {
		if (ts.isSpreadAssignment(member)) {
			const inner = objectOf(member.expression, decls);
			if (inner) for (const [key, value] of propertiesOf(inner, decls)) props.set(key, value);
			continue;
		}
		if (ts.isPropertyAssignment(member)) {
			const key = ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) ? member.name.text : null;
			if (key) props.set(key, member.initializer);
		} else if (ts.isShorthandPropertyAssignment(member)) {
			props.set(member.name.text, member.name);
		}
	}
	return props;
}

function stringsOf(node: ts.Expression | undefined, decls: Map<string, ts.Node>): string[] {
	if (!node) return [];
	let target: ts.Node = node;
	while (ts.isAsExpression(target) || ts.isParenthesizedExpression(target)) target = target.expression;
	if (ts.isIdentifier(target)) {
		const resolved = decls.get(target.text);
		return resolved ? stringsOf(resolved as ts.Expression, decls) : [`<${target.text}>`];
	}
	if (!ts.isArrayLiteralExpression(target)) return [`<${target.getText()}>`];
	return target.elements.flatMap((element) =>
		ts.isSpreadElement(element) ? stringsOf(element.expression, decls) : [stringOf(element) ?? `<${element.getText()}>`],
	);
}

/** Reads the guard macro option of one route's options argument. */
function requirementOf(options: ts.Node | undefined, decls: Map<string, ts.Node>): TRequirement {
	const empty: TRequirement = { guard: 'none', permissions: [], policy: null, appAdminOnly: false, action: null };
	if (!options) return empty;
	const object = objectOf(options, decls);
	if (!object) return { ...empty, guard: 'unresolved' };
	const props = propertiesOf(object, decls);
	const key = GUARD_KEYS.find((candidate) => props.has(candidate));
	if (!key) return empty;
	const value = props.get(key)!;
	const inner = objectOf(value, decls);
	if (!inner) return { ...empty, guard: key };
	const innerProps = propertiesOf(inner, decls);
	const policy = innerProps.get('policy');
	const action = innerProps.get('action');
	const appAdminOnly = innerProps.get('appAdminOnly');
	return {
		guard: key,
		permissions: stringsOf(innerProps.get('permission'), decls),
		policy: policy ? policy.getText() : null,
		appAdminOnly: appAdminOnly?.kind === ts.SyntaxKind.TrueKeyword,
		action: action ? (stringOf(action) ?? action.getText()) : null,
	};
}

/** Walks a route call down its method chain to the root `domainPlugin({...})` call. */
function pluginOf(call: ts.CallExpression): ts.CallExpression | null {
	let current: ts.Expression = call;
	while (ts.isCallExpression(current)) {
		const callee = current.expression;
		if (ts.isIdentifier(callee)) return callee.text === 'domainPlugin' ? current : null;
		if (!ts.isPropertyAccessExpression(callee)) return null;
		current = callee.expression;
	}
	return null;
}

/** Every route of a file, with the prefix and guard set of the plugin it hangs off. */
function routesOf(path: string, module: string, prefixOverride?: string, appAdminOnly = false): TRoute[] {
	const source = readFileSync(path, 'utf8');
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const decls = declarationsOf(file);
	const routes: TRoute[] = [];
	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			HTTP_METHODS.has(node.expression.name.text)
		) {
			const routePath = stringOf(node.arguments[0]);
			const plugin = pluginOf(node);
			if (routePath !== null && plugin) {
				const pluginProps = propertiesOf(objectOf(plugin.arguments[0], decls)!, decls);
				const prefixNode = pluginProps.get('prefix');
				const resolvedPrefix =
					prefixNode && ts.isIdentifier(prefixNode)
						? stringOf(decls.get(prefixNode.text))
						: stringOf(prefixNode);
				const prefix = resolvedPrefix ?? prefixOverride ?? `<${prefixNode?.getText() ?? '?'}>`;
				// `(path, handler)` has no options object: nothing guards the route.
				const requirement = requirementOf(node.arguments[2], decls);
				if (appAdminOnly && requirement.guard === 'adminOrErp') requirement.appAdminOnly = true;
				routes.push({
					module,
					method: node.expression.name.text.toUpperCase(),
					path: `${prefix}${routePath}` || '/',
					pluginGuards: stringOf(pluginProps.get('guards')) ?? 'none',
					requirement,
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return routes;
}

/** `codeNumberingController({ prefix, appAdminOnly })` call sites: the shared routes mounted per module. */
function numberingMountsOf(path: string): Array<{ prefix: string; appAdminOnly: boolean }> {
	const source = readFileSync(path, 'utf8');
	if (!source.includes('codeNumberingController(')) return [];
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const mounts: Array<{ prefix: string; appAdminOnly: boolean }> = [];
	const visit = (node: ts.Node) => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'codeNumberingController') {
			const object = node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0]) ? node.arguments[0] : null;
			const props = object ? propertiesOf(object, new Map()) : new Map<string, ts.Expression>();
			const prefix = stringOf(props.get('prefix'));
			if (prefix) {
				mounts.push({ prefix, appAdminOnly: props.get('appAdminOnly')?.kind === ts.SyntaxKind.TrueKeyword });
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return mounts;
}

/* ------------------------------ authorization ------------------------------ */

/** True when one role's grants include `resource:action`. */
function grants(request: ErpPermissionRequest, permission: string): boolean {
	const [resource, action] = permission.split(':');
	const actions = (request as Record<string, readonly string[] | undefined>)[resource ?? ''];
	return Boolean(action && actions?.includes(action));
}

/** Organization roles holding every permission of a route. */
function rolesFor(permissions: string[]): string[] {
	return erpRoleNames.filter((role) => permissions.every((permission) => grants(erpRoleGrants[role], permission)));
}

function guardLabel(route: TRoute): string {
	const r = route.requirement;
	switch (r.guard) {
		case 'none':
			return 'no guard macro';
		case 'unresolved':
			return 'unresolved (read the controller)';
		case 'erp':
			return r.permissions.length > 0 ? 'org member + permission' : 'org member';
		case 'erpSession':
			return r.policy?.includes('GlobalAdmin') ? 'session + app admin' : 'session';
		case 'adminOrErp':
			return r.appAdminOnly ? 'app admin' : 'app admin, or org member + permission';
		case 'warehouse':
			return `warehouse PIC (${r.action ?? '?'}) or app admin route`;
		case 'portal':
			return 'customer portal session';
		case 'publicApi':
			return 'public API key';
	}
}

function whoLabel(route: TRoute): string {
	const r = route.requirement;
	const needsRoles = (r.guard === 'erp' || (r.guard === 'adminOrErp' && !r.appAdminOnly)) && r.permissions.length > 0;
	if (!needsRoles) {
		if (r.guard === 'erp') return 'every organization member';
		if (r.guard === 'erpSession') return r.policy?.includes('GlobalAdmin') ? 'app admin' : 'any signed-in user';
		if (r.guard === 'adminOrErp') return 'app admin';
		if (r.guard === 'portal') return '`customer` app role';
		if (r.guard === 'warehouse') return 'PIC of the warehouse';
		return '-';
	}
	if (r.permissions.some((permission) => permission.startsWith('<'))) return 'unresolved';
	const roles = rolesFor(r.permissions);
	const prefix = r.guard === 'adminOrErp' ? 'app admin; ' : '';
	if (roles.length === erpRoleNames.length) return `${prefix}every org role`;
	return prefix + (roles.length === 0 ? 'no org role' : roles.map((role) => `\`${role}\``).join(', '));
}

/* --------------------------------- render --------------------------------- */

function cell(text: string): string {
	return text.replaceAll('|', '\\|');
}

function grantsBlock(request: ErpPermissionRequest): string {
	return Object.entries(request)
		.map(([resource, actions]) => `| \`${resource}\` | ${(actions as readonly string[]).join(', ')} |`)
		.join('\n');
}

function render(routes: TRoute[]): string {
	const lines: string[] = [BEGIN, '', '> Generated. Do not edit by hand; run `bun docs/gen-role-permission.ts`.', ''];

	lines.push('## Organization roles', '', '| Role | English | Indonesian | Resources granted |', '| --- | --- | --- | --- |');
	for (const role of erpRoleNames) {
		const label = erpRoleLabels[role];
		lines.push(`| \`${role}\` | ${label.en} | ${label.id} | ${Object.keys(erpRoleGrants[role]).length} |`);
	}

	lines.push('', '## Permissions per organization role', '');
	lines.push('Each role is a closed grant set from `erpRoleGrants`; a member holding several roles gets the union.', '');
	for (const role of erpRoleNames) {
		lines.push(
			'<details>',
			`<summary><code>${role}</code> (${erpRoleLabels[role].en})</summary>`,
			'',
			'| Resource | Actions |',
			'| --- | --- |',
			grantsBlock(erpRoleGrants[role]),
			'',
			'</details>',
			'',
		);
	}

	lines.push('## Permissions per app role', '');
	lines.push('App roles live on `user.role` and grant **no** organization permission; they only open a portal.', '');
	for (const role of appRoleNames) {
		lines.push(`### \`${role}\``, '', '| Resource | Actions |', '| --- | --- |', grantsBlock(appRoleGrants[role]), '');
	}

	const byModule = new Map<string, TRoute[]>();
	for (const route of routes) byModule.set(route.module, [...(byModule.get(route.module) ?? []), route]);
	const unresolved = routes.filter(
		(route) => route.requirement.guard === 'unresolved' || route.requirement.permissions.some((p) => p.startsWith('<')),
	).length;

	lines.push('## Endpoints', '');
	lines.push(
		`${routes.length} routes across ${byModule.size} modules, read from \`apps/backend/src/app/*/controllers\`` +
			` and the shared code-numbering controller. ${unresolved} route(s) could not be resolved statically.`,
		'',
		'Columns: **Guard** is the check the route opts into; **Requirement** is every `resource:action` it needs (ALL must pass);',
		'**Who** lists the organization roles whose grants satisfy it (`owner` holds every ERP statement except `warehouse:*`, which is app-admin-only).',
		'',
	);
	for (const [module, list] of [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`### ${module}`, '', '| Method | Path | Guard | Requirement | Who |', '| --- | --- | --- | --- | --- |');
		for (const route of list.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))) {
			const requirement = route.requirement.permissions.map((p) => `\`${p}\``).join(' ') || '-';
			lines.push(
				`| ${route.method} | \`${cell(route.path)}\` | ${cell(guardLabel(route))} | ${cell(requirement)} | ${cell(whoLabel(route))} |`,
			);
		}
		lines.push('');
	}

	lines.push(END);
	return lines.join('\n');
}

/* ---------------------------------- main ---------------------------------- */

const routes: TRoute[] = [];
for (const module of readdirSync(BACKEND_APP).sort()) {
	const dir = join(BACKEND_APP, module, 'controllers');
	let files: string[] = [];
	try {
		files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
	} catch {
		continue;
	}
	for (const name of files) {
		const path = join(dir, name);
		routes.push(...routesOf(path, module));
		for (const mount of numberingMountsOf(path)) {
			routes.push(
				...routesOf(NUMBERING_CONTROLLER, module, `${mount.prefix}/code-numberings`, mount.appAdminOnly),
			);
		}
	}
}

const doc = readFileSync(DOC, 'utf8');
const start = doc.indexOf(BEGIN);
const end = doc.indexOf(END);
if (start === -1 || end === -1) {
	throw new Error(`${relative(ROOT, DOC)} is missing the generated-block markers`);
}
writeFileSync(DOC, doc.slice(0, start) + render(routes) + doc.slice(end + END.length));
console.log(`${relative(ROOT, DOC)}: ${routes.length} routes written`);
