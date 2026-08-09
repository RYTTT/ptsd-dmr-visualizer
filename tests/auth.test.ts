import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthConfig } from '../src/lib/auth.ts';

const AUTH_ENV_KEYS = [
  'NODE_ENV',
  'VERCEL',
  'AUTH_USERNAME',
  'AUTH_PASSWORD',
  'AUTH_SECRET',
] as const;

function withAuthEnvironment(
  values: Partial<Record<(typeof AUTH_ENV_KEYS)[number], string>>,
  assertion: () => void,
) {
  const previous = Object.fromEntries(
    AUTH_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    Object.assign(process.env, values);
    assertion();
  } finally {
    for (const key of AUTH_ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else Reflect.set(process.env, key, value);
    }
  }
}

test('Vercel production uses the demo account only when AUTH variables are absent', () => {
  withAuthEnvironment({ NODE_ENV: 'production', VERCEL: '1' }, () => {
    const config = getAuthConfig();
    assert.equal(config?.username, 'Ruoting');
    assert.equal(config?.password, 'dmr2026');
    assert.ok((config?.secret.length ?? 0) >= 32);
  });
});

test('partial production authentication configuration fails closed', () => {
  withAuthEnvironment(
    { NODE_ENV: 'production', VERCEL: '1', AUTH_USERNAME: 'private-user' },
    () => assert.equal(getAuthConfig(), null),
  );
});

test('complete production authentication configuration overrides the demo account', () => {
  withAuthEnvironment(
    {
      NODE_ENV: 'production',
      VERCEL: '1',
      AUTH_USERNAME: 'private-user',
      AUTH_PASSWORD: 'private-password',
      AUTH_SECRET: 'a-private-secret-that-is-at-least-32-characters',
    },
    () => {
      const config = getAuthConfig();
      assert.equal(config?.username, 'private-user');
      assert.equal(config?.password, 'private-password');
    },
  );
});
