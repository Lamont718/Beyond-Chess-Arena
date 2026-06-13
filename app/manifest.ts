import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BeyondChess Arena',
    short_name: 'Arena',
    description: 'Log in and play your chess teammates — clocks, ratings, and a computer to practice against.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#211e1a',
    theme_color: '#211e1a',
    orientation: 'any',
    categories: ['games', 'education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
