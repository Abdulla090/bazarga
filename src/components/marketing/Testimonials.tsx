import { rv, Words } from "./reveal";
import type { Testimonial } from "@/lib/testimonials";

/** Real approved quotes only. Renders nothing when there are none (no placeholder text, ever). */
export function Testimonials({ items, eyebrow, title }: { items: Testimonial[]; eyebrow: string; title: string }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-paper py-14" aria-labelledby="quotes-title" data-testid="testimonials">
      <div className="container-page">
        <p className="mk-eyebrow" {...rv("e")}>{eyebrow}</p>
        <h2 id="quotes-title" className="mt-2 text-3xl font-extrabold" {...rv("h", 60)}><Words text={title} /></h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((q, i) => (
            <li key={q.id} className="card bg-white" {...rv("c", 160 + i * 120)}>
              <blockquote className="text-[15px] leading-relaxed text-ink">“{q.quote}”</blockquote>
              <p className="mt-4 text-sm font-semibold">{q.author}</p>
              {(q.role || q.city) && <p className="text-sm text-ink-70">{[q.role, q.city].filter(Boolean).join(" · ")}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
