import { useSyncExternalStore } from 'react';

/**
 * Minimal toast bus (ponytail: swap for sonner when toasts need queues,
 * actions, or stacking). Mount `<Toaster />` once in the root layout.
 */

export type ToastVariant = 'success' | 'error';

type ToastMessage = { id: number; message: string; variant: ToastVariant };

let messages: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(message: string, variant: ToastVariant) {
	const id = nextId++;
	messages = [...messages, { id, message, variant }];
	listeners.forEach((listener) => listener());
	setTimeout(() => {
		messages = messages.filter((toast) => toast.id !== id);
		listeners.forEach((listener) => listener());
	}, 5000);
}

export const toast = {
	success: (message: string) => emit(message, 'success'),
	error: (message: string) => emit(message, 'error'),
};

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function Toaster() {
	const current = useSyncExternalStore(
		subscribe,
		() => messages,
		() => messages,
	);

	if (current.length === 0) return null;

	return (
		<div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2'>
			{current.map((toast) => (
				<div
					key={toast.id}
					role='status'
					className={`rounded-md border px-4 py-2 text-sm shadow-md ${
						toast.variant === 'error'
							? 'border-destructive/40 bg-destructive/10 text-destructive'
							: 'border-border bg-background text-foreground'
					}`}
				>
					{toast.message}
				</div>
			))}
		</div>
	);
}
