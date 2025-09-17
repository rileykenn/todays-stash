'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');
  if (/^\+6104\d{8}$/.test(raw)) return '+61' + raw.slice(4);
  if (/^\+614\d{8}$/.test(raw)) return raw;
  if (/^04\d{8}$/.test(raw)) return '+61' + raw.slice(1);
  if (/^0\d{9}$/.test(raw)) return '+61' + raw.slice(1);
  return raw;
}

type OtpState = 'idle' | 'sending_code' | 'code_sent' | 'verifying' | 'verified';

export default function SignupPage() {
  // if already logged in, bounce to /consumer (hard nav to refresh chips)
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session && typeof window !== 'undefined') {
        window.location.replace('/consumer');
      }
    })();
  }, []);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetAlerts() { setError(null); setNotice(null); }

  const canRequestCode = useMemo(
    () => phone.trim().length >= 8 && !phoneVerified && otpState !== 'sending_code',
    [phone, phoneVerified, otpState]
  );

  const canSubmit = useMemo(() => {
    return (
      email.trim() &&
      phone.trim() &&
      password.length >= 6 &&
      password === confirm &&
      phoneVerified &&
      !loading
    );
  }, [email, phone, password, confirm, phoneVerified, loading]);

  async function handleSendCode() {
    resetAlerts();
    if (!canRequestCode) return;

    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode('');
    setOtpState('sending_code');

    try {
      const { error } = await sb.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'sms', shouldCreateUser: true },
      });
      if (error) throw error;
      setOtpState('code_sent');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send code. Check +61 format and Twilio config.');
      setOtpState('idle');
    }
  }

  async function handleVerify() {
    resetAlerts();
    if (!code || code.length < 4) return;

    const normalized = normalizePhoneAU(phone.trim());
    setOtpState('verifying');
    try {
      const { data, error } = await sb.auth.verifyOtp({
        phone: normalized,
        token: code.trim(),
        type: 'sms',
      });
      if (error) throw error;
      if (data?.session) await sb.auth.signOut(); // drop temp phone session
      setPhoneVerified(true);
      setOtpState('verified');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to verify code.');
      setOtpState('code_sent');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!phoneVerified) {
      setError('Please verify your phone number first.');
      return;
    }

    setLoading(true);
    try {
      // 1) Try sign-in first (keeps existing behavior and immediate session)
      const si = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (!si.error && si.data?.session) {
        window.location.replace('/consumer'); // hard nav so layout effects rerun
        return;
      }

      // 2) If invalid creds → create the account
      const msg = si.error?.message?.toLowerCase() ?? '';
      const invalid = msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found');
      if (invalid) {
        const su = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { role: 'consumer', phone_e164: normalizePhoneAU(phone.trim()) },
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/consumer` : undefined,
          },
        });
        if (su.error) throw su.error;

        // 3) Try immediate sign-in (works when "Confirm email" is OFF)
        const si2 = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (!si2.error && si2.data?.session) {
          window.location.replace('/consumer');
          return;
        }

        // 4) If we still can't sign in, it's because "Confirm email" is ON
        setNotice('Check your email to confirm your account, then come back and sign in.');
        return;
      }

      // 5) Other errors (e.g., needs confirmation)
      const needsConfirm = msg.includes('confirm');
      if (needsConfirm) {
        setNotice('Please confirm your email first. We just sent you a link.');
        return;
      }

      if (si.error) throw si.error;
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    resetAlerts();
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'https://todays-stash.vercel.app';
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
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-white/70 text-sm">
        You can browse deals without an account. You’ll sign in when you redeem.
      </p>

      <section className="mt-6 rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
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

          {/* Phone + OTP */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Mobile phone</label>
            <div className="flex gap-2">
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+61…"
                className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!canRequestCode}
                className="rounded-xl px-4 py-2 bg-white/10 border border-white/10 text-sm font-semibold hover:bg.white/15 disabled:opacity-60"
              >
                {otpState === 'sending_code' ? 'Sending…' : phoneVerified ? 'Verified' : 'Get code'}
              </button>
            </div>

            {otpState !== 'idle' && !phoneVerified && (
              <div className="mt-2 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  inputMode="numeric"
                  className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
                />
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={otpState === 'verifying' || !code}
                  className="rounded-xl px-4 py-2 bg-[var(--color-brand-600)] text-sm font-semibold hover:brightness-110 disabled:opacity-60"
                >
                  {otpState === 'verifying' ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            )}

            {phoneVerified && (
              <p className="mt-1 text-xs text-[color:rgb(16_185_129)]">Phone number verified.</p>
            )}
          </div>

          {/* Password + Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-white/60 mb-1">Create a password</label>
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
            <div>
              <label className="block text-xs text-white/60 mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
              {confirm && password !== confirm && (
                <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">Passwords don’t match.</p>
              )}
            </div>
          </div>

          {/* Alerts */}
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

          {/* Sign up only (keeps you signed in when possible) */}
          <button
            disabled={!canSubmit}
            type="submit"
            className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : 'Sign up'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="mt-5 w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15"
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

      <div className="h-24" />
    </main>
  );
}
