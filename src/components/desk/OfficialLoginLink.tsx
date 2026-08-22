export function OfficialLoginLink({
  href,
  label = "Open login",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a className="gc-btn gc-btn-gold text-xs py-2 px-3 inline-flex" href={href}>
      {label}
    </a>
  );
}
