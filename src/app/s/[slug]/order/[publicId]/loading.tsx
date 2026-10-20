export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-md px-4 py-10">
      <div className="h-10 w-2/3 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-6 h-32 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
      <div className="mt-3 h-16 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
      <div className="mt-3 h-16 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
    </div>
  );
}
