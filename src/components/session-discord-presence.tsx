import type { ComponentProps } from 'react';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DiscordPresence, SessionPresence } from '@/lib/discord-presence';

export type PresenceFormValue = {
  mode: 'default' | SessionPresence['mode'];
  config: DiscordPresence;
};

export function presenceFormValue(presence?: SessionPresence | null): PresenceFormValue {
  return {
    mode: presence?.mode ?? 'default',
    config: presence?.mode === 'custom' ? presence.config : {
      applicationId: '', showElapsed: true, activity: { type: 0 },
    },
  };
}

function PresenceInput({ id, label, description, ...props }: ComponentProps<typeof Input> & {
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-describedby={description ? `${id}-help` : undefined} {...props} />
      {description && <FieldDescription id={`${id}-help`}>{description}</FieldDescription>}
    </Field>
  );
}

const presenceModes = [
  { value: 'default', label: 'Launched' },
  { value: 'custom', label: 'Personnalisée' },
] as const;

const activityTypes = [
  { value: 0, label: 'Joue à' },
  { value: 2, label: 'Écoute' },
  { value: 3, label: 'Regarde' },
  { value: 5, label: 'Participe à' },
] as const;

const statusFields = [
  { value: 0, label: 'Nom' },
  { value: 1, label: 'Sous-texte' },
  { value: 2, label: 'Détails' },
] as const;

