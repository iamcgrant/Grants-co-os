/**
 * Prisma-backed MORTGAGE_LOS service for production routes.
 * Unit tests continue to use in-memory MortgageLosService via createMortgageLosService().
 */

import type { LoanFile, ComplianceAcknowledgment, ApplicationSectionState } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_AGREEMENT_VERSION,
  PAYMENT_DISCLOSURE_TYPES,
  canPatchSections,
  hasPaymentAcks,
  isComplianceDisclosureType,
  recordAcknowledgment,
  type AcknowledgmentRow,
  type ComplianceDisclosureType,
} from "./compliance";
import { applyDpaSelection } from "./dpa";
import { getMortgageServiceBaseCents } from "./document-storage";
import { LosHttpError } from "./errors";
import { createLoanFile, submitApplication as transitionSubmit, type LoanFileRecord } from "./lifecycle";
import { calculateQualification, type QualInput, type QualOutput } from "./qualification";
import { nextLoanNumber } from "./loan-sequence";
import { decodeSectionPayload, encodeSectionPayload } from "./section-payload";
import { encryptSsn, last4, toPublic } from "./ssn-vault";
import type {
  AcknowledgeComplianceInput,
  AcknowledgeSignature,
  AutomationEvent,
  CreateApplicationInput,
  PatchSectionInput,
} from "./service";

const SECTION_CODES = [
  "COMPLIANCE",
  "BORROWER",
  "CO_BORROWER",
  "EMPLOYMENT",
  "ASSETS",
  "LIABILITIES",
  "REO",
  "LOAN",
  "DECLARATIONS",
  "DOCUMENTS",
] as const;

function mapLoanFile(row: LoanFile): LoanFileRecord {
  return {
    loanNumber: row.loanNumber,
    originationStage: row.originationStage as LoanFileRecord["originationStage"],
    dpaSelected: row.dpaSelected,
    dpaAmountCents: row.dpaAmountCents,
    dpaSelectedAt: row.dpaSelectedAt,
    paymentAcknowledged: row.paymentAcknowledged,
    paymentAcknowledgedAt: row.paymentAcknowledgedAt,
    agreementVersion: row.agreementVersion,
    servicePackageAmountCents: row.servicePackageAmountCents,
  };
}

function mapAck(row: ComplianceAcknowledgment): AcknowledgmentRow {
  return {
    id: row.id,
    applicationId: row.applicationId,
    borrowerId: row.borrowerId,
    disclosureType: row.disclosureType as ComplianceDisclosureType,
    acknowledged: row.acknowledged,
    agreementVersion: row.agreementVersion,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  };
}

async function loadAcks(applicationId: string): Promise<AcknowledgmentRow[]> {
  const rows = await prisma.complianceAcknowledgment.findMany({ where: { applicationId } });
  return rows.map(mapAck);
}

async function loadSectionStates(applicationId: string) {
  return prisma.applicationSectionState.findMany({ where: { applicationId } });
}

function emptySectionsFromRows(rows: ApplicationSectionState[]) {
  const byCode = new Map(rows.map((r) => [r.section, r]));
  const out: Record<string, { status: string; body: unknown | null }> = {};
  for (const code of SECTION_CODES) {
    const row = byCode.get(code);
    out[code] = {
      status: row?.status ?? (code === "COMPLIANCE" ? "EMPTY" : "BLOCKED"),
      body: row ? decodeSectionPayload(row.errorsJson) : null,
    };
  }
  return out;
}

export class PrismaMortgageLosService {
  private readonly piiKey: Buffer | string;

  constructor(opts?: { piiKey?: Buffer | string }) {
    this.piiKey = opts?.piiKey ?? process.env.MORTGAGE_PII_KEY ?? Buffer.alloc(32, 7);
  }

