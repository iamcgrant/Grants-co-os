/**
 * Secondary official-login control for leftover native desks.
 * Same window only — sidebar portals are the staff path.
 */
export function OpenPortalLaunch({
  href,
  label = "Open portal",
}: {
  href: string;
  label?: string;
  autoOpen?: boolean;
}) {
  if (!href.startsWith("https://")) return null;

  return (
    <a className="gc-btn gc-btn-gold text-xs py-2 px-3 inline-flex" href={href} data-open-portal={href}>
      {label}
    </a>
  );
}
