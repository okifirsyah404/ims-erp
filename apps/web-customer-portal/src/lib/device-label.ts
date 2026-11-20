/**
 * "Chrome on Windows" from a browser's user agent (ERP-0081, Settings › Active devices).
 * A rough label for recognising one's own devices, not a parser.
 */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return system ? `${browser} on ${system}` : browser;
}

/** Phones and tablets get a phone icon. */
export const isMobileAgent = (userAgent: string | null) => Boolean(userAgent && /iPhone|iPad|Android|Mobile/.test(userAgent));

/** The address to show, or `null` for an empty one (`::`, `0000:…:0000`, `0.0.0.0`). */
export const displayIp = (ip: string | null) => (ip && !/^[0:.]+$/.test(ip) ? ip : null);
