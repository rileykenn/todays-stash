/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // --- helpers ---
  async function fetchRemainingAuthoritative() {
    const { data, error } = await sb.rpc('get_free_remaining');
    if (!error && data) {
      const r = Number((data as any)?.remaining ?? 0);
      setRemaining(Number.isFinite(r) ? r : 0);
    }
  }

  // --- init: wait for session, then fetch; keep in sync afterwards ---
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      setEmail(session?.user?.email ?? null);
      if (session) await fetchRemainingAuthoritative();
    })();

    // when auth changes, refresh badge
    const sub = sb.auth.onAuthStateChange(async (_e, s) => {
      setEmail(s?.user?.email ?? null);
      if (s) await fetchRemainingAuthoritative();
      else setRemaining(null);
    });

    // when any page emits our update event, refetch from server
    const onBump = () => fetchRemainingAuthoritative();
    window.addEventListener('ts:free-used-updated', onBump);

    // keep fresh on tab focus
    const onFocus = () => fetchRemainingAuthoritative();
    window.addEventListener('focus', onFocus);

    return () => {
      sub.data.subscription.unsubscribe();
      window.removeEventListener('ts:free-used-updated', onBump);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <html lang="en">
      <body style={{ background: '#0b0b0b', color: '#e5e7eb' }}>
        {/* NAV */}
        <nav style={{
          display: 'flex', alignItems: 'center', gap: 12,
          maxWidth: 1100, margin: '12px auto', padding: '8px 12px'
        }}>
          <Link href="/" style={{ fontWeight: 800, color: '#fff', textDecoration: 'none' }}>
            Today’s Stash
          </Link>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Freebies badge (authoritative) */}
            <span style={{
              background: '#eef2ff', color: '#4338ca', padding: '6px 10px',
              borderRadius: 999, fontSize: 14, fontWeight: 700
            }}>
              Free deals left: {remaining === null ? '—' : Math.max(0, remaining)}
            </span>

            {/* Upgrade CTA when exhausted */}
            {remaining !== null && remaining <= 0 && (
              <Link
                href="/upgrade"
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  color: '#111827',
                  background: '#fff',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                Upgrade for unlimited deals
              </Link>
            )}

            {/* Auth display */}
            {email ? (
              <span style={{ color: '#d1d5db', fontSize: 14 }}>Signed in: {email}</span>
            ) : (
              <Link href="/signup" style={{ color: '#fff', textDecoration: 'none' }}>
                Sign up
              </Link>
            )}
          </div>
        </nav>

        {/* PAGE */}
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
      </body>
    </html>
  );
}
