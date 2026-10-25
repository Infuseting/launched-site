const loaderKeys = ['forge', 'fabric', 'neoforge', 'quilt'] as const;

/** A loader change replaces the entire selection; unrelated updates preserve it. */
export function sessionLoaderUpdate(body: Record<string, unknown>) {
  if (!loaderKeys.some((key) => Object.hasOwn(body, key))) return undefined;

  const loaders: Record<(typeof loaderKeys)[number], string | null> = {
    forge: null, fabric: null, neoforge: null, quilt: null,
  };
  for (const key of loaderKeys) {
    const value = body[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error('La version du loader doit être une chaîne de caractères.');
    }
    loaders[key] = typeof value === 'string' ? value.trim() || null : null;
  }
  if (Object.values(loaders).filter(Boolean).length > 1) {
    throw new Error('Une session ne peut utiliser qu’un seul modloader.');
  }
  return loaders;
}
