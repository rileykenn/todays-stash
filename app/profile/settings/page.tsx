'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

export default function ProfileSettingsPage() {
  const [email, setEmail] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [inRewards, setInRewards] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = '/consumer'; return; }
      setEmail(user.email ?? '');

      const { data } = await sb.rpc('get_referral_status');
      const code = data?.referral_code ?? '';
      setInRewards(!!code);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setReferralLink(code ? `${origin}/?ref=${code}` : '');
      setLoading(false);
    })();
  }, []);

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Copied! You can find this link here any time.');
    } catch {
      prompt('Copy your link:', referralLink);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <div className="h-5 w-40 rounded bg-white/10 animate-pulse mb-4" />
        <div className="h-24 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 text-white min-h-[calc(100vh-140px)]">
      <h1 className="text-2xl font-bold mb-1">Profile Settings</h1>
      <p className="text-white/70 text-sm mb-6">Signed in as <span className="font-medium break-all">{email}</span></p>

      {/* Referral section */}
      <p className="text-sm font-semibold text-white/70 mb-2">Referral</p>
      <section className="bg-[rgb(30_41_59)] rounded-2xl p-5 mb-6">
        {!inRewards ? (
          <div className="text-sm">
            <p className="mb-4">You’re not in the Rewards Program yet.</p>
            <Link
              href="/rewards/join"
              className="block text-center w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 active:scale-[0.98] transition"
            >
              Join Rewards
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-3">Your referral link</p>
            <div className="bg-black/20 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-white/60 mb-1">Share this link</p>
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
                Back to Profile
              </Link>
            </div>
            <p className="text-xs text-white/60 mt-3">
              You can find this link anytime on this page.
            </p>
          </div>
        )}
      </section>

      {/* Back link */}
      <Link href="/profile" className="text-sm text-white/70 hover:text-white">
        ← Back to Profile
      </Link>
    </div>
  );
}
