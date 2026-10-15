import Link from "next/link";

export function EmptyState({ title, help, href, cta, testId }: { title: string; help: string; href: string; cta: string; testId?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 border-y border-line py-10" data-testid={testId}>
      <p className="text-xl font-bold">{title}</p>
      <p className="text-ink-70">{help}</p>
      <Link href={href} className="btn-gold">{cta}</Link>
    </div>
  );
}
