'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LaunchSession({ slug }: { slug: string }) {
  const deepLink = `launched://session/${encodeURIComponent(slug)}`;

  useEffect(() => {
    // Keep the page available if the browser blocks automatic protocol opening.
    window.location.href = deepLink;
  }, [deepLink]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 pb-20 pt-52 sm:pt-36">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-3xl border border-border bg-background p-6 sm:p-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">LAUNCHED</p>
          <h1 className="text-3xl font-bold tracking-tight">Ouvrir votre session</h1>
          <p className="break-words font-mono text-sm text-muted-foreground">{slug}</p>
          <p className="text-base leading-relaxed text-muted-foreground">
            Autorisez votre navigateur à ouvrir Launched. Si rien ne se passe, utilisez le bouton
            ci-dessous.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="min-h-11">
            <a href={deepLink}>
              <Play data-icon="inline-start" aria-hidden="true" />
              Ouvrir dans Launched
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-11">
            <Link href="/downloads">
              <Download data-icon="inline-start" aria-hidden="true" />
              Télécharger Launched
            </Link>
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Déjà installé ? Ouvrez Launched une fois, puis réessayez. Les sessions privées nécessitent
          toujours un compte Discord autorisé dans le launcher.
        </p>
      </section>
    </main>
  );
}
