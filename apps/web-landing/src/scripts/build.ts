import { addOns, defaultConfig, estimate, gateOptions, siteTypes, softwareOptions, type BuildConfig, type LaneKind } from "../data/build";
import { formatRupiah } from "../lib/format";
import { readRfqItems, writeRfqItems } from "../lib/client/rfq-items";

const STORAGE_KEY = "entragate:build:v1";
const RFQ_DRAFT_KEY = "entragate:rfq-draft:v1";
const MAX_LANES = 40;
const stepLabels = ["Site", "Entry points", "Hardware", "Software", "Review"];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const encode = (config: BuildConfig) => btoa(encodeURIComponent(JSON.stringify(config))).replace(/=+$/, "");
const decode = (value: string): BuildConfig | null => {
  try {
    return sanitize(JSON.parse(decodeURIComponent(atob(value))));
  } catch {
    return null;
  }
};

/** Accepts only known ids and sane numbers from storage / shared links. */
function sanitize(raw: Partial<BuildConfig>): BuildConfig | null {
  if (!raw || !Array.isArray(raw.entries)) return null;
  const kinds: LaneKind[] = ["pedestrian", "vehicle"];
  const entries = raw.entries
    .filter((e) => e && kinds.includes(e.kind))
    .slice(0, 12)
    .map((e, i) => {
      const option = gateOptions.find((o) => o.id === e.option && o.kind === e.kind) ?? gateOptions.find((o) => o.kind === e.kind && o.recommended)!;
      return { id: String(e.id ?? `entry-${i}`).slice(0, 40), name: String(e.name ?? "Entrance").slice(0, 60), kind: e.kind, lanes: Math.min(MAX_LANES, Math.max(1, Math.floor(Number(e.lanes) || 1))), option: option.id };
    });
  return {
    siteType: siteTypes.some((t) => t.id === raw.siteType) ? raw.siteType! : defaultConfig.siteType,
    siteName: String(raw.siteName ?? defaultConfig.siteName).slice(0, 80),
    city: String(raw.city ?? defaultConfig.city).slice(0, 60),
    dailyVisitors: Math.min(500_000, Math.max(0, Math.floor(Number(raw.dailyVisitors) || 0))),
    entries,
    addOns: (raw.addOns ?? []).filter((id) => addOns.some((a) => a.id === id)),
    kiosks: Math.min(20, Math.max(1, Math.floor(Number(raw.kiosks) || 1))),
    software: (raw.software ?? []).filter((id) => softwareOptions.some((s) => s.id === id)),
    term: [12, 24, 36].includes(Number(raw.term)) ? Number(raw.term) : 12,
  };
}

