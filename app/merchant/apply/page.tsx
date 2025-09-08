'use client';

import { useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

function MerchantApplyPage() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data: sessionRes } = await sb.auth.getSession();
      let userId = sessionRes.session?.user?.id ?? null;

      // if user not logged in, sign them up by email (magic link)
      if (!userId) {
        const { data: sign, error: signErr } = await sb.auth.signUp({
          email,
          options: {
            data: { full_name: fullName, role: 'merchant_applicant' },
            emailRedirectTo: `${window.location.origin}/merchant`,
          },
        } as any); // <-- cast fixes the TS password error

        if (signErr) throw signErr;
        userId = sign.user?.id ?? null;
      }

      // insert into merchant_applications table
      const { error: insErr } = await sb.from('merchant_applications').insert({
        user_id: userId,
        contact_name: fullName,
        business_name: businessName,
        abn,
        phone,
        email,
        status: 'pending',
      });
      if (insErr) throw insErr;

      setSuccess(
        'Application submitted. Check your email to confirm your account. An admin will review and approve your business.'
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
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Business name</span>
          <input
            required
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Smith’s Coffee Co."
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>ABN</span>
          <input
            required
            value={abn}
            onChange={e => setAbn(e.target.value)}
            placeholder="11 111 111 111"
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Personal phone number</span>
          <input
            required
            value={phone}
            onChange={e => setPhone(e.target.value)}
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
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
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
