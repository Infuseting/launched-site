import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import ts from 'typescript';

const virtual = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const admin = { id: 'administrator', role: 'ADMIN' };
let cookieUser = null;
let databaseCalls = 0;
globalThis.__adminAuth = {
  getCurrentUser: (request) =>
    cookieUser ?? (request.headers.get('Authorization') === 'Bearer legacy-admin' ? admin : null),
  prisma: {
    user: {
      findMany: async () => {
        databaseCalls++;
        return [];
      },
      findUnique: async () => {
        databaseCalls++;
        return { id: 'target', sessionMembers: [] };
      },
      update: async ({ data }) => {
        databaseCalls++;
        return {
          id: 'target',
          role: 'CREATOR',
          diskQuotaBytes: 1024n,
          sessionMembers: [],
          ...data,
        };
      },
    },
  },
};
let routeSource = await readFile(
  new URL('../src/app/api/admin/users/route.ts', import.meta.url),
  'utf8',
);
for (const [name, replacement] of Object.entries({
  'next/server':
    'export const NextResponse = { json: (body, options) => Response.json(body, options) };',
  '@/lib/auth':
    'export const getCurrentUser = async (request) => globalThis.__adminAuth.getCurrentUser(request); export const decryptSecret = (value) => value;',
  '@/lib/prisma': 'export const prisma = globalThis.__adminAuth.prisma;',
  '@/lib/sftpgo': 'export const syncSftpUser = async () => true;',
}))
  routeSource = routeSource.replace(`from '${name}'`, `from '${virtual(replacement)}'`);
const handlers = await import(virtual(compile(routeSource)));
const { authFetch } = await import(
  virtual(compile(await readFile(new URL('../src/lib/browser-auth.ts', import.meta.url), 'utf8')))
);
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
after(() => {
  delete globalThis.__adminAuth;
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
});

function request(method, options = {}) {
  return new Request('https://launched.test/api/admin/users', {
    ...options,
    method,
    ...(method === 'PUT' ? { body: JSON.stringify({ userId: 'target', sessionLimit: 3 }) } : {}),
  });
}

test('anonymous admin requests return 401 before reading or mutating data', async () => {
  cookieUser = null;
  databaseCalls = 0;
  for (const method of ['GET', 'PUT'])
    assert.equal((await handlers[method](request(method))).status, 401);
  assert.equal(databaseCalls, 0);
});

test('authenticated non-admins receive 403 before any database operation', async () => {
  cookieUser = { id: 'creator', role: 'CREATOR' };
  databaseCalls = 0;
  for (const method of ['GET', 'PUT'])
    assert.equal((await handlers[method](request(method))).status, 403);
  assert.equal(databaseCalls, 0);
});

test('cookie-first authentication can retry legacy admin GET and PUT requests', async (t) => {
  cookieUser = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'legacy-admin', removeItem: () => {} },
  });
  const attempts = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const method = options.method ?? 'GET';
    attempts.push(options.headers.get('Authorization'));
    return handlers[method](request(method, options));
  });
  for (const method of ['GET', 'PUT']) {
    attempts.length = 0;
    assert.equal((await authFetch('/api/admin/users', { method })).status, 200);
    assert.deepEqual(attempts, [null, 'Bearer legacy-admin']);
  }
});

test('a forbidden cookie account never switches identity to an old admin token', async (t) => {
  cookieUser = { id: 'creator', role: 'CREATOR' };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'legacy-admin', removeItem: () => {} },
  });
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    attempts++;
    return handlers.GET(request('GET', options));
  });
  assert.equal((await authFetch('/api/admin/users')).status, 403);
  assert.equal(attempts, 1);
});
