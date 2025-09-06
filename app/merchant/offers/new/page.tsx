'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function NewOffer() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState('');
  const [cap, setCap] = useState(10);
  const [useBizPhoto, setUseBizPhoto] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  async function submit() {
    if (!title.trim()) return alert('Title is required');

    setSaving(true);

    // 1) Create the offer row first (RLS will allow because you’re staff)
    const { data: offer, error: insertErr } = await sb
      .from('offers')
      .insert({
        merchant_id: merchantId,
        title,
        terms,
        per_day_cap: cap,
        active: true,
      })
      .select()
      .single();

    if (insertErr || !offer) {
      setSaving(false);
      return alert(insertErr?.message ?? 'Insert failed');
    }

    let photoUrl: string | null = null;

    // 2) Determine photo source
    if (useBizPhoto) {
      const { data: m } = await sb
        .from('merchants')
        .select('photo_url')
        .eq('id', merchantId)
        .single();
      photoUrl = m?.photo_url ?? null;
    } else if (file) {
      const path = `${merchantId}/offers/${offer.id}-${Date.now()}.jpg`;
      const { error: uploadErr } = await sb.storage
        .from('merchant-media')
        .upload(path, file, { upsert: true });

      if (uploadErr) {
        setSaving(false);
        return alert(uploadErr.message);
      }
      const { data } = sb.storage.from('merchant-media').getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    // 3) If we have a photo URL, update the offer
    if (photoUrl) {
      const { error: upErr } = await sb
        .from('offers')
        .update({ photo_url: photoUrl })
        .eq('id', offer.id);

      if (upErr) {
        setSaving(false);
        return alert(upErr.message);
      }
    }

    setSaving(false);
    alert('Offer created');
    router.push('/merchant'); // back to dashboard
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Create New Offer</h1>

      <label>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <label>Terms</label>
      <input
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <label>Per Day Cap</label>
      <input
        type="number"
        value={cap}
        onChange={(e) => setCap(Number(e.target.value))}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      <div style={{ margin: '12px 0', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={useBizPhoto}
            onChange={(e) => setUseBizPhoto(e.target.checked)}
          />
          Use business profile photo
        </label>

        {!useBizPhoto && (
          <div style={{ marginTop: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={saving}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: '#10b981',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {saving ? 'Saving…' : 'Create Offer'}
      </button>
    </main>
  );
}
