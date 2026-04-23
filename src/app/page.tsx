import { getLatestRelease } from "@/lib/github";
import Hero from "@/components/Hero";
import ParallaxSection from "@/components/ParallaxSection";
import { DiskVisual, OAuthVisual, HubVisual } from "@/components/TechnicalVisuals";

export default async function Home() {
  const release = await getLatestRelease();

  return (
    <main className="flex min-h-screen flex-col bg-black overflow-x-hidden">
      <Hero release={release} />
      
      <div id="features" className="space-y-32 pb-64">
        <ParallaxSection 
          title="Optimisation Intelligente"
          description="Économisez jusqu'à 60% d'espace disque grâce à notre moteur de dédoublonnement qui détecte les fichiers communs entre vos instances."
          visual={<div aria-hidden="true" className="w-full h-full"><DiskVisual /></div>}
        />
        
        <ParallaxSection 
          title="Sécurité Native"
          description="Connexion officielle Microsoft OAuth. Nous n'avons jamais accès à vos identifiants, tout se passe entre vous et Microsoft."
          visual={<div aria-hidden="true"><OAuthVisual /></div>}
          reverse
        />
        
        <ParallaxSection 
          title="Hub Multi-Launcher"
          description="Gérez toutes vos configurations Minecraft depuis un point central unique, optimisé pour la vitesse."
          visual={<div aria-hidden="true"><HubVisual /></div>}
        />
      </div>
    </main>
  );
}
