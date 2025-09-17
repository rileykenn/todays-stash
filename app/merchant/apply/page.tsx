'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

type ApplyStatus = 'idle' | 'sending_code' | 'code_sent' | 'verifying' | 'verified';

// -------------------- Minimal runtime types (no google typings required) --------------------
type AutocompleteServiceLike = {
  getPlacePredictions: (opts: unknown, cb: (preds: unknown[] | null, status?: unknown) => void) => void;
};
type PlacesServiceLike = {
  getDetails: (
    opts: unknown,
    cb: (place: unknown | null, status: unknown) => void
  ) => void;
};
type LatLngLike = { lat: () => number; lng: () => number };
type PlaceLike = {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: LatLngLike };
};
type PredictionView = {
  place_id?: string;
  description?: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

// Augment Window without referencing the google namespace type
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteSessionToken: new () => object;
          AutocompleteService: new () => AutocompleteServiceLike;
          PlacesService: new (node: Element) => PlacesServiceLike;
          PlacesServiceStatus?: unknown;
        };
      };
    };
  }
}

// -------------------- Google Places loader --------------------
function useLoadGooglePlaces(apiKey?: string) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    if (window.google?.maps?.places) {
      setReady(true);
      return;
    }
    const id = 'google-places-script';
    if (document.getElementById(id)) return;

    const s = document.createElement('script');
    s.id = id;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, [apiKey]);

  return ready;
}

// -------------------- Helpers --------------------
function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');

  // fix +6104xxxxxxxx -> +614xxxxxxxx
  if (/^\+6104\d{8}$/.test(raw)) return '+61' + raw.slice(4);

  if (/^\+614\d{8}$/.test(raw)) return raw; // correct E.164 AU mobile
  if (/^04\d{8}$/.test(raw)) return '+61' + raw.slice(1);
  if (/^0\d{9}$/.test(raw)) return '+61' + raw.slice(1);
  return raw;
}

