'use client';

import { useOSDetection } from '@/hooks/useOSDetection';
import { GitHubRelease } from '@/lib/github';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function Hero({ release }: { release: GitHubRelease | null }) {
  const os = useOSDetection();
  
  const getDownloadInfo = () => {
    if (!release) return { url: '#', sub: '' };
    const assets = release.assets;

    if (os === 'windows') {
      const winAsset = assets.find(a => a.name.endsWith('.exe')) || assets.find(a => a.name.endsWith('.msi'));
      const ext = winAsset?.name.endsWith('.exe') ? '.exe' : '.msi';
      return {
        sub: ext + ' — v' + release.version,
        url: winAsset?.browser_download_url || '#',
      };
    } else if (os === 'macos') {
      return {
        sub: '.dmg — v' + release.version,
        url: assets.find(a => a.name.endsWith('.dmg'))?.browser_download_url || '#',
      };
    } else if (os === 'linux') {
      const linuxAsset = assets.find(a => a.name.endsWith('.AppImage'))
        || assets.find(a => a.name.endsWith('.deb'))
        || assets.find(a => a.name.endsWith('.rpm'));
      const ext = linuxAsset?.name.endsWith('.AppImage') ? '.AppImage' :
        linuxAsset?.name.endsWith('.deb') ? '.deb' :
          linuxAsset?.name.endsWith('.rpm') ? '.rpm' : '.AppImage';
      return {
        sub: ext + ' — v' + release.version,
        url: linuxAsset?.browser_download_url || '#',
      };
    }

    return {
      sub: 'v' + (release?.version || ''),
      url: release?.assets?.[0]?.browser_download_url || '#',
    };
  };

  const info = getDownloadInfo();

  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center bg-black overflow-hidden pt-20">
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-[15vw] md:text-[12vw] font-black tracking-tighter leading-none text-white text-center"
      >
        LAUNCHED<span className="text-blue-600">.</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="mt-12"
      >
        <a href={info.url} className="px-12 py-5 bg-white text-black rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all">
          TÉLÉCHARGER
        </a>
      </motion.div>

      <div className="absolute bottom-12 flex flex-col items-center gap-2 text-zinc-600">
        <span className="text-[10px] font-bold tracking-widest uppercase">{info.sub}</span>
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown size={20} />
        </motion.div>
      </div>
    </section>
  );
}
