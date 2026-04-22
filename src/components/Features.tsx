'use client';

import FeatureCard from "./FeatureCard";
import { LayoutGrid, ShieldCheck, Zap } from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Hub Multi-Launcher",
      description: "Gérez et lancez plusieurs configurations de launchers ou des launchers spécialisés depuis une interface unique.",
      icon: LayoutGrid,
    },
    {
      title: "Connexion Microsoft",
      description: "Authentification officielle Microsoft OAuth. Vos identifiants ne transitent jamais par nos serveurs.",
      icon: ShieldCheck,
    },
    {
      title: "Optimisation Intelligente",
      description: "Moteur de synchronisation intelligent qui détecte les fichiers existants pour éviter les doublons et économiser de l'espace disque.",
      icon: Zap,
    },
  ];

  return (
    <section id="features" className="py-32 px-12 relative bg-[#050505]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-24">
          <span className="text-blue-500 font-black tracking-[0.3em] uppercase text-[10px] mb-4 block">Pourquoi choisir Launched ?</span>
          <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white uppercase">Fonctionnalités Clés</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              index={index}
              {...feature}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
