import * as React from "react";
import { actions, isInputError } from "astro:actions";
import { Check, ChevronDown, Hash, Paperclip, Send, ShieldCheck, Timer, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BottomSheet } from "../../components/customer/BottomSheet";
import { useHashSheet } from "../../components/customer/useHashSheet";
import { errorText, fieldBox, fieldInput, fieldLabel, primaryButton, rupiah } from "../../components/customer/formStyles";

/**
 * 05.06b Accept quotation and 05.06c Request revision sheets, opened via #accept /
 * #revise. Submissions go through Astro Actions; the page reloads to show the result.
 */
type Props = {
  id: string;
  number: string;
  /** Short project label for sheet subtitles, e.g. "Parking Guidance Lot P3". */
  shortTitle: string;
  version: number;
  total: number;
  downPaymentRate: number;
  downPaymentDue: string;
  approvers: { id: string; label: string }[];
  companyName: string;
  managerName: string;
  topics: string[];
};

export default function QuotationSheets(props: Props) {
  return (
    <>
      <AcceptSheet {...props} />
      <RevisionSheet {...props} />
    </>
  );
}

function AcceptSheet({ id, number, shortTitle, total, downPaymentRate, downPaymentDue, approvers, companyName }: Props) {
  const sheet = useHashSheet("accept");
  const [agree, setAgree] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!agree) return setError("Please confirm you accept the terms.");
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("agree", "true");
    const { error: actionError } = await actions.portal.acceptQuotation(form);
    if (actionError) {
      setPending(false);
      return setError(isInputError(actionError) ? Object.values(actionError.fields).flat()[0] : actionError.message);
    }
    location.replace(location.pathname);
  }

  return (
    <BottomSheet open={sheet.open} onOpenChange={sheet.onOpenChange} title="Accept quotation" subtitle={`${number} · ${shortTitle}`}>
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <input type="hidden" name="id" value={id} />
        <dl className="flex flex-col gap-2.5 rounded-lg bg-surface p-4 text-[14px]">
          <div className="flex justify-between gap-2.5"><dt className="text-fg-muted">Grand total</dt><dd className="font-semibold text-fg">{rupiah(total)}</dd></div>
          <div className="flex justify-between gap-2.5"><dt className="text-fg-muted">Down payment ({Math.round(downPaymentRate * 100)}%)</dt><dd className="font-semibold text-blue-600">{rupiah(total * downPaymentRate)}</dd></div>
          <div className="flex justify-between gap-2.5"><dt className="text-fg-muted">Due</dt><dd className="font-semibold text-fg">{downPaymentDue}</dd></div>
        </dl>
        <div className="flex flex-col gap-2">
          <label htmlFor="po_number" className={fieldLabel}>PO number (optional)</label>
          <div className={fieldBox}>
            <Hash className="size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
            <input id="po_number" name="po_number" maxLength={60} placeholder="PO/2026/0001" className={fieldInput} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="approver" className={fieldLabel}>Approved by</label>
          <div className={`${fieldBox} relative`}>
            <UserRound className="size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
            <select id="approver" name="approver" className={`${fieldInput} appearance-none`}>
              {approvers.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={agree}
            onCheckedChange={(value) => setAgree(Boolean(value))}
            className="mt-px size-[22px] rounded-sm border-[1.5px] border-border-strong data-checked:border-blue-600 data-checked:bg-blue-600"
          />
          <span className="text-[13px] leading-[19px] text-fg-secondary">
            I accept the pricing, payment milestones and terms of this quotation on behalf of {companyName}.
          </span>
        </label>
        {error && <p role="alert" className={errorText}>{error}</p>}
        <button type="submit" disabled={pending} className={primaryButton}>
          <Check className="size-[18px]" aria-hidden="true" />
          {pending ? "Accepting…" : "Confirm & accept"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-fg-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Your order is confirmed at once; the invoice follows from our team
        </p>
      </form>
    </BottomSheet>
  );
}

function RevisionSheet({ id, number, version, managerName, topics }: Props) {
  const sheet = useHashSheet("revise");
  const [selected, setSelected] = React.useState<string[]>(["Pricing"]);
  const [message, setMessage] = React.useState("");
  const [fileName, setFileName] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const toggle = (topic: string) => setSelected((s) => (s.includes(topic) ? s.filter((t) => t !== topic) : [...s, topic]));

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.delete("topics");
    selected.forEach((topic) => form.append("topics", topic));
    const { error: actionError } = await actions.portal.requestRevision(form);
    if (actionError) {
      setPending(false);
      return setError(isInputError(actionError) ? Object.values(actionError.fields).flat()[0] : actionError.message);
    }
    location.replace(location.pathname);
  }

  return (
    <BottomSheet open={sheet.open} onOpenChange={sheet.onOpenChange} title="Request a revision" subtitle={`${number} · v${version} → v${version + 1}`}>
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <input type="hidden" name="id" value={id} />
        <fieldset className="flex flex-col gap-2.5">
          <legend className={`${fieldLabel} mb-2.5`}>What should we change?</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const on = selected.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(topic)}
                  className={
                    on
                      ? "flex items-center gap-1.5 rounded-pill bg-blue-50 px-3.5 py-2 text-[13px] font-semibold text-blue-700 ring-[1.5px] ring-blue-600 ring-inset"
                      : "flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-2 text-[13px] font-semibold text-fg ring-1 ring-border ring-inset"
                  }
                >
                  {on && <Check className="size-3.5 text-blue-600" aria-hidden="true" />}
                  {topic}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2 rounded-md bg-white p-4 ring-1 ring-border ring-inset focus-within:ring-[1.5px] focus-within:ring-blue-600">
          <label htmlFor="revision-message" className="sr-only">Message for your account manager</label>
          <textarea
            id="revision-message"
            name="message"
            value={message}
            maxLength={500}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what you'd like to change…"
            className="resize-none bg-transparent text-[14.5px] leading-[21px] text-fg outline-none placeholder:text-fg-muted"
          />
          <span className="self-end text-[11.5px] font-medium text-fg-muted">{message.length} / 500</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md bg-surface p-3.5">
          <Paperclip className="size-[18px] text-blue-600" aria-hidden="true" />
          <span className="flex-1 truncate text-[13.5px] font-semibold text-fg">{fileName ?? "Attach marked-up PDF (optional)"}</span>
          <input type="file" name="attachment" accept="application/pdf" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
        </label>
        {error && <p role="alert" className={errorText}>{error}</p>}
        <button type="submit" disabled={pending || selected.length === 0} className={primaryButton}>
          <Send className="size-[18px]" aria-hidden="true" />
          {pending ? "Sending…" : "Send revision request"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-fg-muted">
          <Timer className="size-3.5" aria-hidden="true" />
          {managerName.split(" ")[0]} replies within 1 working day · v{version + 1} appears here
        </p>
      </form>
    </BottomSheet>
  );
}
