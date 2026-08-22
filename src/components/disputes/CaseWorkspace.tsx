"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { channelCatalog, nextDisputeStatus, statusLabel, type DisputeCaseStatus, type DisputeChannel } from "@/lib/disputes/channels";

type CaseView = {
  id: string;
  channel: string;
  status: string;
  title: string;
  packetNotes: string | null;
  externalRef: string | null;
  outcome: string | null;
  outcomeNote: string | null;
  openedAt: string | Date;
  packetReadyAt: string | Date | null;
  readyAt: string | Date | null;
  submittedAt: string | Date | null;
  resultsAt: string | Date | null;
  closedAt: string | Date | null;
  items: Array<{
    id: string;
    label: string;
    bureau: string | null;
    accountRef: string | null;
    reason: string | null;
    status: string;
  }>;
  checklist: Array<{
    id: string;
    key: string;
    label: string;
    required: boolean;
    done: boolean;
  }>;
  client: { grantsClientId: string; firstName: string; lastName: string };
};

function fmt(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function CaseWorkspace({
  disputeCase,
  canManage,
}: {
  disputeCase: CaseView;
  canManage: boolean;
}) {
  const router = useRouter();
  const catalog = channelCatalog(disputeCase.channel as DisputeChannel);
  const status = disputeCase.status as DisputeCaseStatus;
  const next = nextDisputeStatus(status);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState({ label: "", bureau: "", accountRef: "", reason: "" });
  const [packetNotes, setPacketNotes] = useState(disputeCase.packetNotes || "");
  const [externalRef, setExternalRef] = useState(disputeCase.externalRef || "");
  const [outcome, setOutcome] = useState(disputeCase.outcome || "");
  const [outcomeNote, setOutcomeNote] = useState(disputeCase.outcomeNote || "");

  async function patch(path: string, method: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function onAddItem(e: FormEvent) {
    e.preventDefault();
    void patch(`/api/credit/cases/${disputeCase.id}/items`, "POST", item).then(() => {
      setItem({ label: "", bureau: "", accountRef: "", reason: "" });
    });
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--gc-muted)] max-w-3xl leading-relaxed">{catalog.honesty}</p>

      <div className="gc-grid-dense gc-grid-dense-4">
        {[
          ["Opened", fmt(disputeCase.openedAt)],
          ["Packet", fmt(disputeCase.packetReadyAt)],
          ["Submitted", fmt(disputeCase.submittedAt)],
          ["Results", fmt(disputeCase.resultsAt)],
        ].map(([label, value]) => (
          <div key={label} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">{label}</p>
            <p className="display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-2xl mb-3">Items</h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4 mb-4">
          {disputeCase.items.length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">No items yet — add the accounts or issues in this case.</p>
          ) : (
            disputeCase.items.map((row) => (
              <div key={row.id} className="py-3">
                <p className="font-medium">{row.label}</p>
                <p className="text-sm text-[var(--gc-muted)]">
                  {[row.bureau, row.accountRef, row.reason].filter(Boolean).join(" · ") || row.status}
                </p>
              </div>
            ))
          )}
        </div>
        {canManage && status !== "CLOSED" ? (
          <form onSubmit={onAddItem} className="gc-card grid md:grid-cols-2 gap-3">
            <input className="gc-input" placeholder="Item / creditor" value={item.label} onChange={(e) => setItem((s) => ({ ...s, label: e.target.value }))} required />
            <input className="gc-input" placeholder="Bureau (optional)" value={item.bureau} onChange={(e) => setItem((s) => ({ ...s, bureau: e.target.value }))} />
            <input className="gc-input" placeholder="Account / ref" value={item.accountRef} onChange={(e) => setItem((s) => ({ ...s, accountRef: e.target.value }))} />
            <input className="gc-input" placeholder="Reason" value={item.reason} onChange={(e) => setItem((s) => ({ ...s, reason: e.target.value }))} />
            <button type="submit" className="gc-btn gc-btn-outline text-xs" disabled={busy}>
              Add item
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className="text-2xl mb-3">Packet</h2>
        <textarea
          className="gc-input min-h-[140px] w-full"
          value={packetNotes}
          onChange={(e) => setPacketNotes(e.target.value)}
          placeholder="What is in the packet, what is missing, and what staff already completed in OS."
          disabled={!canManage || status === "CLOSED"}
        />
        {canManage && status !== "CLOSED" ? (
          <button
            type="button"
            className="gc-btn gc-btn-ghost text-xs mt-3"
            disabled={busy}
            onClick={() => void patch(`/api/credit/cases/${disputeCase.id}`, "PATCH", { action: "packet", packetNotes })}
          >
            Save packet
          </button>
        ) : null}
      </section>

      <section>
        <h2 className="text-2xl mb-3">Checklist</h2>
        <div className="space-y-2">
          {disputeCase.checklist.map((row) => (
            <label key={row.key} className="gc-card flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={row.done}
                disabled={!canManage || busy || status === "CLOSED"}
                onChange={(e) =>
                  void patch(`/api/credit/cases/${disputeCase.id}/checklist`, "PATCH", {
                    key: row.key,
                    done: e.target.checked,
                  })
                }
              />
              <span>
                <span className="font-medium">{row.label}</span>
                {row.required ? <span className="text-xs text-[var(--gc-muted)]"> · required</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl mb-3">Result tracking</h2>
        <div className="gc-card space-y-3 max-w-xl">
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Official confirmation / complaint id</span>
            <input className="gc-input mt-1 w-full" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} disabled={!canManage} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Outcome</span>
            <input className="gc-input mt-1 w-full" value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={!canManage} placeholder="Deleted / updated / verified / no change" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--gc-muted)]">Outcome notes</span>
            <textarea className="gc-input mt-1 w-full min-h-[80px]" value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} disabled={!canManage} />
          </label>
        </div>
      </section>

      {canManage && next ? (
        <section className="gc-card max-w-xl space-y-3">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)]">Next action</p>
          <p className="text-xl display">
            {statusLabel(status)} → {statusLabel(next)}
          </p>
          {next === "SUBMITTED" ? (
            <p className="text-sm text-[var(--gc-muted)] leading-relaxed">
              {catalog.canSubmitInApp
                ? "This channel can be submitted from Grants OS."
                : "Cannot submit this channel in-app. Complete the official last step, then record it here."}
              {catalog.hasOfficialPortal && catalog.officialSubmitUrl ? (
                <>
                  {" "}
                  Official last step (not the workspace):{" "}
                  <a className="text-[var(--gc-ice)]" href={catalog.officialSubmitUrl} target="_blank" rel="noreferrer">
                    {catalog.label} official submit
                  </a>
                  .
                </>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            className="gc-btn gc-btn-gold text-xs"
            disabled={busy}
            onClick={() =>
              void patch(`/api/credit/cases/${disputeCase.id}`, "PATCH", {
                action: "advance",
                externalRef,
                outcome,
                outcomeNote,
              })
            }
          >
            Advance to {statusLabel(next)}
          </button>
        </section>
      ) : (
        <p className="text-sm text-[var(--gc-muted)]">Case {statusLabel(status).toLowerCase()}.</p>
      )}

      {message ? <p className="text-sm text-[var(--gc-gold)]">{message}</p> : null}
    </div>
  );
}
