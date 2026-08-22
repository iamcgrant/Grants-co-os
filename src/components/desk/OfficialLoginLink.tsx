export function OfficialLoginLink({
  href,
  label = "Open login",
  action,
}: {
  href: string;
  label?: string;
  action?: string;
}) {
  return (
    <a
      className="gc-btn gc-btn-gold text-xs py-2 px-3 inline-flex"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-official-login={href}
      data-official-action={action ?? label}
    >
      {label}
    </a>
  );
}
