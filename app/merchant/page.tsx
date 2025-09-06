'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

export default function MerchantHome() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { session } } = await sb.auth.getSession();

      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      if (mounted) {
        setEmail(session.user.email ?? null);
        setReady(true);
      }
    }

    load();

    // keep session fresh
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/merchant/login');
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return null;

  async function signOut() {
    await sb.auth.signOut();
    router.replace('/merchant/login');
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Merchant Dashboard
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Signed in as <strong>{email}</strong>
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/merchant/scan" style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          Open Scanner
        </a>
        <a href="/merchant/offers" style={{ padding: '10px 14px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontWeight: 600 }}>
          My Deals
        </a>
        <a href="/consumer" style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          View Consumer Page
        </a>
        <button onClick={signOut} style={{ padding: '10px 14px', borderRadius: 10, background: '#f3f4f6' }}>
          Sign out
        </button>
      </div>
    </main>
  );
}
