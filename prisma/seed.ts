import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Role, CreditBureau } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Grants & Co OS…");

  // Clean in dependency order for idempotent reseed
  await prisma.conversionEvent.deleteMany();
  await prisma.leadSource.deleteMany();
  await prisma.marketingCampaign.deleteMany();
  await prisma.marketingSource.deleteMany();
  await prisma.creditMonitoringEvent.deleteMany();
  await prisma.creditChange.deleteMany();
  await prisma.creditScore.deleteMany();
  await prisma.creditSnapshot.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.creditConnection.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.clientTimelineEvent.deleteMany();
  await prisma.clientAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.document.deleteMany();
  await prisma.integrationSyncEvent.deleteMany();
  await prisma.integrationConnection.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.paymentDispute.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.paymentCustomer.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.serviceMilestone.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.clientService.deleteMany();
  await prisma.billingPolicy.deleteMany();
  await prisma.service.deleteMany();
  await prisma.address.deleteMany();
  await prisma.clientIdentifier.deleteMany();
  await prisma.client.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.idSequence.deleteMany();
  await prisma.systemEvent.deleteMany();

  await prisma.idSequence.createMany({
    data: [
      { name: "grants_client", value: 0 },
      { name: "invoice", value: 1047 },
    ],
  });

  const passwordHash = await bcrypt.hash("GrantsCo2026!", 12);

  const owner = await prisma.user.create({
    data: {
      email: "owner@grantsandco.com",
      passwordHash,
      firstName: "Charles",
      lastName: "Grant",
      role: Role.OWNER,
      staffProfile: { create: { title: "Owner" } },
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@grantsandco.com",
      passwordHash,
      firstName: "Maya",
      lastName: "Brooks",
      role: Role.MANAGER,
      staffProfile: { create: { title: "Operations Manager" } },
    },
  });

  const preparer = await prisma.user.create({
    data: {
      email: "preparer@grantsandco.com",
      passwordHash,
      firstName: "Jordan",
      lastName: "Lee",
      role: Role.FILE_PREPARER,
      staffProfile: { create: { title: "File Preparer" } },
    },
  });

  const marketing = await prisma.user.create({
    data: {
      email: "marketing@grantsandco.com",
      passwordHash,
      firstName: "Ava",
      lastName: "Nguyen",
      role: Role.MARKETING,
      staffProfile: { create: { title: "Marketing" } },
    },
  });

  const service = await prisma.service.create({
    data: {
      code: "CREDIT_OPT",
      name: "Credit Optimization Service",
      description: "Full-service credit optimization engagement",
      basePriceCents: 75000,
      billingPolicies: {
        create: [
          {
            type: "AFTER_SERVICE_MILESTONE",
            name: "Bill after onboarding milestone",
            amountCents: 75000,
          },
          {
            type: "MANUAL_INVOICE",
            name: "Manual invoice",
            amountCents: 75000,
          },
          {
            type: "RECURRING_AFTER_MILESTONE",
            name: "Recurring after milestone",
            amountCents: 14900,
            configJson: JSON.stringify({ intervalDays: 30 }),
          },
        ],
      },
    },
    include: { billingPolicies: true },
  });

  const milestonePolicy = service.billingPolicies.find(
    (p) => p.type === "AFTER_SERVICE_MILESTONE",
  )!;

  // Client: Donna James
  const donna = await prisma.client.create({
    data: {
      grantsClientId: "GC-000001",
      email: "donna.james@example.com",
      emailNormalized: "donna.james@example.com",
      phone: "(555) 201-8844",
      phoneNormalized: "5552018844",
      firstName: "Donna",
      lastName: "James",
      addresses: {
        create: {
          line1: "1842 Magnolia Ave",
          city: "Atlanta",
          state: "GA",
          postalCode: "30308",
        },
      },
    },
  });

  await prisma.idSequence.update({
    where: { name: "grants_client" },
    data: { value: 1 },
  });

  const donnaService = await prisma.clientService.create({
    data: {
      clientId: donna.id,
      serviceId: service.id,
      billingPolicyId: milestonePolicy.id,
      milestones: {
        create: {
          billingPolicyId: milestonePolicy.id,
          name: "Onboarding Complete",
          sequence: 1,
          isCompleted: true,
          completedAt: new Date(),
          completedByUserId: manager.id,
          invoiceEligible: true,
          invoiceCreated: true,
          paymentEligible: true,
        },
      },
    },
    include: { milestones: true },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "GC-1048",
      clientId: donna.id,
      clientServiceId: donnaService.id,
      milestoneId: donnaService.milestones[0].id,
      status: "DUE",
      amountCents: 75000,
      description: "Credit Optimization Service",
      dueAt: new Date(),
      items: {
        create: {
          description: "Credit Optimization Service — Onboarding",
          quantity: 1,
          unitCents: 75000,
          totalCents: 75000,
        },
      },
    },
  });

  await prisma.idSequence.update({
    where: { name: "invoice" },
    data: { value: 1048 },
  });

  // Second client with payment history
  const marcus = await prisma.client.create({
    data: {
      grantsClientId: "GC-000002",
      email: "marcus.wells@example.com",
      emailNormalized: "marcus.wells@example.com",
      phone: "5559981122",
      phoneNormalized: "5559981122",
      firstName: "Marcus",
      lastName: "Wells",
    },
  });

  await prisma.idSequence.update({
    where: { name: "grants_client" },
    data: { value: 2 },
  });

  const paidInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "GC-1049",
      clientId: marcus.id,
      status: "SUCCEEDED",
      amountCents: 75000,
      amountPaidCents: 75000,
      description: "Credit Optimization Service",
      paidAt: new Date(),
      items: {
        create: {
          description: "Credit Optimization Service",
          quantity: 1,
          unitCents: 75000,
          totalCents: 75000,
        },
      },
    },
  });

  const successTxn = await prisma.paymentTransaction.create({
    data: {
      clientId: marcus.id,
      invoiceId: paidInvoice.id,
      provider: "mock",
      providerTransactionId: "mock_txn_seed_success",
      idempotencyKey: "seed-success-payment",
      amountCents: 75000,
      status: "SUCCEEDED",
      settlementStatus: "SETTLED",
      payoutStatus: "PAID",
      settledAt: new Date(),
      attempts: {
        create: { attemptNumber: 1, status: "SUCCEEDED", providerRawId: "mock_txn_seed_success" },
      },
    },
  });

  await prisma.payout.create({
    data: {
      transactionId: successTxn.id,
      provider: "mock",
      providerPayoutId: "mock_po_seed_1",
      amountCents: 75000,
      status: "PAID",
      arrivedAt: new Date(),
    },
  });

  // Failed payment example
  await prisma.paymentTransaction.create({
    data: {
      clientId: donna.id,
      invoiceId: invoice.id,
      provider: "mock",
      providerTransactionId: "mock_txn_seed_fail",
      idempotencyKey: "seed-fail-payment",
      amountCents: 75000,
      status: "FAILED",
      settlementStatus: "UNSETTLED",
      failureCode: "card_declined",
      failureMessage: "Simulated decline",
      attempts: {
        create: {
          attemptNumber: 1,
          status: "FAILED",
          errorCode: "card_declined",
          errorMessage: "Simulated decline",
        },
      },
    },
  });

  // Refund example on marcus
  await prisma.refund.create({
    data: {
      clientId: marcus.id,
      invoiceId: paidInvoice.id,
      transactionId: successTxn.id,
      provider: "mock",
      providerRefundId: "mock_rfnd_seed_partial",
      idempotencyKey: "seed-partial-refund",
      amountCents: 5000,
      reason: "Goodwill adjustment",
      status: "SUCCEEDED",
    },
  });

  await prisma.invoice.update({
    where: { id: paidInvoice.id },
    data: { amountPaidCents: 70000, status: "PARTIALLY_REFUNDED" },
  });

  // Chargeback example
  await prisma.paymentDispute.create({
    data: {
      clientId: marcus.id,
      invoiceId: paidInvoice.id,
      transactionId: successTxn.id,
      provider: "mock",
      providerDisputeId: "mock_dp_seed_1",
      amountCents: 10000,
      reason: "product_not_received",
      status: "OPEN",
    },
  });

  // Identifiers
  await prisma.clientIdentifier.createMany({
    data: [
      { clientId: donna.id, provider: "GHL", externalId: "ghl_contact_donna_001" },
      { clientId: donna.id, provider: "DISPUTEFOX", externalId: "df_donna_001" },
      { clientId: marcus.id, provider: "PAYMENT", externalId: "mock_cus_marcus" },
    ],
  });

  // Credit connections + history
  await prisma.creditConnection.createMany({
    data: [
      {
        clientId: donna.id,
        provider: "SMARTCREDIT",
        status: "CONNECTED",
        externalId: "sc_donna01",
      },
      {
        clientId: donna.id,
        provider: "CREDIT_KARMA",
        status: "CONNECTED",
        credentialRef: "enc_ref_ck_donna",
      },
      {
        clientId: donna.id,
        provider: "EXPERIAN",
        status: "CONNECTED",
        credentialRef: "enc_ref_ex_donna",
      },
    ],
  });

  const june = new Date("2026-06-15");
  const july = new Date("2026-07-15");
  const august = new Date("2026-08-14");

  for (const [date, scores] of [
    [june, [619, 620, 620]],
    [july, [638, 661, 629]],
    [august, [660, 682, 641]],
  ] as const) {
    const snap = await prisma.creditSnapshot.create({
      data: {
        clientId: donna.id,
        source: "SMARTCREDIT",
        capturedAt: date,
      },
    });
    await prisma.creditScore.createMany({
      data: [
        {
          clientId: donna.id,
          snapshotId: snap.id,
          bureau: CreditBureau.EQUIFAX,
          score: scores[0],
          scoringModel: "VantageScore 3.0",
          source: "SMARTCREDIT",
          capturedAt: date,
        },
        {
          clientId: donna.id,
          snapshotId: snap.id,
          bureau: CreditBureau.EXPERIAN,
          score: scores[1],
          scoringModel: "VantageScore 3.0",
          source: "SMARTCREDIT",
          capturedAt: date,
        },
        {
          clientId: donna.id,
          snapshotId: snap.id,
          bureau: CreditBureau.TRANSUNION,
          score: scores[2],
          scoringModel: "VantageScore 3.0",
          source: "SMARTCREDIT",
          capturedAt: date,
        },
      ],
    });
  }

  // Also store Experian FICO separately — never conflate models
  await prisma.creditScore.create({
    data: {
      clientId: donna.id,
      bureau: CreditBureau.EXPERIAN,
      score: 701,
      scoringModel: "FICO Score 8",
      source: "EXPERIAN",
      capturedAt: august,
    },
  });

  // Tasks & assignments
  await prisma.clientAssignment.create({
    data: {
      clientId: donna.id,
      staffId: preparer.id,
      roleLabel: "File Preparer",
      isPrimary: true,
    },
  });

  await prisma.task.createMany({
    data: [
      {
        clientId: donna.id,
        title: "Review onboarding documents",
        status: "OPEN",
        priority: "HIGH",
        assigneeId: preparer.id,
        createdById: manager.id,
        category: "MISSING_DOCUMENTS",
        dueAt: new Date(),
      },
      {
        clientId: donna.id,
        title: "Follow up on failed payment",
        status: "OPEN",
        priority: "URGENT",
        assigneeId: manager.id,
        createdById: owner.id,
        category: "PAYMENT_ISSUES",
        dueAt: new Date(),
      },
      {
        clientId: marcus.id,
        title: "Send Friday credit update",
        status: "OPEN",
        priority: "MEDIUM",
        assigneeId: preparer.id,
        createdById: manager.id,
        category: "CREDIT_UPDATES",
      },
    ],
  });

  // Timeline
  await prisma.clientTimelineEvent.createMany({
    data: [
      {
        clientId: donna.id,
        actorId: owner.id,
        eventType: "CLIENT_CREATED",
        title: "Client Created",
        description: "Donna James · GC-000001",
        idempotencyKey: "seed:donna:created",
      },
      {
        clientId: donna.id,
        actorId: manager.id,
        eventType: "SERVICE_ADDED",
        title: "Service Added",
        description: "Credit Optimization Service",
        idempotencyKey: "seed:donna:service",
      },
      {
        clientId: donna.id,
        actorId: manager.id,
        eventType: "MILESTONE_COMPLETED",
        title: "Milestone Completed",
        description: "Onboarding Complete",
        idempotencyKey: "seed:donna:milestone",
      },
      {
        clientId: donna.id,
        eventType: "INVOICE_CREATED",
        title: "Invoice Created",
        description: "Invoice GC-1048 for $750.00",
        idempotencyKey: "seed:donna:invoice",
      },
      {
        clientId: donna.id,
        eventType: "SMARTCREDIT_CONNECTED",
        title: "SmartCredit Connected",
        idempotencyKey: "seed:donna:sc",
      },
    ],
  });

  // Integrations
  await prisma.integrationConnection.createMany({
    data: [
      { provider: "gohighlevel", status: "MOCK" },
      { provider: "disputefox", status: "MOCK" },
      { provider: "smartcredit", status: "MOCK" },
      { provider: "credit_karma", status: "MOCK" },
      { provider: "experian", status: "MOCK" },
    ],
  });

  // Marketing
  const source = await prisma.marketingSource.create({
    data: { name: "Instagram Organic", platform: "instagram" },
  });
  const campaign = await prisma.marketingCampaign.create({
    data: {
      sourceId: source.id,
      name: "August Credit Tips Series",
      contentId: "ig_reel_0812",
      costCents: 0,
    },
  });
  await prisma.leadSource.create({
    data: {
      sourceId: source.id,
      campaignId: campaign.id,
      email: "donna.james@example.com",
      firstName: "Donna",
      lastName: "James",
      status: "CONVERTED",
      clientId: donna.id,
    },
  });
  await prisma.conversionEvent.createMany({
    data: [
      { clientId: donna.id, campaignId: campaign.id, eventType: "LEAD", revenueCents: 0 },
      { clientId: donna.id, campaignId: campaign.id, eventType: "CONSULTATION", revenueCents: 0 },
      { clientId: donna.id, campaignId: campaign.id, eventType: "CLIENT", revenueCents: 0 },
      {
        clientId: marcus.id,
        campaignId: campaign.id,
        eventType: "PAYMENT",
        revenueCents: 70000,
      },
    ],
  });

  // Client portal user for Donna
  await prisma.user.create({
    data: {
      email: "donna.james@example.com",
      passwordHash,
      firstName: "Donna",
      lastName: "James",
      role: Role.CLIENT,
      client: { connect: { id: donna.id } },
    },
  });

  console.log("Seed complete.");
  console.log("Login: owner@grantsandco.com / GrantsCo2026!");
  console.log("Also: manager@, preparer@, marketing@, donna.james@example.com");
  console.log(`Invoice ready for checkout: ${invoice.invoiceNumber} (${invoice.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
