import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { listMembers, teamUsage } from "@/server/services/team";
import { removeMemberAction } from "@/server/actions/team";
import { TeamInviteForm } from "@/components/dashboard/TeamInviteForm";
import { PlanLock } from "@/components/dashboard/PlanLock";
import { TEAM_LIMIT, hasFeature, normalizePlan } from "@/lib/plans";

export default async function TeamPage() {
  const { store, user } = await requireOwnerPage();
  const t = await getTranslations("team");
  const plan = normalizePlan(store.plan);
  if (!hasFeature(plan, "team")) {
    return (
      <div className="grid max-w-2xl gap-4">
        <h1 className="t-headline">{t("title")}</h1>
        <PlanLock min="pro" title={t("lockTitle")} body={t("lockBody", { pro: TEAM_LIMIT.pro, business: TEAM_LIMIT.business, max: TEAM_LIMIT.max })} />
      </div>
    );
  }
  const [members, usage] = await Promise.all([listMembers(db(), store.id), teamUsage(db(), store.id)]);
  const now = new Date();
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-1">
        <h1 className="t-headline">{t("title")}</h1>
        <p className="text-ink-70">{t("sub")}</p>
        <p className="num text-sm text-ink-70" data-testid="team-usage">{t("seats", { used: usage.used, limit: usage.limit })}</p>
      </div>
      <ul className="grid gap-2" data-testid="team-list">
        <li className="card flex flex-wrap items-center gap-3">
          <span className="grid min-w-0 flex-1 gap-0.5"><span className="truncate font-bold">{user.name}</span><span className="num truncate text-sm text-ink-70" dir="ltr">{user.email}</span></span>
          <span className="rounded-full border border-line px-3 py-1 text-[13px] text-ink/70">{t("owner")}</span>
        </li>
        {members.map((m) => {
          const expired = !m.acceptedAt && m.expiresAt && m.expiresAt < now;
          return (
            <li key={m.id} className="card flex flex-wrap items-center gap-3" data-testid="team-member">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-bold">{m.name ?? m.email}</span>
                <span className="num truncate text-sm text-ink-70" dir="ltr">{m.email}</span>
              </span>
              <span className="rounded-full border border-line px-3 py-1 text-[13px] text-ink/70">{m.acceptedAt ? t("staff") : expired ? t("expired") : t("pending")}</span>
              <form action={removeMemberAction}>
                <input type="hidden" name="memberId" value={m.id} />
                <button className="btn-ghost btn-sm min-h-11" data-testid="team-remove">{m.acceptedAt ? t("remove") : t("cancelInvite")}</button>
              </form>
            </li>
          );
        })}
      </ul>
      <TeamInviteForm disabled={usage.used >= usage.limit} />
      {usage.used >= usage.limit && <p className="hint" data-testid="team-full">{t("full")}</p>}
      <p className="hint">{t("rolesHint")}</p>
    </div>
  );
}
