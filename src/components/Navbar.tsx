'use client';

import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 bg-black/50 backdrop-blur-xl border-b border-white/5">
      <div className="text-xl font-black tracking-tighter">LAUNCHED</div>
      <nav className="flex items-center gap-8 text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">
        <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
        <Link href="/downloads" className="hover:text-white transition-colors">Versions</Link>
        <a href="https://discord.gg/VxHXZDvtqu" className="hover:text-white transition-colors">Discord</a>
      </nav>
    </header>
  );
}
