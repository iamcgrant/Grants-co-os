"use client";

import Link from "next/link";
import { DeskEmptyState } from "@/components/desk/DeskEmptyState";
import { channelCatalog, channelFromPathname, type DisputeChannel } from "@/lib/disputes/channels";

/**
 * Last-resort native desk. Used when a credit route throws during load/render.
 * Official portal is last-step only. No scrape.
 */
export function CreditDeskUnavailable({
  channel,
  pathname,
  onRetry,
}: {
  channel?: DisputeChannel | null;
  pathname?: string;
  onRetry?: () => void;
}) {
  const resolved = channel ?? (pathname ? channelFromPathname(pathname) : null);
  const catalog = resolved ? channelCatalog(resolved) : null;
  const label = catalog?.label ?? "Credit desk";

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">{catalog?.eyebrow ?? "Credit & Disputes"}</p>
      <h1 className="text-4xl md:text-5xl mb-2">{label}</h1>
      <p className="gc-section-sub mb-8 max-w-3xl">
        {catalog?.honesty ?? "Native Grants OS desk. Official portal is a last submit step only. No scrape."}
      </p>
      <DeskEmptyState
        detail="This desk could not load. Official portal is last-step only — this desk does not scrape."
        nextAction="Stay in Grants OS. Open login is a last step only when staff need the official site."
        loginUrl={catalog?.officialSubmitUrl}
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/home" className="gc-btn gc-btn-outline text-xs py-2 px-3">
          Back to Command Center
        </Link>
        {onRetry ? (
          <button type="button" className="gc-btn gc-btn-gold text-xs py-2 px-3" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
