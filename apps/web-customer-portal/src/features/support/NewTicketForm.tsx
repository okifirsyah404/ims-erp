import * as React from "react";
import { actions, isInputError } from "astro:actions";
import { Camera, Ellipsis, HardHat, MonitorCog, Package, Receipt, Send, ShieldCheck, Type, Wrench, X } from "lucide-react";
import { firstReply } from "@/lib/support";
import { errorText, fieldBox, fieldInput, fieldLabel, primaryButton } from "../../components/customer/formStyles";

/** 08.02 Create Ticket. Submits through actions.portal.createTicket, then shows 08.02b. */
type Category = "hardware" | "software" | "installation" | "billing" | "warranty" | "other";
type Priority = "low" | "normal" | "urgent";
type Product = { id: string; name: string; detail: string };
type Props = { products: Product[]; initialProduct?: string; initialCategory?: Category; initialSubject?: string };

const categories: { key: Category; label: string; icon: typeof Wrench }[] = [
  { key: "hardware", label: "Hardware", icon: Wrench },
  { key: "software", label: "Software", icon: MonitorCog },
  { key: "installation", label: "Installation", icon: HardHat },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "warranty", label: "Warranty", icon: ShieldCheck },
  { key: "other", label: "Other", icon: Ellipsis },
];
const priorities: { key: Priority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "urgent", label: "Urgent" },
];

const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DESCRIPTION = 1000;

