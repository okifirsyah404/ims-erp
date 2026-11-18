/**
 * Site-wide progressive enhancements for the public website (loaded once by PublicLayout):
 * scroll reveal, wishlist hearts, add-to-cart feedback, toasts and back-to-top.
 * Everything degrades to plain HTML without JavaScript.
 */
import { addToCart } from "../lib/client/cart";
import { isWishlisted, toggleWishlist } from "../lib/client/wishlist";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ── Scroll reveal ───────────────────────────────────────────────────────── */
let revealObserver: IntersectionObserver | undefined;

/** Observes `[data-reveal]` elements under `root` (call again after swapping HTML in). */
export function observeReveal(root: ParentNode = document) {
  const targets = [...root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])")];
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.setAttribute("data-revealed", ""));
    return;
  }
  revealObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "");
        revealObserver!.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const el of targets) {
    // Stagger siblings in the same list (max 5 steps) so grids cascade gently.
    const siblings = el.parentElement?.parentElement?.querySelectorAll(":scope > * > [data-reveal]");
    const index = siblings ? [...siblings].indexOf(el) : -1;
    if (index > 0) el.style.setProperty("--reveal-index", String(index % 6));
    revealObserver.observe(el);
  }
}

/* ── Toasts ──────────────────────────────────────────────────────────────── */
export function toast(message: string, options: { tone?: "success" | "info" | "danger"; action?: { label: string; href: string } } = {}) {
  const region = document.querySelector<HTMLElement>("[data-toast-region]");
  if (!region) return;
  const item = document.createElement("div");
  item.setAttribute("role", options.tone === "danger" ? "alert" : "status");
  item.className =
    "pointer-events-auto flex items-center gap-3 rounded-md bg-navy-900 px-4 py-3 text-[14px] font-medium text-white shadow-[0_12px_32px_#0A1A3F40] transition-[opacity,transform] duration-200 starting:translate-y-2 starting:opacity-0";
  const dot = document.createElement("span");
  dot.className = `size-2 shrink-0 rounded-full ${options.tone === "danger" ? "bg-danger" : options.tone === "info" ? "bg-cyan-400" : "bg-success"}`;
  const text = document.createElement("span");
  text.className = "flex-1";
  text.textContent = message;
  item.append(dot, text);
  if (options.action) {
    const link = document.createElement("a");
    link.href = options.action.href;
    link.className = "font-semibold text-cyan-400 hover:underline";
    link.textContent = options.action.label;
    item.append(link);
  }
  region.append(item);
  window.setTimeout(() => {
    item.style.opacity = "0";
    window.setTimeout(() => item.remove(), 250);
  }, 3800);
}

/* ── Wishlist hearts ([data-wishlist]) ───────────────────────────────────── */
export function syncWishlist(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>("[data-wishlist]").forEach((button) => {
    button.setAttribute("aria-pressed", String(isWishlisted(button.dataset.wishlist!)));
  });
}

function initDelegatedControls() {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const heart = target.closest<HTMLButtonElement>("[data-wishlist]");
    if (heart && !heart.hasAttribute("data-wishlist-local")) {
      const saved = toggleWishlist(heart.dataset.wishlist!);
      document.querySelectorAll<HTMLButtonElement>(`[data-wishlist="${CSS.escape(heart.dataset.wishlist!)}"]`).forEach((b) => b.setAttribute("aria-pressed", String(saved)));
      toast(saved ? "Saved to your wishlist on this device" : "Removed from your wishlist", { tone: "info" });
      return;
    }

    const add = target.closest<HTMLElement>("[data-add-to-cart]");
    if (add && !add.closest("form[data-buy-box]")) {
      addToCart(add.dataset.addToCart!, 1);
      toast(`${add.dataset.productName ?? "Product"} added to cart`, { action: { label: "View cart", href: "/cart" } });
    }
  });
}

/* ── Back to top ─────────────────────────────────────────────────────────── */
function initBackToTop() {
  const button = document.querySelector<HTMLButtonElement>("[data-back-to-top]");
  if (!button) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const longPage = document.documentElement.scrollHeight > window.innerHeight * 3;
    button.hidden = !(longPage && window.scrollY > window.innerHeight * 1.5);
  };
  window.addEventListener("scroll", () => (frame ||= requestAnimationFrame(update)), { passive: true });
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
    document.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
  });
  update();
}

document.documentElement.classList.add("motion-ready");
observeReveal();
syncWishlist();
initDelegatedControls();
initBackToTop();
window.addEventListener("storage", () => syncWishlist());
