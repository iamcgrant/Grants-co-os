"use client";

import { useEffect, useState } from "react";
import { LIVE_VERCEL_APP_ORIGIN, PERMANENT_OS_ORIGIN } from "@/lib/access/origins";

type HealthPayload = {
  ok?: boolean;
  databaseReason?: string | null;
};

export function LoginAccessBanner() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((res) => res.json() as Promise<HealthPayload>)
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ ok: false, databaseReason: "Health check failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const blocked = health !== null && health.ok === false;
  const onVercelFallback =
    typeof window !== "undefined" && window.location.origin === LIVE_VERCEL_APP_ORIGIN;

  return (
    <div className="mb-8 space-y-3 text-sm leading-relaxed">
      {blocked ? (
        <p
          className="rounded-md border border-[var(--gc-gold)]/40 bg-black/40 px-4 py-3 text-[var(--gc-gold)]"
          role="status"
        >
          This deployment cannot sign anyone in until Neon Postgres is connected
          {health?.databaseReason ? ` — ${health.databaseReason}` : "."}
        </p>
      ) : null}
      <p className="text-center text-[var(--gc-muted)]">
        Permanent address:{" "}
        <a href={`${PERMANENT_OS_ORIGIN}/login`} className="text-[var(--gc-gold)]">
          os.grantandconsultants.com
        </a>
        {!onVercelFallback ? (
          <>
            {" "}
            · If that page does not open, use{" "}
            <a href={`${LIVE_VERCEL_APP_ORIGIN}/login`} className="text-[var(--gc-gold)]">
              the live Vercel login
            </a>
          </>
        ) : null}
        .{" "}
        <a href="/access" className="text-[var(--gc-gold)]">
          Access help
        </a>
      </p>
    </div>
  );
}
