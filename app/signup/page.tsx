'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      // Try sign-in first (existing users)
      const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!signInErr && signInData?.session) {
        if (typeof window !== 'undefined') {
  window.location.href = '/consumer'; // full reload to consumer page
}
        // Force a single hard refresh so layout chips/tabs pick up the fresh session
        if (typeof window !== 'undefined') window.location.reload();
        return;
      }

      // If invalid credentials, attempt sign-up (new user)
      const invalidCreds =
        signInErr?.message?.toLowerCase().includes('invalid') ||
        signInErr?.message?.toLowerCase().includes('credentials');

      if (invalidCreds) {
        const { error: upErr } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/consumer` : undefined,
          },
        });
        if (upErr) throw upErr;

        setNotice('Check your email for the confirmation link to finish creating your account.');
        return;
      }

      // If email exists but not confirmed
      const needsConfirm =
        signInErr?.message?.toLowerCase().includes('confirm') ||
        signInErr?.message?.toLowerCase().includes('not confirmed');
      if (needsConfirm) {
        setNotice('Please confirm your email to finish signing in. We just sent you a link.');
        return;
      }

      if (signInErr) throw signInErr;
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/consumer` : undefined;

      const { error: oauthErr } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthErr) throw oauthErr;
      // Supabase handles redirect; on return, /consumer loads and layout picks up session.
      // If you still want to hard-refresh after returning, add a small script on /consumer.
    } catch (err: any) {
      setError(err?.message ?? 'Google sign-in failed.');
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8 text-white">
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-white/70 text-sm">
        You can browse deals without an account. You’ll sign in when you redeem.
      </p>

      {/* Auth card */}
      <section className="mt-6 rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5">
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
          </div>

          {error && (
            <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)] text-sm">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : 'Sign up / Sign in'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-5 w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-white/50">
          Already have an account?{' '}
          <Link href="/signin" className="text-[var(--color-brand-600)] hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      {/* Merchant CTA */}
      <section className="mt-8 border-t border-white/10 pt-6">
        <h2 className="text-base font-semibold mb-1">Are you a business?</h2>
        <p className="text-sm text-white/70 mb-3">
          List your business on Today’s Stash and start driving foot traffic.
        </p>
        <Link
          href="/merchant/apply"
          className="inline-block rounded-full px-5 py-3 bg-[color:rgb(17_24_39)] text-white border border-white/10 hover:bg-white/10"
        >
          Sign up as a merchant
        </Link>
      </section>

      <div className="h-24" />
    </main>
  );
}
