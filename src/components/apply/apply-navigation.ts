export const GRANT_CO_HOME_URL = "https://grantandconsultants.com/";

export type ApplyBackAction =
  | { type: "home"; href: typeof GRANT_CO_HOME_URL; label: "Back to Grant & Co" }
  | { type: "previous"; label: "Back" };

/** First step leaves the apply portal. Later steps move to the previous step. */
export function applyBackAction(stepIndex: number): ApplyBackAction {
  if (stepIndex <= 0) {
    return {
      type: "home",
      href: GRANT_CO_HOME_URL,
      label: "Back to Grant & Co",
    };
  }
  return { type: "previous", label: "Back" };
}
