// app/layout.tsx
'use client';

import './globals.css';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [hasMerchant, setHasMerchant] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);

  async function refreshBadges() {
    const { data: { session } } = await sb.auth.getSession();
    const userEmail = session?.user?.email ?? null;
    setEmail(userEmail);

    // role flags
    sb.rpc('get_my_merchant').then(({ data }) => setHasMerchant(!!data));
    sb.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));

    // server-side weekly allowance (only when logged in)
    if (userEmail) {
      const { data } = await sb.rpc('get_free_remaining');
      setFreeLeft(data?.[0]?.remaining ?? 0);
    } else {
      setFreeLeft(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    refreshBadges();

    // react to auth changes
    const { data: sub } = sb.auth.onAuthStateChange(() => {
      if (mounted) refreshBadges();
    });

    // (optional) react to client-side decrement events if you still emit them
    const onFreeUsed = () => refreshBadges();
    window.addEventListener('ts:free-used-updated', onFreeUsed);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('ts:free-used-updated', onFreeUsed);
    };
  }, []);

  const linkStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
  };

  async function signOut() {
    await sb.auth.signOut();
    window.location.reload();
  }

  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <nav
            style={{
              maxWidth: 980,
              margin: '0 auto',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Link
              href="/consumer"
              style={{ fontWeight: 800, fontSize: 18, textDecoration: 'none', color: '#111827', marginRight: 8 }}
            >
              Today’s Stash
            </Link>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/consumer" style={linkStyle}>Deals</Link>
              {hasMerchant && <Link href="/merchant" style={linkStyle}>Merchant</Link>}
              {isAdmin && (
                <Link href="/admin" style={{ ...linkStyle, background: '#111827', color: '#fff' }}>
                  Admin Dashboard
                </Link>
              )}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {email && freeLeft !== null && (
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#eef2ff',
                    color: '#3730a3',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Free deals left: {freeLeft}
                </span>
              )}

              {email ? (
                <>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>
                    Signed in: <strong>{email}</strong>
                  </span>
                  <button
                    onClick={signOut}
                    style={{ padding: '8px 12px', borderRadius: 10, background: '#f3f4f6', border: '1px solid #e5e7eb' }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/signup" style={{ ...linkStyle, background: '#111827', color: '#fff' }}>
                  Sign up
                </Link>
              )}
            </div>
          </nav>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
