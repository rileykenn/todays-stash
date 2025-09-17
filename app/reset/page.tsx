'use client';

import { FormEvent, useState } from 'react';
import { sb as supabase } from '@/lib/supabaseBrowser';

type Step = 'request' | 'verify' | 'set' | 'done';

export default function ResetPage() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');        // email or phone
  const [channel, setChannel] = useState<'email'|'sms'>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const looksLikePhone = (v: string) => /^\+?\d{8,15}$/.test(v.trim());
  const looksLikeEmail = (v: string) => /\S+@\S+\.\S+/.test(v.trim());

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const id = identifier.trim();
    if (!looksLikeEmail(id) && !looksLikePhone(id)) {
      setError('Enter a valid email or phone (E.164 like +15551234567).');
      return;
    }

    setLoading(true);
    try {
      if (looksLikeEmail(id)) {
        const { error } = await supabase.auth.signInWithOtp({
          email: id,
          options: { emailRedirectTo: undefined }, // no redirect, we verify with code here
        });
        if (error) throw error;
        setChannel('email');
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: id });
        if (error) throw error;
        setChannel('sms');
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.message ?? 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!channel) return;

    setLoading(true);
    try {
      if (channel === 'email') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'email',
          email: identifier,
          token: code.trim(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.verifyOtp({
          type: 'sms',
          phone: identifier,
          token: code.trim(),
        });
        if (error) throw error;
      }
      // At this point the user has a session and we can set a new password
      setStep('set');
    } catch (err: any) {
      setError(err.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStep('done');
    } catch (err: any) {
      setError(err.message ?? 'Could not set password');
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
        <form onSubmit={handleRequest} className="space-y-4">
          <label className="text-sm">Email or phone</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="you@example.com or +15551234567"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            inputMode="email"
            autoComplete="username"
          />
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
        <form onSubmit={handleVerify} className="space-y-4 mt-4">
          <p className="text-sm">
            We just sent a code to your {channel === 'sms' ? 'phone' : 'email'}.
            Enter it below.
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
        <form onSubmit={handleSetPassword} className="space-y-4 mt-4">
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
          <p>All set. Go sign in with your new password.</p>
          <a href="/signin" className="inline-block rounded-xl border px-4 py-2">
            Back to sign in
          </a>
        </div>
      )}
    </main>
  );
}
