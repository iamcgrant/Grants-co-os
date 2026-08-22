import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loginHref } from "@/lib/auth/return-to";
import { StaffShellClient } from "@/components/layout/StaffShellClient";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    const headerStore = await headers();
    redirect(loginHref(headerStore.get("x-gc-pathname")));
  }
  if (user.role === "CLIENT") redirect("/portal");

  return <StaffShellClient user={user}>{children}</StaffShellClient>;
}
