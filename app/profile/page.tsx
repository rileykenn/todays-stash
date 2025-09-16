'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

type ViewModel = {
  email: string;
  redemptionsLeft: number;
  savings: number;
  inRewards: boolean;
  isMerchant: boolean;
};

const POINT_TO_DOLLAR = 0.184; // adjust conversion if needed

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
          sb.from('profiles').select('points').single(),
        ]);

        const user = userRes.user;
        const redemptionsLeft =
          typeof freeRes.data === 'number'
            ? freeRes.data
            : (freeRes.data as any)?.remaining ?? 0;

        const inRewards = !!rewardsRes.data?.referral_code;
        const isMerchant = !!merchRes.data;

        const points: number = profRes.data?.points ?? 0;
        const savings = Math.max(
          0,
          Math.round(points * POINT_TO_DOLLAR * 100) / 100
        );

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
    await sb.rpc('get_or_create_referral_code');
    const res = await sb.rpc('get_referral_status');
    setVm((prev) =>
      prev ? { ...prev, inRewards: !!res.data?.referral_code } : prev
    );
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    window.location.href = '/consumer';
  }

  if (loading || !vm) {
    return (
      <div className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <div className="h-5 w-32 rounded bg-white/10 animate-pulse mb-4" />
        <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 text-white min-h-[calc(100vh-140px)]">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {/* Account */}
      <p className="text-sm font-semibold text-white/70 mb-2">Account</p>
      <section className="bg-[rgb(30_41_59)] rounded-2xl p-4 mb-6">
        <p className="text-xs text-white/60">Signed in as</p>
        <p className="text-base font-medium break-all">{vm.email}</p>
      </section>

      {/* Stats */}
      <p className="text-sm font-semibold text-white/70 mb-2">Stats</p>
      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[rgb(30_41_59)] rounded-2xl p-4">
          <p className="text-xs text-white/60">Savings so far</p>
          <p className="text-2xl font-extrabold">${vm.savings.toFixed(2)}</p>
        </div>
        <div className="bg-[rgb(30_41_59)] rounded-2xl p-4">
          <p className="text-xs text-white/60">Free left</p>
          <p className="text-2xl font-extrabold">{vm.redemptionsLeft}</p>
        </div>
      </section>

      {/* Rewards */}
      <p className="text-sm font-semibold text-white/70 mb-2">Rewards</p>
      {!vm.inRewards ? (
        <section className="bg-[rgb(30_41_59)] rounded-2xl p-5 mb-6 text-center">
          <p className="text-sm mb-4">
            Join the Rewards Program to start earning free scans from
            redemptions & referrals.
          </p>
          <button
            onClick={joinRewards}
            className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.98] transition animate-[pulse-soft_2s_ease-in-out_infinite]"
          >
            Join Rewards
          </button>
        </section>
      ) : (
        <section className="bg-[rgb(30_41_59)] rounded-2xl p-5 mb-6">
          <p className="text-sm">
            You’re in the Rewards Program. Earn points via referrals and
            redemptions.
          </p>
          <Link
            href="/"
            className="inline-block mt-3 text-sm rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Get referral link
          </Link>
        </section>
      )}

      {/* Merchant actions */}
      {vm.isMerchant && (
        <>
          <p className="text-sm font-semibold text-white/70 mb-2">Merchant</p>
          <section className="bg-[rgb(30_41_59)] rounded-2xl p-5 mb-6">
            <div className="flex gap-3">
              <Link
                href="/merchant"
                className="flex-1 text-center rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.98] transition"
              >
                My deals
              </Link>
              <Link
                href="/merchant/scan"
                className="flex-1 text-center rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 active:scale-[0.98] transition"
              >
                Scan
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Sign out */}
      <p className="text-sm font-semibold text-white/70 mb-2">Account Actions</p>
      <section>
        <button
          onClick={handleSignOut}
          className="w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 active:scale-[0.98] transition"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
