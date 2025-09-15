'use client';

import { useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

function MerchantApplyPage() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // NEW

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // quick client-side password check (keeps the demo smooth)
    if (password.length < 6) {
      setError('Please enter a password with at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // ensure we have an authenticated user
      let {
        data: { session },
      } = await sb.auth.getSession();

      if (!session) {
        // Try to sign up first (with password)
        const signUpRes = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: 'merchant_applicant' },
            emailRedirectTo: `${window.location.origin}/merchant`,
          },
        });

        if (signUpRes.error) {
          // If the user already exists, try sign-in instead
          if (
            signUpRes.error.message?.toLowerCase().includes('already registered') ||
            signUpRes.error.message?.toLowerCase().includes('user already exists')
          ) {
            const signInRes = await sb.auth.signInWithPassword({ email, password });
            if (signInRes.error) throw signInRes.error;
          } else {
            throw signUpRes.error;
          }
        }

        // refresh session after sign-up/sign-in
        const g = await sb.auth.getSession();
        session = g.data.session;
      }

      const userId = session?.user?.id ?? null;
      if (!userId) {
        // If your project enforces email confirmation, you might not get a session yet.
        // For the demo, fail loudly so it’s clear what to change in Supabase Auth settings.
        throw new Error('Please verify your email, then try submitting again.');
      }

      // Insert application tied to this auth user
      const ins = await sb.from('merchant_applications').insert({
        user_id: userId,
        contact_name: fullName,
        business_name: businessName,
        abn,
        phone,
        email,
        status: 'pending',
      });

      if (ins.error) throw ins.error;

      setSuccess(
        'Application submitted. We’ll review and enable your merchant dashboard.'
      );
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        List your business on Today’s Stash
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Tell us about you and your business. We’ll verify details and enable your merchant dashboard.
      </p>

      <form
        onSubmit={submit}
        style={{
          display: 'grid',
          gap: 12,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 16,
          background: '#fff',
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Personal full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Business name</span>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Smith’s Coffee Co."
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>ABN</span>
          <input
            required
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            placeholder="11 111 111 111"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Personal phone number</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+61…"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Personal email address</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        {/* NEW: password field */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Create a password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>

        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        {success && <div style={{ color: '#065f46' }}>{success}</div>}

        <button
          disabled={loading}
          type="submit"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#111827',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          {loading ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </main>
  );
}

export default MerchantApplyPage;
