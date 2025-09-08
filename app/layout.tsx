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

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);

      sb.rpc('get_my_merchant').then(({ data }) => { if (mounted) setHasMerchant(!!data); });
      sb.rpc('is_admin').then(({ data }) => { if (mounted) setIsAdmin(!!data); });
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      sb.rpc('get_my_merchant').then(({ data }) => setHasMerchant(!!data));
      sb.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
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
          <nav style={{ maxWidth: 980, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/consumer" style={{ fontWeight: 800, fontSize: 18, textDecoration: 'none', color: '#111827', marginRight: 8 }}>
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

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {email ? (
                <>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>
                    Signed in: <strong>{email}</strong>
                  </span>
                  <button onClick={signOut} style={{ padding: '8px 12px', borderRadius: 10, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/merchant/login" style={{ ...linkStyle, background: '#111827', color: '#fff' }}>
                  Sign in
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
