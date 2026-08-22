import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "../src/generated/prisma/enums";
import { DISPUTE_CHANNELS, type DisputeChannel } from "../src/lib/disputes/channels";
import { assertNoFunctionPropsToClientComponents } from "./helpers/rsc-client-props";

const owner = {
  id: "owner-1",
  email: "owner@grantsandco.com",
  firstName: "Charles",
  lastName: "Grant",
  role: Role.OWNER,
  isActive: true,
  mfaEnabled: false,
};

const listCasesForChannel = vi.fn(async () => []);
const listDisputeFoxBoard = vi.fn(async () => []);
const listSmartCreditBoard = vi.fn(async () => []);
const findManyClients = vi.fn(async () => []);
const probeDisputeFoxApi = vi.fn(async () => ({
  status: "ACTION_REQUIRED" as const,
  detail: "probe skipped",
  lastSuccessAt: null,
  probed: false,
}));
const probeSmartCreditHealth = vi.fn(async () => ({
  status: "ACTION_REQUIRED" as const,
  detail: "probe skipped",
  lastSuccessAt: null,
  probed: false,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/lib/disputes/access", () => ({
  requireCreditStaff: async () => ({ user: owner, denied: false }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findMany: (...args: unknown[]) => findManyClients(...args),
    },
  },
}));

vi.mock("@/lib/disputes/cases", () => ({
  listCasesForChannel: (...args: unknown[]) => listCasesForChannel(...args),
  listDisputeFoxBoard: (...args: unknown[]) => listDisputeFoxBoard(...args),
}));

vi.mock("@/lib/credit/smartcredit-workspace", () => ({
  listSmartCreditBoard: (...args: unknown[]) => listSmartCreditBoard(...args),
}));

vi.mock("@/lib/integrations/disputefox/probe", () => ({
  probeDisputeFoxApi: (...args: unknown[]) => probeDisputeFoxApi(...args),
}));

vi.mock("@/lib/credit/smartcredit-health", () => ({
  probeSmartCreditHealth: (...args: unknown[]) => probeSmartCreditHealth(...args),
}));

const CHANNEL_PAGES: Array<{ href: string; channel?: DisputeChannel; importPage: () => Promise<{ default: () => Promise<ReactNode> }> }> =
  [
    {
      href: "/credit/disputefox",
      importPage: () => import("../src/app/(staff)/credit/disputefox/page"),
    },
    {
      href: "/credit/experian",
      channel: "EXPERIAN",
      importPage: () => import("../src/app/(staff)/credit/experian/page"),
    },
    {
      href: "/credit/equifax",
      channel: "EQUIFAX",
      importPage: () => import("../src/app/(staff)/credit/equifax/page"),
    },
    {
      href: "/credit/transunion",
      channel: "TRANSUNION",
      importPage: () => import("../src/app/(staff)/credit/transunion/page"),
    },
    {
      href: "/credit/innovis",
      channel: "INNOVIS",
      importPage: () => import("../src/app/(staff)/credit/innovis/page"),
    },
    {
      href: "/credit/smartcredit",
      importPage: () => import("../src/app/(staff)/credit/smartcredit/page"),
    },
    {
      href: "/escalations/cfpb",
      channel: "CFPB",
      importPage: () => import("../src/app/(staff)/escalations/cfpb/page"),
    },
  ];

