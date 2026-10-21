import { SrLoading } from "@/components/SrLoading";

export default async function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 md:grid-cols-2">
      <SrLoading />
      <div className="aspect-square rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="space-y-3">
        <div className="h-8 w-3/4 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
        <div className="h-6 w-1/4 rounded-lg bg-slate-200/60 motion-safe:animate-pulse" />
        <div className="h-24 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />
        <div className="h-12 rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
