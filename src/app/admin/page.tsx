'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, RefreshCw, Users, Server, HardDrive, Check, AlertCircle } from 'lucide-react';

interface AdminUser {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  role: 'ADMIN' | 'CREATOR';
  sessionLimit: number;
  ownedSessionsCount: number;
  diskQuotaBytes: number;
  sftpUsername: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        setError('Accès réservé aux administrateurs');
        return;
      }
      if (res.status === 401) {
        window.location.href = '/api/auth/discord/login';
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
      const data = await res.json();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message || 'Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (userId: string, updates: { sessionLimit?: number; diskQuotaBytes?: number; role?: string }) => {
    setSavingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur');
      }
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Chargement du panel administrateur...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Accès Refusé</h1>
        <p className="text-zinc-400 mb-6">{error}</p>
        <Link href="/dashboard" className="px-6 py-3 bg-white/10 hover:bg-white/20 font-bold rounded-xl transition text-sm">
          Retour au Dashboard
        </Link>
      </div>
    );
  }

  const totalSessions = users.reduce((acc, u) => acc + u.ownedSessionsCount, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-amber-500/30">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-sm font-black uppercase tracking-wider text-white">Panel Administrateur Launched</h1>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-zinc-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Global stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Utilisateurs Inscrits</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white">{users.length}</div>
          </div>

          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sessions Actives Totales</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white">{totalSessions}</div>
          </div>

          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">SFTP Server</span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-sm font-mono font-bold text-white">SFTPGo Active</div>
            <div className="text-[11px] text-zinc-500 mt-1">Dossiers virtuels isolés</div>
          </div>
        </section>

        {/* Users Table */}
        <section className="bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-base font-black text-white">Gestion des Utilisateurs & Quotas</h2>
            <span className="text-xs text-zinc-400">{users.length} comptes enregistrés</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 uppercase tracking-wider text-zinc-400 font-bold border-b border-white/10">
                <tr>
                  <th className="p-4">Utilisateur</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Sessions Utilisées / Quota</th>
                  <th className="p-4">Quota Disque (Go)</th>
                  <th className="p-4">Compte SFTP</th>
                  <th className="p-4 text-right">Actions rapides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const quotaGb = Math.round(u.diskQuotaBytes / (1024 ** 3));
                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.avatar && <img src={u.avatar} alt="" className="w-8 h-8 rounded-full border border-white/10" />}
                          <div>
                            <div className="font-bold text-white text-sm">{u.username}</div>
                            <div className="text-[10px] font-mono text-zinc-500">{u.discordId}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-white/5'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.ownedSessionsCount} /</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            defaultValue={u.sessionLimit}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== u.sessionLimit) {
                                handleUpdateUser(u.id, { sessionLimit: val });
                              }
                            }}
                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-zinc-500">max</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            defaultValue={quotaGb}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== quotaGb) {
                                handleUpdateUser(u.id, { diskQuotaBytes: val * (1024 ** 3) });
                              }
                            }}
                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-cyan-400"
                          />
                          <span className="text-zinc-500">Go</span>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-zinc-400">
                        {u.sftpUsername ? (
                          <span className="text-emerald-400">✓ {u.sftpUsername}</span>
                        ) : (
                          <span className="text-zinc-600">Non configuré</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleUpdateUser(u.id, { role: u.role === 'ADMIN' ? 'CREATOR' : 'ADMIN' })}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition ${
                            u.role === 'ADMIN'
                              ? 'bg-zinc-800 text-zinc-400 border-white/10 hover:bg-red-500/20 hover:text-red-400'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                          }`}
                        >
                          {u.role === 'ADMIN' ? 'Rétrograder Créateur' : 'Nommer Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
