import Link from "next/link";
import { portalDeskById, type PortalDeskId } from "@/lib/nav/portal-desks";

const RETURN_TO_OS_HREF = "/home";

/**
 * Vendor login stays in the desk pane. Never top-level navigate, never a new tab.
 * The OS sidebar and this desk remain mounted even when a host sends X-Frame-Options.
 */
export function PortalDesk({ deskId }: { deskId: PortalDeskId }) {
  const desk = portalDeskById(deskId);

  return (
    <div
      className="gc-portal-desk"
      data-portal-desk={desk.id}
      data-official-url={desk.officialUrl}
      data-embed-policy="pane"
      data-os-href={desk.osHref}
    >
      <header className="gc-portal-desk-title">
        <h1>{desk.title}</h1>
        <Link href={RETURN_TO_OS_HREF} className="gc-portal-return" data-return-to-os="home">
          Return to OS
        </Link>
      </header>
      <div className="gc-portal-desk-stage">
        <iframe
          className="gc-portal-desk-frame"
          src={desk.officialUrl}
          title={desk.title}
          data-browser-profile="shared"
        />
      </div>
    </div>
  );
}
