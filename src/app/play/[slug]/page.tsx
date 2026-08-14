import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import PlayerClient from './PlayerClient';

export default async function PlayRoute({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const theme = await prisma.theme.findUnique({
    where: { slug: resolvedParams.slug }
  });

  if (!theme) {
    notFound();
  }

  return <PlayerClient theme={theme} />;
}
