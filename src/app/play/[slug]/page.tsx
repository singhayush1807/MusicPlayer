import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import PlayerClient from './PlayerClient';

// Hardcoded fallback themes so the player works even when DB is unreachable
const FALLBACK_THEMES: Record<string, any> = {
  'pyar-bhare-geet': {
    id: 'fallback-pyar',
    slug: 'pyar-bhare-geet',
    title: 'प्यार भरे गीत',
    subtitle: 'Lo-fi love · all night',
    playlistId: 'PLRiJDPquklv4cT2O5-gD4_C0-8a_R4NfO',
    customSequence: null,
    dayDesktop: '/assets/DesktopDay.png',
    dayMobile: '/assets/MobileDay.png',
    nightDesktop: '/assets/DesktopNight.png',
    nightMobile: '/assets/MobileNight.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
};

export default async function PlayRoute({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  
  let theme = null;
  try {
    theme = await prisma.theme.findUnique({
      where: { slug: resolvedParams.slug }
    });
  } catch (e) {
    // DB unreachable — use fallback
    console.warn('[MusicPrime] DB unreachable, using fallback theme for:', resolvedParams.slug);
  }

  // Use fallback if DB returned nothing or was unreachable
  if (!theme) {
    theme = FALLBACK_THEMES[resolvedParams.slug];
  }

  if (!theme) {
    notFound();
  }

  return <PlayerClient theme={theme} />;
}
