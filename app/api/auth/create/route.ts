export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { email, phone, password } = await req.json();

    // (Optional) check availability first with your RPC to surface nice errors
    // const { data: avail } = await admin.rpc('check_identifier_available', { p_email: email ?? null, p_phone: phone });

    const { data, error } = await admin.auth.admin.createUser({
      email: email || undefined,
      phone,
      password,
      email_confirm: !!email,
      phone_confirm: true, // <-- the key
      user_metadata: { role: 'consumer' },
    });

    if (error) {
      // Map common errors to client-friendly status codes
      const conflict = /already exists|duplicate/i.test(error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: conflict ? 409 : 400 });
    }

    // Ensure a profiles row exists
    const { error: profErr } = await admin
      .from('profiles')
      .upsert({ id: data.user!.id, email: email ?? null }, { onConflict: 'id' });

    if (profErr) console.error('ensure profile error', profErr);

    return NextResponse.json({ ok: true, userId: data.user?.id });
  } catch (err: any) {
    console.error('/api/auth/create error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
