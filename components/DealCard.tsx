// components/DealCard.tsx
'use client';

type DealCardProps = {
  title: string;
  terms?: string | null;
  photo?: string | null;
  merchantName?: string | null;
  address?: string | null;
  leftToday?: number | null;
  cap?: number | null;
  onGet: () => void;
};

export function DealCard({
  title,
  terms,
  photo,
  merchantName,
  address,
  leftToday,
  cap,
  onGet,
}: DealCardProps) {
  const capNum = cap ?? 0;
  const leftNum = Math.max(0, leftToday ?? capNum);
  const used = capNum ? capNum - leftNum : 0;
  const fillPct = capNum ? Math.round((used / capNum) * 100) : 0;

  return (
    <div className="rounded-2xl bg-[var(--color-ink-800)] shadow-lg overflow-hidden">
      {/* Image */}
      <div className="relative aspect-[16/9] bg-[var(--color-ink-700)]">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={title} className="w-full h-full object-cover" />
        )}
        {typeof leftToday === 'number' && typeof cap === 'number' && (
          <div className="absolute left-2 top-2 bg-[var(--color-ink-900)]/80 backdrop-blur px-2.5 py-1 rounded-full text-xs border border-white/10">
            <span
              className={
                leftNum <= 3
                  ? 'text-[var(--color-accent-orange)] font-semibold'
                  : 'text-[var(--color-brand-300)]'
              }
            >
              {leftNum} left today
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{title}</h3>
            <p className="text-xs text-white/60 truncate">{merchantName}</p>
            {address && <p className="text-[11px] text-white/40 truncate">{address}</p>}
          </div>
          <button
            onClick={onGet}
            className="shrink-0 rounded-full bg-[var(--color-brand)] px-4 py-2 text-[var(--color-ink-900)] font-semibold hover:brightness-105 active:scale-95 transition"
          >
            Get deal
          </button>
        </div>

        {terms && <p className="text-sm text-white/70 line-clamp-2">{terms}</p>}

        {capNum > 0 && (
          <div className="mt-1">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full ${
                  leftNum <= 3 ? 'bg-[var(--color-accent-orange)]' : 'bg-[var(--color-brand-500)]'
                }`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-white/50">
              <span>Today</span>
              <span>
                {used}/{capNum} used
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
