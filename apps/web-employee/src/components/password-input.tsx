import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';

/**
 * Password input with a show/hide (eye) toggle, built on the shared
 * `InputGroup` primitives. The toggle is a `type="button"` (it never
 * submits the form); all other props are forwarded to the inner input.
 */
export function PasswordInput(props: React.ComponentProps<'input'>) {
	const [visible, setVisible] = useState(false);

	return (
		<InputGroup>
			<InputGroupInput type={visible ? 'text' : 'password'} {...props} />
			<InputGroupAddon align='inline-end'>
				<InputGroupButton
					size='icon-xs'
					aria-label={visible ? 'Hide password' : 'Show password'}
					aria-pressed={visible}
					onClick={() => setVisible((v) => !v)}
				>
					{visible ? <EyeOff /> : <Eye />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
