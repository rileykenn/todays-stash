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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();

      if (session) {
        try {
          const free = await sb.rpc('get_free_remaining');
          if (typeof free.data === 'number') setFreeLeft(free.data);
        } catch {}
      }

      try {
        const admin = await sb.rpc('is_admin');
        setIsAdmin(!!admin.data);
      } catch {}
    })();
  }, []);

  const Tab = ({ href, label, active }: { href: string; label: string; active: boolean }) => (
    <Link
      href={href}
      className={`flex-1 text-center py-3 text-sm ${
        active ? 'text-[var(--color-brand-600)] font-semibold' : 'text-white/70'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <html lang="en">
      <body className="bg-[var(--color-ink-900)] text-white antialiased">
        {/* Top app bar (safe-area aware) */}
        <div className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-[color:rgb(18_24_33_/_0.8)]">
          <div className="mx-auto max-w-screen-sm px-4 pt-[env(safe-area-inset-top)]">
            <div className="h-14 flex items-center justify-between">
              <Link href="/consumer" className="font-bold tracking-tight">
                Today’s Stash
              </Link>

              <div className="flex items-center gap-3">
                {typeof freeLeft === 'number' && (
                  <div className="text-xs bg-[color:rgb(34_197_94_/_0.18)] border border-[color:rgb(34_197_94_/_0.35)] text-[var(--color-brand-200)] rounded-full px-3 py-1">
                    Free left: <span className="font-semibold">{freeLeft}</span>
                  </div>
                )}
                {isAdmin && (
                  <Link href="/admin" className="text-xs opacity-80 hover:opacity-100">
                    Admin
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="mx-auto max-w-screen-sm px-4">
          {children}
          {/* Spacer for bottom nav */}
          <div className="h-20" />
        </main>

        {/* Sticky bottom tab bar (safe-area aware) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[color:rgb(26_35_48_/_0.85)] backdrop-blur border-t border-white/10">
          <div className="mx-auto max-w-screen-sm px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <div className="flex items-center">
              <Tab href="/consumer" label="Home" active={pathname?.startsWith('/consumer') ?? false} />
              <Tab href="/merchant/scan" label="Scan" active={pathname === '/merchant/scan'} />
              <Tab href="/merchant" label="Profile" active={pathname?.startsWith('/merchant') ?? false} />
            </div>
          </div>
        </nav>
      </body>
    </html>
  );
}
