/**
 * Pager dots for horizontal scrollers (mobile carousels in 01.01 and 09.01).
 * Markup: [data-carousel] > [data-carousel-track] + [data-carousel-dot]×n.
 * Active/inactive classes come from data-on / data-off on each dot.
 */
export function initCarouselDots(root: ParentNode = document) {
  for (const carousel of root.querySelectorAll<HTMLElement>("[data-carousel]")) {
    if (carousel.dataset.carouselReady) continue;
    carousel.dataset.carouselReady = "true";
    const track = carousel.querySelector<HTMLElement>("[data-carousel-track]");
    const dots = [...carousel.querySelectorAll<HTMLElement>("[data-carousel-dot]")];
    if (!track || dots.length === 0) continue;

    const update = () => {
      const items = [...track.children] as HTMLElement[];
      const left = track.scrollLeft;
      const offset = (item: HTMLElement) => Math.abs(item.offsetLeft - track.offsetLeft - left);
      let active = items.reduce((best, item, index) => (offset(item) < offset(items[best]) ? index : best), 0);
      if (left + track.clientWidth >= track.scrollWidth - 2) active = items.length - 1;
      dots.forEach((dot, index) => {
        const on = index === active;
        (dot.dataset.on ?? "").split(" ").forEach((c) => c && dot.classList.toggle(c, on));
        (dot.dataset.off ?? "").split(" ").forEach((c) => c && dot.classList.toggle(c, !on));
      });
    };

    track.addEventListener("scroll", update, { passive: true });
  }
}
