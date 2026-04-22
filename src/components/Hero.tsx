'use client';

import { useOSDetection } from '@/hooks/useOSDetection';
import { GitHubRelease } from '@/lib/github';
import { motion } from 'framer-motion';
import { Download, Monitor, Apple, Terminal } from 'lucide-react';
import Link from 'next/link';

interface HeroProps {
  release: GitHubRelease | null;
}

export default function Hero({ release }: HeroProps) {
  const os = useOSDetection();

  const getDownloadInfo = () => {
    if (!release) return { label: 'Télécharger', url: '#', icon: <Download className="w-5 h-5" /> };

    const assets = release.assets;
    let targetAsset = null;

    if (os === 'windows') {
      targetAsset = assets.find(a => a.name.endsWith('.exe'));
      return {
        label: 'Télécharger pour Windows (.exe)',
        url: targetAsset?.browser_download_url || '#',
        icon: <Monitor className="w-5 h-5" />
      };
    } else if (os === 'macos') {
      targetAsset = assets.find(a => a.name.endsWith('.dmg'));
      return {
        label: 'Télécharger pour macOS (.dmg)',
        url: targetAsset?.browser_download_url || '#',
        icon: <Apple className="w-5 h-5" />
      };
    } else if (os === 'linux') {
      targetAsset = assets.find(a => a.name.endsWith('.AppImage'));
      return {
        label: 'Télécharger pour Linux (.AppImage)',
        url: targetAsset?.browser_download_url || '#',
        icon: <Terminal className="w-5 h-5" />
      };
    }

    return {
      label: 'Télécharger la dernière version',
      url: release?.assets?.[0]?.browser_download_url || '#',
      icon: <Download className="w-5 h-5" />
    };
  };

  const downloadInfo = getDownloadInfo();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Background Effect */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(50,50,50,0.5),rgba(0,0,0,1))]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 text-center px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-8xl md:text-9xl font-black tracking-tighter text-white mb-4"
        >
          LAUNCHED
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto font-light tracking-wide"
        >
          Un launcher Minecraft minimaliste et performant pour l'ère moderne.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <a
            href={downloadInfo.url}
            className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            {downloadInfo.icon}
            {downloadInfo.label}
          </a>

          {release && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-500 font-mono text-sm">
                Version {release.version}
              </p>
              <Link 
                href="/downloads" 
                className="text-zinc-500 hover:text-white transition-colors text-xs underline underline-offset-4"
              >
                Toutes les versions
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}
