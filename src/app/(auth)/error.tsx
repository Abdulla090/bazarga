"use client";
import { ClientErrorState } from "@/components/ClientErrorState";

// Error boundary for this area. There is deliberately no root src/app/error.tsx: it would ship in every storefront's
// first-load JS (storefronts have their own lean boundary, src/app/s/[slug]/error.tsx). Root-layout crashes are
// caught by src/app/global-error.tsx.
export default function AreaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] items-center">
      <ClientErrorState error={error} reset={reset} />
    </main>
  );
}
