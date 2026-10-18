"use server";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { env } from "../env";
import { requireOwner } from "../auth/session";
import { assertFeature } from "../plan-gate";
import { enforceRateLimit } from "../auth/rate-limit";
import { recordAudit } from "../audit";
import { addDomainToVercel, setCustomDomain, verifyCustomDomain } from "../services/custom-domain";
import { domainTargets } from "@/lib/custom-domain";
import { resolveDomainConfig } from "@/lib/domains";
import { toActionState, type ActionState } from "./util";

function platformHosts(): string[] {
  const e = env();
  const app = (() => { try { return new URL(e.APP_URL).hostname; } catch { return ""; } })();
  return [app, resolveDomainConfig(e).rootDomain ?? ""];
}

/** Save the store's custom domain (Business+, owner only). Empty clears it. */
export async function saveDomainAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { store, user } = await requireOwner();
    assertFeature(store, "domain");
    const host = await setCustomDomain(db(), store.id, String(fd.get("domain") ?? ""), platformHosts());
    let vercel: string = "manual";
    if (host) {
      const e = env();
      vercel = await addDomainToVercel(host, { token: e.VERCEL_TOKEN, projectId: e.VERCEL_PROJECT_ID, teamId: e.VERCEL_TEAM_ID });
    }
    await recordAudit(store.id, user.id, "store.domain", host ? "set" : "cleared");
    revalidatePath("/dashboard/settings/domain");
    return { ok: true, data: { host: host ?? "", vercel } };
  } catch (e) {
    return toActionState(e);
  }
}

/** Server DNS lookup; 6 checks a minute per store. */
export async function verifyDomainAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  try {
    const { store } = await requireOwner();
    assertFeature(store, "domain");
    await enforceRateLimit(db(), `domain:verify:${store.id}`, 6, 60);
    const r = await verifyCustomDomain(db(), store.id, domainTargets(env()));
    revalidatePath("/dashboard/settings/domain");
    return { ok: r.ok, error: r.ok ? undefined : "domain_not_pointing", data: { host: r.host, found: r.found.join(", ") } };
  } catch (e) {
    return toActionState(e);
  }
}
