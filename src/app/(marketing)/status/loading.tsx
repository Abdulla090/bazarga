export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="h-10 w-2/3 max-w-sm rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-8 h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
      <div className="mt-4 h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
    </div>
  );
}
