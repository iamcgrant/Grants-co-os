import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { resolveDisputeFoxIntakeUrl } from "@/lib/payments/post-payment";

/**
 * Bridge after Grants Pay success → DisputeFox intake.
 * Keeps Grants & Co OS as the orchestrator; DisputeFox stays an external provider.
 */
export default async function PayContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceNumber: string }>;
  searchParams: Promise<{ txn?: string }>;
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
      <main className="min-h-dvh flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="text-3xl mb-3">Payment not confirmed</h1>
          <p className="text-sm text-[var(--gc-muted)] mb-6">
            We could not confirm a successful payment for this invoice yet. Return to Grants Pay or contact support.
          </p>
          <Link href={`/pay/${invoiceNumber}`} className="gc-btn gc-btn-primary">
            Back to Grants Pay
          </Link>
        </div>
      </main>
    );
  }

  const externalId = invoice.client.identifiers[0]?.externalId;
  const intakeUrl = resolveDisputeFoxIntakeUrl({
    externalDisputeFoxId: externalId,
    grantsClientId: invoice.client.grantsClientId,
  });

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center gc-fade-up">
        <p className="text-[0.7rem] tracking-[0.35em] uppercase text-[var(--gc-gold)] mb-3">
          Grants &amp; Co
        </p>
        <h1 className="text-4xl mb-3">Payment received</h1>
        <p className="text-sm text-[var(--gc-muted)] mb-8">
          {invoice.client.firstName}, your payment for invoice {invoice.invoiceNumber} is confirmed.
          Next step: complete your dispute intake.
        </p>

        {intakeUrl ? (
          <a href={intakeUrl} className="gc-btn gc-btn-gold w-full">
            Continue to Intake
          </a>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--gc-muted)]">
              DisputeFox intake is not configured yet
              {externalId ? ` (external id on file: ${externalId})` : " (no DisputeFox ID attached)"}.
              Set <code className="text-xs">DISPUTEFOX_INTAKE_URL_TEMPLATE</code> in the server environment
              when the intake URL is ready.
            </p>
            <Link href="/portal" className="gc-btn gc-btn-primary inline-flex">
              Go to Client Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
