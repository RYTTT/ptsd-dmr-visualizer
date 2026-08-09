import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  return logout(request);
}
