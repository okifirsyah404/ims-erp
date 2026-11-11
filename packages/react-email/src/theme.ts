/**
 * Email theme — extracted from the shadcn tokens in
 * `packages/ui/src/styles/globals.css` (style `base-nova`, base color
 * `stone`, light mode only).
 *
 * `globals.css` remains the source of truth: when a token changes there,
 * mirror the new value here. Email clients cannot resolve CSS variables or
 * `oklch()` reliably, so values are pre-converted to hex. Dark mode is
 * intentionally not themed (`dark:` selectors are unsupported in email).
 */

/** `--background` → page canvas behind the card. */
export const colorBackground = '#e8ebed';
/** `--card` → the email card surface. */
export const colorCard = '#ffffff';
/** `--card-foreground` / `--foreground` → body text. */
export const colorForeground = '#333333';
/** `--primary` → CTA button background. */
export const colorPrimary = '#df6035';
/** `--primary-foreground` → CTA button text. */
export const colorPrimaryForeground = '#ffffff';
/** `--muted` → soft filler sections. */
export const colorMuted = '#f9fafb';
/** `--muted-foreground` → secondary text (fallback links, footer). */
export const colorMutedForeground = '#6b7280';
/** `--border` → dividers. */
export const colorBorder = '#dcdfe2';
/** `--destructive` — reserved for future error-state emails. */
export const colorDestructive = '#ef4444';

/** `--radius` (0.5rem) — email clients ignore `rem`, so the px equivalent. */
export const radius = 8;

/**
 * Webfont fallback stack. `globals.css` loads Nunito Sans as a webfont, but
 * email clients only honor that in Apple Mail/iOS; everywhere else the
 * system fallbacks render instead.
 */
export const fontFamily =
	"'Nunito Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Tailwind theme passed to `<Tailwind config>` together with `pixelBasedPreset`. */
export const emailTailwindTheme = {
	extend: {
		colors: {
			background: colorBackground,
			card: colorCard,
			foreground: colorForeground,
			primary: colorPrimary,
			'primary-foreground': colorPrimaryForeground,
			muted: colorMuted,
			'muted-foreground': colorMutedForeground,
			border: colorBorder,
			destructive: colorDestructive,
		},
		borderRadius: {
			DEFAULT: `${radius}px`,
			xs: `${radius / 2}px`,
		},
		fontFamily: {
			sans: fontFamily,
		},
	},
} as const;
