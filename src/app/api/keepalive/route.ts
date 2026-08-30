import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

// This endpoint is pinged by a free cron service (e.g. cron-job.org)
// every 3 days to prevent Supabase free-tier from auto-pausing.
export async function GET() {
  try {
    const count = await prisma.theme.count();
    return NextResponse.json({ 
      status: 'alive', 
      themes: count, 
      timestamp: new Date().toISOString() 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: e.message 
    }, { status: 500 });
  }
}
