import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** ?src= attribution is saved by the server response too, so a tap before hydration doesn't lose it. */
describe("proxy source cookie", () => {
  const doc = (url: string) =>
    new NextRequest(url, { headers: { accept: "text/html", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", host: new URL(url).host } });

  it("sets the per-store cookie for an allowlisted ?src on a storefront page", async () => {
    const res = await proxy(doc("http://localhost:3000/s/hawler-bazaar/p/abc?src=TikTok"));
    const c = res!.cookies.get("bzsrc_hawler-bazaar");
    expect(c?.value).toBe("tiktok");
    expect(c?.httpOnly).toBeFalsy();
    expect(c?.maxAge).toBe(7 * 86_400);
  });

  it("ignores unknown sources, non-store pages and non-document requests", async () => {
    expect((await proxy(doc("http://localhost:3000/s/hawler-bazaar?src=evil")))!.cookies.get("bzsrc_hawler-bazaar")).toBeUndefined();
    expect((await proxy(doc("http://localhost:3000/pricing?src=tiktok")))!.cookies.getAll()).toEqual([]);
    const rsc = new NextRequest("http://localhost:3000/s/hawler-bazaar?src=tiktok", { headers: { rsc: "1", accept: "text/x-component" } });
    expect((await proxy(rsc))!.cookies.get("bzsrc_hawler-bazaar")).toBeUndefined();
  });
});
