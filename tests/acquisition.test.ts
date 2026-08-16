import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { resetSqliteFromSchema } from "./helpers/sqlite-schema";
import { MASTER_ONBOARDING_ITEMS } from "../src/lib/clients/onboarding";
import {
  ACQUISITION_SOURCES,
  CONSUMER_LEAD_STAGES,
  PARTNER_PIPELINE_STAGES,
} from "../src/lib/acquisition/types";
import {
  ACQUISITION_MARKETS,
  DEFAULT_PROSPECTING_MARKETS,
  PRIMARY_ACQUISITION_MARKETS,
  SECONDARY_ACQUISITION_MARKETS,
} from "../src/lib/acquisition/markets";

const testDb = path.join(process.cwd(), "prisma", "test-acquisition.db");

describe("Acquisition command center — two engines, one master", () => {
  let prisma: import("../src/generated/prisma/client").PrismaClient;
  let createPartner: typeof import("../src/lib/acquisition/partners").createPartner;
  let updatePartnerStage: typeof import("../src/lib/acquisition/partners").updatePartnerStage;
  let openConsumerLead: typeof import("../src/lib/acquisition/consumers").openConsumerLead;
  let convertConsumerLead: typeof import("../src/lib/acquisition/consumers").convertConsumerLead;
  let preserveClientCommsFlags: typeof import("../src/lib/acquisition/consumers").preserveClientCommsFlags;
  let getAcquisitionDashboard: typeof import("../src/lib/acquisition/dashboard").getAcquisitionDashboard;
  let parseAcquisitionSource: typeof import("../src/lib/acquisition/source").parseAcquisitionSource;
  let mapAcquisitionSourceToAttribution: typeof import("../src/lib/acquisition/source").mapAcquisitionSourceToAttribution;
  let parseAcquisitionMarket: typeof import("../src/lib/acquisition/markets").parseAcquisitionMarket;
  let requireAcquisitionMarket: typeof import("../src/lib/acquisition/markets").requireAcquisitionMarket;
  let scoreGrantsLead: typeof import("../src/lib/acquisition/score").scoreGrantsLead;
  let AcquisitionError: typeof import("../src/lib/acquisition/types").AcquisitionError;
  let ACQUISITION_LOCKS: typeof import("../src/lib/acquisition/locks").ACQUISITION_LOCKS;
  let ACQUISITION_DO_NOT_ENROLL: typeof import("../src/lib/acquisition/locks").ACQUISITION_DO_NOT_ENROLL;
  let DATA_UNAVAILABLE: typeof import("../src/lib/marketing/lead-attribution").DATA_UNAVAILABLE;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${testDb}`;
    resetSqliteFromSchema(testDb);

    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;

    const db = await import("../src/lib/db/prisma");
    prisma = db.prisma;
    const partners = await import("../src/lib/acquisition/partners");
    const consumers = await import("../src/lib/acquisition/consumers");
    const dashboard = await import("../src/lib/acquisition/dashboard");
    const source = await import("../src/lib/acquisition/source");
    const score = await import("../src/lib/acquisition/score");
    const types = await import("../src/lib/acquisition/types");
    const locks = await import("../src/lib/acquisition/locks");
    const attr = await import("../src/lib/marketing/lead-attribution");

    createPartner = partners.createPartner;
    updatePartnerStage = partners.updatePartnerStage;
    openConsumerLead = consumers.openConsumerLead;
    convertConsumerLead = consumers.convertConsumerLead;
    preserveClientCommsFlags = consumers.preserveClientCommsFlags;
    getAcquisitionDashboard = dashboard.getAcquisitionDashboard;
    parseAcquisitionSource = source.parseAcquisitionSource;
    mapAcquisitionSourceToAttribution = source.mapAcquisitionSourceToAttribution;
    const markets = await import("../src/lib/acquisition/markets");
    parseAcquisitionMarket = markets.parseAcquisitionMarket;
    requireAcquisitionMarket = markets.requireAcquisitionMarket;
    scoreGrantsLead = score.scoreGrantsLead;
    AcquisitionError = types.AcquisitionError;
    ACQUISITION_LOCKS = locks.ACQUISITION_LOCKS;
    ACQUISITION_DO_NOT_ENROLL = locks.ACQUISITION_DO_NOT_ENROLL;
    DATA_UNAVAILABLE = attr.DATA_UNAVAILABLE;
  });

  beforeEach(async () => {
    await prisma.partnerReferral.deleteMany();
    await prisma.leadAttribution.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.onboardingItem.deleteMany();
    await prisma.fridayPulseItem.deleteMany();
    await prisma.fridayPulseRun.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.clientTimelineEvent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.partner.deleteMany();
    await prisma.client.deleteMany();
    await prisma.idSequence.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    for (const f of [testDb, `${testDb}-journal`, `${testDb}-wal`, `${testDb}-shm`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  async function seedMaster(grantsClientId = "GC-000401") {
    return prisma.client.create({
      data: {
        grantsClientId,
        email: `${grantsClientId.toLowerCase()}@example.com`,
        emailNormalized: `${grantsClientId.toLowerCase()}@example.com`,
        firstName: "Pat",
        lastName: "Master",
      },
    });
  }

  it("exposes the specified partner, consumer, and source enums", () => {
    expect(PARTNER_PIPELINE_STAGES).toEqual([
      "NEW_PROSPECT",
      "QUALIFIED_PARTNER_PROSPECT",
      "OUTREACH_READY",
      "CONTACTED",
      "REPLIED",
      "INTRO_CALL",
      "PARTNER_INTERESTED",
      "ACTIVE_REFERRAL_PARTNER",
      "REFERRED_FIRST_CLIENT",
      "ACTIVE_PRODUCING_PARTNER",
      "NURTURE",
      "NOT_INTERESTED",
      "DND",
    ]);
    expect(CONSUMER_LEAD_STAGES).toEqual([
      "NEW_LEAD",
      "ATTEMPTING_CONTACT",
      "ENGAGED",
      "CONSULTATION_BOOKED",
      "CONSULTATION_COMPLETED",
      "QUALIFIED",
      "PAYMENT_PENDING",
      "PAID_ONBOARDING",
      "CONVERTED_CLIENT",
      "NURTURE",
      "LOST",
      "DND",
    ]);
    expect(ACQUISITION_SOURCES).toEqual([
      "GHL_PROSPECTING",
      "PROSPECT_AI",
      "REALTOR_PARTNER",
      "MORTGAGE_PARTNER",
      "BUILDER_PARTNER",
      "FORMER_CLIENT_REFERRAL",
      "FACEBOOK",
      "INSTAGRAM",
      "GOOGLE",
      "WEBSITE",
      "ORGANIC",
      "EMAIL_CAMPAIGN",
      "REACTIVATION_CAMPAIGN",
      "OTHER",
    ]);
  });

  it("partner is not a Client and createClient is refused", async () => {
    const { partner, sideEffects } = await createPartner({
      businessName: "Example Realty",
      contactFirstName: "Alex",
      contactLastName: "Broker",
      email: "realty@example.com",
      partnerType: "REALTOR",
      acquisitionSource: "REALTOR_PARTNER",
      market: "HILTON_HEAD_ISLAND_SC",
    });

    expect(partner.businessName).toBe("Example Realty");
    expect(partner.pipelineStage).toBe("NEW_PROSPECT");
    expect(partner.market).toBe("HILTON_HEAD_ISLAND_SC");
    expect(await prisma.client.count()).toBe(0);
    expect(await prisma.client.findUnique({ where: { id: partner.id } })).toBeNull();
    expect(sideEffects).toEqual({
      friday: false,
      welcome: false,
      sms: false,
      ghlContactWrites: false,
      workflowPublish: false,
    });

    await expect(
      createPartner({
        businessName: "Nope LLC",
        createClient: true,
        acquisitionSource: "OTHER",
        market: "BLUFFTON_SC",
      }),
    ).rejects.toMatchObject({ code: "PARTNER_IS_NOT_A_CLIENT" });

    const client = await seedMaster();
    await expect(
      createPartner({
        businessName: "Mixed",
        email: client.email,
        clientId: client.id,
        market: "SAVANNAH_GA",
      }),
    ).rejects.toMatchObject({ code: "REFUSE_MIX_PARTNER_CLIENT" });

    expect(await prisma.partner.count()).toBe(1);
    expect(await prisma.client.count()).toBe(1);
  });

  it("converting a lead does not create a second master and reuses existing onboarding", async () => {
    const master = await seedMaster();
    const before = await prisma.client.count();

    const opened = await openConsumerLead({
      clientId: master.id,
      acquisitionSource: "FACEBOOK",
      campaignId: "camp_1",
      contentId: "vid_1",
      adId: "ad_1",
      cta: "book_consult",
    });
    expect(opened.created).toBe(false);
    expect(opened.client.id).toBe(master.id);
    expect(opened.client.acquisitionStage).toBe("NEW_LEAD");
    expect(await prisma.client.count()).toBe(before);

    await expect(
      convertConsumerLead({
        clientId: master.id,
        createClient: true,
        email: "second.human@example.com",
        firstName: "Second",
        lastName: "Human",
      }),
    ).rejects.toMatchObject({ code: "REFUSE_CREATE_CLIENT" });
    expect(await prisma.client.count()).toBe(before);

    const converted = await convertConsumerLead({ clientId: master.id, paid: true });
    expect(converted.client.id).toBe(master.id);
    expect(converted.client.acquisitionStage).toBe("PAID_ONBOARDING");
    expect(converted.client.stage).toBe("ONBOARDING");
    expect(await prisma.client.count()).toBe(before);

    const items = await prisma.onboardingItem.findMany({ where: { clientId: master.id } });
    expect(items.map((i) => i.key).sort()).toEqual(
      MASTER_ONBOARDING_ITEMS.map((i) => i.key).slice().sort(),
    );

    const again = await openConsumerLead({
      email: master.email,
      firstName: "Pat",
      lastName: "Master",
      acquisitionSource: "WEBSITE",
    });
    expect(again.created).toBe(false);
    expect(again.client.id).toBe(master.id);
    expect(await prisma.client.count()).toBe(before);
  });

  it("PartnerReferral is written only after conversion", async () => {
    const { partner } = await createPartner({
      businessName: "Example Mortgage",
      email: "mortgage@example.com",
      partnerType: "MORTGAGE",
      acquisitionSource: "MORTGAGE_PARTNER",
      market: "ATLANTA_GA",
    });
    const master = await seedMaster();

    const opened = await openConsumerLead({
      clientId: master.id,
      referredByPartnerId: partner.id,
      acquisitionSource: "MORTGAGE_PARTNER",
    });
    expect(await prisma.partnerReferral.count()).toBe(0);
    expect(opened.client.acquisitionMarket).toBe("ATLANTA_GA");

    const converted = await convertConsumerLead({ clientId: master.id });
    expect(converted.referral?.partnerId).toBe(partner.id);
    expect(converted.referral?.clientId).toBe(master.id);
    expect(converted.referral?.market).toBe("ATLANTA_GA");
    expect(await prisma.partnerReferral.count()).toBe(1);

    const updatedPartner = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updatedPartner.pipelineStage).toBe("REFERRED_FIRST_CLIENT");
  });

  it("preserves DND and unsubscribe on convert and flag updates", async () => {
    const master = await seedMaster();
    await openConsumerLead({
      clientId: master.id,
      doNotContact: true,
      unsubscribed: true,
      acquisitionSource: "EMAIL_CAMPAIGN",
    });

    const converted = await convertConsumerLead({ clientId: master.id });
    expect(converted.client.doNotContact).toBe(true);
    expect(converted.client.unsubscribed).toBe(true);

    const clearedAttempt = await preserveClientCommsFlags({
      clientId: master.id,
      doNotContact: false,
      unsubscribed: false,
    });
    expect(clearedAttempt.doNotContact).toBe(true);
    expect(clearedAttempt.unsubscribed).toBe(true);

    const { partner } = await createPartner({
      businessName: "Quiet Builder",
      email: "builder@example.com",
      doNotContact: true,
      unsubscribed: true,
      acquisitionSource: "BUILDER_PARTNER",
      market: "WASHINGTON_DC",
    });
    const moved = await updatePartnerStage({
      partnerId: partner.id,
      pipelineStage: "OUTREACH_READY",
    });
    expect(moved.doNotContact).toBe(true);
    expect(moved.unsubscribed).toBe(true);
    expect(moved.grantsLeadScore).toBe(0);
  });

  it("score ignores protected attributes", () => {
    const base = scoreGrantsLead({
      acquisitionStage: "ENGAGED",
      acquisitionSource: "WEBSITE",
    });
    const withProtected = scoreGrantsLead({
      acquisitionStage: "ENGAGED",
      acquisitionSource: "WEBSITE",
      race: "ignored",
      gender: "ignored",
      age: 22,
      religion: "ignored",
      zipCode: "00000",
      nationalOrigin: "ignored",
      disability: true,
    });

    expect(withProtected.score).toBe(base.score);
    expect(withProtected.reasons.some((r) => r.code === "PROTECTED_ATTRIBUTES_IGNORED")).toBe(true);
    expect(withProtected.reasons.find((r) => r.code === "PROTECTED_ATTRIBUTES_IGNORED")?.points).toBe(0);
    expect(base.score).toBeGreaterThan(0);
  });

  it("Friday and welcome are not triggered on partner create or convert", async () => {
    expect(ACQUISITION_LOCKS.fridayEnabled).toBe(false);
    expect(ACQUISITION_LOCKS.welcomeEnabled).toBe(false);
    expect(ACQUISITION_DO_NOT_ENROLL.fridayPulse).toBe(false);
    expect(ACQUISITION_DO_NOT_ENROLL.welcome).toBe(false);
    expect(ACQUISITION_LOCKS.coldSmsEnabled).toBe(false);
    expect(ACQUISITION_LOCKS.ghlContactWritesEnabled).toBe(false);

    const master = await seedMaster();
    const opened = await openConsumerLead({
      clientId: master.id,
      acquisitionSource: "GOOGLE",
    });
    const converted = await convertConsumerLead({ clientId: master.id });

    expect(opened.sideEffects.friday).toBe(false);
    expect(opened.sideEffects.welcome).toBe(false);
    expect(converted.sideEffects.friday).toBe(false);
    expect(converted.sideEffects.welcome).toBe(false);
    expect(await prisma.fridayPulseRun.count()).toBe(0);
    expect(await prisma.fridayPulseItem.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);

    const srcDir = path.join(process.cwd(), "src/lib/acquisition");
    for (const file of fs.readdirSync(srcDir)) {
      const src = fs.readFileSync(path.join(srcDir, file), "utf8");
      expect(src).not.toMatch(/runFridayCreditPulse/);
      expect(src).not.toMatch(/fridayPulseRun\.create/);
      expect(src).not.toMatch(/fridayPulseItem\.create/);
      expect(src).not.toMatch(/from ["']@\/lib\/integrations\/ghl\/http["']/);
      expect(src).not.toMatch(/createGhlContact|sendGhl|publishWorkflow/);
    }
  });

  it("source is required or unknown — never coerced to organic", async () => {
    expect(parseAcquisitionSource(undefined)).toBeNull();
    expect(parseAcquisitionSource("")).toBeNull();
    expect(parseAcquisitionSource("ORGANIC")).toBe("ORGANIC");
    expect(() => parseAcquisitionSource("", { required: true })).toThrow(AcquisitionError);
    expect(() => parseAcquisitionSource(undefined, { required: true })).toThrow(/unknown/i);
    expect(mapAcquisitionSourceToAttribution(null)).toBe("unknown");
    expect(mapAcquisitionSourceToAttribution("ORGANIC")).toBe("unknown");
    expect(mapAcquisitionSourceToAttribution("FACEBOOK")).toBe("facebook");

    const master = await seedMaster();
    const opened = await openConsumerLead({ clientId: master.id });
    expect(opened.client.acquisitionSource).toBeNull();
    expect(opened.client.acquisitionSource).not.toBe("ORGANIC");

    const organic = await openConsumerLead({
      clientId: master.id,
      acquisitionSource: "ORGANIC",
    });
    expect(organic.client.acquisitionSource).toBe("ORGANIC");

    const missingAttr = await prisma.leadAttribution.findMany({ where: { clientId: master.id } });
    for (const row of missingAttr) {
      expect(String(row.source)).not.toBe("organic");
    }
  });

  it("dashboard stubs return DATA UNAVAILABLE when unstamped, then real counts", async () => {
    const empty = await getAcquisitionDashboard();
    expect(empty.metrics.newLeadsToday.status).toBe(DATA_UNAVAILABLE);
    expect(empty.metrics.conversionRate.status).toBe(DATA_UNAVAILABLE);
    expect(empty.metrics.revenueBySource.status).toBe(DATA_UNAVAILABLE);
    expect(empty.metrics.partnerProspects.value).toBeNull();
    expect(empty.metrics.newLeadsToday.reason).toMatch(/DATA UNAVAILABLE/i);
    expect(empty.byMarket.status).toBe(DATA_UNAVAILABLE);
    expect(empty.byMarket.rows).toEqual([]);
    expect(empty.byMarket.reason).toMatch(/DATA UNAVAILABLE/i);
    expect(empty.byMarket.defaultStartSet).toEqual([...PRIMARY_ACQUISITION_MARKETS]);
    expect(empty.byMarket.defaultStartSet).not.toContain("ESTILL_SC");

    const master = await seedMaster();
    await openConsumerLead({
      clientId: master.id,
      acquisitionStage: "CONSULTATION_BOOKED",
      acquisitionSource: "REACTIVATION_CAMPAIGN",
    });
    await createPartner({
      businessName: "Prospect Co",
      email: "prospect@example.com",
      acquisitionSource: "GHL_PROSPECTING",
      market: "ARLINGTON_VA",
    });

    const filled = await getAcquisitionDashboard();
    expect(filled.metrics.newLeadsToday.status).toBe("AVAILABLE");
    expect(filled.metrics.newLeadsToday.value).toBe(1);
    expect(filled.metrics.consultations.value).toBe(1);
    expect(filled.metrics.reactivationLeads.value).toBe(1);
    expect(filled.metrics.partnerProspects.value).toBe(1);
    expect(filled.metrics.revenueBySource.status).toBe(DATA_UNAVAILABLE);
    expect(filled.engines.mixed).toBe(false);
    expect(filled.byMarket.status).toBe("AVAILABLE");
    expect(filled.byMarket.rows.map((row) => row.market)).toEqual(["ARLINGTON_VA"]);
    expect(filled.byMarket.rows[0]?.prospectsFound.value).toBe(1);
    expect(filled.byMarket.rows[0]?.revenue.status).toBe(DATA_UNAVAILABLE);
    expect(filled.byMarket.rows[0]?.revenue.reason).toMatch(/DATA UNAVAILABLE/i);
  });

  it("market is required and validated — Estill is never a default", async () => {
    expect([...ACQUISITION_MARKETS]).toEqual([
      ...PRIMARY_ACQUISITION_MARKETS,
      ...SECONDARY_ACQUISITION_MARKETS,
      "UNKNOWN",
      "OTHER",
    ]);
    expect(DEFAULT_PROSPECTING_MARKETS).toEqual([...PRIMARY_ACQUISITION_MARKETS]);
    expect(DEFAULT_PROSPECTING_MARKETS).toEqual([
      "HILTON_HEAD_ISLAND_SC",
      "BLUFFTON_SC",
      "SAVANNAH_GA",
      "ATLANTA_GA",
      "WASHINGTON_DC",
      "ARLINGTON_VA",
    ]);
    expect(SECONDARY_ACQUISITION_MARKETS).toEqual([
      "CHARLOTTE_NC",
      "COLUMBIA_SC",
      "CHARLESTON_SC",
      "AUGUSTA_GA",
      "ALEXANDRIA_VA",
      "FAIRFAX_VA",
      "RICHMOND_VA",
    ]);
    expect(ACQUISITION_MARKETS).not.toContain("ESTILL_SC");
    expect(DEFAULT_PROSPECTING_MARKETS).not.toContain("ESTILL_SC");

    expect(parseAcquisitionMarket("Hilton Head Island, SC")).toBe("HILTON_HEAD_ISLAND_SC");
    expect(parseAcquisitionMarket("UNKNOWN")).toBe("UNKNOWN");
    expect(parseAcquisitionMarket("OTHER")).toBe("OTHER");
    expect(parseAcquisitionMarket(undefined)).toBeNull();
    expect(parseAcquisitionMarket("")).toBeNull();
    expect(() => requireAcquisitionMarket(undefined)).toThrow(AcquisitionError);
    expect(() => requireAcquisitionMarket("")).toThrow(/required/i);
    expect(() => parseAcquisitionMarket("Estill, SC")).toThrow(/Estill/i);
    expect(() => parseAcquisitionMarket("ESTILL_SC")).toThrow(AcquisitionError);
    expect(() => parseAcquisitionMarket("Not A City")).toThrow(/allow-list/i);

    await expect(
      createPartner({
        businessName: "No Market Realty",
        acquisitionSource: "REALTOR_PARTNER",
      }),
    ).rejects.toMatchObject({ code: "MARKET_REQUIRED" });

    await expect(
      createPartner({
        businessName: "Estill Default",
        acquisitionSource: "GHL_PROSPECTING",
        market: "Estill, SC",
      }),
    ).rejects.toMatchObject({ code: "INVALID_MARKET" });

    const { partner } = await createPartner({
      businessName: "Explicit Unknown",
      email: "unknown-market@example.com",
      acquisitionSource: "OTHER",
      market: "UNKNOWN",
    });
    expect(partner.market).toBe("UNKNOWN");
    expect(partner.market).not.toBe("ESTILL_SC");
    expect(await prisma.client.count()).toBe(0);

    const srcDir = path.join(process.cwd(), "src/lib/acquisition");
    for (const file of fs.readdirSync(srcDir)) {
      const src = fs.readFileSync(path.join(srcDir, file), "utf8");
      expect(src).not.toMatch(/market:\s*["']ESTILL/i);
      expect(src).not.toMatch(/@default\(ESTILL/i);
      expect(src).not.toMatch(/DEFAULT_PROSPECTING_MARKETS\s*=\s*\[[^\]]*ESTILL/s);
    }
    const marketsSrc = fs.readFileSync(path.join(srcDir, "markets.ts"), "utf8");
    expect(marketsSrc).toMatch(/FORBIDDEN_ESTILL_KEYS/);
    expect(marketsSrc).toMatch(/never a default/);
  });

  it("dashboard groups stamped partner metrics by market without inventing rows", async () => {
    const hilton = await createPartner({
      businessName: "Hilton Realty",
      email: "hilton@example.com",
      partnerType: "REALTOR",
      acquisitionSource: "REALTOR_PARTNER",
      market: "Hilton Head Island, SC",
      pipelineStage: "REPLIED",
    });
    await createPartner({
      businessName: "Bluffton Mortgage",
      email: "bluffton@example.com",
      partnerType: "MORTGAGE",
      acquisitionSource: "MORTGAGE_PARTNER",
      market: "BLUFFTON_SC",
    });
    await createPartner({
      businessName: "Savannah Builders",
      email: "savannah@example.com",
      partnerType: "BUILDER",
      acquisitionSource: "BUILDER_PARTNER",
      market: "SAVANNAH_GA",
      pipelineStage: "INTRO_CALL",
    });

    const master = await seedMaster("GC-000501");
    const opened = await openConsumerLead({
      clientId: master.id,
      referredByPartnerId: hilton.partner.id,
      acquisitionSource: "REALTOR_PARTNER",
      campaignId: "camp_mkt",
      contentId: "vid_mkt",
      adId: "ad_mkt",
      cta: "book_consult",
    });
    expect(opened.client.acquisitionMarket).toBe("HILTON_HEAD_ISLAND_SC");
    const converted = await convertConsumerLead({ clientId: master.id, paid: true });
    expect(converted.referral?.market).toBe("HILTON_HEAD_ISLAND_SC");
    expect(await prisma.client.count()).toBe(1);

    const dash = await getAcquisitionDashboard();
    expect(dash.byMarket.status).toBe("AVAILABLE");
    expect(dash.byMarket.defaultStartSet).toEqual([...PRIMARY_ACQUISITION_MARKETS]);
    expect(dash.byMarket.rows.map((row) => row.market).sort()).toEqual([
      "BLUFFTON_SC",
      "HILTON_HEAD_ISLAND_SC",
      "SAVANNAH_GA",
    ]);
    expect(dash.byMarket.rows.some((row) => row.market === "ESTILL_SC")).toBe(false);
    expect(dash.byMarket.rows.some((row) => row.market === "CHARLOTTE_NC")).toBe(false);

    const hiltonRow = dash.byMarket.rows.find((row) => row.market === "HILTON_HEAD_ISLAND_SC");
    const blufftonRow = dash.byMarket.rows.find((row) => row.market === "BLUFFTON_SC");
    const savannahRow = dash.byMarket.rows.find((row) => row.market === "SAVANNAH_GA");

    expect(hiltonRow?.prospectsFound.value).toBe(0);
    expect(hiltonRow?.replies.value).toBe(1);
    expect(hiltonRow?.meetings.value).toBe(1);
    expect(hiltonRow?.referrals.value).toBe(1);
    expect(hiltonRow?.clientsConverted.value).toBe(1);
    expect(hiltonRow?.revenue.status).toBe(DATA_UNAVAILABLE);

    expect(blufftonRow?.prospectsFound.value).toBe(1);
    expect(blufftonRow?.replies.value).toBe(0);
    expect(blufftonRow?.referrals.status).toBe(DATA_UNAVAILABLE);
    expect(blufftonRow?.revenue.status).toBe(DATA_UNAVAILABLE);

    expect(savannahRow?.meetings.value).toBe(1);
    expect(savannahRow?.replies.value).toBe(1);
    expect(savannahRow?.referrals.status).toBe(DATA_UNAVAILABLE);

    const payment = await prisma.paymentTransaction.create({
      data: {
        id: "pay_mkt_1",
        clientId: master.id,
        provider: "AUTHORIZE_NET",
        providerTransactionId: "txn_mkt_1",
        idempotencyKey: "idem_mkt_1",
        amountCents: 19900,
        status: "SUCCEEDED",
      },
    });
    const attr = await import("../src/lib/marketing/lead-attribution");
    const stamped = await prisma.leadAttribution.findFirst({ where: { clientId: master.id } });
    expect(stamped?.market).toBe("HILTON_HEAD_ISLAND_SC");
    await attr.applyVerifiedCollectedAmount({
      attributionId: stamped!.id,
      paymentTransactionId: payment.id,
    });

    const withRevenue = await getAcquisitionDashboard();
    const hiltonAfter = withRevenue.byMarket.rows.find((row) => row.market === "HILTON_HEAD_ISLAND_SC");
    expect(hiltonAfter?.revenue.status).toBe("AVAILABLE");
    expect(hiltonAfter?.revenue.value).toBe(19900);
    const blufftonAfter = withRevenue.byMarket.rows.find((row) => row.market === "BLUFFTON_SC");
    expect(blufftonAfter?.revenue.status).toBe(DATA_UNAVAILABLE);
  });

  it("convertConsumerLead still refuses to mint a second master", async () => {
    const master = await seedMaster("GC-000601");
    await openConsumerLead({
      clientId: master.id,
      acquisitionSource: "WEBSITE",
    });
    const before = await prisma.client.count();
    await expect(
      convertConsumerLead({
        clientId: master.id,
        createClient: true,
        email: "second.market@example.com",
        firstName: "Second",
        lastName: "Human",
      }),
    ).rejects.toMatchObject({ code: "REFUSE_CREATE_CLIENT" });
    expect(await prisma.client.count()).toBe(before);
    expect(await prisma.partner.count()).toBe(0);
  });
});
