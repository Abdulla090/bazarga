"use server";
import { db } from "../db";
import { requireStore } from "../auth/session";
import { enforceRateLimit } from "../auth/rate-limit";
import { consumeStudioEdit } from "../services/studio-quota";
import { toActionState, type ActionState } from "./util";

/**
 * Product Studio (SF9): spend one monthly edit for a photo cleaned up in the browser. The editor calls it after the
 * cleaned photo uploaded and before it replaces the original, so an over-quota store can't save a Studio edit.
 * (AI background removal spends its edit inside /api/studio/remove-bg instead.)
 */
export async function claimStudioEditAction(): Promise<ActionState> {
  try {
    const { store } = await requireStore();
    await enforceRateLimit(db(), `studio:local:${store.id}`, 60, 3600);
    const u = await consumeStudioEdit(db(), store.id);
    return { ok: true, data: { used: u.used, limit: u.limit, remaining: u.remaining } };
  } catch (e) {
    return toActionState(e);
  }
}