describe("credit / escalation desk pages", () => {
  beforeEach(() => {
    listCasesForChannel.mockReset().mockResolvedValue([]);
    listDisputeFoxBoard.mockReset().mockResolvedValue([]);
    listSmartCreditBoard.mockReset().mockResolvedValue([]);
    findManyClients.mockReset().mockResolvedValue([]);
    probeDisputeFoxApi.mockReset().mockResolvedValue({
      status: "ACTION_REQUIRED",
      detail: "probe skipped",
      lastSuccessAt: null,
      probed: false,
    });
    probeSmartCreditHealth.mockReset().mockResolvedValue({
      status: "ACTION_REQUIRED",
      detail: "probe skipped",
      lastSuccessAt: null,
      probed: false,
    });
  });

  it("keeps NewCaseForm props serializable in source", () => {
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/disputes/NewCaseForm.tsx"), "utf8");
    expect(form).toMatch(/caseDetailHref\(channel,/);
    expect(form).not.toMatch(/detailHref/);
    for (const file of [
      "src/components/disputes/ChannelCasesView.tsx",
      "src/app/(staff)/credit/disputefox/page.tsx",
      "src/app/(staff)/credit/smartcredit/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).not.toMatch(/detailHref\s*=/);
      expect(src, file).not.toMatch(/cheerio|puppeteer|playwright/i);
    }
  });

  it("does not pass functions into client NewCaseForm (the production Flight 500)", async () => {
    const { ChannelCasesView } = await import("../src/components/disputes/ChannelCasesView");
    const { NewCaseForm } = await import("../src/components/disputes/NewCaseForm");
    const tree = await ChannelCasesView({ channel: "EXPERIAN", user: owner });
    expect(() => assertNoFunctionPropsToClientComponents(tree, [NewCaseForm])).not.toThrow();
  });

  it.each(CHANNEL_PAGES)("$href renders for an owner without throwing", async ({ href, channel, importPage }) => {
    const { NewCaseForm } = await import("../src/components/disputes/NewCaseForm");
    const { SmartCreditAttachForm } = await import("../src/components/credit/SmartCreditAttachForm");
    const { SmartCreditSessionForm } = await import("../src/components/credit/SmartCreditSessionForm");
    const Page = (await importPage()).default;
    const tree = await Page();
    assertNoFunctionPropsToClientComponents(tree, [NewCaseForm, SmartCreditAttachForm, SmartCreditSessionForm]);
    const html = renderToStaticMarkup(createElement("div", null, tree));
    expect(html, href).not.toMatch(/This page couldn't load|A server error occurred/i);
    expect(html, href).toMatch(/Open login/);
    expect(html, href).toMatch(/Honest empty desk|Open OS case|Open a case/);
    if (channel) {
      expect(html, href).toContain(DISPUTE_CHANNELS[channel].label);
    }
  });

  it("renders empty desk + Open login when the case query throws", async () => {
    listCasesForChannel.mockRejectedValue(new Error('relation "DisputeCase" does not exist'));
    const { ChannelCasesView } = await import("../src/components/disputes/ChannelCasesView");
    const { NewCaseForm } = await import("../src/components/disputes/NewCaseForm");
    const tree = await ChannelCasesView({ channel: "EQUIFAX", user: owner });
    assertNoFunctionPropsToClientComponents(tree, [NewCaseForm]);
    const html = renderToStaticMarkup(createElement("div", null, tree));
    expect(html).toMatch(/Equifax/);
    expect(html).toMatch(/Honest empty desk/);
    expect(html).toMatch(/Open login/);
    expect(html).toMatch(/could not load/);
    expect(html).not.toMatch(/This page couldn't load|A server error occurred/i);
  });

  it("renders DisputeFox and SmartCredit when board loaders throw", async () => {
    listDisputeFoxBoard.mockRejectedValue(new Error("DisputeFox board unavailable"));
    listSmartCreditBoard.mockRejectedValue(new Error("SmartCredit board unavailable"));
    const { NewCaseForm } = await import("../src/components/disputes/NewCaseForm");
    const { SmartCreditAttachForm } = await import("../src/components/credit/SmartCreditAttachForm");
    const { SmartCreditSessionForm } = await import("../src/components/credit/SmartCreditSessionForm");

    const DisputeFox = (await import("../src/app/(staff)/credit/disputefox/page")).default;
    const SmartCredit = (await import("../src/app/(staff)/credit/smartcredit/page")).default;
    const foxTree = await DisputeFox();
    const scTree = await SmartCredit();
    assertNoFunctionPropsToClientComponents(foxTree, [NewCaseForm]);
    assertNoFunctionPropsToClientComponents(scTree, [NewCaseForm, SmartCreditAttachForm, SmartCreditSessionForm]);

    const foxHtml = renderToStaticMarkup(createElement("div", null, foxTree));
    const scHtml = renderToStaticMarkup(createElement("div", null, scTree));
    expect(foxHtml).toMatch(/DisputeFox/);
    expect(foxHtml).toMatch(/Open login/);
    expect(foxHtml).toMatch(/could not load/);
    expect(scHtml).toMatch(/SmartCredit/);
    expect(scHtml).toMatch(/Open login/);
    expect(scHtml).toMatch(/could not load/);
  });
});
