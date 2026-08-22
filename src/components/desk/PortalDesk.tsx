"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  hostRefusesEmbed,
  portalDeskById,
  type PortalDeskDef,
  type PortalDeskId,
} from "@/lib/nav/portal-desks";

const RETURN_TO_OS_HREF = "/home";

function iframeLooksBlocked(frame: HTMLIFrameElement): boolean {
  try {
    const href = frame.contentWindow?.location.href;
    return !href || href === "about:blank";
  } catch {
    return false;
  }
}

function cameBackFromVendor(officialUrl: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.referrer.startsWith(new URL(officialUrl).origin);
  } catch {
    return false;
  }
}

function PortalContinue({ desk }: { desk: PortalDeskDef }) {
  const [autoLeave, setAutoLeave] = useState(true);

  useEffect(() => {
    if (cameBackFromVendor(desk.officialUrl)) {
      setAutoLeave(false);
      return;
    }
    const timer = window.setTimeout(() => {
      window.location.assign(desk.officialUrl);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [desk.officialUrl]);

  return (
    <div
      className="gc-portal-stage"
      data-portal-stage="continue"
      data-auto-continue={autoLeave ? "1" : "0"}
      data-browser-profile="shared"
    >
      <p className="gc-eyebrow">Grants &amp; Co</p>
      <p className="gc-portal-stage-opening">Opening {desk.title}</p>
      <div className="gc-portal-stage-actions">
        <Link href={RETURN_TO_OS_HREF} className="gc-btn gc-btn-outline" data-return-to-os="home">
          Return to OS
        </Link>
        <a className="gc-btn gc-btn-gold" href={desk.officialUrl} target="_self" data-portal-continue={desk.officialUrl}>
          Continue
        </a>
      </div>
    </div>
  );
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
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [blocked, refusedUpFront]);

  const showFrame = !blocked;

  return (
    <div
      className="gc-portal-desk"
      data-portal-desk={desk.id}
      data-official-url={desk.officialUrl}
      data-embed-policy={blocked ? "continue" : desk.embed}
      data-os-href={desk.osHref}
    >
      <header className="gc-portal-desk-title">
        <h1>{desk.title}</h1>
        <Link href={RETURN_TO_OS_HREF} className="gc-portal-return" data-return-to-os="home">
          Return to OS
        </Link>
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
          <PortalContinue desk={desk} />
        )}
      </div>
    </div>
  );
}
