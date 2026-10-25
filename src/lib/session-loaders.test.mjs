import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionLoaderUpdate } from './session-loaders.ts';

test('switching loaders clears all previous loaders, including legacy clients omitting fields', () => {
  for (const from of ['forge', 'fabric', 'neoforge', 'quilt']) {
    for (const to of ['forge', 'fabric', 'neoforge', 'quilt']) {
      const stored = { forge: null, fabric: null, neoforge: null, quilt: null, [from]: 'old' };
      const updated = { ...stored, ...sessionLoaderUpdate(JSON.parse(JSON.stringify({ [to]: ' new ' }))) };
      assert.equal(updated[to], 'new');
      assert.equal(Object.values(updated).filter(Boolean).length, 1);
    }
  }
});

test('vanilla clears every loader and unrelated updates preserve selection', () => {
  assert.deepEqual(sessionLoaderUpdate({ forge: null, fabric: null, neoforge: null, quilt: null }), {
    forge: null, fabric: null, neoforge: null, quilt: null,
  });
  assert.equal(sessionLoaderUpdate({ name: 'Renamed' }), undefined);
});

test('rejects multiple loaders and invalid version types', () => {
  assert.throws(() => sessionLoaderUpdate({ forge: '47.4.0', fabric: '0.16.9' }));
  assert.throws(() => sessionLoaderUpdate({ neoforge: 21 }));
  assert.equal(sessionLoaderUpdate({ forge: '  ' })?.forge, null);
});
