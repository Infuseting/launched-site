'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, RefreshCw, Users, Server, AlertCircle } from 'lucide-react';

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

  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('launched_token');
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = getStoredToken();
    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/admin/users');
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
    try {
      const res = await authFetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>Chargement du panel administrateur...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-zinc-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Accès refusé</h1>
        <p className="text-zinc-500 text-sm mb-6">{error}</p>
        <Link 
          href="/dashboard" 
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition text-xs"
        >
          Retour au dashboard
        </Link>
      </div>
    );
  }

  const totalSessions = users.reduce((acc, u) => acc + u.ownedSessionsCount, 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h1 className="text-sm font-semibold text-white">Administration</h1>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Simple Stats Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500">Utilisateurs inscrits</span>
              <div className="text-2xl font-bold text-white mt-1">{users.length}</div>
            </div>
            <Users className="w-5 h-5 text-zinc-600" />
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500">Total sessions créées</span>
              <div className="text-2xl font-bold text-white mt-1">{totalSessions}</div>
            </div>
            <Server className="w-5 h-5 text-zinc-600" />
          </div>
        </section>

        {/* Users Table */}
        <section className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Comptes et quotas</h2>
            <span className="text-xs text-zinc-500">{users.length} utilisateur{users.length > 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-zinc-400 font-medium border-b border-white/10">
                <tr>
                  <th className="p-4">Utilisateur</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Sessions</th>
                  <th className="p-4">Stockage</th>
                  <th className="p-4">Compte SFTP</th>
                  <th className="p-4 text-right">Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const quotaGb = Math.round(u.diskQuotaBytes / (1024 ** 3));
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-7 h-7 rounded-full border border-white/10" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/10" />
                          )}
                          <div>
                            <div className="font-semibold text-white">{u.username}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{u.discordId}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          u.role === 'ADMIN'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-white/5 text-zinc-400 border-white/5'
                        }`}>
                          {u.role === 'ADMIN' ? 'Administrateur' : 'Créateur'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono">{u.ownedSessionsCount} /</span>
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
                            className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-zinc-500">max</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="500"
                            defaultValue={quotaGb}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== quotaGb) {
                                handleUpdateUser(u.id, { diskQuotaBytes: val * (1024 ** 3) });
                              }
                            }}
                            className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-zinc-500">Go</span>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-zinc-400">
                        {u.sftpUsername ? (
                          <span className="text-zinc-300">{u.sftpUsername}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleUpdateUser(u.id, { role: u.role === 'ADMIN' ? 'CREATOR' : 'ADMIN' })}
                          className="text-[11px] text-zinc-400 hover:text-white px-2.5 py-1 rounded border border-white/10 hover:border-white/20 transition"
                        >
                          {u.role === 'ADMIN' ? 'Passer Créateur' : 'Passer Admin'}
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
