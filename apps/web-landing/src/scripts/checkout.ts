import { actions, isInputError } from "astro:actions";
import { type DeliveryMethod, type OrderQuote, type PaymentStatus } from "@/api/website";
import { enhanceValidation, validateForm } from "./form-validation";
import { showDemoNotice } from "./action-form";
import { computeTotals } from "../data/checkout";
import { getCart, replaceCart, type CartLine } from "../lib/client/cart";
import { formatRupiah } from "../lib/format";

type Product = { slug: string; name: string; category: string; specs: string; price: number | null; stock: string; image?: string };
type Data = { catalog: Product[]; steps: string[]; demo: boolean; delivery: { value: DeliveryMethod; label: string }[] };
type Confirmation = {
  orderNumber: string;
  total: number;
  paymentStatus: string;
  paymentUrl?: string;
  paymentInstruction?: { label: string; value: string };
  demo?: boolean;
};

const KEY_STORAGE = "entragate:checkout-key";
const MERGED_PREFIX = "entragate:cart-merged:";
const LAST_ORDER = "entragate:last-order";

/**
 * 03.03 Checkout behaviour.
 *
 * Guests: cart summary with estimated totals and the sign-in gate (no order can be placed).
 * Customers: account-cart sync (merge once after sign-in, then replace), the 6-step wizard,
 * a server-validated review quote, idempotent order placement and payment status polling.
 */
