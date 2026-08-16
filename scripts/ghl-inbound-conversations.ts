/**
 * Additive CLI for GHL → Grants OS inbox conversation pull (linked masters only).
 *
 * Uses the same inbound path as POST /api/integrations/ghl/conversations/sync.
 * Never writes GHL contacts. Never sends SMS/email/iMessage.
 * Never creates Grants clients. Fail-closed without GHL_API_KEY.
 * Fail-closed if the PIT cannot list conversations/messages (needs conversations.readonly).
 *
 * Does not print secret values, contact PII, or location ids.
 *
 *   npx tsx scripts/ghl-inbound-conversations.ts --dry-run
 *   npx tsx scripts/ghl-inbound-conversations.ts --apply
 */
import "dotenv/config";
import { isGhlApiReady } from "../src/lib/integrations/ghl/http";
import {
  failClosedMissingConversationScope,
  failClosedWithoutGhlKeyForConversations,
  pullGhlConversationsForLinkedMasters,
} from "../src/lib/integrations/ghl/conversations";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

async function main() {
  const dryRun = !argFlag("--apply");

  const report: Record<string, unknown> = {
    ghlApiKeyPresent: present("GHL_API_KEY"),
    ghlLocationIdPresent: present("GHL_LOCATION_ID"),
    dryRun,
    dataPlane: process.env.GC_ENV === "production" ? "production" : "development",
    inboundOnly: true,
    sendMessages: false,
  };

  if (!isGhlApiReady()) {
    const closed = failClosedWithoutGhlKeyForConversations(dryRun);
    console.log(
      JSON.stringify(
        {
          ...report,
          failedClosed: true,
          missingScope: false,
          linkedMasters: 0,
          fetchedConversations: 0,
          imported: 0,
          duplicates: 0,
          requiredSecrets: closed.requiredSecrets,
          requiredScope: closed.requiredScope,
          additionalScopesNeeded: closed.additionalScopesNeeded,
          message: "Fail-closed: GHL_API_KEY is not set.",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const pull = await pullGhlConversationsForLinkedMasters({ dryRun });

  if (pull.failedClosed) {
    const closed = pull.missingScope
      ? failClosedMissingConversationScope({
          dryRun,
          requiredScope: pull.requiredScope,
          linkedMasters: pull.linkedMasters,
        })
      : failClosedWithoutGhlKeyForConversations(dryRun);
    console.log(
      JSON.stringify(
        {
          ...report,
          failedClosed: true,
          missingScope: Boolean(pull.missingScope),
          linkedMasters: pull.linkedMasters,
          fetchedConversations: 0,
          imported: 0,
          duplicates: 0,
          requiredScope: closed.requiredScope,
          additionalScopesNeeded: closed.additionalScopesNeeded,
          message: closed.message,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        failedClosed: false,
        linkedMasters: pull.linkedMasters,
        fetchedConversations: pull.fetchedConversations,
        imported: pull.imported,
        duplicates: pull.duplicates,
        requiredScope: pull.requiredScope,
        additionalScopesNeeded: pull.additionalScopesNeeded,
        message: pull.message,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  const status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 1;
  console.log(
    JSON.stringify(
      {
        failedClosed: status === 503 || status === 401 || status === 403,
        error: "ghl_conversation_pull_failed",
        httpStatus: Number.isFinite(status) ? status : 1,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
