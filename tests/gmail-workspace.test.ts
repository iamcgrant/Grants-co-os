import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GMAIL_CLIENT_ID_ENV,
  GMAIL_CLIENT_SECRET_ENV,
  GMAIL_REFRESH_TOKEN_ENV,
  listGmailInbox,
  probeGmailInbox,
} from "@/lib/integrations/gmail/workspace";

describe("work Gmail official inbox", () => {
  afterEach(() => {
    delete process.env[GMAIL_CLIENT_ID_ENV];
    delete process.env[GMAIL_CLIENT_SECRET_ENV];
    delete process.env[GMAIL_REFRESH_TOKEN_ENV];
    vi.restoreAllMocks();
  });

  it("fails closed without GMAIL_* and does not call Google", async () => {
    const fetchImpl = vi.fn();
    const inbox = await listGmailInbox({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const probe = await probeGmailInbox(fetchImpl as unknown as typeof fetch);
    expect(inbox.ready).toBe(false);
    expect(inbox.failedClosed).toBe(true);
    expect(inbox.message).toMatch(/GMAIL_CLIENT_ID/);
    expect(probe.status).toBe("ACTION_REQUIRED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lists inbox messages via the official Gmail API", async () => {
    process.env[GMAIL_CLIENT_ID_ENV] = "id";
    process.env[GMAIL_CLIENT_SECRET_ENV] = "secret";
    process.env[GMAIL_REFRESH_TOKEN_ENV] = "refresh";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "ya29.test" }), { status: 200 });
      }
      if (url.includes("/messages?") && url.includes("labelIds=INBOX")) {
        return new Response(JSON.stringify({ messages: [{ id: "m1", threadId: "t1" }] }), { status: 200 });
      }
      if (url.includes("/messages/m1")) {
        return new Response(
          JSON.stringify({
            id: "m1",
            threadId: "t1",
            snippet: "Refund update",
            payload: {
              headers: [
                { name: "From", value: "client@example.com" },
                { name: "Subject", value: "SBTPG question" },
                { name: "Date", value: "Fri, 21 Aug 2026 12:00:00 -0400" },
              ],
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const inbox = await listGmailInbox({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(inbox.ready).toBe(true);
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0]?.subject).toBe("SBTPG question");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toMatch(/oauth2\.googleapis\.com\/token/);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toMatch(/gmail\.googleapis\.com/);
  });

  it("native inbox does not scrape", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(staff)/inbox/page.tsx"), "utf8");
    const nav = fs.readFileSync(path.join(process.cwd(), "src/lib/nav/role-nav.ts"), "utf8");
    expect(page).toMatch(/GmailWorkInbox/);
    expect(page).not.toMatch(/cheerio|puppeteer|playwright/i);
    expect(nav).toMatch(/\/inbox\?tab=gmail/);
    expect(nav).toMatch(/label: "Telegram"/);
  });
});
