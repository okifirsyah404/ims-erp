import { useState } from 'react';
import { Building2 } from 'lucide-react';

/**
 * Organization logo. Falls back to the `Building2` icon when the logo is
 * unset (`null`) or the image fails to load.
 */
export function OrgLogo({ src, className }: { src: string | null; className?: string }) {
	const [failed, setFailed] = useState(false);
	if (!src || failed) return <Building2 className={className} />;
	return (
		<img
			src={src}
			alt=''
			className={`rounded-md object-cover ${className ?? ''}`}
			onError={() => setFailed(true)}
		/>
	);
}
