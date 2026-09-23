'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Server, HardDrive, Key, Copy, Check, RefreshCw, Plus, 
  Users, Edit3, Trash2, ArrowRightLeft, Shield, AlertCircle, ExternalLink, LogOut
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

  // SFTP Password visibility
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
    loaderType: 'fabric', // 'vanilla', 'fabric', 'forge', 'neoforge', 'quilt'
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
      setError(err.message || 'Impossible de charger le dashboard');
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
    if (!confirm(`Supprimer définitivement la session "${session.name}" et ses fichiers ?`)) return;
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
    if (!confirm('Transférer la possession de cette session ? Vous deviendrez collaborateur et la session sera décomptée de son quota.')) return;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Chargement de votre espace créateur...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erreur</h1>
        <p className="text-zinc-400 mb-6">{error || 'Connexion requise'}</p>
        <a href="/api/auth/discord/login" className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] font-bold rounded-xl transition">
          Se connecter avec Discord
        </a>
      </div>
    );
  }

  const { user, sessions } = data;
  const canCreateSession = user.ownedSessionsCount < user.sessionLimit;

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-emerald-500/30">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-black tracking-tighter text-xl text-white hover:text-emerald-400 transition">
            LAUNCHED
          </Link>
          <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-zinc-400 font-mono">
            Dashboard Créateur
          </span>
        </div>

        <div className="flex items-center gap-6">
          {user.role === 'ADMIN' && (
            <Link href="/admin" className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
              <Shield className="w-3.5 h-3.5" />
              <span>Panel Admin</span>
            </Link>
          )}

          <div className="flex items-center gap-3">
            {user.avatar && (
              <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full border border-white/10" />
            )}
            <span className="text-xs font-bold text-zinc-200">{user.username}</span>
          </div>

          <a
            href="/api/auth/logout"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("launched_token");
              }
            }}
            title="Déconnexion"
            className="text-zinc-500 hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Welcome & Quotas */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User profile & Quota */}
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Limite de Sessions</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{user.ownedSessionsCount}</span>
              <span className="text-sm font-bold text-zinc-500">/ {user.sessionLimit} sessions</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full mt-4 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${user.sessionLimit > 0 ? Math.min(100, (user.ownedSessionsCount / user.sessionLimit) * 100) : 0}%` }}
              />
            </div>
            {user.sessionLimit === 0 && (
              <p className="text-[11px] text-amber-400 mt-3">
                ⚠️ Compte en attente : demandez à un admin de vous attribuer un quota.
              </p>
            )}
          </div>

          {/* Storage Quota */}
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Espace SFTP Dédié</span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{(user.diskQuotaBytes / (1024 ** 3)).toFixed(0)}</span>
              <span className="text-sm font-bold text-zinc-500">Go alloués</span>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Isolation stricte avec dossiers virtuels protégés contre toute traversée de chemin.
            </p>
          </div>

          {/* New Session CTA */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 border border-emerald-500/20 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Nouvelle Version / Session</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Configurez une session de jeu avec synchronisation automatique et assets.
              </p>
            </div>
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  minecraft: '1.20.1',
                  loaderType: 'fabric',
                  loaderVersion: '0.16.9',
                  syncDir: 'mods,resourcepacks,shaderpacks',
                  welcome: '',
                  jvmArg: '-Xmx4G',
                  credits: `Created by ${user.username}`,
                  hostname: '',
                  crack: false,
                  links: [{ name: 'Discord', url: '', icon: '' }],
                });
                setCreateModalOpen(true);
              }}
              disabled={!canCreateSession}
              className={`mt-4 w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition ${
                canCreateSession 
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer shadow-lg shadow-emerald-500/20' 
                  : 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Créer une session</span>
            </button>
          </div>
        </section>

        {/* SFTP Access Box */}
        {user.sftp.username && (
          <section className="bg-zinc-900/40 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Vos Identifiants SFTP Personnels</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Connectez-vous avec FileZilla, WinSCP ou Cyberduck pour uploader vos mods et images.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegeneratePassword}
                  disabled={regeneratingPassword}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-zinc-300 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPassword ? 'animate-spin' : ''}`} />
                  <span>Régénérer mot de passe</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Hôte SFTP</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">{user.sftp.host}</div>
                </div>
                <button onClick={() => copyToClipboard(user.sftp.host, 'host')} className="text-zinc-400 hover:text-white">
                  {copiedKey === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Port SFTP</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">{user.sftp.port}</div>
                </div>
                <button onClick={() => copyToClipboard(user.sftp.port, 'port')} className="text-zinc-400 hover:text-white">
                  {copiedKey === 'port' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Nom d'utilisateur</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">{user.sftp.username}</div>
                </div>
                <button onClick={() => copyToClipboard(user.sftp.username, 'user')} className="text-zinc-400 hover:text-white">
                  {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Mot de passe</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {showPassword ? user.sftp.password : '••••••••••••'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPassword(!showPassword)} className="text-[10px] text-zinc-400 hover:text-white">
                    {showPassword ? 'Masquer' : 'Voir'}
                  </button>
                  <button onClick={() => copyToClipboard(user.sftp.password, 'pwd')} className="text-zinc-400 hover:text-white">
                    {copiedKey === 'pwd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs bg-white/5 border border-white/5 rounded-xl p-4 font-mono text-zinc-400 space-y-1">
              <div className="text-zinc-300 font-bold mb-1">📁 Structure des dossiers dans votre SFTP :</div>
              <div>/<span className="text-emerald-400">&lt;nom-session&gt;</span>/sync/<span className="text-zinc-500">mods, resourcepacks, shaderpacks, configs...</span></div>
              <div>/<span className="text-emerald-400">&lt;nom-session&gt;</span>/assets/<span className="text-zinc-500">background.png (ou .jpg), logo.png, icon.png</span></div>
            </div>
          </section>
        )}

        {/* Sessions List */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-white">Vos Sessions</h2>
            <span className="text-xs text-zinc-400">{sessions.length} session{sessions.length > 1 ? 's' : ''} disponible{sessions.length > 1 ? 's' : ''}</span>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-zinc-900/20 border border-dashed border-white/10 rounded-2xl p-12 text-center">
              <Server className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 font-bold">Aucune session configurée pour le moment.</p>
              <p className="text-xs text-zinc-600 mt-1">Créez votre première session pour commencer à synchroniser vos mods et images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessions.map((s) => {
                const isOwner = s.myRole === 'OWNER';
                return (
                  <div key={s.id} className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-white/20 transition">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-white">{s.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOwner 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {isOwner ? 'Propriétaire' : 'Collaborateur'}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 font-mono mt-0.5">Dossier SFTP : /{s.slug}/</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            title="Modifier"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {isOwner && (
                            <>
                              <button
                                onClick={() => setCollaboratorSession(s)}
                                title="Gérer les collaborateurs"
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition relative"
                              >
                                <Users className="w-4 h-4" />
                                {s.members.length > 1 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-[9px] font-bold flex items-center justify-center text-white">
                                    {s.members.length}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteSession(s)}
                                title="Supprimer la session"
                                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Specs */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <span className="text-[11px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg text-zinc-300 font-mono">
                          MC {s.minecraft}
                        </span>
                        {s.fabric && (
                          <span className="text-[11px] bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg text-cyan-300 font-mono">
                            Fabric {s.fabric}
                          </span>
                        )}
                        {s.forge && (
                          <span className="text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-amber-300 font-mono">
                            Forge {s.forge}
                          </span>
                        )}
                        {s.neoforge && (
                          <span className="text-[11px] bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg text-orange-300 font-mono">
                            NeoForge {s.neoforge}
                          </span>
                        )}
                        {s.quilt && (
                          <span className="text-[11px] bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg text-purple-300 font-mono">
                            Quilt {s.quilt}
                          </span>
                        )}
                        {s.crack && (
                          <span className="text-[11px] bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg text-red-300 font-mono">
                            Crack autorisé
                          </span>
                        )}
                      </div>

                      {s.welcome && (
                        <p className="text-xs text-zinc-400 mt-3 line-clamp-2 italic">
                          "{s.welcome}"
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span>Dossiers : {s.syncDir}</span>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-6 my-8">
            <h2 className="text-lg font-black text-white">
              {editSession ? `Modifier : ${editSession.name}` : 'Créer une nouvelle session'}
            </h2>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Nom de la session</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: MonServeur RP"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Version Minecraft</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1.20.1"
                    value={formData.minecraft}
                    onChange={(e) => setFormData({ ...formData, minecraft: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Modloader</label>
                  <select
                    value={formData.loaderType}
                    onChange={(e) => setFormData({ ...formData, loaderType: e.target.value })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Version du Loader</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0.16.9 ou 47.3.0"
                    value={formData.loaderVersion}
                    onChange={(e) => setFormData({ ...formData, loaderVersion: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Dossiers de synchronisation (séparés par des virgules)</label>
                <input
                  type="text"
                  value={formData.syncDir}
                  onChange={(e) => setFormData({ ...formData, syncDir: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">RAM / JVM Arg</label>
                  <input
                    type="text"
                    value={formData.jvmArg}
                    onChange={(e) => setFormData({ ...formData, jvmArg: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">IP / Hostname Serveur (Statut)</label>
                  <input
                    type="text"
                    placeholder="Ex: play.mon-serveur.fr"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Message d'accueil</label>
                <textarea
                  rows={2}
                  value={formData.welcome}
                  onChange={(e) => setFormData({ ...formData, welcome: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="crackCheckbox"
                  checked={formData.crack}
                  onChange={(e) => setFormData({ ...formData, crack: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="crackCheckbox" className="text-xs font-bold text-zinc-300">
                  Autoriser les comptes non officiels (Crack / Offline mode)
                </label>
              </div>

              {/* Links configuration (limited to 3) */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Liens de redirection (Max 3)
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {formData.links.length}/3 liens
                  </span>
                </div>

                <div className="space-y-2">
                  {formData.links.map((link, idx) => {
                    const isDiscord = link.url.toLowerCase().includes('discord') || link.name.toLowerCase().includes('discord');
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-black/40 border border-white/5 p-2 rounded-xl">
                        <div className="w-24">
                          <input
                            type="text"
                            placeholder="Nom (ex: Discord)"
                            value={link.name}
                            onChange={(e) => {
                              const updated = [...formData.links];
                              updated[idx].name = e.target.value;
                              setFormData({ ...formData, links: updated });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex-1">
                          <input
                            type="url"
                            placeholder="URL (https://...)"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...formData.links];
                              updated[idx].url = e.target.value;
                              setFormData({ ...formData, links: updated });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border shrink-0">
                          {isDiscord ? (
                            <span className="text-[#5865F2] flex items-center gap-1">
                              💬 Discord SVG
                            </span>
                          ) : (
                            <span className="text-zinc-400 flex items-center gap-1">
                              🌐 Web SVG
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.links.filter((_, i) => i !== idx);
                            setFormData({ ...formData, links: updated });
                          }}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition"
                          title="Supprimer ce lien"
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
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-xl text-xs font-bold text-zinc-300 transition flex items-center justify-center gap-1.5"
                  >
                    <span>+ Ajouter un lien ({3 - formData.links.length} restant{3 - formData.links.length > 1 ? 's' : ''})</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setCreateModalOpen(false); setEditSession(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs"
                >
                  {editSession ? 'Enregistrer' : 'Créer la session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Collaborators & Transfer */}
      {collaboratorSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-black text-white">Collaborateurs : {collaboratorSession.name}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Partagez l'accès SFTP et la gestion de cette session.</p>
              </div>
              <button
                onClick={() => setCollaboratorSession(null)}
                className="text-zinc-500 hover:text-white text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            {/* Add Collaborator form */}
            <form onSubmit={handleAddCollaborator} className="space-y-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Inviter un utilisateur (par son pseudo Discord)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pseudo Discord..."
                  value={collabUsername}
                  onChange={(e) => setCollabUsername(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
                >
                  Ajouter
                </button>
              </div>
              {collabError && <p className="text-[11px] text-red-400">{collabError}</p>}
            </form>

            {/* List members */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Membres actuels ({collaboratorSession.members.length})
              </label>
              <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-black/40">
                {collaboratorSession.members.map((m) => (
                  <div key={m.user.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {m.user.avatar && <img src={m.user.avatar} alt="" className="w-6 h-6 rounded-full" />}
                      <div>
                        <div className="text-xs font-bold text-white">{m.user.username}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {m.role === 'OWNER' ? '👑 Propriétaire' : 'Collaborateur (Accès SFTP actif)'}
                        </div>
                      </div>
                    </div>

                    {m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveCollaborator(m.user.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded-lg"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Transfer of Ownership */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transférer la possession</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Transférer la session à un collaborateur. La session sera décomptée de son quota et vous deviendrez collaborateur.
              </p>
              <div className="flex gap-2">
                <select
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Sélectionner un collaborateur...</option>
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
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed"
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
