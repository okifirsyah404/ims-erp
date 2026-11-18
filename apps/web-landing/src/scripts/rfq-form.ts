import { actions, isInputError } from "astro:actions";
import { enhanceValidation, validateForm } from "./form-validation";
import { showDemoNotice } from "./action-form";
import { indicativeQuote } from "../data/pricing";
import { projectTypes, rfqSteps } from "../data/rfq";
import { formatRupiah } from "../lib/format";
import { clearRfqItems, readRfqItems, writeRfqItems, type RfqLine } from "../lib/client/rfq-items";

type ClientProduct = { slug: string; name: string; category: string; specs: string; price: number | null; image?: string };

const DRAFT_KEY = "entragate:rfq-draft:v1";
const DRAFT_FIELDS = ["company_name", "contact_name", "email", "phone", "site_name", "site_location", "target_installation", "budget_range", "notes"];

/** Progressive enhancement for 03.02 RFQ & Pricing. Without JS the form posts all steps at once. */
export function initRfqForm() {
  const form = document.querySelector<HTMLFormElement>("[data-rfq-form]");
  if (!form) return;
  if (form) enhanceValidation(form);

  const products: ClientProduct[] = JSON.parse(document.getElementById("rfq-products")?.textContent ?? "[]");
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const list = form.querySelector<HTMLUListElement>("[data-rfq-items]")!;
  const template = document.getElementById("rfq-item-template") as HTMLTemplateElement;
  const steps = [...form.querySelectorAll<HTMLElement>("[data-step]")];
  const errorAlert = form.querySelector<HTMLElement>("[data-rfq-error]");
  let current = 1;

  // ── Items ───────────────────────────────────────────────────────────────
  const urlProduct = new URL(location.href).searchParams.get("product");
  let lines: RfqLine[] = readRfqItems().filter((l) => bySlug.has(l.slug));
  const ssrLine = list.querySelector<HTMLElement>("[data-rfq-item]");
  if (urlProduct && bySlug.has(urlProduct) && ssrLine) {
    const qty = Number(ssrLine.querySelector<HTMLInputElement>("[data-field=qty]")?.value ?? 1);
    const rawOptions = ssrLine.querySelector<HTMLInputElement>("[data-field=options]")?.value;
    const options = rawOptions ? (JSON.parse(rawOptions) as Record<string, string>) : undefined;
    const existing = lines.find((l) => l.slug === urlProduct && JSON.stringify(l.options ?? {}) === JSON.stringify(options ?? {}));
    if (existing) existing.qty = qty;
    else lines.push({ slug: urlProduct, qty, options });
    // Drop the query so a refresh doesn't re-add the product.
    history.replaceState(null, "", location.pathname);
  }

  const renderItems = () => {
    list.replaceChildren(
      ...lines.map((line, index) => {
        const product = bySlug.get(line.slug)!;
        const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
        row.dataset.rfqItem = line.slug;
        row.dataset.index = String(index);
        const set = (field: string, value: string) => {
          const el = row.querySelector<HTMLElement>(`[data-field=${field}]`);
          if (!el) return;
          if (el instanceof HTMLInputElement) el.value = value;
          else el.textContent = value;
        };
        set("slug", line.slug);
        set("options", line.options ? JSON.stringify(line.options) : "");
        set("eyebrow", `${product.category} · ${product.specs.split("·")[0]?.trim() ?? ""}`);
        set("name", product.name);
        set("price", product.price === null ? "Project pricing" : formatRupiah(product.price));
        set("unit", product.price === null ? "" : " / unit");
        set("qty", String(line.qty));
        return row;
      }),
    );
    const empty = form.querySelector<HTMLElement>("[data-items-empty]");
    if (empty) empty.hidden = lines.length > 0;
    form.querySelectorAll("[data-items-count]").forEach((el) => (el.textContent = String(lines.length)));
    writeRfqItems(lines);
    renderQuote();
  };

  list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-rfq-item]");
    if (!row) return;
    const index = Number(row.dataset.index);
    const step = target.closest<HTMLElement>("[data-qty-step]");
    if (step) {
      const next = lines[index].qty + Number(step.dataset.qtyStep);
      if (next < 1) lines.splice(index, 1);
      else lines[index].qty = Math.min(999, next);
      renderItems();
    } else if (target.closest("[data-remove-item]")) {
      lines.splice(index, 1);
      renderItems();
    }
  });
  list.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const row = input.closest<HTMLElement>("[data-rfq-item]");
    if (!row || input.dataset.field !== "qty") return;
    lines[Number(row.dataset.index)].qty = Math.min(999, Math.max(1, Math.round(Number(input.value)) || 1));
    renderItems();
  });

  // ── Indicative pricing ──────────────────────────────────────────────────
  function renderQuote() {
    const quote = indicativeQuote(lines.map((l) => ({ unitPrice: bySlug.get(l.slug)?.price ?? null, quantity: l.qty })));
    const setAll = (key: string, value: string) =>
      document.querySelectorAll(`[data-quote="${key}"]`).forEach((el) => (el.textContent = value));
    setAll("units", String(quote.units));
    setAll("list", formatRupiah(quote.listTotal));
    setAll("subtotal", formatRupiah(quote.subtotal));
    setAll(
      "discount-label",
      quote.discountRate > 0 ? `Volume discount (est. ${Math.round(quote.discountRate * 100)}%)` : "Volume discount",
    );
    setAll("discount", quote.discount > 0 ? `– ${formatRupiah(quote.discount)}` : "From 10 units");
    document.querySelectorAll<HTMLElement>('[data-quote="unpriced"]').forEach((el) => (el.hidden = quote.unpricedLines === 0));
  }

  // ── Attachments ─────────────────────────────────────────────────────────
  const fileInput = form.querySelector<HTMLInputElement>("[data-attachments]");
  const fileList = form.querySelector<HTMLElement>("[data-attachment-list]");
  const renderFiles = () => {
    if (!fileInput || !fileList) return;
    fileList.replaceChildren(
      ...[...(fileInput.files ?? [])].map((file) => {
        const li = document.createElement("li");
        li.textContent = `📎 ${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
        return li;
      }),
    );
  };
  fileInput?.addEventListener("change", renderFiles);
  const dropzone = form.querySelector<HTMLElement>("[data-dropzone]");
  dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("ring-blue-600");
  });
  dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("ring-blue-600"));
  dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("ring-blue-600");
    if (fileInput && event.dataTransfer?.files.length) {
      fileInput.files = event.dataTransfer.files;
      renderFiles();
    }
  });

  // ── Draft ───────────────────────────────────────────────────────────────
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, string>;
    for (const name of DRAFT_FIELDS) if (draft[name] && field(name)) field(name)!.value = draft[name];
    if (draft.project_type) {
      const radio = form.querySelector<HTMLInputElement>(`input[name=project_type][value="${draft.project_type}"]`);
      if (radio) radio.checked = true;
    }
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
  const saveDraft = () => {
    const data: Record<string, string> = {};
    for (const name of DRAFT_FIELDS) data[name] = field(name)?.value ?? "";
    data.project_type = (form.querySelector<HTMLInputElement>("input[name=project_type]:checked")?.value ?? "");
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  };
  form.querySelector<HTMLButtonElement>("[data-save-draft]")?.addEventListener("click", (event) => {
    saveDraft();
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = "Draft saved";
    setTimeout(() => (button.textContent = "Save draft"), 1600);
  });

  // ── Steps ───────────────────────────────────────────────────────────────
  const nextLabel = () => (current === 1 ? "Continue" : current === 2 ? "Review & send RFQ" : "Send RFQ");

  const showStep = (step: number) => {
    current = step;
    steps.forEach((el) => (el.hidden = Number(el.dataset.step) !== step));
    const state = (id: number) => (id < step ? "done" : id === step ? "active" : "upcoming");
    form.querySelectorAll<HTMLElement>("[data-step-pill]").forEach((pill) => {
      const id = Number(pill.dataset.stepPill);
      pill.dataset.state = state(id);
      (pill as HTMLButtonElement).disabled = id >= step;
      if (id === step) pill.setAttribute("aria-current", "step");
      else pill.removeAttribute("aria-current");
    });
    form.querySelectorAll<HTMLElement>("[data-step-sep]").forEach((sep) => (sep.dataset.state = state(Number(sep.dataset.stepSep))));
    form.querySelectorAll<HTMLElement>("[data-step-bar]").forEach((bar) => (bar.dataset.state = state(Number(bar.dataset.stepBar))));
    form.querySelectorAll("[data-step-caption]").forEach(
      (el) => (el.textContent = `Step ${step} of ${rfqSteps.length} · ${rfqSteps[step - 1].label}`),
    );
    form.querySelectorAll("[data-next-label]").forEach((el) => (el.textContent = nextLabel()));
    if (step === 3) renderReview();
  };

  form.querySelectorAll<HTMLButtonElement>("[data-step-pill]").forEach((pill) =>
    pill.addEventListener("click", () => {
      const id = Number(pill.dataset.stepPill);
      if (id < current) {
        showStep(id);
        form.querySelector("[data-rfq-stepper]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }),
  );

  const validateStep = (step: number): boolean => {
    for (const el of steps.filter((el) => Number(el.dataset.step) === step)) {
      if (!validateForm(el)) return false;
    }
    const solutionChosen = Boolean(form.querySelector("[data-solution-option]:checked"));
    if (step === 2 && lines.length === 0 && !solutionChosen) {
      showError("Add at least one product or choose a software solution to quote.");
      return false;
    }
    return true;
  };

  function renderReview() {
    const review = form!.querySelector<HTMLElement>("[data-review]");
    if (!review) return;
    const value = (name: string) => field(name)?.value.trim() || "—";
    const typeValue = form!.querySelector<HTMLInputElement>("input[name=project_type]:checked")?.value;
    const typeLabel = projectTypes.find((t) => t.value === typeValue)?.label ?? "—";
    const rows: [string, string][] = [
      ["Company", value("company_name")],
      ["Contact", `${value("contact_name")} · ${value("email")} · ${value("phone")}`],
      ["Site", [field("site_name")?.value.trim(), field("site_location")?.value.trim()].filter(Boolean).join(", ") || "—"],
      ["Target installation", value("target_installation")],
      ["Project type", typeLabel],
      ["Items", lines.map((l) => `${l.qty} × ${bySlug.get(l.slug)?.name}`).join(", ") || "—"],
      [
        "Software",
        [...form!.querySelectorAll<HTMLInputElement>("[data-solution-option]:checked")].map((i) => i.closest("label")?.textContent?.trim()).join(", ") || "—",
      ],
      ["Requirements", value("notes")],
      ["Attachments", fileInput?.files?.length ? `${fileInput.files.length} file(s)` : "None"],
    ];
    review.replaceChildren(
      ...rows.map(([label, text]) => {
        const wrap = document.createElement("div");
        wrap.className = "flex flex-col gap-1";
        const dt = document.createElement("dt");
        dt.className = "text-[13px] font-semibold text-fg-muted";
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.className = "font-medium text-fg";
        dd.textContent = text;
        wrap.append(dt, dd);
        return wrap;
      }),
    );
  }

  function showError(message: string) {
    if (!errorAlert) return;
    errorAlert.hidden = false;
    let desc = errorAlert.querySelector("[data-alert-desc]");
    if (!desc) {
      desc = document.createElement("p");
      desc.className = "text-[13px] leading-[1.5] text-fg-secondary";
      desc.setAttribute("data-alert-desc", "");
      errorAlert.querySelector("[data-alert-title]")?.after(desc);
    }
    desc.textContent = message;
    errorAlert.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorAlert) errorAlert.hidden = true;
    if (!validateStep(current)) return;
    if (current < 3) {
      saveDraft();
      showStep(current + 1);
      form.querySelector("[data-rfq-stepper]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const buttons = form.querySelectorAll<HTMLButtonElement>("[data-rfq-next]");
    buttons.forEach((b) => (b.disabled = true));
    form.querySelectorAll("[data-next-label]").forEach((el) => (el.textContent = "Sending…"));
    const { data, error } = await actions.rfq.submit(new FormData(form));
    buttons.forEach((b) => (b.disabled = false));
    form.querySelectorAll("[data-next-label]").forEach((el) => (el.textContent = nextLabel()));

    if (error) {
      if (isInputError(error)) {
        const [name, messages] = Object.entries(error.fields)[0] ?? [];
        const owner = name ? steps.find((s) => s.querySelector(`[name="${name}"]`)) : undefined;
        if (owner) showStep(Number(owner.dataset.step));
        showError(messages?.[0] ?? "Please check the highlighted fields.");
      } else {
        showError(error.message);
      }
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    clearRfqItems();
    const success = document.createElement("div");
    success.className = "flex w-full flex-col items-center gap-4 rounded-card bg-white px-10 py-12 text-center ring-1 ring-border ring-inset";
    success.setAttribute("role", "status");
    success.tabIndex = -1;
    const receipt = data as { reference: string; linkedToAccount?: boolean; demo?: boolean };
    success.innerHTML = `<h2 class="font-heading text-[20px] font-extrabold text-navy-900"></h2>
      <p class="max-w-[360px] text-[14px] leading-[1.55] text-fg-secondary"></p>
      <a class="inline-flex items-center justify-center rounded-md bg-blue-600 px-[22px] py-3.5 text-[15px] font-semibold text-white shadow-cta hover:bg-blue-700"></a>
      <p class="max-w-[420px] text-[13px] text-fg-muted" data-claim-note></p>`;
    success.querySelector("h2")!.textContent = receipt.demo ? "Request recorded (demo)" : "Quotation request sent";
    success.querySelector("p")!.textContent = `Reference ${receipt.reference}. Our solution engineers will reply within 1 working day.`;
    const link = success.querySelector("a")!;
    const note = success.querySelector<HTMLElement>("[data-claim-note]")!;
    if (receipt.linkedToAccount) {
      link.href = form.dataset.portalQuotations ?? "/";
      link.textContent = "View in Customer Portal";
      note.remove();
    } else {
      // Guest RFQ: linked to an account only after the portal verifies the RFQ's email.
      link.href = (form.dataset.portalClaim ?? "").replace("__REF__", encodeURIComponent(receipt.reference));
      link.textContent = "Add it to my portal account";
      note.textContent = "We'll email a verification code to the address on the request before it's linked to an account.";
    }
    showDemoNotice(success, Boolean(receipt.demo));
    form.replaceWith(success);
    success.focus();
  });

  renderItems();
  showStep(1);
}
