'use client';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

type Status = {
  referral_code: string | null;
  points: number;
  referred_count: number;
  next_milestone_points: number | null;
  bonus_freebies_unlocked: number;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export default function ReferralBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<string>('');

  async function refresh() {
    setLoading(true);
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://todays-stash.vercel.app';

    const { data: raw } = await sb.rpc('get_referral_status');
    const s: Status = {
      referral_code: raw?.referral_code ?? null,
      points: Number(raw?.points ?? 0),
      referred_count: Number(raw?.referred_count ?? 0),
      next_milestone_points:
        raw?.next_milestone_points !== null && raw?.next_milestone_points !== undefined
          ? Number(raw?.next_milestone_points)
          : null,
      bonus_freebies_unlocked: Number(raw?.bonus_freebies_unlocked ?? 0),
    };
    setStatus(s);
    setLink(s.referral_code ? `${base}/?ref=${encodeURIComponent(s.referral_code)}` : '');
    setLoading(false);
  }

  async function ensureCode() {
    const { data, error } = await sb.rpc('get_or_create_referral_code');
    if (!error && data) await refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <div className="mb-3 rounded-2xl border border-white/10 bg-[color:rgb(26_35_48_/_0.6)] p-3 animate-pulse text-sm text-white/70">
        Loading rewards…
      </div>
    );
  }

  // No code yet → CTA banner
  if (!status?.referral_code) {
    return (
      <div
        className="mb-3 rounded-2xl p-3 border border-white/10 shadow"
        style={{
          background:
            'linear-gradient(135deg, rgba(126,34,206,0.9) 0%, rgba(251,146,60,0.9) 50%, rgba(250,204,21,0.9) 100%)',
        }}
      >
        <div className="text-sm font-semibold text-white drop-shadow">
          Want more free scans?
        </div>
        <div className="text-xs text-white/90">
          Get your referral link and earn points when friends join.
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={ensureCode}
            className="rounded-full px-3 py-1.5 text-xs font-semibold bg-black/60 text-white border border-white/20 hover:bg-black/70 active:scale-95 transition"
          >
            Get your link
          </button>
          <span className="text-[11px] text-white/85">
            100 pts per friend • 50 pts per redemption
          </span>
        </div>
      </div>
    );
  }

  // Has code → tracker
  const nextPts = status.next_milestone_points;
  const pct =
    nextPts && nextPts > 0
      ? clamp(Math.round((status.points / nextPts) * 100))
      : 100;

  return (
    <div
      className="mb-3 rounded-2xl p-3 border border-white/10 shadow"
      style={{
        background:
          'linear-gradient(135deg, rgba(88,28,135,0.9) 0%, rgba(251,146,60,0.9) 55%, rgba(250,204,21,0.9) 100%)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white drop-shadow">
            Rewards progress
          </div>
          <div className="text-xs text-white/90">
            {status.points} pts
            {nextPts
              ? ` • ${Math.max(0, nextPts - status.points)} to next reward`
              : ' • More milestones coming soon'}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs text-white/90">{status.referred_count} referred</span>
          <span className="text-xs bg-black/30 text-white px-2 py-1 rounded-full border border-white/20">
            +{status.bonus_freebies_unlocked} freebie{status.bonus_freebies_unlocked === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, rgb(250,204,21) 0%, rgb(251,146,60) 50%, rgb(52,211,153) 100%)',
            boxShadow: '0 0 12px rgba(250,204,21,0.6)',
          }}
        />
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg bg-black/35 text-white/90 text-xs px-2 py-1 font-mono truncate">
          {link}
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!link) return;
              await navigator.clipboard.writeText(link);
              alert('Copied! Share to earn 100 pts per friend.');
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold bg-black/60 text-white border border-white/20 hover:bg-black/70 active:scale-95 transition"
          >
            Copy link
          </button>
          <button
            onClick={async () => {
              if (!link) return;
              if (navigator.share) {
                await navigator.share({
                  title: "Today's Stash",
                  text: 'Join me on Today’s Stash — free local deals!',
                  url: link,
                });
              } else {
                await navigator.clipboard.writeText(link);
                alert('Link copied! Paste anywhere to share.');
              }
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/20 text-white hover:bg-white/30 active:scale-95 transition"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
