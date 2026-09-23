'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Server, HardDrive, Key, Copy, Check, RefreshCw, Plus, 
  Users, Edit3, Trash2, ArrowRightLeft, Shield, AlertCircle, LogOut,
  Globe
} from 'lucide-react';

interface LinkItem {
  name: string;
  url: string;
  icon: string;
}

interface MemberInfo {
  role: 'OWNER' | 'COLLABORATOR';
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

interface SessionData {
  id: string;
  slug: string;
  name: string;
  minecraft: string;
  forge?: string | null;
  fabric?: string | null;
  neoforge?: string | null;
  quilt?: string | null;
  syncDir: string;
  welcome: string;
  jvmArg: string;
  credits: string;
  hostname?: string | null;
  crack: boolean;
  myRole: 'OWNER' | 'COLLABORATOR';
  links: LinkItem[];
  members: MemberInfo[];
}

interface DashboardUser {
  id: string;
  username: string;
  avatar: string | null;
  role: string;
  sessionLimit: number;
  ownedSessionsCount: number;
  diskQuotaBytes: number;
  sftp: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<{ user: DashboardUser; sessions: SessionData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SFTP state
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regeneratingPassword, setRegeneratingPassword] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [collaboratorSession, setCollaboratorSession] = useState<SessionData | null>(null);

