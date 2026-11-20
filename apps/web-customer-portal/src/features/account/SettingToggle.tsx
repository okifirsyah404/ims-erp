import * as React from "react";
import { actions } from "astro:actions";
import { cn } from "cn";

/**
 * App / Toggle (05.10): 46×28 switch that saves immediately through
 * actions.account.updateSetting. Optimistic; reverts and explains on failure.
 */
type SettingKey = "push" | "twoStep";
type Props = { setting: SettingKey; label: string; defaultChecked: boolean; className?: string };

export default function SettingToggle({ setting, label, defaultChecked, className }: Props) {
  const [checked, setChecked] = React.useState(defaultChecked);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function toggle() {
    if (pending) return;
    const next = !checked;
    setChecked(next);
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("key", setting);
    form.set("value", String(next));
    const { error: actionError } = await actions.account.updateSetting(form);
    setPending(false);
    if (actionError) {
      setChecked(!next);
      setError(actionError.message);
    }
  }

  return (
    <span className={cn("flex shrink-0 flex-col items-end gap-1", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-busy={pending || undefined}
        onClick={toggle}
        className={cn(
          "flex h-7 w-[46px] items-center rounded-pill p-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
          checked ? "justify-end bg-blue-600" : "justify-start bg-[#C9D1DF]",
        )}
      >
        <span className="size-[22px] rounded-full bg-white shadow-[0_1px_3px_#0A1A3F33]" />
      </button>
      {error && (
        <span role="alert" className="max-w-[180px] text-right text-[11.5px] font-semibold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
