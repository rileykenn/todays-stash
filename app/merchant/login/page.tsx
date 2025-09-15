'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { sb } from '@/lib/supabaseBrowser';

export default function MerchantLogin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data: { session } } = await sb.auth.getSession();
      if (session && mounted) {
        router.replace('/merchant'); // already logged in → go to dashboard
      } else {
        setReady(true);
      }
    }

    checkSession();

    // redirect immediately when login event fires
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/merchant');
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Merchant Login
      </h1>
      <Auth
        supabaseClient={sb}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        view="sign_in"
        redirectTo={`${origin}/merchant`}
      />
    </main>
  );
}
