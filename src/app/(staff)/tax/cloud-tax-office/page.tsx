import { GuardedPortalDesk } from "@/components/desk/GuardedPortalDesk";

export default async function CloudTaxOfficePage() {
  return GuardedPortalDesk({ deskId: "cloud-tax-office", gate: "tax" });
}
