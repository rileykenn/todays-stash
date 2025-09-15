'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MerchantProfilePage() {
  const [tab, setTab] = useState<'rewards' | 'referrals'>('rewards');

  return (
    <div className="py-4">
      <h1 className="text-xl font-semibold mb-3">Profile</h1>

      <div className="rounded-xl border border-white/10 bg-[color:rgb(26_35_48_/_0.7)] p-1 inline-flex">
        <button
          onClick={() => setTab('rewards')}
          className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'rewards' ? 'bg-[var(--color-ink-700)]' : 'text-white/70'}`}
        >
          Rewards
        </button>
        <button
          onClick={() => setTab('referrals')}
          className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'referrals' ? 'bg-[var(--color-ink-700)]' : 'text-white/70'}`}
        >
          Referrals
        </button>
      </div>

      {tab === 'rewards' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-sm text-white/70">Savings this week</div>
            <div className="text-2xl font-bold mt-1">$18.40</div>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-2/3 bg-[var(--color-brand-600)] animate-[pulse-soft_2s_ease-in-out_infinite]" />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-sm text-white/70">Free redemptions left</div>
            <div className="text-2xl font-bold mt-1">2</div>
            <Link href="/upgrade" className="mt-2 inline-flex rounded-full px-3 py-1.5 text-sm bg-[var(--color-brand-600)] text-white">
              Upgrade for unlimited
            </Link>
          </div>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-sm text-white/70">Your referral link</div>
            <div className="mt-1 rounded-lg bg-[color:rgb(30_41_59)] p-2 font-mono text-sm break-all">
              https://todays-stash.vercel.app/?ref=YOURCODE
            </div>
            <button
              className="mt-2 rounded-full px-3 py-1.5 text-sm bg-[var(--color-brand-600)] text-white"
              onClick={async () => {
                await navigator.clipboard.writeText('https://todays-stash.vercel.app/?ref=YOURCODE');
                alert('Copied! Share with friends to earn free redemptions.');
              }}
            >
              Copy link
            </button>
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-sm text-white/70 mb-2">Referral progress</div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 bg-[var(--color-brand-600)] animate-[glow_1.6s_ease-in-out_infinite]" />
            </div>
            <div className="mt-1 text-xs text-white/60">3 / 10 signups — next reward: +1 free redemption</div>
          </div>
        </div>
      )}
    </div>
  );
}
