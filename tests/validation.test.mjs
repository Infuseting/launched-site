import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const validatorUrl = moduleUrl(
  compile(await readFile(new URL('../src/lib/validations/validator.ts', import.meta.url), 'utf8')),
);
const schemaCode = compile(
  await readFile(new URL('../src/lib/validations/session.schema.ts', import.meta.url), 'utf8'),
).replace("'./validator'", JSON.stringify(validatorUrl));
const { createSessionSchema, updateSessionSchema } = await import(moduleUrl(schemaCode));
const { v } = await import(validatorUrl);

let middlewareSource = await readFile(
  new URL('../src/lib/api/middleware.ts', import.meta.url),
  'utf8',
);
for (const [name, replacement] of Object.entries({
  'next/server': moduleUrl(
    'export const NextResponse = { json: (body, options) => Response.json(body, options) };',
  ),
  '@/lib/auth': moduleUrl('export const getCurrentUser = async () => null;'),
  '@/lib/prisma': moduleUrl('export const prisma = {};'),
  '@/lib/validations/validator': validatorUrl,
}))
  middlewareSource = middlewareSource.replace(`from '${name}'`, `from '${replacement}'`);
const { handleApiError, validateInput } = await import(moduleUrl(compile(middlewareSource)));

test('a partial session update preserves omitted settings, flags and links', () => {
  const stored = {
    name: 'Survie',
    welcome: 'Bienvenue',
    crack: true,
    links: [{ name: 'Wiki', url: 'https://example.com' }],
  };
  const changes = updateSessionSchema.parse({ name: 'Nouveau nom' });
  assert.deepEqual({ ...stored, ...changes }, { ...stored, name: 'Nouveau nom' });
  assert.deepEqual(updateSessionSchema.parse({}), {});
});

test('explicit false, empty text and an empty link list remain valid updates', () => {
  assert.deepEqual(updateSessionSchema.parse({ crack: false, welcome: '', links: [] }), {
    crack: false,
    welcome: '',
    links: [],
  });
});

test('create applies defaults but rejects coerced booleans and malformed objects', () => {
  const defaults = createSessionSchema.parse({ name: 'Survie', minecraft: '1.20.1' });
  assert.equal(defaults.crack, false);
  assert.equal(defaults.publicAccess, true);
  assert.deepEqual(defaults.links, []);
  assert.equal(
    createSessionSchema.safeParse({ name: 'Survie', minecraft: '1.20.1', crack: 'false' }).success,
    false,
  );
  assert.equal(updateSessionSchema.safeParse([]).success, false);
});

test('invalid numeric values and excessive link lists fail without silently dropping data', () => {
  for (const value of ['1', true, NaN, Infinity])
    assert.equal(v.number().safeParse(value).success, false);
  assert.equal(
    updateSessionSchema.safeParse({
      links: Array(4).fill({ name: 'Wiki', url: 'https://example.com' }),
    }).success,
    false,
  );
});

test('API failures do not disclose unexpected database or configuration messages', async (t) => {
  t.mock.method(console, 'error', () => {});
  const response = handleApiError(new Error('Database connection password=private'));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Une erreur interne est survenue' });
});

test('deliberate input errors and invalid JSON remain actionable client errors', async () => {
  let invalidInput;
  try {
    validateInput(() => {
      throw new Error('Version du loader invalide');
    });
  } catch (error) {
    invalidInput = error;
  }
  const response = handleApiError(invalidInput);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Version du loader invalide' });
  assert.equal(handleApiError(new SyntaxError('Unexpected token')).status, 400);
});
