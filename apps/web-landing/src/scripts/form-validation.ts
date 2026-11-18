import { isIndonesianPhone } from "../lib/phone";

/**
 * Inline client-side validation for the public forms (contact, demo, RFQ, checkout,
 * tracking). Uses the native constraint API plus Indonesian phone rules, writes messages
 * into `[data-error-for=<name>]` (FormField's error slot) and marks fields aria-invalid.
 * The server re-validates everything; this is only for fast, accessible feedback.
 */

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const labelFor = (field: Field) => {
  const label = field.id ? field.form?.querySelector(`label[for="${CSS.escape(field.id)}"]`) : field.closest("label");
  return (label?.textContent ?? field.name).replace(/\*|\(optional\)/g, "").trim();
};

function messageFor(field: Field): string | null {
  if (field.disabled || field.closest("[hidden]") || field.type === "hidden") return null;
  const value = field.value.trim();
  if (field instanceof HTMLInputElement && field.type === "tel" && value) {
    const mobile = field.dataset.phone === "mobile";
    if (!isIndonesianPhone(value, { mobile })) {
      return mobile ? "Enter a WhatsApp mobile number, e.g. 0812 3456 7890" : "Enter a valid Indonesian number, e.g. 0812 3456 7890";
    }
  }
  const v = field.validity;
  if (v.valid) return null;
  if (v.valueMissing) {
    if (field instanceof HTMLInputElement && field.type === "checkbox") return field.dataset.requiredMessage ?? "Please tick this box to continue";
    if (field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && field.type === "radio")) return `Choose ${labelFor(field).toLowerCase()}`;
    const label = labelFor(field);
    return label.endsWith("?") || label.length > 32 ? "Please fill in this field" : `${label} is required`;
  }
  if (v.typeMismatch && field.type === "email") return "Enter a valid email address, e.g. name@company.co.id";
  if (v.typeMismatch && field.type === "url") return "Enter a full web address";
  if (v.tooShort) return `Use at least ${(field as HTMLInputElement).minLength} characters`;
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput) {
    const input = field as HTMLInputElement;
    if (input.type === "date" || input.type === "month") return input.min ? `Pick a date from ${input.min}` : "Pick a valid date";
    return input.min && input.max ? `Enter a whole number from ${input.min} to ${input.max}` : "Enter a valid number";
  }
  if (v.patternMismatch) return field.title || "Check the format";
  return field.validationMessage || "Check this field";
}

function slotFor(field: Field) {
  return field.form?.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(field.name)}"]`) ?? null;
}

export function setFieldError(field: Field, message: string | null) {
  const slot = slotFor(field);
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (slot) {
      slot.textContent = message;
      slot.hidden = false;
    }
  } else {
    field.removeAttribute("aria-invalid");
    if (slot) {
      slot.textContent = "";
      slot.hidden = true;
    }
  }
}

/** Validates every named field; shows inline errors and focuses the first. */
export function validateForm(form: HTMLFormElement | HTMLElement): boolean {
  let first: Field | null = null;
  const seen = new Set<string>();
  for (const field of form.querySelectorAll<Field>("input[name], textarea[name], select[name]")) {
    // Radio/checkbox groups report once per name.
    if ((field.type === "radio" || field.type === "checkbox") && seen.has(field.name)) continue;
    seen.add(field.name);
    const message = messageFor(field);
    setFieldError(field, message);
    if (message) first ??= field;
  }
  first?.focus();
  return !first;
}

/** Turns off native bubbles and re-checks fields live once they have been flagged. */
export function enhanceValidation(form: HTMLFormElement) {
  if (form.dataset.validation) return;
  form.dataset.validation = "1";
  form.noValidate = true;
  const recheck = (event: Event) => {
    const field = event.target as Field;
    if (field?.name && field.getAttribute("aria-invalid") === "true") setFieldError(field, messageFor(field));
  };
  form.addEventListener("input", recheck);
  form.addEventListener("change", recheck);
  form.addEventListener(
    "blur",
    (event) => {
      const field = event.target as Field;
      if (field instanceof HTMLInputElement && field.type === "tel" && field.value.trim()) setFieldError(field, messageFor(field));
    },
    true,
  );
}
