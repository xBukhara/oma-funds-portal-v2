import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminToken = req.cookies.get('oma-admin-token')?.value;
    if (adminToken !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  if (pathname.startsWith('/i/')) {
    const supabaseCookies = [...req.cookies.getAll()].some(c =>
      c.name.startsWith('sb-') && c.value.length > 0
    );
    if (!supabaseCookies) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/i/:path*'],
};
