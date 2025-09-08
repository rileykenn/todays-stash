// app/not-found.tsx
import * as React from 'react';

export default function NotFound(): React.ReactElement {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Page not found</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        The page you’re looking for doesn’t exist.
      </p>
      <a
        href="/consumer"
        style={{ padding: '10px 14px', borderRadius: 10, background: '#111827', color: '#fff', display: 'inline-block' }}
      >
        Go to Deals
      </a>
    </main>
  );
}
