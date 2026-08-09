import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthConfig, verifyAuthToken } from '@/lib/auth';

function redirectToLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const config = getAuthConfig();
  if (!token || !config || !(await verifyAuthToken(token, config.secret))) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
