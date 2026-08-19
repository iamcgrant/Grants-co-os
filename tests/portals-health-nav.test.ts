import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { detectDatabaseEngine, databaseEngineLabel } from "../src/lib/system/database-engine";
import { getDesktopNav, getStaffNav } from "../src/lib/nav/role-nav";
import {
  getPortalCatalog,
  isPortalProviderId,
  resolveLaunchMode,
} from "../src/lib/portals/catalog";
import { CREDIT_KARMA_ASSISTED_SOURCE } from "../src/lib/credit/assisted-karma";
import { verifyInboundWebhook, webhookSecretConfigured } from "../src/lib/webhooks/ingest";
import { createHmac } from "node:crypto";

describe("database engine honesty", () => {
  it("labels postgres vs sqlite from DATABASE_URL", () => {
    expect(detectDatabaseEngine("postgresql://u:p@localhost/db")).toBe("postgres");
    expect(detectDatabaseEngine("file:./dev.db")).toBe("sqlite");
    expect(databaseEngineLabel("postgres")).toBe("Postgres");
    expect(databaseEngineLabel("sqlite")).toBe("SQLite");
  });
});

describe("credit & disputes nav", () => {
  it("exposes Credit & Disputes for owner and file preparer", () => {
    expect(getDesktopNav("OWNER").some((n) => n.href === "/credit")).toBe(true);
    expect(getDesktopNav("FILE_PREPARER").some((n) => n.href === "/credit")).toBe(true);
    expect(getStaffNav("OWNER").some((n) => n.href === "/credit")).toBe(true);
    expect(getDesktopNav("OWNER").some((n) => n.href === "/team")).toBe(true);
  });
});

describe("portal catalog", () => {
  it("keeps Experian and CFPB official URLs and defaults to new tab", () => {
    const catalog = getPortalCatalog();
    expect(catalog.EXPERIAN.officialUrl).toContain("experian.com");
    expect(catalog.CFPB.officialUrl).toContain("consumerfinance.gov");
    expect(catalog.CREDIT_KARMA.assistedOnly).toBe(true);
    expect(catalog.CREDIT_KARMA.iframeAllowed).toBe(false);
    expect(resolveLaunchMode(catalog.EXPERIAN)).toBe("NEW_TAB");
    expect(isPortalProviderId("CFPB")).toBe(true);
    expect(isPortalProviderId("TWILIO")).toBe(false);
  });
});

describe("webhook ingest fail-closed", () => {
  const prev = process.env.GHL_WEBHOOK_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.GHL_WEBHOOK_SECRET;
    else process.env.GHL_WEBHOOK_SECRET = prev;
  });

  it("rejects when secret is missing", () => {
    delete process.env.GHL_WEBHOOK_SECRET;
    expect(webhookSecretConfigured("ghl")).toBe(false);
    expect(
      verifyInboundWebhook({
        provider: "ghl",
        rawBody: "{}",
        headers: { "x-webhook-secret": "nope" },
      }),
    ).toBe(false);
  });

  it("accepts matching HMAC", () => {
    process.env.GHL_WEBHOOK_SECRET = "unit-test-secret";
    const rawBody = JSON.stringify({ id: "evt_1", type: "InboundMessage" });
    const sig = createHmac("sha256", "unit-test-secret").update(rawBody, "utf8").digest("hex");
    expect(
      verifyInboundWebhook({
        provider: "ghl",
        rawBody,
        headers: { "x-webhook-signature": sig },
      }),
    ).toBe(true);
  });
});

const testDb = path.join(process.cwd(), "prisma", "test-portals-health.db");

describe("portals, assisted CK, honest health", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.AUTH_SECRET = "test-secret-for-vitest-only-32chars!!";
    delete process.env.GHL_API_KEY;
    delete process.env.COMMAS_API_KEY;
    delete process.env.SMARTCREDIT_SPONSOR_URL;
    resetSqliteFromSchema(testDb);
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    vi.resetModules();
    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("does not mark GHL Connected from a missing key", async () => {
    const { collectSystemHealth } = await import("@/lib/system/health");
    const health = await collectSystemHealth();
    const ghlAuth = health.components.find((c) => c.component === "ghl_auth");
    const ghlOut = health.components.find((c) => c.component === "ghl_outbound");
    const db = health.components.find((c) => c.component === "database");
    expect(ghlAuth?.status).toBe("ACTION_REQUIRED");
    expect(ghlOut?.status).toBe("ACTION_REQUIRED");
    expect(ghlOut?.detail).toContain("conversations/message.write");
    expect(db?.detail).toMatch(/SQLite/i);
    expect(health.components.some((c) => c.component === "experian_portal")).toBe(true);
    expect(health.components.some((c) => c.component === "cfpb_portal")).toBe(true);
    expect(JSON.stringify(health).toLowerCase()).not.toContain("whsk_");
  });

  it("records a portal session and assisted Credit Karma scores", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "owner-portals@example.com",
        passwordHash: "x",
        firstName: "Charles",
        lastName: "Grant",
        role: "OWNER",
      },
    });
    const client = await prisma.client.create({
      data: {
        grantsClientId: "GC-009901",
        email: "portal.client@example.com",
        emailNormalized: "portal.client@example.com",
        firstName: "Pat",
        lastName: "Portal",
      },
    });

    const { openPortalSession, recordPortalResult } = await import("@/lib/portals/service");
    const opened = await openPortalSession({
      provider: "CFPB",
      openedById: owner.id,
      clientId: client.id,
    });
    expect(opened.launchMode).toBe("NEW_TAB");
    expect(opened.entry.officialUrl).toContain("consumerfinance.gov");

    const recorded = await recordPortalResult({
      sessionId: opened.session.id,
      actorId: owner.id,
      resultStatus: "FILED",
      externalRef: "CFPB-TEST-1",
    });
    expect(recorded.resultStatus).toBe("FILED");

    const { recordAssistedCreditKarmaScores } = await import("@/lib/credit/assisted-karma");
    const scores = await recordAssistedCreditKarmaScores({
      clientId: client.id,
      actorId: owner.id,
      scores: [
        { bureau: "EQUIFAX", score: 701 },
        { bureau: "TRANSUNION", score: 688 },
      ],
    });
    expect(scores.scores).toHaveLength(2);
    expect(scores.scores[0]?.source).toBe(CREDIT_KARMA_ASSISTED_SOURCE);

    const { ingestVerifiedWebhook } = await import("@/lib/webhooks/ingest");
    process.env.GHL_WEBHOOK_SECRET = "unit-test-secret";
    const rawBody = JSON.stringify({ id: "evt_portal_1", type: "InboundMessage" });
    const sig = createHmac("sha256", "unit-test-secret").update(rawBody, "utf8").digest("hex");
    const ingested = await ingestVerifiedWebhook({
      provider: "ghl",
      rawBody,
      headers: { "x-webhook-signature": sig },
    });
    expect(ingested.accepted).toBe(true);
    const again = await ingestVerifiedWebhook({
      provider: "ghl",
      rawBody,
      headers: { "x-webhook-signature": sig },
    });
    expect(again.duplicate).toBe(true);
  });
});
