import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organization } from '@/lib/auth-client';

/**
 * Switches the active organization.
 *
 * @remarks
 * Always goes through `organization.setActive` first: the session value is
 * what the backend authorizes against, and the portal's guard resolves the
 * employee from it. Every portal query is then invalidated so no card shows
 * the previous organization's data.
 */
export function useOrganizationSwitch() {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (organizationId: string) => organization.setActive({ organizationId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['employee-portal'] });
		},
	});

	return {
		switching: mutation.isPending,
		switchOrganization: async (organizationId: string) => {
			await mutation.mutateAsync(organizationId);
		},
	};
}
