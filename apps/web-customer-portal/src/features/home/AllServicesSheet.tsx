import {
  BadgePercent,
  Cpu,
  CalendarClock,
  FileText,
  FolderOpen,
  Headset,
  Kanban,
  LayoutGrid,
  Package,
  Receipt,
  Route,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "../../components/customer/BottomSheet";

/** 05.01b Home · All services sheet, opened from the "All Services" quick action. */
const groups: { title: string; items: { label: string; href: string; icon: LucideIcon }[] }[] = [
  {
    title: "Orders & projects",
    items: [
      { label: "Orders", href: "/orders", icon: Package },
      { label: "Tracking", href: "/tracking", icon: Route },
      { label: "Projects", href: "/projects", icon: Kanban },
      { label: "Documents", href: "/documents", icon: FolderOpen },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Invoices", href: "/payments", icon: Receipt },
      { label: "Payments", href: "/payments?tab=paid", icon: CreditCard },
      { label: "Promotions", href: "/notifications", icon: BadgePercent },
    ],
  },
  {
    title: "After-sales",
    items: [
      { label: "My Products", href: "/products", icon: Cpu },
      { label: "Warranty", href: "/products", icon: ShieldCheck },
      { label: "Book Service", href: "/support/book", icon: CalendarClock },
      { label: "Support", href: "/support", icon: Headset },
    ],
  },
];

export default function AllServicesSheet() {
  return (
    <BottomSheet
      title="All services"
      subtitle="Everything for your account, one tap away"
      trigger={
        <button type="button" className="group flex w-[76px] flex-col items-center gap-2">
          <span className="flex size-14 items-center justify-center rounded-lg bg-navy-900 text-white" aria-hidden="true">
            <LayoutGrid className="size-6" />
          </span>
          <span className="text-center text-[12px] font-medium text-fg-secondary">All Services</span>
        </button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3.5">
            <h3 className="text-[11.5px] font-bold tracking-[1.2px] text-fg-muted uppercase">{group.title}</h3>
            <ul className="grid grid-cols-4 gap-y-4">
              {group.items.map(({ label, href, icon: Icon }) => (
                <li key={label} className="flex justify-center">
                  <a href={href} className="flex w-[76px] flex-col items-center gap-2">
                    <span className="flex size-14 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
                      <Icon className="size-6" />
                    </span>
                    <span className="text-center text-[12px] font-medium text-fg-secondary">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}
