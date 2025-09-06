'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function NewOffer() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState('');
  const [cap, setCap] = useState(10);
  const [loading, setLoading] = useState(false);

  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  async function submit() {
    setLoading(true);
    const { data, error } = await sb
      .from('offers')
      .insert({
        merchant_id: merchantId,
        title,
        terms,
        per_day_cap: cap,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert(`Created offer: ${data.title}`);
      router.push('/merchant');
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Create New Offer
      </h1>

      <label>Title</label>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <label>Terms</label>
      <input
        value={terms}
        onChange={e => setTerms(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <label>Per Day Cap</label>
      <input
        type="number"
        value={cap}
        onChange={e => setCap(Number(e.target.value))}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <button
        onClick={submit}
        disabled={loading}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: '#10b981',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {loading ? 'Saving...' : 'Create Offer'}
      </button>
    </main>
  );
}
