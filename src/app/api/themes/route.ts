import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const themes = await prisma.theme.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(themes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Auto-generate slug if not provided
    let slug = data.slug;
    if (!slug) {
      slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const theme = await prisma.theme.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        slug: slug,
        playlistId: data.playlistId,
        customSequence: data.customSequence || null,
        dayDesktop: data.dayDesktop,
        dayMobile: data.dayMobile,
        nightDesktop: data.nightDesktop,
        nightMobile: data.nightMobile,
      }
    });

    return NextResponse.json(theme);
  } catch (error: any) {
    console.error('Error creating theme:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A theme with this slug already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create theme' }, { status: 500 });
  }
}
