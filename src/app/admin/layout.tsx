import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/admin";
import { IntlProvider } from "@/components/IntlProvider";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } };

/**
 * Owner console (docs/ADMIN.md). Every page below calls requireAdmin() itself as well: the layout check is the
 * first wall, not the only one (a layout does not re-run on every client navigation). Non-admins get a 404.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <IntlProvider>
      <AdminShell admin={{ email: admin.email, role: admin.role }}>{children}</AdminShell>
    </IntlProvider>
  );
}
