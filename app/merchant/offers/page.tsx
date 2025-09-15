'use client';

import { useEffect, useState } from 'react';
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

export default function MerchantOffersList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // must be signed in to view merchant offers
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      // fetch merchant tied to this user (via RPC)
      const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
      if (mErr) {
        setError(mErr.message);
        setLoading(false);
        return;
      }
      if (!mid) {
        // no merchant linked to this account
        setMerchantId(null);
        setOffers([]);
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setMerchantId(mid as string);
      await loadOffers(mid as string);
    }

    async function loadOffers(mid: string) {
      setLoading(true);
      setError(null);

      const { data, error } = await sb
        .from('offers')
        .select('id,title,terms,per_day_cap,today_used,active,photo_url')
        .eq('merchant_id', mid)
        .order('id', { ascending: false });

      if (!mounted) return;
      if (error) setError(error.message);
      else setOffers((data || []) as Offer[]);
      setLoading(false);
    }

    init();
    return () => { mounted = false; };
  }, [router]);

  async function toggleActive(offer: Offer) {
    const next = !(offer.active ?? true);
    const { error } = await sb.from('offers').update({ active: next }).eq('id', offer.id);
    if (error) {
      alert('Failed to update: ' + error.message);
      return;
    }
    setOffers(prev => prev.map(o => (o.id === offer.id ? { ...o, active: next } : o)));
  }

  async function hardDelete(offer: Offer) {
    if (!confirm('Permanently delete this offer?')) return;
    const { error } = await sb.from('offers').delete().eq('id', offer.id);
    if (error) {
      alert('Failed to delete: ' + error.message);
      return;
    }
    setOffers(prev => prev.filter(o => o.id !== offer.id));
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: '32px auto', padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>My Deals</h1>
        <div>Loading…</div>
      </main>
    );
  }

  // No merchant linked to this user account
  if (!merchantId) {
    return (
      <main style={{ maxWidth: 900, margin: '32px auto', padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>My Deals</h1>
        <div style={{ padding: 12, borderRadius: 8, background: '#fef3c7', color: '#92400e' }}>
          This account isn’t linked to a merchant yet. Ask an admin to add you to <code>merchant_staff</code>, or
          create a merchant profile.
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: '32px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>My Deals</h1>
        <a href="/merchant/offers/new" style={{ padding: '10px 14px', borderRadius: 10, background: '#10b981', color: 'white', fontWeight: 600 }}>
          New Deal
        </a>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {offers.length === 0 ? (
        <div style={{ marginTop: 16, color: '#6b7280' }}>No offers yet. Create your first one.</div>
      ) : (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {offers.map((o) => (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 12, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ width: 88, height: 88, background: '#f3f4f6', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {o.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.photo_url} alt={o.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>No photo</span>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 700 }}>{o.title}</div>
                {o.terms && <div style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>{o.terms}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12, color: '#374151' }}>
                  <span style={{ padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 999 }}>{`Cap: ${o.per_day_cap ?? '—'}`}</span>
                  <span style={{ padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 999 }}>{`Used today: ${o.today_used ?? 0}`}</span>
                  <span style={{ padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 999 }}>{(o.active ?? true) ? 'Active' : 'Disabled'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/merchant/offers/${o.id}/edit`} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>Edit</a>
                <button onClick={() => toggleActive(o)} style={{ padding: '8px 12px', borderRadius: 10, background: '#f3f4f6' }}>
                  {(o.active ?? true) ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => hardDelete(o)} style={{ padding: '8px 12px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
