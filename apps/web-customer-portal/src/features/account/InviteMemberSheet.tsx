import * as React from "react";
import { actions, isInputError } from "astro:actions";
import { Mail, Send, Wallet } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/customer/BottomSheet";
import { useHashSheet } from "@/components/customer/useHashSheet";
import { errorText, fieldBox, fieldInput, fieldLabel, primaryButton } from "@/components/customer/formStyles";

/** 05.11b Invite a teammate — opened by any `href="#invite"` link. */
const roles = [
  { value: "approver", label: "Approver", description: "Approve quotations up to a limit" },
  { value: "finance", label: "Finance", description: "Invoices, payments & tax documents" },
  { value: "viewer", label: "Viewer", description: "Track orders, projects & tickets" },
] as const;

type Role = (typeof roles)[number]["value"];

export default function InviteMemberSheet() {
  const { open, onOpenChange } = useHashSheet("invite");
  const [role, setRole] = React.useState<Role>("approver");
  const [limit, setLimit] = React.useState("100000000");
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (role === "approver") form.set("approval_limit", limit.replace(/\D/g, ""));
    else form.delete("approval_limit");
    setPending(true);
    setErrors({});
    const { error } = await actions.account.inviteMember(form);
    if (error) {
      setPending(false);
      if (isInputError(error)) {
        return setErrors({ email: error.fields.email?.[0], approval_limit: error.fields.approval_limit?.[0], form: undefined });
      }
      return setErrors({ form: error.message });
    }
    location.replace(location.pathname);
  }

  const formatted = limit ? new Intl.NumberFormat("id-ID").format(Number(limit)) : "";

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Invite a teammate">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-email" className={cn(fieldLabel, errors.email && "text-danger")}>
            Work email
          </label>
          <div className={cn(fieldBox, errors.email && "bg-white ring-[1.5px] ring-danger")}>
            <Mail className="size-[18px] text-fg-muted" aria-hidden="true" />
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@company.co.id"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "invite-email-error" : undefined}
              className={fieldInput}
            />
          </div>
          {errors.email && (
            <p id="invite-email-error" className={errorText}>
              {errors.email}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={cn(fieldLabel, "mb-2")}>Role</legend>
          {roles.map((option) => {
            const selected = role === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3.5 py-3 ring-inset transition-colors",
                  selected ? "bg-blue-50 ring-[1.5px] ring-blue-600" : "bg-white ring-1 ring-border hover:bg-surface",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-fg">{option.label}</span>
                  <span className="text-[12.5px] text-fg-muted">{option.description}</span>
                </span>
                <input type="radio" name="role" value={option.value} checked={selected} onChange={() => setRole(option.value)} className="peer sr-only" />
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600",
                    selected ? "bg-blue-600 ring-0" : "ring-[1.5px] ring-border-strong",
                  )}
                  aria-hidden="true"
                >
                  {selected && <span className="size-2 rounded-full bg-white" />}
                </span>
              </label>
            );
          })}
        </fieldset>

        {role === "approver" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-limit" className={cn(fieldLabel, errors.approval_limit && "text-danger")}>
              Approval limit
            </label>
            <div className={cn(fieldBox, errors.approval_limit && "bg-white ring-[1.5px] ring-danger")}>
              <Wallet className="size-[18px] text-fg-muted" aria-hidden="true" />
              <span className="text-[15px] text-fg">Rp</span>
              <input
                id="invite-limit"
                inputMode="numeric"
                value={formatted}
                onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 12))}
                aria-invalid={errors.approval_limit ? true : undefined}
                className={fieldInput}
              />
            </div>
            {errors.approval_limit && <p className={errorText}>{errors.approval_limit}</p>}
          </div>
        )}

        {errors.form && (
          <p role="alert" className={errorText}>
            {errors.form}
          </p>
        )}
        <button type="submit" disabled={pending} className={primaryButton}>
          <Send className="size-[18px]" aria-hidden="true" />
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </form>
    </BottomSheet>
  );
}
