import type { Metadata } from "next";
import { LosBrandHeader } from "@/components/los/LosBrandHeader";

export const metadata: Metadata = {
  title: "Mortgage Application | Grants & Co",
  description: "Apply for mortgage loan origination services with Grants & Co Consultants.",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--gc-charcoal)] text-[var(--gc-text)]">
      <div className="border-b border-[var(--gc-border)] px-5 py-4 max-w-3xl mx-auto">
        <LosBrandHeader />
      </div>
      <main className="px-5 py-6 max-w-3xl mx-auto">{children}</main>
    </div>
  );
}