  async createApplication(input: CreateApplicationInput) {
    if (!input.clientId) {
      throw new LosHttpError(422, "CLIENT_REQUIRED", undefined, "clientId is required");
    }

    const { loanNumber } = await nextLoanNumber();
    const loanDefaults = createLoanFile({ seq: 1, agreementVersion: DEFAULT_AGREEMENT_VERSION });
    loanDefaults.loanNumber = loanNumber;
    const baseCents = await getMortgageServiceBaseCents();

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.mortgageApplication.create({
        data: {
          clientId: input.clientId,
          serviceCode: "MORTGAGE_LOS",
          pipelineStage: "NEW_APPLICATION",
          legalVersionRequired: DEFAULT_AGREEMENT_VERSION,
        },
      });

      await tx.loanFile.create({
        data: {
          applicationId: app.id,
          loanNumber,
          originationStage: "APP_STARTED",
          agreementVersion: DEFAULT_AGREEMENT_VERSION,
          servicePackageAmountCents: baseCents,
          dpaAmountCents: 0,
        },
      });

      for (const code of SECTION_CODES) {
        await tx.applicationSectionState.create({
          data: {
            applicationId: app.id,
            borrowerKey: "",
            section: code,
            status: code === "COMPLIANCE" ? "EMPTY" : "BLOCKED",
            errorsJson: "[]",
          },
        });
      }

      await tx.losAutomationEvent.create({
        data: {
          applicationId: app.id,
          type: "LOAN_APP_STARTED",
          payloadJson: JSON.stringify({ loanNumber, clientId: input.clientId }),
        },
      });

      await tx.mortgageAuditEvent.create({
        data: {
          applicationId: app.id,
          action: "LOAN_APP_STARTED",
          entityType: "MortgageApplication",
          entityId: app.id,
          metadataJson: JSON.stringify({ loanNumber }),
        },
      });

      return app;
    });

    const sections = emptySectionsFromRows(await loadSectionStates(application.id));
    return {
      applicationId: application.id,
      loanFile: { ...loanDefaults, loanNumber },
      sections,
    };
  }

  async acknowledgeCompliance(input: AcknowledgeComplianceInput) {
    const app = await this.requireApplication(input.applicationId);
    const loanRow = await prisma.loanFile.findUniqueOrThrow({ where: { applicationId: app.id } });
    let acks = await loadAcks(app.id);
    const now = input.now ?? new Date();
    const agreementVersion = input.agreementVersion ?? DEFAULT_AGREEMENT_VERSION;
    const types = this.normalizeDisclosures(input.disclosures);

    for (const item of types) {
      acks = recordAcknowledgment({
        existing: acks,
        type: item.type,
        borrowerId: app.clientId,
        ip: input.ip,
        userAgent: input.userAgent,
        agreementVersion,
        now,
        applicationId: app.id,
        acknowledged: item.acknowledged,
      });
    }

    const dpaChoice = Boolean(input.dpaSelected);
    const packageBase =
      loanRow.servicePackageAmountCents - loanRow.dpaAmountCents > 0
        ? loanRow.servicePackageAmountCents - loanRow.dpaAmountCents
        : await getMortgageServiceBaseCents();
    acks = recordAcknowledgment({
      existing: acks,
      type: "DPA_SELECTION",
      borrowerId: app.clientId,
      ip: input.ip,
      userAgent: input.userAgent,
      agreementVersion,
      now,
      applicationId: app.id,
      acknowledged: true,
    });

    const dpa = applyDpaSelection({
      selected: dpaChoice,
      now,
      currentPackageCents: packageBase,
    });

    for (const ack of acks) {
      await prisma.complianceAcknowledgment.upsert({
        where: {
          applicationId_disclosureType: {
            applicationId: app.id,
            disclosureType: ack.disclosureType,
          },
        },
        create: {
          applicationId: app.id,
          borrowerId: ack.borrowerId,
          disclosureType: ack.disclosureType,
          acknowledged: ack.acknowledged,
          agreementVersion: ack.agreementVersion,
          ipAddress: ack.ipAddress,
          userAgent: ack.userAgent,
        },
        update: {
          acknowledged: ack.acknowledged,
          agreementVersion: ack.agreementVersion,
          ipAddress: ack.ipAddress,
          userAgent: ack.userAgent,
        },
      });
    }

    const paymentAck =
      hasPaymentAcks(acks) || this.includesPayment(types);

    const updatedLoan = await prisma.loanFile.update({
      where: { applicationId: app.id },
      data: {
        agreementVersion,
        dpaSelected: dpa.dpaSelected,
        dpaAmountCents: dpa.dpaAmountCents,
        dpaSelectedAt: dpa.dpaSelectedAt,
        servicePackageAmountCents: dpa.servicePackageAmountCents,
        paymentAcknowledged: paymentAck ? true : loanRow.paymentAcknowledged,
        paymentAcknowledgedAt: paymentAck ? now : loanRow.paymentAcknowledgedAt,
      },
    });

    if (input.signature) {
      await this.persistSignature(app.id, input.signature, input.ip, input.userAgent, agreementVersion, now, dpaChoice);
    }

    if (dpa.event) {
      await prisma.losAutomationEvent.create({
        data: {
          applicationId: app.id,
          type: "DPA_SELECTED",
          payloadJson: JSON.stringify({ dpaAmountCents: dpa.dpaAmountCents }),
        },
      });
    }

    await prisma.mortgageAuditEvent.create({
      data: {
        applicationId: app.id,
        action: "ECONSENT_RECORDED",
        entityType: "ComplianceAcknowledgment",
        entityId: app.id,
        metadataJson: JSON.stringify({ agreementVersion, count: acks.length }),
        ipAddress: input.ip,
      },
    });

    if (canPatchSections(acks)) {
      await prisma.applicationSectionState.updateMany({
        where: {
          applicationId: app.id,
          section: { not: "COMPLIANCE" },
          status: "BLOCKED",
        },
        data: { status: "EMPTY" },
      });
    }

    return {
      applicationId: app.id,
      acknowledgments: acks,
      loanFile: mapLoanFile(updatedLoan),
      dpa: {
        dpaSelected: updatedLoan.dpaSelected,
        dpaAmountCents: updatedLoan.dpaAmountCents,
        dpaSelectedAt: updatedLoan.dpaSelectedAt,
        confirmationCopy: dpa.confirmationCopy,
        event: dpa.event,
      },
      canPatchSections: canPatchSections(acks),
    };
  }

  async patchSection(input: PatchSectionInput) {
    const app = await this.requireApplication(input.applicationId);
    const acks = await loadAcks(app.id);
    if (!canPatchSections(acks)) {
      const { assertCanPatch } = await import("./compliance");
      assertCanPatch(acks);
    }

    const sealed = this.sealSectionBody(input.section, input.body);
    const now = new Date();

    await prisma.applicationSectionState.upsert({
      where: {
        applicationId_borrowerKey_section: {
          applicationId: app.id,
          borrowerKey: "",
          section: input.section as ApplicationSectionState["section"],
        },
      },
      create: {
        applicationId: app.id,
        borrowerKey: "",
        section: input.section as ApplicationSectionState["section"],
        status: "IN_PROGRESS",
        lastSavedAt: now,
        errorsJson: encodeSectionPayload(sealed),
      },
      update: {
        status: "IN_PROGRESS",
        lastSavedAt: now,
        errorsJson: encodeSectionPayload(sealed),
      },
    });

    if (input.section === "BORROWER" || input.section === "CO_BORROWER") {
      await this.syncBorrowerFromSection(app.id, app.clientId, input.section, sealed);
    }

    await prisma.mortgageAuditEvent.create({
      data: {
        applicationId: app.id,
        action: "APPLICATION_SAVED",
        entityType: "ApplicationSectionState",
        entityId: input.section,
        metadataJson: JSON.stringify({ section: input.section }),
      },
    });

    return {
      applicationId: app.id,
      section: input.section,
      body: this.publicSectionBody(input.section, sealed),
      savedAt: now,
    };
  }

  async submitApplication(input: { applicationId: string }) {
    const app = await this.requireApplication(input.applicationId);
    const loanRow = await prisma.loanFile.findUniqueOrThrow({ where: { applicationId: app.id } });
    const acks = await loadAcks(app.id);
    const next = transitionSubmit({ stage: loanRow.originationStage, acks });
    const now = new Date();

    const updatedLoan = await prisma.loanFile.update({
      where: { applicationId: app.id },
      data: {
        originationStage: next.originationStage,
        paymentAcknowledged: hasPaymentAcks(acks) ? true : loanRow.paymentAcknowledged,
        paymentAcknowledgedAt: hasPaymentAcks(acks)
          ? loanRow.paymentAcknowledgedAt ?? now
          : loanRow.paymentAcknowledgedAt,
      },
    });

    await prisma.mortgageApplication.update({
      where: { id: app.id },
      data: {
        submittedAt: now,
        pipelineStage: "APPLICATION_SUBMITTED",
        currentStep: "REVIEW",
      },
    });

    await prisma.loanStageEvent.create({
      data: {
        applicationId: app.id,
        fromStage: "APP_STARTED",
        toStage: "APP_SUBMITTED",
        reason: "Borrower submit",
      },
    });

    await prisma.pipelineEvent.create({
      data: {
        applicationId: app.id,
        fromStage: "NEW_APPLICATION",
        toStage: "APPLICATION_SUBMITTED",
        reason: "Borrower submitted URLA",
      },
    });

    await prisma.losAutomationEvent.create({
      data: {
        applicationId: app.id,
        type: "LOAN_APP_SUBMITTED",
        payloadJson: JSON.stringify({ originationStage: next.originationStage }),
      },
    });

    await prisma.losAutomationEvent.create({
      data: {
        applicationId: app.id,
        type: "LOAN_STAGE_CHANGED",
        payloadJson: JSON.stringify({ from: "APP_STARTED", to: "APP_SUBMITTED" }),
      },
    });

    return {
      applicationId: app.id,
      loanFile: mapLoanFile(updatedLoan),
      originationStage: updatedLoan.originationStage,
    };
  }

  async createQualificationSnapshot(input: { applicationId: string }) {
    const app = await this.requireApplication(input.applicationId);
    const sections = await loadSectionStates(app.id);
    const bodies: Record<string, unknown> = {};
    for (const row of sections) {
      const body = decodeSectionPayload(row.errorsJson);
      if (body) bodies[row.section] = body;
    }

    const loan = (bodies.LOAN as Record<string, unknown>) ?? {};
    const emp = (bodies.EMPLOYMENT as Record<string, unknown>) ?? { jobs: [] };
    const assets = (bodies.ASSETS as Record<string, unknown>) ?? { accounts: [] };
    const liab = (bodies.LIABILITIES as Record<string, unknown>) ?? { items: [] };
    const jobs = Array.isArray(emp.jobs) ? emp.jobs : [];
    const accounts = Array.isArray(assets.accounts) ? assets.accounts : [];
    const items = Array.isArray(liab.items) ? liab.items : [];
    const otherIncome = Array.isArray(emp.otherIncome) ? emp.otherIncome : [];

    const qualInput: QualInput = {
      purchasePriceCents: (loan.estimatedPurchasePriceCents as number) ?? null,
      appraisedValueCents: null,
      downPaymentCents: (loan.downPaymentAmountCents as number) ?? null,
      loanAmountCents: (loan.loanAmountNeededCents as number) ?? null,
      noteRateBps: null,
      termMonths: (loan.termMonths as number) ?? 360,
      monthlyPitiCents: null,
      subordinateCents: 0,
      employments: jobs.map((j: Record<string, unknown>) => ({
        isCurrent: Boolean(j.isCurrent),
        monthlyIncomeCents: (j.monthlyIncomeBeforeTaxesCents as number) ?? 0,
        overtimeCents: (j.otAmountCents as number) ?? 0,
        bonusCents: (j.bonusAmountCents as number) ?? 0,
        commissionCents: (j.commissionAmountCents as number) ?? 0,
        businessIncomeCents: 0,
        selfEmployment:
          j.situation === "SELF_EMPLOYED" || j.employmentType === "SELF_EMPLOYED",
      })),
      otherIncomeCents: otherIncome.reduce(
        (s: number, r: Record<string, unknown>) =>
          s + (r.doesNotApply ? 0 : ((r.monthlyAmountCents as number) ?? 0)),
        0,
      ),
      liabilityMonthlyCents: items.reduce(
        (s: number, r: Record<string, unknown>) =>
          s + (r.toBePaidOff ? 0 : ((r.monthlyPaymentCents as number) ?? 0)),
        0,
      ),
      assetBalanceCents: accounts.reduce(
        (s: number, r: Record<string, unknown>) => s + ((r.estimatedBalanceCents as number) ?? 0),
        0,
      ),
      frontLimitBps: 2800,
      backLimitBps: 3600,
      ltvLimitBps: 9700,
    };

    const snapshot = calculateQualification(qualInput);

    await prisma.qualificationSnapshot.create({
      data: {
        applicationId: app.id,
        guidelineSet: "CONVENTIONAL",
        monthlyQualifyingIncomeCents: snapshot.totalMonthlyIncomeCents,
        monthlyHousingExpenseCents: snapshot.housingExpenseCents,
        monthlyTotalDebtCents: snapshot.totalDebtCents,
        loanAmountCents: snapshot.loanAmountCents,
        purchasePriceCents: qualInput.purchasePriceCents,
        appraisedValueCents: qualInput.appraisedValueCents,
        subordinateLienCents: qualInput.subordinateCents,
        liquidAssetCents: snapshot.assetVerifiedCents,
        frontDtiBps: snapshot.frontDtiBps,
        backDtiBps: snapshot.backDtiBps,
        ltvBps: snapshot.ltvBps,
        cltvBps: snapshot.cltvBps,
        frontLimitBps: qualInput.frontLimitBps,
        backLimitBps: qualInput.backLimitBps,
        withinFront: snapshot.withinFront,
        withinBack: snapshot.withinBack,
        inputsHash: JSON.stringify(qualInput),
      },
    });

    await prisma.losAutomationEvent.create({
      data: {
        applicationId: app.id,
        type: "QUALIFICATION_COMPUTED",
        payloadJson: JSON.stringify({
          frontDtiBps: snapshot.frontDtiBps,
          backDtiBps: snapshot.backDtiBps,
          ltvBps: snapshot.ltvBps,
        }),
      },
    });

    return snapshot;
  }

  async getApplication(applicationId: string) {
    const app = await this.requireApplication(applicationId);
    const loanRow = await prisma.loanFile.findUnique({ where: { applicationId: app.id } });
    if (!loanRow) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");

    const acks = await loadAcks(app.id);
    const sectionRows = await loadSectionStates(app.id);
    const publicBodies: Record<string, unknown> = {};
    for (const row of sectionRows) {
      const body = decodeSectionPayload(row.errorsJson);
      if (body) publicBodies[row.section] = this.publicSectionBody(row.section, body);
    }

    const latestQual = await prisma.qualificationSnapshot.findFirst({
      where: { applicationId: app.id },
      orderBy: { computedAt: "desc" },
    });

    let qualificationSnapshot: QualOutput | null = null;
    if (latestQual) {
      qualificationSnapshot = {
        grossMonthlyIncomeCents: latestQual.monthlyQualifyingIncomeCents,
        otherMonthlyIncomeCents: 0,
        totalMonthlyIncomeCents: latestQual.monthlyQualifyingIncomeCents,
        housingExpenseCents: latestQual.monthlyHousingExpenseCents,
        otherDebtCents: latestQual.monthlyTotalDebtCents,
        totalDebtCents: latestQual.monthlyTotalDebtCents,
        frontDtiBps: latestQual.frontDtiBps,
        backDtiBps: latestQual.backDtiBps,
        loanAmountCents: latestQual.loanAmountCents,
        valueBasisCents: latestQual.purchasePriceCents ?? latestQual.appraisedValueCents ?? 0,
        ltvBps: latestQual.ltvBps ?? 0,
        cltvBps: latestQual.cltvBps ?? 0,
        assetVerifiedCents: latestQual.liquidAssetCents,
        reservesMonthsBps: 0,
        withinFront: latestQual.withinFront,
        withinBack: latestQual.withinBack,
        withinLtv: true,
        ruleHits: [],
      };
    }

    const events = await prisma.losAutomationEvent.findMany({
      where: { applicationId: app.id },
      orderBy: { createdAt: "asc" },
    });

    return {
      applicationId: app.id,
      clientId: app.clientId,
      serviceCode: app.serviceCode,
      loanFile: mapLoanFile(loanRow),
      acknowledgments: acks,
      sections: publicBodies,
      borrower: await this.publicBorrower(app.id, app.clientId),
      qualificationSnapshot,
      events: events.map((e) => ({
        type: e.type,
        applicationId: app.id,
        payload: JSON.parse(e.payloadJson) as Record<string, unknown>,
        createdAt: e.createdAt,
      })) as AutomationEvent[],
    };
  }

  async getSection(applicationId: string, section: string) {
    await this.requireApplication(applicationId);
    const row = await prisma.applicationSectionState.findUnique({
      where: {
        applicationId_borrowerKey_section: {
          applicationId,
          borrowerKey: "",
          section: section as ApplicationSectionState["section"],
        },
      },
    });
    if (!row) return null;
    const body = decodeSectionPayload(row.errorsJson);
    return {
      section,
      body: body ? this.publicSectionBody(section, body) : null,
      savedAt: row.lastSavedAt,
    };
  }

  async publicBorrower(applicationId: string, clientId: string) {
    const row = await prisma.applicationSectionState.findUnique({
      where: {
        applicationId_borrowerKey_section: {
          applicationId,
          borrowerKey: "",
          section: "BORROWER",
        },
      },
    });
    const body = row ? decodeSectionPayload(row.errorsJson) : null;
    if (!body || typeof body !== "object") {
      return { clientId, ssnLast4: null };
    }
    return toPublic({ clientId, ...(body as Record<string, unknown>) });
  }

  private async requireApplication(applicationId: string) {
    const app = await prisma.mortgageApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");
    return app;
  }

  private normalizeDisclosures(
    disclosures: AcknowledgeComplianceInput["disclosures"],
  ): Array<{ type: ComplianceDisclosureType; acknowledged: boolean }> {
    const out: Array<{ type: ComplianceDisclosureType; acknowledged: boolean }> = [];
    for (const d of disclosures) {
      const type = typeof d === "string" ? d : d.type;
      const acknowledged = typeof d === "string" ? true : d.acknowledged ?? true;
      if (!isComplianceDisclosureType(type)) {
        throw new LosHttpError(422, "UNKNOWN_DISCLOSURE", [type], `Unknown disclosure ${type}`);
      }
      out.push({ type, acknowledged });
    }
    return out;
  }

  private includesPayment(
    types: Array<{ type: ComplianceDisclosureType; acknowledged: boolean }>,
  ): boolean {
    const have = new Set(types.filter((t) => t.acknowledged).map((t) => t.type));
    return PAYMENT_DISCLOSURE_TYPES.some((t) => have.has(t));
  }

  private sealSectionBody(section: string, body: unknown): unknown {
    if (section !== "BORROWER" && section !== "CO_BORROWER") return body;
    if (!body || typeof body !== "object") return body;
    const rec = body as Record<string, unknown>;
    if (typeof rec.ssn !== "string" || !rec.ssn) return body;
    const ssn = rec.ssn;
    const { ssn: _drop, ...rest } = rec;
    void _drop;
    return {
      ...rest,
      ssnLast4: last4(ssn),
      ssnCiphertext: encryptSsn(ssn, this.piiKey),
    };
  }

  private publicSectionBody(section: string, body: unknown): unknown {
    if (section !== "BORROWER" && section !== "CO_BORROWER") return body;
    if (!body || typeof body !== "object") return body;
    return toPublic(body as Record<string, unknown>);
  }

  private async syncBorrowerFromSection(
    applicationId: string,
    clientId: string,
    section: string,
    body: unknown,
  ) {
    if (!body || typeof body !== "object") return;
    const b = body as Record<string, unknown>;
    const roleKind = section === "CO_BORROWER" ? "CO_BORROWER" : "PRIMARY";

    const existing = await prisma.mortgageBorrower.findFirst({
      where: { applicationId, roleKind },
      select: { id: true },
    });

    const borrowerData = {
      firstNameOnDl: String(b.firstNameOnDl ?? ""),
      middleName: (b.middleName as string) ?? null,
      lastNameOnDl: String(b.lastNameOnDl ?? ""),
      mobilePhone: (b.mobilePhone as string) ?? null,
      email: (b.email as string) ?? null,
      workEmail: (b.workEmail as string) ?? null,
    };

    const borrower = existing
      ? await prisma.mortgageBorrower.update({
          where: { id: existing.id },
          data: borrowerData,
        })
      : await prisma.mortgageBorrower.create({
          data: {
            applicationId,
            clientId,
            roleKind,
            ...borrowerData,
          },
        });

    if (typeof b.ssnCiphertext === "string" && typeof b.ssnLast4 === "string") {
      const ciphertextBytes = Buffer.from(b.ssnCiphertext, "utf8");
      await prisma.ssnVault.upsert({
        where: { borrowerId: borrower.id },
        create: {
          clientId,
          borrowerId: borrower.id,
          ssnCiphertext: ciphertextBytes,
          ssnLast4: b.ssnLast4,
          ssnKeyVersion: "v1",
        },
        update: {
          ssnCiphertext: ciphertextBytes,
          ssnLast4: b.ssnLast4,
        },
      });
    }
  }

  private async persistSignature(
    applicationId: string,
    signature: AcknowledgeSignature,
    ip?: string,
    userAgent?: string,
    agreementVersion: string = DEFAULT_AGREEMENT_VERSION,
    now: Date = new Date(),
    dpaSelected = false,
  ) {
    await prisma.legalAcknowledgement.create({
      data: {
        applicationId,
        documentVersion: agreementVersion,
        signedAt: now,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
        signatureNameFirst: signature.typedFirst ?? "",
        signatureNameLast: signature.typedLast ?? "",
        signatureImageKey: signature.drawnSignatureKey ?? null,
        dateSigned: signature.dateSigned ? new Date(signature.dateSigned) : now,
        agreeNotNewCredit: true,
        agreeNoLargePurchases: true,
        agreeNoAccountChanges: true,
        understandMayImpactApproval: true,
        understandNonrefundable: true,
        understandPaymentCleared: true,
        understandCancelFee1800: true,
        understandNoChangeMind: true,
        interestedInDpa1800: dpaSelected,
        addressConfidentiality: false,
        creditAuthorization: true,
        informationRelease: true,
        eSignConsent: true,
        agreeAllTermsProceed: true,
        acknowledgedNoGuarantees: true,
        acknowledgedSeparateLenderIdentity: true,
        acknowledgedTaylorCarroll: true,
        loanAuditLenderRights: true,
      },
    });
  }
}

let prismaSingleton = new PrismaMortgageLosService();

export function getPrismaLosService(): PrismaMortgageLosService {
  return prismaSingleton;
}

export function resetPrismaLosService(opts?: { piiKey?: Buffer | string }): PrismaMortgageLosService {
  prismaSingleton = new PrismaMortgageLosService(opts);
  return prismaSingleton;
}
