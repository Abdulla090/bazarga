/** Cart skeleton (Layout v3 §6): heading, three hairline lines and the checkout panel. */
export default function Loading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16" aria-busy="true" aria-live="polite">
      <div className="grid h-fit gap-6">
        <div className="skeleton h-9 w-32 sm:h-11" />
        <div className="grid divide-y divide-st-border border-y border-st-border">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="skeleton h-20 w-16 shrink-0 sm:h-24 sm:w-[4.8rem]" />
              <div className="grid flex-1 gap-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton h-[32rem] !rounded-2xl" />
    </div>
  );
}
