// app/layout.tsx
'use client';

import './globals.css';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasMerchant, setHasMerchant] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        try {
          const free = await sb.rpc('get_free_remaining');
          const val = typeof free.data === 'number' ? free.data : (free.data as any)?.remaining;
          if (typeof val === 'number') setFreeLeft(val);
        } catch {}
      }
      try { const admin = await sb.rpc('is_admin'); setIsAdmin(!!admin.data); } catch {}
      try { const { data } = await sb.rpc('get_my_merchant'); setHasMerchant(!!data); } catch { setHasMerchant(false); }
    })();
  }, []);

  const Tab = ({ href, label, active }: { href: string; label: string; active: boolean }) => (
    <Link href={href} className={`flex-1 text-center py-3 text-sm ${active ? 'text-[var(--color-brand-600)] font-semibold' : 'text-white/70'}`}>
      {label}
    </Link>
  );

  return (
    <html lang="en">
      <body className="bg-[var(--color-ink-900)] text-white antialiased">
        <div className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-[color:rgb(18_24_33_/_0.8)]">
          <div className="mx-auto max-w-screen-sm px-4 pt-[env(safe-area-inset-top)]">
            <div className="h-14 flex items-center justify-between">
              <Link href="/consumer" className="font-bold tracking-tight">Today’s Stash</Link>

              <div className="flex items-center gap-3">
                {/* Bell icon entry (no-op for MVP) */}
                <button
                  aria-label="Notifications"
                  className="relative w-9 h-9 rounded-full bg-[color:rgb(26_35_48_/_0.9)] border border-white/10 grid place-items-center hover:brightness-110 transition"
                  onClick={() => alert('Notifications coming soon')}
                >
                  <span className="i-bell w-4 h-4 block" />
                  <style jsx>{`
                    .i-bell {
                      mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.92V4a1 1 0 1 0-2 0v1.08A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z"/></svg>') no-repeat center / contain;
                      background: white;
                    }
                  `}</style>
                </button>

                {typeof freeLeft === 'number' && (
                  <div className="text-xs bg-[color:rgb(34_197_94_/_0.18)] border border-[color:rgb(34_197_94_/_0.35)] text-[var(--color-brand-200)] rounded-full px-3 py-1">
                    Free left: <span className="font-semibold">{freeLeft}</span>
                  </div>
                )}
                {isAdmin && (
                  <Link href="/admin" className="text-xs opacity-80 hover:opacity-100">Admin</Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-screen-sm px-4">
          {children}
          <div className="h-20" />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[color:rgb(26_35_48_/_0.85)] backdrop-blur border-t border-white/10">
          <div className="mx-auto max-w-screen-sm px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <div className="flex items-center">
              <Tab href="/consumer" label="Home" active={pathname?.startsWith('/consumer') ?? false} />
              {hasMerchant ? <Tab href="/merchant/scan" label="Scan" active={pathname === '/merchant/scan'} /> : null}
              <Tab href="/merchant" label="Profile" active={pathname?.startsWith('/merchant') ?? false} />
            </div>
          </div>
        </nav>
      </body>
    </html>
  );
}
