import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Bottom sheet in the app's style (05.06b / 05.07b / 04.04b): shadcn Sheet on the
 * bottom edge, 32px top radius, grabber, title + subtitle and a round close button.
 */
type Props = {
  title?: string;
  subtitle?: string;
  trigger?: React.ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showClose?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function BottomSheet({ title, subtitle, trigger, open, defaultOpen, onOpenChange, showClose = true, className, children }: Props) {
  return (
    <Sheet open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger render={trigger} />}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "mx-auto max-h-[92dvh] w-full max-w-[480px] gap-0 overflow-y-auto rounded-t-sheet border-0 bg-white px-5 pt-0 text-fg shadow-[0_-12px_40px_#0A1A3F26]",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
          // Tablet & desktop: a floating panel instead of an edge-to-edge sheet.
          "md:bottom-8 md:max-h-[calc(100dvh-64px)] md:max-w-[520px] md:rounded-sheet md:border md:pb-6",
          className,
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1.5 md:invisible" aria-hidden="true">
          <span className="h-[5px] w-10 rounded-pill bg-border-strong" />
        </div>
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 pt-2 pb-5">
            <div className="flex min-w-0 flex-col gap-1">
              {title ? (
                <SheetTitle className="font-heading text-[22px] font-extrabold tracking-[-0.4px] text-fg">{title}</SheetTitle>
              ) : (
                <SheetTitle className="sr-only">Dialog</SheetTitle>
              )}
              {subtitle && <SheetDescription className="text-[13px] text-fg-muted">{subtitle}</SheetDescription>}
            </div>
            {showClose && (
              <SheetClose
                aria-label="Close"
                className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface text-fg hover:bg-surface-2"
              >
                <XIcon className="size-5" aria-hidden="true" />
              </SheetClose>
            )}
          </div>
        )}
        {children}
      </SheetContent>
    </Sheet>
  );
}
