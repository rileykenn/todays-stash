// runtime: node (Twilio SDK needs Node, not Edge)
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
    const { phone } = await req.json();
    const to = normalizePhoneAU((phone ?? '').trim());
    if (!to.startsWith('+61')) {
      return NextResponse.json({ ok: false, error: 'Invalid AU phone' }, { status: 400 });
    }
    const ver = await client.verify.v2
      .services(TWILIO_VERIFY_SID!)
      .verifications.create({ to, channel: 'sms' });
    return NextResponse.json({ ok: true, sid: ver.sid });
  } catch (err: any) {
    console.error('verify/start error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'server error' }, { status: 500 });
  }
}
