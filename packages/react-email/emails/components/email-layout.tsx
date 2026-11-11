import {
	Body,
	Container,
	Hr,
	Preview,
	Section,
	Tailwind,
	Text,
	pixelBasedPreset,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { emailTailwindTheme, fontFamily } from '../../src/theme';

/**
 * Shared email scaffold: background canvas, centered card, preview text,
 * divider and no-reply footer. Templates supply heading/body/CTA content
 * via `children` and translated strings via props.
 *
 * Styling constraints honored throughout: pixel-based preset (no rem),
 * no flex/grid, no media queries, no dark-mode selectors, text only
 * (no images for now).
 */
export function EmailLayout({
	preview,
	footer,
	children,
}: {
	preview: string;
	/** Pre-translated no-reply footer line. */
	footer: string;
	children: ReactNode;
}) {
	return (
		<Tailwind
			config={{
				presets: [pixelBasedPreset],
				theme: emailTailwindTheme,
			}}
		>
			<html lang="en">
				<head />
				<Preview>{preview}</Preview>
				<Body
					className="bg-background"
					style={{ fontFamily, margin: 0, padding: '32px 24px' }}
				>
					<Container
						className="bg-card mx-auto max-w-[560px] rounded"
						style={{
							padding: '32px',
							border: '1px solid #dcdfe2',
						}}
					>
						<Section>{children}</Section>
						<Hr className="border-solid border-border my-6" />
						<Text className="text-muted-foreground text-xs m-0">
							{footer}
						</Text>
					</Container>
				</Body>
			</html>
		</Tailwind>
	);
}

/**
 * Primary CTA button. `box-border` is required so padding never overflows
 * the button width; solid border is set explicitly because email clients
 * do not inherit border style.
 */
export function ActionButton({ url, label }: { url: string; label: string }) {
	return (
		<a
			href={url}
			className="bg-primary text-primary-foreground rounded inline-block box-border border-none px-6 py-3 text-center font-semibold no-underline"
			style={{
				fontSize: '14px',
				margin: '24px 0',
			}}
		>
			{label}
		</a>
	);
}

/**
 * Copy-paste fallback for clients that block or break the button link.
 */
export function FallbackLink({
	text,
	url,
}: {
	text: string;
	url: string;
}) {
	return (
		<Text
			className="text-muted-foreground m-0"
			style={{ fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-all' }}
		>
			{text}
			<br />
			<a href={url} className="text-muted-foreground underline">
				{url}
			</a>
		</Text>
	);
}
