export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="h-10 w-2/3 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-8 space-y-3">
        {[100, 92, 96, 84, 98, 70].map((w, i) => (
          <div key={i} style={{ width: `${w}%` }} className="h-4 rounded bg-slate-200/60 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
