import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listInbox } from "@/lib/communications/service";
import { ComposeMessage } from "@/components/inbox/ComposeMessage";
import { prisma } from "@/lib/db/prisma";
import { Panel } from "@/components/ui/density";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { getGcEnvironment } from "@/lib/integrations/env";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; c?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { tab: tabRaw, c } = await searchParams;
  const tab = tabRaw === "team" ? "team" : tabRaw === "client" ? "client" : "all";
  const conversations = await listInbox(user.id, tab);
  const ghlReady = isGhlApiReady();
  const dataPlane = getGcEnvironment();

  const active = c
    ? await prisma.conversation.findUnique({
        where: { id: c },
        include: {
          client: true,
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: { select: { firstName: true, lastName: true } },
              mentions: { include: { user: { select: { firstName: true } } } },
            },
          },
        },
      })
    : null;

  return (
    <div className="gc-fade-up space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="gc-eyebrow mb-2">Communication center</p>
          <h1 className="text-3xl md:text-4xl mb-1">Inbox</h1>
          <p className="text-sm text-[var(--gc-muted)] max-w-2xl">
            Client messages and internal team chat — visually separated so internal notes never leave by accident.
            {" · "}
            {dataPlane} data plane
            {" · "}
            GHL channel {ghlReady ? "API ready (no live sends)" : "Awaiting Integration"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/inbox?tab=all" className={`gc-btn text-xs ${tab === "all" ? "gc-btn-primary" : "gc-btn-outline"}`}>All</Link>
          <Link href="/inbox?tab=client" className={`gc-btn text-xs ${tab === "client" ? "gc-btn-primary" : "gc-btn-outline"}`}>Client</Link>
          <Link href="/inbox?tab=team" className={`gc-btn text-xs ${tab === "team" ? "gc-btn-primary" : "gc-btn-outline"}`}>Team</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 min-h-[68vh]">
        <Panel className="!p-0 overflow-hidden">
          <div className="divide-y divide-[var(--gc-border)] max-h-[70vh] overflow-y-auto">
            {conversations.map((conv) => {
              const last = conv.messages[0];
              const title =
                conv.kind === "TEAM"
                  ? conv.subject || "Team chat"
                  : conv.client
                    ? `${conv.client.firstName} ${conv.client.lastName}`
                    : conv.subject || "Conversation";
              return (
                <Link
                  key={conv.id}
                  href={`/inbox?tab=${tab}&c=${conv.id}`}
                  className={`block px-4 py-3.5 hover:bg-white/[0.03] ${c === conv.id ? "bg-white/[0.05]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{title}</p>
                    <span className={`gc-status ${conv.kind === "CLIENT" ? "gc-status-warn" : "gc-status-ice"}`}>
                      {conv.kind === "CLIENT" ? "Client" : conv.kind === "CLIENT_INTERNAL" ? "Internal" : "Team"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--gc-muted)] line-clamp-2">
                    {last ? `${last.sender ? last.sender.firstName + ": " : ""}${last.body}` : "No messages yet"}
                  </p>
                  {last && (
                    <p className="text-[0.6rem] text-[var(--gc-muted)] mt-1">{last.createdAt.toLocaleString()}</p>
                  )}
                </Link>
              );
            })}
            {conversations.length === 0 && (
              <p className="p-4 text-sm text-[var(--gc-muted)]">No conversations yet.</p>
            )}
          </div>
        </Panel>

        <section className="gc-panel flex flex-col min-h-[68vh] overflow-hidden">
          {!active && (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-[var(--gc-muted)]">
              Select a conversation to read and reply
            </div>
          )}
          {active && (
            <>
              <div className="border-b border-[var(--gc-border)] px-4 py-3 flex justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {active.client
                      ? `${active.client.firstName} ${active.client.lastName}`
                      : active.subject || "Team"}
                  </p>
                  <p className="text-xs text-[var(--gc-muted)]">
                    {active.kind.replaceAll("_", " ")}
                    {active.client ? ` · ${active.client.grantsClientId}` : ""}
                  </p>
                </div>
                {active.client && (
                  <Link href={`/clients/${active.client.grantsClientId}`} className="gc-btn gc-btn-ghost text-xs">
                    Client 360
                  </Link>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[rgba(0,0,0,0.15)]">
                {active.messages.map((m) => (
                  <div key={m.id} className={m.isInternal ? "gc-bubble-internal" : "gc-bubble-client"}>
                    <p className={`gc-bubble-label ${m.isInternal ? "internal" : "client"}`}>
                      {m.isInternal ? "Internal · staff only" : "Client channel"}
                      {m.sender ? ` · ${m.sender.firstName}` : ""}
                      {m.mentions.length ? ` · @${m.mentions.map((x) => x.user.firstName).join(", @")}` : ""}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    <p className="text-[0.65rem] text-[var(--gc-muted)] mt-2">
                      {m.createdAt.toLocaleString()} · {m.channel} · {m.deliveryStatus}
                    </p>
                  </div>
                ))}
              </div>
              <ComposeMessage
                conversationId={active.id}
                defaultInternal={active.kind !== "CLIENT"}
                allowClientSend={active.kind === "CLIENT"}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
