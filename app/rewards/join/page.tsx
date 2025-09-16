'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

export default function RewardsJoinPage() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [referralLink, setReferralLink] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        window.location.href = '/consumer';
        return;
      }
      setEmail(user.email ?? '');
      setLoading(false);
    })();
  }, []);

  async function handleAccept() {
    setAccepting(true);
    try {
      // Enrol user by ensuring a referral_code exists
      await sb.rpc('get_or_create_referral_code');
      const { data } = await sb.rpc('get_referral_status');

      const code = data?.referral_code ?? '';
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://todays-stash.example';

      const link = `${origin}/?ref=${code}`;
      setReferralLink(link);
      setShowCongrats(true);
    } finally {
      setAccepting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Copied! You can find this link any time in your Profile.');
    } catch {
      // Fallback for rare clipboard blocks
      prompt('Copy your link manually:', referralLink);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <div className="h-5 w-40 rounded bg-white/10 animate-pulse mb-4" />
        <div className="h-32 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 text-white min-h-[calc(100vh-140px)]">
      <h1 className="text-2xl font-bold mb-2">Join Rewards</h1>
      <p className="text-white/70 text-sm mb-6">Signed in as <span className="font-medium">{email}</span></p>

      {/* Terms card */}
      <section className="bg-[rgb(30_41_59)] rounded-2xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-3">How it works</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-white/80">
          <li>Earn points for every accepted in-store redemption.</li>
          <li>Share your personal referral link—earn points when friends join and redeem.</li>
          <li>Points unlock free scans and other perks set by Today’s Stash.</li>
          <li>Abuse or fraudulent activity may result in removal from the program.</li>
        </ul>

        <h2 className="text-base font-semibold mt-5 mb-2">Terms & Conditions (summary)</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-white/80">
          <li>One account per person. Points are non-transferable.</li>
          <li>Rewards structure may change; we’ll keep the rules visible in-app.</li>
          <li>We may revoke rewards for suspicious activity or breach of terms.</li>
          <li>Your data is handled per our Privacy Policy.</li>
        </ul>

        <p className="text-xs text-white/60 mt-4">
          By continuing, you agree to the Rewards Program terms above.
        </p>

        <button
          onClick={handleAccept}
          disabled={accepting}
          className="mt-5 w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
        >
          {accepting ? 'Enrolling…' : 'I accept and continue'}
        </button>

        <Link
          href="/profile"
          className="block text-center text-sm mt-3 text-white/70 hover:text-white"
        >
          Cancel and go back
        </Link>
      </section>

      {/* Congrats Modal */}
      {showCongrats && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-[rgb(30_41_59)] rounded-2xl border border-white/10 p-5">
            <h3 className="text-lg font-semibold">🎉 Congratulations!</h3>
            <p className="text-sm text-white/80 mt-1">
              You’re now part of the Rewards Program.
            </p>

            <div className="mt-4 bg-black/20 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-white/60 mb-1">Your referral link</p>
              <p className="text-sm break-all">{referralLink}</p>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.98] transition"
              >
                Copy link
              </button>
              <Link
                href="/profile"
                className="flex-1 text-center rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 active:scale-[0.98] transition"
              >
                Done
              </Link>
            </div>

            <p className="text-xs text-white/60 mt-3">
              You can find this link anytime in your Profile settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
