'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type Offer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  active: boolean | null;
  photo_url: string | null;
};

export default function NewOfferPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantPhoto, setMerchantPhoto] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState<string>('');
  const [cap, setCap] = useState<number>(10);
  const [active, setActive] = useState<boolean>(true);

  const [useBizPhoto, setUseBizPhoto] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => {
    if (useBizPhoto) return merchantPhoto;
    if (file) return URL.createObjectURL(file);
    return null;
  }, [useBizPhoto, merchantPhoto, file]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      // get merchant for this user
      const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
      if (mErr) { setError(mErr.message); setLoading(false); return; }
      if (!mid) { setError('No merchant linked to this account.'); setLoading(false); return; }
      const merchant_id = mid as string;

      // fetch merchant profile photo for convenience
      const { data: merchant, error: e2 } = await sb
        .from('merchants')
        .select('photo_url')
        .eq('id', merchant_id)
        .single();
      if (e2) { setError(e2.message); setLoading(false); return; }

      if (!mounted) return;
      setMerchantId(merchant_id);
      setMerchantPhoto(merchant?.photo_url ?? null);
      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [router]);

  async function createOffer() {
    if (!merchantId) return;
    setSaving(true);
    setError(null);

    try {
      // 1) Insert the offer first (without photo) to get an id
      const insertPayload: Partial<Offer> = {
        merchant_id: merchantId,
        title: title.trim(),
        terms: terms.trim() || null,
        per_day_cap: Number.isFinite(cap) ? cap : null,
        active,
        photo_url: null, // set after upload if needed
      };

      const { data: inserted, error: insErr } = await sb
        .from('offers')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      const offerId = inserted?.id as string;
      let photo_url: string | null = null;

      // 2) Decide photo source
      if (useBizPhoto) {
        photo_url = merchantPhoto ?? null;
      } else if (file) {
        const path = `${merchantId}/offers/${offerId}.jpg`;
        const { error: upErr } = await sb
          .storage
          .from('merchant-media')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from('merchant-media').getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      // 3) If we have a photo_url, update the offer
      if (photo_url) {
        const { error: updErr } = await sb
          .from('offers')
          .update({ photo_url })
          .eq('id', offerId)
          .eq('merchant_id', merchantId);
        if (updErr) throw updErr;
      }

      router.replace('/merchant/offers');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Create Deal</h1>
        <div>Loading…</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Create Deal</h1>

      {error && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 2-for-1 Coffee 3–5pm"
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Terms</span>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Weekdays only, dine-in, etc."
            rows={3}
            style={{ padding: 10, borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Per-day cap</span>
          <input
            type="number"
            min={0}
            value={cap}
            onChange={(e) => setCap(parseInt(e.target.value || '0', 10))}
            style={{ width: 160, padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>

        <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="useBiz"
              type="checkbox"
              checked={useBizPhoto}
              onChange={(e) => setUseBizPhoto(e.target.checked)}
            />
            <label htmlFor="useBiz">Use business profile photo</label>
          </div>

          {!useBizPhoto && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Upload deal photo</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          )}

          <div style={{ width: 160, height: 160, borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>No photo</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={createOffer}
            disabled={saving}
            style={{ padding: '10px 14px', borderRadius: 10, background: '#10b981', color: 'white', fontWeight: 600 }}
          >
            {saving ? 'Creating…' : 'Create Deal'}
          </button>
          <a href="/merchant/offers" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb' }}>Cancel</a>
        </div>
      </div>
    </main>
  );
}
