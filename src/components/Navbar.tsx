'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [user, setUser] = useState<{ username: string; avatar: string | null } | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('launched_token') : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    fetch('/api/dashboard/me', {
      credentials: 'include',
      headers,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({ username: data.user.username, avatar: data.user.avatar });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 bg-black/50 backdrop-blur-xl border-b border-white/5">
      <Link href="/" className="text-xl font-black tracking-tighter text-white hover:text-emerald-400 transition-colors">LAUNCHED</Link>
      <nav className="flex items-center gap-8 text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">
        <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
        <Link href="/downloads" className="hover:text-white transition-colors">Versions</Link>
        <Link 
          href="/dashboard" 
          className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2"
        >
          {user ? (
            <>
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-5 h-5 rounded-full border border-emerald-400/40" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span>Mon Espace ({user.username})</span>
            </>
          ) : (
            <span>Espace Créateur</span>
          )}
        </Link>
        <a href="https://discord.gg/kfzyScBSqS" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
      </nav>
    </header>
  );
}
