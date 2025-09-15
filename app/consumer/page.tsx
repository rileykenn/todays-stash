'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { sb } from '@/lib/supabaseBrowser';
import QRCode from 'react-qr-code';
import Modal from '@/components/Modal';
import { DealCard } from '@/components/DealCard';
import { CountdownRing } from '@/components/CountdownRing';
import DealSkeleton from '@/components/DealSkeleton';

type Offer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  photo_url: string | null;
  merchants?: {
    name: string;
    photo_url: string | null;
    address_text?: string | null;
  } | null;
};

// shape we expect back from the supabase select
type RawOffer = {
  id: string;
  merchant_id: string;
  title: string;
  terms: string | null;
  per_day_cap: number | null;
  today_used: number | null;
  photo_url: string | null;
  merchants:
    | { name: string; photo_url: string | null; address_text?: string | null }
    | Array<{ name: string; photo_url: string | null; address_text?: string | null }>
    | null;
};

const TTL_SECONDS = 90;

export default function ConsumerPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalOffer, setModalOffer] = useState<Offer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const tickRef = useRef<number | null>(null);

  // ---- load active offers ----
  async function loadOffers() {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('offers')
      .select(`
        id, merchant_id, title, terms, per_day_cap, today_used, photo_url,
        merchants:merchants!inner(name, photo_url, address_text)
      `)
      .or('active.is.true,active.is.null')
      .order('id', { ascending: false });

    if (!error && data) {
      const rows = (data as unknown as RawOffer[]).map((r) => {
        const merchant =
          Array.isArray(r.merchants) ? (r.merchants[0] ?? null) : r.merchants;
        const mapped: Offer = {
          id: r.id,
          merchant_id: r.merchant_id,
          title: r.title,
          terms: r.terms ?? null,
          per_day_cap: r.per_day_cap ?? null,
          today_used: r.today_used ?? null,
          photo_url: r.photo_url ?? null,
          merchants: merchant
            ? {
                name: merchant.name,
                photo_url: merchant.photo_url,
                address_text: merchant.address_text ?? null,
              }
            : null,
        };
        return mapped;
      });

      setOffers(rows);
    }

    setIsLoading(false);
  }

  // ---- freebies from server ----
  async function fetchRemaining() {
    const { data, error } = await sb.rpc('get_free_remaining');
    if (!error && data != null) {
      const r = Number((data as unknown as { remaining?: number })?.remaining ?? 0);
      setRemaining(Number.isFinite(r) ? r : 0);
      window.dispatchEvent(new CustomEvent('ts:free-used-updated', { detail: data }));
    }
  }

  useEffect(() => {
    loadOffers();
    fetchRemaining();

    // first-visit: gentle pull-to-refresh hint
    const seen = localStorage.getItem('ts_pull_hint_seen');
    if (!seen) {
      setShowHint(true);
      const t = window.setTimeout(() => {
        setShowHint(false);
        localStorage.setItem('ts_pull_hint_seen', '1');
      }, 3200);
      return () => clearTimeout(t);
    }

    const onFocus = () => fetchRemaining();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // ---- QR session ----
  async function generateAndStartTimer(offer: Offer) {
    const { data, error } = await sb.rpc('start_redeem_session', {
      p_offer: offer.id,
      p_merchant: offer.merchant_id,
      p_device: 'browser',
      p_ttl_seconds: TTL_SECONDS,
    });

    if (error) {
      if (error.message.includes('free_limit_reached')) {
        window.location.href = '/upgrade';
        return;
      }
      alert(`Could not start session: ${error.message}`);
      return;
    }

    const tok = String(data);
    setToken(tok);

    const localExp = Date.now() + TTL_SECONDS * 1000;
    setCountdown(TTL_SECONDS);

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    tickRef.current = window.setInterval(() => {
      const secs = Math.max(0, Math.ceil((localExp - Date.now()) / 1000));
      setCountdown(secs);
      if (secs <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 250);
  }

  // ---- actions ----
  async function startSession(offer: Offer) {
    // must be signed in
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = '/signup';
      return;
    }

    // hard check server freebies right now
    const { data, error } = await sb.rpc('get_free_remaining');
    if (error || !data) {
      alert('Could not check your freebies. Try again.');
      return;
    }
    const rem = Number((data as unknown as { remaining?: number })?.remaining ?? 0);
    if (rem <= 0) {
      window.location.href = '/upgrade';
      return;
    }

    setModalOffer(offer);
    setModalOpen(true);
    await generateAndStartTimer(offer);
  }

  function closeModal() {
    setModalOpen(false);
    setModalOffer(null);
    setToken(null);
    setCountdown(0);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  // ---- UI ----
  return (
    <div className="py-4">
      <h1 className="text-xl font-semibold mb-2">Today’s Deals</h1>

      {showHint && (
        <div className="mb-3 rounded-full px-3 py-2 text-xs text-white/80 border border-white/10 bg-[color:rgb(26_35_48_/_0.75)] backdrop-blur w-max">
          Pull down to find fresh deals ✨
        </div>
      )}

      {/* Skeletons while loading */}
      {isLoading && (
        <div className="space-y-4">
          <DealSkeleton />
          <DealSkeleton />
          <DealSkeleton />
        </div>
      )}

      {/* No deals (after load) */}
      {!isLoading && offers.length === 0 && (
        <p className="text-white/60">No deals available right now.</p>
      )}

      {/* Deals */}
      <div className="space-y-4">
        {offers.map((o) => {
          const leftToday =
            typeof o.per_day_cap === 'number' && typeof o.today_used === 'number'
              ? Math.max(0, o.per_day_cap - o.today_used)
              : null;

          return (
            <DealCard
              key={o.id}
              title={o.title}
              terms={o.terms}
              photo={o.photo_url ?? o.merchants?.photo_url ?? null}
              merchantName={o.merchants?.name ?? null}
              address={o.merchants?.address_text ?? null}
              leftToday={leftToday}
              cap={o.per_day_cap}
              onGet={() => {
                if (remaining === null) return; // still checking
                if (remaining <= 0) {
                  window.location.href = '/upgrade';
                  return;
                }
                startSession(o);
              }}
            />
          );
        })}
      </div>

      {/* Upgrade helper */}
      {remaining !== null && remaining <= 0 && (
        <div className="mt-4">
          <Link
            href="/upgrade"
            className="inline-flex rounded-full px-4 py-2 border border-white/10 text-white bg-[var(--color-ink-700)] hover:bg-[var(--color-ink-600)] transition"
          >
            Upgrade for more deals
          </Link>
        </div>
      )}

      {/* Redeem modal */}
      <Modal open={modalOpen && !!token} onClose={closeModal} title="Redeem in-store">
        <div className="grid gap-3">
          <p className="text-sm text-white/70">
            Go to <strong>{modalOffer?.merchants?.name ?? 'the store'}</strong>
            {modalOffer?.merchants?.address_text ? (
              <> at <strong>{modalOffer.merchants.address_text}</strong></>
            ) : null}{' '}
            and ask a staff member to scan your QR in the Today’s Stash merchant app.
          </p>

          {/* Ring + QR */}
          <div className="relative mx-auto my-2 grid place-items-center">
            <CountdownRing secondsLeft={countdown} total={TTL_SECONDS} />
            <div className="absolute bg-white p-2 rounded-md">
              {token ? <QRCode value={token} size={160} /> : <div className="text-sm">Generating…</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`text-sm ${countdown <= 10 ? 'text-[var(--color-accent-red)]' : 'text-white/60'}`}>
              Expires in <strong>{Math.max(0, countdown)}</strong>s
            </div>
            <button
              onClick={() => modalOffer && generateAndStartTimer(modalOffer)}
              className="ml-auto rounded-full px-3 py-2 text-sm border border-white/10 bg-[var(--color-ink-700)] hover:bg-[var(--color-ink-600)] transition"
            >
              Refresh QR
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
