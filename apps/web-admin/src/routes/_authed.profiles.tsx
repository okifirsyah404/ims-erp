import { createFileRoute } from '@tanstack/react-router';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';

/**
 * Self profile (`/profiles`, ERP-0111): the page is the editor itself — the
 * read-only detail view and the `/profiles/edit` tab were removed. Account
 * settings (username, email, password, connected accounts, sessions) live on
 * `/accounts`.
 */
export const Route = createFileRoute('/_authed/profiles')({
	component: ProfilesPage,
});

function ProfilesPage() {
	return (
		<div className='mx-auto w-full max-w-2xl'>
			<ProfileEditForm />
		</div>
	);
}
