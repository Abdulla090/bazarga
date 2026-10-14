import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { currentLocale } from "@/server/locale";
import { LEGAL_PATH, splitAgree } from "@/lib/legal-ui";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  const parts = splitAgree(await currentLocale());
  // Rendered on the server and passed in, so the legal copy never ships in the client bundle.
  const legal = (
    <p className="text-pretty text-xs leading-relaxed text-ink-70" data-testid="signup-legal">
      {parts.map((part, i) =>
        part.link ? (
          <Link key={i} href={LEGAL_PATH[part.link]} className="font-medium text-ink underline underline-offset-2">{part.text}</Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
  return <SignupForm legal={legal} />;
}
