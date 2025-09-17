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
  // If already logged in, bounce to consumer
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

  const [hasSession, setHasSession] = useState(false);
  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Availability flags (from your RPC)
  const [emailTaken, setEmailTaken] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);

  function resetAlerts() { setError(null); setNotice(null); }

  // Track auth state so OTP can only be sent AFTER email user exists
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await sb.auth.getSession();
      setHasSession(Boolean(data.session));
      const { data: sub } = sb.auth.onAuthStateChange((_e, sess) => {
        setHasSession(Boolean(sess));
      });
      unsub = sub?.subscription?.unsubscribe;
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const canRequestCode = useMemo(
    () => hasSession && phone.trim().length >= 8 && !phoneVerified && otpState !== 'sending_code',
    [hasSession, phone, phoneVerified, otpState]
  );

  const canSubmit = useMemo(() => {
    const strongPassword = password.length >= 6 && password === confirm;
    const idsOk = !emailTaken && !phoneTaken;
    return (
      email.trim() &&
      phone.trim() &&
      strongPassword &&
      idsOk &&
      !loading
    );
  }, [email, phone, password, confirm, emailTaken, phoneTaken, loading]);

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

  // -------------------- OTP helpers (link to existing session) --------------------
  async function sendLinkOtp(normalizedPhone: string) {
    // Requires a session; prevents creating a separate phone user
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) {
      setError('First press “Sign up” with your email & password. Then request the code.');
      return false;
    }

    setOtpState('sending_code');
    try {
      const { error: updErr } = await sb.auth.updateUser({ phone: normalizedPhone });
      if (updErr) throw updErr;
      setOtpState('code_sent');
      setNotice('We sent a code to your phone. Enter it below and press Verify.');
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send code. Check +61 format and Twilio config.');
      setOtpState('idle');
      return false;
    }
  }

  async function handleSendCode() {
    resetAlerts();
    if (!canRequestCode) return;
    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode('');
    await sendLinkOtp(normalized);
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

      setPhoneVerified(true);
      setOtpState('verified');

      if (typeof window !== 'undefined') {
        window.location.replace('/consumer');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to verify code.');
      setOtpState('code_sent');
    }
  }

  // -------------------- Submit (email auth first; then link phone) --------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (emailTaken) {
      setError('This email is already associated with an account.');
      return;
    }
    if (phoneTaken) {
      setError('This phone number is already associated with an account.');
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const normalizedPhone = normalizePhoneAU(phone.trim());

      // 1) Try sign-in with email/pw
      const si = await sb.auth.signInWithPassword({ email: trimmedEmail, password });
      let haveSession = !si.error && Boolean(si.data?.session);

      // 2) If invalid → sign up then sign in
      if (!haveSession) {
        const msg = si.error?.message?.toLowerCase() ?? '';
        const invalid = msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found');

        if (invalid) {
          const su = await sb.auth.signUp({
            email: trimmedEmail,
            password,
            options: { data: { role: 'consumer', phone_e164: normalizedPhone } },
          });
          if (su.error) {
            const m = su.error.message?.toLowerCase() ?? '';
            if (m.includes('already') && m.includes('registered')) {
              setError('This email is already associated with an account.');
              setLoading(false);
              return;
            }
            throw su.error;
          }
          const si2 = await sb.auth.signInWithPassword({ email: trimmedEmail, password });
          if (si2.error) {
            const m2 = si2.error.message?.toLowerCase() ?? '';
            if (m2.includes('confirm')) {
              setNotice('Please confirm your email first. We just sent you a link.');
              setLoading(false);
              return;
            }
            throw si2.error;
          }
          haveSession = Boolean(si2.data?.session);
        } else if (si.error) {
          const m3 = si.error.message?.toLowerCase() ?? '';
          if (m3.includes('confirm')) {
            setNotice('Please confirm your email first. We just sent you a link.');
            setLoading(false);
            return;
          }
          throw si.error;
        }
      }

      if (!haveSession) throw new Error('Could not establish a session.');

      // 3) If phone already verified, just go
      if (phoneVerified) {
        window.location.replace('/consumer');
        return;
      }

      // 4) Send OTP to link phone to this same UID (no new account)
      await sendLinkOtp(normalizedPhone);
      // User will enter code and hit Verify to finish
    } catch (e: any) {
      const m = e?.message?.toLowerCase?.() ?? '';
      if (m.includes('already') && m.includes('registered')) {
        setError('This email is already associated with an account.');
      } else if (m.includes('phone')) {
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
                title={!hasSession ? 'Sign up with email & password first' : undefined}
                className="rounded-xl px-4 py-2 bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
              >
                {otpState === 'sending_code' ? 'Sending…' : phoneVerified ? 'Verified' : 'Get code'}
              </button>
            </div>
            {phone && phoneTaken && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">
                This phone number is already associated with an account.
              </p>
            )}

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
