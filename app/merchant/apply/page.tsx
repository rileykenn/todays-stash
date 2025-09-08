'use client';

import { useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

function MerchantApplyPage() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('Please enter a password with at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1) See if we already have a session
      let { data: { session } } = await sb.auth.getSession();
      let authedUserId = session?.user?.id ?? null;

      // 2) If no session, try to sign up with password
      if (!authedUserId) {
        const signUpRes = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: 'merchant_applicant' },
            emailRedirectTo: `${window.location.origin}/merchant/thanks`,
          },
        });

        if (signUpRes.error) {
          // If the user already exists, try sign-in instead
          const msg = signUpRes.error.message?.toLowerCase() || '';
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            const signInRes = await sb.auth.signInWithPassword({ email, password });
            if (signInRes.error) throw signInRes.error;
            authedUserId = signInRes.data.user?.id ?? null;
          } else {
            throw signUpRes.error;
          }
        } else {
          // Supabase returns a user even if email confirmation is required (no session yet)
          authedUserId = signUpRes.data.user?.id ?? null;
        }

        // Refresh session if possible (if email confirmation is OFF, this will exist now)
        if (!session) {
          const refreshed = await sb.auth.getSession();
          session = refreshed.data.session;
        }
      }

      // 3) Insert the application now (works with or without active session)
      //    We tie it to the known user_id if we have it; otherwise leave null.
      const ins = await sb.from('merchant_applications').insert({
        user_id: authedUserId, // may be null if RLS allows anonymous inserts; if not, ensure RLS permits this
        contact_name: fullName,
        business_name: businessName,
        abn,
        phone,
        email,
        status: 'pending',
      });
      if (ins.error) throw ins.error;

      // 4) Messaging depending on confirmation state
      if (!session) {
        setSuccess(
          'Check your email inbox to finalise your application. Click the link we sent to confirm your email.'
        );
      } else {
        setSuccess(
          'Application submitted. We’ll review and enable your merchant dashboard.'
        );
      }
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
