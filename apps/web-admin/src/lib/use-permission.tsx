import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { organization, useSession } from './auth-client'
import type { Permission } from './permissions'

export const splitPermission = (permission: Permission) => {
  const dot = permission.lastIndexOf('.')
  return {
    resource: permission.slice(0, dot),
    action: permission.slice(dot + 1),
  }
}

/**
 * Frontend permission check for UX only (hide/disable actions, nav items).
 * NEVER a security boundary - the backend enforces every operation.
 *
 * Delegates to Better Auth's organization `hasPermission` endpoint, which
 * resolves the caller's membership roles in the active organization
 * server-side against the same ERP access control definitions used by the
 * Elysia guard. The query key includes the active organization id so
 * switching organizations refreshes permissions immediately.
 */
export function usePermission(permission: Permission | Permission[]): boolean {
  const { data: session, isPending } = useSession()
  const activeOrgId = session?.session?.activeOrganizationId
  const { data } = useQuery({
    queryKey: ['erp-has-permission', session?.user?.id, activeOrgId, permission],
    enabled: !isPending && !!session?.user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const permissions = (Array.isArray(permission) ? permission : [permission]).map(
        (p) => {
          const { resource, action } = splitPermission(p)
          return { resource, action }
        },
      )
      const result = await organization.hasPermission({
        permissions: permissions.reduce<Record<string, string[]>>((acc, { resource, action }) => {
          ;(acc[resource] ??= []).push(action)
          return acc
        }, {}),
      })
      return result.data?.success === true
    },
  })
  return data === true
}

/**
 * Conditional rendering by permission. UX only - not a security boundary.
 */
export function Can({
  permission,
  children,
}: {
  permission: Permission | Permission[]
  children: ReactNode
}) {
  const allowed = usePermission(permission)
  if (!allowed) return null
  return <>{children}</>
}

/**
 * Lists the caller's organizations and their roles (UX helper for
 * organization switching menus). Backend remains authoritative.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: ['erp-organizations'],
    queryFn: async () => {
      const result = await organization.list()
      return result.data ?? []
    },
    staleTime: 60 * 1000,
  })
}

/**
 * Switches the active organization and refreshes permission queries.
 * Always call the backend (`organization.setActive`): the session value is what
 * the server authorizes against. The client store mirrors it — set it
 * optimistically in the caller and roll back if this throws
 * (`organization-store.ts`).
 */
export async function switchOrganization(organizationId: string) {
  await organization.setActive({ organizationId })
}
