import type { Metadata } from "next";
import { PlatformNotFound } from "@/components/PlatformNotFound";

export const metadata: Metadata = { title: "404", robots: { index: false, follow: false } };

export default function NotFound() {
  return <PlatformNotFound />;
}
