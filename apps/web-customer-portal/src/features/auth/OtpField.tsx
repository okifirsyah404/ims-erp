import * as React from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/**
 * 04.06 OTP entry: six 56px boxes (surface fill, active = white + 2px blue ring).
 * Renders inside a server form; the hidden input `name` carries the code. Submits the
 * form automatically once all digits are entered.
 */
type Props = { name: string; invalid?: boolean; autoSubmit?: boolean };

export default function OtpField({ name, invalid = false, autoSubmit = true }: Props) {
  const [value, setValue] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={ref}>
      <InputOTP
        maxLength={6}
        name={name}
        value={value}
        onChange={setValue}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="6-digit verification code"
        aria-invalid={invalid || undefined}
        containerClassName="w-full"
        onComplete={() => {
          if (autoSubmit) ref.current?.closest("form")?.requestSubmit();
        }}
      >
        <InputOTPGroup className="w-full gap-2 rounded-none">
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              aria-invalid={invalid || undefined}
              className="h-14 flex-1 rounded-md border-0 bg-surface font-heading text-[22px] font-extrabold text-fg ring-1 ring-border ring-inset first:rounded-md first:border-0 last:rounded-md data-[active=true]:bg-white data-[active=true]:ring-2 data-[active=true]:ring-blue-600 aria-invalid:ring-danger"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
