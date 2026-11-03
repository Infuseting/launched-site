import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { hashCredential, pkceChallenge } from '../src/lib/launcher-protocol.ts';

// Load the production handlers with isolated database/cookie adapters. No .env or real DB is used.
const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const storage = await mkdtemp(path.join(tmpdir(), 'launched-auth-'));
after(() => rm(storage, { recursive: true, force: true }));
const moduleUrls = new Map();
const virtual = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const players = [
  { id: 'player-1', discordId: '123456789012345678', username: 'first.user', avatar: null, role: 'PLAYER' },
  { id: 'player-2', discordId: '234567890123456789', username: 'other.user', avatar: null, role: 'PLAYER' },
];
const tokens = new Map();
const codes = new Map();
let sessions = [];
let cookies = new Map();
let readinessError = null;
let readinessQueries = 0;
const matches = (row, query) => Object.entries(query).every(([key, value]) => {
  if (key === 'OR') return value.some(branch => matches(row, branch));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('some' in value) return (row[key] ?? []).some(item => matches(item, value.some));
    if ('gt' in value) return row[key] > value.gt;
    if ('lte' in value) return row[key] <= value.lte;
    if ('in' in value) return value.in.includes(row[key]);
  }
  return row[key] === value;
});
const db = {
  launcherToken: {
    findUnique: async ({ where }) => tokens.get(where.tokenHash) ?? null,
    create: async ({ data }) => tokens.set(data.tokenHash, { ...data, id: data.tokenHash, user: players.find(p => p.id === data.userId) }),
    updateMany: async ({ where, data }) => { let count = 0; for (const row of tokens.values()) if (matches(row, where)) { Object.assign(row, data); count++; } return { count }; },
    deleteMany: async ({ where }) => { let count = 0; for (const [key, row] of tokens) if (matches(row, where)) { tokens.delete(key); count++; } return { count }; },
  },
  launcherCode: {
    findFirst: async () => { readinessQueries++; if (readinessError) throw readinessError; return null; },
    findUnique: async ({ where }) => codes.get(where.codeHash) ?? null,
    create: async ({ data }) => codes.set(data.codeHash, { ...data, user: players.find(p => p.id === data.userId) }),
    deleteMany: async ({ where }) => { let count = 0; for (const [key, row] of codes) if (matches(row, where)) { codes.delete(key); count++; } return { count }; },
  },
  session: {
    findMany: async ({ where }) => sessions.filter(row => matches(row, where)),
    findFirst: async ({ where }) => sessions.find(row => matches(row, where)) ?? null,
  },
  user: {
    upsert: async ({ where, create, update }) => {
      const found = players.find(p => p.discordId === where.discordId);
      if (found) { Object.assign(found, update); return found; }
      const player = { id: `player-${players.length + 1}`, ...create };
      players.push(player);
      return player;
    },
  },
  sessionAccess: {
    updateMany: async ({ where, data }) => {
      for (const session of sessions) for (const entry of session.access) if (matches(entry, where)) Object.assign(entry, data);
    },
  },
  $transaction: callback => callback(db),
};
globalThis.__launcherTestDb = db;
globalThis.__launcherTestCookies = { get: name => cookies.has(name) ? { value: cookies.get(name) } : undefined, delete: name => cookies.delete(name) };

