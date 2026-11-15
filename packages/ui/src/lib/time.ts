/** `HH:mm` → `{ hour, minute }`; anything unparsable means "no selection". */
export function parseTime(
  value?: string
): { hour: number; minute: number } | undefined {
  if (!value) return undefined
  const [rawHour, rawMinute] = value.split(":").map(Number)
  if (rawHour === undefined || rawMinute === undefined) return undefined
  if (!Number.isInteger(rawHour) || !Number.isInteger(rawMinute)) return undefined
  if (rawHour < 0 || rawHour > 23 || rawMinute < 0 || rawMinute > 59) {
    return undefined
  }
  return { hour: rawHour, minute: rawMinute }
}

/** `{ hour, minute }` → zero-padded `HH:mm`. */
export function formatTime(hour: number, minute: number): string {
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${pad(hour)}:${pad(minute)}`
}
