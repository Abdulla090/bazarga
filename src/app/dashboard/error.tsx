"use client";
import { ClientErrorState } from "@/components/ClientErrorState";

// Dashboard error state: rendered inside the dashboard chrome (the layout stays, so navigation still works).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClientErrorState error={error} reset={reset} variant="dashboard" />;
}
