/**
 * SmartCredit sponsored enrollment — preserve Grants & Co affiliate attribution.
 *
 * Configure via env (never hard-code secrets or personal login passwords):
 * - SMARTCREDIT_SPONSOR_URL  → your personal/partner signup link
 * - SMARTCREDIT_SPONSOR_CODE → sponsor/partner code if separate from the URL
 *
 * Example URL shape (yours may differ):
 *   https://www.smartcredit.com/join/?pid=YOUR_PID
 *
 * Important: never strip or overwrite `pid` / affiliate params — that is the payout attribution.

export function getSmartCreditSponsorConfig() {
  const sponsorUrl = process.env.SMARTCREDIT_SPONSOR_URL?.trim() || null;
  const sponsorCode = process.env.SMARTCREDIT_SPONSOR_CODE?.trim() || null;
  return { sponsorUrl, sponsorCode };
}

/**
 * Build the client enrollment URL while preserving sponsor attribution.
 * Appends Grants Client ID as a tracking ref when the URL allows query params.
 */
export function buildSponsoredEnrollmentUrl(input: {
  grantsClientId: string;
  sponsorUrl?: string | null;
  sponsorCode?: string | null;
}): string | null {
  const { sponsorUrl, sponsorCode } = {
    sponsorUrl: input.sponsorUrl ?? process.env.SMARTCREDIT_SPONSOR_URL,
    sponsorCode: input.sponsorCode ?? process.env.SMARTCREDIT_SPONSOR_CODE,
  };

  if (!sponsorUrl && !sponsorCode) return null;

  if (sponsorUrl) {
    try {
      const url = new URL(sponsorUrl);
      url.searchParams.set("gc_ref", input.grantsClientId);
      if (sponsorCode && !url.searchParams.has("aff") && !url.searchParams.has("sponsor")) {
        url.searchParams.set("sponsor", sponsorCode);
      }
      return url.toString();
    } catch {
      // If not a full URL, treat as opaque string and append ref cautiously
      const join = sponsorUrl.includes("?") ? "&" : "?";
      return `${sponsorUrl}${join}gc_ref=${encodeURIComponent(input.grantsClientId)}`;
    }
  }

  // Code-only fallback — placeholder path until full sponsor URL is provided
  return `https://www.smartcredit.com/?sponsor=${encodeURIComponent(sponsorCode!)}&gc_ref=${encodeURIComponent(input.grantsClientId)}`;
}
