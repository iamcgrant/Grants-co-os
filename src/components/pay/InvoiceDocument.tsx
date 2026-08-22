import Link from "next/link";
import { formatInvoiceUsd } from "./invoice-money";

export type InvoiceDocumentItem = {
  id: string;
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
};

export type InvoiceDocumentModel = {
  invoiceNumber: string;
  status: string;
  amountCents: number;
  amountPaidCents: number;
  description: string | null;
  dueAt?: string | Date | null;
  createdAt?: string | Date | null;
  clientName: string;
  grantsClientId: string;
  clientEmail?: string | null;
  paymentRequestPublicId?: string | null;
  items: InvoiceDocumentItem[];
  lastStepUrl?: string | null;
  osPayPath?: string | null;
};

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function InvoiceDocument({
  invoice,
  staffHref,
}: {
  invoice: InvoiceDocumentModel;
  staffHref?: string;
}) {
  const due = asDate(invoice.dueAt);
  const issued = asDate(invoice.createdAt);
  const remaining = invoice.amountCents - invoice.amountPaidCents;
  const lineItems =
    invoice.items.length > 0
      ? invoice.items
      : [
          {
            id: "line",
            description: invoice.description || "Grants & Co service",
            quantity: 1,
            unitCents: invoice.amountCents,
            totalCents: invoice.amountCents,
          },
        ];

  return (
    <article className="rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-7 py-8 md:px-10 md:py-10">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
        <div>
          <p className="text-[0.7rem] tracking-[0.32em] uppercase text-[var(--gc-gold)] mb-3">
            Grants &amp; Co
          </p>
          <h2 className="display text-3xl md:text-4xl tracking-tight mb-1">Invoice</h2>
          <p className="text-sm text-[var(--gc-muted)]">{invoice.invoiceNumber}</p>
        </div>
        <div className="text-left md:text-right">
          <span className="gc-status">{invoice.status.replaceAll("_", " ")}</span>
          {invoice.paymentRequestPublicId ? (
            <p className="text-[0.65rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mt-3">
              {invoice.paymentRequestPublicId}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div>
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-1">Bill to</p>
          <p className="text-lg display">{invoice.clientName}</p>
          <p className="text-sm text-[var(--gc-muted)]">{invoice.grantsClientId}</p>
          {invoice.clientEmail ? (
            <p className="text-sm text-[var(--gc-muted)]">{invoice.clientEmail}</p>
          ) : null}
        </div>
        <div className="md:text-right">
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-1">Issued</p>
          <p className="text-sm">{issued ? issued.toLocaleDateString() : "—"}</p>
          <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mt-3 mb-1">Due</p>
          <p className="text-sm">{due ? due.toLocaleDateString() : "Upon receipt"}</p>
        </div>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="gc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="text-[var(--gc-muted)]">{item.quantity}</td>
                <td className="display">{formatInvoiceUsd(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-t border-[var(--gc-border)] pt-6">
        <div className="space-y-1 text-sm text-[var(--gc-muted)]">
          <p>Card data never touches Grants &amp; Co servers.</p>
          <p>Official Commas / Fanbasis checkout is the last payment step only.</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-[0.62rem] tracking-[0.18em] uppercase text-[var(--gc-muted)] mb-2">
            {remaining > 0 ? "Amount due" : "Paid"}
          </p>
          <p className="display text-4xl text-[var(--gc-gold)]">
            {formatInvoiceUsd(remaining > 0 ? remaining : invoice.amountCents)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        {staffHref ? (
          <Link href={staffHref} className="gc-btn gc-btn-gold">
            Open invoice
          </Link>
        ) : null}
        {invoice.lastStepUrl ? (
          <a
            href={invoice.lastStepUrl}
            target="_blank"
            rel="noreferrer"
            className="gc-btn gc-btn-outline"
          >
            Official Commas checkout
          </a>
        ) : null}
        {invoice.osPayPath ? (
          <Link href={invoice.osPayPath} className="gc-btn gc-btn-ghost">
            Client pay page
          </Link>
        ) : null}
      </div>
    </article>
  );
}
