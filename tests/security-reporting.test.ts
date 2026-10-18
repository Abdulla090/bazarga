import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp } from "@/server/csp";
import { parseCspReport } from "@/lib/csp-report";
import { log, shouldSendHook, webhookPayload } from "@/server/logger";

describe("CSP reporting + worker/manifest", () => {
  const csp = buildCsp({ nonce: "abc", isDev: false });
  it("declares worker-src, manifest-src and both report directives", () => {
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
  it("next.config sends Reporting-Endpoints for report-to", () => {
    expect(readFileSync("next.config.ts", "utf8")).toContain(`key: "Reporting-Endpoints", value: 'csp="/api/csp-report"'`);
  });
  it("parses legacy and Reporting API bodies, keeping origins and paths only", () => {
    const legacy = parseCspReport({ "csp-report": { "document-uri": "https://b.app/s/x?token=SECRET", "violated-directive": "img-src", "effective-directive": "img-src", "blocked-uri": "https://evil.example/p.png?q=SECRET", "line-number": 3 } });
    expect(legacy).toEqual([{ directive: "img-src", blocked: "https://evil.example", page: "/s/x", line: 3 }]);
    const batch = parseCspReport([
      { type: "csp-violation", body: { documentURL: "https://b.app/", effectiveDirective: "script-src-elem", blockedURL: "inline", sourceFile: "https://b.app/_next/x.js" } },
      { type: "deprecation", body: {} },
    ]);
    expect(batch).toEqual([{ directive: "script-src-elem", blocked: "inline", page: "/", source: "https://b.app" }]);
    expect(JSON.stringify([legacy, batch])).not.toContain("SECRET");
    expect(parseCspReport("x")).toEqual([]);
    expect(parseCspReport({})).toEqual([]);
  });
  it("the report route is rate limited and always answers 204", () => {
    const src = readFileSync("src/app/api/csp-report/route.ts", "utf8");
    expect(src).toContain("enforceRateLimit(");
    expect(src.match(/status: 204/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("error webhook hook (LOG_WEBHOOK_URL)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const ev = { level: "error", msg: "request.error", err: { message: "boom" }, route: "/s/[slug]", digest: "123" };
  it("formats Discord and Slack messages, passes JSON elsewhere", () => {
    expect(webhookPayload("https://discord.com/api/webhooks/1/x", ev)).toEqual({ content: "Bazarga error: request.error — boom (/s/[slug]) [123]" });
    expect(webhookPayload("https://hooks.slack.com/services/x", ev)).toEqual({ text: "Bazarga error: request.error — boom (/s/[slug]) [123]" });
    expect(webhookPayload("https://in.logs.example/x", ev)).toBe(ev);
  });
  it("caps sends per minute", () => {
    const t = Date.parse("2030-01-01T00:00:00Z");
    let n = 0;
    for (let i = 0; i < 30; i++) if (shouldSendHook(t)) n++;
    expect(n).toBe(20);
    expect(shouldSendHook(t + 60_000)).toBe(true);
  });
  it("posts redacted error lines only when the env is set", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("error", "x.failed", { password: "hunter2" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("LOG_WEBHOOK_URL", "https://in.logs.example/hook");
    log("error", "x.failed", { password: "hunter2" });
    log("warn", "x.warned", {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("x.failed");
    expect(body).not.toContain("hunter2");
  });
});
