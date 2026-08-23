import { z } from "zod";

export const SectionCode = z.enum([
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
]);
export type SectionCode = z.infer<typeof SectionCode>;

const money = z.number().int().nonnegative();
const yesNo = z.enum(["YES", "NO"]);
const yesNoU = z.enum(["YES", "NO", "UNKNOWN"]);

export const ComplianceBody = z.object({
  eSignConsent: z.literal(true),
  creditAuthorization: z.literal(true),
  informationRelease: z.literal(true),
  agreeNotNewCredit: z.literal(true),
  agreeNoLargePurchases: z.literal(true),
  agreeNoAccountChanges: z.literal(true),
  understandMayImpactApproval: z.literal(true),
  understandNonrefundable: z.literal(true),
  understandPaymentCleared: z.literal(true),
  understandCancelFee1800: z.literal(true),
  understandNoChangeMind: z.literal(true),
  agreeAllTermsProceed: z.literal(true),
  acknowledgedNoGuarantees: z.literal(true),
  acknowledgedSeparateLenderIdentity: z.literal(true),
  acknowledgedTaylorCarroll: z.literal(true),
  acknowledgedAgentAssignment: z.literal(true),
  loanAuditLenderRights: z.literal(true),
  serviceResolutionAck: z.literal(true),
  interestedInDpa1800: z.boolean().default(false),
  addressConfidentiality: z.boolean(),
  typedFirst: z.string().min(1).max(80),
  typedLast: z.string().min(1).max(80),
  drawnSignatureKey: z.string().min(1),
  dateSigned: z.string().datetime().or(z.string().min(8)),
});

export const AddressRow = z.object({
  street: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
  startOn: z.string().min(8),
  endOn: z.string().min(8).nullable().optional(),
  housingTenure: z.enum(["OWN", "RENT", "DO_NOT_CURRENTLY_PAY_RENT"]),
  monthlyRentCents: money.optional(),
  isMailing: z.boolean().default(false),
});

export const BorrowerBody = z.object({
  firstNameOnDl: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  lastNameOnDl: z.string().min(1).max(80),
  dateOfBirth: z.string().min(8),
  ssn: z.string().regex(/^\d{9}$/).optional(), // write-only
  mobilePhone: z.string().min(10).max(20),
  email: z.string().email(),
  workEmail: z.string().email().optional(),
  citizenshipOrResidency: z.enum([
    "US_CITIZEN",
    "PERMANENT_RESIDENT",
    "NON_PERMANENT_RESIDENT",
    "OTHER",
  ]),
  militaryService: yesNo,
  preferredLanguage: z.string().optional(),
  maritalStatus: z.enum(["MARRIED", "SEPARATED", "UNMARRIED"]),
  nonSpousePropertyRights: yesNoU.optional(),
  dependentsCount: z.number().int().nonnegative(),
  dependentsAges: z.array(z.number().int().nonnegative()).optional(),
  mailingSameAsCurrent: z.boolean().default(true),
  mailingStreet: z.string().optional(),
  mailingCity: z.string().optional(),
  mailingState: z.string().optional(),
  mailingZip: z.string().optional(),
  addresses: z.array(AddressRow).min(1),
});

export const EmploymentRow = z.object({
  situation: z.enum([
    "CURRENTLY_EMPLOYED",
    "NOT_CURRENTLY_EMPLOYED",
    "SELF_EMPLOYED",
    "RETIRED",
    "OTHER",
  ]),
  employmentType: z
    .enum(["EMPLOYED_BY_A_BUSINESS", "SELF_EMPLOYED", "OTHER"])
    .optional(),
  employerName: z.string().optional(),
  jobTitle: z.string().optional(),
  employerStreet: z.string().optional(),
  employerCity: z.string().optional(),
  employerState: z.string().optional(),
  employerZip: z.string().optional(),
  employerPhone: z.string().optional(),
  startDate: z.string().min(8),
  endDate: z.string().min(8).nullable().optional(),
  isCurrent: z.boolean(),
  yearsInLineOfWork: z.number().int().nonnegative().optional(),
  monthsInLineOfWork: z.number().int().min(0).max(11).optional(),
  relatedPartyEmployment: z.boolean().default(false),
  monthlyIncomeBeforeTaxesCents: money.optional(),
  hasOtCommissionBonus: z.boolean().default(false),
  otAmountCents: money.optional(),
  bonusAmountCents: money.optional(),
  commissionAmountCents: money.optional(),
});

