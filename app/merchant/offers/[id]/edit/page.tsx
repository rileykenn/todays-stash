'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantPhoto, setMerchantPhoto] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState<string>('');
  const [cap, setCap] = useState<number>(10);
  const [active, setActive] = useState<boolean>(true);

  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [useBizPhoto, setUseBizPhoto] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/merchant/login'); return; }

      const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
      if (mErr) { setError(mErr.message); setLoading(false); return; }
      if (!mid) { setError('No merchant linked to this account.'); setLoading(false); return; }
      const merchant_id = mid as string;

      const [{ data: offer, error: e1 }, { data: merchant, error: e2 }] = await Promise.all([
        sb.from('offers')
          .select('id,merchant_id,title,terms,per_day_cap,active,photo_url')
          .eq('id', id)
          .eq('merchant_id', merchant_id)
          .single(),
        sb.from('merchants')
          .select('photo_url')
          .eq('id', merchant_id)
          .single(),
      ]);

      if (e1) { setError(e1.message); setLoading(false); return; }
      if (e2) { setError(e2.message); setLoading(false); return; }
      if (!offer) { setError('Offer not found'); setLoading(false); return; }

      if (mounted) {
        setMerchantId(merchant_id);
        const mPhoto = merchant?.photo_url ?? null;
        setMerchantPhoto(mPhoto);

        setTitle(offer.title || '');
        setTerms(offer.terms || '');
        setCap(typeof offer.per_day_cap === 'number' ? offer.per_day_cap : 10);
        setActive(offer.active ?? true);
        setCurrentPhoto(offer.photo_url ?? null);
        setUseBizPhoto(!!mPhoto && offer.photo_url === mPhoto);
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [id, router]);

  const previewUrl = useMemo(() => {
    if (useBizPhoto) return merchantPhoto;
    if (file) return URL.createObjectURL(file);
    return currentPhoto;
  }, [useBizPhoto, merchantPhoto, file, currentPhoto]);

  async function save() {
    if (!id || !merchantId) return;
    setSaving(true);
    setError(null);

    let photo_url: string | null = currentPhoto;

    try {
      if (useBizPhoto) {
        photo_url = merchantPhoto ?? null;
      } else if (file) {
        // store under merchant-media/<merchantId>/offers/<offerId>.jpg
        const path = `${merchantId}/offers/${id}.jpg`;
        const { error: upErr } = await sb
          .storage
          .from('merchant-media')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from('merchant-media').getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      const updates: Partial<Offer> = {
        title: title.trim(),
        terms: terms.trim() || null,
        per_day_cap: Number.isFinite(cap) ? cap : null,
        active,
        photo_url,
      };

      const { error: updErr } = await sb
        .from('offers')
        .update(updates)
        .eq('id', id)
        .eq('merchant_id', merchantId);
      if (updErr) throw updErr;

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
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-4">Edit Deal</h1>
        <div className="h-24 rounded-2xl bg-white/10 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Edit Deal</h1>

      {error && (
        <div className="mb-4 rounded-2xl p-4 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)]">
          {error}
        </div>
      )}

      {/* Photo chooser */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5">
        <p className="text-sm font-semibold text-white/80 mb-3">Deal photo</p>

        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/20 border border-white/10 shrink-0">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/40 text-xs">No photo</div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--color-brand-600)]"
                checked={useBizPhoto}
                onChange={(e) => setUseBizPhoto(e.target.checked)}
              />
              Use business profile photo
            </label>

            {!useBizPhoto && (
              <label className="inline-flex items-center gap-2 text-sm rounded-full px-3 py-2 bg-white/10 border border-white/10 hover:bg-white/15 cursor-pointer">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Fields */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5 space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 2-for-1 Coffee 3–5pm"
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Terms</label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Weekdays only, dine-in, etc."
            rows={3}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Per-day cap</label>
            <input
              type="number"
              min={0}
              value={cap}
              onChange={(e) => setCap(parseInt(e.target.value || '0', 10))}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-600)]"
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--color-brand-600)]"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <Link
          href="/merchant/offers"
          className="flex-1 text-center rounded-full bg-white/10 border border-white/10 py-3 font-semibold hover:bg-white/15"
        >
          Cancel
        </Link>
      </div>
      
      {/* Spacer for bottom nav */}
      <div className="h-24" />
    </main>
  );
}
