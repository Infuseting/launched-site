'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export default function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.8 }}
      className="group relative p-12 bg-zinc-900/10 border border-white/5 rounded-[40px] hover:border-white/10 transition-colors"
    >
      <div className="w-12 h-12 mb-8 text-zinc-600 group-hover:text-blue-500 transition-colors">
        <Icon strokeWidth={1.5} size={48} />
      </div>
      
      <h3 className="text-2xl font-black tracking-tighter mb-4 uppercase">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed font-medium">
        {description}
      </p>
    </motion.div>
  );
}
