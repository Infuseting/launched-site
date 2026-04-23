'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface ParallaxSectionProps {
  title: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
}

export default function ParallaxSection({ title, description, visual, reverse }: ParallaxSectionProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <section ref={ref} className={`py-32 px-12 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16 max-w-7xl mx-auto`}>
      <div className="flex-1 space-y-6">
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">{title}</h2>
        <p className="text-zinc-500 text-lg leading-relaxed">{description}</p>
      </div>
      <motion.div style={{ y }} className="flex-1 w-full aspect-square bg-zinc-900/50 border border-white/5 rounded-[40px] flex items-center justify-center overflow-hidden">
        {visual}
      </motion.div>
    </section>
  );
}