async function load(relative) {
  if (moduleUrls.has(relative)) return moduleUrls.get(relative);
  let source = ts.transpileModule(await readFile(new URL(relative, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const replacements = {
    '@/lib/prisma': virtual('export const prisma = globalThis.__launcherTestDb;'),
    './prisma': virtual('export const prisma = globalThis.__launcherTestDb;'),
    'next/server': pathToFileURL(require.resolve('next/server')).href,
    'next/headers': virtual('export async function cookies() { return globalThis.__launcherTestCookies; }'),
    '@/lib/auth': virtual('export const createOAuthState=()=>"signed-state"; export const verifyOAuthState=s=>s==="signed-state"; export const isDiscordAdmin=()=>false; export const createSessionToken=()=>{throw Error("Player must not get creator token")}; export const setSessionCookie=()=>{throw Error("Player must not get creator cookie")};'),
    '@/lib/sftpgo': virtual(`import path from 'node:path'; export const getSessionPhysicalPath=id=>path.join(${JSON.stringify(storage)},id); export async function ensureSessionDirectories(){}; export const syncSftpUser=()=>{throw Error('Player must not get SFTP')};`),
  };
  for (const spec of [...source.matchAll(/from ["']([^"']+)["']/g)].map(match => match[1])) {
    let replacement = replacements[spec];
    if (spec === '@/lib/launcher-auth') replacement = await load('src/lib/launcher-auth.ts');
    if (spec === './launcher-protocol' || spec === '@/lib/launcher-protocol') replacement = pathToFileURL(path.join(fileURLToPath(root), 'src/lib/launcher-protocol.ts')).href;
    if (replacement) source = source.replaceAll(`from "${spec}"`, `from ${JSON.stringify(replacement)}`).replaceAll(`from '${spec}'`, `from ${JSON.stringify(replacement)}`);
  }
  const url = virtual(source);
  moduleUrls.set(relative, url);
  return url;
}
const auth = await import(await load('src/lib/launcher-auth.ts'));
const exchange = await import(await load('src/app/api/auth/launcher/token/route.ts'));
const logout = await import(await load('src/app/api/auth/launcher/logout/route.ts'));
const list = await import(await load('src/app/sessions/route.ts'));
const callback = await import(await load('src/app/api/auth/discord/callback/route.ts'));
const login = await import(await load('src/app/api/auth/discord/login/route.ts'));
const ready = await import(await load('src/app/api/auth/launcher/ready/route.ts'));
const routes = await Promise.all([
  'src/app/api/sessions/[slug]/assets.json/route.ts',
  'src/app/api/sessions/[slug]/sync/route.ts',
  'src/app/api/sessions/[slug]/sync/[...path]/route.ts',
  'src/app/api/sessions/[slug]/assets/[...file]/route.ts',
].map(async file => import(await load(file))));
const credential = `ln_${'a'.repeat(43)}`;
const authorized = () => ({ Authorization: `Bearer ${credential}` });
const request = (route = '/sessions', headers = {}) => new Request(`https://launcher.test${route}`, { headers });
const post = body => new Request('https://launcher.test/api/auth/launcher/token', { method: 'POST', body: JSON.stringify(body) });
function resetToken() {
  tokens.set(hashCredential(credential), { id: hashCredential(credential), tokenHash: hashCredential(credential), user: players[0], userId: players[0].id, expiresAt: new Date(Date.now() + 60_000) });
}

test('bearer is mandatory, expiry is enforced, use renews the session, logout revokes it', async () => {
  resetToken();
  assert.equal(await auth.getLauncherUser(request()), null);
  assert.equal(await auth.getLauncherUser(request('/', { cookie: `launched_session=${credential}` })), null);
  assert.equal((await auth.getLauncherUser(request('/', authorized()))).id, players[0].id);
  assert.ok(tokens.get(hashCredential(credential)).expiresAt > new Date(Date.now() + 89 * 24 * 3600_000));
  tokens.get(hashCredential(credential)).expiresAt = new Date(0);
  assert.equal(await auth.getLauncherUser(request('/', authorized())), null);
  resetToken();
  assert.equal((await logout.POST(request('/', authorized()))).status, 200);
  assert.equal(await auth.getLauncherUser(request('/', authorized())), null);
});

test('code exchange verifies PKCE, expiry, single use, and stores only the token hash', async () => {
  const verifier = 'v'.repeat(43);
  const code = 'c'.repeat(43);
  await db.launcherCode.create({ data: { codeHash: hashCredential(code), userId: players[0].id, challenge: pkceChallenge(verifier), expiresAt: new Date(Date.now() + 60_000) } });
  assert.equal((await exchange.POST(post({ code, verifier: 'x'.repeat(43) }))).status, 401);
  const results = await Promise.all([exchange.POST(post({ code, verifier })), exchange.POST(post({ code, verifier }))]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
  const payload = await results.find(r => r.status === 200).json();
  assert.ok(payload.token.startsWith('ln_'));
  assert.ok(tokens.has(hashCredential(payload.token)));
  assert.equal(tokens.has(payload.token), false);
  assert.equal(payload.user.role, undefined);
  await db.launcherCode.create({ data: { codeHash: hashCredential(code), userId: players[0].id, challenge: pkceChallenge(verifier), expiresAt: new Date(0) } });
  assert.equal((await exchange.POST(post({ code, verifier }))).status, 401);
});

test('listing filters by authenticated identity and ignores the retired visibility switch', async () => {
  resetToken();
  const base = { minecraft: '1.21', syncDir: 'mods', welcome: '', jvmArg: '', credits: '', links: [], members: [], access: [] };
  sessions = [
    { ...base, id: 'public', slug: 'public', name: 'Public', publicAccess: true, showInLauncher: true },
    { ...base, id: 'private', slug: 'private', name: 'Private', publicAccess: false, showInLauncher: true, access: [{ discordId: players[0].discordId }] },
    { ...base, id: 'other', slug: 'other', name: 'Other', publicAccess: false, showInLauncher: true, access: [{ discordId: players[1].discordId }] },
    { ...base, id: 'hidden', slug: 'hidden', name: 'Hidden', publicAccess: true, showInLauncher: false },
    { ...base, id: 'creator', slug: 'creator', name: 'Creator', publicAccess: false, showInLauncher: true, members: [{ userId: players[0].id }] },
  ];
  assert.equal((await list.GET(request())).status, 401);
  const response = await list.GET(request('/sessions', authorized()));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await response.json()).map(s => s.name), ['Public', 'Private', 'Hidden', 'Creator']);
  assert.equal((await auth.authorizeSession(request('/', authorized()), 'hidden')).session.id, 'hidden');
  await mkdir(path.join(storage, 'private', 'sync', 'mods'), { recursive: true });
  await mkdir(path.join(storage, 'private', 'assets'), { recursive: true });
  await writeFile(path.join(storage, 'private', 'sync', 'mods', 'test.jar'), 'private mod');
  await writeFile(path.join(storage, 'private', 'assets', 'logo.png'), 'private logo');
  for (const route of routes) {
    const params = slug => ({ params: Promise.resolve({ slug, path: ['mods', 'test.jar'], file: ['logo.png'] }) });
    assert.equal((await route.GET(request(), params('private'))).status, 401);
    for (const slug of ['other', 'missing']) assert.equal((await route.GET(request('/', authorized()), params(slug))).status, 404);
    const allowed = await route.GET(request('/', authorized()), params('private'));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
    await allowed.arrayBuffer();
  }
  // Revoking access affects a previously authorized token immediately.
  sessions[1].access = [];
  assert.equal((await auth.authorizeSession(request('/', authorized()), 'private')).response.status, 404);
});

test('launcher login reuses the site callback, creates players, and claims pending invitations', async () => {
  process.env.DISCORD_CLIENT_ID = 'test-client';
  process.env.DISCORD_CLIENT_SECRET = 'test-secret';
  const params = new URLSearchParams({ launcher_redirect: 'http://127.0.0.1:54321/callback', code_challenge: 'c'.repeat(43), launcher_state: 's'.repeat(43) });
  const start = await login.GET(request(`/api/auth/discord/login?${params}`));
  assert.equal(new URL(start.headers.get('location')).searchParams.get('scope'), 'identify');
  const context = { redirect: params.get('launcher_redirect'), challenge: params.get('code_challenge'), state: params.get('launcher_state'), oauthState: 'signed-state' };
  sessions.push({ access: [{ identifier: 'future.user', discordId: null }] });
  const previousFetch = globalThis.fetch;
  const fetched = [];
  let profile = { id: '345678901234567890', username: 'future.user', avatar: null };
  globalThis.fetch = async url => {
    fetched.push(url);
    return Response.json(url.endsWith('/token') ? { access_token: 'discord-token' } : profile);
  };
  try {
    cookies = new Map([['oauth_state', 'signed-state'], ['oauth_launcher', JSON.stringify(context)]]);
    const completed = await callback.GET(request('/api/auth/discord/callback?state=signed-state&code=discord-code'));
    const target = new URL(completed.headers.get('location'));
    assert.equal(target.origin, 'http://127.0.0.1:54321');
    assert.equal(target.searchParams.get('state'), context.state);
    assert.ok(target.searchParams.get('code'));
    assert.equal(target.searchParams.get('token'), null);
    assert.equal(players.at(-1).role, 'PLAYER');
    assert.equal(sessions.at(-1).access[0].discordId, players.at(-1).discordId);
    assert.equal(fetched.length, 2); // No guild membership/SFTP requirement for players.
    cookies = new Map([['oauth_state', 'different-state'], ['oauth_launcher', JSON.stringify(context)]]);
    const rejected = await callback.GET(request('/api/auth/discord/callback?state=signed-state&code=discord-code'));
    assert.ok(rejected.headers.get('location').includes('invalid_csrf_state'));
    assert.equal(fetched.length, 2);
    const claimedId = sessions.at(-1).access[0].discordId;
    profile = { ...profile, username: 'renamed.user' };
    cookies = new Map([['oauth_state', 'signed-state'], ['oauth_launcher', JSON.stringify(context)]]);
    await callback.GET(request('/api/auth/discord/callback?state=signed-state&code=discord-code'));
    profile = { ...profile, id: '456789012345678901', username: 'future.user' };
    cookies = new Map([['oauth_state', 'signed-state'], ['oauth_launcher', JSON.stringify(context)]]);
    await callback.GET(request('/api/auth/discord/callback?state=signed-state&code=discord-code'));
    assert.equal(sessions.at(-1).access[0].discordId, claimedId, 'reusing an old username must not transfer an already claimed invitation');
  } finally { globalThis.fetch = previousFetch; }
});

test('creator login retains the guild requirement independently of player login', async () => {
  const start = await login.GET(request('/api/auth/discord/login'));
  assert.equal(new URL(start.headers.get('location')).searchParams.get('scope'), 'identify guilds');
  const previousFetch = globalThis.fetch;
  const userCount = players.length;
  globalThis.fetch = async url => Response.json(url.endsWith('/token') ? { access_token: 'discord-token' } : url.endsWith('/guilds') ? [] : { id: '567890123456789012', username: 'not.in.guild', avatar: null });
  try {
    cookies = new Map([['oauth_state', 'signed-state']]);
    const denied = await callback.GET(request('/api/auth/discord/callback?state=signed-state&code=discord-code'));
    assert.ok(denied.headers.get('location').includes('/dashboard?error=not_in_guild'));
    assert.equal(players.length, userCount);
  } finally { globalThis.fetch = previousFetch; }
});

test('readiness reports unavailable configuration or database before opening the browser', async () => {
  const secret = process.env.DISCORD_CLIENT_SECRET;
  delete process.env.DISCORD_CLIENT_SECRET;
  try {
    assert.equal((await ready.GET()).status, 503);
    assert.equal(readinessQueries, 0);
  } finally { process.env.DISCORD_CLIENT_SECRET = secret; }
  readinessError = Error('private database diagnostics');
  const unavailable = await ready.GET();
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes('private database diagnostics'), false);
  readinessError = null;
  const available = await ready.GET();
  assert.equal(available.status, 200);
  assert.equal(available.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await available.json(), { ready: true });
});

test('all recognized OAuth failures return to the bound launcher without exposing provider details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const context = { redirect: 'http://127.0.0.1:54321/callback', challenge: 'c'.repeat(43), state: 's'.repeat(43), oauthState: 'signed-state' };
  const previousFetch = globalThis.fetch;
  const previousUpsert = db.user.upsert;
  const previousSecret = process.env.DISCORD_CLIENT_SECRET;
  const cases = [
    { query: 'state=signed-state&error=access_denied', error: 'access_denied', stage: 'none' },
    { query: 'state=signed-state', error: 'missing_code', stage: 'none' },
    { query: 'state=invalid-state&code=discord-code', error: 'invalid_csrf_state', stage: 'none' },
    { query: 'state=signed-state&code=discord-code', error: 'server_configuration', stage: 'configuration' },
    { query: 'state=signed-state&code=discord-code', error: 'auth_failed', stage: 'token' },
    { query: 'state=signed-state&code=discord-code', error: 'profile_failed', stage: 'profile' },
    { query: 'state=signed-state&code=discord-code', error: 'server_error', stage: 'network' },
    { query: 'state=signed-state&code=discord-code', error: 'server_error', stage: 'database' },
  ];
  try {
    for (const scenario of cases) {
      cookies = new Map([['oauth_state', 'signed-state'], ['oauth_launcher', JSON.stringify(context)]]);
      if (scenario.stage === 'configuration') delete process.env.DISCORD_CLIENT_SECRET;
      else process.env.DISCORD_CLIENT_SECRET = previousSecret;
      db.user.upsert = scenario.stage === 'database' ? async () => { throw Error('Private database details'); } : previousUpsert;
      globalThis.fetch = async url => {
        if (['none', 'configuration'].includes(scenario.stage)) assert.fail('Rejected requests must not call Discord');
        if (scenario.stage === 'network') throw Error('Private network details');
        if (url.endsWith('/token')) return scenario.stage === 'token' ? new Response('', { status: 400 }) : Response.json({ access_token: 'test' });
        return scenario.stage === 'profile' ? new Response('', { status: 403 }) : Response.json({ id: players[0].discordId, username: players[0].username, avatar: null });
      };
      const response = await callback.GET(request('/api/auth/discord/callback?' + scenario.query));
      const target = new URL(response.headers.get('location'));
      assert.equal(target.origin, 'http://127.0.0.1:54321', scenario.stage);
      assert.equal(target.searchParams.get('state'), context.state);
      assert.equal(target.searchParams.get('error'), scenario.error);
      assert.equal(target.searchParams.get('code'), null);
      assert.equal(target.toString().includes('Private'), false);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    }
  } finally {
    globalThis.fetch = previousFetch;
    db.user.upsert = previousUpsert;
    process.env.DISCORD_CLIENT_SECRET = previousSecret;
  }
});
