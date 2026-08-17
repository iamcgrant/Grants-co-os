import { prisma } from "@/lib/db/prisma";

export type SearchHit = {
  type: "client" | "invoice" | "payment" | "task" | "conversation" | "document" | "receipt";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Universal search across master identity + finance + ops entities.
 * Fail-closed on empty query. Instant feel via limited parallel queries.
 */
export async function universalSearch(query: string, limit = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const like = q;
  const hits: SearchHit[] = [];

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { grantsClientId: { contains: like } },
        { email: { contains: like } },
        { emailNormalized: { contains: like.toLowerCase() } },
        { phone: { contains: like } },
        { phoneNormalized: { contains: like.replace(/\D/g, "") } },
        { firstName: { contains: like } },
        { lastName: { contains: like } },
      ],
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  for (const c of clients) {
    hits.push({
      type: "client",
      id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: `${c.grantsClientId} · ${c.email}${c.phone ? ` · ${c.phone}` : ""}`,
      href: `/clients/${c.id}`,
    });
  }

  // External identifiers (GHL / DisputeFox / Commas / etc.)
  const identifiers = await prisma.clientIdentifier.findMany({
    where: { externalId: { contains: like } },
    include: { client: true },
    take: 8,
  });
  for (const id of identifiers) {
    hits.push({
      type: "client",
      id: id.clientId,
      title: `${id.client.firstName} ${id.client.lastName}`,
      subtitle: `${id.provider} · ${id.externalId}`,
      href: `/clients/${id.clientId}`,
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [{ invoiceNumber: { contains: like } }, { description: { contains: like } }],
    },
    include: { client: true },
    take: 6,
  });
  for (const inv of invoices) {
    hits.push({
      type: "invoice",
      id: inv.id,
      title: inv.invoiceNumber,
      subtitle: `${inv.client.firstName} ${inv.client.lastName} · $${(inv.amountCents / 100).toFixed(2)} · ${inv.status}`,
      href: `/pay/${inv.invoiceNumber}`,
    });
  }

  const payments = await prisma.paymentTransaction.findMany({
    where: {
      OR: [
        { providerTransactionId: { contains: like } },
        { idempotencyKey: { contains: like } },
      ],
    },
    include: { client: true, invoice: true },
    take: 6,
  });
  for (const p of payments) {
    hits.push({
      type: "payment",
      id: p.id,
      title: `Payment ${p.providerTransactionId}`,
      subtitle: `${p.client.grantsClientId} · $${(p.amountCents / 100).toFixed(2)} · ${p.status}`,
      href: p.invoice ? `/pay/${p.invoice.invoiceNumber}` : `/clients/${p.clientId}`,
    });
  }

  const paymentRequests = await prisma.paymentRequest.findMany({
    where: {
      OR: [{ publicId: { contains: like } }, { serviceName: { contains: like } }],
    },
    include: { client: true, invoice: true },
    take: 6,
  });
  for (const pr of paymentRequests) {
    hits.push({
      type: "receipt",
      id: pr.id,
      title: pr.publicId,
      subtitle: `${pr.client.firstName} ${pr.client.lastName} · $${(pr.amountCents / 100).toFixed(2)} · ${pr.status}`,
      href: pr.invoice ? `/pay/${pr.invoice.invoiceNumber}` : `/clients/${pr.clientId}`,
    });
  }

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ title: { contains: like } }, { description: { contains: like } }],
    },
    take: 6,
  });
  for (const t of tasks) {
    hits.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `${t.status} · ${t.priority}`,
      href: t.clientId ? `/clients/${t.clientId}` : "/work",
    });
  }

  const docs = await prisma.document.findMany({
    where: {
      OR: [{ name: { contains: like } }, { category: { contains: like } }],
    },
    take: 4,
  });
  for (const d of docs) {
    hits.push({
      type: "document",
      id: d.id,
      title: d.name,
      subtitle: d.category || "Document",
      href: `/clients/${d.clientId}`,
    });
  }

  // Dedupe by href+title
  const seen = new Set<string>();
  const unique: SearchHit[] = [];
  for (const h of hits) {
    const key = `${h.type}:${h.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
    if (unique.length >= limit) break;
  }
  return unique;
}
