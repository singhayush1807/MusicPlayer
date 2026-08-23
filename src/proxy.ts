import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  // Only protect /admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      const validPassword = process.env.ADMIN_PASSWORD;
      
      // Check if password matches. (Username can be anything, e.g. admin)
      if (pwd === validPassword) {
        return NextResponse.next();
      }
    }

    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
