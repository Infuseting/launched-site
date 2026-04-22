'use client';

import FeatureCard from "./FeatureCard";
import { LayoutGrid, ShieldCheck, Zap } from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Hub Multi-Launcher",
      subtitle: "Un seul portail, tous vos launchers.",
      description: "Gérez et lancez plusieurs configurations de launchers ou des launchers spécialisés depuis une interface unique.",
      icon: LayoutGrid,
    },
    {
      title: "Connexion Microsoft",
      subtitle: "Sécurité Native.",
      description: "Authentification officielle Microsoft OAuth. Vos identifiants ne transitent jamais par nos serveurs.",
      icon: ShieldCheck,
    },
    {
      title: "Optimisation Intelligente",
      subtitle: "Jouez plus, stockez moins.",
      description: "Moteur de synchronisation intelligent qui détecte les fichiers existants pour éviter les doublons et économiser de l'espace disque.",
      icon: Zap,
    },
  ];

  return (
    <section className="py-24 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Fonctionnalités</h2>
          <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
