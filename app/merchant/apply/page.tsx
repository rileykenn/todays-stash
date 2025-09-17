'use client';

import { useMemo, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

type ApplyStatus = 'idle' | 'sending_code' | 'code_sent' | 'verifying' | 'verified';

function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');
  if (raw.startsWith('+')) return raw;               // already E.164
  if (/^0\d{8,}$/.test(raw)) return '+61' + raw.slice(1); // 04xx… -> +61 4xx…
  return raw; // let Supabase validate other countries if user typed +cc
}

export default function MerchantApplyPage() {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Phone code flow
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState<ApplyStatus>('idle');
  const [phoneVerified, setPhoneVerified] = useState(false);

  // UX state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canRequestCode = useMemo(
    () => phone.trim().length >= 8 && !phoneVerified,
    [phone, phoneVerified]
  );

  const canSubmit = useMemo(() => {
    return (
      fullName.trim() &&
      businessName.trim() &&
      abn.trim() &&
      phone.trim() &&
      email.trim() &&
      password.length >= 6 &&
      password === confirm &&
      phoneVerified &&
      !loading
    );
  }, [fullName, businessName, abn, phone, email, password, confirm, phoneVerified, loading]);

  function resetAlerts() {
    setErr(null);
    setOk(null);
  }

  async function handleGetCode() {
    resetAlerts();
    if (!canRequestCode) return;

    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized); // reflect normalization in the UI
    setCode('');
    setCodeSent('sending_code');

    try {
      const { error } = await sb.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'sms', shouldCreateUser: false },
      });
      if (error) throw error;
      setCodeSent('code_sent');
    } catch (e: any) {
      setErr(
        e?.message ??
          'Failed to send code. Double-check the phone format (e.g., +614XXXXXXXX) and that SMS is configured.'
      );
      setCodeSent('idle');
    }
  }

  async function handleVerifyCode() {
    resetAlerts();
    if (!code || code.length < 4) return;
    const normalized = normalizePhoneAU(phone.trim());

    setCodeSent('verifying');
    try {
      const { data, error } = await sb.auth.verifyOtp({
        phone: normalized,
        token: code.trim(),
        type: 'sms',
      });
      if (error) throw error;

      // If Supabase creates a session for the phone identity, sign it out immediately;
      // we only use this step to confirm ownership of the number.
      if (data?.session) await sb.auth.signOut();

      setPhoneVerified(true);
      setCodeSent('verified');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to verify code.');
      setCodeSent('code_sent');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (!phoneVerified) {
      setErr('Please verify your phone number before submitting.');
      return;
    }

    setLoading(true);
    try {
      // Ensure an authenticated user exists (sign in first, else sign up)
      let {
        data: { session },
      } = await sb.auth.getSession();

      if (!session) {
        const si = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (si.error) {
          const invalid =
            si.error.message?.toLowerCase().includes('invalid') ||
            si.error.message?.toLowerCase().includes('credentials');
          if (invalid) {
            const su = await sb.auth.signUp({
              email: email.trim(),
              password,
              options: {
                data: { full_name: fullName, role: 'merchant_applicant' },
                emailRedirectTo:
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/merchant`
                    : undefined,
              },
            });
            if (su.error) throw su.error;
            const g = await sb.auth.getSession();
            session = g.data.session;
          } else {
            throw si.error;
          }
        } else {
          session = si.data.session;
        }
      }

      const userId = session?.user?.id ?? null;

      const ins = await sb.from('merchant_applications').insert({
        user_id: userId,
        contact_name: fullName.trim(),
        business_name: businessName.trim(),
        abn: abn.trim(),
        phone: normalizePhoneAU(phone.trim()),
        email: email.trim(),
        status: 'pending',
      });
      if (ins.error) throw ins.error;

      setOk(
        'Thank you for submitting your application. Please wait while our friendly team review and approve your application.'
      );
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8 text-white">
      <h1 className="text-2xl font-extrabold mb-2">List your business on Today’s Stash</h1>
      <p className="text-white/70 text-sm mb-5">
        Tell us about you and your business. We’ll verify details and enable your merchant dashboard.
      </p>

      <form onSubmit={submit} className="rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5 space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal full name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Business name */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Business name</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Smith’s Coffee Co."
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* ABN */}
        <div>
          <label className="block text-xs text-white/60 mb-1">ABN</label>
          <input
            required
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            placeholder="11 111 111 111"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Phone with Get Code + Code field */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal phone number</label>
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
              onClick={handleGetCode}
              disabled={!canRequestCode || codeSent === 'sending_code'}
              className="rounded-xl px-4 py-2 bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
            >
              {codeSent === 'sending_code' ? 'Sending…' : phoneVerified ? 'Verified' : 'Get code'}
            </button>
          </div>

          {codeSent !== 'idle' && !phoneVerified && (
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
                onClick={handleVerifyCode}
                disabled={codeSent === 'verifying' || !code}
                className="rounded-xl px-4 py-2 bg-[var(--color-brand-600)] text-sm font-semibold hover:brightness-110 disabled:opacity-60"
              >
                {codeSent === 'verifying' ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          )}

          {phoneVerified && (
            <p className="mt-1 text-xs text-[color:rgb(16_185_129)]">Phone number verified.</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Password + Confirm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/60 mb-1">Create a password</label>
            <input
              type="password"
              required
              value={password}
              minLength={6}
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
              value={confirm}
              minLength={6}
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
        {err && (
          <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)] text-sm">
            {ok}
          </div>
        )}

        {/* Submit */}
        <button
          disabled={!canSubmit}
          type="submit"
          className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'Submitting…' : 'Submit application'}
        </button>

        <p className="text-xs text-white/50">
          By submitting, you agree that we may contact you to verify your business details.
          Notifications are coming soon.
        </p>
      </form>

      <div className="h-24" />
    </main>
  );
}
