'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { sb } from '@/lib/supabaseBrowser';

export default function MerchantLogin() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Merchant Login
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Sign in with email (magic link) or password. Check your inbox after submitting.
      </p>
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