export const EmploymentBody = z.object({
  jobs: z.array(EmploymentRow).min(1),
  otherIncome: z
    .array(
      z.object({
        source: z.string().min(1),
        monthlyAmountCents: money,
        doesNotApply: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const AssetsBody = z.object({
  accounts: z.array(
    z.object({
      institutionName: z.string().min(1),
      accountType: z.enum([
        "CHECKING",
        "SAVINGS",
        "RETIREMENT",
        "INVESTMENT",
        "OTHER",
      ]),
      accountLast4: z.string().regex(/^\d{4}$/),
      estimatedBalanceCents: money,
    }),
  ),
  gifts: z
    .array(
      z.object({
        source: z.string().min(1),
        amountCents: money,
        doesNotApply: z.boolean().default(false),
      }),
    )
    .optional(),
  otherAssets: z
    .array(
      z.object({
        description: z.string().min(1),
        amountCents: money,
        doesNotApply: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const LiabilitiesBody = z.object({
  doesNotApply: z.boolean().default(false),
  items: z.array(
    z.object({
      type: z.enum(["AUTO", "REVOLVING", "STUDENT", "INSTALLMENT", "OTHER"]),
      creditorName: z.string().optional(),
      monthlyPaymentCents: money,
      unpaidBalanceCents: money,
      toBePaidOff: z.boolean().default(false),
    }),
  ),
});

export const ReoBody = z.object({
  ownOtherRealEstate: z.boolean(),
  properties: z.array(
    z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().length(2),
      zip: z.string().min(5),
      propertyType: z
        .enum([
          "SINGLE_FAMILY",
          "CONDO",
          "TOWNHOUSE",
          "MULTI_UNIT",
          "MANUFACTURED",
          "OTHER",
        ])
        .optional(),
      occupancy: z
        .enum(["PRIMARY_RESIDENCE", "SECOND_HOME", "INVESTMENT"])
        .optional(),
      disposition: z.enum(["RETAIN", "SELL", "PENDING_SALE"]).optional(),
      marketValueCents: money.optional(),
      mortgageCreditor: z.string().optional(),
      mortgageBalanceCents: money.optional(),
      mortgageMonthlyCents: money.optional(),
      rentalIncomeMonthlyCents: money.optional(),
    }),
  ),
});

export const LoanBody = z.object({
  loanPurpose: z.enum(["PURCHASE", "REFINANCE"]),
  estimatedPurchasePriceCents: money.optional(),
  downPaymentAmountCents: money.optional(),
  downPaymentSource: z
    .enum(["CHECKING_SAVINGS", "GIFT", "GRANT", "SALE_OF_ASSET", "OTHER"])
    .optional(),
  loanAmountNeededCents: money.optional(),
  propertyType: z.enum([
    "SINGLE_FAMILY",
    "CONDO",
    "TOWNHOUSE",
    "MULTI_UNIT",
    "MANUFACTURED",
    "OTHER",
  ]),
  occupancy: z.enum(["PRIMARY_RESIDENCE", "SECOND_HOME", "INVESTMENT"]),
  specificHomeSelected: yesNoU,
  propertyStreet: z.string().optional(),
  propertyCity: z.string().optional(),
  propertyState: z.string().optional(),
  propertyZip: z.string().optional(),
  builderSubdivisionCommunity: z.string().optional(),
  buyerBrokerAgreement: yesNoU.optional(),
  realtorName: z.string().optional(),
  includeCreditRepair: z.boolean(),
  termMonths: z.number().int().positive().default(360),
});

export const DeclarationsBody = z.object({
  intendOccupyPrimary: yesNo,
  ownershipInterestLast3Years: yesNo,
  sellerAffiliation: yesNo,
  undisclosedBorrowedFunds: yesNo,
  otherMortgageApplication: yesNo,
  newCreditBeforeClosing: yesNo,
  pacePriorityLien: yesNo,
  cosignorUndisclosed: yesNo,
  outstandingJudgments: yesNo,
  federalDebtDefault: yesNo,
  lawsuitLiability: yesNo,
  deedInLieuLast7Years: yesNo,
  shortSaleLast7Years: yesNo,
  foreclosureLast7Years: yesNo,
  bankruptcyLast7Years: yesNo,
  explanations: z.record(z.string(), z.string()).optional(),
  creditItems: z
    .array(
      z.object({
        kind: z.enum(["COLLECTION", "CHARGE_OFF", "LATE_PAYMENT", "JUDGMENT"]),
        creditorName: z.string().optional(),
        amountCents: money.optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

export const SectionBodies: Record<string, z.ZodType> = {
  COMPLIANCE: ComplianceBody,
  BORROWER: BorrowerBody,
  CO_BORROWER: BorrowerBody,
  EMPLOYMENT: EmploymentBody,
  ASSETS: AssetsBody,
  LIABILITIES: LiabilitiesBody,
  REO: ReoBody,
  LOAN: LoanBody,
  DECLARATIONS: DeclarationsBody,
};
