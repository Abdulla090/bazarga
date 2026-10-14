"use client";
import { ClientErrorState } from "@/components/ClientErrorState";

// Root error boundary (marketing, auth, onboarding, admin, payments). Storefront and dashboard have their own.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] items-center">
      <ClientErrorState error={error} reset={reset} />
    </main>
  );
}
