import { authFetch, consumeTokenFromUrl, errorMessage } from '@/lib/browser-auth';
import { useState, useEffect, useCallback, useRef } from 'react';
import { presenceFormValue } from '@/components/session-discord-presence';
import type { SessionPresence } from '@/lib/discord-presence';
import type { DashboardFormData, DashboardUser, SessionData } from '@/types/dashboard';

export function useDashboardData() {
  const [data, setData] = useState<{ user: DashboardUser; sessions: SessionData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // SFTP state
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newSftpPassword, setNewSftpPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccessToast, setPasswordSuccessToast] = useState<string | null>(null);

  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const saveInFlight = useRef(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [collaboratorSession, setCollaboratorSession] = useState<SessionData | null>(null);
  // Form states
  const [formData, setFormData] = useState<DashboardFormData>({
    name: '',
    minecraft: '1.20.1',
    loaderType: 'fabric',
    loaderVersion: '0.16.9',
    syncDir: 'mods,resourcepacks,shaderpacks',
    welcome: '',
    jvmArg: '-Xmx4G',
    credits: '',
    hostname: '',
    crack: false,
    publicAccess: true,
    discordPresence: presenceFormValue(),
    allowedDiscordUsers: [],
    links: [{ name: 'Discord', url: '', icon: '' }],
  });

  const [collabUsername, setCollabUsername] = useState('');
  const [collabError, setCollabError] = useState<string | null>(null);
  const [transferUserId, setTransferUserId] = useState('');

  const fetchDashboardData = useCallback(
    (signal?: AbortSignal) =>
      authFetch('/api/dashboard/me', { headers: { Accept: 'application/json' }, signal })
        .then(async (response) => {
          if (signal?.aborted) return;
          setError(null);
          setAuthError(new URLSearchParams(window.location.search).get('error'));
          if (response.status === 401) {
            setData(null);
            return;
          }
          if (!response.ok) throw new Error('Erreur lors du chargement');
          const json = await response.json();
          if (!signal?.aborted) setData(json);
        })
        .catch((error: unknown) => {
          if (!signal?.aborted)
            setError(errorMessage(error, 'Impossible de charger le tableau de bord'));
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [],
  );

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    consumeTokenFromUrl();
    const controller = new AbortController();
    void fetchDashboardData(controller.signal);
    return () => {
      controller.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [fetchDashboardData]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      alert('La copie est indisponible. Vous pouvez sélectionner et copier le texte manuellement.');
    }
  };

  const handleCopyAllSftp = () => {
    if (!data?.user.sftp) return;
    const { sftp } = data.user;
    const fullText = `Hôte: ${sftp.host}\nPort: ${sftp.port}\nUtilisateur: ${sftp.username}\nMot de passe: ${sftp.password}`;
    copyToClipboard(fullText, 'all');
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let result = '';
    const randomValues = new Uint32Array(16);
    if (window.crypto) {
      window.crypto.getRandomValues(randomValues);
      for (let i = 0; i < 16; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      setPasswordError(
        'La génération sécurisée est indisponible. Saisissez un mot de passe ou demandez une génération au serveur.',
      );
      return;
    }
    setNewSftpPassword(result);
  };

  const handleUpdatePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const payload: { password?: string } = {};
      if (newSftpPassword.trim()) {
        if (newSftpPassword.trim().length < 6) {
          setPasswordError('Le mot de passe doit comporter au moins 6 caractères');
          setPasswordLoading(false);
          return;
        }
        payload.password = newSftpPassword.trim();
      }

      const res = await authFetch('/api/dashboard/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors de la mise à jour du mot de passe');
      }

      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          user: {
            ...prev.user,
            sftp: prev.user.sftp
              ? { ...prev.user.sftp, password: json.password || json.sftpPassword }
              : null,
          },
        };
      });

      setShowPassword(true);
      let copied = false;
      try {
        await navigator.clipboard.writeText(json.password || json.sftpPassword);
        copied = true;
      } catch {
        // Saving succeeded even when clipboard access is denied.
      }
      setPasswordModalOpen(false);
      setNewSftpPassword('');
      setPasswordSuccessToast(
        copied
          ? 'Mot de passe SFTP mis à jour et copié dans le presse-papier !'
          : 'Mot de passe SFTP mis à jour. La copie est indisponible.',
      );
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setPasswordSuccessToast(null), 5000);
    } catch (err) {
      setPasswordError(errorMessage(err, 'Impossible de mettre à jour le mot de passe'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const mutate = async (
    url: string,
    options: RequestInit,
    onSuccess: () => void,
    onError: (message: string) => void = alert,
  ) => {
    try {
      const response = await authFetch(url, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Impossible de terminer cette opération');
      await fetchDashboardData();
      onSuccess();
    } catch (error) {
      onError(errorMessage(error, 'Le serveur est indisponible. Réessayez.'));
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSessionSaving(true);
    setSessionError(null);
    const { mode, config } = formData.discordPresence;
    const discordPresence: SessionPresence | null = mode === 'custom' ? { mode, config } : null;
    const payload = {
      name: formData.name,
      minecraft: formData.minecraft,
      forge: formData.loaderType === 'forge' ? formData.loaderVersion : null,
      fabric: formData.loaderType === 'fabric' ? formData.loaderVersion : null,
      neoforge: formData.loaderType === 'neoforge' ? formData.loaderVersion : null,
      syncDir: formData.syncDir,
      welcome: formData.welcome,
      jvmArg: formData.jvmArg,
      credits: formData.credits,
      hostname: formData.hostname || undefined,
      crack: formData.crack,
      publicAccess: formData.publicAccess,
      discordPresence,
      allowedDiscordUsers: formData.allowedDiscordUsers.map((u) => u.identifier),
      links: formData.links.filter((l) => l.name && l.url),
    };

    await mutate(
      editSession ? `/api/dashboard/sessions/${editSession.id}` : '/api/dashboard/sessions',
      {
        method: editSession ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      () => {
        setEditSession(null);
        setCreateModalOpen(false);
      },
      setSessionError,
    );
    saveInFlight.current = false;
    setSessionSaving(false);
  };

  const handleDeleteSession = async (session: SessionData) => {
    if (!confirm(`Supprimer la session "${session.name}" et ses fichiers ?`)) return;
    await mutate(`/api/dashboard/sessions/${session.id}`, { method: 'DELETE' }, () => {});
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorSession || !collabUsername.trim()) return;
    setCollabError(null);
    await mutate(
      `/api/dashboard/sessions/${collaboratorSession.id}/collaborators`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: collabUsername }),
      },
      () => setCollabUsername(''),
      setCollabError,
    );
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!collaboratorSession || !confirm('Retirer ce collaborateur ?')) return;
    await mutate(
      `/api/dashboard/sessions/${collaboratorSession.id}/collaborators?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      () => {},
      setCollabError,
    );
  };

  const handleTransferOwnership = async () => {
    if (!collaboratorSession || !transferUserId) return;
    if (!confirm('Transférer la possession de cette session ? Vous deviendrez collaborateur.'))
      return;
    await mutate(
      `/api/dashboard/sessions/${collaboratorSession.id}/transfer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId: transferUserId }),
      },
      () => setCollaboratorSession(null),
      setCollabError,
    );
  };

  const openEdit = (s: SessionData) => {
    setSessionError(null);
    let loader = 'vanilla';
    let version = '';
    if (s.fabric) {
      loader = 'fabric';
      version = s.fabric;
    } else if (s.forge) {
      loader = 'forge';
      version = s.forge;
    } else if (s.neoforge) {
      loader = 'neoforge';
      version = s.neoforge;
    }

    setFormData({
      name: s.name,
      minecraft: s.minecraft,
      loaderType: loader,
      loaderVersion: version,
      syncDir: s.syncDir,
      welcome: s.welcome,
      jvmArg: s.jvmArg,
      credits: s.credits,
      hostname: s.hostname || '',
      crack: s.crack,
      publicAccess: s.publicAccess ?? true,
      discordPresence: presenceFormValue(s.discordPresence),
      allowedDiscordUsers: (s.access ?? []).map((entry) => ({
        identifier: entry.identifier,
        discordId: entry.discordId,
        username:
          entry.user?.username ?? (/^\d{17,20}$/.test(entry.identifier) ? null : entry.identifier),
        avatar: entry.user?.avatar ?? null,
      })),
      links: s.links.length > 0 ? s.links : [{ name: 'Discord', url: '', icon: '' }],
    });
    setEditSession(s);
  };

  const openCreate = () => {
    setSessionError(null);
    if (!data) return;
    setFormData({
      name: '',
      minecraft: '1.20.1',
      loaderType: 'fabric',
      loaderVersion: '0.16.9',
      syncDir: 'mods,resourcepacks,shaderpacks',
      welcome: '',
      jvmArg: '-Xmx4G',
      credits: `Created by ${data.user.username}`,
      hostname: '',
      crack: false,
      publicAccess: true,
      discordPresence: presenceFormValue(),
      allowedDiscordUsers: [],
      links: [{ name: 'Discord', url: '', icon: '' }],
    });
    setCreateModalOpen(true);
  };

  return {
    data,
    loading,
    error,
    authError,
    showPassword,
    setShowPassword,
    copiedKey,
    copyToClipboard,
    handleCopyAllSftp,
    passwordModalOpen,
    setPasswordModalOpen,
    newSftpPassword,
    setNewSftpPassword,
    passwordLoading,
    passwordError,
    passwordSuccessToast,
    dismissPasswordToast: () => setPasswordSuccessToast(null),
    generateRandomPassword,
    handleUpdatePassword,
    createModalOpen,
    setCreateModalOpen,
    editSession,
    setEditSession,
    collaboratorSession:
      data?.sessions.find((session) => session.id === collaboratorSession?.id) ?? null,
    setCollaboratorSession,
    formData,
    setFormData,
    sessionSaving,
    sessionError,
    collabUsername,
    setCollabUsername,
    collabError,
    transferUserId,
    setTransferUserId,
    handleSaveSession,
    handleDeleteSession,
    handleAddCollaborator,
    handleRemoveCollaborator,
    handleTransferOwnership,
    openEdit,
    openCreate,
  };
}
