'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type Offer = {
  id: string;
  title: string | null;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  active: boolean | null;
  photo_url: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  photo_url: string | null;
};

function AdminMerchantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login?next=' + encodeURIComponent(window.location.pathname));
        return;
      }

      const { data: adminRes } = await sb.rpc('is_admin');
      if (!adminRes) {
        router.replace('/consumer');
        return;
      }

      const id = params?.id as string;
      const [{ data: m, error: mErr }, { data: os, error: oErr }] = await Promise.all([
        sb.from('merchants').select('id,name,photo_url').eq('id', id).single(),
        sb.from('offers')
          .select('id,title,terms,per_day_cap,today_used,active,photo_url')
          .eq('merchant_id', id)
          .order('id', { ascending: false }),
      ]);

      if (mErr || oErr) {
        setError(mErr?.message || oErr?.message || 'Error');
        return;
      }
      if (!mounted) return;

      setMerchant(m as Merchant);
      setOffers((os || []) as Offer[]);
      setLoading(false);
    }
    init();
    return () => {
      mounted = false;
    };
  }, [router, params]);

  async function saveMerchant() {
    if (!merchant) return;
    const { error } = await sb
      .from('merchants')
      .update({ name: merchant.name, photo_url: merchant.photo_url })
      .eq('id', merchant.id);
    if (error) setError(error.message);
  }

  async function toggleActive(offer: Offer) {
    const next = !(offer.active ?? true);
    const { error } = await sb.from('offers').update({ active: next }).eq('id', offer.id);
    if (error) {
      setError(error.message);
      return;
    }
    setOffers(prev => prev.map(o => (o.id === offer.id ? { ...o, active: next } : o)));
  }

  return (
    <main style={{ maxWidth: 980, margin: '40px auto', padding: 16 }}>
      <a href="/admin" style={{ display: 'inline-block', marginBottom: 8 }}>
        &larr; Back
      </a>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Merchant detail</h1>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}

      {loading ? (
        <div>Loading…</div>
      ) : (
        merchant && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Business</div>
              <label style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Business name</span>
                <input
                  value={merchant.name ?? ''}
                  onChange={e => setMerchant({ ...merchant, name: e.target.value })}
                  style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Photo URL (optional)</span>
                <input
                  value={merchant.photo_url ?? ''}
                  onChange={e => setMerchant({ ...merchant, photo_url: e.target.value })}
                  style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
                />
              </label>
              <button
                onClick={saveMerchant}
                style={{ padding: '8px 12px', borderRadius: 10, background: '#111827', color: '#fff' }}
              >
                Save
              </button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Active deals</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {offers.map(o => (
                  <div
                    key={o.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{o.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 14 }}>
                        Cap: {o.per_day_cap ?? '—'} • Used today: {o.today_used ?? 0} •{' '}
                        {o.active ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => toggleActive(o)}
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
                      >
                        {o.active ? 'Disable' : 'Enable'}
                      </button>
                      <a
                        href={`/merchant/offers/${o.id}/edit`}
                        target="_blank"
                        style={{ padding: '8px 12px', borderRadius: 10, background: '#3b82f6', color: '#fff' }}
                      >
                        Edit
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </main>
  );
}

export default AdminMerchantDetailPage;
