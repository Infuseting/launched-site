import React from 'react';
import { Globe, LockKeyhole } from 'lucide-react';
import { DiscordUserSelect } from '@/components/discord-user-select';
import { SessionDiscordPresence } from '@/components/session-discord-presence';
import { Field, FieldGroup, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DashboardFormData, SessionData } from '@/types/dashboard';

interface CreateOrEditSessionModalProps {
  isOpen: boolean;
  editSession: SessionData | null;
  formData: DashboardFormData;
  setFormData: React.Dispatch<React.SetStateAction<DashboardFormData>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
  searchUsers: (query: string, signal: AbortSignal) => Promise<any>;
}

export const CreateOrEditSessionModal: React.FC<CreateOrEditSessionModalProps> = ({
  isOpen,
  editSession,
  formData,
  setFormData,
  onSubmit,
  onClose,
  searchUsers,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
        className="flex h-[min(54rem,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-clip rounded-xl border border-white/10 bg-zinc-950"
      >
        <h2
          id="session-dialog-title"
          className="shrink-0 border-b border-white/10 px-6 py-4 text-base font-bold text-white"
        >
          {editSession ? `Modifier : ${editSession.name}` : 'Nouvelle session'}
        </h2>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-clip">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex min-w-0 flex-col gap-4 px-6 py-5 text-xs">
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Nom de la session</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Survie Moddée"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Version Minecraft</label>
                  <input
                    type="text"
                    required
                    placeholder="1.20.1"
                    value={formData.minecraft}
                    onChange={(e) => setFormData({ ...formData, minecraft: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Modloader</label>
                  <select
                    value={formData.loaderType}
                    onChange={(e) =>
                      setFormData({ ...formData, loaderType: e.target.value, loaderVersion: '' })
                    }
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="vanilla">Vanilla (aucun)</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                  </select>
                </div>
              </div>

              {formData.loaderType !== 'vanilla' && (
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Version du Loader</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0.16.9"
                    value={formData.loaderVersion}
                    onChange={(e) => setFormData({ ...formData, loaderVersion: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Dossiers de synchronisation
                </label>
                <input
                  type="text"
                  value={formData.syncDir}
                  onChange={(e) => setFormData({ ...formData, syncDir: e.target.value })}
                  placeholder="mods,resourcepacks,shaderpacks"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Allocation RAM</label>
                  <input
                    type="text"
                    value={formData.jvmArg}
                    onChange={(e) => setFormData({ ...formData, jvmArg: e.target.value })}
                    placeholder="-Xmx4G"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-400 mb-1">
                    IP du serveur (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="play.exemple.fr"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">
                  Message d'accueil (optionnel)
                </label>
                <input
                  type="text"
                  value={formData.welcome}
                  onChange={(e) => setFormData({ ...formData, welcome: e.target.value })}
                  placeholder="Message affiché au lancement..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="crackCheckbox"
                  checked={formData.crack}
                  onChange={(e) => setFormData({ ...formData, crack: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                />
                <label htmlFor="crackCheckbox" className="text-zinc-300 font-medium cursor-pointer">
                  Autoriser les comptes non officiels (Crack / Offline)
                </label>
              </div>

              {/* Links configuration (limited to 3) */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-zinc-400">Liens de redirection (max 3)</label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {formData.links.length}/3
                  </span>
                </div>

                <div className="space-y-2">
                  {formData.links.map((link, idx) => {
                    const isDiscord =
                      link.url.toLowerCase().includes('discord') ||
                      link.name.toLowerCase().includes('discord');
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-white/[0.02] border border-white/5 p-2 rounded-lg"
                      >
                        <input
                          type="text"
                          placeholder="Nom (ex: Discord)"
                          value={link.name}
                          onChange={(e) => {
                            const updated = [...formData.links];
                            updated[idx].name = e.target.value;
                            setFormData({ ...formData, links: updated });
                          }}
                          className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="url"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...formData.links];
                            updated[idx].url = e.target.value;
                            setFormData({ ...formData, links: updated });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="px-2 text-zinc-400">
                          {isDiscord ? (
                            <span className="text-[#5865F2] text-[10px] font-medium">Discord</span>
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.links.filter((_, i) => i !== idx);
                            setFormData({ ...formData, links: updated });
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {formData.links.length < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.links.length < 3) {
                        setFormData({
                          ...formData,
                          links: [...formData.links, { name: '', url: '', icon: '' }],
                        });
                      }
                    }}
                    className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-lg text-xs font-medium text-zinc-400 transition cursor-pointer"
                  >
                    + Ajouter un lien
                  </button>
                )}
              </div>

              <SessionDiscordPresence
                value={formData.discordPresence}
                onChange={(discordPresence) =>
                  setFormData((previous) => ({ ...previous, discordPresence }))
                }
              />

              <FieldSet className="rounded-xl border border-border p-4">
                <FieldLegend>Accès des joueurs</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldTitle id="session-access-label">
                      Qui peut rejoindre cette session ?
                    </FieldTitle>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      orientation="vertical"
                      aria-labelledby="session-access-label"
                      value={formData.publicAccess ? 'public' : 'private'}
                      onValueChange={(value) => {
                        if (value)
                          setFormData((previous) => ({
                            ...previous,
                            publicAccess: value === 'public',
                          }));
                      }}
                      className="w-full"
                    >
                      <ToggleGroupItem
                        value="public"
                        className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-3 py-3"
                      >
                        <Globe data-icon="inline-start" />
                        Accessible à tout le monde
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="private"
                        className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-3 py-3"
                      >
                        <LockKeyhole data-icon="inline-start" />
                        Uniquement les comptes Discord autorisés
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                  {!formData.publicAccess ? (
                    <DiscordUserSelect
                      value={formData.allowedDiscordUsers}
                      onChange={(users) =>
                        setFormData((previous) => ({
                          ...previous,
                          allowedDiscordUsers: users,
                        }))
                      }
                      searchUsers={searchUsers}
                    />
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </div>
          </ScrollArea>

          <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-6 py-4 text-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg cursor-pointer"
            >
              {editSession ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrEditSessionModal;
