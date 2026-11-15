"use client"

import * as React from "react"
import { cn } from "cn"
import { RiTimeLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { formatTime, parseTime } from "@workspace/ui/lib/time"

/** Scroll a column so the selected value is visible on open. */
function scrollToSelected(node: HTMLDivElement | null, selected?: number) {
  if (!node || selected === null || selected === undefined) return
  const target = node.querySelector<HTMLElement>(`[data-value="${selected}"]`)
  target?.scrollIntoView({ block: "center" })
}

/**
 * Hour and minute columns, shared by `TimePicker` and `DateTimePicker`.
 *
 * A `null` hour or minute means nothing is chosen yet and the first value is
 * used when the other column changes.
 */
function TimeColumns({
  hour,
  minute,
  onPick,
  step = 1,
  className,
}: {
  hour: number | null
  minute: number | null
  onPick: (hour: number, minute: number) => void
  /** Minute granularity, 1–30. Defaults to 1 so no minute is unreachable. */
  step?: number
  className?: string
}) {
  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, index) => index), [])
  const minutes = React.useMemo(
    () =>
      Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step).filter(
        (candidate) => candidate < 60
      ),
    [step]
  )

  return (
    <div className={cn("flex gap-1", className)}>
      <div
        ref={(node) => scrollToSelected(node, hour ?? undefined)}
        className="flex h-56 flex-1 flex-col gap-1 overflow-y-auto pr-1"
      >
        {hours.map((candidate) => (
          <Button
            key={candidate}
            type="button"
            variant={hour === candidate ? "default" : "ghost"}
            size="sm"
            data-value={candidate}
            className="justify-center font-normal tabular-nums"
            onClick={() => onPick(candidate, minute ?? 0)}
          >
            {String(candidate).padStart(2, "0")}
          </Button>
        ))}
      </div>
      <div
        ref={(node) => scrollToSelected(node, minute ?? undefined)}
        className="flex h-56 flex-1 flex-col gap-1 overflow-y-auto pr-1"
      >
        {minutes.map((candidate) => (
          <Button
            key={candidate}
            type="button"
            variant={minute === candidate ? "default" : "ghost"}
            size="sm"
            data-value={candidate}
            className="justify-center font-normal tabular-nums"
            onClick={() => onPick(hour ?? 0, candidate)}
          >
            {String(candidate).padStart(2, "0")}
          </Button>
        ))}
      </div>
    </div>
  )
}

function TimePicker({
  value,
  onChange,
  placeholder = "--:--",
  className,
  disabled,
  id,
  step = 1,
  required,
  ...props
}: {
  /** Selected time as `HH:mm`; empty for no selection. */
  value?: string
  onChange: (value: string) => void
  /** Shown while empty. Defaults to `--:--`. */
  placeholder?: React.ReactNode
  className?: string
  disabled?: boolean
  id?: string
  /** Minute granularity, 1–30. Defaults to 1 so no minute is unreachable. */
  step?: number
  /** Blocks native form submission while empty; see `DatePicker`. */
  required?: boolean
} & Pick<React.ComponentProps<typeof Button>, "aria-label" | "name">) {
  const selected = parseTime(value)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            id={id}
            aria-required={required || undefined}
            data-empty={selected ? undefined : "true"}
            className={cn(
              "w-full justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
              className
            )}
            {...props}
          />
        }
      >
        <span className="flex-1 truncate text-left">
          {selected ? formatTime(selected.hour, selected.minute) : placeholder}
        </span>
        {/* Suffix icon, themed by `--muted-foreground` so it follows light/dark. */}
        <RiTimeLine aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      {required && !disabled && (
        <input
          required
          value={value ?? ""}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      )}
      <PopoverContent className="w-40 p-2">
        <TimeColumns
          hour={selected?.hour ?? null}
          minute={selected?.minute ?? null}
          step={step}
          onPick={(hour, minute) => onChange(formatTime(hour, minute))}
        />
      </PopoverContent>
    </Popover>
  )
}

export { TimePicker, TimeColumns }
