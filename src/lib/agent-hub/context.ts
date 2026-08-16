/**
 * Shared Business Context Layer — durable facts vs temporary task context.
 */

import { prisma } from "@/lib/db/prisma";
import { scrubSecrets } from "./types";

export type FactCategory = "ARCHITECTURE" | "MAPPING" | "WORKFLOW" | "RULE" | "DECISION" | "QA";

export const CORE_BUSINESS_FACTS: {
  category: FactCategory;
  key: string;
  title: string;
  value: Record<string, unknown>;
}[] = [
  {
    category: "ARCHITECTURE",
    key: "os.master_identity",
    title: "Grants Client is master identity",
    value: {
      rule: "Grants & Co OS owns master client identity. GHL and DisputeFox are adapters.",
      grantsClientIdFormat: "GC-######",
    },
  },
  {
    category: "MAPPING",
    key: "ghl.field.disputefox_client_id",
    title: "GHL field — DisputeFox Client ID",
    value: {
      provider: "GHL",
      fieldKey: "disputefox_client_id",
      fieldLabel: "DisputeFox Client ID",
      mapsTo: "ClientIdentifier.provider=DISPUTEFOX.externalId",
      overwritePolicy: "Do not invent IDs. Attach only when matched.",
      notes: "Custom field mapping used by X1 / intake bridge.",
    },
  },
  {
    category: "MAPPING",
    key: "ghl.field.grants_client_id",
    title: "GHL field — Grants Client ID",
    value: {
      provider: "GHL",
      fieldKey: "grants_client_id",
      fieldLabel: "Grants Client ID",
      mapsTo: "Client.grantsClientId",
      syncDirection: "OS → GHL preferred; OS remains source of truth",
    },
  },
  {
    category: "MAPPING",
    key: "ghl.field.weekly_score_week_id",
    title: "GHL field — Weekly Score Week ID",
    value: {
      provider: "GHL",
      fieldKey: "weekly_score_week_id",
      fieldLabel: "Weekly Score Week ID",
      mapsTo: "FridayPulseRun.weekOf + client pulse item",
      overwritePolicy: "Overwrite each Friday only after previous/current score preservation completes",
    },
  },
  {
    category: "MAPPING",
    key: "ghl.field.intake_status",
    title: "GHL field — Intake Status",
    value: {
      provider: "GHL",
      fieldKey: "intake_status",
      fieldLabel: "Intake Status",
      mapsTo: "Client.stage / onboarding checklist",
      osStatus: "PARTIAL",
      gap: "Client 360 should surface Intake Status mapping explicitly when live GHL sync is connected",
    },
  },
  {
    category: "WORKFLOW",
    key: "workflow.ownership",
    title: "Staff workflow ownership",
    value: {
      charles: "OWNER approval + exceptions",
      simon: "Client Care — follow-ups, docs, results delivery",
      jona: "File Processing — rounds, filings, DisputeFox workspace",
    },
  },
  {
    category: "RULE",
    key: "rule.resolve_before_escalate",
    title: "Resolve before escalate",
    value: {
      policy: [
        "Can the current agent determine the answer?",
        "Can another Grants agent answer it?",
        "Can an approved system/API answer it?",
        "Can Cursor solve/test it safely?",
      ],
      escalateOnlyIf: "All applicable paths fail OR Level 3 owner approval required",
    },
  },
  {
    category: "RULE",
    key: "rule.no_secret_sharing",
    title: "Agents use abilities, not shared credentials",
    value: {
      neverReturn: ["passwords", "api keys", "tokens", "cookies", "security answers"],
      useCapabilities: ["lookupGHLContact", "getPaymentState", "getSystemHealth"],
    },
  },
];

export async function ensureBusinessFacts() {
  for (const fact of CORE_BUSINESS_FACTS) {
    await prisma.businessFact.upsert({
      where: { key: fact.key },
      create: {
        category: fact.category,
        key: fact.key,
        title: fact.title,
        valueJson: JSON.stringify(scrubSecrets(fact.value)),
        sourceAgent: "system",
        durable: true,
      },
      update: {
        title: fact.title,
        valueJson: JSON.stringify(scrubSecrets(fact.value)),
        category: fact.category,
      },
    });
  }
}

export async function getBusinessConfiguration(filter?: { category?: string; query?: string }) {
  await ensureBusinessFacts();
  const facts = await prisma.businessFact.findMany({
    where: filter?.category ? { category: filter.category } : undefined,
    orderBy: { key: "asc" },
  });
  const q = filter?.query?.toLowerCase().trim();
  const filtered = q
    ? facts.filter(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          f.title.toLowerCase().includes(q) ||
          f.valueJson.toLowerCase().includes(q),
      )
    : facts;
  return filtered.map((f) => ({
    key: f.key,
    category: f.category,
    title: f.title,
    value: scrubSecrets(JSON.parse(f.valueJson)),
    durable: f.durable,
    updatedAt: f.updatedAt,
  }));
}

export async function upsertBusinessFact(input: {
  category: FactCategory;
  key: string;
  title: string;
  value: Record<string, unknown>;
  sourceAgent?: string;
}) {
  return prisma.businessFact.upsert({
    where: { key: input.key },
    create: {
      category: input.category,
      key: input.key,
      title: input.title,
      valueJson: JSON.stringify(scrubSecrets(input.value)),
      sourceAgent: input.sourceAgent,
      durable: true,
    },
    update: {
      title: input.title,
      valueJson: JSON.stringify(scrubSecrets(input.value)),
      category: input.category,
      sourceAgent: input.sourceAgent,
    },
  });
}

export async function rememberAgentFact(input: {
  agentId: string;
  key: string;
  value: Record<string, unknown>;
  kind?: string;
  durable?: boolean;
}) {
  return prisma.agentMemory.upsert({
    where: { agentId_key: { agentId: input.agentId, key: input.key } },
    create: {
      agentId: input.agentId,
      key: input.key,
      kind: input.kind || "FACT",
      valueJson: JSON.stringify(scrubSecrets(input.value)),
      durable: input.durable ?? true,
    },
    update: {
      valueJson: JSON.stringify(scrubSecrets(input.value)),
      kind: input.kind || "FACT",
      durable: input.durable ?? true,
    },
  });
}
