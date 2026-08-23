/**
 * LosBrandHeader — spec component. Do NOT generate a logo. Do NOT invent SVG.
 *
 * Production host (grants-co-os): use existing BrandLogo wrapping public/brand/logo.png.
 * This drop-in references that path only.
 *
 * Placement: application header, disclosures, confirmation, borrower dashboard.
 *
 * Sizing (never stretch or crop; height auto; object-fit: contain):
 * - desktop: width 180px
 * - tablet:  width 148px
 * - mobile:  width 120px
 */

type BrandLogoProps = {
  src?: string;
  alt?: string;
  className?: string;
};

/** Stand-in that matches the OS BrandLogo contract (src = /brand/logo.png). */
function BrandLogo({
  src = "/brand/logo.png",
  alt = "Grants & Co",
  className,
}: BrandLogoProps) {
  return <img src={src} alt={alt} className={className} />;
}

export function LosBrandHeader() {
  return (
    <header
      className="los-brand-header"
      data-placements="application-header,disclosures,confirmation,borrower-dashboard"
    >
      <BrandLogo className="los-brand-header__logo" src="/brand/logo.png" alt="Grants & Co" />
      <style>{`
        .los-brand-header__logo {
          display: block;
          width: 180px;
          max-width: 180px;
          height: auto;
          object-fit: contain;
          object-position: left center;
        }
        @media (max-width: 1024px) {
          .los-brand-header__logo { width: 148px; max-width: 148px; }
        }
        @media (max-width: 640px) {
          .los-brand-header__logo { width: 120px; max-width: 120px; }
        }
      `}</style>
    </header>
  );
}

export default LosBrandHeader;
