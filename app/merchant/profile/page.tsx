'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function MerchantProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : currentPhoto), [file, currentPhoto]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
      if (mErr) { setError(mErr.message); setLoading(false); return; }
      if (!mid) { setError('No merchant linked to this account.'); setLoading(false); return; }
      const merchant_id = mid as string;

      const { data: merchant, error: e2 } = await sb
        .from('merchants')
        .select('photo_url')
        .eq('id', merchant_id)
        .single();
      if (e2) { setError(e2.message); setLoading(false); return; }

      if (!mounted) return;
      setMerchantId(merchant_id);
      setCurrentPhoto(merchant?.photo_url ?? null);
      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [router]);

  async function save() {
    if (!merchantId) return;
    setSaving(true);
    setError(null);

    try {
      let photo_url = currentPhoto;

      if (file) {
        const path = `${merchantId}/photo.jpg`;
        const { error: upErr } = await sb
          .storage
          .from('merchant-media')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from('merchant-media').getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      const { error: updErr } = await sb
        .from('merchants')
        .update({ photo_url })
        .eq('id', merchantId);
      if (updErr) throw updErr;

      router.replace('/merchant');
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
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Business Profile</h1>
        <div>Loading…</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Business Profile</h1>

      {error && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ width: 180, height: 180, borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Business" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>No photo</span>
          )}
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Upload new photo</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: '10px 14px', borderRadius: 10, background: '#10b981', color: 'white', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <a href="/merchant" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb' }}>Cancel</a>
        </div>
      </div>
    </main>
  );
}
