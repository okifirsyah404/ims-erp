import { type TicketPriority } from "@/api/portal";

/**
 * Photos and files on tickets wait for the ticket module on main (user decision
 * 2026-11-20); until then the pickers stay hidden so nothing is silently dropped.
 */
export const TICKET_ATTACHMENTS_ENABLED = false;

/** Target first-reply time per ticket priority (shown on 08.02 / 08.02b). */
export const firstReply: Record<TicketPriority, string> = { low: "< 1 working day", normal: "< 4 hours", urgent: "< 1 hour" };

export const priorityLabel: Record<TicketPriority, string> = { low: "Low", normal: "Normal", urgent: "Urgent" };

/** `?tab=` (open · resolved · all) and `?q=` filtering shared by the ticket list screens. */
export function filterTickets<T extends { number: string; subject: string; status: string }>(all: T[], url: URL) {
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const requested = url.searchParams.get("tab") ?? "";
  const tab = ["open", "resolved", "all"].includes(requested) ? requested : "open";
  const open = all.filter((t) => t.status !== "resolved");
  const needle = query.toLowerCase();
  const list = query
    ? all.filter((t) => `${t.number} ${t.subject}`.toLowerCase().includes(needle))
    : tab === "open"
      ? open
      : tab === "resolved"
        ? all.filter((t) => t.status === "resolved")
        : all;
  return { query, tab, open, list };
}
