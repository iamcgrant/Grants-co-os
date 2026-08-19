import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_VERCEL_APP_ORIGIN,
  PERMANENT_OS_ORIGIN,
  getDesktopFallbackOrigin,
  getDesktopPrimaryOrigin,
  getRequestOrigin,
} from "../src/lib/access/origins";
import {
  LOGIN_DATABASE_UNAVAILABLE_MESSAGE,
  PRODUCTION_SQLITE_REFUSAL,
  getProductionDatabaseRefusal,
  isProductionPostgresUrl,
} from "../src/lib/db/production-guard";

describe("production database guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects postgres URLs only", () => {
    expect(isProductionPostgresUrl("postgresql://u:p@localhost/db")).toBe(true);
    expect(isProductionPostgresUrl("postgres://u:p@localhost/db")).toBe(true);
    expect(isProductionPostgresUrl("file:./dev.db")).toBe(false);
    expect(isProductionPostgresUrl("")).toBe(false);
  });

  it("allows local sqlite when not on Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    expect(getProductionDatabaseRefusal()).toBeNull();
  });

  it("allows Vercel when DATABASE_URL is postgres", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost/db?sslmode=require");
    expect(getProductionDatabaseRefusal()).toBeNull();
  });

  it("refuses Vercel sqlite / missing URL", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    expect(getProductionDatabaseRefusal()).toBe(PRODUCTION_SQLITE_REFUSAL);

    vi.stubEnv("DATABASE_URL", "");
    expect(getProductionDatabaseRefusal()).toBe(PRODUCTION_SQLITE_REFUSAL);
  });

  it("can import prisma on Vercel sqlite without loading the native addon", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    expect(db.prisma).toBeDefined();
    expect(() => db.prisma.user).toThrow(/postgresql:\/\//);
  });

  it("health stays up and names the serverless sqlite refusal", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    vi.resetModules();
    const { GET } = await import("../src/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      database: string;
      databaseReason: string;
      databaseEngine: string;
    };
    expect(body.ok).toBe(false);
    expect(body.database).toBe("error");
    expect(body.databaseEngine).toBe("sqlite");
    expect(body.databaseReason).toBe(PRODUCTION_SQLITE_REFUSAL);
  });

  it("login returns 503 instead of a native sqlite crash", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    vi.resetModules();
    const { POST } = await import("../src/app/api/auth/login/route");
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@grantsandco.com", password: "not-used" }),
      }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; code: string; databaseReason: string };
    expect(body.code).toBe("PRODUCTION_DATABASE_NOT_CONFIGURED");
    expect(body.error).toBe(LOGIN_DATABASE_UNAVAILABLE_MESSAGE);
    expect(body.databaseReason).toBe(PRODUCTION_SQLITE_REFUSAL);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("better_sqlite3");
  });

  it("system health does not query prisma on serverless sqlite", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    vi.resetModules();
    const { collectSystemHealth } = await import("../src/lib/system/health");
    const health = await collectSystemHealth();
    expect(health.overall).toBe("ACTION_REQUIRED");
    expect(health.components).toHaveLength(1);
    expect(health.components[0]?.component).toBe("database");
    expect(health.components[0]?.detail).toBe(PRODUCTION_SQLITE_REFUSAL);
  });
});

describe("public access origins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the live Vercel origin until the permanent host is marked ready", () => {
    delete process.env.GC_DESKTOP_URL;
    delete process.env.GC_DESKTOP_FALLBACK_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.GC_PERMANENT_HOST_READY;
    expect(getDesktopPrimaryOrigin()).toBe(LIVE_VERCEL_APP_ORIGIN);
    expect(getDesktopFallbackOrigin()).toBe(PERMANENT_OS_ORIGIN);
  });

  it("only uses os.grantandconsultants.com when GC_PERMANENT_HOST_READY=1", async () => {
    vi.stubEnv("GC_PERMANENT_HOST_READY", "1");
    vi.resetModules();
    const origins = await import("../src/lib/access/origins");
    expect(origins.getCanonicalOnlineOrigin()).toBe(PERMANENT_OS_ORIGIN);
    expect(origins.getDesktopPrimaryOrigin()).toBe(PERMANENT_OS_ORIGIN);
  });

  it("rewrites a request to the NXDOMAIN host back to the live origin", () => {
    delete process.env.GC_PERMANENT_HOST_READY;
    const req = new Request("https://os.grantandconsultants.com/login", {
      headers: { host: "os.grantandconsultants.com", "x-forwarded-proto": "https" },
    });
    expect(getRequestOrigin(req)).toBe(LIVE_VERCEL_APP_ORIGIN);
  });

  it("keeps prepare-desktop-shell literals aligned with origins.ts", () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/prepare-desktop-shell.mjs"),
      "utf8",
    );
    expect(script).toContain(PERMANENT_OS_ORIGIN);
    expect(script).toContain(LIVE_VERCEL_APP_ORIGIN);
    expect(script).toContain("Trying backup address");
  });

  it("embeds both origins in the generated splash shell", () => {
    execSync("node scripts/prepare-desktop-shell.mjs", {
      cwd: process.cwd(),
      env: { ...process.env, GC_DESKTOP_URL: PERMANENT_OS_ORIGIN },
      stdio: "pipe",
    });
    const html = fs.readFileSync(
      path.join(process.cwd(), "desktop/public-desktop/index.html"),
      "utf8",
    );
    expect(html).toContain(PERMANENT_OS_ORIGIN);
    expect(html).toContain(LIVE_VERCEL_APP_ORIGIN);
    expect(html).toContain("Cannot reach OS");
  });
});
