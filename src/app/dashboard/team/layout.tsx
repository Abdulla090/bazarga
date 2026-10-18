import { requireOwnerPage } from "@/server/auth/session";

/** Owner-only area (src/lib/team.ts OWNER_ONLY_PATHS): staff are redirected; the actions check requireOwner too. */
export default async function OwnerOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return children;
}
