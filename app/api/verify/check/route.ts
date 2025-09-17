import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import twilio from 'twilio';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return NextResponse.json({ error: 'phone and code required' }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const verifySid = process.env.TWILIO_VERIFY_SID!;

    const client = twilio(accountSid, authToken);
    const res = await client.verify.v2.services(verifySid).verificationChecks.create({
      to: phone,
      code,
    });

    return NextResponse.json({ approved: res.status === 'approved' });
  } catch (err: any) {
    // keep 200 so UI can show nice message
    return NextResponse.json({ approved: false, error: err?.message ?? 'verification failed' });
  }
}
