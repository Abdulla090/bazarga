import Link from "next/link";

export type ErrorAction = { href: string; label: string; primary?: boolean };

/**
 * One on-brand error state for every surface (platform 404, unknown store, dashboard 404): a large ink→blue numeral,
 * one statement, one sentence, at most two actions. Server component, no client JS. Blue #2563EB + ink only.
 */
export function ErrorState({
  code = "404",
  eyebrow,
  title,
  body,
  actions,
  help,
  testId,
  as: Heading = "h1",
}: {
  code?: string;
  eyebrow: string;
  title: string;
  body: string;
  actions: ErrorAction[];
  help?: { href: string; label: string; text: string };
  testId?: string;
  as?: "h1" | "h2";
}) {
  return (
    <section className="mx-auto grid w-full max-w-xl justify-items-center gap-5 px-5 py-14 text-center sm:py-20" data-testid={testId} aria-labelledby="error-state-title">
      <p
        aria-hidden="true"
        dir="ltr"
        className="num select-none bg-gradient-to-b from-ink via-ink to-[#2563EB] bg-clip-text text-[clamp(5.5rem,24vw,9.5rem)] font-extrabold leading-none tracking-tighter text-transparent"
      >
        {code}
      </p>
      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-70">
        <span className="size-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
        {eyebrow}
      </p>
      <Heading id="error-state-title" className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {title}
      </Heading>
      <p className="max-w-md text-pretty text-base leading-relaxed text-ink-70">{body}</p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        {actions.map((a) => (
          <Link key={a.href + a.label} href={a.href} className={`${a.primary ? "btn-gold" : "btn-ghost"} min-h-12 justify-center px-7`}>
            {a.label}
          </Link>
        ))}
      </div>
      {help ? (
        <p className="mt-2 text-sm text-ink-70">
          {help.text}{" "}
          <a href={help.href} className="font-medium text-[#2563EB] underline-offset-4 hover:underline" dir="ltr">
            {help.label}
          </a>
        </p>
      ) : null}
    </section>
  );
}

export const SUPPORT_EMAIL = "founder@kurdistanai.app";
