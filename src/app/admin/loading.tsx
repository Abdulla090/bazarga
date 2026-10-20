export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-4 p-4">
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/50 motion-safe:animate-pulse" />
    </div>
  );
}
