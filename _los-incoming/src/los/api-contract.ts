/**
 * Drop-in API shape matching grants-co-os paths.
 * Handlers live under drop-in/src/app/api/los/...
 */

export const LOS_ENDPOINTS = [
  { method: "POST", path: "/api/los/applications", action: "createApplication" },
  { method: "POST", path: "/api/los/applications/:id/compliance", action: "acknowledgeCompliance" },
  { method: "PATCH", path: "/api/los/applications/:id/sections/:section", action: "patchSection" },
  { method: "POST", path: "/api/los/applications/:id/submit", action: "submitApplication" },
  { method: "POST", path: "/api/los/applications/:id/qualification", action: "createQualificationSnapshot" },
  { method: "GET", path: "/api/los/applications/:id", action: "getApplication" },
] as const;

export type LosEndpoint = (typeof LOS_ENDPOINTS)[number];

export type CreateApplicationRequest = { clientId: string };

export type AcknowledgeComplianceRequest = {
  disclosures: Array<string | { type: string; acknowledged?: boolean }>;
  signature?: {
    typedFirst?: string;
    typedLast?: string;
    drawnSignatureKey?: string;
    dateSigned?: string;
  };
  ip?: string;
  userAgent?: string;
  dpaSelected?: boolean;
  agreementVersion?: string;
};

export type PatchSectionRequest = { body: unknown; borrowerRole?: "PRIMARY" | "CO_BORROWER" };
