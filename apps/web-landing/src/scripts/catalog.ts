/**
 * 02.01 Product Catalog — in-place updates.
 *
 * Filters, category chips, search, sort and pagination are plain links and GET forms
 * (they work without JS). This script intercepts them, fetches `/products/results` with
 * the same query string and swaps only the chips + results regions, keeping the URL in
 * sync (pushState), the scroll position and focus. Search is debounced; "Load more"
 * appends the next page. Skeletons show for slow responses; failures show an error
 * state with a retry.
 */
import { observeReveal, syncWishlist } from "./site";

const FRAGMENT_PATH = "/products/results";
const SEARCH_DEBOUNCE_MS = 350;
const SKELETON_DELAY_MS = 150;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type NavOptions = { history?: "push" | "replace" | "none"; append?: boolean; scrollToResults?: boolean };

let controller: AbortController | undefined;
let skeletonTimer = 0;

const region = (name: string) => document.querySelector<HTMLElement>(`[data-catalog-region="${name}"]`);

function isCatalogUrl(url: URL) {
  return url.origin === location.origin && url.pathname.replace(/\/$/, "") === "/products";
}

function skeletonHtml() {
  const card = (cls: string) =>
    `<li class="flex"><div class="${cls} flex w-full flex-col gap-3 rounded-lg bg-white p-2 ring-1 ring-border ring-inset">
      <div class="skeleton aspect-[4/3] rounded-md"></div>
      <div class="flex flex-col gap-2 px-2 pb-3">
        <div class="skeleton h-2.5 w-1/3 rounded-pill"></div><div class="skeleton h-4 w-3/4 rounded-pill"></div>
        <div class="skeleton h-3 w-1/2 rounded-pill"></div><div class="skeleton mt-3 h-10 rounded-md"></div>
      </div></div></li>`;
  return `<div class="skeleton h-9 w-60 rounded-md" aria-hidden="true"></div>
    <ul class="hidden grid-cols-3 gap-5 xl:grid" aria-hidden="true">${card("").repeat(6)}</ul>
    <ul class="grid grid-cols-2 gap-x-3 gap-y-3.5 md:grid-cols-3 xl:hidden" aria-hidden="true">${card("").repeat(4)}</ul>
    <p class="sr-only" role="status">Loading products…</p>`;
}

function errorHtml(retryHref: string) {
  return `<div class="flex flex-col items-center gap-4 rounded-card bg-white px-10 py-12 text-center ring-1 ring-border ring-inset" role="alert">
    <h2 class="font-heading text-[20px] font-extrabold text-navy-900">We couldn't load products</h2>
    <p class="max-w-[360px] text-[14px] leading-[1.55] text-fg-secondary">Check your connection and try again.</p>
    <a href="${retryHref}" class="inline-flex items-center justify-center rounded-md bg-blue-600 px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-blue-700" data-catalog-retry>Try again</a>
  </div>`;
}

/** Reflects the URL in every filter control (after back/forward or chip removal). */
function syncControls(params: URLSearchParams) {
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-filter-form] input[type="checkbox"]')) {
    input.checked = params.getAll(input.name).includes(input.value);
  }
  for (const range of document.querySelectorAll<HTMLElement>("[data-price-range]")) {
    const min = range.querySelector<HTMLInputElement>("[data-range-min]");
    const max = range.querySelector<HTMLInputElement>("[data-range-max]");
    if (!min || !max) continue;
    min.value = params.get("min") ?? min.min;
    max.value = params.get("max") ?? max.max;
    min.dispatchEvent(new Event("input"));
    range.toggleAttribute("data-pristine", !params.has("min") && !params.has("max"));
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('main form[role="search"] input[name="q"]')) {
    if (document.activeElement !== input) input.value = params.get("q") ?? "";
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('main form input[type="hidden"][name="sort"]')) {
    input.value = params.get("sort") ?? "popular";
  }
}

