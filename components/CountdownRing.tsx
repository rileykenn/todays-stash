// components/CountdownRing.tsx
'use client';

export function CountdownRing({
  secondsLeft,
  total = 90,
}: {
  secondsLeft: number;
  total?: number;
}) {
  const pct = Math.max(0, Math.min(1, secondsLeft / total));
  const deg = Math.round(360 * pct);
  const danger = secondsLeft <= 10;

  return (
    <div
      className="relative w-40 h-40 rounded-full"
      style={{
        background: `conic-gradient(${
          danger ? 'var(--color-accent-red)' : 'var(--color-brand)'
        } ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`,
      }}
    >
      <div className="absolute inset-[10px] bg-[var(--color-ink-900)] rounded-full flex items-center justify-center">
        <span
          className={`text-3xl font-bold ${
            danger ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-brand-400)]'
          }`}
        >
          {secondsLeft}s
        </span>
      </div>
    </div>
  );
}
