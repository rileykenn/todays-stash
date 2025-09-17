'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';          // <- add this
import { sb } from '@/lib/supabaseBrowser';

function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');
  if (/^\+6104\d{8}$/.test(raw)) return '+61' + raw.slice(4);
  if (/^\+614\d{8}$/.test(raw)) return raw;
  if (/^04\d{8}$/.test(raw)) return '+61' + raw.slice(1);
  if (/^0\d{9}$/.test(raw)) return '+61' + raw.slice(1);
  return raw;
}

export default function SigninPage() {
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session && typeof window !== 'undefined') {
        window.location.replace('/consumer');
      }
    })();
  }, []);

  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => identifier.trim().length > 0 && password.length >= 6 && !loading,
    [identifier, password, loading]
  );

  async function handleSubmit(e: FormEvent) {      // <- use FormEvent here
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const value = identifier.trim();
      const isEmail = value.includes('@');

      if (isEmail) {
        const { error } = await sb.auth.signInWithPassword({ email: value, password });
        if (error) throw error;
      } else {
        const phone = normalizePhoneAU(value);
        const { error } = await sb.auth.signInWithPassword({ phone, password });
        if (error) throw error;
      }

      window.location.replace('/consumer');
    } catch (e: any) {
      const msg = e?.message ?? 'Sign in failed';
      if (/invalid login credentials/i.test(msg)) {
        setError('Incorrect email/phone or password. Try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://todays-stash.vercel.app';
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/consumer` },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8 text-white">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-white/70 text-sm">Enter your email or mobile number and your password.</p>

      <section className="mt-6 rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Email or mobile</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or +61…"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
            <div className="mt-1">
              <Link href="/reset" className="text-xs text-[var(--color-brand-600)] hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit}
            type="submit"
            className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          onClick={handleGoogle}
          className="mt-5 w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-white/50">
          Don’t have an account?{' '}
          <Link href="/signup" className="text-[var(--color-brand-600)] hover:underline">
            Create one
          </Link>
        </p>
      </section>

      <div className="h-24" />
    </main>
  );
}
