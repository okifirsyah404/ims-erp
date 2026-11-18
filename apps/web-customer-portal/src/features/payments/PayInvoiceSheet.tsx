import * as React from "react";
import { actions } from "astro:actions";
import { ArrowLeftRight, Landmark, Lock, QrCode, ShieldCheck } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BottomSheet } from "../../components/customer/BottomSheet";
import { useHashSheet } from "../../components/customer/useHashSheet";
import { errorText, primaryButton, rupiah } from "../../components/customer/formStyles";

/** 05.07b Pay invoice · Sheet (opened via #pay-<invoiceId>). */
type Method = { id: string; kind: "virtual_account" | "qris" | "transfer"; name: string; detail: string };
type Props = { invoiceId: string; number: string; amount: number; dueLabel?: string; methods: Method[] };

const icons = { virtual_account: Landmark, qris: QrCode, transfer: ArrowLeftRight };

export default function PayInvoiceSheet({ invoiceId, number, amount, dueLabel, methods }: Props) {
  const sheet = useHashSheet(`pay-${invoiceId}`);
  const [method, setMethod] = React.useState(methods[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function pay() {
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("invoice", invoiceId);
    form.set("method", method);
    const { data, error: actionError } = await actions.portal.payInvoice(form);
    if (actionError) {
      setPending(false);
      return setError(actionError.message);
    }
    // Validated as https by the ERP adapter; re-checked here before leaving the app.
    if (data?.instructionsUrl?.startsWith("https://")) location.assign(data.instructionsUrl);
    else location.replace(location.pathname);
  }

  return (
    <BottomSheet
      open={sheet.open}
      onOpenChange={sheet.onOpenChange}
      title={`Pay ${number}`}
      subtitle={`${rupiah(amount)}${dueLabel ? ` · ${dueLabel.toLowerCase()}` : ""}`}
    >
      <div className="flex flex-col gap-[18px]">
        <RadioGroup value={method} onValueChange={(v) => setMethod(String(v))} aria-label="Payment method" className="flex flex-col gap-2.5">
          {methods.map((m) => {
            const Icon = icons[m.kind];
            const on = m.id === method;
            return (
              <label
                key={m.id}
                className={
                  on
                    ? "flex cursor-pointer items-center gap-3.5 rounded-lg bg-blue-50 p-3.5 ring-[1.5px] ring-blue-600 ring-inset"
                    : "flex cursor-pointer items-center gap-3.5 rounded-lg bg-white p-3.5 ring-1 ring-border ring-inset"
                }
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-md text-navy-900 ${on ? "bg-white" : "bg-surface"}`} aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold text-fg">{m.name}</span>
                  <span className="text-[12px] text-fg-muted">{m.detail}</span>
                </span>
                <RadioGroupItem
                  value={m.id}
                  className="size-[22px] border-2 border-border data-checked:border-blue-600 data-checked:bg-blue-600"
                />
              </label>
            );
          })}
        </RadioGroup>
        {error && <p role="alert" className={errorText}>{error}</p>}
        <button type="button" onClick={pay} disabled={pending || !method} className={primaryButton}>
          <Lock className="size-[18px]" aria-hidden="true" />
          {pending ? "Processing…" : `Pay ${rupiah(amount)}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-fg-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Secured payment · receipt sent to your email
        </p>
      </div>
    </BottomSheet>
  );
}
