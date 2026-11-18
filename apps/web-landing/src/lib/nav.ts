/** True when `href` is the current page or one of its ancestors ("/" matches only itself). */
export function isActivePath(pathname: string, href: string): boolean {
  const normalize = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);
  const current = normalize(pathname);
  const target = normalize(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}
