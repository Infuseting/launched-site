'use client';

import { useOSDetection } from '@/hooks/useOSDetection';
import { GitHubRelease } from '@/lib/github';
import { motion } from 'framer-motion';
import { Download, Monitor, Apple, Terminal, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface HeroProps {
  release: GitHubRelease | null;
}

export default function Hero({ release }: HeroProps) {
  const os = useOSDetection();

  const getDownloadInfo = () => {
    if (!release) return { label: 'Télécharger', url: '#', icon: <Download className="w-5 h-5" /> };
    const assets = release.assets;

    if (os === 'windows') {
      const winAsset = assets.find(a => a.name.endsWith('.exe')) || assets.find(a => a.name.endsWith('.msi'));
      const ext = winAsset?.name.endsWith('.exe') ? '.exe' : '.msi';
      return {
        label: 'Télécharger pour Windows',
        sub: ext + ' — v' + release.version,
        url: winAsset?.browser_download_url || '#',
        icon: <Monitor className="w-5 h-5" />
      };
    } else if (os === 'macos') {
      return {
        label: 'Télécharger pour macOS',
        sub: '.dmg — v' + release.version,
        url: assets.find(a => a.name.endsWith('.dmg'))?.browser_download_url || '#',
        icon: <Apple className="w-5 h-5" />
      };
    } else if (os === 'linux') {
      const linuxAsset = assets.find(a => a.name.endsWith('.AppImage')) 
        || assets.find(a => a.name.endsWith('.deb')) 
        || assets.find(a => a.name.endsWith('.rpm'));
      const ext = linuxAsset?.name.endsWith('.AppImage') ? '.AppImage' : 
                  linuxAsset?.name.endsWith('.deb') ? '.deb' : 
                  linuxAsset?.name.endsWith('.rpm') ? '.rpm' : '.AppImage';
      return {
        label: 'Télécharger pour Linux',
        sub: ext + ' — v' + release.version,
        url: linuxAsset?.browser_download_url || '#',
        icon: <Terminal className="w-5 h-5" />
      };
    }

    return {
      label: 'Télécharger Launched',
      sub: 'v' + (release?.version || ''),
      url: release?.assets?.[0]?.browser_download_url || '#',
      icon: <Download className="w-5 h-5" />
    };
  };

  const info = getDownloadInfo();

  return (
    <section className="relative h-screen w-full flex flex-col bg-[#050505] overflow-hidden">
      {/* Background Ultra-Clean (Pure Black + Soft Vignette) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 z-10" />
        <div className="absolute inset-0 bg-black" />
      </div>

      {/* Top Bar (Style Launcher) */}
      <header className="relative z-20 flex justify-between items-center px-12 py-8">
        <div className="text-xl font-black tracking-tighter">LAUNCHED</div>
        <nav className="flex items-center gap-8 text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <Link href="/downloads" className="hover:text-white transition-colors">Versions</Link>
          <a href="#" className="hover:text-white transition-colors">Discord</a>
        </nav>
      </header>

      {/* Center Logo */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-[12vw] font-black tracking-tighter text-white opacity-[0.03] select-none pointer-events-none absolute"
        >
          LAUNCHED
        </motion.div>


      </div>

      {/* Bottom Bar (Action Area) */}
      <footer className="relative z-20 px-12 py-12 flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-4"
        >
          <a
            href={info.url}
            className="group relative flex items-center justify-center px-16 py-6 bg-white text-black rounded-2xl overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <div className="relative flex flex-col items-center group-hover:text-white transition-colors">
              <span className="text-xl font-black tracking-tighter uppercase">{info.label}</span>
              <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{info.sub}</span>
            </div>
          </a>

          <Link 
            href="/downloads" 
            className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest hover:text-white transition-colors"
          >
            Autres formats (.deb, .rpm, .msi)
          </Link>
        </motion.div>

        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-zinc-600"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </footer>
    </section>
  );
}
