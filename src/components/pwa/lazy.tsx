"use client";
import { Suspense, lazy } from "react";

/*
 * Device-only dashboard extras, split out of the first-load bundle. React.lazy (not next/dynamic): no loadable
 * runtime in the bundle. Both components render nothing device-specific until mounted, so SSR is harmless.
 */
const InstallPrompt = lazy(() => import("./InstallPrompt").then((m) => ({ default: m.InstallPrompt })));
const PushToggle = lazy(() => import("@/components/dashboard/PushToggle").then((m) => ({ default: m.PushToggle })));

export function LazyInstallPrompt() {
  return (
    <Suspense fallback={null}>
      <InstallPrompt />
    </Suspense>
  );
}

export function LazyPushToggle(props: { vapidPublicKey: string }) {
  return (
    <Suspense fallback={<div className="card h-32 animate-pulse" aria-hidden />}>
      <PushToggle {...props} />
    </Suspense>
  );
}
