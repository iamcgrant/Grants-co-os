"use client";

import { usePathname } from "next/navigation";
import { CreditDeskUnavailable } from "@/components/disputes/CreditDeskUnavailable";

export default function CreditSegmentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() || "/credit";
  return <CreditDeskUnavailable pathname={pathname} onRetry={reset} />;
}
