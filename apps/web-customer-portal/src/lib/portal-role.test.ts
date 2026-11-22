import { describe, expect, test } from "bun:test";
import { isPortalCustomer, PORTAL_ROLE } from "./portal-role";

describe("portal role (ADR-0027)", () => {
  test("admits a login carrying the customer role, alone or with others", () => {
    expect(PORTAL_ROLE).toBe("customer");
    expect(isPortalCustomer({ roles: ["customer"] })).toBe(true);
    expect(isPortalCustomer({ roles: ["investor", "customer"] })).toBe(true);
  });

  test("refuses staff, other roles, no roles and sessions stored before roles existed", () => {
    expect(isPortalCustomer({ roles: ["admin"] })).toBe(false);
    expect(isPortalCustomer({ roles: ["user"] })).toBe(false);
    expect(isPortalCustomer({ roles: ["customers"] })).toBe(false);
    expect(isPortalCustomer({ roles: [] })).toBe(false);
    expect(isPortalCustomer({} as { roles: string[] })).toBe(false);
    expect(isPortalCustomer(undefined)).toBe(false);
  });
});
