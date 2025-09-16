'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type Offer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  active: boolean | null;
  photo_url: string | null;
  savings_amount: number | null;
};

type Merchant = {
  id: string;
  name: string | null;
  photo_url: string | null;
};

export default function NewOfferPage() {
  const router = useRouter();

  // merchant context
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state (strings to avoid cursor jump)
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState('');
  const [capInput, setCapInput] = useState('');        // string, normalize on blur
  const [savingsInput, setSavingsInput] = useState(''); // string, normalize on blur
  const [active, setActive] = useState<boolean>(true);

  const [useBizPhoto, setUseBizPhoto] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);

  // validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Preview image
  const previewUrl = useMemo(() => {
    if (!useBizPhoto && file) return URL.createObjectURL(file);
    return merchant?.photo_url ?? null;
  }, [useBizPhoto, file, merchant?.photo_url]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/merchant/login'); return; }

      try {
        const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
        if (mErr) throw mErr;
        if (!mid) { setError('This account is not linked to a merchant.'); return; }

        const { data, error } = await sb
          .from('merchants')
          .select('id,name,photo_url')
          .eq('id', mid as string)
          .single();
        if (error) throw error;

        if (!mounted) return;
        setMerchant(data as Merchant);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load merchant');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  // Helpers
  const moneyPattern = /^\d{0,7}(\.\d{0,2})?$/; // up to millions, 2dp
  const intPattern = /^\d{0,6}$/;               // up to 6 digits for cap

  function normalizeMoneyStr(s: string) {
    if (!s) return '';
    // trim leading zeros like "000.50" -> "0.50"
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

  const isFormValid = () => Object.keys(validateAll()).length === 0;

  async function createOffer() {
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      // mark all as touched to show messages
      setTouched({ title: true, terms: true, cap: true, savings: true });
      return;
    }

    if (!merchant) return;
    setSaving(true);
    setError(null);

    try {
      const per_day_cap = Number(capInput);
      const savings_amount = Math.round(Number(savingsInput) * 100) / 100;

      // 1) create row first to get id
      const insertPayload: Partial<Offer> = {
        merchant_id: merchant.id,
        title: title.trim(),
        terms: terms.trim(),
        per_day_cap,
        active,
        today_used: 0,
        savings_amount,
        photo_url: useBizPhoto ? (merchant.photo_url ?? null) : null,
      };

      const { data: created, error: insErr } = await sb
        .from('offers')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      const newId = (created as { id: string }).id;

      // 2) if uploading a custom photo, upload and patch the row
      if (!useBizPhoto && file) {
        const path = `${merchant.id}/offers/${newId}.jpg`;
        const { error: upErr } = await sb.storage
          .from('merchant-media')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;

        const { data: pub } = sb.storage.from('merchant-media').getPublicUrl(path);
        const { error: updErr } = await sb
          .from('offers')
          .update({ photo_url: pub.publicUrl })
          .eq('id', newId);
        if (updErr) throw updErr;
      }

      router.replace('/merchant/offers');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create offer');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-4">New Deal</h1>
        <div className="h-24 rounded-2xl bg-white/10 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
      <h1 className="text-2xl font-bold mb-4">New Deal</h1>

      {error && (
        <div className="mb-4 rounded-2xl p-4 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)]">
          {error}
        </div>
      )}

      {/* Live preview card */}
      <section className="mb-5">
        <p className="text-sm font-semibold text-white/70 mb-2">Preview</p>
        <div className="bg-[rgb(24_32_45)] rounded-2xl p-3 border border-white/10">
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/20 shrink-0">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-white/40 text-xs">No photo</div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-base font-semibold leading-tight">
                {title || 'Your deal title'}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">{merchant?.name || 'Your business'}</p>
              {terms && <p className="text-xs text-white/60 mt-1">{terms}</p>}
              <div className="mt-3 text-xs text-white/60 flex items-center justify-between">
                <span>Cap: {capInput || '—'}</span>
                <span>Used today: 0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5 space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            placeholder="e.g., 2-for-1 Coffee 3–5pm"
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
            placeholder="Weekdays only, dine-in, etc."
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
                // strip leading zeros
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
                aria-label="Savings in Australian dollars"
              />
            </div>
            {touched.savings && fieldErrors.savings && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.savings}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--color-brand-600)]"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--color-brand-600)]"
              checked={useBizPhoto}
              onChange={(e) => setUseBizPhoto(e.target.checked)}
            />
            Use business photo
          </label>
        </div>

        {!useBizPhoto && (
          <label className="inline-flex items-center gap-2 text-sm rounded-full px-3 py-2 bg-white/10 border border-white/10 hover:bg-white/15 cursor-pointer w-fit">
            Upload custom image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={createOffer}
          disabled={saving}
          className="flex-1 rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create Deal'}
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
