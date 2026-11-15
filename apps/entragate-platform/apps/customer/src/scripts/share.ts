/** `[data-share]` buttons open the native share sheet, falling back to copying the link. */
document.querySelectorAll<HTMLElement>("[data-share]").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const text = button.dataset.share || document.title;
    try {
      if (navigator.share) await navigator.share({ title: document.title, text, url: location.href });
      else await navigator.clipboard.writeText(`${text} — ${location.href}`);
    } catch {
      /* share sheet dismissed */
    }
  });
});
