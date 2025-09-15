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
  const stopRef = useRef<() => void>(() => {});

  const [scanning, setScanning] = useState<boolean>(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // ----- helpers -----
  const stopCamera = () => {
    try { (readerRef.current as any)?.reset?.(); } catch {}
    const stream = videoRef.current?.srcObject as MediaStream | undefined;
    stream?.getTracks()?.forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

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
        if (mounted) setError('This account is not linked to a merchant.');
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
      stopCamera();
    };
  }, [router]);

  // Start camera + reader with explicit getUserMedia (iOS-friendly)
  const startScan = async () => {
    if (!merchantId) {
      setError('Merchant not ready yet. Please wait a moment and try again.');
      return;
    }
    setError(null);
    setResult(null);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });
      if (!videoRef.current) throw new Error('video missing');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // decode continuously until we handle one result
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (res: Result | undefined) => {
          if (!res) return;
          controls.stop(); // stop reading further
          handleToken(res.getText());
        }
      );

      stopRef.current = () => {
        try { controls.stop(); } catch {}
        stopCamera();
        setScanning(false);
      };
    } catch (e: unknown) {
      console.error(e);
      setScanning(false);
      const msg =
        (e as Error)?.name === 'NotAllowedError'
          ? 'Camera permission denied. Enable camera in Site Settings.'
          : 'Camera error. Please check permissions and try again.';
      setError(msg);
      stopCamera();
    }
  };

  const handleToken = async (tokenText: string) => {
    stopCamera();
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
  };

  const scanAgain = () => {
    setResult(null);
    startScan();
  };

  return (
    <div className="py-4">
      <h1 className="text-xl font-semibold mb-3">Merchant Scanner</h1>

      {error && (
        <div className="mb-3 rounded-xl border border-white/10 bg-[color:rgb(255_77_79_/_0.12)] text-[color:rgb(255_182_185)] px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!scanning && (
        <button
          onClick={startScan}
          disabled={!merchantId}
          className="rounded-full bg-[var(--color-brand-600)] text-white font-semibold px-4 py-2 disabled:opacity-50 animate-[pulse-soft_1.8s_ease-in-out_infinite]"
        >
          {result ? 'Scan again' : 'Start scan'}
        </button>
      )}

      {/* Camera viewport with viewfinder */}
      <div className="mt-4 rounded-3xl overflow-hidden bg-black border border-white/10 shadow-lg">
        <div className="relative aspect-[3/4]">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

          {/* Viewfinder overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] h-[48%] rounded-2xl border-2 border-white/50 relative">
              <div className="absolute -left-1 -top-1 w-8 h-8 border-t-4 border-l-4 border-[var(--color-brand-600)] rounded-tl-xl" />
              <div className="absolute -right-1 -top-1 w-8 h-8 border-t-4 border-r-4 border-[var(--color-brand-600)] rounded-tr-xl" />
              <div className="absolute -left-1 -bottom-1 w-8 h-8 border-b-4 border-l-4 border-[var(--color-brand-600)] rounded-bl-xl" />
              <div className="absolute -right-1 -bottom-1 w-8 h-8 border-b-4 border-r-4 border-[var(--color-brand-600)] rounded-br-xl" />
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
              ? 'bg-[color:rgb(50_213_131_/_0.14)] border-[color:rgb(50_213_131_/_0.35)] text-[var(--color-brand-100)] confetti'
              : 'bg-[color:rgb(255_77_79_/_0.14)] border-[color:rgb(255_77_79_/_0.35)] text-[color:rgb(255_182_185)]'
          }`}
        >
          <div className="text-base font-semibold">
            {result.ok ? 'Accepted — enjoy!' : 'Rejected'}
          </div>
          {!result.ok && result.reason && (
            <div className="mt-1 text-white/70">
              Reason: <span className="font-mono text-white/80">{result.reason}</span>
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
