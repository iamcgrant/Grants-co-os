/**
 * In-memory MORTGAGE_LOS application service.
 * Documents the API shape used by drop-in Next.js route handlers and vitest.
 * No Prisma client. Production host replaces this store with Prisma.
 */

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
import { LosHttpError, toHttpResponse } from "./errors";
import { createLoanFile, submitApplication as transitionSubmit, type LoanFileRecord } from "./lifecycle";
import { nextSequence } from "./loan-number";
import { calculateQualification, type QualInput, type QualOutput } from "./qualification";
import { SectionStore } from "./section-store";
import { encryptSsn, last4, toPublic } from "./ssn-vault";

export { toHttpResponse };

export type AutomationEvent = {
  type: string;
  applicationId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type ApplicationRecord = {
  applicationId: string;
  clientId: string;
  serviceCode: "MORTGAGE_LOS";
  loanFile: LoanFileRecord;
  acks: AcknowledgmentRow[];
  signature: AcknowledgeSignature | null;
  events: AutomationEvent[];
  qualificationSnapshot: QualOutput | null;
  createdAt: Date;
};

export type AcknowledgeSignature = {
  typedFirst?: string;
  typedLast?: string;
  drawnSignatureKey?: string;
  dateSigned?: string;
};

export type CreateApplicationInput = { clientId: string };

export type AcknowledgeComplianceInput = {
  applicationId: string;
  disclosures: Array<string | { type: string; acknowledged?: boolean }>;
  signature?: AcknowledgeSignature;
  ip?: string;
  userAgent?: string;
  dpaSelected?: boolean;
  agreementVersion?: string;
  now?: Date;
};

export type PatchSectionInput = {
  applicationId: string;
  section: string;
  body: unknown;
};

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

function emptySections(): Record<string, { status: string; body: unknown | null }> {
  const out: Record<string, { status: string; body: unknown | null }> = {};
  for (const code of SECTION_CODES) {
    out[code] = {
      status: code === "COMPLIANCE" ? "EMPTY" : "BLOCKED",
      body: null,
    };
  }
  return out;
}

export class MortgageLosService {
  private seq = 0;
  private readonly apps = new Map<string, ApplicationRecord>();
  private readonly sections = new SectionStore();
  private readonly piiKey: Buffer | string;

  constructor(opts?: { piiKey?: Buffer | string }) {
    this.piiKey = opts?.piiKey ?? process.env.MORTGAGE_PII_KEY ?? Buffer.alloc(32, 7);
  }

  createApplication(input: CreateApplicationInput) {
    if (!input.clientId) {
      throw new LosHttpError(422, "CLIENT_REQUIRED", undefined, "clientId is required");
    }
    this.seq = nextSequence(this.seq);
    const loanFile = createLoanFile({ seq: this.seq });
    const applicationId = `app_${this.seq}`;
    const rec: ApplicationRecord = {
      applicationId,
      clientId: input.clientId,
      serviceCode: "MORTGAGE_LOS",
      loanFile,
      acks: [],
      signature: null,
      events: [
        {
          type: "LOAN_APP_STARTED",
          applicationId,
          payload: { loanNumber: loanFile.loanNumber, clientId: input.clientId },
          createdAt: new Date(),
        },
      ],
      qualificationSnapshot: null,
      createdAt: new Date(),
    };
    this.apps.set(applicationId, rec);
    return {
      applicationId,
      loanFile: {
        loanNumber: loanFile.loanNumber,
        originationStage: loanFile.originationStage,
        ...loanFile,
      },
      sections: emptySections(),
    };
  }

  acknowledgeCompliance(input: AcknowledgeComplianceInput) {
    const rec = this.require(input.applicationId);
    const now = input.now ?? new Date();
    const agreementVersion = input.agreementVersion ?? DEFAULT_AGREEMENT_VERSION;
    const types = this.normalizeDisclosures(input.disclosures);

    for (const item of types) {
      rec.acks = recordAcknowledgment({
        existing: rec.acks,
        type: item.type,
        borrowerId: rec.clientId,
        ip: input.ip,
        userAgent: input.userAgent,
        agreementVersion,
        now,
        applicationId: rec.applicationId,
        acknowledged: item.acknowledged,
      });
    }

    rec.loanFile.agreementVersion = agreementVersion;
    if (input.signature) rec.signature = input.signature;

    const dpaChoice = Boolean(input.dpaSelected);
    // Always record the DPA choice (not a blocker).
    rec.acks = recordAcknowledgment({
      existing: rec.acks,
      type: "DPA_SELECTION",
      borrowerId: rec.clientId,
      ip: input.ip,
      userAgent: input.userAgent,
      agreementVersion,
      now,
      applicationId: rec.applicationId,
      acknowledged: true,
    });
    const dpa = applyDpaSelection({
      selected: dpaChoice,
      now,
      currentPackageCents: rec.loanFile.servicePackageAmountCents - rec.loanFile.dpaAmountCents,
    });
    rec.loanFile.dpaSelected = dpa.dpaSelected;
    rec.loanFile.dpaAmountCents = dpa.dpaAmountCents;
    rec.loanFile.dpaSelectedAt = dpa.dpaSelectedAt;
    rec.loanFile.servicePackageAmountCents = dpa.servicePackageAmountCents;
    if (dpa.event) {
      rec.events.push({
        type: dpa.event,
        applicationId: rec.applicationId,
        payload: { dpaAmountCents: dpa.dpaAmountCents },
        createdAt: now,
      });
    }

    if (hasPaymentAcks(rec.acks) || this.includesPayment(types)) {
      rec.loanFile.paymentAcknowledged = true;
      rec.loanFile.paymentAcknowledgedAt = now;
    }

    rec.events.push({
      type: "ECONSENT_RECORDED",
      applicationId: rec.applicationId,
      payload: { agreementVersion, count: rec.acks.length },
      createdAt: now,
    });

    return {
      applicationId: rec.applicationId,
      acknowledgments: rec.acks,
      loanFile: rec.loanFile,
      dpa: {
        dpaSelected: rec.loanFile.dpaSelected,
        dpaAmountCents: rec.loanFile.dpaAmountCents,
        dpaSelectedAt: rec.loanFile.dpaSelectedAt,
        confirmationCopy: dpa.confirmationCopy,
        event: dpa.event,
      },
      canPatchSections: canPatchSections(rec.acks),
    };
  }

  patchSection(input: PatchSectionInput) {
    const rec = this.require(input.applicationId);
    const saved = this.sections.saveSection({
      applicationId: rec.applicationId,
      section: input.section,
      body: this.sealSectionBody(input.section, input.body),
      acks: rec.acks,
    });
    rec.events.push({
      type: "APPLICATION_SAVED",
      applicationId: rec.applicationId,
      payload: { section: saved.section },
      createdAt: saved.savedAt,
    });
    return {
      applicationId: rec.applicationId,
      section: saved.section,
      body: this.publicSectionBody(saved.section, saved.body),
      savedAt: saved.savedAt,
    };
  }

  getSection(applicationId: string, section: string) {
    this.require(applicationId);
    const row = this.sections.getSection(applicationId, section);
    if (!row) return null;
    return { ...row, body: this.publicSectionBody(section, row.body) };
  }

  submitApplication(input: { applicationId: string }) {
    const rec = this.require(input.applicationId);
    const next = transitionSubmit({ stage: rec.loanFile.originationStage, acks: rec.acks });
    rec.loanFile.originationStage = next.originationStage;
    if (hasPaymentAcks(rec.acks)) {
      rec.loanFile.paymentAcknowledged = true;
      rec.loanFile.paymentAcknowledgedAt = rec.loanFile.paymentAcknowledgedAt ?? new Date();
    }
    rec.events.push({
      type: "APPLICATION_SUBMITTED",
      applicationId: rec.applicationId,
      payload: { originationStage: rec.loanFile.originationStage },
      createdAt: new Date(),
    });
    rec.events.push({
      type: "LOAN_STAGE_CHANGED",
      applicationId: rec.applicationId,
      payload: { from: "APP_STARTED", to: "APP_SUBMITTED" },
      createdAt: new Date(),
    });
    return {
      applicationId: rec.applicationId,
      loanFile: rec.loanFile,
      originationStage: rec.loanFile.originationStage,
    };
  }

  createQualificationSnapshot(input: { applicationId: string }) {
    const rec = this.require(input.applicationId);
    const bodies = this.sections.all(rec.applicationId) as Record<string, any>;
    const loan = bodies.LOAN ?? {};
    const emp = bodies.EMPLOYMENT ?? { jobs: [] };
    const assets = bodies.ASSETS ?? { accounts: [] };
    const liab = bodies.LIABILITIES ?? { items: [] };
    const jobs = Array.isArray(emp.jobs) ? emp.jobs : [];
    const accounts = Array.isArray(assets.accounts) ? assets.accounts : [];
    const items = Array.isArray(liab.items) ? liab.items : [];
    const otherIncome = Array.isArray(emp.otherIncome) ? emp.otherIncome : [];

    const qualInput: QualInput = {
      purchasePriceCents: loan.estimatedPurchasePriceCents ?? null,
      appraisedValueCents: null,
      downPaymentCents: loan.downPaymentAmountCents ?? null,
      loanAmountCents: loan.loanAmountNeededCents ?? null,
      noteRateBps: null,
      termMonths: loan.termMonths ?? 360,
      monthlyPitiCents: null,
      subordinateCents: 0,
      employments: jobs.map((j: any) => ({
        isCurrent: Boolean(j.isCurrent),
        monthlyIncomeCents: j.monthlyIncomeBeforeTaxesCents ?? 0,
        overtimeCents: j.otAmountCents ?? 0,
        bonusCents: j.bonusAmountCents ?? 0,
        commissionCents: j.commissionAmountCents ?? 0,
        businessIncomeCents: 0,
        selfEmployment: j.situation === "SELF_EMPLOYED" || j.employmentType === "SELF_EMPLOYED",
      })),
      otherIncomeCents: otherIncome.reduce(
        (s: number, r: any) => s + (r.doesNotApply ? 0 : r.monthlyAmountCents ?? 0),
        0,
      ),
      liabilityMonthlyCents: items.reduce(
        (s: number, r: any) => s + (r.toBePaidOff ? 0 : r.monthlyPaymentCents ?? 0),
        0,
      ),
      assetBalanceCents: accounts.reduce((s: number, r: any) => s + (r.estimatedBalanceCents ?? 0), 0),
      frontLimitBps: 2800,
      backLimitBps: 3600,
      ltvLimitBps: 9700,
    };
    const snapshot = calculateQualification(qualInput);
    rec.qualificationSnapshot = snapshot;
    rec.events.push({
      type: "QUALIFICATION_COMPUTED",
      applicationId: rec.applicationId,
      payload: {
        frontDtiBps: snapshot.frontDtiBps,
        backDtiBps: snapshot.backDtiBps,
        ltvBps: snapshot.ltvBps,
      },
      createdAt: new Date(),
    });
    return snapshot;
  }

  getApplication(applicationId: string) {
    const rec = this.require(applicationId);
    const bodies = this.sections.all(applicationId);
    const publicBodies: Record<string, unknown> = {};
    for (const [section, body] of Object.entries(bodies)) {
      publicBodies[section] = this.publicSectionBody(section, body);
    }
    return {
      applicationId: rec.applicationId,
      clientId: rec.clientId,
      serviceCode: rec.serviceCode,
      loanFile: rec.loanFile,
      acknowledgments: rec.acks,
      sections: publicBodies,
      borrower: this.publicBorrower(applicationId),
      qualificationSnapshot: rec.qualificationSnapshot,
      events: rec.events.map((e) => ({ type: e.type, payload: e.payload, createdAt: e.createdAt })),
    };
  }

  publicBorrower(applicationId: string) {
    const rec = this.require(applicationId);
    const stored = this.sections.getSection(applicationId, "BORROWER");
    if (!stored || !stored.body || typeof stored.body !== "object") {
      return { clientId: rec.clientId, ssnLast4: null };
    }
    return toPublic({ clientId: rec.clientId, ...(stored.body as Record<string, unknown>) });
  }

  private require(applicationId: string): ApplicationRecord {
    const rec = this.apps.get(applicationId);
    if (!rec) throw new LosHttpError(404, "APPLICATION_NOT_FOUND");
    return rec;
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
}

let singleton = new MortgageLosService();

export function getLosService(): MortgageLosService {
  return singleton;
}

export function resetLosService(opts?: { piiKey?: Buffer | string }): MortgageLosService {
  singleton = new MortgageLosService(opts);
  return singleton;
}

export function createMortgageLosService(opts?: { piiKey?: Buffer | string }): MortgageLosService {
  return new MortgageLosService(opts);
}
