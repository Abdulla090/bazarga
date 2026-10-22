export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3 p-4">
      <div className="h-10 w-full max-w-sm rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-200/55 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
