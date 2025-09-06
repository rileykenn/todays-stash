'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import QRCode from 'react-qr-code';

type MerchantLite = { name: string; photo_url: string | null } | null;

type Offer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  photo_url: string | null;
  merchants?: MerchantLite;
};

const TTL_SECONDS = 90;
const BASE_WEEKLY_FREE = 2; // MVP base allowance

function getWeekId(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function readWeeklyUsed() {
  if (typeof window === 'undefined') return 0;
  const key = `ts_free_used_${getWeekId()}`;
  const raw = window.localStorage.getItem(key);
  return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
}
function bumpWeeklyUsed() {
  if (typeof window === 'undefined') return;
  const key = `ts_free_used_${getWeekId()}`;
  const current = readWeeklyUsed();
  window.localStorage.setItem(key, String(current + 1));
  window.dispatchEvent(new CustomEvent('ts:free-used-updated'));
}

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  async function loadOffers() {
    const { data, error } = await supabase
      .from('offers')
      .select(`
        id,
        merchant_id,
        title,
        terms,
        per_day_cap,
        today_used,
        photo_url,
        merchants ( name, photo_url )
      `)
      .or('active.is.true,active.is.null'); // show active or legacy null

    if (error) {
      console.error(error);
      setOffers([]);
      return;
    }

    const rows: Offer[] = (data ?? []).map((r: any) => ({
      id: r.id,
      merchant_id: r.merchant_id,
      title: r.title,
      terms: r.terms ?? null,
      per_day_cap: r.per_day_cap ?? null,
      today_used: r.today_used ?? null,
      photo_url: r.photo_url ?? null,
      merchants: Array.isArray(r.merchants) ? (r.merchants[0] ?? null) : (r.merchants ?? null),
    }));

    setOffers(rows);
  }

  useEffect(() => { loadOffers(); }, []);

  async function generateAndStartTimer(offer: Offer) {
    const { data, error } = await supabase.rpc('create_redeem_session', {
      p_offer: offer.id,
      p_merchant: offer.merchant_id,
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
        if (activeOfferId) {
          const again = offers.find(o => o.id === activeOfferId);
          if (again) generateAndStartTimer(again);
        }
      }
    }, 250);
  }

  async function startSession(offer: Offer) {
    // ✅ FIXED: proper destructuring with closing brace
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/merchant/login?next=/consumer';
      return;
    }

    // MVP: decrement local weekly allowance (only once per tap)
    const used = readWeeklyUsed();
    const freeLeft = Math.max(0, BASE_WEEKLY_FREE - used);
    if (freeLeft <= 0) {
      alert('You have used your free deals for this week.');
      return;
    }

    setActiveOfferId(offer.id);
    await generateAndStartTimer(offer);

    // count this attempt as one free redemption (local-only for MVP)
    bumpWeeklyUsed();

    if (pollRef.current) clearInterval(pollRef.current);
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

      {offers.length === 0 && (
        <p style={{ color: '#6b7280' }}>No deals available right now.</p>
      )}

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
            {(o.photo_url || o.merchants?.photo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.photo_url || o.merchants?.photo_url || ''}
                alt={o.merchants?.name ?? 'Deal photo'}
                style={{ width: '100%', maxWidth: 320, borderRadius: 12, marginBottom: 12, objectFit: 'cover' }}
              />
            )}

            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{o.title}</h2>
            <p style={{ color: '#6b7280' }}>{o.merchants?.name ?? ''}</p>
            {o.terms && <p style={{ color: '#9ca3af' }}>{o.terms}</p>}
            <p style={{ marginTop: 8 }}>Left today: {leftToday}</p>

            {!isActive ? (
              <button
                onClick={() => startSession(o)}
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
                        onClick={() => {
                          const current = offers.find(o2 => o2.id === activeOfferId!);
                          if (current) generateAndStartTimer(current);
                        }}
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
