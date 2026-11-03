'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { LoaderCircle, Plus, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput,
  ComboboxContent, ComboboxGroup, ComboboxItem, ComboboxList,
  ComboboxValue, useComboboxAnchor,
} from '@/components/ui/combobox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';

interface DiscordUser {
  discordId: string;
  username: string;
  avatar: string | null;
}

export interface DiscordAccessUser {
  identifier: string;
  discordId: string | null;
  username: string | null;
  avatar: string | null;
}

interface SearchResult {
  users: DiscordUser[];
  hasMore: boolean;
}

interface Props {
  value: DiscordAccessUser[];
  onChange: (users: DiscordAccessUser[]) => void;
  searchUsers: (query: string, signal: AbortSignal) => Promise<SearchResult>;
}

const label = (user: DiscordAccessUser) => user.username ?? user.identifier;
const sameUser = (a: DiscordAccessUser, b: DiscordAccessUser) =>
  a.identifier === b.identifier || Boolean(a.discordId && a.discordId === b.discordId);

function UserAvatar({ user }: { user: DiscordAccessUser }) {
  return (
    <Avatar size="sm">
      {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
      <AvatarFallback>{user.username ? user.username.slice(0, 2).toUpperCase() : <UserRound />}</AvatarFallback>
    </Avatar>
  );
}

export function DiscordUserSelect({ value, onChange, searchUsers }: Props) {
  const anchor = useComboboxAnchor();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<SearchResult & { query: string; error?: string }>({ query: '', users: [], hasMore: false });
  const query = input.trim().replace(/^@/, '');
  const canSearch = query.length >= 3;
  const loading = canSearch && result.query !== query;
  const current = result.query === query ? result : null;
  const search = useEffectEvent(searchUsers);

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await search(query, controller.signal);
        if (!controller.signal.aborted) setResult({ ...response, query });
      } catch {
        if (!controller.signal.aborted) setResult({ query, users: [], hasMore: false, error: 'Recherche indisponible. Réessayez ou ajoutez un ID Discord.' });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, canSearch]);

  const items: DiscordAccessUser[] = (canSearch ? current?.users ?? [] : []).map(user => ({ ...user, identifier: user.discordId }));
  const isDiscordId = /^\d{17,20}$/.test(query);
  const manualId = isDiscordId && !loading && !items.some(user => user.discordId === query)
    ? { identifier: query, discordId: query, username: null, avatar: null } : null;
  if (manualId) items.push(manualId);

  let status = 'Tapez au moins 3 caractères pour rechercher un compte.';
  if (loading) status = 'Recherche des comptes…';
  else if (canSearch && current?.error) status = current.error;
  else if (canSearch && !items.length) status = 'Aucun compte trouvé. Vous pouvez ajouter son ID Discord.';

  return (
    <Field>
      <FieldLabel htmlFor="session-discord-users">Comptes Discord autorisés</FieldLabel>
      <Combobox
        multiple
        items={items}
        filter={null}
        value={value}
        inputValue={input}
        onInputValueChange={setInput}
        isItemEqualToValue={sameUser}
        itemToStringLabel={label}
        itemToStringValue={user => user.identifier}
        onValueChange={users => {
          if (users.length <= 500) onChange(users);
          setInput('');
        }}
      >
        <ComboboxChips
          ref={anchor}
          className="scrollbar-subtle max-h-52 min-h-12 gap-1.5 overflow-y-auto p-2"
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
        >
          <ComboboxValue>
            {value.map(user => (
              <ComboboxChip key={user.identifier} removeLabel={`Retirer ${label(user)}`} className="h-auto min-h-8 max-w-full gap-1.5 py-1">
                <UserAvatar user={user} />
                <span className="max-w-48 truncate" title={label(user)}>{label(user)}</span>
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            id="session-discord-users"
            aria-label="Comptes Discord autorisés"
            placeholder="Pseudo ou ID Discord…"
            aria-describedby="session-discord-help"
            aria-busy={loading}
            maxLength={100}
            className="min-h-8 min-w-36"
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {!canSearch || loading || !items.length || current?.error ? (
            <p role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
              {status}
            </p>
          ) : null}
          <ComboboxList>
            <ComboboxGroup>
              {items.map(user => (
                <ComboboxItem key={user.identifier} value={user} disabled={value.length >= 500 && !value.some(selected => sameUser(user, selected))} className="min-h-12 px-3 py-2">
                  {user.username ? <UserAvatar user={user} /> : <Plus aria-hidden="true" />}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate">{user.username ?? `Ajouter l’ID ${user.identifier}`}</span>
                    <span className="text-xs text-muted-foreground">{user.username ? user.discordId : 'Ce joueur pourra se connecter plus tard.'}</span>
                  </span>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
          {current?.hasMore && !loading ? <p className="px-3 py-2 text-xs text-muted-foreground">Affinez votre recherche pour voir les autres comptes.</p> : null}
        </ComboboxContent>
      </Combobox>
      <FieldDescription id="session-discord-help">
        Recherchez un compte avec au moins 3 caractères, ou collez un ID Discord, même avant sa première connexion.
        {value.length ? ` ${value.length}/500 comptes sélectionnés.` : ''}
      </FieldDescription>
    </Field>
  );
}
