import { createFileRoute } from '@tanstack/react-router';
import { ProfileView } from '@/components/profile/profile-view';

export const Route = createFileRoute('/_authed/profiles/')({
	component: ProfilesPage,
});

function ProfilesPage() {
	return <ProfileView />;
}
