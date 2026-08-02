import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const correctUsername = process.env.AUTH_USERNAME || 'Ruoting';
    const correctPassword = process.env.AUTH_PASSWORD || 'dmr2026';

    if (username !== correctUsername || password !== correctPassword) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Create a simple signed token
    const secret = process.env.AUTH_SECRET || 'dmr-visualizer-secret-2026';
    const payload = Buffer.from('authenticated').toString('base64');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const token = `${payload}.${signature}`;

    const response = NextResponse.json({ success: true });
    response.cookies.set('dmr_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
