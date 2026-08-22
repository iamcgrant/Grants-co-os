import { prisma } from "@/lib/db/prisma";
import { listSmartCreditBoard } from "@/lib/credit/smartcredit-workspace";
import { probeSmartCreditHealth, type SmartCreditHealthResult } from "@/lib/credit/smartcredit-health";
import { probeDisputeFoxApi, type DisputeFoxProbeResult } from "@/lib/integrations/disputefox/probe";
import { listCasesForChannel, listDisputeFoxBoard } from "@/lib/disputes/cases";
import type { DisputeChannel } from "@/lib/disputes/channels";
import { withTimeout } from "@/lib/disputes/with-timeout";

const DISPUTEFOX_QUERY_MS = 2500;
const DISPUTEFOX_DESK_MS = 3500;

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

export type DisputeFoxDeskData = {
  board: Awaited<ReturnType<typeof listDisputeFoxBoard>>;
  probe: DisputeFoxProbeResult;
  clients: DeskClientOption[];
  unavailable: boolean;
  loadError: string | null;
};

function emptyDisputeFoxProbe(detail = DESK_UNAVAILABLE): DisputeFoxProbeResult {
  return {
    status: "OFFLINE",
    detail,
    lastSuccessAt: null,
    probed: false,
  };
}

export function emptyDisputeFoxDesk(loadError: string | null = DESK_UNAVAILABLE): DisputeFoxDeskData {
  return {
    board: [],
    probe: emptyDisputeFoxProbe(),
    clients: [],
    unavailable: true,
    loadError,
  };
}

function asDeskClients(rows: DeskClientOption[]): DeskClientOption[] {
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    grantsClientId: String(row.grantsClientId ?? ""),
    firstName: String(row.firstName ?? ""),
    lastName: String(row.lastName ?? ""),
  }));
}

/** Prisma rows / Dates / class instances must never reach a Client Component. */
function asDisputeFoxBoard(rows: Awaited<ReturnType<typeof listDisputeFoxBoard>>) {
  try {
    return JSON.parse(JSON.stringify(rows)) as typeof rows;
  } catch (error) {
    logDeskFailure("DISPUTEFOX:board-serialize", error);
    return [] as Awaited<ReturnType<typeof listDisputeFoxBoard>>;
  }
}

/**
 * Cold DisputeFox isolates must not Promise.all two Prisma queries or wait on a
 * hung probe. Sequential + budgeted. Empty desk beats a first-load 500.
 */
export async function loadDisputeFoxDeskSafe(): Promise<DisputeFoxDeskData> {
  return withTimeout(loadDisputeFoxDeskInner(), DISPUTEFOX_DESK_MS, () => {
    logDeskFailure("DISPUTEFOX", new Error(`desk budget ${DISPUTEFOX_DESK_MS}ms exceeded`));
    return emptyDisputeFoxDesk();
  });
}

async function loadDisputeFoxDeskInner(): Promise<DisputeFoxDeskData> {
  const probe = await probeDisputeFoxApi().catch((error) => {
    logDeskFailure("DISPUTEFOX:probe", error);
    return emptyDisputeFoxProbe();
  });

  let boardFailed = false;
  let board: Awaited<ReturnType<typeof listDisputeFoxBoard>> = [];
  try {
    const loaded = await withTimeout(
      listDisputeFoxBoard(),
      DISPUTEFOX_QUERY_MS,
      () => {
        boardFailed = true;
        return null;
      },
    );
    if (loaded === null) {
      boardFailed = true;
    } else {
      board = asDisputeFoxBoard(loaded);
      if (loaded.length > 0 && board.length === 0) {
        boardFailed = true;
      }
    }
  } catch (error) {
    logDeskFailure("DISPUTEFOX", error);
    boardFailed = true;
  }

  // Skip a second Prisma trip when the board already blew the budget.
  const clients = boardFailed
    ? []
    : asDeskClients(
        await withTimeout(loadClientOptions("DISPUTEFOX"), DISPUTEFOX_QUERY_MS, () => []),
      );
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
