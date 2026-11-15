"use client"

import * as React from "react"
import { cn } from "cn"
import { RiCalendarLine } from "@remixicon/react"
import type { DateRange } from "react-day-picker"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

/** Current year, read once: the dropdown range does not need to be live. */
const CURRENT_YEAR = new Date().getFullYear()

/**
 * `YYYY-MM-DD` → local-midnight `Date`.
 *
 * Parsed by hand, not with `new Date(value)`: the string form is UTC and would
 * land on the previous day west of Greenwich.
 */
function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A business-date range; either end may be unset while picking. */
export type TDateRangeValue = {
  from?: string
  to?: string
}

/**
 * Two-month calendar popover returning an inclusive `YYYY-MM-DD` range.
 *
 * @remarks
 * The range is only reported once both ends are picked: an open-ended range
 * would silently mean "from here to forever" at every call site.
 *
 * `showTrigger={false}` renders no button at all: the caller opens the calendar
 * itself and supplies the `anchor` element the popover positions against. That
 * is how a "Custom" preset shows the calendar straight away instead of asking
 * for a second click on an input.
 */
function DateRangePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy – dd/mm/yyyy",
  className,
  disabled,
  id,
  fromYear = CURRENT_YEAR - 100,
  toYear = CURRENT_YEAR + 10,
  min,
  max,
  numberOfMonths = 2,
  showTrigger = true,
  anchor,
  open: openProp,
  onOpenChange,
  ...props
}: {
  /** Selected range as business dates (`YYYY-MM-DD`); empty for no selection. */
  value?: TDateRangeValue
  onChange: (value: TDateRangeValue) => void
  /** Shown while empty. */
  placeholder?: React.ReactNode
  className?: string
  disabled?: boolean
  id?: string
  /** First year in the year dropdown. Defaults to 100 years ago. */
  fromYear?: number
  /** Last year in the year dropdown. Defaults to 10 years ahead. */
  toYear?: number
  /** Earliest selectable date, `YYYY-MM-DD`. */
  min?: string
  /** Latest selectable date, `YYYY-MM-DD`. */
  max?: string
  /** Calendars shown side by side. Defaults to two. */
  numberOfMonths?: number
  /** Render the button trigger. `false` = the caller drives `open`. */
  showTrigger?: boolean
  /** Element the calendar is positioned against when there is no trigger. */
  anchor?: Element | null
  /** Controlled open state; omit to let the component manage it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
} & Pick<React.ComponentProps<typeof Button>, "aria-label" | "name">) {
  const from = parseIsoDate(min)
  const to = parseIsoDate(max)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  /**
   * First click of an in-progress pick.
   *
   * @remarks
   * `react-day-picker` reports `to === from` for the first click, so a
   * controlled `value` cannot tell "one day chosen" from "range complete".
   * This holds the pending start instead, and the range is only reported once
   * the second click lands.
   */
  const [pendingFrom, setPendingFrom] = React.useState<string | undefined>()

  const rangeFrom = pendingFrom ?? value?.from
  const selected: DateRange = {
    from: parseIsoDate(rangeFrom),
    to: pendingFrom ? undefined : parseIsoDate(value?.to),
  }
  const hasRange = Boolean(value?.from && value?.to)

  const label = hasRange
    ? `${parseIsoDate(value!.from)!.toLocaleDateString(undefined, { dateStyle: "medium" })} – ${parseIsoDate(value!.to)!.toLocaleDateString(undefined, { dateStyle: "medium" })}`
    : parseIsoDate(value?.from)
      ? `${parseIsoDate(value!.from)!.toLocaleDateString(undefined, { dateStyle: "medium" })} – …`
      : placeholder

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // A dismissed half-pick must not leak into the next attempt.
        if (!next) setPendingFrom(undefined)
      }}
    >      {showTrigger ? (
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              disabled={disabled}
              id={id}
              data-empty={hasRange ? undefined : "true"}
              className={cn(
                "w-full justify-start font-normal data-[empty=true]:text-muted-foreground",
                className
              )}
              {...props}
            />
          }
        >
          <span className="flex-1 truncate text-left">{label}</span>
          <RiCalendarLine aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </PopoverTrigger>
      ) : null}
      <PopoverContent className="w-auto p-0" anchor={showTrigger ? undefined : anchor}>
        <Calendar
          mode="range"
          selected={selected}
          defaultMonth={selected.from ?? from}
          numberOfMonths={numberOfMonths}
          onSelect={(range) => {
            if (!range?.from) {
              setPendingFrom(undefined)
              onChange({})
              return
            }
            // `range.from` is the anchor of the range, not the day just clicked:
            // once a start exists, the clicked day arrives in `range.to`.
            const clicked = toIsoDate(pendingFrom ? (range.to ?? range.from) : range.from)
            if (!pendingFrom) {
              setPendingFrom(clicked)
              onChange({ from: clicked })
              return
            }
            // Second click: normalise the order so an inverted pick still works.
            const [start, end] =
              pendingFrom <= clicked ? [pendingFrom, clicked] : [clicked, pendingFrom]
            setPendingFrom(undefined)
            onChange({ from: start, to: end })
            // Only the uncontrolled form closes itself; a controlled caller
            // closes from its own `onChange`, which avoids a close/reopen race
            // inside the popover's select handler.
            if (openProp === undefined) setUncontrolledOpen(false)
          }}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          disabled={[from ? { before: from } : null, to ? { after: to } : null].filter(
            (matcher) => matcher !== null
          )}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DateRangePicker }
