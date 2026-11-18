/** Server-side pagination for list screens (`?page=`); keeps every other query param. */
export function paginate<T>(items: T[], url: URL, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const requested = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(1, requested), pageCount) : 1;
  const hrefFor = (target: number) => {
    const next = new URL(url);
    if (target <= 1) next.searchParams.delete("page");
    else next.searchParams.set("page", String(target));
    return `${next.pathname}${next.search}`;
  };
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total: items.length,
    from: items.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, items.length),
    hrefFor,
  };
}

export type Page<T> = ReturnType<typeof paginate<T>>;
