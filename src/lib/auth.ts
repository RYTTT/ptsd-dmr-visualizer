const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const AUTH_COOKIE_NAME = 'dmr_auth_token';
const AUTH_SUBJECT = 'authenticated';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

interface AuthTokenPayload {
  sub: typeof AUTH_SUBJECT;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthConfig {
  username: string;
  password: string;
  secret: string;
}

/**
 * Production intentionally has no built-in credentials. Development fallbacks
 * preserve the existing local workflow without making deployed instances
 * guessable.
 */
export function getAuthConfig(): AuthConfig | null {
  const production = process.env.NODE_ENV === 'production';
  const username = process.env.AUTH_USERNAME || (production ? '' : 'Ruoting');
  const password = process.env.AUTH_PASSWORD || (production ? '' : 'dmr2026');
  const secret = process.env.AUTH_SECRET || (production ? '' : 'development-only-dmr-secret-change-me');

  if (!username || !password || secret.length < 32) return null;
  return { username, password, secret };
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function timingSafeTextEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(left)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function createAuthToken(
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    sub: AUTH_SUBJECT,
    iat: now,
    exp: now + ttlSeconds,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importHmacKey(secret),
    textEncoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAuthToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, encodedSignature] = parts;
  const payloadBytes = decodeBase64Url(encodedPayload);
  const signatureBytes = decodeBase64Url(encodedSignature);
  if (!payloadBytes || !signatureBytes) return false;
  const signature = new ArrayBuffer(signatureBytes.byteLength);
  new Uint8Array(signature).set(signatureBytes);

  const validSignature = await crypto.subtle.verify(
    'HMAC',
    await importHmacKey(secret),
    signature,
    textEncoder.encode(encodedPayload),
  );
  if (!validSignature) return false;

  try {
    const payload = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<AuthTokenPayload>;
    const now = Math.floor(Date.now() / 1000);
    return (
      payload.sub === AUTH_SUBJECT &&
      Number.isSafeInteger(payload.iat) &&
      Number.isSafeInteger(payload.exp) &&
      typeof payload.jti === 'string' &&
      payload.jti.length > 0 &&
      payload.iat! <= now + 60 &&
      payload.exp! > now &&
      payload.exp! > payload.iat! &&
      payload.exp! - payload.iat! <= DEFAULT_TTL_SECONDS
    );
  } catch {
    return false;
  }
}
