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

  // state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sentToPhone, setSentToPhone] = useState<string | null>(null); // exact phone used for OTP
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [cooldown, setCooldown] = useState(0);

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

  const canRequestCode = useMemo(
    () => phone.trim().length >= 8 && otpState !== 'sending_code' && cooldown === 0,
    [phone, otpState, cooldown]
  );

  const canSubmit = useMemo(() => {
    const idsOk = !emailTaken && !phoneTaken;
    const hasCode = code.trim().length >= 4;
    return email.trim() && phone.trim() && strongPassword && idsOk && hasCode && !loading;
  }, [email, phone, strongPassword, emailTaken, phoneTaken, code, loading]);

  // availability RPC (debounced)
  useEffect(() => {
    const handle = setTimeout(async () => {
      const e = email.trim();
      const p = normalizePhoneAU(phone.trim());
      if (!e && !p) { setEmailTaken(false); setPhoneTaken(false); return; }
      try {
        const { data, error } = await sb.rpc('check_identifier_available', {
          p_email: e || null, p_phone: p || null,
        });
        if (!error && data) {
          setEmailTaken(Boolean(data.email_taken));
          setPhoneTaken(Boolean(data.phone_taken));
        }
      } catch {}
    }, 350);
    return () => clearTimeout(handle);
  }, [email, phone]);

  // SEND CODE (Twilio Verify via our API) — no Supabase user yet
  async function handleSendCode() {
    resetAlerts();
    if (!canRequestCode) return;

    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode('');

    if (phoneTaken) { setError('This phone number is already associated with an account.'); return; }

    try {
      setOtpState('sending_code');
      const r = await fetch('/api/verify/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Failed to send code');

      setOtpState('code_sent');
      setCooldown(10);
      setSentToPhone(normalized);
      setNotice('We sent a code. Enter it below, then press Sign up.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send code.');
      setOtpState('idle');
    }
  }

  // SUBMIT: verify code first, THEN create the Supabase user (phone+pw), THEN add email
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (!canSubmit) return;
    if (!sentToPhone) { setError('Tap “Get code” first.'); return; }

    const token = code.trim();
    const normalizedPhone = sentToPhone;
    const trimmedEmail = email.trim();

    setLoading(true);
    try {
      // 1) Check code with our API (Twilio Verify)
      const r = await fetch('/api/verify/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, code: token }),
      });
      const j = await r.json();
      if (!j.approved) throw new Error(j.error || 'Invalid or expired code.');

      // 2) Create Supabase user with PHONE (already verified by Twilio)
      const su = await sb.auth.signUp({ phone: normalizedPhone, password });
      if (su.error) {
        const m = su.error.message?.toLowerCase() ?? '';
        if (m.includes('already') && m.includes('registered')) {
          setError('This phone number is already associated with an account.');
          setLoading(false);
          return;
        }
        throw su.error;
      }

      // ensure session; then attach email (email confirmation is disabled)
      let sess = (await sb.auth.getSession()).data.session;
      if (!sess) {
        const si = await sb.auth.signInWithPassword({ phone: normalizedPhone, password });
        if (si.error) throw si.error;
        sess = si.data.session;
      }

      if (trimmedEmail) {
        const upd = await sb.auth.updateUser({ email: trimmedEmail });
        if (upd.error) {
          // non-fatal
          setNotice('Account created with phone. Adding email failed: ' + upd.error.message);
        }
      }

      window.location.replace('/consumer');
    } catch (e: any) {
      const msg = e?.message?.toLowerCase?.() ?? '';
      if (msg.includes('expired') || msg.includes('invalid')) {
        setError('Invalid or expired code. Use the newest code or tap “Resend”.');
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
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-white/70 text-sm">You can browse deals without an account. You’ll sign in when you redeem.</p>

      <section className="mt-6 rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Email address</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
            {email && emailTaken && <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">This email is already associated with an account.</p>}
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Mobile phone</label>
            <div className="flex gap-2">
              <input
                required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+61…" readOnly={otpState === 'code_sent'}
                className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
              <button
                type="button" onClick={handleSendCode} disabled={!canRequestCode}
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
            {phone && phoneTaken && <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">This phone number is already associated with an account.</p>}

            <div className="mt-2">
              <input
                value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code" inputMode="numeric"
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-white/60 mb-1">Create a password</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Confirm password</label>
              <input
                type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
              {confirm && password !== confirm && (
                <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">Passwords don’t match.</p>
              )}
            </div>
          </div>

          {error && <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">{error}</div>}
          {notice && <div className="rounded-2xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)] text-sm">{notice}</div>}

          <button disabled={!canSubmit} type="submit" className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60">
            {loading ? 'Please wait…' : 'Sign up'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button onClick={handleGoogle} className="mt-5 w-full rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15">
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-white/50">
          Already have an account? <Link href="/signin" className="text-[var(--color-brand-600)] hover:underline">Sign in</Link>
        </p>
      </section>

      <div className="h-24" />
    </main>
  );
}
