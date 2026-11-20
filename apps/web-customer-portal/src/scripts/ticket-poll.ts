/**
 * Ticket thread refresh (ERP-0092): polls `/support/:id/thread.json` while the page is
 * visible. On a change the page reloads when nothing is being typed; otherwise a
 * "new messages" button appears so the draft is never lost.
 */
const root = document.querySelector<HTMLElement>("[data-ticket-poll]");
const INTERVAL_MS = 15_000;

if (root) {
  const url = `/support/${encodeURIComponent(root.dataset.ticketPoll ?? "")}/thread.json`;
  const seen = `${root.dataset.messages}|${root.dataset.status}|${root.dataset.canConfirm}`;
  const banner = document.querySelector<HTMLElement>("[data-ticket-news]");

  const drafting = () =>
    [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("form input:not([type=hidden]), form textarea")].some(
      (field) => field.value.trim().length > 0,
    );

  const check = async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      const state = (await response.json()) as { messages: number; status: string; canConfirm: boolean };
      if (`${state.messages}|${state.status}|${state.canConfirm}` === seen) return;
      if (!drafting()) {
        location.replace(`${location.pathname}${location.search}#latest`);
        location.reload();
      } else if (banner) {
        banner.hidden = false;
      }
    } catch {
      // Offline or the session ended: the next page load handles it.
    }
  };

  setInterval(check, INTERVAL_MS);
  document.addEventListener("visibilitychange", () => void check());
  banner?.addEventListener("click", () => location.reload());
}
