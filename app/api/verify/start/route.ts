import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import twilio from 'twilio';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const verifySid = process.env.TWILIO_VERIFY_SID!; // MUST be VAxxxxxxxx

    const client = twilio(accountSid, authToken);
    const res = await client.verify.v2.services(verifySid).verifications.create({
      to: phone,
      channel: 'sms',
    });

    return NextResponse.json({ status: res.status }); // "pending"
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'failed to start verification' }, { status: 500 });
  }
}
