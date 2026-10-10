/** Store home skeleton (Layout v3 §6): reserves the hero, a section heading and one row of 4:5 cards, so content lands without shifting. */
export default function Loading() {
  return (
    <div className="grid" aria-busy="true" aria-live="polite">
      <div className="grid-12 -mt-6 items-end sm:-mt-10 md:mt-0">
        <div className="skeleton bleed-x col-span-4 aspect-[4/5] !rounded-none sm:aspect-[4/3] md:col-span-7 md:col-start-6 md:row-start-1 md:ms-0 md:aspect-auto md:h-[min(80vh,46rem)] md:bleed-end md:!rounded-s-2xl" />
        <div className="col-span-4 -mt-8 grid gap-6 md:col-span-5 md:col-start-1 md:row-start-1 md:mt-0 md:pb-10">
          <div className="skeleton h-[3.25rem] w-4/5 md:h-[clamp(4rem,8.5vw,8rem)]" />
          <div className="skeleton h-12 w-full rounded-full sm:w-36" />
        </div>
      </div>
      <div className="section grid gap-6">
        <div className="skeleton h-8 w-48 md:h-10" />
        <div className="grid grid-cols-2 gap-x-[var(--grid-gap)] gap-y-8 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-3">
              <div className="skeleton aspect-[4/5] !rounded-2xl" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
