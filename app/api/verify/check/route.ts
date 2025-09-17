export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import twilio from 'twilio';

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);

function normalizePhoneAU(input: string) {
  const raw = input.replace(/\s+/g, '');
  if (/^\+6104\d{8}$/.test(raw)) return '+61' + raw.slice(4);
  if (/^\+614\d{8}$/.test(raw)) return raw;
  if (/^04\d{8}$/.test(raw)) return '+61' + raw.slice(1);
  if (/^0\d{9}$/.test(raw)) return '+61' + raw.slice(1);
  return raw;
}

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
    const to = normalizePhoneAU((phone ?? '').trim());
    if (!code) return NextResponse.json({ approved: false, error: 'Missing code' }, { status: 400 });

    const check = await client.verify.v2
      .services(TWILIO_VERIFY_SID!)
      .verificationChecks.create({ to, code });

    const approved = check.status === 'approved';
    return NextResponse.json({ approved });
  } catch (err: any) {
    console.error('verify/check error', err);
    return NextResponse.json({ approved: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
