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
  { label: 'Dashboard', to: '/', permission: 'dashboard.view' },
  { label: 'CRM & Sales', to: '/crm', permission: 'crm.lead.view' },
  { label: 'Licensing', to: '/licenses', permission: 'license.view' },
  { label: 'Inventory', to: '/inventory', permission: 'inventory.stock.view' },
  { label: 'Purchasing', to: '/purchasing', permission: 'purchasing.purchase.view' },
  { label: 'Assets', to: '/assets', permission: 'assets.view' },
  { label: 'Projects', to: '/projects', permission: 'projects.project.view' },
  { label: 'Tickets', to: '/tickets', permission: 'support.ticket.view' },
  { label: 'Employees & HR', to: '/hr', permission: 'hr.employee.view' },
  { label: 'Payroll', to: '/payroll', permission: 'payroll.view' },
  { label: 'Finance', to: '/finance', permission: 'finance.account.view' },
  { label: 'Tax', to: '/tax', permission: 'tax.report.view' },
  { label: 'Investors (Admin)', to: '/investor-admin', permission: 'investor.view' },
  { label: 'Orders', to: '/orders', permission: 'customer.portal.view' },
  { label: 'My Licenses', to: '/my-licenses', permission: 'customer.portal.view' },
  { label: 'Capital', to: '/capital', permission: 'investor.portal.view' },
  { label: 'Results', to: '/results', permission: 'investor.portal.view' },
  { label: 'Payments', to: '/payments', permission: 'investor.payment.view' },
  { label: 'Reports', to: '/reports', permission: 'reports.view' },
  { label: 'Users', to: '/users', permission: 'users.view' },
  { label: 'Roles', to: '/roles', permission: 'roles.view' },
  { label: 'Audit', to: '/audit', permission: 'audit.view' },
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
