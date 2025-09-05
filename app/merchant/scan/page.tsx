'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Result } from '@zxing/library';

type ScanResult = { ok: boolean; reason?: string } | null;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID || '';

  useEffect(() => {
    return () => {
      try {
        (readerRef.current as any)?.reset?.();
      } catch {}
    };
  }, []);

  const startScan = async () => {
    setResult(null);
    setScanning(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current!,
        async (res: Result | undefined) => {
          if (!res) return;

          const tokenText = res.getText();
          (reader as any).reset?.();
          setScanning(false);

          const { data, error } = await supabase.rpc('validate_scan', {
            p_token: tokenText,
            p_merchant: merchantId,
          });

          if (error) {
            console.error(error);
            setResult({ ok: false, reason: 'error' });
            return;
          }

          const outcome = (data as { outcome: string; reason?: string })?.outcome;
          const reason = (data as { outcome: string; reason?: string })?.reason;
          setResult({ ok: outcome === 'accepted', reason });
        }
      );
    } catch (e) {
      console.error(e);
      setScanning(false);
    }
  };

  const scanAgain = () => {
    setResult(null);
    startScan();
  };

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Merchant Scanner</h1>

      {!scanning && (
        <button
          onClick={startScan}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: '#10b981',
            color: 'white',
            fontWeight: 600,
          }}
        >
          {result ? 'Scan again' : 'Start scan'}
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <video ref={videoRef} style={{ width: '100%', borderRadius: 16 }} />
      </div>

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            background: result.ok ? '#ecfdf5' : '#fef2f2',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {result.ok ? 'Accepted ✅' : 'Rejected ❌'}
          </div>
          {!result.ok && result.reason && (
            <div style={{ marginTop: 6, color: '#6b7280' }}>Reason: {result.reason}</div>
          )}
          <button
            onClick={scanAgain}
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
            }}
          >
            Scan another
          </button>
        </div>
      )}
    </main>
  );
}
