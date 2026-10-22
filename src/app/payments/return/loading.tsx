export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-md px-4 py-20">
      <div className="mx-auto h-14 w-14 rounded-full bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mx-auto mt-6 h-7 w-2/3 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mx-auto mt-3 h-4 w-1/2 rounded-lg bg-slate-200/60 motion-safe:animate-pulse" />
    </div>
  );
}