async function navigate(url: URL, { history: mode = "push", append = false, scrollToResults = false }: NavOptions = {}) {
  const results = region("results");
  const chips = region("chips");
  if (!results) return void location.assign(url);

  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  window.clearTimeout(skeletonTimer);
  results.setAttribute("aria-busy", "true");
  const loadMore = append ? document.querySelectorAll<HTMLElement>("[data-load-more]") : [];
  loadMore.forEach((link) => link.setAttribute("aria-busy", "true"));
  if (!append) skeletonTimer = window.setTimeout(() => (results.innerHTML = skeletonHtml()), SKELETON_DELAY_MS);

  if (mode === "push") history.pushState({ catalog: true }, "", url);
  if (mode === "replace") history.replaceState({ catalog: true }, "", url);
  syncControls(url.searchParams);

  try {
    const response = await fetch(`${FRAGMENT_PATH}${url.search}`, { signal, headers: { Accept: "text/html" } });
    const html = await response.text();
    if (signal.aborted) return;
    window.clearTimeout(skeletonTimer);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const next = (name: string) => doc.querySelector<HTMLTemplateElement>(`template[data-region="${name}"]`)?.content;
    const nextResults = next("results");
    if (!nextResults) throw new Error(`Unexpected catalog response (${response.status})`);

    if (append) {
      // Load more: append the new cards and replace the pagination controls.
      for (const kind of ["desktop", "mobile"]) {
        const list = results.querySelector(`[data-catalog-list="${kind}"]`);
        const items = nextResults.querySelector(`[data-catalog-list="${kind}"]`)?.children;
        if (list && items) list.append(...[...items]);
      }
      const pagination = results.querySelector("[data-catalog-pagination]");
      const nextPagination = nextResults.querySelector("[data-catalog-pagination]");
      if (pagination && nextPagination) pagination.replaceWith(nextPagination);
    } else {
      results.replaceChildren(nextResults);
    }
    const nextChips = next("chips");
    if (chips && nextChips) chips.replaceChildren(nextChips);

    observeReveal(results);
    syncWishlist(results);
    if (scrollToResults && results.getBoundingClientRect().top < 0) {
      results.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }
  } catch (error) {
    if (signal.aborted) return;
    window.clearTimeout(skeletonTimer);
    console.error("[catalog]", error);
    if (!append) results.innerHTML = errorHtml(url.pathname + url.search);
    else loadMore.forEach((link) => link.removeAttribute("aria-busy"));
  } finally {
    if (!signal.aborted) results.removeAttribute("aria-busy");
  }
}

function urlFromForm(form: HTMLFormElement, submitter?: HTMLElement | null) {
  const url = new URL(form.action, location.href);
  const data = new FormData(form, submitter ?? undefined);
  url.search = "";
  if (form.getAttribute("role") === "search") {
    // Search keeps the current filters and sort; only the term and page change.
    const params = new URLSearchParams(location.search);
    params.delete("page");
    const q = String(data.get("q") ?? "").trim();
    if (q) params.set("q", q);
    else params.delete("q");
    url.search = params.toString();
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of data) {
    if (typeof value === "string" && value !== "" && !(key === "sort" && value === "popular")) params.append(key, value);
  }
  // Filter forms carry neither the live search term nor the sort: take them from the URL.
  const current = new URLSearchParams(location.search);
  if (!form.querySelector('input[name="q"]:not([type="hidden"])')) {
    params.delete("q");
    if (current.get("q")) params.set("q", current.get("q")!);
  }
  if (!form.querySelector('select[name="sort"]')) {
    params.delete("sort");
    if (current.get("sort")) params.set("sort", current.get("sort")!);
  }
  url.search = params.toString();
  return url;
}

export function initCatalog() {
  if (!region("results")) return;
  history.replaceState({ catalog: true }, "", location.href);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target || !link.closest("main")) return;
    const url = new URL(link.href);
    if (!isCatalogUrl(url)) return;
    event.preventDefault();
    const append = link.hasAttribute("data-load-more");
    const inPagination = Boolean(link.closest("[data-catalog-pagination]"));
    navigate(url, { append, history: append ? "replace" : "push", scrollToResults: inPagination && !append });
    if (link.closest("[data-filter-sheet]")) link.closest<HTMLDialogElement>("dialog")?.close();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    if (!form.closest("main") || !isCatalogUrl(new URL(form.action, location.href))) return;
    event.preventDefault();
    navigate(urlFromForm(form, event.submitter));
    form.closest<HTMLDialogElement>("dialog[data-filter-sheet]")?.close();
  });

  // Sort selects submit on change.
  document.addEventListener("change", (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>("[data-sort-form] select");
    select?.form?.requestSubmit();
  });

  // Debounced live search.
  let searchTimer = 0;
  document.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name !== "q" || !input.closest('main form[role="search"]')) return;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const url = urlFromForm(input.form!);
      if (url.search !== location.search) navigate(url, { history: "replace" });
    }, SEARCH_DEBOUNCE_MS);
  });

  window.addEventListener("popstate", () => {
    const url = new URL(location.href);
    if (isCatalogUrl(url)) navigate(url, { history: "none" });
  });
}
