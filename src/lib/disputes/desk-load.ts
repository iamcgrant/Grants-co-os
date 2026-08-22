import { prisma } from "@/lib/db/prisma";
import { listSmartCreditBoard } from "@/lib/credit/smartcredit-workspace";
import { probeSmartCreditHealth, type SmartCreditHealthResult } from "@/lib/credit/smartcredit-health";
import { probeDisputeFoxApi, type DisputeFoxProbeResult } from "@/lib/integrations/disputefox/probe";
import { listCasesForChannel, listDisputeFoxBoard } from "@/lib/disputes/cases";
import type { DisputeChannel } from "@/lib/disputes/channels";

const CLIENT_SELECT = {
  id: true,
  grantsClientId: true,
  firstName: true,
  lastName: true,
} as const;

export type DeskClientOption = {
  id: string;
  grantsClientId: string;
  firstName: string;
  lastName: string;
};

const DESK_UNAVAILABLE =
  "Desk data could not load. Official portal is last-step only — this desk does not scrape.";

function logDeskFailure(desk: string, error: unknown) {
  console.error(`[${desk}] desk load failed`, error);
}

async function loadClientOptions(desk: string): Promise<DeskClientOption[]> {
  try {
    return await prisma.client.findMany({
      orderBy: { lastName: "asc" },
      take: 200,
      select: CLIENT_SELECT,
    });
  } catch (error) {
    logDeskFailure(`${desk}:clients`, error);
    return [];
  }
}

/**
 * Cases / clients fail independently. A missing table or API outage must not 500 the page.
 * `unavailable` is true only when the case query itself failed.
 */
export async function loadChannelDeskSafe(channel: DisputeChannel) {
  let caseQueryFailed = false;
  const [cases, clients] = await Promise.all([
    listCasesForChannel(channel).catch((error) => {
      logDeskFailure(channel, error);
      caseQueryFailed = true;
      return [] as Awaited<ReturnType<typeof listCasesForChannel>>;
    }),
    loadClientOptions(channel),
  ]);
  return {
    cases,
    clients,
    unavailable: caseQueryFailed,
    loadError: caseQueryFailed ? DESK_UNAVAILABLE : null,
  };
}

export async function loadDisputeFoxDeskSafe() {
  let boardFailed = false;
  const emptyProbe: DisputeFoxProbeResult = {
    status: "OFFLINE",
    detail: DESK_UNAVAILABLE,
    lastSuccessAt: null,
    probed: false,
  };
  const [board, probe, clients] = await Promise.all([
    listDisputeFoxBoard().catch((error) => {
      logDeskFailure("DISPUTEFOX", error);
      boardFailed = true;
      return [] as Awaited<ReturnType<typeof listDisputeFoxBoard>>;
    }),
    probeDisputeFoxApi().catch((error) => {
      logDeskFailure("DISPUTEFOX:probe", error);
      return emptyProbe;
    }),
    loadClientOptions("DISPUTEFOX"),
  ]);
  return {
    board,
    probe,
    clients,
    unavailable: boardFailed,
    loadError: boardFailed ? DESK_UNAVAILABLE : null,
  };
}

export async function loadSmartCreditDeskSafe() {
  let boardFailed = false;
  const emptyProbe: SmartCreditHealthResult = {
    status: "OFFLINE",
    detail: DESK_UNAVAILABLE,
    lastSuccessAt: null,
    probed: false,
  };
  const [board, probe, clients] = await Promise.all([
    listSmartCreditBoard().catch((error) => {
      logDeskFailure("SMARTCREDIT", error);
      boardFailed = true;
      return [] as Awaited<ReturnType<typeof listSmartCreditBoard>>;
    }),
    probeSmartCreditHealth().catch((error) => {
      logDeskFailure("SMARTCREDIT:probe", error);
      return emptyProbe;
    }),
    loadClientOptions("SMARTCREDIT"),
  ]);
  return {
    board,
    probe,
    clients,
    unavailable: boardFailed,
    loadError: boardFailed ? DESK_UNAVAILABLE : null,
  };
}
