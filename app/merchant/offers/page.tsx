'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type Offer = {
  id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  active: boolean | null;
  photo_url: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  address: string | null;
  photo_url: string | null;
};

export default function MerchantOffersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      try {
        // Merchant for this user
        const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
        if (mErr) throw mErr;
        if (!mid) {
          setError('This account is not linked to a merchant yet.');
          setLoading(false);
          return;
        }
        const merchant_id = mid as string;

        // Load merchant + offers
        const [{ data: m }, { data: os, error: oErr }] = await Promise.all([
          sb.from('merchants').select('id,name,address,photo_url').eq('id', merchant_id).single(),
          sb.from('offers')
            .select('id,title,terms,per_day_cap,today_used,active,photo_url')
            .eq('merchant_id', merchant_id)
            .order('id', { ascending: false }),
        ]);

        if (oErr) throw oErr;

        if (!mounted) return;
        const merch = (m as Merchant) ?? { id: merchant_id, name: '', address: '', photo_url: null };
        setMerchant(merch);
        setOffers((os || []) as Offer[]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [router]);

  async function toggleActive(offer: Offer) {
    const next = !(offer.active ?? true);
    const { error } = await sb.from('offers').update({ active: next }).eq('id', offer.id);
    if (error) return alert('Failed to update: ' + error.message);
    setOffers(prev => prev.map(o => (o.id === offer.id ? { ...o, active: next } : o)));
  }

  async function hardDelete(offer: Offer) {
    if (!confirm('Permanently delete this offer?')) return;
    const { error } = await sb.from('offers').delete().eq('id', offer.id);
    if (error) return alert('Failed to delete: ' + error.message);
    setOffers(prev => prev.filter(o => o.id !== offer.id));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-3">My Deals</h1>
        <div className="h-20 rounded-2xl bg-white/10 animate-pulse" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
        <h1 className="text-xl font-bold mb-3">My Deals</h1>
        <div className="rounded-2xl p-4 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)]">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 text-white">
      {/* Page header with actions */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Deals</h1>
        <div className="flex gap-2">
          <Link
            href="/merchant/profile"
            className="rounded-full px-4 py-2 bg-[color:rgb(59_130_246)] text-white font-medium hover:brightness-110 transition"
          >
            Edit Business Profile
          </Link>
          <Link
            href="/merchant/offers/new"
            className="rounded-full px-4 py-2 bg-[var(--color-brand-600)] text-white font-semibold hover:brightness-110 transition"
          >
            New Deal
          </Link>
        </div>
      </div>

      {/* Empty state or list */}
      {offers.length === 0 ? (
        <section className="rounded-2xl p-5 bg-[rgb(24_32_45)] border border-white/10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-black/20 grid place-items-center text-white/50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="mt-3 text-base font-semibold">No deals yet</h2>
          <p className="mt-1 text-sm text-white/60">
            Create your first deal to start appearing in the consumer feed.
          </p>
          <Link
            href="/merchant/offers/new"
            className="mt-4 inline-block rounded-full px-5 py-3 bg-[var(--color-brand-600)] font-semibold hover:brightness-110"
          >
            + New Deal
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {offers.map((o) => (
            <li key={o.id} className="bg-[rgb(24_32_45)] rounded-2xl p-3 border border-white/10">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/20 shrink-0">
                  {o.photo_url || merchant?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(o.photo_url ?? merchant?.photo_url) as string}
                      alt={o.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-white/40 text-xs">No photo</div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold leading-tight">{o.title}</h3>
                      {o.terms && <p className="text-xs text-white/60 mt-1">{o.terms}</p>}
                    </div>

                    <span
                      className={`text-xs rounded-full px-2 py-1 border ${
                        (o.active ?? true)
                          ? 'bg-[color:rgb(16_185_129_/_0.18)] border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)]'
                          : 'bg-white/10 border-white/15 text-white/60'
                      }`}
                    >
                      {(o.active ?? true) ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                    <span>Cap: {o.per_day_cap ?? '—'}</span>
                    <span>Used today: {o.today_used ?? 0}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/merchant/offers/${o.id}/edit`}
                      className="rounded-full px-3 py-2 bg-white/10 border border-white/10 hover:bg-white/15 text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleActive(o)}
                      className="rounded-full px-3 py-2 bg-white/10 border border-white/10 hover:bg-white/15 text-sm"
                    >
                      {(o.active ?? true) ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => hardDelete(o)}
                      className="rounded-full px-3 py-2 bg-[color:rgb(239_68_68_/_0.2)] border border-[color:rgb(239_68_68_/_0.35)] text-[color:rgb(248_113_113)] hover:brightness-110 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Spacer for bottom nav */}
      <div className="h-24" />
    </main>
  );
}
