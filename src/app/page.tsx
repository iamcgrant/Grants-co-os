import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal");
  redirect("/home");
}
