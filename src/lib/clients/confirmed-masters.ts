/**
 * Charles-confirmed active Grants master clients (recon 2026-08-15).
 *
 * ONE HUMAN = ONE RECORD. Identity email is the GHL email.
 * Do not invent GHL ids. Do not create GHL contacts. Do not send messages.
 *
 * Excluded by Charles: Taylor Carroll, April Allen.
 * Charles Grant (charlesjgrant@aol.com) has no GHL row — not in this roster.
 */

export const CONFIRMED_MASTER_TAG =
  "Charles-confirmed active / source recon 2026-08-15";

export type ConfirmedMasterRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Extra note text stored on Client.notes (existing field only). */
  extraNotes?: string;
};

export const CONFIRMED_MASTERS: ConfirmedMasterRow[] = [
  {
    firstName: "Christian",
    lastName: "Owens",
    email: "prettystrongyeg@gmail.com",
    phone: "(864) 813-2525",
  },
  {
    firstName: "Sean",
    lastName: "Dalpathado",
    email: "francisrosehome@outlook.com",
    phone: "(310) 854-2185",
  },
  { firstName: "Novalle", lastName: "Cruz", email: "novalle2104@gmail.com" },
  { firstName: "Ankanette", lastName: "Webb", email: "nettelawton12@gmail.com" },
  { firstName: "Elijah", lastName: "Dunham", email: "dunhamelijah@gmail.com" },
  {
    firstName: "Antionette",
    lastName: "Greene",
    email: "gogreenetaxes@gmail.com",
    phone: "(678) 918-1043",
  },
  {
    firstName: "Dequentin",
    lastName: "Madison",
    email: "fw36114@gmail.com",
    phone: "(404) 805-2095",
  },
  {
    firstName: "Gwendolyn",
    lastName: "Allen",
    email: "gwendolynallen93@yahoo.com",
    phone: "(404) 933-8230",
  },
  {
    firstName: "Kimberly",
    lastName: "Britt",
    email: "kskymommy09@icloud.com",
    extraNotes:
      "Alt identifier (DisputeFox email, not a second client): KimberlyBr490@gmail.com",
  },
  {
    firstName: "Nubia",
    lastName: "Grant",
    email: "nubiapgrant23@gmail.com",
    phone: "(912) 703-4564",
  },
  {
    firstName: "Yewande",
    lastName: "Rhodan",
    email: "abi23gail@yahoo.com",
    phone: "(843) 226-0468",
  },
  {
    firstName: "Nicole",
    lastName: "Pierre",
    email: "nicolepierre29@yahoo.com",
    phone: "(480) 806-7633",
  },
  {
    firstName: "Shameeka",
    lastName: "Bentley",
    email: "meekabently@gmail.com",
    phone: "(843) 783-6998",
  },
  {
    firstName: "Shanikqua",
    lastName: "Barnett",
    email: "shanikqua.barnett@gmail.com",
  },
  {
    firstName: "Shekevia",
    lastName: "Washington",
    email: "shekevia29@gmail.com",
  },
  {
    firstName: "Tamekia",
    lastName: "Rivers",
    email: "joshquin1305@gmail.com",
    phone: "(843) 597-3736",
  },
  { firstName: "Tayla", lastName: "Bullock", email: "brice.tayla@yahoo.com" },
  {
    firstName: "Tymecia",
    lastName: "Smalls",
    email: "tymeciasmalls81@gmail.com",
    phone: "(912) 228-9877",
  },
  {
    firstName: "Adonis",
    lastName: "Martin",
    email: "adoniszmartin@yahoo.com",
    phone: "(678) 612-3100",
  },
  {
    firstName: "Cierra",
    lastName: "Walker",
    email: "walkerc31590@gmail.com",
    phone: "(470) 261-0802",
  },
  { firstName: "Claretha", lastName: "Brown", email: "kayannahjade@gmail.com" },
  {
    firstName: "Dyquann",
    lastName: "Mcbride",
    email: "dyquannmcbride39@gmail.com",
    phone: "(912) 856-6083",
  },
  { firstName: "ISIS", lastName: "Grant", email: "isis.grant@outlook.com" },
  {
    firstName: "Katia",
    lastName: "Usher",
    email: "katiausher@gmail.com",
    phone: "(678) 362-4568",
  },
  {
    firstName: "Laremy",
    lastName: "Trimble",
    email: "laremyy1@gmail.com",
    phone: "(404) 786-2022",
  },
  { firstName: "Luis", lastName: "Salas", email: "luis200127@gmail.com" },
];

/** Emails that must never become a second (or first) master record from this import. */
export const FORBIDDEN_IMPORT_EMAILS = [
  "charlesjgrant@aol.com",
  "kandwmcbride@gmail.com",
  "kimberlybr490@gmail.com",
] as const;

export function buildConfirmedMasterNotes(row: ConfirmedMasterRow): string {
  return [CONFIRMED_MASTER_TAG, row.extraNotes].filter(Boolean).join("\n");
}
