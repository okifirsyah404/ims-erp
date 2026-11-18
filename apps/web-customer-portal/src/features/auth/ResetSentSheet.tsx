import * as React from "react";
import { MailCheck, Mail } from "lucide-react";
import { BottomSheet } from "../../components/customer/BottomSheet";

/** 04.04b Reset link sent · Sheet (opens after a successful forgot-password request). */
type Props = { masked: string; method: "email" | "phone"; resendFormId: string };

export default function ResetSentSheet({ masked, method, resendFormId }: Props) {
  const [open, setOpen] = React.useState(true);
  const [seconds, setSeconds] = React.useState(42);

  React.useEffect(() => {
    if (!open || seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, seconds]);

  return (
    <BottomSheet open={open} onOpenChange={setOpen} showClose={false}>
      <div className="flex flex-col gap-[18px] px-1 pb-2">
        <span className="flex size-20 items-center justify-center rounded-pill bg-success-bg/60" aria-hidden="true">
          <span className="flex size-16 items-center justify-center rounded-pill bg-success-bg text-success">
            <MailCheck className="size-7" />
          </span>
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-[22px] font-extrabold text-fg">{method === "email" ? "Check your inbox" : "Check your messages"}</h2>
          <p className="text-[14.5px] leading-[21px] text-fg-secondary">
            We sent a reset link to {masked}. The link expires in 30 minutes.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-1.5">
          {method === "email" ? (
            <a
              href="mailto:"
              className="flex h-[54px] items-center justify-center gap-2 rounded-control bg-blue-600 text-[16px] font-semibold text-white hover:bg-blue-700"
            >
              <Mail className="size-[18px]" aria-hidden="true" />
              Open email app
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-[54px] items-center justify-center rounded-control bg-blue-600 text-[16px] font-semibold text-white"
            >
              Done
            </button>
          )}
          <button
            type="submit"
            form={resendFormId}
            disabled={seconds > 0}
            className="flex h-[54px] items-center justify-center rounded-control bg-white text-[16px] font-semibold text-fg ring-1 ring-border ring-inset disabled:opacity-60"
          >
            {seconds > 0 ? `Resend link in 0:${String(seconds).padStart(2, "0")}` : "Resend link"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
