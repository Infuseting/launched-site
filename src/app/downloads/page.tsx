import { getLatestRelease } from "@/lib/github";
import { Monitor, Apple, Terminal, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default async function DownloadsPage() {
  const release = await getLatestRelease();

  const platforms = [
    {
      name: "Windows",
      icon: Monitor,
      extensions: [".exe", ".msi"],
      description: "Installeur standard ou package MSI pour Windows 10/11.",
      color: "text-blue-500",
    },
    {
      name: "macOS",
      icon: Apple,
      extensions: [".dmg"],
      description: "Image disque pour macOS (Intel & Apple Silicon).",
      color: "text-zinc-200",
    },
    {
      name: "Linux",
      icon: Terminal,
      extensions: [".AppImage", ".deb", ".rpm"],
      description: "Formats variés pour les différentes distributions Linux.",
      color: "text-orange-500",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Background decoration (Minimalist) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour à l'accueil
        </Link>

        <div className="mb-16">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            Téléchargements
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl font-light">
            Choisissez la version adaptée à votre système et commencez votre aventure avec Launched.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {platforms.map((platform) => {
            const availableAssets = platform.extensions
              .map(ext => ({ ext, asset: release?.assets.find(a => a.name.endsWith(ext)) }))
              .filter(item => item.asset);

            return (
              <div 
                key={platform.name}
                className="glass p-8 rounded-3xl flex flex-col gap-6 hover:border-white/20 transition-all group"
              >
                <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center ${platform.color}`}>
                  <platform.icon className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-2xl font-bold mb-2">{platform.name}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                    {platform.description}
                  </p>
                  {release ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Dernière version : {release.version}
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-zinc-500">
                      Version : indisponible
                    </div>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-3">
                  {availableAssets.length > 0 ? (
                    availableAssets.map(({ ext, asset }) => (
                      <a
                        key={ext}
                        href={asset!.browser_download_url}
                        className="flex items-center justify-center gap-2 bg-white text-black py-4 rounded-2xl font-bold transition-all hover:bg-zinc-200 active:scale-[0.98]"
                      >
                        <Download className="w-5 h-5" />
                        Télécharger {ext}
                      </a>
                    ))
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 bg-white/10 text-white/30 py-4 rounded-2xl font-bold cursor-not-allowed"
                    >
                      Non disponible
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Alternative downloads / Info */}
        <div className="mt-20 glass p-8 rounded-3xl border-dashed">
          <h3 className="text-xl font-bold mb-4">Besoin d'aide ?</h3>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
            Si votre système n'est pas répertorié ci-dessus, vous pouvez consulter la liste complète des fichiers sur notre 
            <a href="https://github.com/Infuseting/launched/releases" className="text-blue-500 hover:underline ml-1" target="_blank" rel="noopener noreferrer">
              page des releases GitHub
            </a>. 
            Tous nos binaires sont signés et vérifiés pour votre sécurité.
          </p>
        </div>
      </div>
    </main>
  );
}
