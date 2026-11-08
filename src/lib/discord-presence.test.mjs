import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePresenceUpdate, sessionPresenceForLauncher } from './discord-presence.ts';

const custom = activity => ({
  mode: 'custom',
  config: { applicationId: '1552256142317453423', showElapsed: true, activity: { type: 0, ...activity } },
});

test('an omitted update preserves the configuration and null restores Launched', () => {
  assert.equal(parsePresenceUpdate(undefined), undefined);
  assert.equal(parsePresenceUpdate(null), null);
  assert.equal(sessionPresenceForLauncher(null), undefined);
  assert.equal(sessionPresenceForLauncher({ mode: 'off' }), undefined);
});

test('the stored custom configuration sends Discord fields and two ordered buttons', () => {
  const stored = parsePresenceUpdate(custom({
    details: '  Sur le serveur  ',
    status_display_type: 2,
    details_url: 'https://example.com/serveur',
    assets: { large_image: 'Serveur', large_url: 'https://example.com' },
    buttons: [
      { label: 'Discord', url: 'https://discord.gg/example' },
      { label: 'Site', url: 'https://example.com' },
    ],
    secrets: { join: 'ignored' },
  }));
  const { activity } = sessionPresenceForLauncher(JSON.parse(JSON.stringify(stored)));
  assert.equal(activity.details, 'Sur le serveur');
  assert.equal(activity.assets.large_image, 'serveur');
  assert.equal(activity.assets.large_url, 'https://example.com/');
  assert.deepEqual(activity.buttons.map(button => button.label), ['Discord', 'Site']);
  assert.equal(activity.secrets, undefined);
});

test('rejects partial buttons, unsupported link schemes and more than two buttons', () => {
  assert.throws(() => parsePresenceUpdate(custom({ buttons: [{ label: 'Site' }] })), /libellé et l’adresse/);
  assert.throws(() => parsePresenceUpdate(custom({ buttons: [{ label: 'Site', url: 'file:///tmp' }] })), /HTTP ou HTTPS/);
  assert.throws(() => parsePresenceUpdate(custom({ buttons: [{}, {}, {}] })), /jusqu’à deux/);
  assert.throws(() => parsePresenceUpdate(custom({ status_display_type: 1 })), /sous-texte/);
});
