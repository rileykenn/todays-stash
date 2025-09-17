export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email, phone, password } = await req.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRole) {
      // Helpful error instead of crashing the build
      return NextResponse.json(
        { ok: false, error: 'Server misconfig: missing SUPABASE envs' },
        { status: 500 }
      );
    }

    const admin = createClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email: email || undefined,
      phone,
      password,
      email_confirm: !!email,
      phone_confirm: true,
      user_metadata: { role: 'consumer' },
    });
    if (error) {
      const conflict = /already exists|duplicate/i.test(error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: conflict ? 409 : 400 });
    }

    // ensure profile row (optional)
    await admin.from('profiles').upsert({ id: data.user!.id, email: email ?? null }, { onConflict: 'id' });

    return NextResponse.json({ ok: true, userId: data.user?.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