export function initCheckout() {
  const data: Data = JSON.parse(document.getElementById("checkout-data")?.textContent ?? "{}");
  const form = document.querySelector<HTMLFormElement>("[data-checkout-form]");
  if (!form) return;
  const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
  const catalog = new Map(data.catalog.map((p) => [p.slug, p]));
  const isCustomer = form.dataset.mode === "customer";
  // ERP-0078: every catalog product goes into the order; one without an online price (or out
  // of stock) is a "price on request" line that sales prices in the same quotation.
  const purchasable = (cart: CartLine[]) => cart.filter((l) => catalog.has(l.slug));

  let lines = purchasable(getCart());
  const returning = new URL(location.href).searchParams.get("order");

  if (isCustomer && returning) {
    // Back from a hosted payment page: show the status of that order.
    form.hidden = true;
    showStatus({ orderNumber: returning, total: 0, paymentStatus: "awaiting_payment" }, true);
    return;
  }
  if (lines.length === 0 && !isCustomer) {
    $("[data-checkout-empty]")!.hidden = false;
    return;
  }

  // ── Summary (estimate from catalog prices; the server re-prices at review) ──
  let promo: { code: string; discount: number; label: string } | null = null;
  let quote: OrderQuote | null = null;
  const subtotal = () => lines.reduce((sum, l) => sum + (catalog.get(l.slug)?.price ?? 0) * l.qty, 0);
  const set = (key: string, value: string) => form.querySelectorAll(`[data-${key}]`).forEach((el) => (el.textContent = value));

  const renderLines = () => {
    $("[data-summary-lines]", form)!.replaceChildren(
      ...lines.map((line) => {
        const p = catalog.get(line.slug)!;
        const priced = quote?.lines.find((q) => q.productSlug === line.slug);
        const li = document.createElement("li");
        li.className = "flex items-center gap-3";
        li.innerHTML = `<span class="size-[60px] shrink-0 overflow-hidden rounded-md bg-surface"></span><span class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-[14.5px] font-bold text-fg"></span><span class="text-[12.5px] text-fg-muted"></span></span><span class="text-[14px] font-bold text-fg"></span>`;
        if (p.image) {
          const img = document.createElement("img");
          img.src = p.image;
          img.alt = "";
          img.className = "size-full object-cover";
          li.firstElementChild!.append(img);
        }
        const [, text, price] = li.children;
        text.children[0]!.textContent = p.name;
        text.children[1]!.textContent = `Ready stock · Qty ${line.qty}`;
        price!.textContent = formatRupiah(priced ? priced.lineTotal : p.price! * line.qty);
        return li;
      }),
    );
    set("units", String(lines.reduce((n, l) => n + l.qty, 0)));
  };

  const value = <T extends string>(name: string, fallback: T) => ((form.elements.namedItem(name) as RadioNodeList | null)?.value as T) || fallback;
  const checked = (name: string, fallback: boolean) => (form.elements.namedItem(name) as HTMLInputElement | null)?.checked ?? fallback;

  const renderTotals = () => {
    const delivery = value<DeliveryMethod>("delivery", "standard");
    const installation = checked("installation", false);
    const totals = quote ?? computeTotals({ subtotal: subtotal(), discount: promo?.discount, delivery, installation });
    set("subtotal", formatRupiah(totals.subtotal));
    set("shipping", totals.shipping ? formatRupiah(totals.shipping) : "Free");
    set("delivery-label", data.delivery.find((d) => d.value === delivery)?.label.split(" ")[0] ?? "");
    set("installation", formatRupiah(totals.installation));
    set("tax", formatRupiah(totals.tax));
    set("total", formatRupiah(totals.total));
    set("total-mobile", formatRupiah(totals.total));
    set("total-note", quote ? "Confirmed by Entragate" : "Estimate · confirmed at review");
    set("total-note-mobile", quote ? "Total incl. PPN" : "Estimated total incl. PPN");
    $("[data-installation-row]", form)!.hidden = !totals.installation;
    const discount = totals.discount;
    $("[data-discount-row]", form)!.hidden = !discount;
    if (discount) {
      set("discount-label", (quote?.discountLabel ?? promo?.label) || "Discount");
      set("discount", `– ${formatRupiah(discount)}`);
    }
  };

  form.hidden = false;
  renderLines();
  renderTotals();
  if (!isCustomer) return; // guests: summary + sign-in gate only

  enhanceValidation(form);
  const errorAlert = $("[data-form-error]", form)!;
  const showError = (title: string, message: string, link?: { href: string; label: string }) => {
    $("[data-alert-title]", errorAlert)!.textContent = title;
    let desc = $("[data-alert-desc]", errorAlert);
    if (!desc) {
      desc = document.createElement("p");
      desc.className = "text-[13px] leading-[1.5] text-fg-secondary";
      desc.dataset.alertDesc = "";
      $("[data-alert-title]", errorAlert)!.after(desc);
    }
    desc.textContent = message;
    if (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.className = "ml-1 font-semibold text-blue-600 underline";
      a.textContent = link.label;
      desc.append(" ", a);
    }
    errorAlert.hidden = false;
    errorAlert.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const clearError = () => (errorAlert.hidden = true);

  // ── Account cart: merge the guest cart once after sign-in, then keep it in sync ──
  const customerId = form.dataset.customerId ?? "";
  const mergedFlag = `${MERGED_PREFIX}${customerId}`;
  const syncCart = async () => {
    const mode = sessionStorage.getItem(mergedFlag) ? "replace" : "merge";
    const local = getCart().map(({ slug, qty, options }) => ({ slug, qty, options }));
    const { data: merged, error } = await actions.cart.sync({ mode, lines: local });
    if (error) {
      console.warn("[checkout] cart sync failed", error.message);
      return;
    }
    sessionStorage.setItem(mergedFlag, "1");
    replaceCart(merged);
    lines = purchasable(getCart());
    if (lines.length === 0) {
      form.hidden = true;
      $("[data-checkout-empty]")!.hidden = false;
      return;
    }
    form.hidden = false;
    renderLines();
    renderTotals();
  };
  void syncCart();
  if (lines.length === 0) {
    // Cart may come from the account; syncCart reveals it or shows the empty state.
    form.hidden = true;
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  const steps = $$("[data-step]", form);
  const nextButtons = $$<HTMLButtonElement>("[data-wizard-next]", form);
  const backButtons = $$<HTMLButtonElement>("[data-wizard-back]", form);
  let current = 1;
  const show = (step: number) => {
    current = step;
    steps.forEach((el) => (el.hidden = Number(el.dataset.step) !== step));
    $$("[data-stepper]").forEach((el) => (el.hidden = Number(el.dataset.stepper) !== step));
    backButtons.forEach((b) => (b.hidden = step === 1));
    nextButtons.forEach((b) => ($("[data-label]", b)!.textContent = step === 5 ? "Place order & pay" : step === 4 ? "Review order" : "Continue"));
    clearError();
  };
  backButtons.forEach((b) => b.addEventListener("click", () => {
    if (current === 5) quote = null; // leaving review discards the server quote
    renderTotals();
    show(Math.max(1, current - 1));
    $("[data-checkout-head]")?.scrollIntoView({ behavior: "smooth" });
  }));
  // Any change to what's being bought invalidates a pending review.
  form.addEventListener("change", (event) => {
    if ((event.target as HTMLInputElement).name !== "terms" && current < 5) quote = null;
    renderTotals();
  });

  const setBusy = (busy: boolean, label?: string) =>
    nextButtons.forEach((b) => {
      b.disabled = busy;
      b.toggleAttribute("aria-busy", busy);
      if (label) $("[data-label]", b)!.textContent = label;
    });

  const orderBody = () => {
    const body = new FormData(form);
    if (promo) body.set("promo", promo.code);
    else body.delete("promo");
    for (const line of lines) {
      body.append("item", line.slug);
      body.append("qty", String(line.qty));
      body.append("item_options", line.options ? JSON.stringify(line.options) : "");
    }
    return body;
  };

  const fieldStep = (field: string) => {
    const owner = steps.find((s) => s.querySelector(`[name="${field}"]`));
    return owner ? Number(owner.dataset.step) : undefined;
  };
  const handleError = (error: { code?: string; message: string } & object) => {
    if (isInputError(error)) {
      const [field, messages] = Object.entries(error.fields)[0] ?? [];
      const step = field ? fieldStep(field) : undefined;
      if (step) show(step);
      const slot = field ? form.querySelector<HTMLElement>(`[data-error-for="${field}"]`) : null;
      if (slot && messages?.[0]) {
        slot.textContent = messages[0];
        slot.hidden = false;
        form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
        return;
      }
    }
    if (error.code === "UNAUTHORIZED") {
      // Session ended: offer a manual sign-in (never an automatic redirect → no loops).
      showError("Your session has ended", "Sign in again to continue — your cart is still here.", { href: `/auth/login?next=${encodeURIComponent("/checkout")}`, label: "Sign in" });
      return;
    }
    showError("We couldn't continue", error.message);
  };

  // Step 4 → 5: ask the server for the authoritative quote.
  const review = async () => {
    show(5);
    const loading = $("[data-review-loading]", form)!;
    loading.hidden = false;
    $("[data-review-lines]", form)!.replaceChildren();
    $("[data-review-details]", form)!.replaceChildren();
    setBusy(true, "Checking prices…");
    const { data: result, error } = await actions.checkout.review(orderBody());
    loading.hidden = true;
    setBusy(false, "Place order & pay");
    if (error) {
      handleError(error);
      return false;
    }
    quote = result;
    if (!sessionStorage.getItem(KEY_STORAGE)) sessionStorage.setItem(KEY_STORAGE, crypto.randomUUID());
    renderReview();
    renderLines();
    renderTotals();
    return true;
  };

  const renderReview = () => {
    if (!quote) return;
    const list = $("[data-review-lines]", form)!;
    list.replaceChildren(
      ...quote.lines.map((line) => {
        const p = catalog.get(line.productSlug);
        const li = document.createElement("li");
        li.className = "flex items-center justify-between gap-3 px-4 py-3 text-[14px]";
        const name = document.createElement("span");
        name.className = "flex min-w-0 flex-col";
        const strong = document.createElement("span");
        strong.className = "font-semibold text-fg";
        strong.textContent = `${line.quantity} × ${p?.name ?? line.productSlug}`;
        const meta = document.createElement("span");
        meta.className = !line.available ? "text-[12.5px] font-semibold text-danger" : line.priceOnRequest ? "text-[12.5px] font-semibold text-warning" : "text-[12.5px] text-fg-muted";
        meta.textContent = !line.available ? (line.note ?? "Not available") : line.priceOnRequest ? "Price on request — included in your quotation" : `${formatRupiah(line.unitPrice)} each`;
        name.append(strong, meta);
        const total = document.createElement("span");
        total.className = "font-bold text-fg";
        total.textContent = formatRupiah(line.lineTotal);
        li.append(name, total);
        return li;
      }),
    );
    const payment = form.querySelector<HTMLInputElement>("input[name=payment]:checked");
    const detail = (label: string, value: string) => {
      const div = document.createElement("div");
      div.className = "flex flex-col gap-0.5";
      const dt = document.createElement("dt");
      dt.className = "text-[12.5px] font-semibold text-fg-muted";
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.className = "font-medium text-fg";
      dd.textContent = value;
      div.append(dt, dd);
      return div;
    };
    const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "";
    $("[data-review-details]", form)!.replaceChildren(
      detail("Customer", `${field("name")} · ${field("email")} · ${field("phone")}`),
      detail("Ship to", `${field("recipient")} · ${field("address")}, ${field("city")} ${field("postal_code")}`),
      detail("Delivery", `${data.delivery.find((d) => d.value === value("delivery", "standard"))?.label}${checked("installation", false) ? " + installation" : ""}`),
      detail("Payment", payment?.dataset.paymentLabel ?? ""),
    );
    $("[data-review-demo]", form)!.hidden = !data.demo;
    if (quote.lines.some((l) => !l.available)) {
      showError("Some items can't be ordered online", "Remove them from your cart or request a quotation for them.", { href: "/cart", label: "Edit cart" });
      nextButtons.forEach((b) => (b.disabled = true));
    }
  };

  // Step 5: place the order (idempotent; the key survives retries and reloads of this tab).
  let placing = false;
  const place = async () => {
    if (placing || !quote) return;
    placing = true;
    setBusy(true, "Placing order…");
    const body = orderBody();
    body.set("quote_id", quote.quoteId);
    body.set("idempotency_key", sessionStorage.getItem(KEY_STORAGE) ?? crypto.randomUUID());
    const { data: order, error } = await actions.checkout.placeOrder(body);
    placing = false;
    setBusy(false, "Place order & pay");
    if (error) {
      if (error.code === "CONFLICT") {
        // Prices/stock changed or the review expired — refresh the quote and ask again.
        const message = error.message;
        if (await review()) showError("Please review again", message);
        return;
      }
      handleError(error);
      return;
    }
    sessionStorage.removeItem(KEY_STORAGE);
    sessionStorage.setItem(LAST_ORDER, order.orderNumber);
    // Purchased lines leave the device cart too (the account cart was updated server-side).
    replaceCart(getCart().filter((l) => !lines.some((p) => p.slug === l.slug && JSON.stringify(p.options ?? {}) === JSON.stringify(l.options ?? {}))));
    form.hidden = true;
    showStatus(order as Confirmation, false);
    // Hosted payment page (cards, QRIS) — validated as https by the API client.
    if ((order as Confirmation).paymentUrl?.startsWith("https://")) location.assign((order as Confirmation).paymentUrl!);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const section = steps.find((s) => Number(s.dataset.step) === current);
    if (section && !validateForm(section)) return;
    if (current < 4) return show(current + 1);
    if (current === 4) return void review();
    if (current === 5) return void place();
  });

  // ── Promo (estimate; validated again by the server at review) ────────────
  const promoInput = form.elements.namedItem("promo") as HTMLInputElement | null;
  const promoStatus = $("[data-promo-status]", form);
  $("[data-apply-promo]", form)?.addEventListener("click", async () => {
    const code = promoInput?.value.trim();
    if (!code || !promoStatus) return;
    const { data: result, error } = await actions.checkout.applyPromo({ code, subtotal: subtotal() });
    promo = error ? null : result;
    quote = null;
    promoStatus.hidden = false;
    promoStatus.className = `text-[12.5px] font-semibold ${promo ? "text-success" : "text-danger"}`;
    promoStatus.textContent = error ? error.message : promo ? `${promo.code} applied` : "That code isn't valid";
    if (!promo && promoInput) promoInput.value = "";
    renderTotals();
  });

  // ── Payment list (mobile shows the selected method until expanded) ───────
  const paymentSection = $("[data-payment]", form);
  const showPayments = $("[data-show-payments]", form);
  showPayments?.addEventListener("click", () => {
    const open = paymentSection!.classList.toggle("payments-open");
    showPayments.setAttribute("aria-expanded", String(open));
    showPayments.textContent = open ? "Show less" : "All methods";
  });

  // ── Faktur Pajak → NPWP ──────────────────────────────────────────────────
  const npwp = form.elements.namedItem("npwp") as HTMLInputElement | null;
  $("[data-tax-toggle]", form)?.addEventListener("change", (event) => {
    const on = (event.currentTarget as HTMLInputElement).checked;
    if (!npwp) return;
    npwp.closest<HTMLElement>("div")!.classList.toggle("hidden", !on);
    npwp.disabled = !on;
    npwp.required = on;
    if (on) npwp.focus();
  });

  show(1);
  if (form.hasAttribute("data-signed-in")) history.replaceState(null, "", "/checkout");
}

/** Step 6 · Payment status. Polls the server; demo mode never reports a payment as made. */
function showStatus(order: Confirmation, refreshFirst: boolean) {
  const done = document.querySelector<HTMLElement>("[data-checkout-done]")!;
  const $ = (s: string) => done.querySelector<HTMLElement>(s)!;
  document.querySelectorAll<HTMLElement>("[data-stepper]").forEach((el) => (el.hidden = el.dataset.stepper !== "6"));
  const title = document.querySelector<HTMLElement>("[data-checkout-title]");
  if (title) title.textContent = order.demo ? "Demo order — not placed" : "Order placed";
  $("[data-done-number]").textContent = order.orderNumber;
  $("[data-done-email]").textContent = (document.querySelector<HTMLInputElement>("[name=email]")?.value || "your account email").trim();

  const render = (status: Pick<PaymentStatus, "status" | "statusLabel" | "total" | "paymentInstruction" | "paymentUrl">) => {
    const paid = status.status === "paid";
    const bad = status.status === "failed" || status.status === "expired" || status.status === "cancelled";
    $("[data-done-title]").textContent = order.demo
      ? "Sample order — no payment created"
      : paid
        ? "Payment received — thank you!"
        : bad
          ? "Payment not completed"
          : "Order placed — complete your payment";
    if (order.demo) $("[data-done-sentence]").textContent = "is a demo sample — nothing was emailed, reserved or charged.";
    $("[data-done-icon-ok]").classList.toggle("hidden", !paid);
    $("[data-done-icon-ok]").classList.toggle("flex", paid);
    $("[data-done-icon-wait]").classList.toggle("hidden", paid);
    $("[data-done-icon-wait]").classList.toggle("flex", !paid);
    if (status.total) $("[data-done-total]").textContent = formatRupiah(status.total);
    $("[data-done-status-label]").textContent = status.statusLabel;
    $("[data-done-status-chip]").className = `flex items-center gap-1.5 rounded-pill px-2.5 py-[5px] text-[12px] font-semibold ${paid ? "bg-success-bg text-success" : bad ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"}`;
    $("[data-done-status]").textContent =
      status.status === "pending_approval"
        ? "Your NET 14 invoice is pending credit approval — our finance team will confirm within 1 working day."
        : paid
          ? "We'll send a receipt and tracking updates by email."
          : bad
            ? "No payment was taken. You can place the order again from your cart."
            : "Complete payment within 24 hours to reserve stock. This page updates when the payment is confirmed.";
    const instruction = status.paymentInstruction;
    $("[data-done-instruction]").hidden = !instruction || paid;
    if (instruction) {
      $("[data-done-instruction-label]").textContent = instruction.label;
      $("[data-done-instruction-value]").textContent = instruction.value;
    }
    const pay = done.querySelector<HTMLAnchorElement>("[data-done-pay]")!;
    pay.hidden = !(status.paymentUrl?.startsWith("https://") && !paid && !bad);
    if (!pay.hidden) pay.href = status.paymentUrl!;
  };
  render({ status: order.paymentStatus as PaymentStatus["status"], statusLabel: order.paymentStatus === "pending_approval" ? "Awaiting credit approval" : "Awaiting payment", total: order.total, paymentInstruction: order.paymentInstruction, paymentUrl: order.paymentUrl });
  showDemoNotice(done.querySelector<HTMLElement>("[data-done-status]")!.parentElement!, Boolean(order.demo));

  done.querySelector("[data-copy-instruction]")?.addEventListener("click", () =>
    navigator.clipboard?.writeText(($("[data-done-instruction-value]").textContent ?? "").replace(/\s/g, "")),
  );
  let polls = 0;
  let timer = 0;
  const refresh = async () => {
    window.clearTimeout(timer);
    const { data: status, error } = await actions.checkout.paymentStatus({ orderNumber: order.orderNumber });
    if (error) {
      $("[data-done-status]").textContent = error.code === "UNAUTHORIZED" ? "Sign in again to see the payment status." : error.message;
      return;
    }
    render(status);
    if (status.status === "awaiting_payment" && ++polls < 8) timer = window.setTimeout(refresh, 15_000);
  };
  done.querySelector("[data-refresh-status]")?.addEventListener("click", () => void refresh());
  done.hidden = false;
  done.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (refreshFirst) void refresh();
  else timer = window.setTimeout(refresh, 15_000);
}
