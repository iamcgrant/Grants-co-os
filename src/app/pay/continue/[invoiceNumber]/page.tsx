import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { resolveDisputeFoxIntakeUrl } from "@/lib/payments/post-payment";
import { issueOnboardingToken } from "@/lib/payments/payment-requests";
import { drainAutomationQueue } from "@/lib/automations/engine";

/**
 * Bridge after Grants Pay success → native Client Setup (with DisputeFox fallback).
 */
export default async function PayContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceNumber: string }>;
  searchParams: Promise<{ txn?: string; pr?: string }>;
}) {
  const { invoiceNumber } = await params;
  const { txn } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      client: {
        include: {
          identifiers: { where: { provider: "DISPUTEFOX" } },
        },
      },
    },
  });
  if (!invoice) notFound();

  const transaction = txn
    ? await prisma.paymentTransaction.findFirst({
        where: {
          id: txn,
          invoiceId: invoice.id,
          status: "SUCCEEDED",
        },
      })
    : await prisma.paymentTransaction.findFirst({
        where: { invoiceId: invoice.id, status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
      });

  if (!transaction) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-5 bg-[linear-gradient(165deg,#040404,#16161a)]">
        <div className="max-w-md text-center">
          <h1 className="text-3xl mb-3">Payment not confirmed</h1>
          <p className="text-sm text-[var(--gc-muted)] mb-6">
            We could not confirm a successful payment for this invoice yet.
          </p>
          <Link href={`/pay/${invoiceNumber}`} className="gc-btn gc-btn-primary">
            Back to Grants Pay
          </Link>
        </div>
      </main>
    );
  }

  // Drain payment-completed automation so setup token exists
  await drainAutomationQueue(10);

  let setupPath: string | null = null;
  const existingToken = await prisma.onboardingToken.findFirst({
    where: {
      clientId: invoice.clientId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingToken) {
    // Token hash only — re-issue a fresh usable link for the client
    const issued = await issueOnboardingToken({
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      paymentId: transaction.id,
      serviceName: invoice.description,
    });
    setupPath = issued.setupPath;
  } else {
    const issued = await issueOnboardingToken({
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      paymentId: transaction.id,
      serviceName: invoice.description,
    });
    setupPath = issued.setupPath;
  }

  const externalId = invoice.client.identifiers[0]?.externalId;
  const intakeUrl = resolveDisputeFoxIntakeUrl({
    externalDisputeFoxId: externalId,
    grantsClientId: invoice.client.grantsClientId,
  });

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-12 bg-[radial-gradient(ellipse_at_top,_rgba(245,184,42,0.08),_transparent_50%),linear-gradient(165deg,#040404,#16161a)]">
      <div className="w-full max-w-md text-center gc-fade-up rounded-[28px] border border-[var(--gc-border)] bg-white/[0.03] px-8 py-12">
        <p className="text-[0.7rem] tracking-[0.35em] uppercase text-[var(--gc-gold)] mb-3">
          Grants &amp; Co
        </p>
        <h1 className="display text-4xl mb-3">Payment Successful</h1>
        <p className="display text-5xl text-[var(--gc-gold)] mb-4">
          ${(transaction.amountCents / 100).toFixed(2)}
        </p>
        <p className="text-sm text-[var(--gc-muted)] mb-8 leading-relaxed">
          {invoice.client.firstName}, your payment for invoice {invoice.invoiceNumber} is confirmed.
          Receipt {transaction.id.slice(0, 10).toUpperCase()}.
        </p>

        {setupPath ? (
          <Link href={setupPath} className="gc-btn gc-btn-gold w-full inline-flex justify-center mb-3">
            Continue to Client Setup
          </Link>
        ) : null}

        {intakeUrl ? (
          <a href={intakeUrl} className="gc-btn gc-btn-ghost w-full inline-flex justify-center text-xs">
            Open DisputeProcess intake (fallback)
          </a>
        ) : (
          <p className="text-xs text-[var(--gc-muted)] mt-4">
            Existing DisputeProcess intake remains available once{" "}
            <code>DISPUTEFOX_INTAKE_URL_TEMPLATE</code> is configured — native setup is primary.
          </p>
        )}
      </div>
    </main>
  );
}
