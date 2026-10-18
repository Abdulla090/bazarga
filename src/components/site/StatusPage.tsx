/** Full-page notice for maintenance mode and suspended stores (no client JS). */
export function StatusPage({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#F6F7F9] px-6 text-center" data-testid={testId}>
      <div className="max-w-md">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-ink text-xl font-bold text-white">R</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-70">{body}</p>
      </div>
    </main>
  );
}
