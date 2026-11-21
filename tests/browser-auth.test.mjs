import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(
  await readFile(new URL('../src/lib/browser-auth.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { authFetch, consumeTokenFromUrl } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
  else delete globalThis.window;
});

function storage(token) {
  let current = token;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => current,
      setItem: (_key, value) => {
        current = value;
      },
      removeItem: () => {
        current = null;
      },
    },
  });
  return () => current;
}

test('the current OAuth cookie wins over an old token from another account', async (t) => {
  const stored = storage('old-account-token');
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.has('Authorization'), false);
    assert.equal(options.credentials, 'include');
    return Response.json({ user: { id: 'new-account' } });
  });
  assert.equal((await (await authFetch('/api/dashboard/me')).json()).user.id, 'new-account');
  assert.equal(stored(), null);
});

test('a browser with only a legacy token retries an unauthorized request once', async (t) => {
  storage('legacy-token');
  const headers = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    headers.push(options.headers.get('Authorization'));
    return headers.length === 1
      ? new Response(null, { status: 401 })
      : Response.json({ success: true });
  });
  assert.equal((await authFetch('/api/dashboard/me')).status, 200);
  assert.deepEqual(headers, [null, 'Bearer legacy-token']);
});

test('an expired legacy token is removed after the fallback also fails', async (t) => {
  const stored = storage('expired-token');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(null, { status: 401 });
  });
  assert.equal((await authFetch('/api/dashboard/me')).status, 401);
  assert.equal(calls, 2);
  assert.equal(stored(), null);
});

test('blocked local storage does not prevent cookie authentication', async (t) => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('Storage disabled');
    },
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true }));
  assert.equal((await authFetch('/api/dashboard/me')).status, 200);
});

test('consuming a legacy token removes only that parameter and preserves history state', () => {
  const stored = storage(null);
  const state = { selection: 'sessions' };
  let replacement;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { href: 'https://launched.test/dashboard?token=legacy&error=notice#sessions' },
      history: {
        state,
        replaceState: (...args) => {
          replacement = args;
        },
      },
    },
  });
  consumeTokenFromUrl();
  assert.equal(stored(), 'legacy');
  assert.deepEqual(replacement, [state, '', '/dashboard?error=notice#sessions']);
});
