'use client';

import { FormEvent, useState } from 'react';
import { sb as supabase } from '@/lib/supabaseBrowser';

type Step = 'request' | 'verify' | 'set' | 'done';
type Channel = 'email' | 'sms';

export default function ResetPage() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState(''); // email or phone (+E.164)
  const [channel, setChannel] = useState<Channel | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksLikePhone = (v: string) => /^\+?\d{8,15}$/.test(v.trim());
  const looksLikeEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());

  async function onRequestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const id = identifier.trim();
    const isEmail = looksLikeEmail(id);
    const isPhone = looksLikePhone(id);

    if (!isEmail && !isPhone) {
      setError('Enter a valid email or phone in E.164 format (e.g. +15551234567).');
      return;
    }

    setLoading(true);
    try {
      if (isEmail) {
        // Send EMAIL OTP (do not create new users, no redirect link)
        const { error } = await supabase.auth.signInWithOtp({
          email: id,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined,
          },
        });
        if (error) throw error;
        setChannel('email');
      } else {
        // Send SMS OTP (do not create new users)
        const { error } = await supabase.auth.signInWithOtp({
          phone: id.startsWith('+') ? id : `+${id}`, // small nudge if they forgot '+'
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setChannel('sms');
      }
      setStep('verify');
    } catch (err: any) {
      setError(err?.message ?? 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!channel) return;

    setLoading(true);
    try {
      if (channel === 'email') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'email',
          email: identifier.trim(),
          token: code.trim(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.verifyOtp({
          type: 'sms',
          phone: identifier.trim().startsWith('+') ? identifier.trim() : `+${identifier.trim()}`,
          token: code.trim(),
        });
        if (error) throw error;
      }
      // user now has a session; allow setting a new password
      setStep('set');
    } catch (err: any) {
      setError(err?.message ?? 'Invalid code.');
    } finally {
      setLoading(false);
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Could not set password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Reset your password</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={onRequestCode} className="space-y-4">
          <label className="text-sm">Email or phone</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="you@example.com or +15551234567"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            inputMode="email"
          />
          <p className="text-xs text-neutral-500">
            For phone, use international E.164 format starting with “+”.
          </p>
          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Submit'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={onVerifyCode} className="space-y-4 mt-4">
          <p className="text-sm">
            We sent a {channel === 'sms' ? 'text' : 'code email'} to your {channel}.
          </p>
          <input
            className="w-full rounded-xl border px-3 py-2 tracking-widest"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
        </form>
      )}

      {step === 'set' && (
        <form onSubmit={onSetPassword} className="space-y-4 mt-4">
          <label className="text-sm">New password</label>
          <input
            type="password"
            className="w-full rounded-xl border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="text-sm">Confirm password</label>
          <input
            type="password"
            className="w-full rounded-xl border px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="mt-6 space-y-4">
          <p>All set. Sign in with your new password.</p>
          <a href="/signin" className="inline-block rounded-xl border px-4 py-2">
            Back to sign in
          </a>
        </div>
      )}
    </main>
  );
}
