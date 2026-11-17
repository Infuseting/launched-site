import { useState, useEffect } from 'react';
import { presenceFormValue } from '@/components/session-discord-presence';
import type { SessionPresence } from '@/lib/discord-presence';
import type {
  DashboardFormData,
  DashboardUser,
  SessionData,
} from '@/types/dashboard';

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

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [collaboratorSession, setCollaboratorSession] = useState<SessionData | null>(null);
  const sessionModalOpen = createModalOpen || Boolean(editSession);

  useEffect(() => {
    if (!sessionModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sessionModalOpen]);

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

  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      try {
        localStorage.setItem('launched_token', tokenFromUrl);
        document.cookie = `launched_session=${tokenFromUrl}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax`;
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      } catch (e) {
        console.error('Error storing token:', e);
      }
      return tokenFromUrl;
    }
    return localStorage.getItem('launched_token');
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = getStoredToken();
    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('launched_token');
    }
    return res;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/dashboard/me', {
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        setData(null);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlErr = urlParams.get('error');
      if (urlErr) {
        setAuthError(urlErr);
      }
    }
    fetchDashboardData();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomValues);
      for (let i = 0; i < 16; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      result = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
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
            sftp: prev.user.sftp ? { ...prev.user.sftp, password: json.password || json.sftpPassword } : null,
          },
        };
      });

      setShowPassword(true);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(json.password || json.sftpPassword).catch(() => {});
      }
      setPasswordModalOpen(false);
      setNewSftpPassword('');
      setPasswordSuccessToast('Mot de passe SFTP mis à jour et copié dans le presse-papier !');
      setTimeout(() => setPasswordSuccessToast(null), 5000);
    } catch (err: any) {
      setPasswordError(err.message || 'Impossible de mettre à jour le mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (editSession) {
      const res = await authFetch(`/api/dashboard/sessions/${editSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboardData();
        setEditSession(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la mise à jour');
      }
    } else {
      const res = await authFetch('/api/dashboard/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboardData();
        setCreateModalOpen(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la création');
      }
    }
  };

  const handleDeleteSession = async (session: SessionData) => {
    if (!confirm(`Supprimer la session "${session.name}" et ses fichiers ?`)) return;
    const res = await authFetch(`/api/dashboard/sessions/${session.id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchDashboardData();
    } else {
      const err = await res.json();
      alert(err.error || 'Erreur lors de la suppression');
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorSession || !collabUsername.trim()) return;
    setCollabError(null);

    const res = await authFetch(`/api/dashboard/sessions/${collaboratorSession.id}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: collabUsername }),
    });

    const json = await res.json();
    if (res.ok) {
      setCollabUsername('');
      fetchDashboardData();
    } else {
      setCollabError(json.error || 'Erreur');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!collaboratorSession) return;
    if (!confirm('Retirer ce collaborateur ?')) return;

    const res = await authFetch(
      `/api/dashboard/sessions/${collaboratorSession.id}/collaborators?userId=${userId}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      fetchDashboardData();
    }
  };

  const handleTransferOwnership = async () => {
    if (!collaboratorSession || !transferUserId) return;
    if (!confirm('Transférer la possession de cette session ? Vous deviendrez collaborateur.')) return;

    const res = await authFetch(`/api/dashboard/sessions/${collaboratorSession.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId: transferUserId }),
    });

    const json = await res.json();
    if (res.ok) {
      setCollaboratorSession(null);
      fetchDashboardData();
    } else {
      alert(json.error || 'Erreur de transfert');
    }
  };

  const openEdit = (s: SessionData) => {
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
        username: entry.user?.username ?? (/^\d{17,20}$/.test(entry.identifier) ? null : entry.identifier),
        avatar: entry.user?.avatar ?? null,
      })),
      links: s.links.length > 0 ? s.links : [{ name: 'Discord', url: '', icon: '' }],
    });
    setEditSession(s);
  };

  const openCreate = () => {
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
    generateRandomPassword,
    handleUpdatePassword,
    createModalOpen,
    setCreateModalOpen,
    editSession,
    setEditSession,
    collaboratorSession,
    setCollaboratorSession,
    formData,
    setFormData,
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
