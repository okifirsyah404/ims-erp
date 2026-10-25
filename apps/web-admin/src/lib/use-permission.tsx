import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authClient, useSession } from './auth-client'
import type { Permission } from './permissions'

const splitPermission = (permission: Permission) => {
  const dot = permission.lastIndexOf('.')
  return {
    resource: permission.slice(0, dot),
    action: permission.slice(dot + 1),
  }
}

/**
 * Frontend permission check for UX only (hide/disable actions, nav items).
 * NEVER a security boundary — the backend enforces every operation.
 *
 * Delegates to Better Auth's `/admin/has-permission` endpoint, which resolves
 * the session user's roles server-side against the same ERP access control
 * definitions used by API guards.
 */
export function usePermission(permission: Permission | Permission[]): boolean {
  const { data: session, isPending } = useSession()
  const { data } = useQuery({
    // ponytail: one query per hook call; fine at current nav size, switch to a
    // single batched hasPermission query if checks grow.
    queryKey: ['has-permission', session?.user?.id, permission],
    enabled: !isPending && !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const permissions = (Array.isArray(permission) ? permission : [permission]).map(
        (p) => {
          const { resource, action } = splitPermission(p)
          return { resource, action }
        },
      )
      const result = await authClient.admin.hasPermission({
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
 * Conditional rendering by permission. UX only — not a security boundary.
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
