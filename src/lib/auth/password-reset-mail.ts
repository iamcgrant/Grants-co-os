/**
 * Sends a password-reset link when Resend is configured.
 * Missing mail config is a failed delivery, not a successful send.
 */
export async function deliverPasswordResetEmail(input: {
  to: string;
  url: string;
  firstName?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  if (!apiKey || !from) return false;

  const name = input.firstName?.trim() || "there";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Reset your Grants & Co OS password",
      text: [
        `${name},`,
        "",
        "Choose a new password for Grants & Co OS. This link expires in 24 hours:",
        input.url,
        "",
        "If you did not ask for this, you can ignore this email. Your current password keeps working until you finish the reset.",
      ].join("\n"),
    }),
  });

  return response.ok;
}
