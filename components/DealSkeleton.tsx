'use client';

export default function DealSkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--color-ink-800)] overflow-hidden">
      <div className="aspect-[16/9] bg-white/5 animate-[shimmer_1.2s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] bg-[length:200%_100%]" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-2/3 bg-white/10 rounded" />
        <div className="h-3 w-1/3 bg-white/10 rounded" />
        <div className="h-2 w-full bg-white/10 rounded" />
        <div className="h-2 w-[70%] bg-white/10 rounded" />
      </div>
    </div>
  );
}