export default function MerchantApplyPage() {
  const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const placesReady = useLoadGooglePlaces(GOOGLE_KEY);

  // Google services
  const sessionTokenRef = useRef<object | null>(null);
  const autoSvcRef = useRef<AutocompleteServiceLike | null>(null);
  const placesSvcRef = useRef<PlacesServiceLike | null>(null);

  useEffect(() => {
    const g = window.google?.maps?.places;
    if (!placesReady || !g) return;
    sessionTokenRef.current = new g.AutocompleteSessionToken();
    autoSvcRef.current = new g.AutocompleteService();
    placesSvcRef.current = new g.PlacesService(document.createElement('div'));
  }, [placesReady]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Address autocomplete
  const [address, setAddress] = useState('');
  const [addressPreds, setAddressPreds] = useState<PredictionView[]>([]);
  const [showPreds, setShowPreds] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Phone code flow
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState<ApplyStatus>('idle');
  const [phoneVerified, setPhoneVerified] = useState(false);

  // UX state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canRequestCode = useMemo(
    () => phone.trim().length >= 8 && !phoneVerified && codeSent !== 'sending_code',
    [phone, phoneVerified, codeSent]
  );

  const canSubmit = useMemo(() => {
    return (
      fullName.trim() &&
      businessName.trim() &&
      abn.trim() &&
      address.trim() &&
      phone.trim() &&
      email.trim() &&
      password.length >= 6 &&
      password === confirm &&
      phoneVerified &&
      !loading
    );
  }, [fullName, businessName, abn, address, phone, email, password, confirm, phoneVerified, loading]);

  function resetAlerts() {
    setErr(null);
    setOk(null);
  }

  // Address predictions (debounced)
  useEffect(() => {
    if (!placesReady || !autoSvcRef.current) return;
    if (!address || !showPreds) {
      setAddressPreds([]);
      return;
    }
    const handle = setTimeout(() => {
      autoSvcRef.current!.getPlacePredictions(
        {
          input: address,
          sessionToken: sessionTokenRef.current ?? undefined,
          componentRestrictions: { country: ['au'] },
          types: ['establishment', 'geocode'],
        },
        (preds) => {
          const list = (preds ?? []).map((p) => p as unknown as PredictionView);
          setAddressPreds(list);
        }
      );
    }, 200);
    return () => clearTimeout(handle);
  }, [address, showPreds, placesReady]);

  function selectPrediction(p: PredictionView) {
    if (!placesSvcRef.current || !p.place_id) return;
    setShowPreds(false);
    setAddress(p.description ?? '');
    setPlaceId(p.place_id);

    placesSvcRef.current.getDetails(
      {
        placeId: p.place_id,
        sessionToken: sessionTokenRef.current ?? undefined,
        fields: ['formatted_address', 'geometry', 'place_id'],
      },
      (place, _status) => {
        const pl = (place ?? {}) as PlaceLike;
        const formatted = pl.formatted_address ?? p.description ?? '';
        setAddress(formatted);
        setPlaceId(pl.place_id ?? p.place_id ?? null);
        const loc = pl.geometry?.location;
        if (loc) setCoords({ lat: loc.lat(), lng: loc.lng() });
      }
    );
  }

  async function handleGetCode() {
    resetAlerts();
    if (!canRequestCode) return;

    const normalized = normalizePhoneAU(phone.trim());
    setPhone(normalized);
    setCode('');
    setCodeSent('sending_code');

    try {
      // allow temp phone user for OTP
      const { error } = await sb.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'sms', shouldCreateUser: true },
      });
      if (error) throw error;
      setCodeSent('code_sent');
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Failed to send code. Check +61 format and Twilio configuration.';
      setErr(message);
      setCodeSent('idle');
    }
  }

  async function handleVerifyCode() {
    resetAlerts();
    if (!code || code.length < 4) return;
    const normalized = normalizePhoneAU(phone.trim());

    setCodeSent('verifying');
    try {
      const { data, error } = await sb.auth.verifyOtp({
        phone: normalized,
        token: code.trim(),
        type: 'sms',
      });
      if (error) throw error;

      // drop temp phone session so email/pw remains primary
      if (data?.session) await sb.auth.signOut();

      setPhoneVerified(true);
      setCodeSent('verified');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to verify code.';
      setErr(message);
      setCodeSent('code_sent');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();

    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (!phoneVerified) {
      setErr('Please verify your phone number before submitting.');
      return;
    }

    setLoading(true);
    try {
      // Ensure an authenticated user exists (sign in first, else sign up)
      let {
        data: { session },
      } = await sb.auth.getSession();

      if (!session) {
        const si = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (si.error) {
          const msg = si.error.message?.toLowerCase() ?? '';
          const invalid = msg.includes('invalid') || msg.includes('credentials');
          if (invalid) {
            const su = await sb.auth.signUp({
              email: email.trim(),
              password,
              options: {
                data: { full_name: fullName, role: 'merchant_applicant' },
                emailRedirectTo:
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/merchant`
                    : undefined,
              },
            });
            if (su.error) throw su.error;
            const g = await sb.auth.getSession();
            session = g.data.session;
          } else {
            throw si.error;
          }
        } else {
          session = si.data.session;
        }
      }

      const userId = session?.user?.id ?? null;

      // Try inserting with address fields; if columns don't exist, retry without them.
      const payload: Record<string, unknown> = {
        user_id: userId,
        contact_name: fullName.trim(),
        business_name: businessName.trim(),
        abn: abn.trim(),
        phone: normalizePhoneAU(phone.trim()),
        email: email.trim(),
        status: 'pending',
      };
      if (address) payload.address_text = address;
      if (placeId) payload.address_place_id = placeId;
      if (coords) {
        payload.address_lat = coords.lat;
        payload.address_lng = coords.lng;
      }

      let ins = await sb.from('merchant_applications').insert(payload);
      // 42703 = undefined_column
      if ((ins.error?.code ?? '') === '42703') {
        delete payload.address_text;
        delete payload.address_place_id;
        delete payload.address_lat;
        delete payload.address_lng;
        ins = await sb.from('merchant_applications').insert(payload);
      }
      if (ins.error) throw ins.error;

      setOk(
        'Thank you for submitting your application. Our team will review and enable your merchant dashboard.'
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-8 text-white">
      <h1 className="text-2xl font-extrabold mb-2">List your business on Today’s Stash</h1>
      <p className="text-white/70 text-sm mb-5">
        Tell us about you and your business. We’ll verify details and enable your merchant dashboard.
      </p>

      <form onSubmit={submit} className="rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-5 space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal full name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Business name */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Business name</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Smith’s Coffee Co."
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* ABN */}
        <div>
          <label className="block text-xs text-white/60 mb-1">ABN</label>
          <input
            required
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            placeholder="11 111 111 111"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Address (Google Places Autocomplete) */}
        <div className="relative">
          <label className="block text-xs text-white/60 mb-1">Business address</label>
          <input
            required
            value={address}
            onChange={(e) => { setAddress(e.target.value); setShowPreds(true); }}
            onFocus={() => setShowPreds(true)}
            onBlur={() => setTimeout(() => setShowPreds(false), 150)}
            placeholder="Start typing your address…"
            disabled={!placesReady}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)] disabled:opacity-60"
          />

          {showPreds && addressPreds.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[rgb(24_32_45)] shadow-lg">
              <ul className="max-h-72 overflow-auto divide-y divide-white/10">
                {addressPreds.map((p) => (
                  <li key={p.place_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPrediction(p)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-sm">{p.structured_formatting?.main_text}</div>
                      <div className="text-xs text-white/60">{p.structured_formatting?.secondary_text}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!placesReady && (
            <p className="mt-1 text-xs text-white/50">Loading address suggestions…</p>
          )}
        </div>

        {/* Phone with Get Code + Code field */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal phone number</label>
          <div className="flex gap-2">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61…"
              className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
            <button
              type="button"
              onClick={handleGetCode}
              disabled={!canRequestCode}
              className="rounded-xl px-4 py-2 bg-white/10 border border-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
            >
              {codeSent === 'sending_code' ? 'Sending…' : phoneVerified ? 'Verified' : 'Get code'}
            </button>
          </div>

          {codeSent !== 'idle' && !phoneVerified && (
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                inputMode="numeric"
                className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
              />
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={codeSent === 'verifying' || !code}
                className="rounded-xl px-4 py-2 bg-[var(--color-brand-600)] text-sm font-semibold hover:brightness-110 disabled:opacity-60"
              >
                {codeSent === 'verifying' ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          )}

          {phoneVerified && (
            <p className="mt-1 text-xs text-[color:rgb(16_185_129)]">Phone number verified.</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs text-white/60 mb-1">Personal email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
          />
        </div>

        {/* Password + Confirm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/60 mb-1">Create a password</label>
            <input
              type="password"
              required
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              minLength={6}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--color-brand-600)]"
            />
            {confirm && password !== confirm && (
              <p className="mt-1 text-xs text-[color:rgb(248_113_113)]">Passwords don’t match.</p>
            )}
          </div>
        </div>

        {/* Alerts */}
        {err && (
          <div className="rounded-xl p-3 bg-[color:rgb(254_242_242)] text-[color:rgb(153_27_27)] text-sm">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-xl p-3 bg-[color:rgb(16_185_129_/_0.18)] border border-[color:rgb(16_185_129_/_0.35)] text-[color:rgb(16_185_129)] text-sm">
            {ok}
          </div>
        )}

        {/* Submit */}
        <button
          disabled={!canSubmit}
          type="submit"
          className="w-full rounded-full bg-[var(--color-brand-600)] py-3 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'Submitting…' : 'Submit application'}
        </button>

        <p className="text-xs text-white/50">
          By submitting, you agree that we may contact you to verify your business details.
        </p>
      </form>

      <div className="h-24" />
    </main>
  );
}
