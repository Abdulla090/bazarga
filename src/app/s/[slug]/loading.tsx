export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="h-40 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
