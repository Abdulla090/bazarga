/** Product page skeleton (Layout v3 §6): gallery 4:5 on columns 1–7, info column on 9–12 — the same boxes as the page. */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <div className="skeleton -mt-1 h-5 w-20" />
      <div className="grid-12 items-start gap-y-6">
        <div className="skeleton bleed-x col-span-4 aspect-[4/5] !rounded-none sm:mx-0 sm:!rounded-2xl md:col-span-7" />
        <div className="col-span-4 grid gap-4 md:col-span-5 lg:col-span-4 lg:col-start-9">
          <div className="skeleton h-9 w-4/5 lg:h-11" />
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton mt-4 h-12 w-full rounded-full" />
          <div className="skeleton h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
