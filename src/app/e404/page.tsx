import type { Metadata } from "next";
import { PlatformNotFound } from "@/components/PlatformNotFound";

export const metadata: Metadata = { title: "404", robots: { index: false, follow: false } };

/**
 * Body of a real-status 404. The proxy (src/proxy.ts) fetches this page and answers the shopper's request with its
 * HTML and status 404 — for unknown store links and the payment return page while payments are off — because with
 * Cache Components a `notFound()` inside a page arrives after the 200 status line is already sent.
 * Opened directly it is also answered with a 404 by the proxy.
 */
export default async function E404({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  return <PlatformNotFound kind={k === "store" ? "store" : "page"} />;
}
