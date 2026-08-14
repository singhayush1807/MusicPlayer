import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await prisma.theme.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete theme' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await req.json();
    const updatedTheme = await prisma.theme.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        playlistId: data.playlistId,
        dayDesktop: data.dayDesktop,
        dayMobile: data.dayMobile,
        nightDesktop: data.nightDesktop,
        nightMobile: data.nightMobile,
      }
    });
    return NextResponse.json(updatedTheme);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
  }
}
