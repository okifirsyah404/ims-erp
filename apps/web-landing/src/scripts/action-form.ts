import { actions, isInputError } from "astro:actions";
import { enhanceValidation, validateForm } from "./form-validation";

/**
 * Progressive enhancement for `<form data-action-form="group.name">` posting to an Astro
 * Action. Without JS the form posts normally and the page renders the result server-side.
 * With JS: inline field errors (`[data-error-for=field]`), a busy button, and on success the
 * `[data-success]` panel replaces the form (`[data-success-ref]` receives the reference).
 */
type ActionFn = (input: FormData) => Promise<{ data?: unknown; error?: unknown }>;

export function initActionForms(root: ParentNode = document) {
  root.querySelectorAll<HTMLFormElement>("form[data-action-form]").forEach((form) => {
    const [group, name] = (form.dataset.actionForm ?? "").split(".");
    const action = (actions as unknown as Record<string, Record<string, ActionFn>>)[group]?.[name];
    if (!action) return;
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    const alert = form.querySelector<HTMLElement>("[data-form-error]");
    const success = document.getElementById(form.dataset.successTarget ?? "");
    enhanceValidation(form);

    const clearErrors = () => {
      form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
        el.textContent = "";
        el.hidden = true;
      });
      form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
      if (alert) alert.hidden = true;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors();
      if (!validateForm(form)) return;
      const label = submit?.querySelector("[data-label]");
      const idle = label?.textContent;
      if (submit) {
        submit.disabled = true;
        submit.setAttribute("aria-busy", "true");
      }
      if (label) label.textContent = submit?.dataset.busyLabel ?? "Sending…";

      const { data, error } = await action(new FormData(form));

      if (submit) {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
      }
      if (label && idle) label.textContent = idle;

      if (error) {
        if (isInputError(error)) {
          let first: HTMLElement | null = null;
          for (const [field, messages] of Object.entries(error.fields)) {
            const slot = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
            const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
            if (slot && messages?.[0]) {
              slot.textContent = messages[0];
              slot.hidden = false;
            }
            input?.setAttribute("aria-invalid", "true");
            first ??= input;
          }
          first?.focus();
          if (!first && alert) showAlert(alert, "Please check the highlighted fields.");
        } else if (alert) {
          showAlert(alert, (error as Error).message);
        }
        return;
      }

      const { reference, demo } = (data ?? {}) as { reference?: string; demo?: boolean };
      if (success) {
        success.querySelectorAll("[data-success-ref]").forEach((el) => (el.textContent = reference ?? ""));
        showDemoNotice(success, Boolean(demo));
        success.hidden = false;
        form.hidden = true;
        form.reset();
        success.focus();
      }
      form.dispatchEvent(new CustomEvent("action-success", { detail: data }));
    });
  });
}

function showAlert(alert: HTMLElement, message: string) {
  const text = alert.querySelector("[data-alert-desc]") ?? alert.querySelector("[data-alert-title]");
  if (text) text.textContent = message;
  alert.hidden = false;
  alert.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** Demo mode accepts submissions locally — say so instead of implying they were sent. */
export function showDemoNotice(panel: HTMLElement, demo: boolean) {
  panel.querySelector("[data-demo-notice]")?.remove();
  if (!demo) return;
  const note = document.createElement("p");
  note.dataset.demoNotice = "";
  note.className = "rounded-md bg-warning-bg px-3 py-2 text-[13px] font-semibold text-warning";
  note.textContent = "Demo mode — nothing was sent to Entragate. This reference is a sample.";
  panel.append(note);
}
