import * as React from "react";

/** Small "Copy" text action (05.04 · AWB). Falls back to selecting nothing if clipboard is unavailable. */
export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className="shrink-0 text-[13px] font-semibold text-blue-600"
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
