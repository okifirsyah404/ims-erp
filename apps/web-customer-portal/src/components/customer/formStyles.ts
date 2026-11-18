/** Class strings mirroring App / Input Field and App / Button for React islands. */
export const fieldBox =
  "flex h-[54px] items-center gap-2.5 rounded-md bg-surface px-4 ring-1 ring-border ring-inset transition-colors focus-within:bg-white focus-within:ring-[1.5px] focus-within:ring-blue-600";
export const fieldInput = "h-full min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-muted";
export const fieldLabel = "text-[13px] font-semibold text-fg-secondary";
export const primaryButton =
  "flex h-[54px] w-full items-center justify-center gap-2 rounded-control bg-blue-600 px-5 text-[16px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
export const outlineButton =
  "flex h-[54px] w-full items-center justify-center gap-2 rounded-control bg-white px-5 text-[16px] font-semibold text-fg ring-1 ring-border ring-inset transition-colors hover:bg-surface disabled:opacity-60";
export const errorText = "text-[13px] font-semibold text-danger";

export const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
