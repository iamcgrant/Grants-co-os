import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import { Role } from "@/generated/prisma/client";

describe("Owner unrestricted staff permissions", () => {
  it("OWNER has every permission except client-portal-only", () => {
    const all = Object.keys(PERMISSIONS) as Permission[];
    for (const p of all) {
      if (p === "VIEW_OWN_CLIENT_PORTAL") {
        expect(hasPermission(Role.OWNER, p)).toBe(false);
        continue;
      }
      expect(hasPermission(Role.OWNER, p), `OWNER missing ${p}`).toBe(true);
    }
  });
});
