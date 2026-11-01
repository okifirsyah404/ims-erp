import { createFileRoute } from '@tanstack/react-router';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';

export const Route = createFileRoute('/_authed/profiles/edit')({
	component: ProfilesEditPage,
});

function ProfilesEditPage() {
	return <ProfileEditForm />;
}
