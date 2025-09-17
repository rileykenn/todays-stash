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

type OtpState = 'idle' | 'sending_code' | 'code_sent';

export default function SignupPage() {
  // bounce if already logged in
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session && typeof window !== 'undefined') {
        window.location.replace('/consumer');
      }
    })();
  }, []);

  // -------------------- state --------------------
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [cooldown, setCooldown] = useState(0); // seconds

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // availability flags (your RPC)
  const [emailTaken, setEmailTaken] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);

  function resetAlerts() { setError(null); setNotice(null); }

  // cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const strongPassword = useMemo(
    () => password.length >= 6 && password === confirm,
    [password, confirm]
  );

  // Get code can be clicked whenever a phone is typed & cooldown finished
  const canRequestCode = useMemo(
    () => phone.trim().length >= 8 && otpState !== 'sending_code' && cooldown === 0,
    [phone, otpState, cooldown]
  );

  // Enable Sign up when: email, phone, strong pw, code present, no availability conflicts
  const canSubmit = useMemo(() => {
    const idsOk = !emailTaken && !phoneTaken;
    const hasCode = code.trim().length >= 4;
    return email.trim() && phone.trim() && strongPassword && idsOk && hasCode && !loading;
  }, [email, phone, strongPassword, emailTaken, phoneTaken, code, loading]);

  // -------- Debounced availability check (email + phone) ----------
  useEffect(() => {
    const handle = setTimeout(async () => {
      const e = email.trim();
      const p = normalizePhoneAU(phone.trim());

      if (!e && !p) {
        setEmailTaken(false);
        setPhoneTaken(false);
        return;
      }
      try {
        const { data, error } = await sb.rpc('check_identifier_available', {
          p_email: e || null,
          p_phone: p || null,
        });
        if (!error && data) {
          setEmailTaken(Boolean(data.email_taken));
          setPhoneTaken(Boolean(data.phone_taken));
        }
      } catch {
        // ignore; don't block UX on check errors
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [email, phone]);

  // -------- helper: ensure we have an email session (sign in OR sign up then sign in) ----------
  async function ensureEmailSession(trimmedEmail: string, pw: string) {
    const si = await sb.auth.signInWithPassword({ email: trimmedEmail, password: pw });
    if (!si.error && si.data?.session) return true;

    const msg = si.error?.message?.toLowerCase() ?? '';
    const invalid = msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found');
    if (!invalid) {
      if (si.error) throw si.error;
      return false;
    }

    const su = await sb.auth.signUp({
      email: trimmedEmail,
      password: pw,
      options: { data: { role: 'consumer' } },
    });
    if (su.error) {
      const m = su.error.message?.toLowerCase() ?? '';
      if (m.includes('already') && m.includes('registered')) {
        // try sign in again
      } else {
        throw su.error;
      }
    }
    const si2 = await sb.auth.signInWithPassword({ email: trimmedEmail, password: pw });
    if (si2.error) throw si2.error;
    return Boolean(si2.data?.session);
  }

  // -------- Get code: ensure email session, then send OTP by linking phone ----------
  async function handleSendCode() {
    resetAlerts();
    if (!canRequestCode) return;

    const trimmedEmail = email.trim();
    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode(''); // clear old code to avoid stale submission

    // gentle guardrails (don’t hard-disable button for UX)
    if (!trimmedEmail || !strongPassword) {
      setNotice('Enter your email and matching passwords first (needed to link the SMS to your account).');
      return;
    }
    if (emailTaken) { setError('This email is already associated with an account.'); return; }
    if (phoneTaken) { setError('This phone number is already associated with an account.'); return; }

    try {
      setOtpState('sending_code');

      // 1) ensure email session exists (prevents a second UID)
      const ok = await ensureEmailSession(trimmedEmail, password);
      if (!ok) throw new Error('Could not establish email session.');

      // 2) link phone & send OTP via Supabase (Twilio behind the scenes)
      const { error: updErr } = await sb.auth.updateUser({ phone: normalized });
      if (updErr) throw updErr;

      setOtpState('code_sent');
      setCooldown(10); // 10s anti-abuse cooldown
      setNotice('We sent a code. Enter it below, then press Sign up.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send code. Check +61 format and Twilio config.');
      setOtpState('idle');
    }
  }

  // -------- Submit: verify OTP & go ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (!canSubmit) return;

    const trimmedEmail = email.trim();
    const normalizedPhone = normalizePhoneAU(phone.trim());
    const token = code.trim();

    setLoading(true);
    try {
      // safety: make sure we still have an email session
      const { data: sessNow } = await sb.auth.getSession();
      if (!sessNow.session) {
        const ok = await ensureEmailSession(trimmedEmail, password);
        if (!ok) throw new Error('Could not establish email session.');
      }

      // verify OTP (links phone to SAME UID; no duplicate account)
      const { error: vErr } = await sb.auth.verifyOtp({
        phone: normalizedPhone,
        token,
        type: 'sms',
      });
      if (vErr) throw vErr;

      // success → redirect
      window.location.replace('/consumer');
    } catch (e: any) {
      const msg = e?.message?.toLowerCase?.() ?? '';
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token') || msg.includes('otp')) {
        setError('Invalid or expired code. If you requested multiple, use the latest or tap “Get code” to resend.');
      } else if (msg.includes('already') && msg.includes('registered')) {
        setError('This phone number is already associated with an account.');
      } else {
        setError(e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    resetAlerts();
    try {
      const origin = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://todays-stash.vercel.app';
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/consumer` },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    }
  }

  // -------------------- UI --------------------
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
            {email && emailTaken && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">
                This email is already associated with an account.
              </p>
            )}
          </div>

          {/* Phone + OTP (code box always visible; no Verify button) */}
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
                {otpState === 'sending_code'
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : otpState === 'code_sent'
                      ? 'Resend code'
                      : 'Get code'}
              </button>
            </div>
            {phone && phoneTaken && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">
                This phone number is already associated with an account.
              </p>
            )}

            <div className="mt-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                inputMode="numeric"
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
            </div>
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
            <div className="rounded-2xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)] text-sm">
              {notice}
            </div>
          )}

          {/* Sign up */}
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
