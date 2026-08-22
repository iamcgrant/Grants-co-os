"use client";

import { useEffect, useRef, useState } from "react";
import {
  hostRefusesEmbed,
  portalDeskById,
  type PortalDeskId,
} from "@/lib/nav/portal-desks";

function iframeLooksBlocked(frame: HTMLIFrameElement): boolean {
  try {
    const href = frame.contentWindow?.location.href;
    return !href || href === "about:blank";
  } catch {
    return false;
  }
}

export function PortalDesk({ deskId }: { deskId: PortalDeskId }) {
  const desk = portalDeskById(deskId);
  const refusedUpFront = desk.embed === "refused" || hostRefusesEmbed(desk.officialUrl);
  const [blocked, setBlocked] = useState(refusedUpFront);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (refusedUpFront || blocked) return;
    const frame = frameRef.current;
    if (!frame) return;
    const timer = window.setTimeout(() => {
      if (iframeLooksBlocked(frame)) setBlocked(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [blocked, refusedUpFront]);

  const showFrame = !blocked;

  return (
    <div
      className="gc-portal-desk"
      data-portal-desk={desk.id}
      data-official-url={desk.officialUrl}
      data-embed-policy={blocked ? "refused" : desk.embed}
      data-os-href={desk.osHref}
    >
      <header className="gc-portal-desk-title">
        <h1>{desk.title}</h1>
      </header>
      <div className="gc-portal-desk-stage">
        {showFrame ? (
          <iframe
            ref={frameRef}
            className="gc-portal-desk-frame"
            src={desk.officialUrl}
            title={desk.title}
            data-browser-profile="shared"
            onError={() => setBlocked(true)}
          />
        ) : (
          <form
            className="gc-portal-stage"
            action={desk.officialUrl}
            method="get"
            target="_self"
            data-portal-stage="refused-embed"
            data-browser-profile="shared"
          >
            <p className="gc-eyebrow">Official login</p>
            <p className="gc-portal-stage-copy">
              This host refuses an in-desk embed. Continue stays in this window — no new browser tab.
            </p>
            <button type="submit" className="gc-btn gc-btn-gold">
              Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
