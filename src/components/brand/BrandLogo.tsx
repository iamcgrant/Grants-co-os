import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const heights = { sm: 28, md: 36, lg: 48 } as const;

/** Official Grants & Co wordmark from grantandconsultants.com */
export function BrandLogo({ href = "/home", size = "md", className = "" }: Props) {
  const h = heights[size];
  const img = (
    <Image
      src="/brand/logo.png"
      alt="Grants & Co Consultants"
      width={Math.round(h * 3)}
      height={h}
      className={className}
      style={{ height: h, width: "auto" }}
      priority={size !== "sm"}
    />
  );
  if (href == null) return img;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Grants & Co OS home">
      {img}
    </Link>
  );
}
