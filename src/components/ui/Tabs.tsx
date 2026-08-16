"use client";

import Link from "next/link";
import { useMemo } from "react";

export type TabItem = { id: string; label: string; count?: number };

export function Tabs({
  tabs,
  active,
  baseHref,
}: {
  tabs: TabItem[];
  active: string;
  baseHref: string;
}) {
  const items = useMemo(() => tabs, [tabs]);
  return (
    <div className="gc-tabs" role="tablist">
      {items.map((t) => {
        const href = t.id === "overview" ? baseHref : `${baseHref}?tab=${t.id}`;
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={`gc-tab ${isActive ? "gc-tab-active" : ""}`}
            data-active={isActive}
          >
            {t.label}
            {typeof t.count === "number" ? <span className="gc-tab-count">{t.count}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
