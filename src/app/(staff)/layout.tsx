import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { StaffShellClient } from "@/components/layout/StaffShellClient";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal");

  return <StaffShellClient user={user}>{children}</StaffShellClient>;
}
