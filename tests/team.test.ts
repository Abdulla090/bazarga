import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stores } from "@/server/db/schema";
import { signUp } from "@/server/auth/service";
import { acceptInvite, findInvite, inviteMember, listMembers, removeMember, teamUsage } from "@/server/services/team";
import { listAccessibleStores, resolveCurrentStore } from "@/server/services/store-access";
import { isOwnerOnlyPath, safeInviteNext } from "@/lib/team";
import { seller, testDb } from "./support/db";

let database: Db;
beforeAll(async () => { database = await testDb(); });
const setPlan = (id: string, plan: string) => database.update(stores).set({ plan }).where(eq(stores.id, id));
let n = 0;
const person = async () => signUp(database, { name: `Staff ${++n}`, email: `staff${n}-${Date.now()}@example.com`, password: "correct horse battery", locale: "ku" });

describe("team members (server-side seats + permissions)", () => {
  it("Free has no team", async () => {
    const s = await seller(database, "tm-free");
    await expect(inviteMember(database, s.store.id, s.user.id, "a@example.com")).rejects.toThrow("plan_feature");
  });

  it("Pro: 2 seats (invites count), then plan_limit_team; Business lifts to 5", async () => {
    const s = await seller(database, "tm-pro");
    await setPlan(s.store.id, "pro");
    await inviteMember(database, s.store.id, s.user.id, "One@Example.com");
    await inviteMember(database, s.store.id, s.user.id, "two@example.com");
    await expect(inviteMember(database, s.store.id, s.user.id, "three@example.com")).rejects.toThrow("plan_limit_team");
    // re-inviting a pending address refreshes it without a new seat
    await expect(inviteMember(database, s.store.id, s.user.id, "one@example.com")).resolves.toMatchObject({ email: "one@example.com" });
    expect(await teamUsage(database, s.store.id)).toEqual({ used: 2, limit: 2 });
    await setPlan(s.store.id, "business");
    expect((await teamUsage(database, s.store.id)).limit).toBe(5);
    await setPlan(s.store.id, "max");
    expect((await teamUsage(database, s.store.id)).limit).toBe(10);
  });

  it("invite → accept (matching email only) → store is accessible as staff → remove revokes", async () => {
    const s = await seller(database, "tm-flow");
    await setPlan(s.store.id, "pro");
    const staff = await person();
    const stranger = await person();
    const inv = await inviteMember(database, s.store.id, s.user.id, staff.email);
    expect(await findInvite(database, inv.token)).toMatchObject({ storeId: s.store.id, email: staff.email });
    await expect(acceptInvite(database, inv.token, stranger)).rejects.toThrow("invite_wrong_account");
    await acceptInvite(database, inv.token, staff);
    expect(await findInvite(database, inv.token)).toBeNull(); // single use
    const acc = await listAccessibleStores(database, staff.id);
    expect(acc).toHaveLength(1);
    expect(acc[0]).toMatchObject({ role: "staff" });
    expect((await resolveCurrentStore(database, staff.id, s.store.id))?.role).toBe("staff");
    expect(await listAccessibleStores(database, stranger.id)).toHaveLength(0);
    const [m] = await listMembers(database, s.store.id);
    await removeMember(database, s.store.id, m!.id);
    expect(await listAccessibleStores(database, staff.id)).toHaveLength(0);
  });

  it("expired invites can't be accepted; owners can't invite themselves; removal is tenant-scoped", async () => {
    const s = await seller(database, "tm-exp");
    const other = await seller(database, "tm-exp-o");
    await setPlan(s.store.id, "pro");
    const staff = await person();
    const inv = await inviteMember(database, s.store.id, s.user.id, staff.email, new Date(Date.now() - 8 * 864e5));
    await expect(acceptInvite(database, inv.token, staff)).rejects.toThrow("invalid_or_expired_token");
    await expect(inviteMember(database, s.store.id, s.user.id, s.user.email)).rejects.toThrow("already_member");
    await expect(removeMember(database, other.store.id, inv.id)).rejects.toThrow();
  });

  it("post-login redirect only allows invite links", () => {
    expect(safeInviteNext("/invite/abcdefghijklmnopqrstuvwxyz012345")).toBe("/invite/abcdefghijklmnopqrstuvwxyz012345");
    expect(safeInviteNext("https://evil.example/invite/x")).toBeNull();
    expect(safeInviteNext("//evil.example")).toBeNull();
    expect(safeInviteNext("/dashboard")).toBeNull();
  });

  it("owner-only areas: page guards + action checks", () => {
    expect(isOwnerOnlyPath("/dashboard/settings/seo")).toBe(true);
    expect(isOwnerOnlyPath("/dashboard/orders")).toBe(false);
    for (const d of ["settings", "payments", "delivery", "theme", "upgrade", "team"]) {
      expect(readFileSync(`src/app/dashboard/${d}/layout.tsx`, "utf8")).toContain("requireOwnerPage()");
    }
    const dash = readFileSync("src/server/actions/dashboard.ts", "utf8");
    for (const fn of ["updateStoreAction", "saveThemeAction", "savePixelsAction", "togglePaymentAction", "addZoneAction"]) {
      const body = dash.slice(dash.indexOf(`export async function ${fn}(`)).slice(0, 400);
      expect(body, fn).toContain("await requireOwner()");
    }
    for (const f of ["theme.ts", "upgrade.ts", "team.ts", "seo.ts", "gateway-payments.ts"]) expect(readFileSync(`src/server/actions/${f}`, "utf8")).toContain("requireOwner()");
    expect(readdirSync("drizzle")).toContain("0026_store_members.sql");
  });
});
