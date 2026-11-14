"use client"

import * as React from "react"
import { cn } from "cn"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarLine,
} from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

/** Current year, read once: the year range does not need to be live. */
const CURRENT_YEAR = new Date().getFullYear()

/**
 * `YYYY-MM` → `{ year, month }` with a 1-based month.
 *
 * Parsed by hand for the same reason as `DatePicker`: the string form of a date
 * is UTC and would land in the previous month west of Greenwich.
 */
function parseIsoMonth(value?: string): { year: number; month: number } | undefined {
  if (!value) return undefined
  const [year, month] = value.split("-").map(Number)
  if (!year || !month || month < 1 || month > 12) return undefined
  return { year, month }
}

function toIsoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

function MonthPicker({
  value,
  onChange,
  placeholder = "mm/yyyy",
  className,
  disabled,
  id,
  fromYear = CURRENT_YEAR - 100,
  toYear = CURRENT_YEAR + 10,
  required,
  ...props
}: {
  /** Selected month as `YYYY-MM`; empty for no selection. */
  value?: string
  onChange: (value: string) => void
  /** Shown while empty. Defaults to `mm/yyyy`. */
  placeholder?: React.ReactNode
  className?: string
  disabled?: boolean
  id?: string
  /** First selectable year. Defaults to 100 years ago. */
  fromYear?: number
  /** Last selectable year. Defaults to 10 years ahead. */
  toYear?: number
  /**
   * Blocks native form submission while empty.
   *
   * A popover button is not a form control, so this renders an off-screen
   * `required` input to keep the browser's own validation working.
   */
  required?: boolean
} & Pick<React.ComponentProps<typeof Button>, "aria-label" | "name">) {
  const selected = parseIsoMonth(value)
  const [year, setYear] = React.useState(selected?.year ?? CURRENT_YEAR)
  const clamp = (next: number) => Math.min(Math.max(next, fromYear), toYear)

  const months = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        label: new Date(2000, index, 1).toLocaleDateString(undefined, {
          month: "short",
        }),
      })),
    []
  )

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setYear(selected?.year ?? CURRENT_YEAR)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            id={id}
            aria-required={required || undefined}
            data-empty={selected ? undefined : "true"}
            className={cn(
              "w-full justify-start font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
            {...props}
          />
        }
      >
        <span className="flex-1 truncate text-left">
          {selected
            ? new Date(selected.year, selected.month - 1, 1).toLocaleDateString(
                undefined,
                { year: "numeric", month: "long" }
              )
            : placeholder}
        </span>
        {/* Suffix icon, themed by `--muted-foreground` so it follows light/dark. */}
        <RiCalendarLine aria-hidden="true" className="shrink-0 text-muted-foreground" />
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
      <PopoverContent className="w-56 p-2">
        <div className="flex items-center justify-between gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous year"
            disabled={year <= fromYear}
            onClick={() => setYear((current) => clamp(current - 1))}
          >
            <RiArrowLeftSLine />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next year"
            disabled={year >= toYear}
            onClick={() => setYear((current) => clamp(current + 1))}
          >
            <RiArrowRightSLine />
          </Button>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {months.map(({ month, label }) => {
            const active = selected?.year === year && selected?.month === month
            return (
              <Button
                key={month}
                type="button"
                variant={active ? "default" : "ghost"}
                size="sm"
                className="justify-center font-normal"
                onClick={() => onChange(toIsoMonth(year, month))}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { MonthPicker }
