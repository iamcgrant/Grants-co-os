"use client";

import { useEffect } from "react";

/**
 * Primary official-portal control. Sidebar click is the staff path; this
 * button auto-opens the same https URL on first visit to a native desk.
 * Never iframe. Sites set X-Frame-Options.
 */
export function OpenPortalLaunch({
  href,
  label = "Open portal",
  autoOpen = true,
}: {
  href: string;
  label?: string;
  autoOpen?: boolean;
}) {
  useEffect(() => {
    if (!autoOpen || !href.startsWith("https://")) return;
    const key = `gc-os-open-portal:${href}`;
    let firstVisit = true;
    try {
      if (sessionStorage.getItem(key)) firstVisit = false;
      else sessionStorage.setItem(key, "1");
    } catch {
      firstVisit = true;
    }
    if (!firstVisit) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }, [autoOpen, href]);

  if (!href.startsWith("https://")) return null;

  return (
    <a
      className="gc-btn gc-btn-gold text-xs py-2 px-3 inline-flex"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-open-portal={href}
    >
      {label}
    </a>
  );
}
