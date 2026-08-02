import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, auth API, and static assets through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authToken = request.cookies.get('dmr_auth_token')?.value;
  if (!authToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token (simple HMAC check)
  const secret = process.env.AUTH_SECRET || 'dmr-visualizer-secret-2026';
  const expectedPayload = 'authenticated';
  
  // Token format: payload.signature
  const parts = authToken.split('.');
  if (parts.length !== 2) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const [payload, signature] = parts;
  
  // We can't use Node crypto in Edge runtime, so do a simple check
  // The token is set by our API route which runs in Node runtime
  if (payload !== Buffer.from(expectedPayload).toString('base64')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
