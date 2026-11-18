import type { CompanyMember } from "@ims-erp/api-client";
import { formatRupiah } from "../../lib/format";

type Tone = "info" | "success" | "warning" | "neutral";

/** Role chip + secondary line for team member rows (05.11, 06.07). */
export function memberChip(member: CompanyMember): { label: string; tone: Tone } {
  if (member.status === "invited") return { label: "Invited", tone: "neutral" };
  switch (member.role) {
    case "owner":
      return { label: member.admin ? "Owner · Admin" : "Owner", tone: "info" };
    case "approver":
      return { label: "Approver", tone: "success" };
    case "finance":
      return { label: "Finance", tone: "warning" };
    default:
      return { label: "Viewer", tone: "neutral" };
  }
}

export function memberDetail(member: CompanyMember) {
  if (member.status === "invited") return member.title ?? "Invitation pending";
  if (member.role === "approver" && member.approvalLimit) return `Approval limit ${formatRupiah(member.approvalLimit)}`;
  return member.title ?? member.email;
}
