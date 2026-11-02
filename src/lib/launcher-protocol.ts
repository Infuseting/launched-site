import crypto from 'node:crypto';

export const LAUNCHER_LIFETIME_MS = 90 * 24 * 3600 * 1000;
export const hashCredential = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const pkceChallenge = (value: string) => crypto.createHash('sha256').update(value).digest('base64url');

export function launcherContext(params: URLSearchParams) {
  const redirect = params.get('launcher_redirect');
  if (redirect === null) return null;
  const url = new URL(redirect);
  const challenge = params.get('code_challenge') || '';
  const state = params.get('launcher_state') || '';
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.pathname !== '/callback' || url.search || url.hash || url.username || url.password ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
    throw new Error('Paramètres de connexion launcher invalides.');
  }
  return { redirect: url.toString(), challenge, state };
}

export function parseAccessUpdate(body: Record<string, unknown>) {
  if (body.publicAccess !== undefined && typeof body.publicAccess !== 'boolean') {
    throw new Error('Le type d’accès doit être public ou privé.');
  }
  if (body.allowedDiscordUsers === undefined) return { publicAccess: body.publicAccess as boolean | undefined };
  if (!Array.isArray(body.allowedDiscordUsers) || body.allowedDiscordUsers.length > 500) {
    throw new Error('La liste est limitée à 500 comptes Discord.');
  }
  const identifiers = [...new Set(body.allowedDiscordUsers.map((value: unknown) => {
    if (typeof value !== 'string') throw new Error('Compte Discord invalide.');
    const normalized = value.trim().replace(/^@/, '').toLowerCase();
    if (!/^(?:[0-9]{17,20}|[a-z0-9_.]{2,32})$/.test(normalized)) {
      throw new Error(`Compte Discord invalide : ${value}. Utilisez le nom d’utilisateur unique ou l’identifiant Discord.`);
    }
    return normalized;
  }))];
  return { publicAccess: body.publicAccess as boolean | undefined, identifiers };
}