  // Form states
  const [formData, setFormData] = useState({
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
        headers: { 'Accept': 'application/json' },
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
    fetchDashboardData();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAllSftp = () => {
    if (!data) return;
    const { sftp } = data.user;
    const fullText = `Hôte: ${sftp.host}\nPort: ${sftp.port}\nUtilisateur: ${sftp.username}\nMot de passe: ${sftp.password}`;
    copyToClipboard(fullText, 'all');
  };

  const handleRegeneratePassword = async () => {
    if (!confirm('Régénérer votre mot de passe SFTP ?')) return;
    setRegeneratingPassword(true);
    try {
      const res = await authFetch('/api/dashboard/password', { method: 'POST' });
      const json = await res.json();
      if (json.success && data) {
        setData({
          ...data,
          user: {
            ...data.user,
            sftp: { ...data.user.sftp, password: json.sftpPassword },
          },
        });
      }
    } finally {
      setRegeneratingPassword(false);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      minecraft: formData.minecraft,
      forge: formData.loaderType === 'forge' ? formData.loaderVersion : undefined,
      fabric: formData.loaderType === 'fabric' ? formData.loaderVersion : undefined,
      neoforge: formData.loaderType === 'neoforge' ? formData.loaderVersion : undefined,
      quilt: formData.loaderType === 'quilt' ? formData.loaderVersion : undefined,
      syncDir: formData.syncDir,
      welcome: formData.welcome,
      jvmArg: formData.jvmArg,
      credits: formData.credits,
      hostname: formData.hostname || undefined,
      crack: formData.crack,
      links: formData.links.filter((l) => l.name && l.url),
    };

    if (editSession) {
      const res = await authFetch(`/api/dashboard/sessions/${editSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditSession(null);
        fetchDashboardData();
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
        setCreateModalOpen(false);
        fetchDashboardData();
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

    const res = await authFetch(`/api/dashboard/sessions/${collaboratorSession.id}/collaborators?userId=${userId}`, {
      method: 'DELETE',
    });
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
    if (s.fabric) { loader = 'fabric'; version = s.fabric; }
    else if (s.forge) { loader = 'forge'; version = s.forge; }
    else if (s.neoforge) { loader = 'neoforge'; version = s.neoforge; }
    else if (s.quilt) { loader = 'quilt'; version = s.quilt; }

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
      links: [{ name: 'Discord', url: '', icon: '' }],
    });
    setCreateModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>Chargement de votre espace...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-zinc-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Authentification requise</h1>
        <p className="text-zinc-500 text-sm mb-6 max-w-sm">Connectez-vous avec votre compte Discord pour accéder à votre espace créateur.</p>
        <a 
          href="/api/auth/discord/login" 
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
        >
          Se connecter avec Discord
        </a>
      </div>
    );
  }

  const { user, sessions } = data;
  const canCreateSession = user.ownedSessionsCount < user.sessionLimit;
  const quotaGb = (user.diskQuotaBytes / (1024 ** 3)).toFixed(0);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-black tracking-tighter text-xl text-white hover:text-blue-500 transition-colors">
            LAUNCHED<span className="text-blue-600">.</span>
          </Link>
          <span className="text-zinc-600 font-mono">/</span>
          <span className="text-xs text-zinc-400 font-medium">Espace Créateur</span>
        </div>

        <div className="flex items-center gap-5">
          {user.role === 'ADMIN' && (
            <Link 
              href="/admin" 
              className="text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Administration</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-7 h-7 rounded-full border border-white/10" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10" />
            )}
            <span className="text-xs font-medium text-zinc-300">{user.username}</span>
          </div>

          <a
            href="/api/auth/logout"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("launched_token");
              }
            }}
            title="Déconnexion"
            className="text-zinc-500 hover:text-white transition p-1"
          >
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Header toolbar & quotas */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vos Sessions</h1>
            <div className="flex items-center gap-6 mt-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Sessions :</span>
                <span className="font-semibold text-white">{user.ownedSessionsCount} / {user.sessionLimit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Stockage :</span>
                <span className="font-semibold text-white">{quotaGb} Go alloués</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={openCreate}
              disabled={!canCreateSession}
              className={`px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                canCreateSession
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  : 'bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle session</span>
            </button>
          </div>
        </section>

        {user.sessionLimit === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300">
            Votre compte n'a pas encore de quota de sessions. Contactez un administrateur pour l'activer.
          </div>
        )}

        {/* SFTP Credentials Bar */}
        {user.sftp.username && (
          <section className="bg-zinc-950 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Identifiants SFTP</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAllSftp}
                  className="text-xs bg-white/5 hover:bg-white/10 text-zinc-300 px-3 py-1.5 rounded-md border border-white/5 flex items-center gap-1.5 transition"
                >
                  {copiedKey === 'all' ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copier tout</span>
                </button>
                <button
                  onClick={handleRegeneratePassword}
                  disabled={regeneratingPassword}
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 transition flex items-center gap-1.5"
                  title="Générer un nouveau mot de passe"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPassword ? 'animate-spin' : ''}`} />
                  <span>Régénérer mot de passe</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">Hôte</div>
                <div className="text-white mt-1 select-all">{user.sftp.host}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">Port</div>
                <div className="text-white mt-1 select-all">{user.sftp.port}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">Utilisateur</div>
                <div className="text-white mt-1 select-all">{user.sftp.username}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-medium">Mot de passe</div>
                  <div className="text-white mt-1 select-all">
                    {showPassword ? user.sftp.password : '••••••••'}
                  </div>
                </div>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-zinc-400 hover:text-white font-sans"
                >
                  {showPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono">
              Structure dans votre client SFTP : <span className="text-zinc-400">/&lt;nom-session&gt;/sync/</span> pour les fichiers de jeu, <span className="text-zinc-400">/&lt;nom-session&gt;/assets/</span> pour les visuels.
            </div>
          </section>
        )}

        {/* Sessions Grid */}
        <section className="space-y-4">
          {sessions.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-12 text-center">
              <Server className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-300">Aucune session configurée</p>
              <p className="text-xs text-zinc-500 mt-1">Créez votre première session pour commencer à synchroniser vos fichiers.</p>
              {canCreateSession && (
                <button
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Créer une session
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => {
                const isOwner = s.myRole === 'OWNER';
                const loader = s.fabric 
                  ? `Fabric ${s.fabric}` 
                  : s.forge 
                  ? `Forge ${s.forge}` 
                  : s.neoforge 
                  ? `NeoForge ${s.neoforge}` 
                  : s.quilt 
                  ? `Quilt ${s.quilt}` 
                  : 'Vanilla';

                return (
                  <div 
                    key={s.id} 
                    className="bg-zinc-950 border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-white/20 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{s.name}</h3>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              isOwner 
                                ? 'bg-white/5 text-zinc-300 border-white/10' 
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {isOwner ? 'Propriétaire' : 'Collaborateur'}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 font-mono mt-1">
                            SFTP : /{s.slug}/
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(s)}
                            title="Modifier"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {isOwner && (
                            <>
                              <button
                                onClick={() => setCollaboratorSession(s)}
                                title="Collaborateurs"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition relative"
                              >
                                <Users className="w-4 h-4" />
                                {s.members.length > 1 && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] font-bold flex items-center justify-center text-white">
                                    {s.members.length}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteSession(s)}
                                title="Supprimer"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
                        <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded">
                          {s.minecraft} · {loader}
                        </span>
                        {s.crack && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Offline / Crack
                          </span>
                        )}
                        {s.hostname && (
                          <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded">
                            {s.hostname}
                          </span>
                        )}
                      </div>

                      {s.welcome && (
                        <p className="text-xs text-zinc-400 mt-3 line-clamp-1 italic">
                          "{s.welcome}"
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span>Sync : {s.syncDir}</span>
                      <span>RAM : {s.jvmArg}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal Create / Edit Session */}
      {(createModalOpen || editSession) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-white/10 rounded-xl max-w-lg w-full p-6 space-y-5 my-8">
            <h2 className="text-base font-bold text-white">
              {editSession ? `Modifier : ${editSession.name}` : 'Nouvelle session'}
            </h2>

            <form onSubmit={handleSaveSession} className="space-y-4 text-xs">
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
                    onChange={(e) => setFormData({ ...formData, loaderType: e.target.value })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="vanilla">Vanilla (aucun)</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                    <option value="quilt">Quilt</option>
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
                <label className="block font-medium text-zinc-400 mb-1">Dossiers de synchronisation</label>
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
                  <label className="block font-medium text-zinc-400 mb-1">IP du serveur (optionnel)</label>
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
                <label className="block font-medium text-zinc-400 mb-1">Message d'accueil (optionnel)</label>
                <input
                  type="text"
                  value={formData.welcome}
                  onChange={(e) => setFormData({ ...formData, welcome: e.target.value })}
                  placeholder="Message affiché au lancement..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="crackCheckbox"
                  checked={formData.crack}
                  onChange={(e) => setFormData({ ...formData, crack: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                />
                <label htmlFor="crackCheckbox" className="text-zinc-300 font-medium">
                  Autoriser les comptes non officiels (Crack / Offline)
                </label>
              </div>

              {/* Links configuration (limited to 3) */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-zinc-400">
                    Liens de redirection (max 3)
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {formData.links.length}/3
                  </span>
                </div>

                <div className="space-y-2">
                  {formData.links.map((link, idx) => {
                    const isDiscord = link.url.toLowerCase().includes('discord') || link.name.toLowerCase().includes('discord');
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 p-2 rounded-lg">
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
                          className="text-zinc-500 hover:text-red-400 p-1"
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
                    className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-lg text-xs font-medium text-zinc-400 transition"
                  >
                    + Ajouter un lien
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setCreateModalOpen(false); setEditSession(null); }}
                  className="px-4 py-2 text-zinc-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
                >
                  {editSession ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Collaborators & Transfer */}
      {collaboratorSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl max-w-md w-full p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white">Collaborateurs : {collaboratorSession.name}</h2>
              <button
                onClick={() => setCollaboratorSession(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCollaborator} className="space-y-2">
              <label className="block text-zinc-400 font-medium">
                Inviter un membre (pseudo Discord)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pseudo Discord..."
                  value={collabUsername}
                  onChange={(e) => setCollabUsername(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
                >
                  Ajouter
                </button>
              </div>
              {collabError && <p className="text-red-400">{collabError}</p>}
            </form>

            <div className="space-y-2">
              <label className="block text-zinc-400 font-medium">
                Membres ({collaboratorSession.members.length})
              </label>
              <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden bg-white/[0.02]">
                {collaboratorSession.members.map((m) => (
                  <div key={m.user.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {m.user.avatar && <img src={m.user.avatar} alt="" className="w-6 h-6 rounded-full" />}
                      <div>
                        <div className="font-semibold text-white">{m.user.username}</div>
                        <div className="text-[10px] text-zinc-500">
                          {m.role === 'OWNER' ? 'Propriétaire' : 'Collaborateur (accès SFTP)'}
                        </div>
                      </div>
                    </div>

                    {m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveCollaborator(m.user.id)}
                        className="text-[11px] text-zinc-500 hover:text-red-400"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Transfer of Ownership */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transférer la possession</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                La session sera décomptée du quota du destinataire. Vous deviendrez collaborateur.
              </p>
              <div className="flex gap-2">
                <select
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="">Choisir un collaborateur...</option>
                  {collaboratorSession.members
                    .filter((m) => m.role !== 'OWNER')
                    .map((m) => (
                      <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={!transferUserId}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Transférer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
