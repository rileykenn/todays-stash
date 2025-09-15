/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Result } from '@zxing/library';

type RpcValidateResult = { outcome: 'accepted' | 'rejected'; reason?: string };
type ScanResult = { ok: boolean; reason?: string } | null;

export default function ScanPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const handledRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Load session + merchant id
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login');
        return;
      }

      const { data: mid, error: mErr } = await sb.rpc('get_my_merchant');
      if (mErr) {
        if (mounted) setError(mErr.message);
        return;
      }
      if (!mid) {
        if (mounted) setError('This account is not linked to a merchant. Ask an admin to add you to merchant_staff.');
        return;
      }
      if (mounted) setMerchantId(mid as string);
    }

    init();

    // Keep session fresh / redirect if signed out
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace('/merchant/login');
    });

    return () => {
      sub.subscription.unsubscribe();
      try { (readerRef.current as any)?.reset?.(); } catch {}
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks()?.forEach(t => t.stop());
    };
  }, [router]);

  // Start camera + scanner
  const startScan = async () => {
    if (!merchantId) {
      setError('Merchant not ready yet. Please wait a moment and try again.');
      return;
    }

    setError(null);
    setResult(null);
    setScanning(true);
    handledRef.current = false;

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current!,
        async (res: Result | undefined) => {
          if (!res || handledRef.current) return;
          handledRef.current = true;

          const tokenText = res.getText();

          // Stop camera before hitting RPC
          try { (reader as any).reset?.(); } catch {}
          const stream = videoRef.current?.srcObject as MediaStream | undefined;
          stream?.getTracks()?.forEach(t => t.stop());
          setScanning(false);

          const { data, error: rpcErr } = await sb.rpc('validate_scan', {
            p_token: tokenText,
            p_merchant: merchantId,
          });

          if (rpcErr) {
            console.error('validate_scan RPC error:', rpcErr);
            setResult({ ok: false, reason: rpcErr.message || 'rpc_error' });
            return;
          }

          if (!data) {
            setResult({ ok: false, reason: 'no_data' });
            return;
          }

          const { outcome, reason } = data as RpcValidateResult;
          setResult({
            ok: outcome === 'accepted',
            reason: outcome === 'accepted' ? undefined : (reason ?? 'unknown'),
          });
        }
      );
    } catch (e: unknown) {
      console.error(e);
      setScanning(false);
      setError('Camera error. Please check permissions and try again.');
    }
  };

  const scanAgain = () => {
    setResult(null);
    startScan();
  };

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Merchant Scanner</h1>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: '#fef3c7', color: '#92400e', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!scanning && (
        <button
          onClick={startScan}
          disabled={!merchantId}
          style={{ padding: '10px 14px', borderRadius: 12, background: '#10b981', color: 'white', fontWeight: 600 }}
        >
          {result ? 'Scan again' : 'Start scan'}
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 16 }} />
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
            <div style={{ marginTop: 6, color: '#6b7280' }}>
              Reason: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{result.reason}</span>
            </div>
          )}
          <button
            onClick={scanAgain}
            style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          >
            Scan another
          </button>
        </div>
      )}

      <p style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>
        Tip: If you keep seeing <code>expired</code>, bump the token TTL to 120s while testing.
      </p>
    </main>
  );
}
