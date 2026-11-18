/**
 * Command palette: opens with ⌘K / Ctrl+K or any `[data-open-search]` trigger, searches
 * `/api/search.json` (debounced, cancellable), renders grouped results with highlighted
 * matches, and supports ↑ ↓ Enter Escape plus outside-click close.
 */
type SearchItem = { title: string; meta: string; href: string; image?: string };
type SearchGroup = { key: string; title: string; items: SearchItem[] };
type SearchResponse = { q: string; groups: SearchGroup[]; total: number; catalogAvailable: boolean };

const DEBOUNCE_MS = 200;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function highlight(text: string, terms: string[]) {
  const fragment = document.createDocumentFragment();
  if (!terms.length) {
    fragment.append(text);
    return fragment;
  }
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  for (const part of text.split(pattern)) {
    if (!part) continue;
    if (terms.some((t) => t.toLowerCase() === part.toLowerCase())) {
      const mark = document.createElement("mark");
      mark.className = "bg-blue-50 font-bold text-blue-700 rounded-[3px]";
      mark.textContent = part;
      fragment.append(mark);
    } else fragment.append(part);
  }
  return fragment;
}

export function initCommandPalette() {
  const dialog = document.querySelector<HTMLDialogElement>("[data-command-palette]");
  if (!dialog || dialog.dataset.ready) return;
  dialog.dataset.ready = "1";
  const input = dialog.querySelector<HTMLInputElement>("[data-palette-input]")!;
  const list = dialog.querySelector<HTMLUListElement>("[data-palette-results]")!;
  const idle = dialog.querySelector<HTMLElement>("[data-palette-idle]")!;
  const status = dialog.querySelector<HTMLElement>("[data-palette-status]")!;
  const allLink = dialog.querySelector<HTMLAnchorElement>("[data-palette-all]");
  let options: HTMLAnchorElement[] = [];
  let active = -1;
  let timer = 0;
  let controller: AbortController | undefined;
  let returnFocus: HTMLElement | null = null;

  document.querySelectorAll<HTMLElement>("[data-shortcut-hint]").forEach((el) => (el.textContent = isMac ? "⌘ K" : "Ctrl K"));

  const setActive = (index: number) => {
    options.forEach((o, i) => o.setAttribute("aria-selected", String(i === index)));
    active = index;
    const option = options[index];
    if (option) {
      input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };

  const message = (title: string, detail: string, tone: "muted" | "danger" = "muted") => {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "flex flex-col items-center gap-1 px-6 py-10 text-center";
    li.setAttribute("role", "presentation");
    const strong = document.createElement("p");
    strong.className = `text-[15px] font-semibold ${tone === "danger" ? "text-danger" : "text-fg"}`;
    strong.textContent = title;
    const p = document.createElement("p");
    p.className = "text-[13px] text-fg-muted";
    p.textContent = detail;
    li.append(strong, p);
    list.append(li);
    options = [];
    setActive(-1);
  };

  const loading = () => {
    list.innerHTML = Array.from({ length: 4 }, () =>
      `<li role="presentation" class="flex items-center gap-3 px-3 py-3"><span class="skeleton size-10 shrink-0 rounded-md"></span><span class="flex flex-1 flex-col gap-2"><span class="skeleton h-3 w-1/2 rounded-pill"></span><span class="skeleton h-2.5 w-1/3 rounded-pill"></span></span></li>`,
    ).join("");
    status.textContent = "Searching…";
  };

  const render = (data: SearchResponse) => {
    const terms = data.q.toLowerCase().split(/\s+/).filter(Boolean);
    list.innerHTML = "";
    options = [];
    if (!data.total) {
      message(`No results for “${data.q}”`, data.catalogAvailable ? "Try a model like S200, a category or a topic such as warranty." : "Product search is temporarily unavailable.");
      status.textContent = "No results";
      return;
    }
    for (const group of data.groups) {
      const header = document.createElement("li");
      header.setAttribute("role", "presentation");
      header.className = "px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[1.2px] text-fg-muted uppercase";
      header.textContent = group.title;
      list.append(header);
      for (const item of group.items) {
        const li = document.createElement("li");
        li.setAttribute("role", "presentation");
        const a = document.createElement("a");
        a.href = item.href;
        a.id = `palette-option-${options.length}`;
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");
        a.className = "flex items-center gap-3 rounded-md px-3 py-2.5 aria-selected:bg-surface hover:bg-surface";
        if (item.image) {
          const img = document.createElement("img");
          img.src = item.image;
          img.alt = "";
          img.loading = "lazy";
          img.className = "size-10 shrink-0 rounded-md bg-surface object-cover";
          a.append(img);
        }
        const text = document.createElement("span");
        text.className = "flex min-w-0 flex-1 flex-col gap-0.5";
        const title = document.createElement("span");
        title.className = "truncate text-[14.5px] font-semibold text-fg";
        title.append(highlight(item.title, terms));
        const meta = document.createElement("span");
        meta.className = "truncate text-[12.5px] text-fg-muted";
        meta.append(highlight(item.meta, terms));
        text.append(title, meta);
        a.append(text);
        a.addEventListener("pointermove", () => setActive(options.indexOf(a)));
        li.append(a);
        list.append(li);
        options.push(a);
      }
    }
    setActive(0);
    status.textContent = `${data.total} result${data.total === 1 ? "" : "s"}`;
  };

  const search = async (value: string) => {
    const q = value.trim();
    controller?.abort();
    if (allLink) allLink.href = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    idle.hidden = Boolean(q);
    if (!q) {
      list.innerHTML = "";
      options = [];
      setActive(-1);
      status.textContent = "";
      return;
    }
    controller = new AbortController();
    loading();
    try {
      const response = await fetch(`/api/search.json?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      render((await response.json()) as SearchResponse);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      message("Search is unavailable right now", "Check your connection and try again.", "danger");
      status.textContent = "Search failed";
    }
  };

  const open = (initial = "") => {
    if (dialog.open) return;
    returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.documentElement.classList.add("overflow-hidden");
    input.value = initial;
    search(initial);
    input.focus();
    input.select();
  };
  const close = () => dialog.open && dialog.close();

  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("overflow-hidden");
    controller?.abort();
    returnFocus?.focus?.();
  });
  // Outside click: the dialog element itself is the backdrop area.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.querySelector("[data-palette-close]")?.addEventListener("click", close);
  dialog.querySelectorAll<HTMLButtonElement>("[data-palette-term]").forEach((button) =>
    button.addEventListener("click", () => {
      input.value = button.dataset.paletteTerm!;
      search(input.value);
      input.focus();
    }),
  );

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => search(input.value), DEBOUNCE_MS);
  });
  input.addEventListener("keydown", (event) => {
    // Search inputs clear themselves on Escape; close the palette in one press instead.
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      const option = options[active];
      if (option) {
        event.preventDefault();
        location.assign(option.href);
      }
      // No active option: the form submits to /search?q=.
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
      event.preventDefault();
      if (dialog.open) close();
      else open();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const trigger = (event.target as Element).closest<HTMLElement>("[data-open-search]");
    if (!trigger) return;
    event.preventDefault();
    open(trigger.dataset.openSearch ?? "");
  });
}
