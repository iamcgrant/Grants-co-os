import { prisma } from "@/lib/db/prisma";
import { formatLoanNumber } from "./loan-number";

/** Allocate the next internal GC-LN file number from IdSequence `gc_loan`. */
export async function nextLoanNumber(): Promise<{ value: number; loanNumber: string }> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.idSequence.upsert({
      where: { name: "gc_loan" },
      create: { name: "gc_loan", value: 1 },
      update: { value: { increment: 1 } },
    });
    return { value: seq.value, loanNumber: formatLoanNumber(seq.value) };
  });
}
