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
  savings_amount: number | null;
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

  // form fields
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState('');
  const [capInput, setCapInput] = useState('');
  const [savingsInput, setSavingsInput] = useState('');
  const [active, setActive] = useState<boolean>(true);

  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [useBizPhoto, setUseBizPhoto] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);

  // validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // preview image
  const previewUrl = useMemo(() => {
    if (useBizPhoto) return merchantPhoto;
    if (file) return URL.createObjectURL(file);
    return currentPhoto;
  }, [useBizPhoto, merchantPhoto, file, currentPhoto]);

  const moneyPattern = /^\d{0,7}(\.\d{0,2})?$/;
  const intPattern = /^\d{0,6}$/;

  function normalizeMoneyStr(s: string) {
    if (!s) return '';
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2);
  }

  function validateAll() {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!terms.trim()) errs.terms = 'Terms are required.';
    if (!capInput || !intPattern.test(capInput) || Number(capInput) <= 0) {
      errs.cap = 'Enter a positive whole number.';
    }
    if (!savingsInput || !moneyPattern.test(savingsInput) || Number(savingsInput) <= 0) {
      errs.savings = 'Enter a positive amount (max 2 decimals).';
    }
    setFieldErrors(errs);
    return errs;
  }

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
          .select('id,merchant_id,title,terms,per_day_cap,active,photo_url,savings_amount')
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
        setCapInput(offer.per_day_cap != null ? String(offer.per_day_cap) : '');
        setActive(offer.active ?? true);
        setCurrentPhoto(offer.photo_url ?? null);
        setUseBizPhoto(!!mPhoto && offer.photo_url === mPhoto);
        setSavingsInput(
          offer.savings_amount != null ? offer.savings_amount.toFixed(2) : ''
        );
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [id, router]);

  async function save() {
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setTouched({ title: true, terms: true, cap: true, savings: true });
      return;
    }

    if (!id || !merchantId) return;
    setSaving(true);
    setError(null);

    let photo_url: string | null = currentPhoto;

    try {
      if (useBizPhoto) {
        photo_url = merchantPhoto ?? null;
      } else if (file) {
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
        terms: terms.trim(),
        per_day_cap: Number(capInput),
        active,
        photo_url,
        savings_amount: Math.round(Number(savingsInput) * 100) / 100,
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

      {/* Form */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5 space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none
              ${touched.title && fieldErrors.title ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
          />
          {touched.title && fieldErrors.title && (
            <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Terms</label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, terms: true }))}
            rows={3}
            className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none
              ${touched.terms && fieldErrors.terms ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
          />
          {touched.terms && fieldErrors.terms && (
            <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.terms}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Per-day cap</label>
            <input
              inputMode="numeric"
              pattern="\d*"
              value={capInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || intPattern.test(v)) setCapInput(v);
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, cap: true }));
                if (capInput === '') return;
                const n = Number(capInput);
                setCapInput(Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : '');
              }}
              className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm focus:outline-none
                ${touched.cap && fieldErrors.cap ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
            />
            {touched.cap && fieldErrors.cap && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.cap}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Savings (AUD)</label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm">A$</span>
              <input
                inputMode="decimal"
                value={savingsInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || moneyPattern.test(v)) setSavingsInput(v);
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, savings: true }));
                  setSavingsInput((s) => normalizeMoneyStr(s));
                }}
                className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm focus:outline-none
                  ${touched.savings && fieldErrors.savings ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
              />
            </div>
            {touched.savings && fieldErrors.savings && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.savings}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-[var(--color-brand-600)]"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span className="text-sm">Active</span>
        </div>
      </section>

      {/* Photo section */}
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

      <div className="h-24" />
    </main>
  );
}
