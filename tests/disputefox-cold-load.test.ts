import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "../src/generated/prisma/enums";
import { resolveAsyncServerTree } from "./helpers/rsc-client-props";

const listDisputeFoxBoard = vi.fn(async () => []);
const findManyClients = vi.fn(async () => []);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findMany: (...args: unknown[]) => findManyClients(...args),
    },
  },
}));

vi.mock("@/lib/disputes/cases", () => ({
  listDisputeFoxBoard: (...args: unknown[]) => listDisputeFoxBoard(...args),
  listCasesForChannel: async () => [],
}));

vi.mock("@/lib/integrations/disputefox/probe", () => ({
  probeDisputeFoxApi: async () => ({
    status: "DEGRADED",
    detail: "API key present. No supported read probe URL (DISPUTEFOX_API_PROBE_URL).",
    lastSuccessAt: null,
    probed: false,
  }),
}));

vi.mock("@/lib/disputes/access", () => ({
  requireCreditStaff: async () => ({
    user: {
      id: "owner-1",
      email: "owner@grantsandco.com",
      firstName: "Charles",
      lastName: "Grant",
      role: Role.OWNER,
      isActive: true,
      mfaEnabled: false,
    },
    denied: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) =>
    createElement("a", { href }, children as never),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/credit/disputefox",
}));

describe("DisputeFox first-load / cold isolate", () => {
  beforeEach(() => {
    listDisputeFoxBoard.mockReset().mockResolvedValue([]);
    findManyClients.mockReset().mockResolvedValue([]);
  });

  it("does not Promise.all the Prisma board and client queries", async () => {
    const src = fs.readFileSync("src/lib/disputes/desk-load.ts", "utf8");
    expect(src).toMatch(/Cold DisputeFox isolates/);
    const inner = src.slice(
      src.indexOf("async function loadDisputeFoxDeskInner"),
      src.indexOf("export async function loadSmartCreditDeskSafe"),
    );
    expect(inner).toMatch(/listDisputeFoxBoard/);
    expect(inner).toMatch(/loadClientOptions/);
    expect(inner).not.toMatch(/Promise\.all/);
  });

  it("returns an empty desk when the board query never resolves", async () => {
    listDisputeFoxBoard.mockImplementation(() => new Promise(() => {}));
    const { loadDisputeFoxDeskSafe } = await import("../src/lib/disputes/desk-load");
    const started = Date.now();
    const desk = await loadDisputeFoxDeskSafe();
    expect(Date.now() - started).toBeLessThan(4500);
    expect(desk.board).toEqual([]);
    expect(desk.unavailable).toBe(true);
    expect(desk.loadError).toMatch(/could not load/);
    expect(desk.probe.status).toBe("DEGRADED");
  });

  it("returns an empty desk when board and client queries both hang", async () => {
    listDisputeFoxBoard.mockImplementation(() => new Promise(() => {}));
    findManyClients.mockImplementation(() => new Promise(() => {}));
    const { loadDisputeFoxDeskSafe } = await import("../src/lib/disputes/desk-load");
    const started = Date.now();
    const desk = await loadDisputeFoxDeskSafe();
    expect(Date.now() - started).toBeLessThan(5000);
    expect(desk.board).toEqual([]);
    expect(desk.clients).toEqual([]);
    expect(desk.unavailable).toBe(true);
    expect(findManyClients).not.toHaveBeenCalled();
  });

  it("drops a board that cannot JSON-serialize instead of crashing", async () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    listDisputeFoxBoard.mockResolvedValue([cycle] as never);
    const { loadDisputeFoxDeskSafe } = await import("../src/lib/disputes/desk-load");
    const desk = await loadDisputeFoxDeskSafe();
    expect(desk.board).toEqual([]);
    expect(desk.unavailable).toBe(true);
    expect(desk.loadError).toMatch(/could not load/);
  });

  it("sends a first-byte empty desk without waiting on the board", async () => {
    listDisputeFoxBoard.mockImplementation(() => new Promise(() => {}));
    const Page = (await import("../src/app/(staff)/credit/disputefox/page")).default;
    const started = Date.now();
    const tree = await Page();
    expect(Date.now() - started).toBeLessThan(1500);
    const html = renderToStaticMarkup(createElement("div", null, tree));
    expect(html).toMatch(/DisputeFox/);
    expect(html).toMatch(/Honest empty desk/);
    expect(html).toMatch(/Open login/);
    expect(html).not.toMatch(/This page couldn't load|A server error occurred/i);
  });

  it("renders /credit/disputefox without throwing when the board hangs", async () => {
    listDisputeFoxBoard.mockImplementation(() => new Promise(() => {}));
    const Page = (await import("../src/app/(staff)/credit/disputefox/page")).default;
    const started = Date.now();
    const tree = await resolveAsyncServerTree(await Page());
    expect(Date.now() - started).toBeLessThan(5000);
    const html = renderToStaticMarkup(createElement("div", null, tree));
    expect(html).toMatch(/DisputeFox/);
    expect(html).toMatch(/Honest empty desk/);
    expect(html).toMatch(/Open login/);
    expect(html).toMatch(/DEGRADED|OFFLINE|could not load/);
    expect(html).not.toMatch(/This page couldn't load|A server error occurred/i);
  });

  it("does not await the board in the default page export", () => {
    const src = fs.readFileSync("src/app/(staff)/credit/disputefox/page.tsx", "utf8");
    expect(src).toMatch(/Suspense/);
    expect(src).toMatch(/emptyDisputeFoxDesk/);
    expect(src).toMatch(/maxDuration/);
    const defaultFn = src.slice(src.indexOf("export default async function"));
    expect(defaultFn).not.toMatch(/await loadDisputeFoxDeskSafe/);
  });
});
