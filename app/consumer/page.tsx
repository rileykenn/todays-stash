'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import QRCode from 'react-qr-code';

type MerchantLite = { name: string; photo_url: string | null } | null;

type Offer = {
  id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  merchants?: MerchantLite; // normalized below
};

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [token, setToken] = useState<string | null>(null);

  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          id,
          title,
          terms,
          per_day_cap,
          today_used,
          merchants ( name, photo_url )
        `)
        .eq('merchant_id', merchantId)
        .eq('active', true);

      if (error) {
        console.error(error);
        setOffers([]);
        return;
      }

      // Normalize possible array nesting from Supabase
      const rows: Offer[] = (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        terms: r.terms ?? null,
        per_day_cap: r.per_day_cap ?? null,
        today_used: r.today_used ?? null,
        merchants: Array.isArray(r.merchants)
          ? (r.merchants[0] ?? null)
          : (r.merchants ?? null),
      }));

      setOffers(rows);
    }

    load();
  }, [merchantId]);

  async function generateQR(offerId: string) {
    setToken(null);
    const { data, error } = await supabase.rpc('create_redeem_session', {
      p_offer: offerId,
      p_merchant: merchantId,
      p_device: 'browser',
      p_ttl_seconds: 90,
    });
    if (error) {
      console.error(error);
      return;
    }
    setToken(data as string);
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Today’s Deals
      </h1>

      {offers.map((o) => {
        const leftToday = (o.per_day_cap ?? 0) - (o.today_used ?? 0);
        return (
          <div
            key={o.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              background: '#fff',
            }}
          >
            {o.merchants?.photo_url && (
              <img
                src={o.merchants.photo_url}
                alt={o.merchants?.name ?? 'Business photo'}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  borderRadius: 12,
                  marginBottom: 12,
                  objectFit: 'cover',
                }}
              />
            )}

            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{o.title}</h2>
            <p style={{ color: '#6b7280' }}>{o.merchants?.name ?? ''}</p>
            {o.terms && <p style={{ color: '#9ca3af' }}>{o.terms}</p>}

            <p style={{ marginTop: 8 }}>Left today: {leftToday}</p>

            <button
              onClick={() => generateQR(o.id)}
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#10b981',
                color: 'white',
                fontWeight: 600,
              }}
            >
              Show QR
            </button>
          </div>
        );
      })}

      {token && (
        <div style={{ marginTop: 16 }}>
          <QRCode value={token} size={180} />
        </div>
      )}
    </main>
  );
}
