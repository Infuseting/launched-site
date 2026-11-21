import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Launched',
    short_name: 'Launched',
    lang: 'fr',
    start_url: '/',
    display: 'browser',
    background_color: '#142447',
    theme_color: '#142447',
    icons: [
      { src: '/branding/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/branding/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
