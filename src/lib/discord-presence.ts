export type DiscordPresence = {
  applicationId: string;
  showElapsed: boolean;
  activity: {
    type: 0 | 2 | 3 | 5;
    status_display_type?: 0 | 1 | 2;
    name?: string;
    details?: string;
    details_url?: string;
    state?: string;
    state_url?: string;
    assets?: Partial<Record<AssetField, string>>;
    buttons?: { label: string; url: string }[];
  };
};

type AssetField = 'large_image' | 'large_text' | 'large_url' | 'small_image' | 'small_text' | 'small_url';
export type SessionPresence = { mode: 'custom'; config: DiscordPresence };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Configuration Rich Presence invalide.');
  }
  return value as Record<string, unknown>;
}

function validApplicationId(value: string) {
  return /^[1-9][0-9]{16,19}$/.test(value) && BigInt(value) <= BigInt('18446744073709551615');
}

function optionalText(value: unknown, field: string, max = 128, min = 2) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} doit être du texte.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < min || trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error(`${field} doit contenir entre ${min} et ${max} caractères sur une seule ligne.`);
  }
  return trimmed;
}

function optionalUrl(value: unknown, field: string) {
  const text = optionalText(value, field, 256);
  if (text === undefined) return undefined;
  const invalidUrl = `${field} doit être une URL HTTP ou HTTPS valide.`;
  if (!/^https?:\/\//i.test(text) || !URL.canParse(text)) throw new Error(invalidUrl);
  const url = new URL(text);
  if (url.username || url.password || url.href.length > 256) {
    throw new Error(invalidUrl);
  }
  return url.href;
}

function optionalImage(value: unknown, field: string) {
  const text = optionalText(value, field, 256, 1);
  if (text === undefined || /^[a-z0-9_-]+$/i.test(text)) return text?.toLowerCase();
  return optionalUrl(text, field);
}

export function parsePresenceUpdate(value: unknown): SessionPresence | null | undefined {
  if (value === undefined || value === null) return value;
  const settings = record(value);
  if (settings.mode !== 'custom') throw new Error('Mode Rich Presence invalide.');

  const config = record(settings.config);
  const applicationId = optionalText(config.applicationId, 'L’identifiant d’application Discord', 20);
  if (!applicationId || !validApplicationId(applicationId)) {
    throw new Error('Saisissez un identifiant d’application Discord valide.');
  }
  if (typeof config.showElapsed !== 'boolean') throw new Error('Option de chronomètre invalide.');

  const activity = record(config.activity);
  const { type, status_display_type: statusDisplay } = activity;
  if (type !== 0 && type !== 2 && type !== 3 && type !== 5) throw new Error('Type d’activité Discord invalide.');
  if (statusDisplay !== undefined && statusDisplay !== 0 && statusDisplay !== 1 && statusDisplay !== 2) {
    throw new Error('Texte de statut Discord invalide.');
  }
  const details = optionalText(activity.details, 'Les détails');
  const state = optionalText(activity.state, 'Le sous-texte');
  const detailsUrl = optionalUrl(activity.details_url, 'Le lien des détails');
  const stateUrl = optionalUrl(activity.state_url, 'Le lien du sous-texte');
  if ((detailsUrl || statusDisplay === 2) && !details) throw new Error('Renseignez les détails pour les utiliser comme statut ou lien.');
  if ((stateUrl || statusDisplay === 1) && !state) throw new Error('Renseignez le sous-texte pour l’utiliser comme statut ou lien.');

  const assets = activity.assets === undefined ? {} : record(activity.assets);
  const largeImage = optionalImage(assets.large_image, 'La grande image');
  const smallImage = optionalImage(assets.small_image, 'La petite image');
  const largeText = optionalText(assets.large_text, 'L’infobulle de la grande image');
  const smallText = optionalText(assets.small_text, 'L’infobulle de la petite image');
  const largeUrl = optionalUrl(assets.large_url, 'Le lien de la grande image');
  const smallUrl = optionalUrl(assets.small_url, 'Le lien de la petite image');
  if (!largeImage && (largeText || largeUrl)) throw new Error('Renseignez la grande image pour lui ajouter un lien ou une infobulle.');
  if (!smallImage && (smallText || smallUrl)) throw new Error('Renseignez la petite image pour lui ajouter un lien ou une infobulle.');

  const rawButtons = activity.buttons ?? [];
  if (!Array.isArray(rawButtons) || rawButtons.length > 2) throw new Error('Discord accepte jusqu’à deux boutons.');
  const buttons = rawButtons.flatMap((value, index) => {
    const button = record(value);
    const label = optionalText(button.label, `Le libellé du bouton ${index + 1}`, 32, 1);
    const url = optionalUrl(button.url, `L’adresse du bouton ${index + 1}`);
    if (!label && !url) return [];
    if (!label || !url) throw new Error(`Renseignez le libellé et l’adresse du bouton ${index + 1}.`);
    return [{ label, url }];
  });

  return {
    mode: 'custom',
    config: {
      applicationId,
      showElapsed: config.showElapsed,
      activity: {
        type,
        status_display_type: statusDisplay,
        name: optionalText(activity.name, 'Le nom affiché'),
        details,
        details_url: detailsUrl,
        state,
        state_url: stateUrl,
        assets: largeImage || smallImage ? {
          large_image: largeImage, large_text: largeText, large_url: largeUrl,
          small_image: smallImage, small_text: smallText, small_url: smallUrl,
        } : undefined,
        buttons: buttons.length ? buttons : undefined,
      },
    },
  };
}

export function sessionPresenceForLauncher(stored: unknown): DiscordPresence | undefined {
  try {
    return parsePresenceUpdate(stored)?.config;
  } catch {
    return undefined;
  }
}
