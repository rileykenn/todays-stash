'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { Result } from '@zxing/library';

type RpcValidateResult = { outcome: 'accepted' | 'rejected'; reason?: string | null };
type ScanResult = { ok: boolean; reason?: string | null } | null;

export default function ScanPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const handledRef = useRef<boolean>(false);

  const [scanning, setScanning] = useState<boolean>(false);
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
        if (mounted) {
          setError('This account is not linked to a merchant. Ask an admin to add you to merchant_staff.');
        }
        return;
      }
      if (mounted) setMerchantId(mid as string);
    }

    init();

    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace('/merchant/login');
    });

    return () => {
      sub.subscription.unsubscribe();

      // ✅ use the ref here (no 'reader' in this scope)
      try { (readerRef.current as any)?.reset?.(); } catch {}

      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks()?.forEach((t) => t.stop());
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
          stream?.getTracks()?.forEach((t) => t.stop());
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
            reason: outcome === 'accepted' ? null : (reason ?? 'unknown'),
          });
        }
      );
    } catch (e) {
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
    <div className="py-4">
      <h1 className="text-xl font-semibold mb-3">Merchant Scanner</h1>

      {error && (
        <div className="mb-3 rounded-xl border border-white/10 bg-[color:rgb(254_243_199_/_0.14)] text-[color:rgb(252_211_77)] px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!scanning && (
        <button
          onClick={startScan}
          disabled={!merchantId}
          className="rounded-full bg-[var(--color-brand)] text-[var(--color-ink-900)] font-semibold px-4 py-2 disabled:opacity-50"
        >
          {result ? 'Scan again' : 'Start scan'}
        </button>
      )}

      {/* Camera viewport with viewfinder */}
      <div className="mt-4 rounded-2xl overflow-hidden bg-black border border-white/10">
        <div className="relative aspect-[3/4]">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

          {/* Viewfinder overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] h-[48%] rounded-2xl border-2 border-white/60 relative">
              <div className="absolute -left-1 -top-1 w-8 h-8 border-t-4 border-l-4 border-[var(--color-brand)] rounded-tl-xl" />
              <div className="absolute -right-1 -top-1 w-8 h-8 border-t-4 border-r-4 border-[var(--color-brand)] rounded-tr-xl" />
              <div className="absolute -left-1 -bottom-1 w-8 h-8 border-b-4 border-l-4 border-[var(--color-brand)] rounded-bl-xl" />
              <div className="absolute -right-1 -bottom-1 w-8 h-8 border-b-4 border-r-4 border-[var(--color-brand)] rounded-br-xl" />
            </div>
          </div>

          {/* Live status */}
          <div className="absolute left-3 bottom-3 bg-[color:rgb(11_15_20_/_0.85)] backdrop-blur px-3 py-1.5 rounded-full text-xs border border-white/10">
            {scanning ? <span className="text-[var(--color-brand-300)]">Scanning…</span> : <span className="text-white/70">Idle</span>}
          </div>
        </div>
      </div>

      {/* Result toast */}
      {result && (
        <div
          className={`mt-4 rounded-xl p-3 text-sm border ${
            result.ok
              ? 'bg-[color:rgb(50_213_131_/_0.16)] border-[color:rgb(50_213_131_/_0.35)] text-[var(--color-brand-100)] confetti'
              : 'bg-[color:rgb(255_77_79_/_0.14)] border-[color:rgb(255_77_79_/_0.35)] text-[color:rgb(255_182_185)]'
          }`}
        >
          <div className="text-base font-semibold">
            {result.ok ? 'Accepted — enjoy!' : 'Rejected'}
          </div>
          {!result.ok && result.reason && (
            <div className="mt-1 text-white/70">
              Reason:{' '}
              <span className="font-mono text-white/80">{result.reason}</span>
            </div>
          )}
          <button
            onClick={scanAgain}
            className="mt-2 rounded-full px-3 py-1.5 text-sm border border-white/10 bg-[var(--color-ink-700)] hover:bg-[var(--color-ink-600)] transition"
          >
            Scan another
          </button>
        </div>
      )}

      <p className="mt-3 text-white/50 text-xs">
        Tip: If you keep seeing <code className="font-mono">expired</code>, bump the token TTL to 120s while testing.
      </p>
    </div>
  );
}
