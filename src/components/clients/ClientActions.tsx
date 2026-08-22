"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Milestone = {
  id: string;
  name: string;
  isCompleted: boolean;
  invoiceEligible: boolean;
  invoiceCreated: boolean;
  serviceName: string;
};

export function ClientActions({
  clientId,
  grantsClientId,
  milestones,
  canManage,
  canPay,
}: {
  clientId: string;
  grantsClientId: string;
  milestones: Milestone[];
  canManage: boolean;
  canPay: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  async function attachService() {
    const res = await fetch(`/api/clients/${clientId}/services`, { method: "POST" });
    const data = await res.json();
    setMsg(res.ok ? "Service attached" : data.error);
    router.refresh();
  }

  async function completeMilestone(id: string) {
    const res = await fetch(`/api/milestones/${id}/complete`, { method: "POST" });
    const data = await res.json();
    setMsg(res.ok ? "Milestone completed" : data.error);
    router.refresh();
  }

  async function createInvoice(id: string) {
    const res = await fetch(`/api/milestones/${id}/invoice`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Invoice ${data.invoice.invoiceNumber} created`);
      router.push(`/pay/invoices/${data.invoice.invoiceNumber}`);
    } else {
      setMsg(data.error);
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {canManage && (
          <button type="button" className="gc-btn gc-btn-ghost" onClick={() => void attachService()}>
            Attach Service
          </button>
        )}
        <a className="gc-btn gc-btn-ghost" href={`/clients/${grantsClientId}`}>
          Refresh
        </a>
      </div>

      <div className="space-y-3">
        {milestones.map((m) => (
          <div key={m.id} className="py-3 border-b border-[var(--gc-border)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-[var(--gc-muted)]">
                {m.serviceName} · {m.isCompleted ? "Completed" : "Pending"}
                {m.invoiceEligible ? " · Invoice eligible" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {canManage && !m.isCompleted && (
                <button type="button" className="gc-btn gc-btn-primary" onClick={() => void completeMilestone(m.id)}>
                  Complete
                </button>
              )}
              {canPay && m.invoiceEligible && !m.invoiceCreated && (
                <button type="button" className="gc-btn gc-btn-gold" onClick={() => void createInvoice(m.id)}>
                  Create Invoice
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="text-sm text-[var(--gc-muted)]">{msg}</p>}
    </div>
  );
}
