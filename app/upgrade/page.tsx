'use client';

import Link from 'next/link';

export default function UpgradePage() {
  return (
    <main style={{ maxWidth: 880, margin: '40px auto', padding: 16 }}>
      <header style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Upgrade your account</h1>
        <p style={{ color: '#6b7280', marginTop: 8 }}>
          Unlimited in-store redemptions. No daily caps. Priority support.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Starter</h2>
          <p style={{ color: '#6b7280', marginBottom: 8 }}>Great to try it out</p>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>$4.99<span style={{ fontSize: 14 }}>/mo</span></div>
          <ul style={{ color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
            <li>• 25 redemptions / month</li>
            <li>• Access to all deals</li>
          </ul>
          <button
            disabled
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: '#e5e7eb',
              color: '#6b7280',
              fontWeight: 700,
              cursor: 'not-allowed',
            }}
          >
            Coming soon
          </button>
        </div>

        <div style={{ border: '2px solid #111827', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#10b981' }}>MOST POPULAR</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Unlimited</h2>
          <p style={{ color: '#6b7280', marginBottom: 8 }}>Unlimited redemptions</p>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>$9.99<span style={{ fontSize: 14 }}>/mo</span></div>
          <ul style={{ color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
            <li>• Unlimited in-store redemptions</li>
            <li>• Priority support</li>
            <li>• Early access to new features</li>
          </ul>
          <button
            disabled
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: '#e5e7eb',
              color: '#6b7280',
              fontWeight: 700,
              cursor: 'not-allowed',
            }}
          >
            Coming soon
          </button>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Annual</h2>
          <p style={{ color: '#6b7280', marginBottom: 8 }}>Save more</p>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>$89<span style={{ fontSize: 14 }}>/yr</span></div>
          <ul style={{ color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
            <li>• Unlimited redemptions</li>
            <li>• 2 months free</li>
          </ul>
          <button
            disabled
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: '#e5e7eb',
              color: '#6b7280',
              fontWeight: 700,
              cursor: 'not-allowed',
            }}
          >
            Coming soon
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 24, color: '#6b7280' }}>
        Stripe checkout integration is in progress. For questions,{' '}
        <Link href="/signup" style={{ color: '#111827', textDecoration: 'underline' }}>
          contact us
        </Link>.
      </p>
    </main>
  );
}
