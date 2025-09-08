'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';
import { sb } from '@/lib/supabaseBrowser';

function SignUpPage() {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Create your account</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        You can browse deals without an account. You’ll sign in when you redeem.
      </p>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: '#fff',
        }}
      >
        <Auth
          supabaseClient={sb}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          view="sign_up"
          redirectTo={`${origin}/consumer`}
        />
      </div>

      <div style={{ marginTop: 16, borderTop: '1px dashed #e5e7eb', paddingTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Are you a business?</div>
        <p style={{ color: '#6b7280', marginBottom: 8 }}>
          List your business on Today’s Stash and start driving foot traffic.
        </p>
        <Link
          href="/merchant/apply"
          style={{
            display: 'inline-block',
            padding: '10px 14px',
            borderRadius: 10,
            background: '#111827',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Sign up as a merchant
        </Link>
      </div>
    </main>
  );
}

export default SignUpPage;
