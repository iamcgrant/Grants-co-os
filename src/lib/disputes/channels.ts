export type DisputeChannel =
  | "DISPUTEFOX"
  | "EXPERIAN"
  | "EQUIFAX"
  | "TRANSUNION"
  | "INNOVIS"
  | "SMARTCREDIT"
  | "CFPB";

export type DisputeCaseStatus = "INTAKE" | "PACKET" | "READY" | "SUBMITTED" | "RESULTS" | "CLOSED";

export type ChannelCatalog = {
  channel: DisputeChannel;
  label: string;
  href: string;
  eyebrow: string;
  /** True only when a documented public submit/read API exists for this product. */
  hasOfficialSubmitApi: boolean;
  hasOfficialPortal: boolean;
  /** Official consumer/staff portal — last submit step only, never the product UI. */
  officialSubmitUrl: string | null;
  canSubmitInApp: boolean;
  scrape: false;
  eOscarAvailable: false;
  honesty: string;
  checklist: Array<{ key: string; label: string; required: boolean }>;
};

export const DISPUTE_CASE_STATUSES: DisputeCaseStatus[] = [
  "INTAKE",
  "PACKET",
  "READY",
  "SUBMITTED",
  "RESULTS",
  "CLOSED",
];

const SHARED_PACKET_CHECKS: ChannelCatalog["checklist"] = [
  { key: "identity", label: "Client identity packet reviewed", required: true },
  { key: "authorization", label: "Written authorization on file", required: true },
  { key: "items", label: "At least one item listed in this case", required: true },
  { key: "narrative", label: "Staff narrative / packet notes complete", required: true },
];

export const DISPUTE_CHANNELS: Record<DisputeChannel, ChannelCatalog> = {
  DISPUTEFOX: {
    channel: "DISPUTEFOX",
    label: "DisputeFox",
    href: "/credit/disputefox",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://app.disputefox.com/",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "Supported DisputeFox API is Zapier inbound/write only. Live list/get stays off. Zap 374413762 stays OFF. This workspace is the OS case file for attached clients, items, and round status. EBD/letter send is recorded here after staff complete it — Grants OS does not write DisputeFox records.",
    checklist: [
      { key: "attached", label: "Client attached in Grants OS (no invented DF id)", required: true },
      { key: "items", label: "Dispute items listed", required: true },
      { key: "round", label: "Round packet notes complete", required: true },
      { key: "authorization", label: "Authorization on file", required: true },
    ],
  },
  EXPERIAN: {
    channel: "EXPERIAN",
    label: "Experian",
    href: "/credit/experian",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.experian.com/disputes/main.html",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "No Experian credit-repair submit API. e-OSCAR is a furnisher system, not available here. Build the packet in OS. Official Experian Online Dispute Center is the final submit step only.",
    checklist: [
      ...SHARED_PACKET_CHECKS,
      { key: "section", label: "Report section / item identified", required: true },
    ],
  },
  EQUIFAX: {
    channel: "EQUIFAX",
    label: "Equifax",
    href: "/credit/equifax",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.equifax.com/personal/credit-report-services/credit-dispute",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "No Equifax credit-repair submit API. Official path is the consumer myEquifax dispute center (client-owned login). e-OSCAR is furnisher-only. This OS case tracks packet, checklist, and outcome.",
    checklist: [
      ...SHARED_PACKET_CHECKS,
      { key: "section", label: "Equifax item identified", required: true },
    ],
  },
  TRANSUNION: {
    channel: "TRANSUNION",
    label: "TransUnion",
    href: "/credit/transunion",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.transunion.com/credit-disputes/dispute-your-credit",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "No TransUnion credit-repair submit API. Official path is the TransUnion Service Center (client-owned login). e-OSCAR is furnisher-only. Packet and results live in this OS case.",
    checklist: [
      ...SHARED_PACKET_CHECKS,
      { key: "section", label: "TransUnion item identified", required: true },
    ],
  },
  INNOVIS: {
    channel: "INNOVIS",
    label: "Innovis",
    href: "/credit/innovis",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.innovis.com/personal/disputeResolution",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "Innovis has an official consumer dispute-resolution channel. There is no public Innovis submit API. Build the case here; official portal is the last submit step only.",
    checklist: [
      ...SHARED_PACKET_CHECKS,
      { key: "section", label: "Innovis item identified", required: true },
    ],
  },
  SMARTCREDIT: {
    channel: "SMARTCREDIT",
    label: "SmartCredit",
    href: "/credit/smartcredit",
    eyebrow: "Credit & Disputes",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.smartcredit.com/",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "No public SmartCredit score or client-list API. Sponsor URL is affiliate attribution only — never CONNECTED on key presence. This workspace is the OS case file: attach the Grants client, record launch/session, packet, status, and results. Official SmartCredit portal is the last enrollment/login step only.",
    checklist: [
      { key: "attached", label: "Client attached in Grants OS (no invented SmartCredit id)", required: true },
      { key: "enrollment", label: "Enrollment recorded or existing member attached", required: true },
      { key: "items", label: "Monitoring items / accounts listed", required: true },
      { key: "authorization", label: "Authorization on file", required: true },
      { key: "narrative", label: "Session / packet notes complete", required: true },
    ],
  },
  CFPB: {
    channel: "CFPB",
    label: "CFPB",
    href: "/escalations/cfpb",
    eyebrow: "Escalations",
    hasOfficialSubmitApi: false,
    hasOfficialPortal: true,
    officialSubmitUrl: "https://www.consumerfinance.gov/complaint/",
    canSubmitInApp: false,
    scrape: false,
    eOscarAvailable: false,
    honesty:
      "No CFPB complaint-filing API. The public complaint database API is read-only published data and is not used here. Draft the escalation in OS. Official CFPB complaint portal is the final submit step only.",
    checklist: [
      { key: "prior", label: "Prior bureau or furnisher attempt noted", required: true },
      { key: "narrative", label: "What happened + desired resolution drafted", required: true },
      { key: "authorization", label: "Client authorization to escalate", required: true },
      { key: "docs", label: "Supporting documents listed in packet notes", required: true },
    ],
  },
};

export function isDisputeChannel(value: string): value is DisputeChannel {
  return Object.prototype.hasOwnProperty.call(DISPUTE_CHANNELS, value);
}

export function channelCatalog(channel: DisputeChannel): ChannelCatalog {
  return DISPUTE_CHANNELS[channel];
}

export function nextDisputeStatus(status: DisputeCaseStatus): DisputeCaseStatus | null {
  switch (status) {
    case "INTAKE":
      return "PACKET";
    case "PACKET":
      return "READY";
    case "READY":
      return "SUBMITTED";
    case "SUBMITTED":
      return "RESULTS";
    case "RESULTS":
      return "CLOSED";
    case "CLOSED":
      return null;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function statusLabel(status: DisputeCaseStatus): string {
  switch (status) {
    case "INTAKE":
      return "Intake";
    case "PACKET":
      return "Packet";
    case "READY":
      return "Ready to submit";
    case "SUBMITTED":
      return "Submitted";
    case "RESULTS":
      return "Results";
    case "CLOSED":
      return "Closed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
