import { LoginForm } from "@/components/auth/LoginForm";
import { safeStaffReturnTo } from "@/lib/auth/return-to";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm returnTo={safeStaffReturnTo(params.returnTo)} />;
}
