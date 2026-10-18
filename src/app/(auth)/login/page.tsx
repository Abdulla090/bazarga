import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { LoginForm } from "./LoginForm";
import { safeInviteNext } from "@/lib/team";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeInviteNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? "/dashboard");
  return <LoginForm next={next} />;
}
