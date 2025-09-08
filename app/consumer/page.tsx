'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import QRCode from 'react-qr-code';
import Modal from '@/components/Modal';

type Offer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  photo_url: string | null;
  merchants?: { name: string; photo_url: string | null; address_text?: string | null } | null;
};

const TTL_SECONDS = 90;

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOffer, setModalOffer] = useState<Offer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  async function loadOffers() {
    const { data, error } = await supabase
      .from('offers')
      .select(`
        id, merchant_id, title, terms, per_day_cap, today_used, photo_url,
        merchants:merchants!inner(name, photo_url, address_text)
      `)
      .or('active.is.true,active.is.null')
      .order('id', { ascending: false });
    if (error) { console.error(error); return; }

    const rows = (data || []).map((r: any) => ({
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

  function stopTimers() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    tickRef.current = null;
    pollRef.current = null;
  }

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
      const now = Date.now();
      const target = exp;
      const secs = Math.max(0, Math.ceil((target - now) / 1000));
      setCountdown(secs);
      if (secs <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        if (modalOffer) generateAndStartTimer(modalOffer);
      }
    }, 250);
  }

  async function startSession(offer: Offer) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/merchant/login?next=/consumer'; return; }

    // MVP client-side weekly free counter
    try {
      const key = 'ts:free-left';
      const left = Number(localStorage.getItem(key) ?? '2');
      localStorage.setItem(key, String(Math.max(0, left - 1)));
      window.dispatchEvent(new CustomEvent('ts:free-used-updated'));
    } catch {}

    setModalOffer(offer);
    setModalOpen(true);
    await generateAndStartTimer(offer);

    // keep “Left today” fresh while modal is open
    stopTimers();
    pollRef.current = window.setInterval(loadOffers, 10_000);
  }

  function closeModal() {
    setModalOpen(false);
    setModalOffer(null);
    setToken(null);
    setExpiresAt(null);
    setCountdown(0);
    stopTimers();
  }

  useEffect(() => () => stopTimers(), []);

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Today’s Deals</h1>

      {offers.length === 0 && <p style={{ color: '#6b7280' }}>No deals available right now.</p>}

      {offers.map((o) => {
        const leftToday = (o.per_day_cap ?? 0) - (o.today_used ?? 0);
        return (
          <div key={o.id}
               style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fff' }}>
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

            <button
              onClick={() => startSession(o)}
              style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#10b981', color: 'white', fontWeight: 600 }}>
              Show QR
            </button>
          </div>
        );
      })}

      <Modal open={modalOpen && !!token} onClose={closeModal} title="Redeem in-store">
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ color: '#374151' }}>
            Go to <strong>{modalOffer?.merchants?.name ?? 'the store'}</strong>
            {modalOffer?.merchants?.address_text ? <> at <strong>{modalOffer.merchants.address_text}</strong></> : null}
            {' '}and ask a friendly staff member to scan your QR in the Today’s Stash merchant app.
          </p>
          <div style={{ display: 'grid', placeItems: 'center', padding: 12, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
            {token ? <QRCode value={token} size={200} /> : <div>Generating…</div>}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              Expires in <strong>{Math.max(0, countdown)}</strong>s
            </div>
            <button
              onClick={() => { if (modalOffer) generateAndStartTimer(modalOffer); }}
              style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              Refresh QR
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
