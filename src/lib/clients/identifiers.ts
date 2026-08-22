/**
 * Provider identifiers on one Grants master client.
 *
 * ONE HUMAN = ONE MASTER CLIENT. These values are identifiers on that master,
 * never separate clients. Existing inbound GHL / DisputeFox paths already
 * persist GHL and DISPUTEFOX on ClientIdentifier — CRC recovery attaches
 * CREDIT_REPAIR_CLOUD and SMARTCREDIT the same way.
 */

export const CLIENT_IDENTIFIER_PROVIDER = {
  GHL: "GHL",
  DISPUTEFOX: "DISPUTEFOX",
  CREDIT_REPAIR_CLOUD: "CREDIT_REPAIR_CLOUD",
  SMARTCREDIT: "SMARTCREDIT",
  CLOUD_TAX_OFFICE: "CLOUD_TAX_OFFICE",
  COGNITO: "COGNITO",
  SBTPG: "SBTPG",
  PAYMENT: "PAYMENT",
  COMMAS: "COMMAS",
} as const;

export type ClientIdentifierProvider =
  (typeof CLIENT_IDENTIFIER_PROVIDER)[keyof typeof CLIENT_IDENTIFIER_PROVIDER];

/** Permanent internal identity — stored on Client.grantsClientId, not ClientIdentifier. */
export const GRANTS_CLIENT_ID_FIELD = "grantsClientId";

export type MasterIdentityIds = {
  grantsClientId?: string | null;
  ghlContactId?: string | null;
  disputeFoxClientId?: string | null;
  crcClientId?: string | null;
  smartCreditId?: string | null;
  cloudTaxOfficeId?: string | null;
  cognitoEntryId?: string | null;
  sbtpgId?: string | null;
};

export function collectProviderIds(ids: MasterIdentityIds): {
  provider: ClientIdentifierProvider | "GRANTS";
  externalId: string;
}[] {
  const out: { provider: ClientIdentifierProvider | "GRANTS"; externalId: string }[] = [];
  const push = (provider: ClientIdentifierProvider | "GRANTS", value?: string | null) => {
    const externalId = value?.trim();
    if (externalId) out.push({ provider, externalId });
  };
  push("GRANTS", ids.grantsClientId);
  push(CLIENT_IDENTIFIER_PROVIDER.GHL, ids.ghlContactId);
  push(CLIENT_IDENTIFIER_PROVIDER.DISPUTEFOX, ids.disputeFoxClientId);
  push(CLIENT_IDENTIFIER_PROVIDER.CREDIT_REPAIR_CLOUD, ids.crcClientId);
  push(CLIENT_IDENTIFIER_PROVIDER.SMARTCREDIT, ids.smartCreditId);
  push(CLIENT_IDENTIFIER_PROVIDER.CLOUD_TAX_OFFICE, ids.cloudTaxOfficeId);
  push(CLIENT_IDENTIFIER_PROVIDER.COGNITO, ids.cognitoEntryId);
  push(CLIENT_IDENTIFIER_PROVIDER.SBTPG, ids.sbtpgId);
  return out;
}
