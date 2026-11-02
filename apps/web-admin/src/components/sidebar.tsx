import { Link } from '@tanstack/react-router'
import { Can } from '../lib/use-permission'
import { signOut, useSession } from '../lib/auth-client'
import type { Permission } from '../lib/permissions'
import { Button } from '@workspace/ui/components/button'

interface NavItem {
  label: string
  to: string
  permission: Permission
}

// Permission-driven navigation: visibility is filtered by ERP permissions.
// Hidden ≠ safe — every route behind these items enforces permissions
// server-side.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', permission: 'dashboard.read' },
  { label: 'CRM & Sales', to: '/crm', permission: 'lead.read' },
  { label: 'Licensing', to: '/licenses', permission: 'license.read' },
  { label: 'Inventory', to: '/inventory', permission: 'stock.read' },
  { label: 'Purchasing', to: '/purchasing', permission: 'purchase_order.read' },
  { label: 'Assets', to: '/assets', permission: 'asset.read' },
  { label: 'Projects', to: '/projects', permission: 'project.read' },
  { label: 'Tickets', to: '/tickets', permission: 'service_ticket.read' },
  { label: 'Employees & HR', to: '/hr', permission: 'employee.read' },
  { label: 'Payroll', to: '/payroll', permission: 'payroll.read' },
  { label: 'Finance', to: '/finance', permission: 'chart_of_account.read' },
  { label: 'Tax', to: '/tax', permission: 'tax.read' },
  { label: 'Investors (Admin)', to: '/investor-admin', permission: 'investor.read' },
  { label: 'Orders', to: '/orders', permission: 'customer_portal.read_invoice' },
  { label: 'My Licenses', to: '/my-licenses', permission: 'customer_portal.read_document' },
  { label: 'Capital', to: '/capital', permission: 'investor_portal.read_report' },
  { label: 'Results', to: '/results', permission: 'investor_portal.read_distribution' },
  { label: 'Payments', to: '/payments', permission: 'payment.read' },
  { label: 'Reports', to: '/reports', permission: 'financial_report.read' },
  { label: 'Users', to: '/admin/users', permission: 'member.create' },
  { label: 'Roles', to: '/admin/roles', permission: 'ac.read' },
  { label: 'Audit', to: '/admin/audit', permission: 'audit_log.read' },
]

export function Sidebar() {
  const { data: session } = useSession()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold">Entragate ERP</p>
        {session?.user && (
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {session.user.name}
          </p>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <Can key={item.to} permission={item.permission}>
            <Link
              to={item.to}
              className="hover:bg-accent block rounded-md px-3 py-2 text-sm"
              activeProps={{ className: 'bg-accent font-medium' }}
            >
              {item.label}
            </Link>
          </Can>
        ))}
      </nav>
      {session?.user && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={() => signOut().then(() => window.location.assign('/login'))}
          >
            Sign out
          </Button>
        </div>
      )}
    </aside>
  )
}
