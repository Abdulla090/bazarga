import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * E2E audit (docs/E2E-AUDIT.md, issue A1): React 19 resets `<form action>` after every submission, so a server-side
 * error (wrong password, taken email, invalid price) wiped everything the user typed. Every action form that has
 * typed fields must also pass `onSubmit={keep}` (src/lib/use-keep-values.ts).
 */
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".tsx") ? [join(d, f)] : []));
// Button-only / hidden-input forms: nothing typed to lose.
const NO_TYPED_FIELDS = ["VerifyForm.tsx", "CheckPaymentButton.tsx", "OnlinePaymentsCard.tsx", "ShowcaseToggle.tsx", "VerifyEmailBanner.tsx"];

describe("action forms keep typed values on a server error", () => {
  const files = walk("src").filter((f) => readFileSync(f, "utf8").includes("useActionState") && !NO_TYPED_FIELDS.some((n) => f.endsWith(n)));
  it("finds the forms", () => expect(files.length).toBeGreaterThanOrEqual(14));
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, "utf8");
      // Each <form …>…</form> wired to the action state; skip the ones that only carry hidden inputs (unblock/block toggles).
      const forms = [...src.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]).filter((f) => /action=\{(action|formAction)\}/.test(f));
      const typed = forms.filter((f) => /<(input(?![^>]*type="hidden")|textarea|select|Field)\b/.test(f));
      expect(typed.length, f).toBeGreaterThan(0);
      for (const form of typed) expect(form.slice(0, form.indexOf(">", form.indexOf("action=")) + 1), f).toContain("onSubmit={keep}");
      expect(src).toContain('from "@/lib/use-keep-values"');
    });
  }
  it("the hook dispatches inside a transition and prevents the native submit", () => {
    const hook = readFileSync("src/lib/use-keep-values.ts", "utf8");
    expect(hook).toContain("e.preventDefault()");
    expect(hook).toContain("startTransition(() => formAction(fd))");
    expect(hook).toMatch(/new FormData\(e\.currentTarget, submitter\)/);
  });
});
