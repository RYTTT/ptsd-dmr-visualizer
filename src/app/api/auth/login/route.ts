import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  createAuthToken,
  getAuthConfig,
  timingSafeTextEqual,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 4_096) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 413 });
    }

    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('username' in body) ||
      !('password' in body) ||
      typeof body.username !== 'string' ||
      typeof body.password !== 'string' ||
      body.username.length > 256 ||
      body.password.length > 256
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const config = getAuthConfig();
    if (!config) {
      console.error('Authentication is not configured: set AUTH_USERNAME, AUTH_PASSWORD, and a 32+ character AUTH_SECRET');
      return NextResponse.json({ error: 'Authentication is unavailable' }, { status: 503 });
    }

    const [usernameMatches, passwordMatches] = await Promise.all([
      timingSafeTextEqual(body.username, config.username),
      timingSafeTextEqual(body.password, config.password),
    ]);
    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await createAuthToken(config.secret);

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