export default function NewTicketForm({ products, initialProduct, initialCategory = "hardware", initialSubject = "" }: Props) {
  const [category, setCategory] = React.useState<Category>(initialCategory);
  const [priority, setPriority] = React.useState<Priority>("normal");
  const [productId, setProductId] = React.useState(initialProduct ?? products[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [files, setFiles] = React.useState<{ file: File; url: string }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});
  const product = products.find((p) => p.id === productId);

  React.useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => /^(image|video)\//.test(f.type));
    const tooBig = picked.some((f) => f.size > MAX_BYTES);
    const accepted = picked.filter((f) => f.size <= MAX_BYTES).slice(0, MAX_FILES - files.length);
    setFiles((current) => [...current, ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setErrors((e) => ({ ...e, photos: tooBig ? "Each file must be 25 MB or smaller" : picked.length > accepted.length ? `Attach up to ${MAX_FILES} files` : undefined }));
  }

  function removeFile(index: number) {
    setFiles((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const form = new FormData(event.currentTarget);
    form.set("category", category);
    form.set("priority", priority);
    if (productId) form.set("product", productId);
    else form.delete("product");
    files.forEach(({ file }) => form.append("photos", file));
    const { data, error } = await actions.portal.createTicket(form);
    if (error) {
      setPending(false);
      if (isInputError(error)) {
        return setErrors(Object.fromEntries(Object.entries(error.fields).map(([key, messages]) => [key, messages?.[0]])));
      }
      return setErrors({ form: error.message });
    }
    location.assign(`/support/submitted?id=${encodeURIComponent(data.id)}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[22px] px-5 pt-2 pb-6" noValidate>
      <fieldset className="flex flex-col gap-2.5">
        <legend className={`${fieldLabel} mb-2.5`}>What do you need help with?</legend>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Category">
          {categories.map(({ key, label, icon: Icon }) => {
            const on = key === category;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCategory(key)}
                className={
                  on
                    ? "flex flex-col items-center gap-2 rounded-lg bg-blue-50 px-2 py-3.5 text-[12.5px] font-bold text-blue-700 ring-[1.5px] ring-blue-600 ring-inset"
                    : "flex flex-col items-center gap-2 rounded-lg bg-white px-2 py-3.5 text-[12.5px] font-medium text-fg-secondary ring-1 ring-border ring-inset"
                }
              >
                <Icon className={`size-5 ${on ? "text-blue-600" : "text-fg"}`} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {products.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className={fieldLabel} id="product-label">Related product</span>
          <div className="relative flex items-center gap-3 rounded-lg bg-surface p-3 focus-within:ring-[1.5px] focus-within:ring-blue-600">
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-md bg-white text-fg-muted" aria-hidden="true">
              <Package className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-bold text-fg">{product?.name ?? "No specific product"}</span>
              <span className="truncate text-[12.5px] text-fg-muted">{product?.detail ?? "General question"}</span>
            </span>
            <span className="text-[13px] font-semibold text-blue-600" aria-hidden="true">Change</span>
            <select
              aria-labelledby="product-label"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="">No specific product</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <span className={fieldLabel} id="priority-label">Priority</span>
        <div className="flex h-11 gap-1 rounded-md bg-surface-2 p-1" role="radiogroup" aria-labelledby="priority-label">
          {priorities.map(({ key, label }) => {
            const on = key === priority;
            const activeTone = key === "urgent" ? "bg-danger text-white font-bold shadow-[0_2px_6px_#DC354533]" : "bg-white text-fg font-semibold shadow-[0_2px_6px_#0A1A3F14]";
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPriority(key)}
                className={`flex flex-1 items-center justify-center rounded-md text-[14px] ${on ? activeTone : "font-medium text-fg-muted"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className={fieldLabel}>Subject</label>
        <div className={fieldBox}>
          <Type className="size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
          <input
            id="subject"
            name="subject"
            required
            minLength={4}
            maxLength={120}
            defaultValue={initialSubject}
            placeholder="e.g. Gate arm slow to respond at exit"
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={errors.subject ? "subject-error" : undefined}
            className={fieldInput}
          />
        </div>
        {errors.subject && <p id="subject-error" className={errorText}>{errors.subject}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className={fieldLabel}>Describe the issue</label>
        <div className="flex flex-col gap-2 rounded-control bg-white p-4 ring-1 ring-border ring-inset focus-within:ring-[1.5px] focus-within:ring-blue-600">
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, when did it start, and what have you tried?"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "description-error" : undefined}
            className="resize-none bg-transparent text-[14.5px] leading-[21px] text-fg outline-none placeholder:text-fg-muted"
          />
          <span className="self-end text-[11.5px] font-medium text-fg-muted">{description.length} / {MAX_DESCRIPTION}</span>
        </div>
        {errors.description && <p id="description-error" className={errorText}>{errors.description}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className={fieldLabel}>Photos &amp; videos</span>
          <span className="text-[12px] text-fg-muted">Max {MAX_FILES} · 25 MB</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {files.map(({ file, url }, index) => (
            <span key={url} className="relative size-[76px] overflow-hidden rounded-md bg-surface">
              {file.type.startsWith("video/") ? (
                <video src={url} className="size-full object-cover" muted />
              ) : (
                <img src={url} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-pill bg-[#060F26B3] text-white"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {files.length < MAX_FILES && (
            <label className="flex size-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md bg-surface text-[11.5px] font-semibold text-blue-600 ring-[1.5px] ring-border-strong ring-inset focus-within:ring-blue-600">
              <Camera className="size-5" aria-hidden="true" />
              Add
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {errors.photos && <p className={errorText}>{errors.photos}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/96 shadow-[0_-8px_24px_#0A1A3F14] backdrop-blur-[20px]">
        <div className="app-column flex flex-col gap-2.5 px-5 pt-3.5 pb-safe">
          {errors.form && <p role="alert" className={errorText}>{errors.form}</p>}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-fg-muted">Expected first reply</span>
            <span className={`font-heading text-[15px] font-extrabold ${priority === "urgent" ? "text-danger" : "text-fg"}`}>
              {firstReply[priority]} · {priorities.find((p) => p.key === priority)?.label}
            </span>
          </div>
          <button type="submit" disabled={pending} className={primaryButton}>
            <Send className="size-[18px]" aria-hidden="true" />
            {pending ? "Submitting…" : "Submit ticket"}
          </button>
        </div>
      </div>
    </form>
  );
}
