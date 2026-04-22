'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  index: number;
}

export default function FeatureCard({ icon: Icon, title, subtitle, description, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
      className="glass p-8 rounded-3xl flex flex-col gap-4 group hover:border-white/20 transition-colors"
    >
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500 group-hover:text-blue-400 transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      
      <div>
        <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
        <p className="text-blue-500 font-medium text-sm mb-3">{subtitle}</p>
        <p className="text-zinc-400 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
