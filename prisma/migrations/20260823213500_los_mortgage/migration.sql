-- CreateTable
CREATE TABLE "MortgageApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "coBorrowerClientId" TEXT,
    "serviceCode" TEXT NOT NULL DEFAULT 'MORTGAGE_LOS',
    "pipelineStage" TEXT NOT NULL DEFAULT 'NEW_APPLICATION',
    "qualitativeStatus" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "currentStep" TEXT NOT NULL DEFAULT 'AGREEMENT',
    "submittedAt" DATETIME,
    "referredToLenderAt" DATETIME,
    "closedAt" DATETIME,
    "includeCreditRepair" BOOLEAN,
    "creditProgramPath" TEXT,
    "interestedInDpa1800" BOOLEAN NOT NULL DEFAULT false,
    "creditConcernsText" TEXT,
    "ghlContactId" TEXT,
    "ghlSyncStatus" TEXT NOT NULL DEFAULT 'STUB',
    "disputeFoxClientId" TEXT,
    "legalVersionRequired" TEXT NOT NULL DEFAULT '2026-08-23-cognito-derived-draft-v1',
    "exampleData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MortgageApplication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SsnVault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "ssnCiphertext" BLOB NOT NULL,
    "ssnLast4" TEXT NOT NULL,
    "ssnKeyVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SsnVault_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SsnVault_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageBorrower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "roleKind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "firstNameOnDl" TEXT NOT NULL,
    "middleName" TEXT,
    "lastNameOnDl" TEXT NOT NULL,
    "mobilePhone" TEXT,
    "email" TEXT,
    "workEmail" TEXT,
    "dateOfBirth" DATETIME,
    "citizenshipOrResidency" TEXT,
    "militaryService" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "preferredLanguage" TEXT,
    "maritalStatus" TEXT,
    "nonSpousePropertyRights" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dependentsCount" INTEGER NOT NULL DEFAULT 0,
    "dependentsAgesJson" TEXT,
    "currentStreet" TEXT,
    "currentLine2" TEXT,
    "currentCity" TEXT,
    "currentState" TEXT,
    "currentZip" TEXT,
    "mailingSameAsCurrent" BOOLEAN NOT NULL DEFAULT true,
    "mailingStreet" TEXT,
    "mailingCity" TEXT,
    "mailingState" TEXT,
    "mailingZip" TEXT,
    "yearsAtAddress" INTEGER,
    "monthsAtAddress" INTEGER,
    "ownRentOrNoRent" TEXT,
    "hmdaEthnicityJson" TEXT,
    "hmdaRaceJson" TEXT,
    "hmdaGenderJson" TEXT,
    "hmdaDoNotWishToProvide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MortgageBorrower_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "signatureNameFirst" TEXT NOT NULL,
    "signatureNameLast" TEXT NOT NULL,
    "signatureImageKey" TEXT,
    "dateSigned" DATETIME NOT NULL,
    "agreeNotNewCredit" BOOLEAN NOT NULL,
    "agreeNoLargePurchases" BOOLEAN NOT NULL,
    "agreeNoAccountChanges" BOOLEAN NOT NULL,
    "understandMayImpactApproval" BOOLEAN NOT NULL,
    "understandNonrefundable" BOOLEAN NOT NULL,
    "understandPaymentCleared" BOOLEAN NOT NULL,
    "understandCancelFee1800" BOOLEAN NOT NULL,
    "understandNoChangeMind" BOOLEAN NOT NULL,
    "interestedInDpa1800" BOOLEAN NOT NULL DEFAULT false,
    "addressConfidentiality" BOOLEAN NOT NULL,
    "creditAuthorization" BOOLEAN NOT NULL,
    "informationRelease" BOOLEAN NOT NULL,
    "eSignConsent" BOOLEAN NOT NULL,
    "agreeAllTermsProceed" BOOLEAN NOT NULL,
    "acknowledgedTaylorCarroll" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgedSeparateLenderIdentity" BOOLEAN NOT NULL DEFAULT true,
    "loanAuditLenderRights" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedNoGuarantees" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAcknowledgement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceAcknowledgment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "disclosureType" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL,
    "agreementVersion" TEXT NOT NULL DEFAULT '2026-08-23-cognito-derived-draft-v1',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceAcknowledgment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "employmentType" TEXT,
    "employerName" TEXT,
    "employerStreet" TEXT,
    "employerCity" TEXT,
    "employerState" TEXT,
    "employerZip" TEXT,
    "employerPhone" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "yearsInLineOfWork" INTEGER,
    "monthsInLineOfWork" INTEGER,
    "relatedPartyEmployment" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "monthlyIncomeBeforeTaxesCents" INTEGER,
    "hasOtCommissionBonus" BOOLEAN NOT NULL DEFAULT false,
    "otAmountCents" INTEGER,
    "commissionAmountCents" INTEGER,
    "bonusAmountCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employment_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "monthlyAmountCents" INTEGER NOT NULL,
    "doesNotApply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeSource_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "estimatedBalanceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetAccount_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "monthlyPaymentCents" INTEGER NOT NULL,
    "unpaidBalanceCents" INTEGER NOT NULL,
    "toBePaidOff" BOOLEAN NOT NULL DEFAULT false,
    "doesNotApply" BOOLEAN NOT NULL DEFAULT false,
    "creditorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Liability_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageGiftGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "doesNotApply" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MortgageGiftGrant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageOtherAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "doesNotApply" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MortgageOtherAsset_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageReo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "ownOtherRealEstate" BOOLEAN NOT NULL DEFAULT false,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "propertyType" TEXT,
    "occupancy" TEXT,
    "disposition" TEXT,
    "marketValueCents" INTEGER,
    "mortgageCreditor" TEXT,
    "mortgageBalanceCents" INTEGER,
    "mortgageMonthlyCents" INTEGER,
    "rentalIncomeMonthlyCents" INTEGER,
    CONSTRAINT "MortgageReo_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageCreditItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "creditorName" TEXT,
    "amountCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MortgageCreditItem_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Declaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "intendOccupyPrimary" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "ownershipInterestLast3Years" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sellerAffiliation" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "undisclosedBorrowedFunds" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "otherMortgageApplication" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "newCreditBeforeClosing" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "pacePriorityLien" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "cosignorUndisclosed" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "outstandingJudgments" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "federalDebtDefault" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lawsuitLiability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "deedInLieuLast7Years" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "shortSaleLast7Years" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "foreclosureLast7Years" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "bankruptcyLast7Years" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "explanationsJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Declaration_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropertyGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "loanPurpose" TEXT,
    "estimatedPurchasePriceCents" INTEGER,
    "downPaymentAmountCents" INTEGER,
    "downPaymentSource" TEXT,
    "loanAmountNeededCents" INTEGER,
    "propertyType" TEXT,
    "occupancy" TEXT,
    "builderSubdivisionCommunity" TEXT,
    "buyerBrokerAgreement" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "specificHomeSelected" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "propertyStreet" TEXT,
    "propertyCity" TEXT,
    "propertyState" TEXT,
    "propertyZip" TEXT,
    "realtorName" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyGoal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageDocumentFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT,
    "package" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MortgageDocumentFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MortgageDocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "missingDocumentsJson" TEXT NOT NULL,
    "missingInformationJson" TEXT NOT NULL,
    "incomeInconsistenciesJson" TEXT NOT NULL,
    "employmentConcernsJson" TEXT NOT NULL,
    "creditRiskFactorsJson" TEXT NOT NULL,
    "recommendedActionsJson" TEXT NOT NULL,
    "narrative" TEXT,
    "modelId" TEXT,
    "forbiddenLanguageHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "aiReviewId" TEXT,
    "score" INTEGER NOT NULL,
    "strengthsJson" TEXT NOT NULL,
    "risksJson" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadinessScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadinessScore_aiReviewId_fkey" FOREIGN KEY ("aiReviewId") REFERENCES "AiReview" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MortgageAuditEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MortgageAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageStaffAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "roleLabel" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MortgageStaffAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MortgageStaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MortgageApplicationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MortgageApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MortgageApplicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LenderOrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nmlsId" TEXT,
    "companyNmls" TEXT,
    "licensedStates" JSONB NOT NULL,
    "dbaName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoanFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PURCHASE',
    "purchasePriceCents" INTEGER,
    "appraisedValueCents" INTEGER,
    "loanAmountCents" INTEGER,
    "noteRateBps" INTEGER,
    "termMonths" INTEGER,
    "occupancy" TEXT,
    "ltvBps" INTEGER,
    "cltvBps" INTEGER,
    "frontDtiBps" INTEGER,
    "backDtiBps" INTEGER,
    "reservesMonths" INTEGER,
    "guidelineSet" TEXT NOT NULL DEFAULT 'CONVENTIONAL',
    "nmlsConfigId" TEXT,
    "originationStage" TEXT NOT NULL DEFAULT 'APP_STARTED',
    "dpaSelected" BOOLEAN NOT NULL DEFAULT false,
    "dpaAmountCents" INTEGER NOT NULL DEFAULT 0,
    "dpaSelectedAt" DATETIME,
    "paymentAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "paymentAcknowledgedAt" DATETIME,
    "agreementVersion" TEXT NOT NULL DEFAULT '2026-08-23-cognito-derived-draft-v1',
    "servicePackageAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoanFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoanFile_nmlsConfigId_fkey" FOREIGN KEY ("nmlsConfigId") REFERENCES "LenderOrgSettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoanStageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanStageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConditionCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "timingDefault" TEXT NOT NULL DEFAULT 'PTD',
    "borrowerOwned" BOOLEAN NOT NULL DEFAULT false,
    "requiresUpload" BOOLEAN NOT NULL DEFAULT true,
    "processorCanClear" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "LoanCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timing" TEXT NOT NULL DEFAULT 'PTD',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "borrowerOwned" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" DATETIME,
    "requestedAt" DATETIME,
    "receivedAt" DATETIME,
    "reviewedAt" DATETIME,
    "clearedAt" DATETIME,
    "waivedAt" DATETIME,
    "rejectedAt" DATETIME,
    "notes" TEXT,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoanCondition_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoanCondition_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ConditionCatalogItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LoanCondition_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BorrowerActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Borrower action plan',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BorrowerActionPlan_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    CONSTRAINT "ActionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BorrowerActionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionPlanItem_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "LoanCondition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualificationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "guidelineSet" TEXT NOT NULL,
    "monthlyQualifyingIncomeCents" INTEGER NOT NULL,
    "monthlyHousingExpenseCents" INTEGER NOT NULL,
    "monthlyTotalDebtCents" INTEGER NOT NULL,
    "loanAmountCents" INTEGER NOT NULL,
    "purchasePriceCents" INTEGER,
    "appraisedValueCents" INTEGER,
    "subordinateLienCents" INTEGER NOT NULL DEFAULT 0,
    "liquidAssetCents" INTEGER NOT NULL,
    "frontDtiBps" INTEGER NOT NULL,
    "backDtiBps" INTEGER NOT NULL,
    "ltvBps" INTEGER,
    "cltvBps" INTEGER,
    "reservesMonths" INTEGER,
    "frontLimitBps" INTEGER NOT NULL,
    "backLimitBps" INTEGER NOT NULL,
    "withinFront" BOOLEAN NOT NULL,
    "withinBack" BOOLEAN NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualificationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnderwritingDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "rationale" TEXT,
    "productionGateRequired" BOOLEAN NOT NULL DEFAULT true,
    "productionReleased" BOOLEAN NOT NULL DEFAULT false,
    "charlesApprovedAt" DATETIME,
    "charlesApprovedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnderwritingDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnderwritingDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UnderwritingDecision_charlesApprovedById_fkey" FOREIGN KEY ("charlesApprovedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppraisalOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_ORDERED',
    "orderedAt" DATETIME,
    "receivedAt" DATETIME,
    "valueCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppraisalOrder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessingChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "doneById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessingChecklistItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrantsReadinessTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "creditReady" BOOLEAN NOT NULL DEFAULT false,
    "docsReady" BOOLEAN NOT NULL DEFAULT false,
    "prepReady" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GrantsReadinessTrack_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LosAutomationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApplicationSectionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "borrowerKey" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EMPTY',
    "lastSavedAt" DATETIME,
    "errorsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ApplicationSectionState_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MortgageApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BorrowerAddressHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "startOn" DATETIME NOT NULL,
    "endOn" DATETIME,
    "housingTenure" TEXT NOT NULL,
    "monthlyRentCents" INTEGER,
    "isMailing" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BorrowerAddressHistory_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "MortgageBorrower" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MortgageApplication_clientId_idx" ON "MortgageApplication"("clientId");

-- CreateIndex
CREATE INDEX "MortgageApplication_pipelineStage_idx" ON "MortgageApplication"("pipelineStage");

-- CreateIndex
CREATE INDEX "MortgageApplication_qualitativeStatus_idx" ON "MortgageApplication"("qualitativeStatus");

-- CreateIndex
CREATE INDEX "MortgageApplication_ghlContactId_idx" ON "MortgageApplication"("ghlContactId");

-- CreateIndex
CREATE UNIQUE INDEX "SsnVault_borrowerId_key" ON "SsnVault"("borrowerId");

-- CreateIndex
CREATE INDEX "SsnVault_clientId_idx" ON "SsnVault"("clientId");

-- CreateIndex
CREATE INDEX "SsnVault_ssnLast4_idx" ON "SsnVault"("ssnLast4");

-- CreateIndex
CREATE INDEX "MortgageBorrower_applicationId_idx" ON "MortgageBorrower"("applicationId");

-- CreateIndex
CREATE INDEX "MortgageBorrower_clientId_idx" ON "MortgageBorrower"("clientId");

-- CreateIndex
CREATE INDEX "MortgageBorrower_email_idx" ON "MortgageBorrower"("email");

-- CreateIndex
CREATE INDEX "LegalAcknowledgement_applicationId_signedAt_idx" ON "LegalAcknowledgement"("applicationId", "signedAt");

-- CreateIndex
CREATE INDEX "ComplianceAcknowledgment_applicationId_idx" ON "ComplianceAcknowledgment"("applicationId");

-- CreateIndex
CREATE INDEX "ComplianceAcknowledgment_borrowerId_idx" ON "ComplianceAcknowledgment"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceAcknowledgment_applicationId_disclosureType_key" ON "ComplianceAcknowledgment"("applicationId", "disclosureType");

-- CreateIndex
CREATE INDEX "Employment_borrowerId_idx" ON "Employment"("borrowerId");

-- CreateIndex
CREATE INDEX "IncomeSource_borrowerId_idx" ON "IncomeSource"("borrowerId");

-- CreateIndex
CREATE INDEX "AssetAccount_borrowerId_idx" ON "AssetAccount"("borrowerId");

-- CreateIndex
CREATE INDEX "Liability_borrowerId_idx" ON "Liability"("borrowerId");

-- CreateIndex
CREATE INDEX "MortgageGiftGrant_applicationId_idx" ON "MortgageGiftGrant"("applicationId");

-- CreateIndex
CREATE INDEX "MortgageOtherAsset_applicationId_idx" ON "MortgageOtherAsset"("applicationId");

-- CreateIndex
CREATE INDEX "MortgageReo_applicationId_idx" ON "MortgageReo"("applicationId");

-- CreateIndex
CREATE INDEX "MortgageCreditItem_borrowerId_kind_idx" ON "MortgageCreditItem"("borrowerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Declaration_borrowerId_key" ON "Declaration"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyGoal_applicationId_key" ON "PropertyGoal"("applicationId");

-- CreateIndex
CREATE INDEX "MortgageDocumentFile_applicationId_package_idx" ON "MortgageDocumentFile"("applicationId", "package");

-- CreateIndex
CREATE INDEX "AiReview_applicationId_createdAt_idx" ON "AiReview"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReadinessScore_applicationId_createdAt_idx" ON "ReadinessScore"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineEvent_applicationId_createdAt_idx" ON "PipelineEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "MortgageAuditEvent_applicationId_createdAt_idx" ON "MortgageAuditEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "MortgageAuditEvent_action_idx" ON "MortgageAuditEvent"("action");

-- CreateIndex
CREATE INDEX "MortgageStaffAssignment_assignmentType_applicationId_idx" ON "MortgageStaffAssignment"("assignmentType", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "MortgageStaffAssignment_applicationId_staffId_assignmentType_key" ON "MortgageStaffAssignment"("applicationId", "staffId", "assignmentType");

-- CreateIndex
CREATE INDEX "MortgageApplicationNote_applicationId_createdAt_idx" ON "MortgageApplicationNote"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanFile_applicationId_key" ON "LoanFile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanFile_loanNumber_key" ON "LoanFile"("loanNumber");

-- CreateIndex
CREATE INDEX "LoanFile_originationStage_idx" ON "LoanFile"("originationStage");

-- CreateIndex
CREATE INDEX "LoanFile_loanNumber_idx" ON "LoanFile"("loanNumber");

-- CreateIndex
CREATE INDEX "LoanFile_nmlsConfigId_idx" ON "LoanFile"("nmlsConfigId");

-- CreateIndex
CREATE INDEX "LoanStageEvent_applicationId_createdAt_idx" ON "LoanStageEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanStageEvent_toStage_idx" ON "LoanStageEvent"("toStage");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionCatalogItem_code_key" ON "ConditionCatalogItem"("code");

-- CreateIndex
CREATE INDEX "LoanCondition_applicationId_status_idx" ON "LoanCondition"("applicationId", "status");

-- CreateIndex
CREATE INDEX "LoanCondition_applicationId_timing_idx" ON "LoanCondition"("applicationId", "timing");

-- CreateIndex
CREATE INDEX "LoanCondition_borrowerOwned_status_idx" ON "LoanCondition"("borrowerOwned", "status");

-- CreateIndex
CREATE INDEX "BorrowerActionPlan_applicationId_idx" ON "BorrowerActionPlan"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionPlanItem_planId_conditionId_key" ON "ActionPlanItem"("planId", "conditionId");

-- CreateIndex
CREATE INDEX "QualificationSnapshot_applicationId_computedAt_idx" ON "QualificationSnapshot"("applicationId", "computedAt");

-- CreateIndex
CREATE INDEX "UnderwritingDecision_applicationId_createdAt_idx" ON "UnderwritingDecision"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AppraisalOrder_applicationId_status_idx" ON "AppraisalOrder"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ProcessingChecklistItem_applicationId_done_idx" ON "ProcessingChecklistItem"("applicationId", "done");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingChecklistItem_applicationId_code_key" ON "ProcessingChecklistItem"("applicationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GrantsReadinessTrack_applicationId_key" ON "GrantsReadinessTrack"("applicationId");

-- CreateIndex
CREATE INDEX "LosAutomationEvent_type_createdAt_idx" ON "LosAutomationEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "LosAutomationEvent_applicationId_createdAt_idx" ON "LosAutomationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationSectionState_applicationId_status_idx" ON "ApplicationSectionState"("applicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSectionState_applicationId_borrowerKey_section_key" ON "ApplicationSectionState"("applicationId", "borrowerKey", "section");

-- CreateIndex
CREATE INDEX "BorrowerAddressHistory_borrowerId_endOn_idx" ON "BorrowerAddressHistory"("borrowerId", "endOn");
