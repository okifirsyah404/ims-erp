import * as React from "react";
import { actions } from "astro:actions";
import { cn } from "cn";
import { BottomSheet } from "@/components/customer/BottomSheet";
import { outlineButton } from "@/components/customer/formStyles";

/**
 * Destructive confirmation (remove member, delete site, remove saved product, sign a device out). Opens a
 * sheet, runs the account action, then reloads (or navigates to `redirectTo`).
 */
type Operation = "removeMember" | "deleteSite" | "removeWishlistItem" | "revokeDevice";
type Props = {
  operation: Operation;
  id: string;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  description: string;
  confirmLabel: string;
  redirectTo?: string;
};

export default function ConfirmAction({ operation, id, triggerLabel, triggerClassName, title, description, confirmLabel, redirectTo }: Props) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("id", id);
    const { error: actionError } = await actions.account[operation](form);
    if (actionError) {
      setPending(false);
      return setError(actionError.message);
    }
    if (redirectTo) location.assign(redirectTo);
    else location.reload();
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !pending && setOpen(next)}
      title={title}
      trigger={
        <button type="button" className={cn("text-[13px] font-semibold text-danger hover:underline", triggerClassName)}>
          {triggerLabel}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-[1.5] text-fg-secondary">{description}</p>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className={outlineButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="flex h-[54px] w-full items-center justify-center rounded-control bg-danger px-5 text-[16px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
