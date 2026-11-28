'use client';

import { authFetch } from '@/lib/browser-auth';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/components/Brand';

export default function Navbar() {
  const [user, setUser] = useState<{ username: string; avatar: string | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch('/api/dashboard/me?summary=1', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({ username: data.user.username, avatar: data.user.avatar });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-4 sm:px-8 py-4 sm:py-6 gap-4 flex-wrap bg-black/60 backdrop-blur-xl border-b border-white/5">
      <Link
        href="/"
        className="text-xl font-black tracking-tighter text-white hover:text-blue-500 transition-colors"
      >
        <Brand />
      </Link>
      <nav className="flex items-center gap-x-4 gap-y-0 sm:gap-x-8 flex-wrap text-[11px] font-bold tracking-[0.15em] uppercase text-zinc-400">
        <Link
          href="/#features"
          className="inline-flex min-h-11 items-center hover:text-white transition-colors"
        >
          Fonctionnalités
        </Link>
        <Link
          href="/downloads"
          className="inline-flex min-h-11 items-center hover:text-white transition-colors"
        >
          Téléchargement
        </Link>
        <a
          href="https://discord.gg/MT2urwnNx"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center hover:text-white transition-colors"
        >
          Discord
        </a>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center hover:text-white transition-colors"
        >
          {user ? 'Mon Espace' : 'Espace Créateur'}
        </Link>
      </nav>
    </header>
  );
}
