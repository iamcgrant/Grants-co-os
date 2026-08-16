/**
 * Charles-confirmed DisputeFox recon for the same 26 Grants master clients.
 *
 * Identity email is the GHL/Grants email. Kimberly's DisputeFox inbox is an
 * alt on the same human — not a second record.
 *
 * Do not invent DisputeFox numeric IDs. Stage + started only.
 */

import { CONFIRMED_MASTERS } from "@/lib/clients/confirmed-masters";
import { normalizeEmail } from "@/lib/clients/identity";

export const CONFIRMED_DF_RECON_TAG = "DisputeFox recon 2026-08-15";

export type DfPhase = "SENT" | "READY";

export type ConfirmedDfRow = {
  firstName: string;
  lastName: string;
  /** Grants / GHL identity email — match onto the existing master record. */
  email: string;
  /** Other inboxes for the same human (never a second client). */
  altEmails?: string[];
  dfStageLabel: string;
  started: true;
};

export const CONFIRMED_DF_ROSTER: ConfirmedDfRow[] = [
  {
    firstName: "Christian",
    lastName: "Owens",
    email: "prettystrongyeg@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Sean",
    lastName: "Dalpathado",
    email: "francisrosehome@outlook.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Novalle",
    lastName: "Cruz",
    email: "novalle2104@gmail.com",
    dfStageLabel: "Round 2 Ready",
    started: true,
  },
  {
    firstName: "Ankanette",
    lastName: "Webb",
    email: "nettelawton12@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Elijah",
    lastName: "Dunham",
    email: "dunhamelijah@gmail.com",
    dfStageLabel: "Round 3 Ready",
    started: true,
  },
  {
    firstName: "Antionette",
    lastName: "Greene",
    email: "gogreenetaxes@gmail.com",
    dfStageLabel: "Round 3 Sent",
    started: true,
  },
  {
    firstName: "Dequentin",
    lastName: "Madison",
    email: "fw36114@gmail.com",
    dfStageLabel: "Round 3 Sent",
    started: true,
  },
  {
    firstName: "Gwendolyn",
    lastName: "Allen",
    email: "gwendolynallen93@yahoo.com",
    dfStageLabel: "Round 2 Sent",
    started: true,
  },
  {
    firstName: "Kimberly",
    lastName: "Britt",
    email: "kskymommy09@icloud.com",
    altEmails: ["KimberlyBr490@gmail.com"],
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Nubia",
    lastName: "Grant",
    email: "nubiapgrant23@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Yewande",
    lastName: "Rhodan",
    email: "abi23gail@yahoo.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Nicole",
    lastName: "Pierre",
    email: "nicolepierre29@yahoo.com",
    dfStageLabel: "Round 2 Sent",
    started: true,
  },
  {
    firstName: "Shameeka",
    lastName: "Bentley",
    email: "meekabently@gmail.com",
    dfStageLabel: "Round 2 Sent",
    started: true,
  },
  {
    firstName: "Shanikqua",
    lastName: "Barnett",
    email: "shanikqua.barnett@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Shekevia",
    lastName: "Washington",
    email: "shekevia29@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Tamekia",
    lastName: "Rivers",
    email: "joshquin1305@gmail.com",
    dfStageLabel: "Round 2 Ready",
    started: true,
  },
  {
    firstName: "Tayla",
    lastName: "Bullock",
    email: "brice.tayla@yahoo.com",
    dfStageLabel: "Round 2 Sent",
    started: true,
  },
  {
    firstName: "Tymecia",
    lastName: "Smalls",
    email: "tymeciasmalls81@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Adonis",
    lastName: "Martin",
    email: "adoniszmartin@yahoo.com",
    dfStageLabel: "Round 2 Sent",
    started: true,
  },
  {
    firstName: "Cierra",
    lastName: "Walker",
    email: "walkerc31590@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Claretha",
    lastName: "Brown",
    email: "kayannahjade@gmail.com",
    dfStageLabel: "Round 3 Ready",
    started: true,
  },
  {
    firstName: "Dyquann",
    lastName: "Mcbride",
    email: "dyquannmcbride39@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "ISIS",
    lastName: "Grant",
    email: "isis.grant@outlook.com",
    dfStageLabel: "Round 3 Ready",
    started: true,
  },
  {
    firstName: "Katia",
    lastName: "Usher",
    email: "katiausher@gmail.com",
    dfStageLabel: "Round 2 Ready",
    started: true,
  },
  {
    firstName: "Laremy",
    lastName: "Trimble",
    email: "laremyy1@gmail.com",
    dfStageLabel: "Round 1 Sent",
    started: true,
  },
  {
    firstName: "Luis",
    lastName: "Salas",
    email: "luis200127@gmail.com",
    dfStageLabel: "Round 3 Ready",
    started: true,
  },
];

export type ParsedDfStage = {
  roundNumber: number;
  phase: DfPhase;
  /** Existing Client.stage vocabulary — do not invent a second client table. */
  clientStage: string;
  nextAction: string;
  nextActionOwner: "JONA";
  disputeRoundStatus: DfPhase;
};

export function parseDfStageLabel(label: string): ParsedDfStage | null {
  const match = label.trim().match(/^round\s+(\d+)\s+(sent|ready)$/i);
  if (!match) return null;
  const roundNumber = Number(match[1]);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) return null;
  const phase: DfPhase = match[2].toLowerCase() === "sent" ? "SENT" : "READY";
  const clientStage =
    phase === "SENT" ? "ROUND_SUBMITTED" : roundNumber <= 1 ? "READY_FOR_PROCESSING" : "NEXT_ROUND";
  return {
    roundNumber,
    phase,
    clientStage,
    nextAction: phase === "SENT" ? `Await Round ${roundNumber} results` : `Send Round ${roundNumber}`,
    nextActionOwner: "JONA",
    disputeRoundStatus: phase,
  };
}

export function rosterEmailsFor(row: ConfirmedDfRow): string[] {
  return [row.email, ...(row.altEmails || [])].map((e) => normalizeEmail(e));
}

/** Map any known inbox (identity or alt) to the Grants identity email. */
export function resolveConfirmedIdentityEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const normalized = normalizeEmail(email);
  const row = CONFIRMED_DF_ROSTER.find((r) => rosterEmailsFor(r).includes(normalized));
  return row ? normalizeEmail(row.email) : normalized;
}

export function findConfirmedDfRowByEmail(email: string | null | undefined): ConfirmedDfRow | null {
  if (!email?.trim()) return null;
  const normalized = normalizeEmail(email);
  return CONFIRMED_DF_ROSTER.find((r) => rosterEmailsFor(r).includes(normalized)) ?? null;
}

/** The 26 identity emails must stay 1:1 with the Charles-confirmed master roster. */
export function confirmedMasterEmails(): string[] {
  return CONFIRMED_MASTERS.map((r) => normalizeEmail(r.email));
}
