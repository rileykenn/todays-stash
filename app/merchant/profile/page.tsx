'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type Merchant = {
  id: string;
  name: string | null;
  address: string | null;
  photo_url: string | null;
};

export default function MerchantProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [merchant, setMerchant] = useState<Merchant | null>(null);

  // form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState(''); // may be empty for old test merchants
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return photoUrl ?? null;
  }, [file, photoUrl]);

  function validateAll() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Business name is required.';
    if (!address.trim()) errs.address = 'Business address is required.';
    setFieldErrors(errs);
    return errs;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { router.replace('/merchant/login'); return; }

        const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
        if (mErr) throw mErr;
        if (!mid) { setError('This account is not linked to a merchant.'); return; }

        const { data, error } = await sb
          .from('merchants')
          .select('id,name,address,photo_url')
          .eq('id', mid as string)
          .single();
        if (error) throw error;

        if (!mounted) return;
        const m = data as Merchant;
        setMerchant(m);
        setName(m.name ?? '');
        setAddress(m.address ?? ''); // can be empty for legacy merchants
        setPhotoUrl(m.photo_url ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load merchant profile');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [router]);

  async function save() {
    setOk(null);
    const errs = validateAll();
    if (Object.keys(errs).length > 0 || !merchant) {
      setTouched({ name: true, address: true });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let newPhotoUrl = photoUrl ?? null;

      // upload new photo if provided
      if (file) {
        const path = `${merchant.id}/profile.jpg`;
        const { error: upErr } = await sb.storage
          .from('merchant-media')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;

        const { data: pub } = sb.storage.from('merchant-media').getPublicUrl(path);
        newPhotoUrl = pub.publicUrl;
      }

      const payload = {
        name: name.trim(),
        address: address.trim(),
        photo_url: newPhotoUrl,
      };

      const { error: updErr } = await sb
        .from('merchants')
        .update(payload)
        .eq('id', merchant.id);
      if (updErr) throw updErr;

      setPhotoUrl(newPhotoUrl);
      setOk('Changes saved.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-4">Business Profile</h1>
        <div className="h-24 rounded-2xl bg-white/10 animate-pulse" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-4">Business Profile</h1>
        <div className="rounded-2xl p-4 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)]">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Business Profile</h1>
        <Link
          href="/merchant/offers"
          className="rounded-full px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/15"
        >
          Back to Deals
        </Link>
      </div>

      {/* Photo card */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5">
        <p className="text-sm font-semibold text-white/80 mb-3">Profile photo</p>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/20 border border-white/10 shrink-0">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Business" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/40 text-xs">No photo</div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-sm rounded-full px-3 py-2 bg-white/10 border border-white/10 hover:bg-white/15 cursor-pointer">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </section>

      {/* Form card */}
      <section className="bg-[rgb(24_32_45)] rounded-2xl p-4 border border-white/10 mb-5 space-y-4">
        <div>
          <label className="block text-xs text-white/60 mb-1">Business name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="e.g., Bella’s Cafe"
            className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none
              ${touched.name && fieldErrors.name ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
          />
          {touched.name && fieldErrors.name && (
            <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">Business address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, address: true }))}
            placeholder="Street, suburb, state"
            className={`w-full bg-black/20 border rounded-xl px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none
              ${touched.address && fieldErrors.address ? 'border-[color:rgb(248_113_113)]' : 'border-white/10 focus:border-[var(--color-brand-600)]'}`}
          />
          {touched.address && fieldErrors.address && (
            <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">{fieldErrors.address}</p>
          )}
          <p className="mt-1 text-xs text-white/50">
            This was optional for early test merchants — please add it now so customers can find you.
          </p>
        </div>
      </section>

      {/* Actions / status */}
      {ok && <div className="mb-3 rounded-2xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)]">{ok}</div>}
      {error && <div className="mb-3 rounded-2xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)]">{error}</div>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Submit Changes'}
      </button>

      {/* Spacer for bottom nav */}
      <div className="h-24" />
    </main>
  );
}
