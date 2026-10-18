import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { resolveOtpProvider } from "@/server/otp/provider";
import { safeInviteNext } from "@/lib/team";
import { PhoneLoginForm } from "./PhoneLoginForm";

export const metadata = { title: "Sign in with WhatsApp" };

/** SF8: sign in with a WhatsApp code. Redirects to /login until the operator configures a provider (src/server/otp/provider.ts). */
export default async function PhoneLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Not configured: back to the normal login (which says "coming soon").
  if (!resolveOtpProvider(env())) redirect("/login");
  const next = safeInviteNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? "/dashboard");
  return <PhoneLoginForm next={next} />;
}
