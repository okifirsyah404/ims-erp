import { describe, expect, test } from "bun:test";
import { DEFAULT_LANGUAGE, isPortalLanguage, resolveLanguage } from "./language";

describe("portal language (Accept-Language from the portal's cookie)", () => {
  test("en and id are kept; anything else falls back to English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(resolveLanguage("id")).toBe("id");
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("fr")).toBe("en");
    expect(resolveLanguage("ID")).toBe("en");
    expect(resolveLanguage("")).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
    expect(isPortalLanguage("id")).toBe(true);
    expect(isPortalLanguage(1)).toBe(false);
  });
});
