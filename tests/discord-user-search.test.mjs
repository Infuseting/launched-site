import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const virtual = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const players = [
  { discordId: '123456789012345678', username: 'alice', avatar: null, role: 'PLAYER', sftpPassword: 'private' },
  { discordId: '234567890123456789', username: 'alice.creator', avatar: 'https://cdn.discordapp.com/example.png', role: 'CREATOR', sftpPassword: 'private' },
];
let currentUser = null;
let calls = 0;
let unavailable = false;
globalThis.__discordSearch = {
  currentUser: () => currentUser,
  prisma: { user: { findMany: async ({ where, select, take }) => {
    calls++;
    if (unavailable) throw new Error('Database unavailable');
    return players.filter(user => where.discordId
      ? user.discordId === where.discordId
      : user.username.toLowerCase().includes(where.username.contains.toLowerCase()))
      .slice(0, take).map(user => Object.fromEntries(Object.keys(select ?? user).map(key => [key, user[key]])));
  } } },
};
let source = await readFile(new URL('../src/app/api/dashboard/users/route.ts', import.meta.url), 'utf8');
for (const [name, replacement] of Object.entries({
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)};',
  '@/lib/auth': 'export const getCurrentUser=async()=>globalThis.__discordSearch.currentUser();',
  '@/lib/prisma': 'export const prisma=globalThis.__discordSearch.prisma;',
})) source = source.replace(`from '${name}'`, `from '${virtual(replacement)}'`);
const { GET } = await import(virtual(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText));
const search = query => GET(new Request(`https://launched.test/api/dashboard/users?q=${encodeURIComponent(query)}`));

test('the directory requires creator authentication and three characters before querying', async () => {
  calls = 0;
  currentUser = null;
  assert.equal((await search('alice')).status, 401);
  currentUser = { id: 'creator' };
  for (const query of ['', 'al', '  @al  ']) assert.deepEqual(await (await search(query)).json(), { users: [], hasMore: false });
  assert.equal(calls, 0);
  assert.equal((await search('a'.repeat(101))).status, 400);
  assert.equal(calls, 0);
});

test('search finds players and creators without disclosing account permissions or credentials', async () => {
  currentUser = { id: 'creator' };
  const response = await search(' @ALI ');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /Cookie/);
  const result = await response.json();
  assert.equal(result.users.length, 2);
  for (const user of result.users) assert.deepEqual(Object.keys(user).sort(), ['avatar', 'discordId', 'username']);
  assert.equal(result.hasMore, false);
  assert.equal((await (await search(players[0].discordId)).json()).users[0].username, 'alice');
  assert.deepEqual((await (await search('999999999999999999')).json()).users, []);
});

test('large directories are bounded and failures remain private', async () => {
  currentUser = { id: 'creator' };
  players.push(...Array.from({ length: 30 }, (_, i) => ({ discordId: String(300000000000000000n + BigInt(i)), username: `member.${i}`, avatar: null })));
  const result = await (await search('member')).json();
  assert.equal(result.users.length, 20);
  assert.equal(result.hasMore, true);
  unavailable = true;
  const response = await search('alice');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  unavailable = false;
});