/** 03.01 Build Your Solution — step navigation, live estimate, auto-save, share and RFQ hand-off. */
export function initBuild() {
  const root = document.querySelector<HTMLElement>("[data-build]");
  if (!root) return;
  const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = root) => scope.querySelector<T>(selector)!;
  const $$ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = root) => [...scope.querySelectorAll<T>(selector)];
  const template = (id: string) => (document.getElementById(id) as HTMLTemplateElement).content.firstElementChild!.cloneNode(true) as HTMLElement;
  const laneIcons = document.getElementById("lane-icons") as HTMLTemplateElement;

  const params = new URL(location.href).searchParams;
  const shared = params.get("config");
  let config: BuildConfig =
    (shared && decode(shared)) ||
    (() => {
      try {
        return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")) ?? clone(defaultConfig);
      } catch {
        return clone(defaultConfig);
      }
    })();
  // Solution pages link with ?solution=… — make sure that software is selected.
  const solution = softwareOptions.find((s) => s.solution === params.get("solution"));
  if (solution && !config.software.includes(solution.id)) config.software.push(solution.id);
  const stepParam = Number(params.get("step"));
  let step = Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= 5 ? stepParam - 1 : 0;

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* storage full or disabled — the estimate still works */
    }
  };

  // ── Static inputs (site, add-ons, software, term) ───────────────────────
  const field = (name: string) => $$<HTMLInputElement>(`[name="${name}"]`);
  const syncStatic = () => {
    field("siteType").forEach((i) => (i.checked = i.value === config.siteType));
    $<HTMLInputElement>('[name="siteName"]').value = config.siteName;
    $<HTMLInputElement>('[name="city"]').value = config.city;
    $<HTMLInputElement>('[name="dailyVisitors"]').value = String(config.dailyVisitors);
    field("addOns").forEach((i) => (i.checked = config.addOns.includes(i.value)));
    $<HTMLInputElement>('[name="kiosks"]').value = String(config.kiosks);
    field("software").forEach((i) => (i.checked = config.software.includes(i.value)));
    field("term").forEach((i) => (i.checked = Number(i.value) === config.term));
  };
  root.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    switch (target.name) {
      case "siteType":
        config.siteType = target.value;
        config.siteName = siteTypes.find((t) => t.id === target.value)?.label ?? config.siteName;
        $<HTMLInputElement>('[name="siteName"]').value = config.siteName;
        break;
      case "siteName":
        config.siteName = target.value.slice(0, 80);
        break;
      case "city":
        config.city = target.value.slice(0, 60);
        break;
      case "dailyVisitors":
        config.dailyVisitors = Math.max(0, Math.floor(Number(target.value) || 0));
        break;
      case "addOns":
        config.addOns = field("addOns").filter((i) => i.checked).map((i) => i.value);
        break;
      case "kiosks":
        config.kiosks = Math.min(20, Math.max(1, Math.floor(Number(target.value) || 1)));
        break;
      case "software":
        config.software = field("software").filter((i) => i.checked).map((i) => i.value);
        break;
      case "term":
        config.term = Number(target.value);
        break;
      default:
        return;
    }
    update();
  });

  // ── Entry points (step 2) ────────────────────────────────────────────────
  const entryList = $("[data-entry-list]");
  const renderEntries = () => {
    entryList.replaceChildren(
      ...config.entries.map((entry, index) => {
        const row = template("entry-template");
        const name = $<HTMLInputElement>("[data-entry-name]", row);
        const kind = $<HTMLSelectElement>("[data-entry-kind]", row);
        name.value = entry.name;
        kind.value = entry.kind;
        $("[data-entry-lanes]", row).textContent = String(entry.lanes);
        name.addEventListener("change", () => {
          entry.name = name.value.trim().slice(0, 60) || "Entrance";
          update();
        });
        kind.addEventListener("change", () => {
          entry.kind = kind.value as LaneKind;
          entry.option = gateOptions.find((o) => o.kind === entry.kind && o.recommended)!.id;
          update();
        });
        $("[data-entry-dec]", row).addEventListener("click", () => setLanes(index, entry.lanes - 1));
        $("[data-entry-inc]", row).addEventListener("click", () => setLanes(index, entry.lanes + 1));
        const remove = $<HTMLButtonElement>("[data-entry-remove]", row);
        remove.disabled = config.entries.length === 1;
        remove.addEventListener("click", () => {
          config.entries.splice(index, 1);
          update();
        });
        return row;
      }),
    );
  };
  const setLanes = (index: number, lanes: number) => {
    config.entries[index].lanes = Math.min(MAX_LANES, Math.max(1, lanes));
    update();
  };
  $$<HTMLButtonElement>("[data-add-entry]").forEach((button) =>
    button.addEventListener("click", () => {
      const kind = button.dataset.addEntry as LaneKind;
      config.entries.push({
        id: `entry-${Date.now()}`,
        name: kind === "vehicle" ? "Vehicle entrance" : "Pedestrian entrance",
        kind,
        lanes: kind === "vehicle" ? 1 : 2,
        option: gateOptions.find((o) => o.kind === kind && o.recommended)!.id,
      });
      update();
      $$<HTMLInputElement>("[data-entry-name]").at(-1)?.select();
    }),
  );

  // ── Hardware per entry point (step 3) ────────────────────────────────────
  const laneList = $("[data-lane-list]");
  const renderLanes = () => {
    laneList.replaceChildren(
      ...config.entries.map((entry, index) => {
        const card = template("lane-template");
        const icon = laneIcons.content.querySelector(`[data-kind="${entry.kind}"]`)!.cloneNode(true);
        $("[data-lane-icon]", card).replaceChildren(icon);
        $("[data-lane-eyebrow]", card).textContent = `${entry.name} · ${entry.lanes} lane${entry.lanes === 1 ? "" : "s"}`;
        $("[data-lane-title]", card).textContent = entry.name;
        $("[data-lane-meta]", card).textContent = `${entry.lanes} lane${entry.lanes === 1 ? "" : "s"} · ${entry.kind === "vehicle" ? "entry & exit" : "staff & visitors"}`;
        $$("[data-lane-count]", card).forEach((el) => (el.textContent = String(entry.lanes)));
        $$("[data-lane-dec]", card).forEach((b) => b.addEventListener("click", () => setLanes(index, entry.lanes - 1)));
        $$("[data-lane-inc]", card).forEach((b) => b.addEventListener("click", () => setLanes(index, entry.lanes + 1)));
        const group = $("[data-lane-options]", card);
        group.setAttribute("aria-label", `Hardware for ${entry.name}`);
        group.replaceChildren(
          ...gateOptions
            .filter((o) => o.kind === entry.kind)
            .map((option) => {
              const label = template("option-template");
              const input = $<HTMLInputElement>("[data-option-input]", label);
              input.name = `option-${entry.id}`;
              input.value = option.id;
              input.checked = option.id === entry.option;
              input.addEventListener("change", () => {
                entry.option = option.id;
                update(false);
              });
              $<HTMLImageElement>("[data-option-image]", label).src = option.image;
              $("[data-option-name]", label).textContent = option.name;
              $("[data-option-detail]", label).textContent = option.detail;
              $("[data-option-price]", label).textContent = `${formatRupiah(option.price)} / lane`;
              if (option.recommended) {
                $("[data-option-tag]", label).hidden = false;
                $("[data-option-tag-mobile]", label).hidden = false;
              }
              return label;
            }),
        );
        return card;
      }),
    );
  };

  // ── Summary, review, steps ───────────────────────────────────────────────
  const siteLabel = () =>
    `${config.siteName} · ${config.city} · ${config.entries.length} entry point${config.entries.length === 1 ? "" : "s"}`;
  const renderSummary = () => {
    const result = estimate(config);
    $("[data-summary-site]").textContent = siteLabel();
    $("[data-summary-lines]").replaceChildren(
      ...result.lines.map((line) => {
        const li = document.createElement("li");
        li.className = "flex items-center gap-2.5 text-[14px]";
        li.innerHTML = '<span class="flex-1 font-medium text-fg"></span><span class="text-[13px] font-semibold text-fg-muted"></span><span class="font-bold text-fg"></span>';
        li.children[0].textContent = line.label;
        li.children[1].textContent = line.qty;
        li.children[2].textContent = formatRupiah(line.amount);
        return li;
      }),
    );
    $("[data-summary-installation]").textContent = formatRupiah(result.installation);
    $("[data-summary-discount-row]").hidden = result.discount === 0;
    $("[data-summary-discount]").textContent = `– ${formatRupiah(result.discount)}`;
    $$("[data-summary-total]", document).forEach((el) => (el.textContent = formatRupiah(result.total)));
    $("[data-summary-count]", document).textContent = `${result.lines.length} items`;
    $("[data-kiosk-row]").hidden = !config.addOns.includes("kiosk");
    const review = $("[data-review]");
    const rows: [string, string][] = [
      ["Site", `${siteTypes.find((t) => t.id === config.siteType)?.label} · ${config.siteName}, ${config.city}`],
      ["Daily visitors", config.dailyVisitors.toLocaleString("en-US")],
      ...config.entries.map((e): [string, string] => [e.name, `${e.lanes} × ${gateOptions.find((o) => o.id === e.option)?.name}`]),
      ["Add-ons", config.addOns.map((id) => addOns.find((a) => a.id === id)?.name).join(", ") || "None"],
      ["Software", config.software.length ? `${config.software.map((id) => softwareOptions.find((s) => s.id === id)?.name).join(", ")} · ${config.term} months` : "None"],
      ["Estimated budget", `${formatRupiah(result.total)} excl. PPN`],
    ];
    review.replaceChildren(
      ...rows.map(([term, value]) => {
        const div = document.createElement("div");
        div.className = "flex flex-col gap-1 rounded-md bg-surface p-4";
        div.innerHTML = '<dt class="text-[12px] font-semibold text-fg-muted uppercase tracking-[1px]"></dt><dd class="text-[15px] font-semibold text-fg"></dd>';
        div.children[0].textContent = term;
        div.children[1].textContent = value;
        return div;
      }),
    );
    $("[data-step-description='2']").textContent =
      `We pre-selected the best fit for ${/^[aeiou]/i.test(config.siteName) ? "an" : "a"} ${config.siteName.toLowerCase()} with ${config.dailyVisitors.toLocaleString("en-US")} daily visitors. Swap any option — your budget updates instantly.`;
  };

  const showStep = (index: number, focus = true) => {
    step = Math.min(stepLabels.length - 1, Math.max(0, index));
    $$("[data-step-panel]").forEach((panel) => (panel.hidden = Number(panel.dataset.stepPanel) !== step));
    const nextLabel = $("[data-mobile-next-label]", document);
    nextLabel.textContent = step < stepLabels.length - 1 ? `Next · ${stepLabels[step + 1]}` : "Request formal quotation";
    if (focus) {
      $(`#step-title-${step}`).setAttribute("tabindex", "-1");
      $<HTMLElement>(`#step-title-${step}`).focus({ preventScroll: true });
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  $$<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => showStep(Number(b.dataset.go))));
  $("[data-mobile-next]", document).addEventListener("click", () => (step < stepLabels.length - 1 ? showStep(step + 1) : requestQuote()));

  const summary = $("[data-summary]");
  const toggleSummary = $("[data-toggle-summary]", document);
  toggleSummary.addEventListener("click", () => {
    const open = summary.classList.toggle("open");
    toggleSummary.setAttribute("aria-expanded", String(open));
    if (open) summary.scrollIntoView({ behavior: "smooth" });
  });

  const update = (rerender = true) => {
    if (rerender) {
      renderEntries();
      renderLanes();
    }
    renderSummary();
    save();
  };

  // ── Hand-off: RFQ and sharing ────────────────────────────────────────────
  const requestQuote = () => {
    const result = estimate(config);
    const items = readRfqItems();
    for (const line of result.lines) {
      if (!line.product || !line.quantity) continue;
      const existing = items.find((i) => i.slug === line.product && !i.options);
      if (existing) existing.qty = Math.max(existing.qty, line.quantity);
      else items.push({ slug: line.product, qty: line.quantity });
    }
    writeRfqItems(items);
    const notes = [
      `Configured with Build Your Solution — estimated budget ${formatRupiah(result.total)} excl. PPN.`,
      ...config.entries.map((e) => `• ${e.name}: ${e.lanes} × ${gateOptions.find((o) => o.id === e.option)?.name}`),
      config.addOns.length ? `• Add-ons: ${config.addOns.map((id) => addOns.find((a) => a.id === id)?.name).join(", ")}` : "",
      config.software.length ? `• Software (${config.term} months): ${config.software.map((id) => softwareOptions.find((s) => s.id === id)?.name).join(", ")}` : "",
      `• Daily visitors: ${config.dailyVisitors.toLocaleString("en-US")}`,
    ].filter(Boolean);
    try {
      const draft = JSON.parse(localStorage.getItem(RFQ_DRAFT_KEY) ?? "{}");
      localStorage.setItem(RFQ_DRAFT_KEY, JSON.stringify({ ...draft, site_name: config.siteName, site_location: config.city, notes: notes.join("\n") }));
    } catch {
      /* ignore */
    }
    location.assign("/quote");
  };
  $$<HTMLButtonElement>("[data-request-quote]").forEach((b) => b.addEventListener("click", requestQuote));

  $("[data-share-config]").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?config=${encode(config)}&step=5`;
    const label = $("[data-share-label]");
    try {
      if (navigator.share) await navigator.share({ title: "My Entragate solution", url });
      else {
        await navigator.clipboard.writeText(url);
        label.textContent = "Link copied";
        setTimeout(() => (label.textContent = "Save & share configuration"), 1800);
      }
    } catch {
      /* share dismissed */
    }
  });

  syncStatic();
  update();
  showStep(step, false);
}
