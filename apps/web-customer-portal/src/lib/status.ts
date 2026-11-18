import { type OrderStatus, type QuotationStatus, type TicketSummary, type RegisteredProduct, type ProjectSummary } from "@/api/portal";

/** Status → chip (label + tone) mappings shared by list and detail screens. */
type Chip = { label: string; tone: "info" | "success" | "warning" | "danger" | "neutral" };

export const orderChip = (status: OrderStatus, label: string): Chip => ({
  label,
  tone: status === "delivered" ? "success" : status === "production" || status === "qc" ? "warning" : status === "cancelled" ? "danger" : "info",
});

export const quotationChip: Record<QuotationStatus, Chip> = {
  needs_approval: { label: "Needs approval", tone: "warning" },
  revised: { label: "Revised", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  expired: { label: "Expired", tone: "neutral" },
  rejected: { label: "Declined", tone: "danger" },
};

export const ticketChip: Record<TicketSummary["status"], Chip> = {
  awaiting_you: { label: "Awaiting you", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  new: { label: "New", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
};

export const warrantyChip: Record<RegisteredProduct["warrantyStatus"], Chip> = {
  active: { label: "Warranty active", tone: "success" },
  expiring: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
};

export const projectChip: Record<ProjectSummary["status"], Chip & { onDark: string }> = {
  on_track: { label: "On track", tone: "success", onDark: "text-success" },
  action_needed: { label: "Action needed", tone: "warning", onDark: "text-warning" },
  handed_over: { label: "Handed over", tone: "neutral", onDark: "text-fg-muted" },
};

/** Greeting by Jakarta local time. */
export function greeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(date));
  return hour < 11 ? "Good morning," : hour < 15 ? "Good afternoon," : hour < 19 ? "Good evening," : "Good night,";
}
