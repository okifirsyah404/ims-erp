/** Back links (`a[data-back]`) prefer history.back() when the previous page is ours; `href` is the fallback. */
document.querySelectorAll<HTMLAnchorElement>("a[data-back]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const ref = document.referrer && new URL(document.referrer);
    if (ref && ref.origin === location.origin && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  });
});
