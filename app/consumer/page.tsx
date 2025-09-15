'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { sb } from '@/lib/supabaseBrowser';
import QRCode from 'react-qr-code';
import Modal from '@/components/Modal';
import { CountdownRing } from '@/components/CountdownRing';
import DealSkeleton from '@/components/DealSkeleton';
import WelcomeHeader from '@/components/WelcomeHeader';

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

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [area, setArea] = useState<string>('Sussex Inlet');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalOffer, setModalOffer] = useState<Offer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const tickRef = useRef<number | null>(null);

  // -------- data --------
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

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const metaName =
          (session.user.user_metadata &&
            (session.user.user_metadata.full_name || session.user.user_metadata.name)) ||
          session.user.email ||
          null;
        setDisplayName(metaName);
      } else {
        setDisplayName(null);
      }
    })();

    const onFocus = () => fetchRemaining();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // -------- QR session --------
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

  async function startSession(offer: Offer) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = '/signup';
      return;
    }

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

  // -------- UI --------
  return (
    <div className="py-4">
      {/* Welcome / area header */}
      <WelcomeHeader
        name={displayName}
        area={area}
        onChangeArea={() => {
          alert('Area selection coming soon. MVP focuses on Sussex Inlet.');
        }}
      />

      {/* Skeletons while loading */}
      {isLoading && (
        <div className="space-y-4">
          <DealSkeleton />
          <DealSkeleton />
          <DealSkeleton />
        </div>
      )}

      {/* No deals */}
      {!isLoading && offers.length === 0 && (
        <p className="text-white/60">No deals available right now.</p>
      )}

      {/* Deal list — DARK cards, readable light text, 1:1 image left */}
      <div className="space-y-4">
        {offers.map((o) => {
          const leftToday =
            typeof o.per_day_cap === 'number' && typeof o.today_used === 'number'
              ? Math.max(0, o.per_day_cap - o.today_used)
              : null;

          return (
            <div
              key={o.id}
              className="rounded-[18px] border border-white/10 bg-[color:rgb(30_41_59)] text-white shadow-sm"
            >
              <div className="flex gap-3 p-3">
                {/* 1:1 image left */}
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-[color:rgb(15_23_42)] shrink-0">
                  {(o.photo_url || o.merchants?.photo_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.photo_url || o.merchants?.photo_url || ''}
                      alt={o.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Text + actions */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold tracking-wide uppercase text-white">
                        {o.title}
                      </h3>
                      <p className="text-xs text-white/70 truncate">
                        {o.merchants?.name ?? ''}
                      </p>
                      {o.terms && (
                        <p className="mt-1 text-[13px] text-white/80 line-clamp-2">{o.terms}</p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {remaining === null ? (
                        <button
                          disabled
                          className="rounded-full px-3 py-1.5 text-xs bg-white/20 text-white/70"
                        >
                          Checking…
                        </button>
                      ) : remaining <= 0 ? (
                        <Link
                          href="/upgrade"
                          className="rounded-full px-3 py-1.5 text-xs bg-[var(--color-brand-600)]/20 text-[var(--color-brand-200)]"
                        >
                          Upgrade
                        </Link>
                      ) : (
                        <button
                          onClick={() => startSession(o)}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold bg-[var(--color-brand-600)] text-white hover:brightness-110 active:scale-95 transition"
                        >
                          Show QR
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scarcity bar */}
                  {typeof leftToday === 'number' && typeof o.per_day_cap === 'number' && (
                    <div className="mt-2">
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${leftToday <= 3 ? 'bg-orange-400' : 'bg-[var(--color-brand-600)]'}`}
                          style={{
                            width: `${Math.round(((o.per_day_cap - leftToday) / o.per_day_cap) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-white/60">
                        <span>Today</span>
                        <span>
                          {o.per_day_cap - leftToday}/{o.per_day_cap} used
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade helper (if needed) */}
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

      {/* Redeem modal with countdown ring */}
      <Modal open={modalOpen && !!token} onClose={closeModal} title="Redeem in-store">
        <div className="grid gap-3">
          <p className="text-sm text-white/70">
            Go to <strong>{modalOffer?.merchants?.name ?? 'the store'}</strong>
            {modalOffer?.merchants?.address_text ? (
              <> at <strong>{modalOffer.merchants.address_text}</strong></>
            ) : null}{' '}
            and ask a staff member to scan your QR in the Today’s Stash merchant app.
          </p>

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
