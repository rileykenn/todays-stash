'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import QRCode from 'react-qr-code';

type MerchantLite = { name: string; photo_url: string | null } | null;

type Offer = {
  id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  merchants?: MerchantLite;
};

const TTL_SECONDS = 90;

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  async function loadOffers() {
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

    const rows: Offer[] = (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      terms: r.terms ?? null,
      per_day_cap: r.per_day_cap ?? null,
      today_used: r.today_used ?? null,
      merchants: Array.isArray(r.merchants) ? (r.merchants[0] ?? null) : (r.merchants ?? null),
    }));

    setOffers(rows);
  }

  useEffect(() => { loadOffers(); }, [merchantId]);

  async function generateAndStartTimer(offerId: string) {
    const { data, error } = await supabase.rpc('create_redeem_session', {
      p_offer: offerId,
      p_merchant: merchantId,
      p_device: 'browser',
      p_ttl_seconds: TTL_SECONDS,
    });
    if (error) { console.error(error); return; }

    const tok = data as string;
    setToken(tok);

    const exp = Date.now() + TTL_SECONDS * 1000;
    setExpiresAt(exp);
    setCountdown(TTL_SECONDS);

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      const target = expiresAt ?? exp;
      const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(secs);
      if (secs <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        if (activeOfferId) generateAndStartTimer(activeOfferId);
      }
    }, 250);
  }

  async function startSession(offerId: string) {
    setActiveOfferId(offerId);
    await generateAndStartTimer(offerId);
    if (pollRef.current) clearInterval(pollRef.current);
    // keep “Left today” fresh while a session is active
    pollRef.current = window.setInterval(loadOffers, 10_000);
  }

  function stopSession() {
    setActiveOfferId(null);
    setToken(null);
    setExpiresAt(null);
    setCountdown(0);
    if (tickRef.current) clearInterval(tickRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Today’s Deals</h1>

      {offers.map((o) => {
        const leftToday = (o.per_day_cap ?? 0) - (o.today_used ?? 0);
        const isActive = activeOfferId === o.id;

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
                style={{ width: '100%', maxWidth: 320, borderRadius: 12, marginBottom: 12, objectFit: 'cover' }}
              />
            )}
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{o.title}</h2>
            <p style={{ color: '#6b7280' }}>{o.merchants?.name ?? ''}</p>
            {o.terms && <p style={{ color: '#9ca3af' }}>{o.terms}</p>}
            <p style={{ marginTop: 8 }}>Left today: {leftToday}</p>

            {!isActive ? (
              <button
                onClick={() => startSession(o.id)}
                style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#10b981', color: 'white', fontWeight: 600 }}
              >
                Show QR
              </button>
            ) : (
              <>
                <button
                  onClick={stopSession}
                  style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#ef4444', color: 'white', fontWeight: 600 }}
                >
                  Stop
                </button>

                {token && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, color: '#6b7280' }}>
                      <span>Rotates in: <strong>{countdown}s</strong></span>
                      <button
                        onClick={() => activeOfferId && generateAndStartTimer(activeOfferId)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}
                      >
                        Refresh QR
                      </button>
                    </div>
                    <QRCode value={token} size={180} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}
