import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  portalDeskById,
  portalDeskCanEmbed,
  type PortalDeskDef,
  type PortalDeskId,
} from "@/lib/nav/portal-desks";

const RETURN_TO_OS_HREF = "/home";

/**
 * Vendor login stays in the desk pane when the host allows a third-party
 * iframe. Hosts that send X-Frame-Options / frame-ancestors keep the luxury
 * Grants & Co desk on this OS tab. Staff may click Open in browser to open
 * the official login in a new tab. Never auto-navigate, never send this OS
 * tab to a vendor origin, never restore a refused iframe, never invent a proxy.
 */
export function PortalDesk({ deskId }: { deskId: PortalDeskId }) {
  const desk = portalDeskById(deskId);
  const showFrame = portalDeskCanEmbed(desk);

  return (
    <div
      className="gc-portal-desk"
      data-portal-desk={desk.id}
      data-official-url={desk.officialUrl}
      data-embed-policy={showFrame ? "pane" : "desk"}
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
            className="gc-portal-desk-frame"
            src={desk.officialUrl}
            title={desk.title}
            data-browser-profile="shared"
          />
        ) : (
          <PortalLuxuryStage desk={desk} />
        )}
      </div>
    </div>
  );
}

function PortalLuxuryStage({ desk }: { desk: PortalDeskDef }) {
  return (
    <div className="gc-portal-stage" data-portal-stage="desk" data-browser-profile="shared">
      <div className="gc-portal-blotter">
        <BrandLogo href={null} size="md" />
        <p className="gc-eyebrow">Grants &amp; Co</p>
        <p className="gc-portal-stage-opening">{desk.title}</p>
        <p className="gc-portal-stage-copy">
          This product keeps its login on its own host. There is no official embed or partner
          URL, and Grants &amp; Co does not invent a proxy or a key. The OS tab stays here.
        </p>
        <p className="gc-portal-official-url" data-official-address={desk.officialUrl}>
          {desk.officialUrl}
        </p>
        {desk.officialUrl.startsWith("https://") ? (
          <div className="gc-portal-stage-actions">
            <a
              className="gc-btn gc-btn-gold"
              href={desk.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-open-in-browser={desk.officialUrl}
            >
              Open in browser
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
