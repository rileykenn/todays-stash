'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { sb } from '@/lib/supabaseBrowser';

export default function SignUpPage() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        window.location.replace('/consumer');
      }
    })();
  }, []);

  return (
    <main className="max-w-md mx-auto px-6 py-10 text-white">
      <h1 className="text-2xl font-extrabold mb-2">Create your account</h1>
      <p className="text-white/60 mb-6">
        You can browse deals without an account. You’ll sign in when you redeem.
      </p>

      <div className="rounded-2xl bg-[rgb(24_32_45)] border border-white/10 p-6 mb-8">
        <Auth
          supabaseClient={sb}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#10b981',
                  brandAccent: '#059669',
                  inputBackground: 'rgb(17 24 39)',
                  inputBorder: 'rgb(55 65 81)',
                },
              },
            },
          }}
          providers={['google']}
          redirectTo={`${origin}/consumer`}
          magicLink={false}
          socialLayout="vertical"
        />
      </div>

      <div className="border-t border-dashed border-white/10 pt-6">
        <h2 className="font-semibold mb-2">Are you a business?</h2>
        <p className="text-white/60 mb-3">
          List your business on Today’s Stash and start driving foot traffic.
        </p>
        <Link
          href="/merchant/apply"
          className="inline-block rounded-full px-5 py-3 bg-[var(--color-brand-600)] font-semibold hover:brightness-110"
        >
          Sign up as a merchant
        </Link>
      </div>
    </main>
  );
}
