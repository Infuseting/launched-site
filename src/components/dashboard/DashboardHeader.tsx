import { clearStoredToken } from '@/lib/browser-auth';
import Image from 'next/image';
import React from 'react';
import Link from 'next/link';
import { Shield, LogOut } from 'lucide-react';
import type { DashboardUser } from '@/types/dashboard';

interface DashboardHeaderProps {
  user: DashboardUser;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user }) => {
  return (
    <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-4 sm:px-8 py-4 gap-4 flex-wrap flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-black tracking-tighter text-xl text-white hover:text-blue-500 transition-colors"
        >
          LAUNCHED<span className="text-blue-600">.</span>
        </Link>
        <span className="text-zinc-600 font-mono">/</span>
        <span className="text-xs text-zinc-400 font-medium">Espace Créateur</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
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
            <Image
              src={user.avatar}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="w-7 h-7 rounded-full border border-white/10"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/10" />
          )}
          <span className="text-xs font-medium text-zinc-300">{user.username}</span>
        </div>

        <a
          href="/api/auth/logout"
          onClick={clearStoredToken}
          title="Déconnexion"
          aria-label="Déconnexion"
          className="text-zinc-500 hover:text-white transition p-1"
        >
          <LogOut className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};

export default DashboardHeader;
