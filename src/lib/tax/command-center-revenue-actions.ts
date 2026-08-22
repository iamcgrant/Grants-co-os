/**
 * Command Center revenue click targets.
 * Total Revenue stays in-OS. Update revenue is official last-step login only.
 * Never iframe pro.sbtpg.com. Never invent dollar amounts.
 */

import { TAX_DESK_CATALOG } from "@/lib/tax/catalog";
import { isLiveNavHref } from "@/lib/nav/official-logins";

export const COMMAND_CENTER_TOTAL_REVENUE_HREF = TAX_DESK_CATALOG.SBTPG.href;
export const COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL = TAX_DESK_CATALOG.SBTPG.officialLastStepUrl;
export const COMMAND_CENTER_PERSIST_AFTER_RETURN_HREF = TAX_DESK_CATALOG.SBTPG.href;
export const COMMAND_CENTER_UPDATE_REVENUE_LABEL = "Update revenue";

export type CommandCenterRevenueClickTargets = {
  totalRevenueHref: string;
  updateRevenueHref: string;
  persistAfterReturnHref: string;
  updateRevenueLabel: string;
};

export function commandCenterRevenueClickTargets(): CommandCenterRevenueClickTargets {
  return {
    totalRevenueHref: COMMAND_CENTER_TOTAL_REVENUE_HREF,
    updateRevenueHref: COMMAND_CENTER_UPDATE_REVENUE_LOGIN_URL,
    persistAfterReturnHref: COMMAND_CENTER_PERSIST_AFTER_RETURN_HREF,
    updateRevenueLabel: COMMAND_CENTER_UPDATE_REVENUE_LABEL,
  };
}

export function assertLiveRevenueClickTargets(targets = commandCenterRevenueClickTargets()) {
  if (!isLiveNavHref(targets.totalRevenueHref) || targets.totalRevenueHref === "#") {
    throw new Error("Total Revenue click target is dead");
  }
  if (!isLiveNavHref(targets.updateRevenueHref) || targets.updateRevenueHref === "#") {
    throw new Error("Update revenue click target is dead");
  }
  if (!isLiveNavHref(targets.persistAfterReturnHref) || targets.persistAfterReturnHref === "#") {
    throw new Error("Persist-after-return click target is dead");
  }
  if (targets.totalRevenueHref !== "/tax/sbtpg") {
    throw new Error("Total Revenue must open the in-OS desk");
  }
  if (targets.updateRevenueHref !== "https://pro.sbtpg.com/login") {
    throw new Error("Update revenue must open the official last-step login");
  }
  return true;
}
