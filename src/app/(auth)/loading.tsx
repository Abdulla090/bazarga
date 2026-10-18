export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-sm px-4 py-16">
      <div className="h-8 w-1/2 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-6 h-12 rounded-xl bg-slate-200/60 motion-safe:animate-pulse" />
      <div className="mt-3 h-12 rounded-xl bg-slate-200/60 motion-safe:animate-pulse" />
      <div className="mt-3 h-12 rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
    </div>
  );
}
