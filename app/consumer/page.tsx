'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // if this import turns red, change to: ../../lib/supabaseClient
import QRCode from 'react-qr-code';

const TTL = 90; // seconds

function getDeviceId() {
  if (typeof window === 'undefined') return 'web';
  const k = 'ts_device_id';
  let v = localStorage.getItem(k);
  if (!v) {
    v = 'web-' + crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}

type Offer = {
  id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
};

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  // load offers for this merchant
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,terms,per_day_cap,today_used')
        .eq('active', true)
        .eq('merchant_id', merchantId)
        .limit(50);

      if (error) {
        console.error('offers error', error);
        return;
      }
      setOffers((data ?? []) as Offer[]);
    })();
  }, [merchantId]);

  // create a new token
  const createToken = async () => {
    if (!activeOffer) return;
    const { data, error } = await supabase.rpc('create_redeem_session', {
      p_offer: activeOffer.id,
      p_merchant: merchantId,
      p_device: getDeviceId(),
      p_ttl_seconds: TTL,
    });
    if (error) {
      console.error('create token error', error);
      setTokenId(null);
      return;
    }
    setTokenId(data as string);
    setTimeLeft(TTL);
  };

  // countdown + auto-rotate
  useEffect(() => {
    if (!tokenId) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          createToken(); // rotate
          return TTL;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId, activeOffer?.id]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Today’s Stash — Deals</h1>

      {!activeOffer && (
        <div style={{ display: 'grid', gap: 12 }}>
          {offers.map((o) => {
            const left =
              (o.per_day_cap ?? 0) > 0
                ? Math.max((o.per_day_cap ?? 0) - (o.today_used ?? 0), 0)
                : undefined;
            return (
              <div key={o.id} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.title}</div>
                    {o.terms && <div style={{ fontSize: 12, color: '#6b7280' }}>{o.terms}</div>}
                  </div>
                  {left !== undefined && (
                    <span style={{ fontSize: 12, background: '#ecfdf5', color: '#065f46', borderRadius: 999, padding: '4px 8px' }}>
                      {left} left today
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setActiveOffer(o); setTokenId(null); setTimeLeft(0); }}
                  style={{ marginTop: 12, width: '100%', padding: '10px 14px', borderRadius: 12, background: '#10b981', color: 'white', fontWeight: 600 }}
                >
                  Show QR
                </button>
              </div>
            );
          })}
          {offers.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: 14 }}>
              No offers yet for this merchant. Add one in Supabase → <code>offers</code>.
            </div>
          )}
        </div>
      )}

      {activeOffer && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => { setActiveOffer(null); setTokenId(null); }}
            style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          >
            ← Back to offers
          </button>

          <h2 style={{ fontWeight: 600 }}>{activeOffer.title}</h2>
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            Show this QR at the counter. Code rotates every {TTL}s.
          </p>

          {!tokenId ? (
            <button
              onClick={createToken}
              style={{ marginTop: 8, padding: '10px 14px', borderRadius: 12, background: '#111827', color: 'white', fontWeight: 600 }}
            >
              Generate QR
            </button>
          ) : (
            <div style={{ marginTop: 16, display: 'grid', placeItems: 'center', gap: 8 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
                <QRCode value={tokenId} size={220} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Expires in {timeLeft}s</div>
              <button
                onClick={createToken}
                style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
              >
                Refresh now
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

