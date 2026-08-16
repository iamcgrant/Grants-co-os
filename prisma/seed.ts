import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Role, CreditBureau } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { MASTER_ONBOARDING_ITEMS } from "../src/lib/clients/onboarding";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const ONBOARDING = MASTER_ONBOARDING_ITEMS;

async function main() {
  console.log("Seeding Grants & Co OS (Charles / Simon / Jona)…");

  await prisma.partnerReferral.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.messageMention.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.fridayPulseItem.deleteMany();
  await prisma.fridayPulseRun.deleteMany();
  await prisma.disputeRound.deleteMany();
  await prisma.onboardingItem.deleteMany();
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

  const charles = await prisma.user.create({
    data: {
      email: "owner@grantsandco.com",
      passwordHash,
      firstName: "Charles",
      lastName: "Grant",
      role: Role.OWNER,
      staffProfile: { create: { title: "Owner / Administrator" } },
    },
  });

  const simon = await prisma.user.create({
    data: {
      email: "simon@grantsandco.com",
      passwordHash,
      firstName: "Simon",
      lastName: "Young",
      role: Role.CUSTOMER_SERVICE,
      staffProfile: { create: { title: "Client Service / Follow-Up" } },
    },
  });

  const jona = await prisma.user.create({
    data: {
      email: "jona@grantsandco.com",
      passwordHash,
      firstName: "Jona",
      lastName: "Processing",
      role: Role.FILE_PREPARER,
      staffProfile: { create: { title: "File Preparation / Dispute Processing" } },
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
        ],
      },
    },
    include: { billingPolicies: true },
  });

  const milestonePolicy = service.billingPolicies.find((p) => p.type === "AFTER_SERVICE_MILESTONE")!;

  const donna = await prisma.client.create({
    data: {
      grantsClientId: "GC-000001",
      email: "donna.james@example.com",
      emailNormalized: "donna.james@example.com",
      phone: "(555) 201-8844",
      phoneNormalized: "5552018844",
      firstName: "Donna",
      lastName: "James",
      status: "ACTIVE",
      stage: "READY_FOR_PROCESSING",
      nextAction: "Prepare Round 2 dispute package",
      nextActionOwner: "JONA",
      urgency: "HIGH",
      lastInteractionAt: new Date(),
      nextDueAt: new Date(Date.now() + 86400000),
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

  const antionette = await prisma.client.create({
    data: {
      grantsClientId: "GC-000003",
      email: "antionette.greene@example.com",
      emailNormalized: "antionette.greene@example.com",
      phone: "(843) 555-0199",
      phoneNormalized: "8435550199",
      firstName: "Antionette",
      lastName: "Greene",
      status: "ACTIVE",
      stage: "WAITING_ON_CLIENT",
      nextAction: "Obtain updated credit report",
      nextActionOwner: "SIMON",
      urgency: "NORMAL",
      lastInteractionAt: new Date(),
      nextDueAt: new Date(),
    },
  });

  const marcus = await prisma.client.create({
    data: {
      grantsClientId: "GC-000002",
      email: "marcus.wells@example.com",
      emailNormalized: "marcus.wells@example.com",
      phone: "5559981122",
      phoneNormalized: "5559981122",
      firstName: "Marcus",
      lastName: "Wells",
      status: "ACTIVE",
      stage: "WAITING_FOR_RESULTS",
      nextAction: "Wait for bureau results",
      nextActionOwner: "SYSTEM",
      urgency: "LOW",
    },
  });

  await prisma.idSequence.update({ where: { name: "grants_client" }, data: { value: 3 } });

  for (const client of [donna, antionette, marcus]) {
    await prisma.onboardingItem.createMany({
      data: ONBOARDING.map((item, idx) => ({
        clientId: client.id,
        key: item.key,
        label: item.label,
        status:
          client.id === antionette.id && idx > 5
            ? "MISSING"
            : client.id === marcus.id && idx > 7
              ? "MISSING"
              : "COMPLETE",
        completedAt: new Date(),
      })),
    });
  }

  // Antionette still missing a few — mark incomplete properly
  await prisma.onboardingItem.updateMany({
    where: { clientId: antionette.id, key: { in: ["updated_report", "smartcredit"] } },
    data: { status: "MISSING", completedAt: null },
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
          completedByUserId: simon.id,
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
      invoiceNumber: "GC-1051",
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

  await prisma.idSequence.update({ where: { name: "invoice" }, data: { value: 1051 } });

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

  await prisma.clientIdentifier.createMany({
    data: [
      {
        clientId: donna.id,
        provider: "GHL",
        externalId: "ghl_contact_donna_001",
        metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
      },
      {
        clientId: donna.id,
        provider: "DISPUTEFOX",
        externalId: "df_donna_001",
        metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
      },
      {
        clientId: antionette.id,
        provider: "GHL",
        externalId: "ghl_contact_antionette_001",
        metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
      },
      {
        clientId: marcus.id,
        provider: "PAYMENT",
        externalId: "mock_cus_marcus",
        metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
      },
    ],
  });

  await prisma.creditConnection.createMany({
    data: [
      { clientId: donna.id, provider: "SMARTCREDIT", status: "CONNECTED", externalId: "sc_donna01" },
      { clientId: donna.id, provider: "CREDIT_KARMA", status: "CONNECTED", credentialRef: "enc_ref_ck_donna" },
      { clientId: donna.id, provider: "EXPERIAN", status: "CONNECTED", credentialRef: "enc_ref_ex_donna" },
      { clientId: antionette.id, provider: "CREDIT_KARMA", status: "CONNECTED" },
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
      data: { clientId: donna.id, source: "SMARTCREDIT", capturedAt: date },
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

  await prisma.creditScore.createMany({
    data: [
      {
        clientId: antionette.id,
        bureau: CreditBureau.TRANSUNION,
        score: 620,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        capturedAt: june,
      },
      {
        clientId: antionette.id,
        bureau: CreditBureau.TRANSUNION,
        score: 641,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        capturedAt: july,
      },
      {
        clientId: antionette.id,
        bureau: CreditBureau.TRANSUNION,
        score: 656,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        capturedAt: august,
      },
      {
        clientId: antionette.id,
        bureau: CreditBureau.EQUIFAX,
        score: 610,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        capturedAt: june,
      },
      {
        clientId: antionette.id,
        bureau: CreditBureau.EQUIFAX,
        score: 628,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        capturedAt: august,
      },
    ],
  });

  await prisma.creditChange.createMany({
    data: [
      {
        clientId: antionette.id,
        bureau: CreditBureau.TRANSUNION,
        previousScore: 641,
        newScore: 656,
        scoringModel: "VantageScore 3.0",
        source: "CREDIT_KARMA",
        changeAmount: 15,
      },
      {
        clientId: donna.id,
        bureau: CreditBureau.EQUIFAX,
        previousScore: 638,
        newScore: 660,
        scoringModel: "VantageScore 3.0",
        source: "SMARTCREDIT",
        changeAmount: 22,
      },
    ],
  });

  await prisma.disputeRound.createMany({
    data: [
      {
        clientId: donna.id,
        roundNumber: 1,
        status: "RESULTS_RECEIVED",
        preparedAt: new Date("2026-07-01"),
        sentAt: new Date("2026-07-03"),
        resultsReceivedAt: new Date("2026-08-01"),
        negativeItemsCount: 18,
        deletedItemsCount: 4,
        remainingItemsCount: 14,
      },
      {
        clientId: donna.id,
        roundNumber: 2,
        status: "PREPARING",
        preparedAt: null,
        negativeItemsCount: 14,
        deletedItemsCount: 0,
        remainingItemsCount: 14,
      },
      {
        clientId: marcus.id,
        roundNumber: 1,
        status: "SUBMITTED",
        preparedAt: new Date("2026-08-01"),
        sentAt: new Date("2026-08-02"),
        negativeItemsCount: 11,
        deletedItemsCount: 0,
        remainingItemsCount: 11,
      },
    ],
  });

  await prisma.clientAssignment.createMany({
    data: [
      { clientId: donna.id, staffId: jona.id, roleLabel: "File Preparation", isPrimary: true },
      { clientId: donna.id, staffId: simon.id, roleLabel: "Client Care", isPrimary: false },
      { clientId: antionette.id, staffId: simon.id, roleLabel: "Client Care", isPrimary: true },
      { clientId: marcus.id, staffId: jona.id, roleLabel: "File Preparation", isPrimary: true },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        clientId: donna.id,
        title: "Prepare Round 2 for Donna James",
        status: "OPEN",
        priority: "HIGH",
        assigneeId: jona.id,
        createdById: simon.id,
        category: "file preparation",
        dueAt: new Date(),
      },
      {
        clientId: antionette.id,
        title: "Request updated report from Antionette",
        status: "OPEN",
        priority: "HIGH",
        assigneeId: simon.id,
        createdById: charles.id,
        category: "client follow-up",
        dueAt: new Date(),
      },
      {
        clientId: antionette.id,
        title: "SmartCredit reactivation check",
        status: "OPEN",
        priority: "MEDIUM",
        assigneeId: simon.id,
        createdById: simon.id,
        category: "monitoring",
      },
      {
        clientId: marcus.id,
        title: "Monitor Round 1 results",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        assigneeId: jona.id,
        createdById: jona.id,
        category: "results",
      },
    ],
  });

  await prisma.document.createMany({
    data: [
      {
        clientId: donna.id,
        name: "Driver License.pdf",
        mimeType: "application/pdf",
        storageKey: "dev/donna/dl.pdf",
        category: "identification",
        uploadedById: simon.id,
      },
      {
        clientId: donna.id,
        name: "POA signed.pdf",
        mimeType: "application/pdf",
        storageKey: "dev/donna/poa.pdf",
        category: "poa",
        uploadedById: simon.id,
      },
      {
        clientId: antionette.id,
        name: "Proof of address.pdf",
        mimeType: "application/pdf",
        storageKey: "dev/antionette/address.pdf",
        category: "proof of address",
        uploadedById: simon.id,
      },
    ],
  });

  // Conversations
  const team = await prisma.conversation.create({
    data: {
      kind: "TEAM",
      subject: "Grants & Co Team",
      lastMessageAt: new Date(),
      participants: {
        create: [{ userId: charles.id }, { userId: simon.id }, { userId: jona.id }],
      },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: team.id,
      senderId: charles.id,
      channel: "INTERNAL",
      isInternal: true,
      body: "Welcome to Grants & Co OS team chat. Keep client work linked from Client 360 whenever possible.",
      deliveryStatus: "RECORDED",
    },
  });

  const donnaClientConv = await prisma.conversation.create({
    data: {
      kind: "CLIENT",
      clientId: donna.id,
      subject: "Donna James",
      lastMessageAt: new Date(),
      participants: { create: [{ userId: simon.id }, { userId: jona.id }] },
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: donnaClientConv.id,
        senderId: simon.id,
        channel: "SMS",
        isInternal: false,
        body: "Hi Donna — your Round 1 results are in. I’ll walk you through next steps.",
        deliveryStatus: "DELIVERED",
      },
    ],
  });

  const donnaInternal = await prisma.conversation.create({
    data: {
      kind: "CLIENT_INTERNAL",
      clientId: donna.id,
      subject: "Donna James · Internal",
      lastMessageAt: new Date(),
      participants: { create: [{ userId: simon.id }, { userId: jona.id }, { userId: charles.id }] },
    },
  });

  const internalMsg = await prisma.message.create({
    data: {
      conversationId: donnaInternal.id,
      senderId: simon.id,
      channel: "INTERNAL",
      isInternal: true,
      body: "@Jona updated report received — ready for Round 2.",
      deliveryStatus: "RECORDED",
    },
  });

  await prisma.messageMention.create({
    data: { messageId: internalMsg.id, userId: jona.id },
  });

  const antConv = await prisma.conversation.create({
    data: {
      kind: "CLIENT",
      clientId: antionette.id,
      subject: "Antionette Greene",
      lastMessageAt: new Date(),
      participants: { create: [{ userId: simon.id }] },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: antConv.id,
      senderId: simon.id,
      channel: "SMS",
      isInternal: false,
      body: "Antionette — please upload your updated credit report when you have a moment.",
      deliveryStatus: "SENT",
    },
  });

  await prisma.clientTimelineEvent.createMany({
    data: [
      {
        clientId: donna.id,
        actorId: charles.id,
        eventType: "CLIENT_CREATED",
        title: "Client created",
        description: "Donna James · GC-000001",
        idempotencyKey: "seed:donna:created",
      },
      {
        clientId: donna.id,
        actorId: simon.id,
        eventType: "READY_FOR_PROCESSING",
        title: "Ready for processing",
        description: "Handed to Jona by Simon",
        idempotencyKey: "seed:donna:handoff",
      },
      {
        clientId: donna.id,
        eventType: "ROUND_SENT",
        title: "Round 1 sent",
        description: "Dispute package submitted",
        idempotencyKey: "seed:donna:r1",
      },
      {
        clientId: antionette.id,
        actorId: simon.id,
        eventType: "CLIENT_CREATED",
        title: "Client created",
        description: "Antionette Greene · GC-000003",
        idempotencyKey: "seed:ant:created",
      },
      {
        clientId: antionette.id,
        actorId: simon.id,
        eventType: "FRIDAY_UPDATE_SENT",
        title: "Friday update sent",
        description: "Status + Credit Karma score request",
        idempotencyKey: "seed:ant:pulse",
      },
    ],
  });

  const pulse = await prisma.fridayPulseRun.create({
    data: {
      weekOf: new Date("2026-08-15"),
      status: "RUNNING",
      triggeredBy: charles.id,
      items: {
        create: [
          {
            clientId: donna.id,
            statusUpdate: "next round preparation",
            updateStatus: "SENT",
            scoreRequestStatus: "SENT",
            scoreResponseStatus: "RECEIVED",
          },
          {
            clientId: antionette.id,
            statusUpdate: "documents needed",
            updateStatus: "SENT",
            scoreRequestStatus: "SENT",
            scoreResponseStatus: "MISSING",
            reviewRequired: true,
          },
          {
            clientId: marcus.id,
            statusUpdate: "waiting on results",
            updateStatus: "PENDING",
            scoreRequestStatus: "PENDING",
            scoreResponseStatus: "NONE",
          },
        ],
      },
    },
  });
  void pulse;

  await prisma.integrationConnection.createMany({
    data: [
      { provider: "gohighlevel", status: "AWAITING_CREDENTIALS" },
      { provider: "disputefox", status: "AWAITING_CREDENTIALS" },
      { provider: "smartcredit", status: "MOCK" },
      { provider: "credit_karma", status: "MOCK" },
      { provider: "experian", status: "MOCK" },
      { provider: "authorize_net", status: "MOCK" },
      { provider: "commas", status: "MOCK" },
      { provider: "communications", status: "MOCK" },
    ],
  });

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
      { clientId: donna.id, campaignId: campaign.id, eventType: "CLIENT", revenueCents: 0 },
      { clientId: marcus.id, campaignId: campaign.id, eventType: "PAYMENT", revenueCents: 70000 },
    ],
  });

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
  console.log("Staff: owner@ / simon@ / jona@ grantsandco.com");
  console.log(`Invoice ready: ${invoice.invoiceNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
