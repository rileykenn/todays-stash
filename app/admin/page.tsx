'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabaseBrowser';

type AppRow = {
  id: string;
  user_id: string | null;
  contact_name: string | null;
  business_name: string | null;
  abn: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  created_at: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  photo_url: string | null;
  created_at: string | null;
};

function AdminHomePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/merchant/login?next=/admin');
        return;
      }
      const { data: adminRes } = await sb.rpc('is_admin');
      if (!adminRes) {
        router.replace('/consumer');
        return;
      }
      if (!mounted) return;
      setIsAdmin(true);

      const [{ data: apps }, { data: merch }] = await Promise.all([
        sb.from('merchant_applications').select('*').order('created_at', { ascending: false }),
        sb.from('merchants').select('id,name,photo_url,created_at').order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      setApps((apps || []) as any);
      setMerchants((merch || []) as any);
      setLoading(false);
    }
    init();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function approve(app: AppRow) {
    setError(null);
    const { data: merch, error: mErr } = await sb.from('merchants').insert({ name: app.business_name }).select('id').single();
    if (mErr) { setError(mErr.message); return; }
    const merchant_id = (merch as any).id as string;

    if (app.user_id) {
      const { error: sErr } = await sb.from('merchant_staff').insert({ merchant_id, user_id: app.user_id, role: 'owner' });
      if (sErr) { setError(sErr.message); return; }
    }
    const { error: uErr } = await sb.from('merchant_applications').update({ status: 'approved' }).eq('id', app.id);
    if (uErr) { setError(uErr.message); return; }

    const [{ data: apps }, { data: merchs }] = await Promise.all([
      sb.from('merchant_applications').select('*').order('created_at', { ascending: false }),
      sb.from('merchants').select('id,name,photo_url,created_at').order('created_at', { ascending: false }),
    ]);
    setApps((apps || []) as any);
    setMerchants((merchs || []) as any);
  }

  return (
    <main style={{ maxWidth: 980, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Admin Dashboard</h1>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Merchant applications</h2>
        {loading ? <div>Loading…</div> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {apps.length === 0 && <div style={{ color: '#6b7280' }}>No applications yet.</div>}
            {apps.map(app => (
              <div key={app.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{app.business_name}</div>
                  <div style={{ color: '#6b7280', fontSize: 14 }}>
                    {app.contact_name} • {app.email} • {app.phone} • ABN {app.abn} • Status: {app.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {app.status !== 'approved' && (
                    <button onClick={() => approve(app)} style={{ padding: '8px 12px', borderRadius: 10, background: '#10b981', color: '#fff' }}>
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Merchants</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {merchants.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{m.name || '(unnamed)'}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>ID: {m.id}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/admin/merchants/${m.id}`} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default AdminHomePage;
