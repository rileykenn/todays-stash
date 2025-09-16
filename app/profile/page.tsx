'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

type ViewModel = {
  email: string;
  redemptionsLeft: number;
  savings: number;                  // total $ saved (approx via points→$)
  inRewards: boolean;               // has referral_code
  isMerchant: boolean;              // has merchant row
};

const POINT_TO_DOLLAR = 0.184;      // adjust if you change point_rules or want exact calc

export default function ProfilePage() {
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: userRes }, freeRes, merchRes, rewardsRes, profRes] = await Promise.all([
          sb.auth.getUser(),
          sb.rpc('get_free_remaining'),
          sb.rpc('get_my_merchant'),
          sb.rpc('get_referral_status'),
          sb.from('profiles').select('points').single(), // points → savings proxy
        ]);

        const user = userRes.user;
        const redemptionsLeft =
          typeof freeRes.data === 'number' ? freeRes.data : (freeRes.data as any)?.remaining ?? 0;

        const inRewards = !!rewardsRes.data?.referral_code;
        const isMerchant = !!merchRes.data;

        const points: number = profRes.data?.points ?? 0;
        const savings = Math.max(0, Math.round(points * POINT_TO_DOLLAR * 100) / 100);

        setVm({
          email: user?.email ?? '',
          redemptionsLeft,
          savings,
          inRewards,
          isMerchant,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function joinRewards() {
    // enrolling = mint (or fetch) referral code; having one = "in rewards"
    await sb.rpc('get_or_create_referral_code');
    const res = await sb.rpc('get_referral_status');
    setVm((prev) => prev ? { ...prev, inRewards: !!res.data?.referral_code } : prev);
  }

  if (loading || !vm) {
    return (
      <div className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <div className="h-4 w-32 rounded bg-white/10 animate-pulse mb-4" />
        <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-5 text-white min-h-[calc(100vh-140px)]">
      <h1 className="text-xl font-bold mb-4">Profile</h1>

      {/* Email card */}
      <section className="bg-[rgb(30_41_59)] rounded-2xl p-4 mb-4">
        <p className="text-xs text-white/60">Signed in</p>
        <p className="text-sm font-semibold break-all">{vm.email}</p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[rgb(30_41_59)] rounded-2xl p-4">
          <p className="text-xs text-white/60">Savings so far</p>
          <p className="text-2xl font-extrabold tracking-tight">${vm.savings.toFixed(2)}</p>
        </div>
        <div className="bg-[rgb(30_41_59)] rounded-2xl p-4">
          <p className="text-xs text-white/60">Free left</p>
          <p className="text-2xl font-extrabold tracking-tight">{vm.redemptionsLeft}</p>
        </div>
      </section>

      {/* Rewards CTA or link */}
      {!vm.inRewards ? (
        <section className="bg-[rgb(30_41_59)] rounded-2xl p-4 mb-4 text-center">
          <p className="text-sm mb-3">
            Join the Rewards Program to start earning free scans from redemptions & referrals.
          </p>
          <button
            onClick={joinRewards}
            className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.99] transition animate-[pulse-soft_2s_ease-in-out_infinite]"
          >
            Join Rewards
          </button>
        </section>
      ) : (
        <section className="bg-[rgb(30_41_59)] rounded-2xl p-4 mb-4">
          <p className="text-sm">You’re in the Rewards Program. Earn points via referrals and redemptions.</p>
          <Link
            href="/"
            className="inline-block mt-3 text-sm rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Get referral link (Home banner)
          </Link>
        </section>
      )}

      {/* Merchant-only actions */}
      {vm.isMerchant && (
        <section className="bg-[rgb(30_41_59)] rounded-2xl p-4 mb-4">
          <p className="text-sm mb-3 text-white/80">Merchant</p>
          <div className="flex gap-3">
            <Link
              href="/merchant"
              className="flex-1 text-center rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.99] transition"
            >
              My deals
            </Link>
            <Link
              href="/merchant/scan"
              className="flex-1 text-center rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 active:scale-[0.99] transition"
            >
              Scan
            </Link>
          </div>
        </section>
      )}

      {/* Sign out */}
      <section className="pt-2">
        <button
          onClick={async () => { await sb.auth.signOut(); window.location.href = '/consumer'; }}
          className="w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 active:scale-[0.99] transition"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
