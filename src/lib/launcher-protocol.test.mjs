import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launcherContext, parseAccessUpdate, pkceChallenge } from './launcher-protocol.ts';

test('launcher callback permits only a loopback IP and a PKCE-bound state', () => {
  const params = new URLSearchParams({ launcher_redirect: 'http://127.0.0.1:54321/callback', code_challenge: 'a'.repeat(43), launcher_state: 'b'.repeat(43) });
  assert.equal(launcherContext(params).redirect, 'http://127.0.0.1:54321/callback');
  for (const redirect of ['https://evil.example/callback', 'http://localhost:54321/callback', 'http://127.0.0.1:54321/other', 'http://127.0.0.1:54321/callback?code=stolen', 'http://user@127.0.0.1:54321/callback']) {
    const invalid = new URLSearchParams(params);
    invalid.set('launcher_redirect', redirect);
    assert.throws(() => launcherContext(invalid));
  }
  assert.equal(launcherContext(new URLSearchParams()), null);
  params.set('code_challenge', 'short');
  assert.throws(() => launcherContext(params));
});

test('PKCE uses the S256 reference vector from RFC 7636', () => {
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('access lists support future users and stable Discord IDs without accepting display names', () => {
  assert.deepEqual(parseAccessUpdate({ publicAccess: false, allowedDiscordUsers: [' @some.user ', 'SOME.USER', '123456789012345678'] }), {
    publicAccess: false, identifiers: ['some.user', '123456789012345678'],
  });
  assert.equal(parseAccessUpdate({ name: 'New name' }).identifiers, undefined);
  for (const body of [{ publicAccess: 'false' }, { allowedDiscordUsers: 'anyone' }, { allowedDiscordUsers: ['Display Name'] }, { allowedDiscordUsers: [42] }, { allowedDiscordUsers: Array(501).fill('valid.user') }]) {
    assert.throws(() => parseAccessUpdate(body));
  }
});
