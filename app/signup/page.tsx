'use client';

import { useEffect, useMemo, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');
  if (/^\+6104\d{8}$/.test(raw)) return '+61' + raw.slice(4); // fix +6104xxxx
  if (/^\+614\d{8}$/.test(raw)) return raw;                    // correct E.164
  if (/^04\d{8}$/.test(raw)) return '+61' + raw.slice(1);      // 04xxxxxxxx
  if (/^0\d{9}$/.test(raw)) return '+61' + raw.slice(1);       // 0XXXXXXXXX
  return raw;
}

type OtpState = 'idle' | 'sending_code' | 'code_sent' | 'verifying' | 'verified';

export default function SignupPage() {
  // redirect away if already authed
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session && typeof window !== 'undefined') {
        window.location.replace('/consumer'); // hard nav per conventions
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
  const [err, setErr] = useState<string | null>(null);

  function resetErr() { setErr(null); }

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
    resetErr();
    if (!canRequestCode) return;

    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode('');
    setOtpState('sending_code');

    try {
      // Allow temporary phone identity so trial/test works
      const { error } = await sb.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'sms', shouldCreateUser: true },
      });
      if (error) throw error;
      setOtpState('code_sent');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send code. Check +61 format and Twilio config.');
      setOtpState('idle');
    }
  }

  async function handleVerify() {
    resetErr();
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

      // Drop the temporary phone session — we sign up with email/pw next.
      if (data?.session) await sb.auth.signOut();

      setPhoneVerified(true);
      setOtpState('verified');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to verify code.');
      setOtpState('code_sent');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    resetErr();

    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (!phoneVerified) {
      setErr('Please verify your phone number first.');
      return;
    }

    setLoading(true);
    try {
      // Pure sign-up flow (no sign-in-first). Confirmation email enabled per project settings.
      const { error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Store the normalized phone as part of user metadata if you want
          data: { role: 'consumer', phone_e164: normalizePhoneAU(phone.trim()) },
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/consumer`
              : undefined,
        },
      });
      if (error) throw error;

      // Hard redirect to /consumer so chips/layout refresh on next load.
      if (typeof window !== 'undefined') window.location.replace('/consumer');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    resetErr();
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'https://todays-stash.vercel.app';
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/consumer` },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed.');
    }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8 text-white">
      <h1 className="text-2xl font-extrabold mb-2">Create your account</h1>
      <p className="text-white/70 text-sm mb-6">
        You can browse deals without an account. You’ll sign in when you redeem.
      </p>

      <form onSubmit={submit} className="rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5 space-y-4">
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

        {/* Phone + OTP (borrowed behavior from merchant/apply) */}
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
              className="rounded-xl px-4 py-2 bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
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
              placeholder="At least 6 characters"
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

        {/* Error */}
        {err && (
          <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">
            {err}
          </div>
        )}

        {/* Sign up button (no sign-in) */}
        <button
          disabled={!canSubmit}
          type="submit"
          className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-2 text-white/40 my-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={continueWithGoogle}
          className="w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15"
        >
          Continue with Google
        </button>

        <p className="text-xs text-white/60">
          Already have an account?{' '}
          <a href="/signin" className="text-white underline">Sign in</a>
        </p>
      </form>
    </main>
  );
}
