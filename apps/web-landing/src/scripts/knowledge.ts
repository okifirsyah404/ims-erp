/**
 * Knowledge Center search helpers: ⌘K / Ctrl+K focuses the search field, and wide screens
 * get the longer example placeholder from the desktop frames.
 */
export function initKnowledgeSearchShortcut() {
  const input = document.querySelector<HTMLInputElement>("[data-kbd-search]");
  if (!input) return;
  const desktop = window.matchMedia("(min-width: 80rem)");
  const short = input.placeholder;
  const applyPlaceholder = () => (input.placeholder = desktop.matches ? (input.dataset.desktopPlaceholder ?? short) : short);
  applyPlaceholder();
  desktop.addEventListener("change", applyPlaceholder);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}
