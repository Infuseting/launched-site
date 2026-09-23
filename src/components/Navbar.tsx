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
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <Link href="/" className="text-xl font-black tracking-tighter text-white hover:text-blue-500 transition-colors">
        LAUNCHED<span className="text-blue-600">.</span>
      </Link>
      <nav className="flex items-center gap-8 text-[11px] font-bold tracking-[0.15em] uppercase text-zinc-400">
        <a href="/#features" className="hover:text-white transition-colors">Fonctionnalités</a>
        <Link href="/downloads" className="hover:text-white transition-colors">Téléchargement</Link>
        <a href="https://discord.gg/kfzyScBSqS" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
        <Link href="/dashboard" className="hover:text-white transition-colors">
          {user ? 'Mon Espace' : 'Espace Créateur'}
        </Link>
      </nav>
    </header>
  );
}
