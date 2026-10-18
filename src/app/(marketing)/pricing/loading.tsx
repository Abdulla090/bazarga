export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-5xl px-4 py-16"
    >
      <div className="h-10 w-3/4 max-w-md rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-4 h-5 w-2/3 max-w-sm rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
