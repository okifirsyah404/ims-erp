/**
 * Software Showcase (01.01) interaction.
 *
 * `scroll` mode (desktop): when the viewport is tall enough to show the whole section,
 * the track grows by one "stage" of scroll per software item and the content pins with
 * CSS sticky. The active item is derived from scroll progress only — native scrolling,
 * no wheel handling — so scrolling up reverses the sequence and the section releases
 * after the last stage. Clicking an item scrolls to the middle of its stage.
 *
 * `tap` mode (mobile/tablet, or short desktop viewports): the first tap on an item
 * activates it, a tap on the active item follows its link.
 */

const HEADER_HEIGHT = 75;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setActive(root: HTMLElement, index: number) {
  if (Number(root.dataset.activeIndex ?? 0) === index) return;
  root.dataset.activeIndex = String(index);
  root.querySelectorAll<HTMLElement>("[data-software-item]").forEach((item) => {
    const on = Number(item.dataset.softwareItem) === index;
    item.toggleAttribute("data-active", on);
    if (on) item.setAttribute("aria-current", "true");
    else item.removeAttribute("aria-current");
  });
  root.querySelectorAll<HTMLElement>("[data-software-panel]").forEach((panel) => {
    panel.toggleAttribute("data-hidden", Number(panel.dataset.softwarePanel) !== index);
  });
}

function initScrollMode(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>("[data-software-track]");
  const pin = root.querySelector<HTMLElement>("[data-software-pin]");
  const content = root.querySelector<HTMLElement>("[data-software-content]");
  const items = [...root.querySelectorAll<HTMLAnchorElement>("[data-software-item]")];
  if (!track || !pin || !content || items.length === 0) return;
  const stages = items.length;
  let pinned = false;
  let stage = 0;
  let frame = 0;

  const pinHeight = () => window.innerHeight - HEADER_HEIGHT;

  const layout = () => {
    const visible = root.offsetParent !== null;
    // Measure the content without its section padding (removed while pinned).
    const style = getComputedStyle(content);
    const padding = pinned ? 0 : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const needed = content.offsetHeight - padding + 48;
    const shouldPin = visible && pinHeight() >= needed;
    pinned = shouldPin;
    pin.toggleAttribute("data-pinned", pinned);
    if (pinned) {
      stage = Math.max(320, Math.round(window.innerHeight * 0.55));
      track.style.height = `${pinHeight() + stage * (stages - 1)}px`;
    } else {
      track.style.height = "";
    }
    update();
  };

  const range = () => track.offsetHeight - pinHeight();
  const trackTop = () => track.getBoundingClientRect().top + window.scrollY;

  const update = () => {
    frame = 0;
    if (!pinned) return;
    const progress = Math.min(1, Math.max(0, (window.scrollY + HEADER_HEIGHT - trackTop()) / range()));
    setActive(root, Math.min(stages - 1, Math.floor(progress * stages)));
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  items.forEach((item, index) => {
    item.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      if (item.hasAttribute("data-active")) return; // second click opens the solution page
      event.preventDefault();
      if (pinned) {
        const top = trackTop() - HEADER_HEIGHT + ((index + 0.5) / stages) * range();
        window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
      }
      setActive(root, index);
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => requestAnimationFrame(layout));
  layout();
}

function initTapMode(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>("[data-software-item]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || item.hasAttribute("data-active")) return;
      event.preventDefault();
      setActive(root, Number(item.dataset.softwareItem));
    });
  });
}

export function initSoftwareShowcase() {
  document.querySelectorAll<HTMLElement>("[data-software]").forEach((root) => {
    if (root.dataset.softwareReady) return;
    root.dataset.softwareReady = "1";
    if (root.dataset.software === "scroll") initScrollMode(root);
    else initTapMode(root);
  });
}
