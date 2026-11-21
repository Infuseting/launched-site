import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LaunchSession from '@/components/LaunchSession';

export const metadata: Metadata = {
  title: 'Ouvrir une session — Launched',
  robots: { index: false, follow: false },
};

export default async function LaunchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();

  return <LaunchSession slug={slug} />;
}
