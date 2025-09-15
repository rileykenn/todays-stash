'use client';

type Props = {
  name: string | null;
  area: string;
  onChangeArea?: () => void; // MVP: optional click handler
};

export default function WelcomeHeader({ name, area, onChangeArea }: Props) {
  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-[color:rgb(26_35_48_/_0.75)] backdrop-blur px-4 py-3">
      <div className="text-sm text-white/70">Welcome{ name ? `, ${name}` : ''}</div>
      <h1 className="text-2xl font-semibold mt-0.5">Today’s Deals</h1>

      <div className="mt-1 flex items-center gap-3 text-[13px]">
        <span className="text-white/70">in</span>
        <span className="font-medium">{area}</span>
        <button
          type="button"
          onClick={onChangeArea}
          className="ml-auto underline underline-offset-2 text-white/60 hover:text-white/80"
        >
          Change area
        </button>
      </div>
    </div>
  );
}