export function SessionDiscordPresence({ value, onChange }: {
  value: PresenceFormValue;
  onChange: (value: PresenceFormValue) => void;
}) {
  const { mode, config } = value;
  const { activity } = config;
  const setConfig = (update: Partial<DiscordPresence>) => onChange({ mode, config: { ...config, ...update } });
  const setActivity = (update: Partial<DiscordPresence['activity']>) => setConfig({ activity: { ...activity, ...update } });

  return (
    <FieldSet className="rounded-xl border border-border p-4">
      <FieldLegend id="discord-presence-label">Discord Rich Presence</FieldLegend>
      <FieldGroup>
        <Field>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="discord-presence-label"
            aria-describedby="discord-presence-help"
            value={mode}
            onValueChange={selected => {
              const next = presenceModes.find(option => option.value === selected);
              if (next) onChange({ ...value, mode: next.value });
            }}
            className="flex-wrap"
          >
            {presenceModes.map(option => (
              <ToggleGroupItem key={option.value} value={option.value} className="min-h-11">{option.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription id="discord-presence-help">
            {mode === 'default' && 'Affiche le nom de la session et la tête du skin Minecraft dans la présence Launched.'}
            {mode === 'custom' && 'Affiche votre activité sur le profil Discord des joueurs pendant que Minecraft tourne.'}
          </FieldDescription>
        </Field>
        {mode === 'custom' && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="presence-app-id">Identifiant d’application Discord</FieldLabel>
              <Input id="presence-app-id" required inputMode="numeric" pattern="[1-9][0-9]{16,19}" maxLength={20}
                aria-describedby="presence-app-help" value={config.applicationId}
                onChange={event => setConfig({ applicationId: event.target.value.trim() })} />
              <FieldDescription id="presence-app-help">
                Copiez l’identifiant de votre application depuis le{' '}
                <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline underline-offset-4">portail développeur Discord</a>.
              </FieldDescription>
            </Field>
            <PresenceInput id="presence-name" label="Nom affiché" description="Par défaut, Discord utilise le nom de l’application." minLength={2} maxLength={128}
              value={activity.name ?? ''} onChange={event => setActivity({ name: event.target.value })} />
            <FieldSet>
              <FieldLegend id="presence-type" variant="label">Type d’activité</FieldLegend>
              <ToggleGroup type="single" variant="outline" aria-labelledby="presence-type" value={String(activity.type)} className="flex-wrap"
                onValueChange={selected => {
                  const next = activityTypes.find(option => String(option.value) === selected);
                  if (next) setActivity({ type: next.value });
                }}>
                {activityTypes.map(option => (
                  <ToggleGroupItem key={option.value} value={String(option.value)} className="min-h-11">{option.label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <PresenceInput id="presence-details" label="Détails" minLength={2} maxLength={128}
              required={activity.status_display_type === 2 || Boolean(activity.details_url?.trim())}
              value={activity.details ?? ''} onChange={event => setActivity({ details: event.target.value })} />
            <PresenceInput id="presence-state" label="Sous-texte" minLength={2} maxLength={128}
              required={activity.status_display_type === 1 || Boolean(activity.state_url?.trim())}
              value={activity.state ?? ''} onChange={event => setActivity({ state: event.target.value })} />
            <FieldSet>
              <FieldLegend id="presence-status" variant="label">Texte du statut dans la liste des membres</FieldLegend>
              <ToggleGroup type="single" variant="outline" aria-labelledby="presence-status" value={String(activity.status_display_type ?? 0)} className="flex-wrap"
                onValueChange={selected => {
                  const next = statusFields.find(option => String(option.value) === selected);
                  if (next) setActivity({ status_display_type: next.value });
                }}>
                {statusFields.map(option => (
                  <ToggleGroupItem key={option.value} value={String(option.value)} className="min-h-11">{option.label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <Field orientation="horizontal" className="min-h-11">
              <input id="presence-elapsed" type="checkbox" checked={config.showElapsed} className="size-4 accent-primary"
                onChange={event => setConfig({ showElapsed: event.target.checked })} />
              <FieldLabel htmlFor="presence-elapsed">Afficher le temps de jeu écoulé</FieldLabel>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Boutons</FieldLegend>
              <FieldDescription>Jusqu’à deux liens, visibles par les personnes qui consultent le profil du joueur.</FieldDescription>
              {[0, 1].map(index => {
                const buttons = activity.buttons ?? [];
                const button = buttons[index] ?? { label: '', url: '' };
                function setButton(update: Partial<typeof button>) {
                  const next = [0, 1].map(position => position === index ? { ...button, ...update } : buttons[position] ?? { label: '', url: '' });
                  setActivity({ buttons: next });
                }
                return (
                  <FieldGroup key={index} className="grid gap-3 sm:grid-cols-2">
                    <PresenceInput id={`presence-button-${index}-label`} label={`Libellé du bouton ${index + 1}`} maxLength={32}
                      required={Boolean(button.url.trim())} value={button.label} onChange={event => setButton({ label: event.target.value })} />
                    <PresenceInput id={`presence-button-${index}-url`} label={`URL du bouton ${index + 1}`} type="url" maxLength={256}
                      required={Boolean(button.label.trim())} value={button.url} onChange={event => setButton({ url: event.target.value })} />
                  </FieldGroup>
                );
              })}
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Images et liens</FieldLegend>
              <FieldDescription>Utilisez une clé d’image de votre application Discord ou une URL publique.</FieldDescription>
              {(['large', 'small'] as const).map(size => {
                const image = size === 'large' ? 'Grande image' : 'Petite image';
                const imageKey = `${size}_image` as const;
                const textKey = `${size}_text` as const;
                const urlKey = `${size}_url` as const;
                const assets = activity.assets ?? {};
                return (
                  <FieldGroup key={size} className="gap-3">
                    <PresenceInput id={`presence-${imageKey}`} label={image} maxLength={256} value={assets[imageKey] ?? ''}
                      required={Boolean(assets[textKey]?.trim() || assets[urlKey]?.trim())}
                      onChange={event => setActivity({ assets: { ...assets, [imageKey]: event.target.value } })} />
                    <PresenceInput id={`presence-${textKey}`} label={`Infobulle · ${image}`} minLength={2} maxLength={128} value={assets[textKey] ?? ''}
                      onChange={event => setActivity({ assets: { ...assets, [textKey]: event.target.value } })} />
                    <PresenceInput id={`presence-${urlKey}`} label={`Lien · ${image}`} type="url" maxLength={256} value={assets[urlKey] ?? ''}
                      onChange={event => setActivity({ assets: { ...assets, [urlKey]: event.target.value } })} />
                  </FieldGroup>
                );
              })}
              <PresenceInput id="presence-details-url" label="Lien des détails" type="url" maxLength={256}
                value={activity.details_url ?? ''} onChange={event => setActivity({ details_url: event.target.value })} />
              <PresenceInput id="presence-state-url" label="Lien du sous-texte" type="url" maxLength={256}
                value={activity.state_url ?? ''} onChange={event => setActivity({ state_url: event.target.value })} />
            </FieldSet>
          </FieldGroup>
        )}
      </FieldGroup>
    </FieldSet>
  );
}
